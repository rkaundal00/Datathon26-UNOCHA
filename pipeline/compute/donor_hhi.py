"""Herfindahl-Hirschman Index of donor concentration — 2026-only per spec §0.7."""
from __future__ import annotations

import polars as pl


def donor_concentration(
    iso3: str,
    year: int,
    incoming: pl.DataFrame,
) -> float | None:
    """HHI over donor shares for (iso3, year).

    Returns None if year != 2026 (no transaction-level data pre-2026) or iso3 has no contributions.
    Includes all statuses in {'pledge', 'paid', 'commitment'} — the metric captures who
    is committing, not who has paid (display labels call this out).
    """
    if year != 2026:
        return None
    sub = incoming.filter(pl.col("iso3") == iso3)
    if sub.is_empty():
        return None
    by_donor = (
        sub.group_by("src_organization")
        .agg(pl.col("amount_usd").fill_null(0).sum().alias("amount_usd"))
        .filter(pl.col("amount_usd") > 0)
    )
    total = int(by_donor["amount_usd"].sum())
    if total <= 0:
        return None
    shares = (by_donor["amount_usd"] / total).to_list()
    return float(sum(s * s for s in shares))


def donor_concentration_table(incoming: pl.DataFrame) -> pl.DataFrame:
    """All iso3s → donor_concentration (HHI). Operates in a single pass; returns (iso3, hhi)."""
    if incoming.is_empty():
        return pl.DataFrame(
            {"iso3": [], "donor_concentration": []},
            schema={"iso3": pl.Utf8, "donor_concentration": pl.Float64},
        )
    by_iso_donor = (
        incoming.group_by(["iso3", "src_organization"])
        .agg(pl.col("amount_usd").fill_null(0).sum().alias("donor_usd"))
        .filter(pl.col("donor_usd") > 0)
    )
    totals = by_iso_donor.group_by("iso3").agg(
        pl.col("donor_usd").sum().alias("total_usd")
    )
    joined = by_iso_donor.join(totals, on="iso3", how="inner")
    joined = joined.with_columns(
        (pl.col("donor_usd") / pl.col("total_usd")).alias("share")
    ).with_columns((pl.col("share") * pl.col("share")).alias("share_sq"))
    return (
        joined.group_by("iso3")
        .agg(pl.col("share_sq").sum().alias("donor_concentration"))
        .sort("iso3")
    )
