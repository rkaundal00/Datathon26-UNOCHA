"use client";

import type { MapMetric } from "@/lib/url-state";
import { formatMetricValue, topTen, type MapRow } from "./map-data";
import { colorForRow, metricLabel } from "./color-scales";

export function TopTenPanel({
  rows,
  metric,
  focusIso,
  onSelect,
}: {
  rows: Map<string, MapRow>;
  metric: MapMetric;
  focusIso: string | null;
  onSelect: (iso3: string) => void;
}) {
  const top = topTen(rows, metric);

  return (
    <section
      aria-label={`Top by ${metricLabel(metric)}`}
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface/70 p-3 backdrop-blur"
    >
      <header className="flex items-baseline justify-between px-1 pb-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Top 10 · {metricLabel(metric)}
        </h2>
        <span className="text-[10px] text-text-muted">{top.length}</span>
      </header>
      <ol className="flex flex-col gap-0.5">
        {top.map((r, i) => {
          const active = focusIso === r.iso3;
          return (
            <li key={r.iso3}>
              <button
                type="button"
                onClick={() => onSelect(r.iso3)}
                className={[
                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                  active ? "bg-foreground/5" : "hover:bg-foreground/5",
                ].join(" ")}
              >
                <span className="w-4 text-right text-[10px] tabular-nums text-text-muted">
                  {i + 1}
                </span>
                <span
                  aria-hidden
                  className="h-3 w-3 flex-shrink-0 rounded-[3px] ring-1 ring-inset ring-black/5"
                  style={{ background: colorForRow(metric, r) }}
                />
                <span className="flex-1 truncate font-medium">{r.country}</span>
                <span className="font-mono text-[10px] text-text-muted">{r.iso3}</span>
                <span className="w-14 text-right font-semibold tabular-nums">
                  {formatMetricValue(metric, r)}
                </span>
              </button>
            </li>
          );
        })}
        {top.length === 0 && (
          <li className="px-2 py-4 text-center text-[12px] text-text-muted">
            No countries in cohort.
          </li>
        )}
      </ol>
    </section>
  );
}
