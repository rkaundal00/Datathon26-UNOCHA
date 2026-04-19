import type { AnalysisYear, Mode, SortDir, QAFlag } from "@/lib/api-types";

const MODE_DEFAULT_SORT: Record<Mode, { sort: string; dir: SortDir }> = {
  acute: { sort: "coverage_gap", dir: "desc" },
  structural: { sort: "chronic_years", dir: "desc" },
  combined: { sort: "gap_score", dir: "desc" },
};

export type MapMetric =
  | "gap_score"
  | "coverage_ratio"
  | "pin"
  | "pin_share"
  | "chronic_years"
  | "hrp_status";

export const MAP_METRICS: readonly MapMetric[] = [
  "gap_score",
  "coverage_ratio",
  "pin",
  "pin_share",
  "chronic_years",
  "hrp_status",
] as const;

export interface UrlState {
  year: AnalysisYear;
  pinFloor: number;
  requireHrp: boolean;
  mode: Mode;
  sort: string | null;
  sortDir: SortDir;
  scatter: "a" | "b";
  weights: string | null;
  focus: string | null;
  detail: "clusters" | "trend" | "population" | null;
  flags: string[];
  metric: MapMetric;
}

type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function asInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

function asEnum<T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;
}

export function parseUrlState(
  raw: Record<string, SearchParamValue>,
): UrlState {
  const year = asEnum(first(raw.year), ["2024", "2025", "2026"] as const, "2025") as "2024" | "2025" | "2026";
  const mode = asEnum(first(raw.mode), ["acute", "structural", "combined"] as const, "combined");
  const sort = first(raw.sort) ?? null;
  const sortDir = asEnum(first(raw.sort_dir ?? raw.dir), ["asc", "desc"] as const, "desc");
  const scatter = asEnum(first(raw.scatter), ["a", "b"] as const, "a");
  const flagsRaw = first(raw.flags);
  const flags = flagsRaw ? flagsRaw.split(",").filter(Boolean) : [];
  return {
    year: Number(year) as AnalysisYear,
    pinFloor: asInt(first(raw.pin_floor), 1_000_000),
    requireHrp: asBool(first(raw.hrp ?? raw.require_hrp), true),
    mode,
    sort,
    sortDir,
    scatter,
    weights: first(raw.weights) ?? null,
    focus: first(raw.focus)?.toUpperCase() ?? null,
    detail: asEnum(first(raw.detail), ["clusters", "trend", "population", ""] as const, "") as
      | "clusters"
      | "trend"
      | "population"
      | null || null,
    flags,
    metric: asEnum(first(raw.metric), MAP_METRICS, "gap_score"),
  };
}

/**
 * Resolve effective sort/sortDir given mode + explicit sort.
 * Explicit `sort` wins per base spec §6 — the URL precedence rule.
 */
export function effectiveSort(state: UrlState): { sort: string; sortDir: SortDir } {
  if (state.sort && state.sort.length > 0) {
    return { sort: state.sort, sortDir: state.sortDir };
  }
  const preset = MODE_DEFAULT_SORT[state.mode];
  return { sort: preset.sort, sortDir: preset.dir };
}

export function apiParamsFromUrlState(state: UrlState) {
  const { sort, sortDir } = effectiveSort(state);
  return {
    analysis_year: state.year,
    pin_floor: state.pinFloor,
    require_hrp: state.requireHrp,
    mode: state.mode,
    sort,
    sort_dir: sortDir,
    weights: state.weights ?? undefined,
    flags: state.flags.length ? state.flags.join(",") : undefined,
  };
}

export function mergeUrl(
  current: URLSearchParams | Record<string, SearchParamValue>,
  patch: Partial<Record<string, string | number | boolean | string[] | null>>,
): string {
  const out = new URLSearchParams();
  const iter =
    current instanceof URLSearchParams
      ? Array.from(current.entries())
      : Object.entries(current).flatMap(([k, v]) =>
          Array.isArray(v)
            ? v.map((x) => [k, x] as [string, string])
            : v != null
              ? [[k, v] as [string, string]]
              : [],
        );
  for (const [k, v] of iter) out.append(k, v);
  for (const [k, v] of Object.entries(patch)) {
    out.delete(k);
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      const joined = v.join(",");
      if (joined) out.set(k, joined);
    } else {
      out.set(k, String(v));
    }
  }
  return out.toString();
}

export { MODE_DEFAULT_SORT };
