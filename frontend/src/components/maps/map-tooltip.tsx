"use client";

import type { MapMetric } from "@/lib/url-state";
import { EXCLUSION_LABEL } from "@/lib/api-types";
import { formatMetricValue } from "./map-data";
import { metricLabel } from "./color-scales";
import type { MapRow } from "./map-data";

export interface TooltipState {
  row: MapRow | null;
  unknownIso?: string;
  unknownName?: string;
  x: number;
  y: number;
}

export function MapTooltip({
  state,
  metric,
}: {
  state: TooltipState | null;
  metric: MapMetric;
}) {
  if (!state) return null;
  const { row, unknownName, x, y } = state;
  const name = row?.country ?? unknownName ?? "Unknown";

  return (
    <div
      style={{
        left: x + 12,
        top: y + 12,
        background: "var(--tooltip-bg)",
        borderColor: "var(--tooltip-border)",
        boxShadow: "var(--tooltip-shadow)",
      }}
      className="pointer-events-none absolute z-30 max-w-xs rounded-lg border px-3 py-2 text-[12px] leading-tight backdrop-blur-md"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold tracking-tight">{name}</span>
        {row?.iso3 && (
          <span className="font-mono text-[10px] text-text-muted">{row.iso3}</span>
        )}
      </div>

      {row?.inCohort && (
        <div className="mt-1.5 flex items-baseline justify-between gap-4">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            {metricLabel(metric)}
          </span>
          <span className="tabular-nums font-semibold">{formatMetricValue(metric, row)}</span>
        </div>
      )}

      {row?.inCohort ? (
        <div className="mt-1 inline-flex h-4 items-center rounded-full bg-map-teal-2/20 px-2 text-[10px] font-medium text-map-teal-3">
          In cohort
        </div>
      ) : row?.exclusionReason ? (
        <div className="mt-1 text-[11px] text-text-muted">
          <div className="font-medium text-text">{EXCLUSION_LABEL[row.exclusionReason]}</div>
          {row.exclusionDetail && <div className="mt-0.5">{row.exclusionDetail}</div>}
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-text-muted">Not in scope</div>
      )}
    </div>
  );
}
