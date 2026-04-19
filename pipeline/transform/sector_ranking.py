"""Sector-lens ranking — project country rows into cluster-level metrics.

When a sector (HNO cluster code) is active, each country's rank is driven by the
cluster-specific version of the country gap formula:

    cluster_gap_score = (1 − min(cluster_coverage_ratio, 1)) × cluster_pin_share

with cluster_coverage_ratio = cluster_funding_usd / cluster_requirements_usd
and cluster_pin_share = pin_cluster / population (mirrors country pin_share).
"""
from __future__ import annotations

from functools import lru_cache

import polars as pl

from pipeline.compute.composites import gap_score
from pipeline.ingest.fts import load_cluster
from pipeline.ingest.hno import cluster_pin_rows, load_hno
from pipeline.transform.clusters import HNO_CLUSTER_TO_NAME

# Umbrella sectors surfaced in the UI chip. PRO-* sub-clusters are intentionally
# omitted — see docs plan decision #6. AGR/ETC are year-gated at availability time.
SECTOR_CATALOG: list[tuple[str, str]] = [
    ("FSC", "Food Security"),
    ("HEA", "Health"),
    ("NUT", "Nutrition"),
    ("PRO", "Protection"),
    ("WSH", "Water Sanitation Hygiene"),
    ("EDU", "Education"),
    ("SHL", "Emergency Shelter and NFI"),
    ("MPC", "Multipurpose Cash"),
    ("CCM", "Camp Coordination / Management"),
    ("ERY", "Early Recovery"),
    ("LOG", "Logistics"),
    ("CSS", "Coordination and support services"),
    ("MS", "Multi-sector"),
    ("AGR", "Agriculture"),
    ("ETC", "Emergency Telecommunications"),
]

SECTOR_CODES: set[str] = {code for code, _ in SECTOR_CATALOG}
SECTOR_NAME: dict[str, str] = dict(SECTOR_CATALOG)


@lru_cache(maxsize=8)
def compute_sector_availability(analysis_year: int) -> dict[str, bool]:
    """Return {sector_code: bool} — sector is available if any country has PIN>0 for it."""
    df = cluster_pin_rows(load_hno(analysis_year))
    # hno_clusters: raw HNO short codes ("FSC", "PRO", "PRO-GBV" …). We collapse
    # PRO-* into PRO for availability — see decision #6.
    collapsed = df.with_columns(
        pl.when(pl.col("cluster").str.starts_with("PRO"))
        .then(pl.lit("PRO"))
        # ETE is a 2025 alias for ETC.
        .when(pl.col("cluster") == "ETE")
        .then(pl.lit("ETC"))
        .otherwise(pl.col("cluster"))
        .alias("sector_code")
    )
    present = set(
        collapsed.filter(pl.col("pin_cluster").fill_null(0) > 0)
        .select("sector_code")
        .unique()
        .to_series()
        .to_list()
    )
    return {code: (code in present) for code, _ in SECTOR_CATALOG}


def available_sectors_meta(analysis_year: int) -> list[dict]:
    avail = compute_sector_availability(analysis_year)
    return [
        {"code": code, "name": name, "available": avail.get(code, False)}
        for code, name in SECTOR_CATALOG
    ]


def _hno_sector_pin(analysis_year: int, sector_code: str) -> pl.DataFrame:
    """One row per iso3 with pin_cluster aggregated for the umbrella sector.

    PRO umbrella sums PRO only (the country-level PRO row) — NOT the PRO-* sub-clusters,
    since those are already carved out of the PRO total in HNO per CLAUDE.md's
    "HNO rows overlap" rule. Summing would double-count.
    ETE rows are treated as ETC.
    """
    df = cluster_pin_rows(load_hno(analysis_year))
    if sector_code == "ETC":
        match = df.filter(pl.col("cluster").is_in(["ETC", "ETE"]))
    else:
        match = df.filter(pl.col("cluster") == sector_code)
    return match.group_by("iso3").agg(
        pl.col("pin_cluster").fill_null(0).sum().alias("pin_cluster")
    )


def _fts_sector_money(analysis_year: int, sector_code: str) -> pl.DataFrame:
    """One row per iso3 with requirements_usd + funding_usd for the umbrella cluster.

    Uses the harmonized globalCluster taxonomy; falls back to the raw cluster file
    only when harmonized has no rows at all for the year (cheap + rare).
    """
    cluster_name = HNO_CLUSTER_TO_NAME.get(sector_code, sector_code)
    harmonized = load_cluster(harmonized=True).filter(pl.col("year") == analysis_year)
    if harmonized.is_empty():
        harmonized = load_cluster(harmonized=False).filter(pl.col("year") == analysis_year)
    matched = harmonized.filter(pl.col("cluster_name") == cluster_name)
    return matched.group_by("iso3").agg(
        pl.col("requirements_usd").fill_null(0).sum().alias("cluster_requirements_usd"),
        pl.col("funding_usd").fill_null(0).sum().alias("cluster_funding_usd"),
    )


def build_sector_projection_rows(
    analysis_year: int,
    sector_code: str,
    cohort_iso3s: list[str],
    population_by_iso3: dict[str, int],
) -> dict[str, dict]:
    """Return {iso3: sector_projection_dict} for cohort countries with HNO PIN in the sector.

    Countries with no HNO PIN for the sector are not in the output — they drop from
    the sector view entirely. Countries with HNO PIN but no FTS rows get
    funding=0, coverage=0, and a `cluster_funding_missing` QA flag.
    """
    name = SECTOR_NAME.get(sector_code, sector_code)
    hno = _hno_sector_pin(analysis_year, sector_code).filter(
        pl.col("iso3").is_in(cohort_iso3s) & (pl.col("pin_cluster") > 0)
    )
    fts = _fts_sector_money(analysis_year, sector_code)
    joined = hno.join(fts, on="iso3", how="left").with_columns(
        pl.col("cluster_requirements_usd").fill_null(0).cast(pl.Int64),
        pl.col("cluster_funding_usd").fill_null(0).cast(pl.Int64),
    )

    out: dict[str, dict] = {}
    for row in joined.to_dicts():
        iso3 = row["iso3"]
        pin_c = int(row["pin_cluster"] or 0)
        pop = int(population_by_iso3.get(iso3, 0) or 0)
        req = int(row["cluster_requirements_usd"] or 0)
        fun = int(row["cluster_funding_usd"] or 0)

        coverage = (fun / req) if req > 0 else 0.0
        unmet = max(0, req - fun)
        pin_share = max(0.0, min(1.0, (pin_c / pop) if pop > 0 else 0.0))
        score = gap_score(coverage, pin_share, pin_c)

        flags: list[str] = []
        if req == 0 and fun == 0:
            flags.append("cluster_funding_missing")

        out[iso3] = {
            "code": sector_code,
            "name": name,
            "pin_cluster": pin_c,
            "cluster_pin_share": pin_share,
            "cluster_requirements_usd": req,
            "cluster_funding_usd": fun,
            "cluster_coverage_ratio": coverage,
            "cluster_unmet_need_usd": unmet,
            "cluster_gap_score": score,
            "qa_flags": flags,
        }
    return out
