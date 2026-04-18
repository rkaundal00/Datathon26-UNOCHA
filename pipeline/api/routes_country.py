"""GET /api/country/{iso3} — country detail: row + clusters + trend + briefing."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from pipeline.api.schemas import CountryDetailResponse
from pipeline.api.service import (
    MODE_DEFAULT_SORT,
    SORTABLE_COLUMNS,
    build_country_detail,
    parse_weights,
)

router = APIRouter()


@router.get("/country/{iso3}", response_model=CountryDetailResponse)
def get_country(
    iso3: str,
    analysis_year: int = Query(2025, ge=2024, le=2026),
    pin_floor: int = Query(1_000_000, ge=0),
    require_hrp: bool = Query(True),
    mode: Literal["acute", "structural", "combined"] = Query("combined"),
    sort: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    weights: str | None = Query(None),
) -> CountryDetailResponse:
    iso3 = iso3.upper()
    if len(iso3) != 3:
        raise HTTPException(status_code=400, detail="iso3 must be 3 characters")

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

    payload = build_country_detail(
        iso3,
        analysis_year=analysis_year,
        pin_floor=pin_floor,
        require_hrp=require_hrp,
        weights=parsed_weights,
        mode=mode,
        sort=effective_sort,
        sort_dir=effective_dir,
    )
    if not payload:
        raise HTTPException(
            status_code=404,
            detail=f"{iso3} is not in the current cohort; check the Data coverage panel.",
        )
    return CountryDetailResponse(**payload)
