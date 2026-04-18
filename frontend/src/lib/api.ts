import type {
  AnalysisYear,
  CountryDetailResponse,
  CoverageResponse,
  ClusterDrilldownResponse,
  Mode,
  RankingResponse,
  SortDir,
} from "@/lib/api-types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export interface RankingParams {
  analysis_year?: AnalysisYear;
  pin_floor?: number;
  require_hrp?: boolean;
  mode?: Mode;
  sort?: string;
  sort_dir?: SortDir;
  weights?: string;
  flags?: string;
}

function buildQuery(params: object): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    // Booleans → lowercase; numbers → unquoted string; strings/arrays → as-is.
    if (typeof v === "boolean") usp.set(k, v ? "true" : "false");
    else usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function get<T>(path: string, params: object = {}): Promise<T> {
  const url = `${API_BASE}${path}${buildQuery(params)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${url} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function fetchRanking(params: RankingParams = {}): Promise<RankingResponse> {
  return get<RankingResponse>("/api/ranking", params);
}

export function fetchCountry(
  iso3: string,
  params: RankingParams = {},
): Promise<CountryDetailResponse | null> {
  return fetch(`${API_BASE}/api/country/${iso3}${buildQuery(params)}`, {
    cache: "no-store",
  }).then(async (res) => {
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`country ${iso3} -> ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<CountryDetailResponse>;
  });
}

export function fetchClusters(
  params: RankingParams & { iso3?: string } = {},
): Promise<ClusterDrilldownResponse> {
  return get<ClusterDrilldownResponse>("/api/clusters", params);
}

export function fetchCoverage(params: RankingParams = {}): Promise<CoverageResponse> {
  return get<CoverageResponse>("/api/coverage", params);
}

export function exportCsvHref(params: RankingParams = {}): string {
  return `${API_BASE}/api/export.csv${buildQuery(params)}`;
}
