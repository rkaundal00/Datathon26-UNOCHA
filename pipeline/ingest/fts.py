"""FTS loaders — aggregate appeals, per-cluster, and 2026 incoming transactions."""
from __future__ import annotations

import polars as pl

from pipeline.config import (
    FTS_APPEALS,
    FTS_GLOBAL_CLUSTER,
    FTS_INCOMING_2026,
    FTS_RAW_CLUSTER,
)


def load_appeals() -> pl.DataFrame:
    """Return appeal × year rows with canonical names.

    Columns:
        iso3, plan_code, plan_name, plan_type_raw, year,
        requirements_usd (Float64), funding_usd (Float64), percent_funded_reported (Float64)
    """
    df = pl.read_parquet(FTS_APPEALS)
    return df.select(
        pl.col("countryCode").alias("iso3"),
        pl.col("code").cast(pl.Utf8, strict=False).alias("plan_code"),
        pl.col("name").alias("plan_name"),
        pl.col("typeName").alias("plan_type_raw"),
        pl.col("year").cast(pl.Int64),
        pl.col("requirements").cast(pl.Float64).alias("requirements_usd"),
        pl.col("funding").cast(pl.Float64).alias("funding_usd"),
        pl.col("percentFunded").cast(pl.Float64).alias("percent_funded_reported"),
    )


def load_cluster(harmonized: bool = True) -> pl.DataFrame:
    """Return per-cluster appeal rows.

    harmonized=True → globalCluster taxonomy (preferred).
    harmonized=False → raw cluster taxonomy (fallback for cluster_taxonomy_mismatch).
    """
    path = FTS_GLOBAL_CLUSTER if harmonized else FTS_RAW_CLUSTER
    df = pl.read_parquet(path)
    return df.select(
        pl.col("countryCode").alias("iso3"),
        pl.col("code").cast(pl.Utf8, strict=False).alias("plan_code"),
        pl.col("name").alias("plan_name"),
        pl.col("year").cast(pl.Int64),
        pl.col("clusterCode").cast(pl.Utf8, strict=False).alias("cluster_code"),
        pl.col("cluster").alias("cluster_name"),
        pl.col("requirements").cast(pl.Float64).alias("requirements_usd"),
        pl.col("funding").cast(pl.Float64).alias("funding_usd"),
        pl.col("percentFunded").cast(pl.Float64).alias("percent_funded_reported"),
    )


def load_incoming_2026() -> pl.DataFrame:
    """Return exploded incoming-transaction rows, one per (iso3, donor, status).

    destLocations is a comma-separated list of ISO3 codes; each comma-separated entry
    yields a new row. contributionType != 'financial' rows are dropped.
    """
    df = pl.read_parquet(FTS_INCOMING_2026)
    df = df.filter(pl.col("contributionType") == "financial")
    df = df.with_columns(
        pl.col("destLocations")
        .cast(pl.Utf8)
        .str.split(",")
        .alias("dest_locations_list")
    ).explode("dest_locations_list")
    df = df.with_columns(
        pl.col("dest_locations_list").str.strip_chars().alias("iso3")
    )
    return df.select(
        pl.col("iso3"),
        pl.col("destPlanCode").cast(pl.Utf8, strict=False).alias("dest_plan_code"),
        pl.col("srcOrganization").alias("src_organization"),
        pl.col("contributionType").alias("contribution_type"),
        pl.col("status"),
        pl.col("amountUSD").cast(pl.Int64).alias("amount_usd"),
        pl.col("flowType").alias("flow_type"),
        pl.col("budgetYear").cast(pl.Int64, strict=False).alias("budget_year"),
        pl.col("destUsageYearStart").cast(pl.Int64, strict=False).alias("usage_year_start"),
        pl.col("destUsageYearEnd").cast(pl.Int64, strict=False).alias("usage_year_end"),
    ).filter(pl.col("iso3").is_not_null() & (pl.col("iso3") != ""))


def appeals_country_year(appeals: pl.DataFrame, analysis_year: int) -> pl.DataFrame:
    """Aggregate appeals to (iso3, requirements_usd, funding_usd) for a single year.

    Multiple plans per country are summed. Null/NaN are treated as 0.
    """
    return (
        appeals.filter(pl.col("year") == analysis_year)
        .group_by("iso3")
        .agg(
            pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
            pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        )
    )


HRP_TYPES = {
    "Humanitarian response plan",
    "Humanitarian needs and response plan",
    "Strategic response plan",
    "Consolidated appeals process",
    "Consolidated inter-agency appeal",
}


def derive_hrp_status(
    appeals: pl.DataFrame, iso3: str, analysis_year: int
) -> str:
    """Resolve hrp_status per spec-data-pipeline §0.5 cascade.

    1. If any plan for (iso3, year) has typeName matching known categories → HRP/Flash/Regional.
    2. Else if requirements > 0 → Unknown.
    3. Else → None.
    """
    sub = appeals.filter(
        (pl.col("iso3") == iso3) & (pl.col("year") == analysis_year)
    )
    if sub.is_empty():
        return "None"
    types = [t for t in sub["plan_type_raw"].to_list() if t is not None]
    for t in types:
        if t in HRP_TYPES:
            return "HRP"
        if t == "Flash appeal":
            return "FlashAppeal"
        if t == "Regional response plan":
            return "RegionalRP"
    # No matched type; check requirements
    total_req = (
        sub["requirements_usd"].fill_null(0).sum()
        if "requirements_usd" in sub.columns
        else 0
    )
    if types and not set(types).issubset({"Other"}) is False:
        # typeName is 'Other' only
        if total_req and total_req > 0:
            return "Other"
    if any(t == "Other" for t in types):
        return "Other"
    # No typeName populated; use requirements
    if total_req and total_req > 0:
        return "Unknown"
    return "None"


def hrp_status_table(appeals: pl.DataFrame, analysis_year: int) -> pl.DataFrame:
    """Per-iso3 hrp_status for the analysis year.

    Returns columns: iso3, hrp_status. Countries not in the FTS for this year get 'None'.
    """
    sub = appeals.filter(pl.col("year") == analysis_year)

    def resolve(group: pl.DataFrame) -> dict:
        types = [t for t in group["plan_type_raw"].to_list() if t is not None]
        total_req = group["requirements_usd"].fill_null(0).sum() or 0
        if any(t in HRP_TYPES for t in types):
            return {"hrp_status": "HRP"}
        if any(t == "Flash appeal" for t in types):
            return {"hrp_status": "FlashAppeal"}
        if any(t == "Regional response plan" for t in types):
            return {"hrp_status": "RegionalRP"}
        if any(t == "Other" for t in types):
            return {"hrp_status": "Other"}
        if total_req > 0:
            return {"hrp_status": "Unknown"}
        return {"hrp_status": "None"}

    # Polars group_by + agg with python function
    result = []
    for iso3 in sub["iso3"].unique().to_list():
        grp = sub.filter(pl.col("iso3") == iso3)
        result.append({"iso3": iso3, **resolve(grp)})
    return pl.DataFrame(
        result if result else {"iso3": [], "hrp_status": []},
        schema={"iso3": pl.Utf8, "hrp_status": pl.Utf8},
    )
