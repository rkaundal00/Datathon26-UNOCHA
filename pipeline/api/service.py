"""Shared service helpers used across FastAPI routers.

Keeps request handlers thin — each handler composes these plus Pydantic validation.
"""
from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from pathlib import Path

import polars as pl

from pipeline import config as cfg
from pipeline.api.schemas import (
    BriefingNote,
    ClusterAggregateRow,
    ClusterRow,
    CountryRow,
    CustomWeights,
    FactSheet,
    HRPStatus,
    InCohortFlaggedRow,
    PopulationGroupRow,
    RankingMeta,
    SectorOption,
    SectorProjection,
    TrendInset2026,
    TrendSeries,
)
from pipeline.transform.sector_ranking import (
    SECTOR_CODES,
    available_sectors_meta,
    build_sector_projection_rows,
)
from pipeline.compute.composites import (
    chronic_norm,
    coverage_gap,
    custom_gap_score,
)
from pipeline.ingest.cbpf import country_total_usd
from pipeline.ingest.hno import load_hno, population_groups
from pipeline.transform.clusters import (
    cluster_drilldown_aggregate,
    cluster_drilldown_per_country,
)
from pipeline.transform.country_year import (
    build_country_year_table,
    build_excluded_table,
    in_cohort_fallback_table,
    in_cohort_flagged_table,
)
from pipeline.transform.trend import trend_series

MODE_DEFAULT_SORT: dict[str, tuple[str, str]] = {
    "acute": ("coverage_gap", "desc"),
    "structural": ("chronic_years", "desc"),
    "combined": ("gap_score", "desc"),
}

SORTABLE_COLUMNS = {
    "iso3",
    "country",
    "pin",
    "pin_share",
    "coverage_ratio",
    "coverage_gap",
    "unmet_need_usd",
    "gap_score",
    "custom_gap_score",
    "chronic_years",
    "donor_concentration",
    "hrp_status",
}


def parse_weights(raw: str | None) -> CustomWeights | None:
    """Parse a query string like 'coverage:0.3,pin:0.3,chronic:0.4' → CustomWeights."""
    if raw is None or raw == "":
        return None
    parts = {}
    for token in raw.split(","):
        if ":" not in token:
            raise ValueError(f"malformed weights token: {token!r}")
        k, v = token.split(":", 1)
        parts[k.strip()] = float(v.strip())
    return CustomWeights(
        w_coverage=parts.get("coverage", 0.0),
        w_pin=parts.get("pin", 0.0),
        w_chronic=parts.get("chronic", 0.0),
    )


def _datasets_freshness() -> str:
    """Max mtime across the Parquet files we read. ISO 8601 UTC."""
    files = [
        cfg.COD_ADMIN0,
        cfg.FTS_APPEALS,
        cfg.FTS_GLOBAL_CLUSTER,
        cfg.FTS_RAW_CLUSTER,
        cfg.FTS_INCOMING_2026,
        cfg.CBPF_TIMELINE,
        cfg.HNO_FILE[2024],
        cfg.HNO_FILE[2025],
        cfg.HNO_FILE[2026],
    ]
    mtime = max(os.path.getmtime(Path(p)) for p in files)
    return datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()


def make_meta(
    *,
    analysis_year: int,
    pin_floor: int,
    require_hrp: bool,
    mode: str,
    sort: str,
    sort_dir: str,
    weights: CustomWeights | None,
    total_count: int,
    excluded_count: int,
    sector: str | None = None,
) -> RankingMeta:
    options = [SectorOption(**opt) for opt in available_sectors_meta(analysis_year)]
    return RankingMeta(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        mode=mode,
        sort=sort,
        sort_dir=sort_dir,
        weights=weights,
        total_count=total_count,
        excluded_count=excluded_count,
        data_freshness=_datasets_freshness(),
        sector=sector,
        available_sectors=options,
    )


def _clean_number(x) -> float:
    """Replace NaN/inf with 0.0 for JSON safety."""
    try:
        if x is None:
            return 0.0
        f = float(x)
        if math.isnan(f) or math.isinf(f):
            return 0.0
        return f
    except (TypeError, ValueError):
        return 0.0


def _row_to_country(
    row: dict,
    weights: CustomWeights | None,
) -> CountryRow:
    """Convert a polars row-dict to a CountryRow Pydantic model.

    Adds custom_gap_score when weights are provided. Clips values for schema conformance:
    pin_share and gap_score are clamped to [0, 1] — coverage_ratio is left raw.
    """
    pin_share_raw = row.get("pin_share")
    pin_share = (
        max(0.0, min(1.0, _clean_number(pin_share_raw)))
        if pin_share_raw is not None
        else None
    )
    gap = max(0.0, min(1.0, _clean_number(row["gap_score"])))
    coverage = _clean_number(row["coverage_ratio"])
    chronic = int(row["chronic_years"] or 0)

    custom = None
    if weights is not None:
        # Fall back to severity-based need axis when pin_share is unavailable.
        need_axis = pin_share if pin_share is not None else (
            (row.get("inform_severity") or 0.0) / 10.0
        )
        custom = custom_gap_score(
            coverage_gap(coverage),
            need_axis,
            chronic_norm(chronic),
            w_coverage=weights.w_coverage,
            w_pin=weights.w_pin,
            w_chronic=weights.w_chronic,
        )
        custom = max(0.0, min(1.0, custom))

    donor_conc = row.get("donor_concentration")
    if donor_conc is not None and (math.isnan(donor_conc) if isinstance(donor_conc, float) else False):
        donor_conc = None

    pin_val = row.get("pin")
    pop_val = row.get("population")
    pop_ref_val = row.get("population_reference_year")
    hno_year_val = row.get("hno_year")

    return CountryRow(
        iso3=row["iso3"],
        country=row["country"] or row["iso3"],
        analysis_year=int(row["analysis_year"]),
        pin=int(pin_val) if pin_val is not None else None,
        population=int(pop_val) if pop_val is not None else None,
        population_reference_year=int(pop_ref_val) if pop_ref_val is not None else None,
        pin_share=pin_share,
        requirements_usd=int(row["requirements_usd"] or 0),
        funding_usd=int(row["funding_usd"] or 0),
        coverage_ratio=coverage,
        unmet_need_usd=int(row["unmet_need_usd"] or 0),
        gap_score=gap,
        custom_gap_score=custom,
        chronic_years=chronic,
        donor_concentration=donor_conc,
        hrp_status=row["hrp_status"],
        hno_year=int(hno_year_val) if hno_year_val is not None else None,
        qa_flags=list(row["qa_flags"]),
        inform_severity=float(row.get("inform_severity")) if row.get("inform_severity") is not None else None,
    )


def _sort_rows(
    rows: list[CountryRow],
    sort: str,
    sort_dir: str,
) -> list[CountryRow]:
    """Sort CountryRows by an arbitrary column name. Unknown columns fall back to gap_score desc.

    When a row carries a `sector` projection, metrics that have a cluster-level
    counterpart read from the projection so the table re-ranks under the sector lens.
    """
    reverse = sort_dir == "desc"

    def key_for(row: CountryRow):
        s = row.sector
        if sort == "coverage_gap":
            c = s.cluster_coverage_ratio if s else row.coverage_ratio
            return 1.0 - min(max(c, 0.0), 1.0)
        if sort == "coverage_ratio":
            return s.cluster_coverage_ratio if s else row.coverage_ratio
        if sort == "gap_score":
            return s.cluster_gap_score if s else row.gap_score
        if sort == "pin":
            return s.pin_cluster if s else row.pin
        if sort == "pin_share":
            return s.cluster_pin_share if s else row.pin_share
        if sort == "unmet_need_usd":
            return s.cluster_unmet_need_usd if s else row.unmet_need_usd
        if sort == "custom_gap_score":
            return row.custom_gap_score or 0.0
        if sort == "donor_concentration":
            return row.donor_concentration if row.donor_concentration is not None else -1.0
        if sort in SORTABLE_COLUMNS:
            return getattr(row, sort)
        return s.cluster_gap_score if s else row.gap_score

    return sorted(rows, key=key_for, reverse=reverse)


def build_ranking_rows(
    *,
    analysis_year: int,
    pin_floor: int,
    require_hrp: bool,
    weights: CustomWeights | None,
    sort: str,
    sort_dir: str,
    sector: str | None = None,
) -> tuple[list[CountryRow], int, int]:
    """Run the pipeline and return (sorted rows, total_count, excluded_count).

    If `sector` is set, each returned row carries a SectorProjection and rows that
    have no HNO PIN for the sector are dropped.
    """
    table = build_country_year_table(analysis_year, pin_floor, require_hrp)
    excluded = build_excluded_table(analysis_year, pin_floor, require_hrp)
    rows = [_row_to_country(r, weights) for r in table.to_dicts()]

    if sector:
        population_by_iso3 = {r.iso3: r.population for r in rows}
        projections = build_sector_projection_rows(
            analysis_year=analysis_year,
            sector_code=sector,
            cohort_iso3s=[r.iso3 for r in rows],
            population_by_iso3=population_by_iso3,
        )
        projected: list[CountryRow] = []
        for r in rows:
            p = projections.get(r.iso3)
            if p is None:
                continue
            r.sector = SectorProjection(**p)
            projected.append(r)
        rows = projected

    rows = _sort_rows(rows, sort, sort_dir)
    return rows, len(rows), len(excluded)


def filter_rows_by_flags(
    rows: list[CountryRow], flags: list[str] | None
) -> list[CountryRow]:
    if not flags:
        return rows
    wanted = set(flags)
    return [r for r in rows if wanted.intersection(r.qa_flags)]


def build_excluded_rows(
    *, analysis_year: int, pin_floor: int, require_hrp: bool
) -> list[dict]:
    table = build_excluded_table(analysis_year, pin_floor, require_hrp)
    return table.to_dicts()


def build_flagged_rows(
    *, analysis_year: int, pin_floor: int, require_hrp: bool
) -> list[InCohortFlaggedRow]:
    table = in_cohort_flagged_table(analysis_year, pin_floor, require_hrp)
    return [
        InCohortFlaggedRow(
            iso3=r["iso3"],
            country=r["country"],
            qa_flags=[f for f in r["qa_flags"] if f != "severity_unavailable"],
        )
        for r in table.to_dicts()
    ]


def build_fallback_rows(
    *, analysis_year: int, pin_floor: int, require_hrp: bool
) -> list[dict]:
    table = in_cohort_fallback_table(analysis_year, pin_floor, require_hrp)
    return table.to_dicts()


# ---------- country detail ----------


def _briefing_lead(country: CountryRow) -> str:
    """Template lead. Three sentences max, present tense, no numbers outside the template."""
    if country.pin is not None and country.pin_share is not None:
        pin_m = f"{country.pin / 1_000_000:.1f} million"
        pin_pct = f"{country.pin_share:.0%}"
        intro = (
            f"In {country.country}, {pin_m} people — {pin_pct} of the population — "
            f"require humanitarian assistance in {country.hno_year or country.analysis_year}."
        )
    elif country.pin is not None:
        pin_m = f"{country.pin / 1_000_000:.1f} million"
        intro = (
            f"In {country.country}, {pin_m} people require humanitarian assistance in "
            f"{country.hno_year or country.analysis_year}. Population baseline unavailable; "
            f"per-capita share is not computed."
        )
    else:
        sev = country.inform_severity
        sev_str = f"INFORM Severity {sev:.1f}/10" if sev is not None else "INFORM Severity"
        intro = (
            f"{country.country} has no published HNO for {country.analysis_year}; "
            f"need is approximated from {sev_str}."
        )
    if country.coverage_ratio < 0.30:
        funding = (
            f"Only {country.coverage_ratio:.0%} of the "
            f"${country.requirements_usd / 1_000_000_000:.1f}B appeal has been funded."
        )
    elif country.coverage_ratio < 0.60:
        funding = (
            f"{country.coverage_ratio:.0%} of the ${country.requirements_usd / 1_000_000_000:.1f}B "
            "appeal is currently covered."
        )
    else:
        funding = (
            f"The appeal is {country.coverage_ratio:.0%} funded against "
            f"${country.requirements_usd / 1_000_000_000:.1f}B in requirements."
        )
    if country.chronic_years >= 3:
        chronic = (
            f"Coverage has stayed below 50% for {country.chronic_years} consecutive years."
        )
    elif country.chronic_years > 0:
        chronic = (
            f"The response has fallen below 50% funded in each of the last "
            f"{country.chronic_years} year{'s' if country.chronic_years > 1 else ''}."
        )
    else:
        chronic = ""
    return f"{intro} {funding} {chronic}"


def _qualifiers(country: CountryRow) -> list[str]:
    out: list[str] = []
    if "hno_stale" in country.qa_flags:
        out.append(
            f"HNO data for {country.analysis_year} was unavailable; the "
            f"{country.hno_year} HNO is used instead."
        )
    if "funding_imputed_zero" in country.qa_flags:
        out.append(
            "Reported funding is zero while requirements are non-zero; the "
            "coverage ratio reflects an imputed zero, not a confirmed one."
        )
    if "population_stale" in country.qa_flags:
        out.append(
            f"Population denominator is from {country.population_reference_year} "
            f"(more than 2 years before {country.analysis_year})."
        )
    if "preliminary_hno" in country.qa_flags:
        out.append(
            "2026 HNO is preliminary and national-only; subnational breakdowns are not yet published."
        )
    if "cluster_taxonomy_mismatch" in country.qa_flags:
        out.append(
            "At least one cluster-level row resolves only in the raw FTS taxonomy; the "
            "harmonized globalCluster match was unavailable."
        )
    if "donor_conc_2026_only" in country.qa_flags:
        out.append(
            "Donor concentration (HHI) is computed from 2026 transaction-level data only — "
            "pre-2026 transactions do not split donors."
        )
    return out


def _grounding() -> list[str]:
    return [
        "UNOCHA Humanitarian Programme Cycle — HNO needs data",
        "OCHA Financial Tracking Service (FTS) — requirements & funding",
        "UNOCHA CBPF — pooled-fund allocations",
        "UNFPA COD-PS — population baselines",
    ]


def build_country_detail(
    iso3: str,
    *,
    analysis_year: int,
    pin_floor: int,
    require_hrp: bool,
    weights: CustomWeights | None,
    mode: str,
    sort: str,
    sort_dir: str,
) -> dict:
    """Return a fully-populated CountryDetailResponse payload as a plain dict."""
    rows, total, excluded = build_ranking_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        weights=weights,
        sort=sort,
        sort_dir=sort_dir,
    )
    match = next((r for r in rows if r.iso3 == iso3), None)
    if match is None:
        return {}

    clusters_df = cluster_drilldown_per_country(iso3, analysis_year)
    clusters = [
        ClusterRow(
            cluster_name=r["cluster_name"],
            pin_cluster=int(r["pin_cluster"] or 0),
            requirements_usd=int(r["requirements_usd"] or 0),
            funding_usd=int(r["funding_usd"] or 0),
            coverage_ratio=_clean_number(r["coverage_ratio"]),
            unmet_need_usd=int(r["unmet_need_usd"] or 0),
            coverage_flag=r["coverage_flag"],
            qa_flags=list(r["qa_flags"]),
        )
        for r in clusters_df.to_dicts()
    ]

    hno = load_hno(analysis_year)
    pop_groups = [
        PopulationGroupRow(category=r["category"], pin=int(r["pin"] or 0))
        for r in population_groups(hno, iso3).to_dicts()
    ]

    trend_dict = trend_series(iso3)
    trend = TrendSeries(
        years=trend_dict["years"],
        requirements_usd=trend_dict["requirements_usd"],
        funding_usd=trend_dict["funding_usd"],
        chronic_markers=trend_dict["chronic_markers"],
        inset_2026=TrendInset2026(**trend_dict["inset_2026"])
        if trend_dict["inset_2026"]
        else None,
    )

    fact = FactSheet(
        pin=match.pin,
        pin_share=match.pin_share,
        requirements_usd=match.requirements_usd,
        funding_usd=match.funding_usd,
        coverage_ratio=match.coverage_ratio,
        unmet_need_usd=match.unmet_need_usd,
        chronic_years=match.chronic_years,
        donor_concentration=match.donor_concentration,
        hrp_status=match.hrp_status,
        hno_year=match.hno_year,
        inform_severity=match.inform_severity,
        cbpf_allocations_total_usd=(
            int(country_total_usd(iso3)) if country_total_usd(iso3) is not None else None
        ),
    )
    briefing = BriefingNote(
        lead=_briefing_lead(match),
        lead_source="template",
        fact_sheet=fact,
        qualifiers=_qualifiers(match),
        grounding=_grounding(),
    )

    meta = make_meta(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        mode=mode,
        sort=sort,
        sort_dir=sort_dir,
        weights=weights,
        total_count=total,
        excluded_count=excluded,
    )
    return {
        "meta": meta,
        "country": match,
        "clusters": clusters,
        "population_groups": pop_groups,
        "trend": trend,
        "briefing": briefing,
    }


def build_cluster_response(
    *,
    analysis_year: int,
    pin_floor: int,
    require_hrp: bool,
    iso3: str | None,
    mode: str,
    sort: str,
    sort_dir: str,
    weights: CustomWeights | None,
) -> dict:
    rows, total, excluded = build_ranking_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        weights=weights,
        sort=sort,
        sort_dir=sort_dir,
    )
    meta = make_meta(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        mode=mode,
        sort=sort,
        sort_dir=sort_dir,
        weights=weights,
        total_count=total,
        excluded_count=excluded,
    )
    if iso3:
        df = cluster_drilldown_per_country(iso3, analysis_year)
        cluster_rows = [
            ClusterAggregateRow(
                cluster_name=r["cluster_name"],
                pin_cluster=int(r["pin_cluster"] or 0),
                requirements_usd=int(r["requirements_usd"] or 0),
                funding_usd=int(r["funding_usd"] or 0),
                coverage_ratio=_clean_number(r["coverage_ratio"]),
                unmet_need_usd=int(r["unmet_need_usd"] or 0),
                coverage_flag=r["coverage_flag"],
                qa_flags=list(r["qa_flags"]),
                countries_count=1,
            )
            for r in df.to_dicts()
        ]
        return {"meta": meta, "scope": "country", "iso3": iso3, "rows": cluster_rows}

    iso3s = [r.iso3 for r in rows]
    df = cluster_drilldown_aggregate(analysis_year, iso3s)
    cluster_rows = [
        ClusterAggregateRow(
            cluster_name=r["cluster_name"],
            pin_cluster=int(r["pin_cluster"] or 0),
            requirements_usd=int(r["requirements_usd"] or 0),
            funding_usd=int(r["funding_usd"] or 0),
            coverage_ratio=_clean_number(r["coverage_ratio"]),
            unmet_need_usd=int(r["unmet_need_usd"] or 0),
            coverage_flag=r["coverage_flag"],
            qa_flags=[],
            countries_count=int(r["countries_count"] or 0),
        )
        for r in df.to_dicts()
    ]
    return {"meta": meta, "scope": "cohort", "iso3": None, "rows": cluster_rows}


def rows_to_csv(rows: list[CountryRow]) -> str:
    """Serialize CountryRows to CSV with semicolon-joined qa_flags."""
    import csv
    import io

    fields = list(CountryRow.model_fields.keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        d = row.model_dump()
        d["qa_flags"] = ";".join(d["qa_flags"])
        writer.writerow(d)
    return buf.getvalue()
