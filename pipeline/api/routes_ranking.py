"""GET /api/ranking — full cohort table with sort + custom-weight support."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from pipeline.api.schemas import RankingResponse
from pipeline.api.service import (
    MODE_DEFAULT_SORT,
    SORTABLE_COLUMNS,
    build_ranking_rows,
    filter_rows_by_flags,
    make_meta,
    parse_weights,
)

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
) -> RankingResponse:
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
    )
    if flags:
        rows = filter_rows_by_flags(rows, [f.strip() for f in flags.split(",") if f.strip()])

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
    )
    return RankingResponse(meta=meta, rows=rows)
