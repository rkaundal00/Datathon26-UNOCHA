"""chronic_years — strict consecutive count of prior underfunded years, capped at 5."""
from __future__ import annotations

import polars as pl

from pipeline.config import CHRONIC_COVERAGE_THRESHOLD, CHRONIC_MAX_YEARS


def chronic_years(
    iso3: str,
    analysis_year: int,
    history: pl.DataFrame,
) -> int:
    """Count consecutive prior years (from analysis_year - 1 backwards) where coverage < 0.5,
    starting from the 3rd consecutive underfunded year.

    Chain breaks on:
      - coverage_ratio >= 0.5 in year k
      - no FTS appeal record in year k (missing data is NOT evidence of underfunding)

    `history` must have columns: iso3, year, requirements_usd, funding_usd.
    Returns 0 if fewer than 3 consecutive underfunded years; capped at CHRONIC_MAX_YEARS.
    """
    sub = (
        history.filter(pl.col("iso3") == iso3)
        .group_by("year")
        .agg(
            pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
            pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        )
    )
    by_year = {int(r["year"]): r for r in sub.to_dicts()}

    underfunded_count = 0
    count = 0
    for k in range(analysis_year - 1, analysis_year - 1 - CHRONIC_MAX_YEARS, -1):
        row = by_year.get(k)
        if row is None or (row["requirements_usd"] or 0) <= 0:
            break
        cov = (row["funding_usd"] or 0) / (row["requirements_usd"] or 1)
        if cov >= CHRONIC_COVERAGE_THRESHOLD:
            break
        underfunded_count += 1
        if underfunded_count > 2:
            count += 1
    return count


def chronic_markers(
    iso3: str,
    history: pl.DataFrame,
    years: list[int],
) -> list[bool]:
    """For each year in `years`, True if it's the 3rd or later consecutive underfunded year.

    Used in the trend chart to mark chronic-contributing years on the X-axis.
    """
    sub = (
        history.filter(pl.col("iso3") == iso3)
        .group_by("year")
        .agg(
            pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
            pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        )
    )
    by_year = {int(r["year"]): r for r in sub.to_dicts()}

    # For each year in input, count how many consecutive underfunded years lead up to it (backward)
    out = []
    for y in years:
        # Count consecutive underfunded years backward from this year
        underfunded_count = 0
        for k in range(y, y - 6, -1):  # Look back up to 5 years
            row = by_year.get(k)
            if row is None or (row["requirements_usd"] or 0) <= 0:
                break
            cov = (row["funding_usd"] or 0) / (row["requirements_usd"] or 1)
            if cov >= CHRONIC_COVERAGE_THRESHOLD:
                break
            underfunded_count += 1

        # Mark True if this year is 3rd+ in its consecutive chain
        out.append(underfunded_count > 2)

    return out
