/**
 * Spec-derived thresholds for opt-in table highlighting (Pass 1) and
 * row-summary descriptor bands (Pass 1.5).
 *
 * Every constant carries a provenance citation. If a value lacks a citation,
 * it does not belong here.
 */
export const THRESHOLDS = {
  /**
   * Chronic-year definition cutoff. Mirrors
   * pipeline/config.py CHRONIC_COVERAGE_THRESHOLD.
   */
  chronic_coverage: 0.5,

  /**
   * chronic_years band: ≥2 consecutive years triggers "structural pattern"
   * descriptor in the row summary.
   */
  chronic_years_structural: 2,

  /**
   * chronic_years band: ≥3 triggers highlight + "chronic neglect" descriptor.
   * Source: pipeline/api/service.py _briefing_lead band.
   */
  chronic_years_highlight: 3,
  chronic_years_neglect: 4,

  /**
   * Coverage bands.
   * Source: pipeline/api/service.py _briefing_lead descriptors —
   *   < 0.30 → "severely underfunded"
   *   < 0.60 → "partly covered"
   *   ≥ 0.60 → "adequately resourced"
   *   ≥ 1.00 → "overfunded" (overrides)
   */
  coverage_severely_underfunded: 0.3,
  coverage_partial: 0.6,
  coverage_overfunded: 1.0,

  /**
   * PIN share bands.
   * Source: distribution inspection of the 2025 HRP cohort. Not in spec —
   * documented here as the editorial cut-points this tool takes. Revisit
   * when HNO 2026 goes full admin1.
   */
  pin_share_very_high: 0.3,
  pin_share_high: 0.15,
  pin_share_moderate: 0.05,
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;
