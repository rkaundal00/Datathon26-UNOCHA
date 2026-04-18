"""Cluster drilldowns — per-country and cohort-wide aggregate."""
from __future__ import annotations

import polars as pl

from pipeline.ingest.fts import load_cluster
from pipeline.ingest.hno import cluster_pin_rows, load_hno

# Mapping HNO short codes → harmonized globalCluster names (best-effort; FTS taxonomy uses full names).
HNO_CLUSTER_TO_NAME = {
    "EDU": "Education",
    "FSC": "Food Security",
    "HEA": "Health",
    "LOG": "Logistics",
    "NUT": "Nutrition",
    "PRO": "Protection",
    "PRO-GBV": "Protection - Gender-Based Violence",
    "PRO-CPN": "Protection - Child Protection",
    "PRO-HLP": "Protection - Housing, Land and Property",
    "PRO-MIN": "Protection - Mine Action",
    "SHL": "Emergency Shelter and NFI",
    "WSH": "Water Sanitation Hygiene",
    "MPC": "Multipurpose Cash",
    "CCM": "Camp Coordination / Management",
    "ERY": "Early Recovery",
    "CSS": "Coordination and support services",
    "ETC": "Emergency Telecommunications",
    "MS": "Multi-sector",
    "AGR": "Agriculture",
    "ETE": "Emergency Telecommunications",
}


def _hno_clusters_for_year(year: int) -> pl.DataFrame:
    df = cluster_pin_rows(load_hno(year))
    return df.with_columns(
        pl.col("cluster")
        .replace(HNO_CLUSTER_TO_NAME, default=pl.col("cluster"))
        .alias("cluster_name")
    )


def cluster_drilldown_per_country(iso3: str, analysis_year: int) -> pl.DataFrame:
    """One row per cluster for `iso3`. Sorted by unmet_need_usd desc.

    Prefers harmonized (globalCluster). If harmonized has no rows for this country-year
    but the raw cluster file does, fall back to raw and flag every row with
    cluster_taxonomy_mismatch.
    """
    hno = _hno_clusters_for_year(analysis_year).filter(pl.col("iso3") == iso3)
    harmonized = load_cluster(harmonized=True).filter(
        (pl.col("iso3") == iso3) & (pl.col("year") == analysis_year)
    )

    if harmonized.is_empty():
        raw = load_cluster(harmonized=False).filter(
            (pl.col("iso3") == iso3) & (pl.col("year") == analysis_year)
        )
        fts_by_cluster = raw.group_by("cluster_name").agg(
            pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
            pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        )
        fts_by_cluster = fts_by_cluster.with_columns(
            pl.lit(True).alias("taxonomy_mismatch")
        )
    else:
        fts_by_cluster = harmonized.group_by("cluster_name").agg(
            pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
            pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        )
        fts_by_cluster = fts_by_cluster.with_columns(
            pl.lit(False).alias("taxonomy_mismatch")
        )

    hno_lookup = hno.select(
        pl.col("cluster_name"), pl.col("pin_cluster")
    )

    joined = fts_by_cluster.join(hno_lookup, on="cluster_name", how="outer_coalesce")
    joined = joined.with_columns(
        pl.col("pin_cluster").fill_null(0).cast(pl.Int64),
        pl.col("requirements_usd").fill_null(0.0).cast(pl.Int64),
        pl.col("funding_usd").fill_null(0.0).cast(pl.Int64),
        pl.col("taxonomy_mismatch").fill_null(False),
    )
    joined = joined.with_columns(
        pl.when(pl.col("requirements_usd") > 0)
        .then(pl.col("funding_usd") / pl.col("requirements_usd"))
        .otherwise(0.0)
        .alias("coverage_ratio"),
        pl.when(pl.col("requirements_usd") > pl.col("funding_usd"))
        .then(pl.col("requirements_usd") - pl.col("funding_usd"))
        .otherwise(0)
        .alias("unmet_need_usd"),
    )
    joined = joined.with_columns(
        pl.when(pl.col("coverage_ratio") < 0.20)
        .then(pl.lit("low"))
        .otherwise(pl.lit("normal"))
        .alias("coverage_flag"),
    )
    rows = joined.to_dicts()
    for r in rows:
        flags = []
        if r.get("taxonomy_mismatch"):
            flags.append("cluster_taxonomy_mismatch")
        r["qa_flags"] = flags
    out = pl.from_dicts(
        rows,
        schema={
            "cluster_name": pl.Utf8,
            "pin_cluster": pl.Int64,
            "requirements_usd": pl.Int64,
            "funding_usd": pl.Int64,
            "coverage_ratio": pl.Float64,
            "unmet_need_usd": pl.Int64,
            "coverage_flag": pl.Utf8,
            "qa_flags": pl.List(pl.Utf8),
            "taxonomy_mismatch": pl.Boolean,
        },
    )
    return out.drop("taxonomy_mismatch").sort("unmet_need_usd", descending=True)


def cluster_drilldown_aggregate(
    analysis_year: int, cohort_iso3s: list[str]
) -> pl.DataFrame:
    """Cohort-wide. Σ PIN, Σ requirements, Σ funding per cluster. Requirements-weighted coverage."""
    harmonized = load_cluster(harmonized=True).filter(
        pl.col("iso3").is_in(cohort_iso3s) & (pl.col("year") == analysis_year)
    )
    fts_agg = harmonized.group_by("cluster_name").agg(
        pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
        pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        pl.col("iso3").n_unique().alias("countries_count"),
    )
    hno = _hno_clusters_for_year(analysis_year).filter(
        pl.col("iso3").is_in(cohort_iso3s)
    )
    hno_agg = hno.group_by("cluster_name").agg(
        pl.col("pin_cluster").fill_null(0).sum().alias("pin_cluster")
    )
    joined = fts_agg.join(hno_agg, on="cluster_name", how="outer_coalesce")
    joined = joined.with_columns(
        pl.col("pin_cluster").fill_null(0).cast(pl.Int64),
        pl.col("requirements_usd").fill_null(0.0).cast(pl.Int64),
        pl.col("funding_usd").fill_null(0.0).cast(pl.Int64),
        pl.col("countries_count").fill_null(0).cast(pl.Int64),
    ).with_columns(
        pl.when(pl.col("requirements_usd") > 0)
        .then(pl.col("funding_usd") / pl.col("requirements_usd"))
        .otherwise(0.0)
        .alias("coverage_ratio"),
        pl.when(pl.col("requirements_usd") > pl.col("funding_usd"))
        .then(pl.col("requirements_usd") - pl.col("funding_usd"))
        .otherwise(0)
        .alias("unmet_need_usd"),
    )
    joined = joined.with_columns(
        pl.when(pl.col("coverage_ratio") < 0.20)
        .then(pl.lit("low"))
        .otherwise(pl.lit("normal"))
        .alias("coverage_flag"),
        pl.lit([], dtype=pl.List(pl.Utf8)).alias("qa_flags"),
    )
    return joined.sort("unmet_need_usd", descending=True)
