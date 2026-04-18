"""HNO loaders — 2024/2025/2026 with per-year schema handling."""
from __future__ import annotations

from typing import Literal

import polars as pl

from pipeline.config import HNO_FILE


def _cast_string_numeric(df: pl.DataFrame, cols: tuple[str, ...]) -> pl.DataFrame:
    """HNO 2024/2025 store numerics as strings with potential commas. Cast to Int64, null-passthrough."""
    exprs = []
    for c in cols:
        if c in df.columns:
            exprs.append(
                pl.col(c)
                .cast(pl.Utf8)
                .str.replace_all(",", "")
                .cast(pl.Int64, strict=False)
                .alias(c)
            )
    return df.with_columns(exprs) if exprs else df


def load_hno(year: Literal[2024, 2025, 2026]) -> pl.DataFrame:
    """Return HNO rows with canonical snake_case columns.

    Columns (union across years; absent columns are null):
        iso3, admin1_pcode, admin2_pcode, admin3_pcode, cluster,
        category, pin, targeted, affected, reached, population
    """
    path = HNO_FILE[year]
    df = pl.read_parquet(path)

    # HNO 2024 / 2025 have an HXL-tag first row (e.g. "#country+code"). Drop if ISO3 starts with "#".
    if year in (2024, 2025):
        first_iso3 = df["Country ISO3"].to_list()[0] if len(df) > 0 else None
        if first_iso3 and str(first_iso3).startswith("#"):
            df = df.slice(1)
        df = _cast_string_numeric(
            df, ("Population", "In Need", "Targeted", "Affected", "Reached")
        )

    # Select + rename. 2024 has no P-codes; 2026 has none either.
    def col_or_null(name: str, dtype: pl.DataType) -> pl.Expr:
        if name in df.columns:
            return pl.col(name)
        return pl.lit(None, dtype=dtype).alias(name)

    out = df.select(
        pl.col("Country ISO3").alias("iso3"),
        (
            col_or_null("Admin 1 PCode", pl.Utf8).cast(pl.Utf8).alias("admin1_pcode")
            if year == 2025
            else pl.lit(None, dtype=pl.Utf8).alias("admin1_pcode")
        ),
        (
            col_or_null("Admin 2 PCode", pl.Utf8).cast(pl.Utf8).alias("admin2_pcode")
            if year == 2025
            else pl.lit(None, dtype=pl.Utf8).alias("admin2_pcode")
        ),
        (
            col_or_null("Admin 3 PCode", pl.Utf8).cast(pl.Utf8).alias("admin3_pcode")
            if year == 2025
            else pl.lit(None, dtype=pl.Utf8).alias("admin3_pcode")
        ),
        pl.col("Cluster").alias("cluster"),
        pl.col("Category").cast(pl.Utf8, strict=False).alias("category"),
        pl.col("In Need").cast(pl.Int64, strict=False).alias("pin"),
        pl.col("Targeted").cast(pl.Int64, strict=False).alias("targeted"),
        pl.col("Affected").cast(pl.Int64, strict=False).alias("affected"),
        pl.col("Reached").cast(pl.Int64, strict=False).alias("reached"),
        pl.col("Population").cast(pl.Int64, strict=False).alias("population"),
    )
    return out


def country_pin_row(hno: pl.DataFrame, iso3: str) -> pl.DataFrame | None:
    """Return the single country-level PIN row (cluster='ALL', category null) for an iso3, or None."""
    sub = hno.filter(
        (pl.col("iso3") == iso3)
        & (pl.col("cluster") == "ALL")
        & pl.col("category").is_null()
        & (
            pl.col("admin1_pcode").is_null()
            if "admin1_pcode" in hno.columns
            else pl.lit(True)
        )
    )
    if sub.is_empty():
        return None
    return sub.head(1)


def country_level_pin_table(hno: pl.DataFrame) -> pl.DataFrame:
    """One row per iso3 with country-level PIN (cluster='ALL', category null, national row)."""
    # For 2025 (has admin pcodes), country-level row has all admin_*_pcode null.
    return (
        hno.filter(
            (pl.col("cluster") == "ALL")
            & pl.col("category").is_null()
            & pl.col("admin1_pcode").is_null()
            & pl.col("admin2_pcode").is_null()
            & pl.col("admin3_pcode").is_null()
        )
        .group_by("iso3")
        .agg(
            pl.col("pin").first().alias("pin"),
            pl.col("targeted").first().alias("targeted"),
            pl.col("affected").first().alias("affected"),
            pl.col("reached").first().alias("reached"),
            pl.col("population").first().alias("hno_population"),
        )
    )


def cluster_pin_rows(hno: pl.DataFrame) -> pl.DataFrame:
    """One row per (iso3, cluster) country-level PIN for cluster drilldowns.

    Filters to cluster != 'ALL' and category null; if subnational rows exist (2025), collapses
    to the national row (admin*_pcode all null).
    """
    return (
        hno.filter(
            (pl.col("cluster") != "ALL")
            & pl.col("cluster").is_not_null()
            & pl.col("category").is_null()
            & pl.col("admin1_pcode").is_null()
            & pl.col("admin2_pcode").is_null()
            & pl.col("admin3_pcode").is_null()
        )
        .group_by(["iso3", "cluster"])
        .agg(
            pl.col("pin").first().alias("pin_cluster"),
            pl.col("targeted").first().alias("targeted"),
        )
    )


def population_groups(hno: pl.DataFrame, iso3: str) -> pl.DataFrame:
    """PIN disaggregated by Category for a country (national row only).

    Returns columns: category, pin.
    """
    return (
        hno.filter(
            (pl.col("iso3") == iso3)
            & pl.col("category").is_not_null()
            & (pl.col("cluster") == "ALL")
            & pl.col("admin1_pcode").is_null()
            & pl.col("admin2_pcode").is_null()
            & pl.col("admin3_pcode").is_null()
        )
        .group_by("category")
        .agg(pl.col("pin").sum().alias("pin"))
        .filter(pl.col("pin").is_not_null() & (pl.col("pin") > 0))
        .sort("pin", descending=True)
    )
