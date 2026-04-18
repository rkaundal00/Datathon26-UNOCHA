"""GET /api/export.csv — current filtered+sorted view as CSV."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from pipeline.api.service import (
    MODE_DEFAULT_SORT,
    SORTABLE_COLUMNS,
    build_ranking_rows,
    filter_rows_by_flags,
    parse_weights,
    rows_to_csv,
)

router = APIRouter()


@router.get("/export.csv")
def export_csv(
    analysis_year: int = Query(2025, ge=2024, le=2026),
    pin_floor: int = Query(1_000_000, ge=0),
    require_hrp: bool = Query(True),
    mode: Literal["acute", "structural", "combined"] = Query("combined"),
    sort: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    weights: str | None = Query(None),
    flags: str | None = Query(None),
) -> Response:
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

    rows, _, _ = build_ranking_rows(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        weights=parsed_weights,
        sort=effective_sort,
        sort_dir=effective_dir,
    )
    if flags:
        rows = filter_rows_by_flags(
            rows, [f.strip() for f in flags.split(",") if f.strip()]
        )
    csv = rows_to_csv(rows)
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    filename = f"geo-insight_{analysis_year}_{stamp}.csv"
    return Response(
        content=csv,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
