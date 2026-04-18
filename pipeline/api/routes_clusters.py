"""GET /api/clusters — cohort-wide or per-country cluster drilldown."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from pipeline.api.schemas import ClusterDrilldownResponse
from pipeline.api.service import (
    MODE_DEFAULT_SORT,
    SORTABLE_COLUMNS,
    build_cluster_response,
    parse_weights,
)

router = APIRouter()


@router.get("/clusters", response_model=ClusterDrilldownResponse)
def get_clusters(
    analysis_year: int = Query(2025, ge=2024, le=2026),
    pin_floor: int = Query(1_000_000, ge=0),
    require_hrp: bool = Query(True),
    mode: Literal["acute", "structural", "combined"] = Query("combined"),
    sort: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    iso3: str | None = Query(None),
    weights: str | None = Query(None),
) -> ClusterDrilldownResponse:
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

    payload = build_cluster_response(
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        iso3=iso3.upper() if iso3 else None,
        mode=mode,
        sort=effective_sort,
        sort_dir=effective_dir,
        weights=parsed_weights,
    )
    return ClusterDrilldownResponse(**payload)
