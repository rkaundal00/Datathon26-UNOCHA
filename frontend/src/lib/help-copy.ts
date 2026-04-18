import type { ColumnKey } from "@/lib/columns";
import type { HRPStatus, QAFlag } from "@/lib/api-types";

// Always-visible subtitle under each abbreviated column header (L1 ambient).
export const HEADER_SUBTITLE: Record<ColumnKey, string> = {
  country: "Name · ISO3",
  pin: "People in Need",
  pin_share: "% of national pop.",
  coverage_ratio: "Funded ÷ Requested",
  unmet_need_usd: "Requested − Funded (USD)",
  gap_score: "Ranking heuristic, 0–1",
  custom_gap_score: "User-weighted, 0–1",
  chronic_years: "Years of underfunding",
  hrp_status: "Appeal type",
  qa_flags: "Data-quality advisories",
};

// 1-line hover tooltip for each column header (L2).
export const HEADER_TOOLTIP: Record<ColumnKey, (year: number) => string> = {
  country: () => "Country name with ISO3 code. ISO3 is the stable join key across all sources.",
  pin: (y) => `People in Need for the analysis year (${y}). Source: HNO country-level row.`,
  pin_share: (y) => `PIN divided by national population (${y}). Normalizes need against country size.`,
  coverage_ratio: (y) => `Funding ÷ Requirements for the appeal of record (${y}, FTS). Uncapped — >100% means overfunded.`,
  unmet_need_usd: (y) => `max(0, Requirements − Funding) for ${y}. Absolute shortfall in USD.`,
  gap_score: () => "(1 − min(coverage, 1)) × PIN share. Ranking heuristic, not a recommendation.",
  custom_gap_score: () => "Linear composite with user-provided weights. Answers a different question than Gap score.",
  chronic_years: () => "Consecutive prior years with coverage below 50%, capped at 5. Chain breaks on a year ≥50% or a missing record.",
  hrp_status: () => "Which type of appeal FTS has of record: HRP, FlashAppeal, RegionalRP, Other, or Unknown.",
  qa_flags: () => "Data-quality advisories attached to this row. Hover each badge for details.",
};

// Plan / HRP status badge tooltips (L2).
export const PLAN_COPY: Record<
  HRPStatus,
  { label: string; short: string; tooltip: string }
> = {
  HRP: {
    label: "Humanitarian Response Plan",
    short: "HRP",
    tooltip: "Humanitarian Response Plan — formal multi-cluster appeal led by OCHA.",
  },
  FlashAppeal: {
    label: "Flash Appeal",
    short: "Flash",
    tooltip: "Flash Appeal — rapid short-cycle appeal for a sudden-onset crisis.",
  },
  RegionalRP: {
    label: "Regional Response Plan",
    short: "Regional RP",
    tooltip: "Regional Response Plan — cross-border appeal spanning multiple countries.",
  },
  Other: {
    label: "Other appeal type",
    short: "Other",
    tooltip: "Other appeal type — non-HRP/Flash/Regional appeal registered in FTS.",
  },
  Unknown: {
    label: "Unknown plan type",
    short: "Unknown",
    tooltip:
      "Unknown plan type — FTS has requirements recorded but no declared appeal type. Row is excluded unless the HRP toggle is off.",
  },
  None: {
    label: "None",
    short: "None",
    tooltip: "No appeal record — row is excluded from the cohort.",
  },
};

// QA flag glossary — extends api-types QA_FLAG_LABEL with 1-line "implication for trust".
export const FLAG_COPY: Record<
  QAFlag,
  { label: string; short: string; tooltip: string }
> = {
  funding_imputed_zero: {
    label: "Funding imputed as zero",
    short: "imputed $0",
    tooltip:
      "Requirements exist but no FTS funding is recorded. Treat coverage as uncertain; verify at fts.unocha.org.",
  },
  hno_stale: {
    label: "HNO from prior year",
    short: "HNO stale",
    tooltip: "People-in-Need figures are from the year before the analysis year.",
  },
  population_stale: {
    label: "Population data > 2 years old",
    short: "pop stale",
    tooltip:
      "Population reference is more than 2 years older than the analysis year. PIN share may be miscalibrated.",
  },
  donor_conc_2026_only: {
    label: "Donor HHI from 2026 transactions",
    short: "HHI 2026",
    tooltip:
      "Donor concentration reflects 2026 transaction data only — no pre-2026 baseline available.",
  },
  cluster_taxonomy_mismatch: {
    label: "Cluster taxonomy fallback",
    short: "taxonomy",
    tooltip:
      "Raw cluster names used instead of the harmonized taxonomy. Cluster comparisons across countries may not be one-to-one.",
  },
  severity_unavailable: {
    label: "Severity not available",
    short: "no sev",
    tooltip:
      "Severity data is not present in the HNO for this year (MVP-wide). Scatter uses log10(PIN) × PIN share as a fallback axis.",
  },
  preliminary_hno: {
    label: "2026 HNO is preliminary",
    short: "HNO prelim",
    tooltip: "2026 HNO is national-only. Sub-national (admin1) detail is not yet published.",
  },
  hrp_status_unknown: {
    label: "Plan type imputed",
    short: "plan ?",
    tooltip:
      "FTS records requirements for this country-year but no declared appeal type. Classified as Unknown.",
  },
};

export const CHRONIC_CLUSTER_TOOLTIP =
  "Consecutive prior years with coverage below 50%, counting back from the analysis year. Capped at 5. Open the country detail for the year-by-year breakdown.";

// Confidence tier definitions for the Methodology drawer.
export const CONFIDENCE_TIER_COPY = {
  authoritative: {
    label: "Authoritative",
    glyph: "●",
    body: "Value comes directly from a primary source with no derivation (HNO country row, FTS aggregate). Trust high.",
  },
  derived: {
    label: "Derived",
    glyph: "◐",
    body: "Value is computed from authoritative inputs via a documented formula. Trust inherits from the inputs.",
  },
  imputed: {
    label: "Imputed",
    glyph: "○",
    body: "At least one input is stale, missing, or filled in by a fallback. Verify before citing in a briefing.",
  },
} as const;

// Methodology drawer intro copy.
export const METHODOLOGY_INTRO =
  "This page ranks active humanitarian appeals by the gap between documented need (HNO) and funding coverage (FTS). It does not prescribe where funding should go — it surfaces the signal and its provenance so a coordinator can decide.";

export const GAP_SCORE_GUARDRAIL =
  "Gap score is a ranking heuristic, not a funding recommendation. It flags cases of high need combined with low coverage; it cannot account for political context, absorptive capacity, or response plan quality. Use it to surface candidates for review, not to conclude the review.";
