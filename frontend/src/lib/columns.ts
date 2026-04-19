import type { CountryRow, QAFlag } from "@/lib/api-types";

export type ColumnKey =
  | "country"
  | "pin"
  | "pin_share"
  | "coverage_ratio"
  | "unmet_need_usd"
  | "gap_score"
  | "custom_gap_score"
  | "chronic_years"
  | "hrp_status"
  | "qa_flags";

export type ConfidenceTier = "authoritative" | "derived" | "imputed";

export type SourceDataset =
  | "HNO"
  | "FTS"
  | "COD-PS"
  | "FTS-incoming-2026"
  | "derived";

export type Decomposable =
  | "gap_score"
  | "custom_gap_score"
  | "coverage_ratio"
  | "pin_share"
  | "unmet_need_usd";

export interface ColumnMeta {
  key: ColumnKey;
  label: string;
  unitLabel: string;
  displayLabel: string;
  className?: string;
  sortable: boolean;
  sources: SourceDataset[];
  baseTier: ConfidenceTier;
  tier: (row: CountryRow) => ConfidenceTier;
  popover: {
    what: string;
    how: string;
    source: string;
    whyItMatters: string;
  };
  decomposable: boolean;
  thresholdable: boolean;
}

const hasFlag = (flags: QAFlag[], f: QAFlag) => flags.includes(f);

export const COLUMN_META: Record<ColumnKey, ColumnMeta> = {
  country: {
    key: "country",
    label: "Country",
    unitLabel: "",
    displayLabel: "Country",
    sortable: true,
    sources: ["HNO", "COD-PS"],
    baseTier: "authoritative",
    tier: () => "authoritative",
    popover: {
      what: "Country name, with ISO3 code underneath. The ISO3 is the stable join key across every source in this tool — country names vary, codes do not.",
      how: "Display string; no computation.",
      source: "COD-PS Admin0 / HNO country name.",
      whyItMatters: "All joins are on P-codes, never on names. If you see the same ISO3 twice the tool has a bug; if you see two names for one ISO3 the source has a bug.",
    },
    decomposable: false,
    thresholdable: false,
  },
  pin: {
    key: "pin",
    label: "PIN",
    unitLabel: "(people)",
    displayLabel: "PIN (people)",
    className: "text-right",
    sortable: true,
    sources: ["HNO"],
    baseTier: "authoritative",
    tier: (row) => (hasFlag(row.qa_flags, "preliminary_hno") ? "derived" : "authoritative"),
    popover: {
      what: "People In Need — the country-level estimate of the population requiring humanitarian assistance in the analysis year.",
      how: "Single HNO row where cluster='ALL' AND category IS NULL (the country-level aggregate — never a blind sum across clusters).",
      source: "HNO (hpc_hno_{year}.parquet). 2026 is preliminary national-only; earlier years carry admin1 detail but this column always reads the national row.",
      whyItMatters: "Absolute scale of need. Anchors everything else — coverage and gap score lose meaning if PIN is wrong.",
    },
    decomposable: false,
    thresholdable: false,
  },
  pin_share: {
    key: "pin_share",
    label: "PIN share",
    unitLabel: "(% of pop.)",
    displayLabel: "PIN share (% of pop.)",
    className: "text-right",
    sortable: true,
    sources: ["HNO", "COD-PS"],
    baseTier: "derived",
    tier: (row) => (hasFlag(row.qa_flags, "population_stale") ? "imputed" : "derived"),
    popover: {
      what: "Share of the country's population classified as People In Need.",
      how: "pin_share = pin / population_admin0",
      source: "PIN from HNO. Population from COD-PS admin0, nearest reference year ≤ analysis_year.",
      whyItMatters: "Normalizes absolute need against country size. Two countries with identical PIN represent very different situations when populations differ by 10×.",
    },
    decomposable: true,
    thresholdable: true,
  },
  coverage_ratio: {
    key: "coverage_ratio",
    label: "Coverage",
    unitLabel: "(%)",
    displayLabel: "Coverage (%)",
    className: "text-right",
    sortable: true,
    sources: ["FTS"],
    baseTier: "authoritative",
    tier: (row) => (hasFlag(row.qa_flags, "funding_imputed_zero") ? "imputed" : "authoritative"),
    popover: {
      what: "Share of the country's FTS-registered appeal that has been funded. Raw and uncapped — values above 100% mean the appeal is overfunded relative to the appeal of record.",
      how: "coverage_ratio = funding_usd / requirements_usd",
      source: "FTS aggregate (fts_requirements_funding_global.parquet). Appeal × year granularity; self-reported and retroactively revised.",
      whyItMatters: "Primary response-pipeline signal. Low coverage with high PIN share is the archetypal overlooked crisis.",
    },
    decomposable: true,
    thresholdable: true,
  },
  unmet_need_usd: {
    key: "unmet_need_usd",
    label: "Unmet need",
    unitLabel: "(USD)",
    displayLabel: "Unmet need (USD)",
    className: "text-right",
    sortable: true,
    sources: ["FTS"],
    baseTier: "derived",
    tier: (row) => (hasFlag(row.qa_flags, "funding_imputed_zero") ? "imputed" : "derived"),
    popover: {
      what: "Dollar gap between what the appeal requires and what has been funded. Floored at zero — never negative, even when the appeal is overfunded.",
      how: "unmet_need_usd = max(0, requirements_usd − funding_usd)",
      source: "FTS aggregate requirements and funding.",
      whyItMatters: "Absolute shortfall, not a ratio. Scales with country size — useful for 'how much more is needed' conversations where a coverage percentage hides the magnitude.",
    },
    decomposable: true,
    thresholdable: false,
  },
  gap_score: {
    key: "gap_score",
    label: "Gap score",
    unitLabel: "",
    displayLabel: "Gap score",
    className: "text-right",
    sortable: true,
    sources: ["derived"],
    baseTier: "derived",
    tier: (row) =>
      hasFlag(row.qa_flags, "funding_imputed_zero") || hasFlag(row.qa_flags, "population_stale")
        ? "imputed"
        : "derived",
    popover: {
      what: "Composite ranking score. High means high need AND severe underfunding. Blends relative intensity (PIN share) with absolute scale (log PIN) so large crises aren't artificially depressed.",
      how: "gap_score = (1 − min(coverage, 1)) × (0.5 × pin_share + 0.5 × norm_log₁₀(pin))",
      source: "Derived from Coverage, PIN share, and PIN.",
      whyItMatters: "Default ranking signal. A 50/50 blend of relative and absolute need, weighted by funding shortfall. Click any Gap score cell to see the decomposition.",
    },
    decomposable: true,
    thresholdable: false,
  },
  custom_gap_score: {
    key: "custom_gap_score",
    label: "Custom",
    unitLabel: "",
    displayLabel: "Custom",
    className: "text-right",
    sortable: true,
    sources: ["derived"],
    baseTier: "derived",
    tier: (row) =>
      hasFlag(row.qa_flags, "funding_imputed_zero") || hasFlag(row.qa_flags, "population_stale")
        ? "imputed"
        : "derived",
    popover: {
      what: "Opt-in linear composite using user-provided weights. Answers a different question than the default multiplicative Gap score — setting weights will not reproduce it.",
      how: "custom = w_coverage × (1 − min(cov, 1)) + w_pin × pin_share + w_chronic × (chronic_years / 5)",
      source: "Derived from Coverage, PIN share, and Chronic years.",
      whyItMatters: "Stress-test the ranking under alternative weightings. The Advanced panel ships with a disclaimer that linear ≠ multiplicative.",
    },
    decomposable: true,
    thresholdable: false,
  },
  chronic_years: {
    key: "chronic_years",
    label: "Chronic",
    unitLabel: "(years)",
    displayLabel: "Chronic (years)",
    className: "text-center",
    sortable: true,
    sources: ["FTS"],
    baseTier: "derived",
    tier: () => "derived",
    popover: {
      what: "Consecutive prior years with coverage below 50%, counting backward from analysis_year − 1. Capped at 5. The chain breaks on a year at ≥50% coverage or a missing appeal record.",
      how: "chronic_years = count_consecutive(coverage_ratio < 0.5, from = analysis_year − 1, cap = 5)",
      source: "FTS aggregate requirements / funding history (1999–present).",
      whyItMatters: "Distinguishes structural neglect from one-off shortfalls. A 5/5 score means five straight years under the 50% funded threshold — this is not a new problem.",
    },
    decomposable: false,
    thresholdable: true,
  },
  hrp_status: {
    key: "hrp_status",
    label: "Plan",
    unitLabel: "",
    displayLabel: "Plan",
    sortable: true,
    sources: ["FTS"],
    baseTier: "authoritative",
    tier: (row) => (hasFlag(row.qa_flags, "hrp_status_unknown") ? "imputed" : "authoritative"),
    popover: {
      what: "Which type of appeal is of record for this country-year: HRP, Flash Appeal, Regional RP, Other, Unknown, or None (None is always excluded from the cohort).",
      how: "Cascade on FTS typeName: known type → HRP / FlashAppeal / RegionalRP. Else if requirements > 0 → Unknown. Else → None.",
      source: "FTS appeals table typeName (~32% populated; Unknown is the fallback for rows with requirements > 0 but missing type).",
      whyItMatters: "Controls cohort strictness. The 'active HRP' scope chip requires HRP / FlashAppeal / RegionalRP; toggling it off brings Other and Unknown back into the table.",
    },
    decomposable: false,
    thresholdable: false,
  },
  qa_flags: {
    key: "qa_flags",
    label: "Flags",
    unitLabel: "",
    displayLabel: "Flags",
    sortable: false,
    sources: ["derived"],
    baseTier: "derived",
    tier: () => "derived",
    popover: {
      what: "Data-quality advisories for this row. Each flag points to a specific known limitation in the input data or the derivation path.",
      how: "Populated by pipeline/transform/qa.py: imputed-zero funding, stale population, preliminary HNO, and others. severity_unavailable fires for every row in the MVP and is hidden from the chip list.",
      source: "Derived; see pipeline/api/schemas.py QAFlag enum and QA_FLAG_LABEL in api-types.ts.",
      whyItMatters: "Makes data limits visible rather than hiding them. A ranking with no flags is uniformly trustworthy; flags signal where to verify before citing a number in a briefing.",
    },
    decomposable: false,
    thresholdable: false,
  },
};

export const DECOMPOSABLE_COLUMNS: readonly Decomposable[] = [
  "gap_score",
  "custom_gap_score",
  "coverage_ratio",
  "pin_share",
  "unmet_need_usd",
];

export function isDecomposable(k: string): k is Decomposable {
  return (DECOMPOSABLE_COLUMNS as readonly string[]).includes(k);
}
