"""CBPF pooled-fund allocations — read-only validation context, keyed by country name."""
from __future__ import annotations

import polars as pl

from pipeline.config import CBPF_COUNTRY_MAP, CBPF_TIMELINE


def load_country_map() -> pl.DataFrame:
    """Country-name → ISO3 lookup. Unknown names are logged (as warning) and filtered out."""
    return pl.read_csv(CBPF_COUNTRY_MAP).rename(
        {"cbpf_name": "CBPF", "iso3": "iso3"}
    )


def load_allocations_timeline() -> pl.DataFrame:
    """Return CBPF allocations mapped to iso3.

    Columns:
        iso3: str
        fund_id: str | None
        allocation_title: str
        allocation_summary: str | None
        total_usd: Float64
        start_date: str
        end_date: str
    """
    df = pl.read_parquet(CBPF_TIMELINE)
    country_map = load_country_map()
    joined = df.join(country_map, on="CBPF", how="inner")
    return joined.select(
        pl.col("iso3"),
        pl.col("fundId").cast(pl.Utf8, strict=False).alias("fund_id"),
        pl.col("Allocation Title").alias("allocation_title"),
        pl.col("Allocation Summary").alias("allocation_summary"),
        pl.col("Total").alias("total_usd"),
        pl.col("Start Date").alias("start_date"),
        pl.col("End Date").alias("end_date"),
    )


def country_total_usd(iso3: str) -> float | None:
    """Historical sum of CBPF allocations for an iso3. Used in briefing-note fact sheet."""
    df = load_allocations_timeline()
    sub = df.filter(pl.col("iso3") == iso3)
    if sub.is_empty():
        return None
    return float(sub["total_usd"].fill_null(0).sum())
