import type {
  CountryRow,
  CoverageResponse,
  ExclusionReason,
  HRPStatus,
  QAFlag,
  RankingMeta,
  RankingResponse,
  AnalysisYear,
  SectorProjection,
} from "@/lib/api-types";
import type { MapMetric } from "@/lib/url-state";

export interface MapRow {
  iso3: string;
  country: string;
  inCohort: boolean;
  exclusionReason?: ExclusionReason;
  exclusionDetail?: string;
  // present iff inCohort
  gap_score?: number;
  coverage_ratio?: number;
  pin?: number;
  pin_share?: number;
  chronic_years?: number;
  hrp_status?: HRPStatus;
  qa_flags?: QAFlag[];
  // present iff the backend returned this row under a sector lens
  sector?: SectorProjection | null;
}

export interface MapsData {
  year: AnalysisYear;
  meta: RankingMeta;
  rows: Map<string, MapRow>;
}

export function mergeRankingAndCoverage(
  ranking: RankingResponse,
  coverage: CoverageResponse,
): Map<string, MapRow> {
  const out = new Map<string, MapRow>();
  for (const r of ranking.rows) {
    out.set(r.iso3, rowFromRanking(r));
  }
  for (const e of coverage.excluded) {
    if (out.has(e.iso3)) continue; // ranking wins
    out.set(e.iso3, {
      iso3: e.iso3,
      country: e.country,
      inCohort: false,
      exclusionReason: e.exclusion_reason,
      exclusionDetail: e.detail,
    });
  }
  return out;
}

function rowFromRanking(r: CountryRow): MapRow {
  return {
    iso3: r.iso3,
    country: r.country,
    inCohort: true,
    gap_score: r.gap_score,
    coverage_ratio: r.coverage_ratio,
    pin: r.pin,
    pin_share: r.pin_share,
    chronic_years: r.chronic_years,
    hrp_status: r.hrp_status,
    qa_flags: r.qa_flags,
    sector: r.sector ?? null,
  };
}

const METRIC_DIR: Record<MapMetric, "desc" | "asc"> = {
  gap_score: "desc",
  coverage_ratio: "asc",
  pin: "desc",
  pin_share: "desc",
  chronic_years: "desc",
  hrp_status: "desc",
};

export function topTen(rows: Map<string, MapRow>, metric: MapMetric, n = 10): MapRow[] {
  const cohort = Array.from(rows.values()).filter((r) => r.inCohort);
  const dir = METRIC_DIR[metric];
  const valueOf = (r: MapRow): number => {
    if (metric === "hrp_status") return hrpOrdinal(r.hrp_status);
    const v = metricValue(r, metric);
    return v == null ? (dir === "desc" ? -Infinity : Infinity) : v;
  };
  return cohort
    .sort((a, b) => (dir === "desc" ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)))
    .slice(0, n);
}

/** Returns the metric's numeric value, reading from the sector projection when present. */
export function metricValue(row: MapRow, metric: MapMetric): number | undefined {
  const s = row.sector;
  if (s) {
    switch (metric) {
      case "gap_score":
        return s.cluster_gap_score;
      case "coverage_ratio":
        return s.cluster_coverage_ratio;
      case "pin":
        return s.pin_cluster;
      case "pin_share":
        return s.cluster_pin_share;
      case "chronic_years":
        return row.chronic_years;
      case "hrp_status":
        return undefined;
    }
  }
  if (metric === "hrp_status") return undefined;
  return row[metric] as number | undefined;
}

function hrpOrdinal(s?: HRPStatus): number {
  if (!s) return 0;
  return { HRP: 5, FlashAppeal: 4, RegionalRP: 3, Other: 2, Unknown: 1, None: 0 }[s];
}

const usdFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMetricValue(metric: MapMetric, row: MapRow): string {
  if (!row.inCohort) return "—";
  const v = metricValue(row, metric);
  switch (metric) {
    case "gap_score":
      return (v ?? 0).toFixed(3);
    case "coverage_ratio":
      return `${((v ?? 0) * 100).toFixed(0)}%`;
    case "pin":
      return usdFmt.format(v ?? 0);
    case "pin_share":
      return `${((v ?? 0) * 100).toFixed(1)}%`;
    case "chronic_years":
      return `${row.chronic_years ?? 0}/5`;
    case "hrp_status":
      return row.hrp_status ?? "—";
  }
}
