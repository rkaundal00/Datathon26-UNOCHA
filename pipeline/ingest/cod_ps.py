"""COD-PS admin0 loader — population baseline (total, all ages, all genders)."""
from __future__ import annotations

import polars as pl

from pipeline.config import COD_ADMIN0


def load_admin0() -> pl.DataFrame:
    """Return one row per (iso3, reference_year) for total population.

    Columns:
        iso3: str
        population: Int64
        reference_year: Int64
    """
    df = pl.read_parquet(COD_ADMIN0)
    return (
        df.filter(pl.col("Population_group") == "T_TL")
        .select(
            pl.col("ISO3").alias("iso3"),
            pl.col("Population").cast(pl.Int64).alias("population"),
            pl.col("Reference_year").cast(pl.Int64).alias("reference_year"),
        )
        .unique(subset=["iso3", "reference_year"])
        .sort(["iso3", "reference_year"])
    )


def country_names() -> pl.DataFrame:
    """Return (iso3, country) — canonical display name from COD-PS."""
    df = pl.read_parquet(COD_ADMIN0)
    return (
        df.select(
            pl.col("ISO3").alias("iso3"),
            pl.col("Country").alias("country"),
        )
        .unique(subset=["iso3"])
        .sort("iso3")
    )


def resolve_population(
    admin0: pl.DataFrame, iso3: str, analysis_year: int
) -> tuple[int | None, int | None]:
    """Return (population, reference_year) for the nearest ref year ≤ analysis_year.

    Returns (None, None) if no row with reference_year ≤ analysis_year exists.
    """
    sub = admin0.filter(
        (pl.col("iso3") == iso3) & (pl.col("reference_year") <= analysis_year)
    )
    if sub.is_empty():
        return (None, None)
    row = sub.sort("reference_year", descending=True).head(1).row(0, named=True)
    return (int(row["population"]), int(row["reference_year"]))
