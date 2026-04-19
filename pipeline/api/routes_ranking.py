"""GET /api/ranking — full cohort table with sort + custom-weight support."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from pipeline.api.schemas import RankingResponse
from pipeline.api.service import (
    MODE_DEFAULT_SORT,
    SORTABLE_COLUMNS,
    build_fallback_rows,
    build_ranking_rows,
    filter_rows_by_flags,
    make_meta,
    parse_weights,
)
from pipeline.transform.sector_ranking import SECTOR_CODES

router = APIRouter()


@router.get("/ranking", response_model=RankingResponse)
def get_ranking(
    analysis_year: int = Query(2025, ge=2024, le=2026),
    pin_floor: int = Query(1_000_000, ge=0),
    require_hrp: bool = Query(True),
    mode: Literal["acute", "structural", "combined"] = Query("combined"),
    sort: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    weights: str | None = Query(None),
    flags: str | None = Query(None, description="CSV of QAFlag values to filter by"),
    sector: str | None = Query(
        None, description="HNO umbrella sector code (e.g. FSC, HEA); see SECTOR_CATALOG."
    ),
) -> RankingResponse:
    if sector is not None:
        sector = sector.strip().upper() or None
    if sector is not None and sector not in SECTOR_CODES:
        raise HTTPException(status_code=400, detail=f"unknown sector {sector!r}")
    if sector is not None and mode == "structural":
        # Cluster-level multi-year chronic signals are unsupported — defend the API
        # even though the frontend disables this combination.
        mode = "acute"

    # Mode preset vs explicit sort — explicit wins per base spec §6.
    default_sort, default_dir = MODE_DEFAULT_SORT[mode]
    effective_sort = sort or default_sort
    effective_dir = sort_dir or default_dir

    if effective_sort not in SORTABLE_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"unknown sort column {effective_sort!r}",
        )

    try:
        parsed_weights = parse_weights(weights)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    rows, total, excluded = build_ranking_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        weights=parsed_weights,
        sort=effective_sort,
        sort_dir=effective_dir,
        sector=sector,
    )
    if flags:
        rows = filter_rows_by_flags(rows, [f.strip() for f in flags.split(",") if f.strip()])

    fallback_count = len(build_fallback_rows(
        analysis_year=analysis_year, pin_floor=pin_floor, require_hrp=require_hrp,
    ))

    meta = make_meta(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        mode=mode,
        sort=effective_sort,
        sort_dir=effective_dir,
        weights=parsed_weights,
        total_count=total,
        excluded_count=excluded,
        fallback_count=fallback_count,
        sector=sector,
    )
    return RankingResponse(meta=meta, rows=rows)
