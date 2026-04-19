"""GET /api/coverage — data coverage panel: excluded + in-cohort flagged rows."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from pipeline.api.schemas import CoverageResponse, ExcludedCountryRow, InCohortFallbackRow
from pipeline.api.service import (
    MODE_DEFAULT_SORT,
    SORTABLE_COLUMNS,
    build_excluded_rows,
    build_fallback_rows,
    build_flagged_rows,
    build_ranking_rows,
    make_meta,
    parse_weights,
)

router = APIRouter()


@router.get("/coverage", response_model=CoverageResponse)
def get_coverage(
    analysis_year: int = Query(2025, ge=2024, le=2026),
    pin_floor: int = Query(1_000_000, ge=0),
    require_hrp: bool = Query(True),
    mode: Literal["acute", "structural", "combined"] = Query("combined"),
    sort: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    weights: str | None = Query(None),
) -> CoverageResponse:
    default_sort, default_dir = MODE_DEFAULT_SORT[mode]
    effective_sort = sort or default_sort
    effective_dir = sort_dir or default_dir
    if effective_sort not in SORTABLE_COLUMNS:
        raise HTTPException(
            status_code=400, detail=f"unknown sort column {effective_sort!r}"
        )
    try:
        parsed_weights = parse_weights(weights)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    rows, total, excluded_count = build_ranking_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        weights=parsed_weights,
        sort=effective_sort,
        sort_dir=effective_dir,
    )
    excluded_raw = build_excluded_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
    )
    flagged = build_flagged_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
    )
    fallback_raw = build_fallback_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
    )
    fallback = [
        InCohortFallbackRow(
            iso3=r["iso3"],
            country=r["country"],
            qa_flags=list(r["qa_flags"]),
            requirements_usd=int(r.get("requirements_usd") or 0),
            funding_usd=int(r.get("funding_usd") or 0),
            coverage_ratio=r.get("coverage_ratio"),
            unmet_need_usd=int(r.get("unmet_need_usd") or 0),
            inform_severity=r.get("inform_severity"),
        )
        for r in fallback_raw
    ]
    excluded = [
        ExcludedCountryRow(
            iso3=r["iso3"],
            country=r["country"] or r["iso3"],
            pin=r.get("pin"),
            requirements_usd=r.get("requirements_usd"),
            funding_usd=r.get("funding_usd"),
            coverage_ratio=r.get("coverage_ratio"),
            exclusion_reason=r["exclusion_reason"],
            detail=r["detail"],
        )
        for r in excluded_raw
    ]
    meta = make_meta(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        mode=mode,
        sort=effective_sort,
        sort_dir=effective_dir,
        weights=parsed_weights,
        total_count=total,
        excluded_count=excluded_count,
        fallback_count=len(fallback),
    )
    return CoverageResponse(
        meta=meta,
        excluded=excluded,
        in_cohort_flagged=flagged,
        in_cohort_fallback=fallback,
    )
