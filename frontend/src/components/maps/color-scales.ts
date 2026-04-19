import { interpolateRgb, interpolateRgbBasis } from "d3-interpolate";
import { scaleLog, scaleSequential } from "d3-scale";
import type { HRPStatus } from "@/lib/api-types";
import type { MapMetric } from "@/lib/url-state";
import type { MapRow } from "./map-data";

export const PALETTE = {
  teal0: "#e8f1ef",
  teal1: "#a8cdc7",
  teal2: "#6fa7a0",
  teal3: "#3c6b64",
  rose1: "#9b6b78",
  rose2: "#8a3d54",
  cream: "#f4ede3",
  excluded: "#e5e4e2",
} as const;

const SEQ_ANCHORS = [PALETTE.teal0, PALETTE.teal1, PALETTE.teal2, PALETTE.rose1, PALETTE.rose2];

const gapColor = scaleSequential(interpolateRgbBasis(SEQ_ANCHORS)).domain([0, 1]).clamp(true);
const pinShareColor = scaleSequential(interpolateRgbBasis(SEQ_ANCHORS)).domain([0, 0.25]).clamp(true);
const chronicColor = scaleSequential(interpolateRgbBasis(SEQ_ANCHORS)).domain([0, 5]).clamp(true);

const coverageLow = interpolateRgb(PALETTE.rose2, PALETTE.cream);
const coverageHigh = interpolateRgb(PALETTE.cream, PALETTE.teal2);
function coverageColor(r: number): string {
  const v = Math.max(0, Math.min(2, r));
  return v < 1 ? coverageLow(v) : coverageHigh(v - 1);
}

const pinLogColor = scaleLog<string>()
  .domain([3e5, 2e8])
  .range([PALETTE.teal1, PALETTE.teal3])
  .interpolate(interpolateRgb)
  .clamp(true);

const HRP_STATUS_COLOR: Record<HRPStatus, string> = {
  HRP: PALETTE.teal2,
  FlashAppeal: "#c48a75",
  RegionalRP: "#8b99b3",
  Other: "#b8a488",
  Unknown: "#a89fb0",
  None: PALETTE.excluded,
};

export function colorForRow(metric: MapMetric, row: MapRow): string {
  if (!row.inCohort) return PALETTE.excluded;
  switch (metric) {
    case "gap_score":
      return gapColor(row.gap_score ?? 0);
    case "coverage_ratio":
      return coverageColor(row.coverage_ratio ?? 0);
    case "pin":
      return row.pin && row.pin > 0 ? pinLogColor(row.pin) : PALETTE.excluded;
    case "pin_share":
      return pinShareColor(row.pin_share ?? 0);
    case "chronic_years":
      return chronicColor(row.chronic_years ?? 0);
    case "hrp_status":
      return row.hrp_status ? HRP_STATUS_COLOR[row.hrp_status] : PALETTE.excluded;
  }
}

export function metricLabel(metric: MapMetric): string {
  return {
    gap_score: "Gap score",
    coverage_ratio: "Coverage",
    pin: "People in need",
    pin_share: "Share of global PIN",
    chronic_years: "Chronic years",
    hrp_status: "Plan type",
  }[metric];
}

export interface LegendStop { offset: number; color: string; label?: string }

export function legendStopsFor(metric: MapMetric): {
  kind: "sequential" | "diverging" | "log" | "categorical";
  stops: LegendStop[];
  domain: [number, number] | null;
  categories?: { key: string; label: string; color: string }[];
} {
  switch (metric) {
    case "gap_score":
      return {
        kind: "sequential",
        domain: [0, 1],
        stops: [0, 0.25, 0.5, 0.75, 1].map((t) => ({ offset: t, color: gapColor(t) })),
      };
    case "pin_share":
      return {
        kind: "sequential",
        domain: [0, 0.25],
        stops: [0, 0.0625, 0.125, 0.1875, 0.25].map((t) => ({ offset: t / 0.25, color: pinShareColor(t) })),
      };
    case "chronic_years":
      return {
        kind: "sequential",
        domain: [0, 5],
        stops: [0, 1, 2, 3, 4, 5].map((t) => ({ offset: t / 5, color: chronicColor(t) })),
      };
    case "coverage_ratio":
      return {
        kind: "diverging",
        domain: [0, 2],
        stops: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((v) => ({
          offset: v / 2,
          color: coverageColor(v),
        })),
      };
    case "pin":
      return {
        kind: "log",
        domain: [3e5, 2e8],
        stops: [3e5, 1e6, 1e7, 5e7, 2e8].map((v, i, arr) => ({
          offset: i / (arr.length - 1),
          color: pinLogColor(v),
        })),
      };
    case "hrp_status":
      return {
        kind: "categorical",
        domain: null,
        stops: [],
        categories: [
          { key: "HRP", label: "HRP", color: HRP_STATUS_COLOR.HRP },
          { key: "FlashAppeal", label: "Flash Appeal", color: HRP_STATUS_COLOR.FlashAppeal },
          { key: "RegionalRP", label: "Regional RP", color: HRP_STATUS_COLOR.RegionalRP },
          { key: "Other", label: "Other", color: HRP_STATUS_COLOR.Other },
          { key: "Unknown", label: "Unknown", color: HRP_STATUS_COLOR.Unknown },
        ],
      };
  }
}
