// Mirrors pipeline/api/schemas.py. Do not edit without re-reviewing spec-data-pipeline.md §8.

export type HRPStatus =
  | "HRP"
  | "FlashAppeal"
  | "RegionalRP"
  | "Other"
  | "Unknown"
  | "None";

export type Mode = "acute" | "structural" | "combined";

export type QAFlag =
  | "funding_imputed_zero"
  | "hno_stale"
  | "population_stale"
  | "donor_conc_2026_only"
  | "cluster_taxonomy_mismatch"
  | "severity_unavailable"
  | "preliminary_hno"
  | "hrp_status_unknown"
  | "cluster_funding_missing"
  | "fts_year_fallback"
  | "need_proxy_inform"
  | "population_unavailable";

export type ExclusionReason =
  | "no_active_hrp"
  | "stale_hno"
  | "no_fts_appeal_record"
  | "no_population_baseline";

export type SortDir = "asc" | "desc";

export type DetailTab = "clusters" | "trend" | "population";

export type AnalysisYear = 2024 | 2025 | 2026;

export interface SectorProjection {
  code: string;
  name: string;
  pin_cluster: number;
  cluster_pin_share: number;
  cluster_requirements_usd: number;
  cluster_funding_usd: number;
  cluster_coverage_ratio: number;
  cluster_unmet_need_usd: number;
  cluster_gap_score: number;
  qa_flags: QAFlag[];
}

export interface CountryRow {
  iso3: string;
  country: string;
  analysis_year: number;
  pin: number | null;
  population: number | null;
  population_reference_year: number | null;
  pin_share: number | null;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  unmet_need_usd: number;
  gap_score: number;
  custom_gap_score: number | null;
  chronic_years: number;
  inform_severity: number | null;
  donor_concentration: number | null;
  hrp_status: HRPStatus;
  hno_year: number | null;
  qa_flags: QAFlag[];
  sector: SectorProjection | null;
}

export interface CustomWeights {
  w_coverage: number;
  w_pin: number;
  w_chronic: number;
}

export interface SectorOption {
  code: string;
  name: string;
  available: boolean;
}

export interface RankingMeta {
  analysis_year: AnalysisYear;
  pin_floor: number;
  require_hrp: boolean;
  mode: Mode;
  sort: string;
  sort_dir: SortDir;
  weights: CustomWeights | null;
  total_count: number;
  excluded_count: number;
  data_freshness: string;
  sector: string | null;
  available_sectors: SectorOption[];
}

export interface RankingResponse {
  meta: RankingMeta;
  rows: CountryRow[];
}

export interface ClusterRow {
  cluster_name: string;
  pin_cluster: number;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  unmet_need_usd: number;
  coverage_flag: "low" | "normal";
  qa_flags: QAFlag[];
}

export interface ClusterAggregateRow extends ClusterRow {
  countries_count: number;
}

export interface ClusterDrilldownResponse {
  meta: RankingMeta;
  scope: "country" | "cohort";
  iso3: string | null;
  rows: ClusterAggregateRow[];
}

export interface PopulationGroupRow {
  category: string;
  pin: number;
}

export interface TrendInset2026 {
  paid_usd: number;
  pledged_usd: number;
  commitment_usd: number;
  unmet_usd: number;
}

export interface TrendSeries {
  years: number[];
  requirements_usd: (number | null)[];
  funding_usd: (number | null)[];
  chronic_markers: boolean[];
  inset_2026: TrendInset2026 | null;
}

export interface FactSheet {
  pin: number | null;
  pin_share: number | null;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  unmet_need_usd: number;
  chronic_years: number;
  inform_severity: number | null;
  donor_concentration: number | null;
  hrp_status: HRPStatus;
  hno_year: number | null;
  cbpf_allocations_total_usd: number | null;
}

export interface BriefingNote {
  lead: string;
  lead_source: "template" | "llm";
  fact_sheet: FactSheet;
  qualifiers: string[];
  grounding: string[];
}

export interface CountryDetailResponse {
  meta: RankingMeta;
  country: CountryRow;
  clusters: ClusterRow[];
  population_groups: PopulationGroupRow[];
  trend: TrendSeries;
  briefing: BriefingNote;
}

export interface ExcludedCountryRow {
  iso3: string;
  country: string;
  pin: number | null;
  requirements_usd: number | null;
  funding_usd: number | null;
  coverage_ratio: number | null;
  exclusion_reason: ExclusionReason;
  detail: string;
}

export interface InCohortFlaggedRow {
  iso3: string;
  country: string;
  qa_flags: QAFlag[];
}

export interface InCohortFallbackRow {
  iso3: string;
  country: string;
  qa_flags: QAFlag[];
  gap_score: number;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number | null;
  inform_severity: number | null;
}

export interface CoverageResponse {
  meta: RankingMeta;
  excluded: ExcludedCountryRow[];
  in_cohort_flagged: InCohortFlaggedRow[];
  in_cohort_fallback: InCohortFallbackRow[];
}

export const QA_FLAG_LABEL: Record<QAFlag, string> = {
  funding_imputed_zero: "Funding: imputed zero",
  hno_stale: "HNO data from prior year",
  population_stale: "Population >2yr old",
  donor_conc_2026_only: "Donor HHI from 2026 transactions",
  cluster_taxonomy_mismatch: "Cluster taxonomy fallback",
  severity_unavailable: "Severity not available",
  preliminary_hno: "2026 HNO is preliminary",
  hrp_status_unknown: "Plan type unknown",
  cluster_funding_missing: "No FTS funding reported for this sector",
  fts_year_fallback: "FTS: prior-year fallback used",
  need_proxy_inform: "Need proxied from INFORM Severity",
  population_unavailable: "No COD-PS population baseline",
};

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  no_active_hrp: "No active HRP / Flash / Regional plan",
  stale_hno: "No HNO row for this or prior year",
  no_fts_appeal_record: "No FTS appeal of record",
  no_population_baseline: "No COD-PS population baseline",
};
