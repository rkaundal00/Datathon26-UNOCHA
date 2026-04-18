"""Multi-year trend series per country — two-curve historical + 2026 pledged/paid inset."""
from __future__ import annotations

import polars as pl

from pipeline.compute.chronic import chronic_markers
from pipeline.ingest.fts import load_appeals, load_incoming_2026

START_YEAR = 1999
END_YEAR = 2026


def trend_series(iso3: str) -> dict:
    """Return the full trend payload for a country.

    Shape per spec-data-pipeline §4.3:
      {
        "years": [...],
        "requirements_usd": [int|None, ...],
        "funding_usd": [int|None, ...],
        "chronic_markers": [bool, ...],
        "inset_2026": {paid_usd, pledged_usd, commitment_usd, unmet_usd} | None
      }
    """
    appeals = load_appeals().filter(pl.col("iso3") == iso3)
    agg = (
        appeals.group_by("year")
        .agg(
            pl.col("requirements_usd").fill_null(0).sum().alias("requirements_usd"),
            pl.col("funding_usd").fill_null(0).sum().alias("funding_usd"),
        )
    )
    by_year = {int(r["year"]): r for r in agg.to_dicts()}

    years = list(range(START_YEAR, END_YEAR + 1))
    requirements: list[int | None] = []
    funding: list[int | None] = []
    for y in years:
        row = by_year.get(y)
        if row is None or (row["requirements_usd"] or 0) == 0 and (row["funding_usd"] or 0) == 0:
            requirements.append(None)
            funding.append(None)
        else:
            requirements.append(int(row["requirements_usd"] or 0))
            funding.append(int(row["funding_usd"] or 0))

    markers = chronic_markers(iso3, appeals, years)

    inset = _inset_2026(iso3, appeals)
    return {
        "years": years,
        "requirements_usd": requirements,
        "funding_usd": funding,
        "chronic_markers": markers,
        "inset_2026": inset,
    }


def _inset_2026(iso3: str, appeals: pl.DataFrame) -> dict | None:
    incoming = load_incoming_2026().filter(pl.col("iso3") == iso3)
    if incoming.is_empty():
        return None
    by_status = (
        incoming.group_by("status")
        .agg(pl.col("amount_usd").fill_null(0).sum().alias("amount_usd"))
    )
    totals = {r["status"]: int(r["amount_usd"]) for r in by_status.to_dicts()}
    paid = totals.get("paid", 0)
    pledged = totals.get("pledge", 0)
    commitment = totals.get("commitment", 0)

    reqs_2026 = appeals.filter(pl.col("year") == 2026)
    reqs_total = int((reqs_2026["requirements_usd"].fill_null(0).sum()) or 0)
    unmet = max(0, reqs_total - (paid + pledged + commitment))
    return {
        "paid_usd": paid,
        "pledged_usd": pledged,
        "commitment_usd": commitment,
        "unmet_usd": unmet,
    }
