import type { CountryRow, QAFlag } from "@/lib/api-types";
import { QA_FLAG_LABEL } from "@/lib/api-types";
import type { ColumnMeta, ConfidenceTier } from "@/lib/columns";

export function tierGlyph(t: ConfidenceTier): string {
  switch (t) {
    case "authoritative":
      return "●";
    case "derived":
      return "◐";
    case "imputed":
      return "○";
  }
}

export function tierLabel(t: ConfidenceTier): string {
  switch (t) {
    case "authoritative":
      return "Authoritative";
    case "derived":
      return "Derived";
    case "imputed":
      return "Imputed";
  }
}

const TIER_BODY: Record<ConfidenceTier, string> = {
  authoritative:
    "Direct from the source dataset, no imputation. Cite with confidence.",
  derived:
    "Computed from two or more source values. The inputs themselves are authoritative.",
  imputed:
    "At least one input was filled in because the source reported nothing. Verify upstream before citing.",
};

// Mirrors the tier resolver in columns.ts — which QA flags could have demoted
// this column's tier. Surfaced in the tier popover so the user sees *why*.
const RELEVANT_FLAGS: Partial<Record<ColumnMeta["key"], readonly QAFlag[]>> = {
  pin: ["preliminary_hno"],
  pin_share: ["population_stale"],
  coverage_ratio: ["funding_imputed_zero"],
  unmet_need_usd: ["funding_imputed_zero"],
  gap_score: ["funding_imputed_zero", "population_stale"],
  custom_gap_score: ["funding_imputed_zero", "population_stale"],
  hrp_status: ["hrp_status_unknown"],
};

export function demotingFlags(col: ColumnMeta, row: CountryRow): QAFlag[] {
  const relevant = RELEVANT_FLAGS[col.key] ?? [];
  return relevant.filter((f) => row.qa_flags.includes(f));
}

export interface TierExplanation {
  tier: ConfidenceTier;
  heading: string;
  body: string;
  flags: QAFlag[];
  flagLabels: string[];
}

export function tierExplanation(
  col: ColumnMeta,
  row: CountryRow,
): TierExplanation {
  const tier = col.tier(row);
  const heading = `${tierLabel(tier)} · ${col.sources.join(" + ")}`;
  const flags = demotingFlags(col, row);
  return {
    tier,
    heading,
    body: TIER_BODY[tier],
    flags,
    flagLabels: flags.map((f) => QA_FLAG_LABEL[f]),
  };
}
