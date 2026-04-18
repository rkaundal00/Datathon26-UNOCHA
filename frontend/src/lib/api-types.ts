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
  | "hrp_status_unknown";

export type ExclusionReason =
  | "no_active_hrp"
  | "stale_hno"
  | "no_fts_appeal_record"
  | "no_population_baseline";

export type SortDir = "asc" | "desc";

export type DetailTab = "clusters" | "trend" | "population";

export type AnalysisYear = 2024 | 2025 | 2026;

export interface CountryRow {
  iso3: string;
  country: string;
  analysis_year: number;
  pin: number;
  population: number;
  population_reference_year: number;
  pin_share: number;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  unmet_need_usd: number;
  gap_score: number;
  custom_gap_score: number | null;
  chronic_years: number;
  donor_concentration: number | null;
  hrp_status: HRPStatus;
  hno_year: number;
  qa_flags: QAFlag[];
}

export interface CustomWeights {
  w_coverage: number;
  w_pin: number;
  w_chronic: number;
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
  pin: number;
  pin_share: number;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  unmet_need_usd: number;
  chronic_years: number;
  donor_concentration: number | null;
  hrp_status: HRPStatus;
  hno_year: number;
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
  exclusion_reason: ExclusionReason;
  detail: string;
}

export interface InCohortFlaggedRow {
  iso3: string;
  country: string;
  qa_flags: QAFlag[];
}

export interface CoverageResponse {
  meta: RankingMeta;
  excluded: ExcludedCountryRow[];
  in_cohort_flagged: InCohortFlaggedRow[];
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
};

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  no_active_hrp: "No active HRP / Flash / Regional plan",
  stale_hno: "No HNO row for this or prior year",
  no_fts_appeal_record: "No FTS appeal of record",
  no_population_baseline: "No COD-PS population baseline",
};
