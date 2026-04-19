"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendSeries } from "@/lib/api-types";
import { usdCompact } from "@/lib/formatters";

export function TrendView({
  trend,
  year,
}: {
  trend: TrendSeries;
  year: number;
}) {
  const data = trend.years.map((y, i) => ({
    year: y,
    requirements: trend.requirements_usd[i],
    funding: trend.funding_usd[i],
    chronicMark: trend.chronic_markers[i],
  }));
  const inset = year === 2026 && trend.inset_2026 ? trend.inset_2026 : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} />
            <YAxis tickFormatter={(v: number) => usdCompact(v)} stroke="var(--text-muted)" fontSize={11} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const req = payload.find((p) => p.dataKey === "requirements")?.value as number | undefined;
                const fund = payload.find((p) => p.dataKey === "funding")?.value as number | undefined;
                const isChronic = payload[0]?.payload?.chronicMark;
                return (
                  <div className="rounded border border-border bg-surface p-2 text-xs shadow z-50">
                    <div className="font-semibold mb-1">{label}</div>
                    {req != null && <div>Requirements: {usdCompact(req)}</div>}
                    {fund != null && <div>Funding: {usdCompact(fund)}</div>}
                    {req != null && fund != null && (
                      <div>Coverage: {Math.round((fund / req) * 100)}%</div>
                    )}
                    {isChronic && (
                      <div className="mt-1 pt-1 border-t border-border text-score-high font-semibold flex items-center gap-1">
                        ✖ Chronic Gap (&lt;50%)
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="requirements"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: { chronicMark: boolean } };
                if (!payload.chronicMark) return <circle cx={cx} cy={cy} r={2} fill="var(--accent)" />;
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={3} fill="var(--score-high)" />
                    <text x={cx} y={cy - 8} textAnchor="middle" fontSize={10} fill="var(--score-high)">
                      ✖
                    </text>
                  </g>
                );
              }}
              connectNulls
              name="Requested ($)"
            />
            <Line
              type="monotone"
              dataKey="funding"
              stroke="var(--score-low)"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 2 }}
              connectNulls
              name="Total Funding ($)"
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-xs text-text-muted px-2 flex items-center gap-2">
        <span className="text-score-high font-bold">✖</span> 
        Indicates a chronically underfunded year (&lt; 50% coverage)
      </div>

      {inset && (
        <div className="rounded border border-border bg-surface-2 p-3 mt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            2026 flows — transaction-level (inset)
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Chip label="paid" value={inset.paid_usd} tone="emerald" />
            <Chip label="commitment" value={inset.commitment_usd} tone="sky" />
            <Chip label="pledged" value={inset.pledged_usd} tone="amber" />
            <Chip label="unmet" value={inset.unmet_usd} tone="rose" />
          </div>
          <p className="mt-2 text-[11px] italic text-text-muted">
            Transaction-level 2026 data is not directly comparable across years; pre-2026 shows only aggregate funding.
          </p>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "amber" | "rose";
}) {
  const bg = {
    emerald: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    sky: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
    amber: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  }[tone];
  return (
    <span className={"inline-flex items-center gap-1.5 rounded px-2 py-1 " + bg}>
      <span className="uppercase text-[10px] tracking-wider font-semibold">{label}</span>
      <span className="tabular font-semibold">{usdCompact(value)}</span>
    </span>
  );
}
