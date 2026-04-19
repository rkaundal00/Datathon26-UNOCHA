"""Frozen Pydantic schemas — the interface contract between backend and frontend.

Any schema change requires re-review of spec-frontend.md and spec-evaluation.md.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

# ---------- enums ----------

HRPStatus = Literal["HRP", "FlashAppeal", "RegionalRP", "Other", "Unknown", "None"]
Mode = Literal["acute", "structural", "combined"]
QAFlag = Literal[
    "funding_imputed_zero",
    "hno_stale",
    "population_stale",
    "donor_conc_2026_only",
    "cluster_taxonomy_mismatch",
    "severity_unavailable",
    "preliminary_hno",
    "hrp_status_unknown",
    "cluster_funding_missing",
    "fts_year_fallback",
    "need_proxy_inform",
    "population_unavailable",
]
ExclusionReason = Literal[
    "no_active_hrp",
    "stale_hno",
    "no_fts_appeal_record",
    "no_population_baseline",
]
SortDir = Literal["asc", "desc"]
DetailTab = Literal["clusters", "trend", "population"]

# ---------- core rows ----------


class SectorProjection(BaseModel):
    code: str
    name: str
    pin_cluster: int
    cluster_pin_share: float = Field(..., ge=0.0, le=1.0)
    cluster_requirements_usd: int
    cluster_funding_usd: int
    cluster_coverage_ratio: float  # raw, uncapped
    cluster_unmet_need_usd: int
    cluster_gap_score: float = Field(..., ge=0.0)
    qa_flags: list[QAFlag]


class CountryRow(BaseModel):
    iso3: str = Field(..., min_length=3, max_length=3)
    country: str
    analysis_year: int
    pin: int | None = None
    population: int | None = None
    population_reference_year: int | None = None
    pin_share: float | None = Field(default=None, ge=0.0, le=1.0)
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float  # raw, uncapped
    unmet_need_usd: int
    gap_score: float = Field(..., ge=0.0)
    custom_gap_score: float | None = None
    chronic_years: int
    inform_severity: float | None = Field(..., ge=0, le=10)
    donor_concentration: float | None = None
    hrp_status: HRPStatus
    hno_year: int | None = None
    qa_flags: list[QAFlag]
    sector: SectorProjection | None = None


class CustomWeights(BaseModel):
    w_coverage: float = Field(..., ge=0.0, le=1.0)
    w_pin: float = Field(..., ge=0.0, le=1.0)
    w_chronic: float = Field(..., ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _check_sum(self) -> "CustomWeights":
        total = self.w_coverage + self.w_pin + self.w_chronic
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"weights must sum to 1.0, got {total}")
        return self


class SectorOption(BaseModel):
    code: str
    name: str
    available: bool


class RankingMeta(BaseModel):
    analysis_year: int
    pin_floor: int
    require_hrp: bool
    mode: Mode
    sort: str
    sort_dir: SortDir
    weights: CustomWeights | None = None
    total_count: int
    excluded_count: int
    fallback_count: int = 0
    data_freshness: str  # ISO 8601
    sector: str | None = None
    available_sectors: list[SectorOption] = Field(default_factory=list)


class RankingResponse(BaseModel):
    meta: RankingMeta
    rows: list[CountryRow]


# ---------- country detail ----------


class ClusterRow(BaseModel):
    cluster_name: str
    pin_cluster: int
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float
    unmet_need_usd: int
    coverage_flag: Literal["low", "normal"]
    qa_flags: list[QAFlag]


class PopulationGroupRow(BaseModel):
    category: str
    pin: int


class TrendInset2026(BaseModel):
    paid_usd: int
    pledged_usd: int
    commitment_usd: int
    unmet_usd: int


class TrendSeries(BaseModel):
    years: list[int]
    requirements_usd: list[int | None]
    funding_usd: list[int | None]
    chronic_markers: list[bool]
    inset_2026: TrendInset2026 | None = None


class FactSheet(BaseModel):
    pin: int | None = None
    pin_share: float | None = None
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float
    unmet_need_usd: int
    chronic_years: int
    inform_severity: float | None
    donor_concentration: float | None = None
    hrp_status: HRPStatus
    hno_year: int | None = None
    cbpf_allocations_total_usd: int | None = None


class BriefingNote(BaseModel):
    lead: str
    lead_source: Literal["template", "llm"]
    fact_sheet: FactSheet
    qualifiers: list[str]
    grounding: list[str]


class CountryDetailResponse(BaseModel):
    meta: RankingMeta
    country: CountryRow
    clusters: list[ClusterRow]
    population_groups: list[PopulationGroupRow]
    trend: TrendSeries
    briefing: BriefingNote


# ---------- clusters endpoint ----------


class ClusterAggregateRow(ClusterRow):
    countries_count: int


class ClusterDrilldownResponse(BaseModel):
    meta: RankingMeta
    scope: Literal["country", "cohort"]
    iso3: str | None = None
    rows: list[ClusterAggregateRow]


# ---------- coverage endpoint ----------


class ExcludedCountryRow(BaseModel):
    iso3: str
    country: str
    pin: int | None = None
    requirements_usd: float | None = None
    funding_usd: float | None = None
    coverage_ratio: float | None = None
    exclusion_reason: ExclusionReason
    detail: str


class InCohortFlaggedRow(BaseModel):
    iso3: str
    country: str
    qa_flags: list[QAFlag]


class InCohortFallbackRow(BaseModel):
    """Watch-list entry — surfaced separately from the ranked table because the
    upstream gap_score blend cannot be computed for these rows. No `gap_score`
    field by design: scores would not be apples-to-apples with the ranked
    table's strict-cohort scores."""
    iso3: str
    country: str
    qa_flags: list[QAFlag]
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float | None = None
    unmet_need_usd: int = 0
    inform_severity: float | None = None


class CoverageResponse(BaseModel):
    meta: RankingMeta
    excluded: list[ExcludedCountryRow]
    in_cohort_flagged: list[InCohortFlaggedRow]
    in_cohort_fallback: list[InCohortFallbackRow] = Field(default_factory=list)


# ---------- NL query (reserved) ----------


class ParsedFilter(BaseModel):
    field: Literal[
        "cluster", "coverage_ratio", "pin_share", "chronic_years", "hrp_status"
    ]
    op: Literal["eq", "lt", "lte", "gt", "gte", "in"]
    value: str | float | list[str]
    taxonomy: str | None = None


class EchoBackChip(BaseModel):
    label: str
    filter: ParsedFilter
    editable: bool


class NLQueryRequest(BaseModel):
    query: str
    cohort: dict | None = None


class NLQueryResponse(BaseModel):
    filters: list[ParsedFilter]
    echo_back_chips: list[EchoBackChip]
    caveats: list[str]


# ---------- health ----------


class HealthResponse(BaseModel):
    status: Literal["ok"]
    datasets_loaded: int
    last_loaded: str
