"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { CountryRow } from "@/lib/api-types";
import { numCompact, percent, usdCompact } from "@/lib/formatters";
import { mergeUrl } from "@/lib/url-state";

type Scatter = "a" | "b";

export function ScatterPanels({
  rows,
  active,
  focusIso,
}: {
  rows: CountryRow[];
  active: Scatter;
  focusIso: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setScatter(next: Scatter) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      scatter: next,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  function clickPoint(iso3: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      focus: iso3,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <header className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-semibold">
          {active === "a" ? "Scatter A — funding response" : "Scatter B — humanitarian situation"}
        </h2>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            className={
              "h-8 px-3 rounded text-xs " +
              (active === "a"
                ? "bg-accent text-accent-ink"
                : "text-text-muted hover:bg-surface-2")
            }
            onClick={() => setScatter("a")}
          >
            A: funding response
          </button>
          <button
            className={
              "h-8 px-3 rounded text-xs " +
              (active === "b"
                ? "bg-accent text-accent-ink"
                : "text-text-muted hover:bg-surface-2")
            }
            onClick={() => setScatter("b")}
          >
            B: humanitarian situation
          </button>
        </div>
      </header>
      {active === "a" ? (
        <ScatterA rows={rows} focusIso={focusIso} onClickPoint={clickPoint} />
      ) : (
        <ScatterB rows={rows} focusIso={focusIso} onClickPoint={clickPoint} />
      )}
      <p className="mt-2 text-[11px] italic text-text-muted">
        {active === "a"
          ? "What the funding-pipeline response looks like: acute gap against chronic history."
          : "What the on-the-ground situation looks like independent of funding response — absolute scale against proportional intensity. Severity is not in the MVP data; this view is built from PIN and population alone."}
      </p>
    </section>
  );
}

function ScatterA({
  rows,
  focusIso,
  onClickPoint,
}: {
  rows: CountryRow[];
  focusIso: string | null;
  onClickPoint: (iso3: string) => void;
}) {
  const data = rows.map((r) => ({
    iso3: r.iso3,
    country: r.country,
    x: 1 - Math.min(Math.max(r.coverage_ratio, 0), 1),
    y: r.chronic_years,
    z: Math.max(0.01, r.gap_score),
  }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            label={{ value: "Funding gap (1 − coverage)", position: "bottom", offset: 10, fontSize: 11 }}
            stroke="var(--text-muted)"
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            label={{ value: "Chronic years", angle: -90, position: "left", offset: 10, fontSize: 11 }}
            stroke="var(--text-muted)"
          />
          <ZAxis type="number" dataKey="z" range={[30, 400]} />
          <Tooltip content={<ScatterTip />} />
          <ReferenceLine x={0.5} stroke="var(--border)" strokeDasharray="4 4" />
          <ReferenceLine y={2.5} stroke="var(--border)" strokeDasharray="4 4" />
          <Scatter
            data={data}
            fill="var(--accent)"
            shape={(props: unknown) => {
              const p = props as { cx: number; cy: number; r?: number; payload?: { iso3?: string } };
              const cx = p.cx;
              const cy = p.cy;
              const r = p.r ?? 5;
              const isFocus = p.payload?.iso3 === focusIso;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={isFocus ? "var(--score-high)" : "var(--accent)"}
                  fillOpacity={isFocus ? 0.9 : 0.55}
                  stroke={isFocus ? "var(--score-high)" : "var(--accent)"}
                  strokeWidth={isFocus ? 2 : 1}
                  onClick={() => p.payload?.iso3 && onClickPoint(p.payload.iso3)}
                  style={{ cursor: "pointer" }}
                />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted mt-1">
        <div>top-left: <em>chronic only</em></div>
        <div className="text-right">top-right: <em>acute + chronic</em></div>
        <div>bottom-left: <em>well-funded</em></div>
        <div className="text-right">bottom-right: <em>acute only</em></div>
      </div>
    </div>
  );
}

function ScatterB({
  rows,
  focusIso,
  onClickPoint,
}: {
  rows: CountryRow[];
  focusIso: string | null;
  onClickPoint: (iso3: string) => void;
}) {
  const data = rows
    .filter((r) => r.pin > 0)
    .map((r) => ({
      iso3: r.iso3,
      country: r.country,
      x: Math.log10(Math.max(1, r.pin)),
      y: r.pin_share,
      z: Math.max(1, r.unmet_need_usd),
      pin: r.pin,
      unmet: r.unmet_need_usd,
    }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[4, 8]}
            ticks={[4, 5, 6, 7, 8]}
            tickFormatter={(v) => numCompact(10 ** v)}
            label={{
              value: "People in need (log scale)",
              position: "bottom",
              offset: 10,
              fontSize: 11,
            }}
            stroke="var(--text-muted)"
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            label={{
              value: "Share of population in need",
              angle: -90,
              position: "left",
              offset: 10,
              fontSize: 11,
            }}
            stroke="var(--text-muted)"
          />
          <ZAxis type="number" dataKey="z" range={[30, 400]} />
          <Tooltip content={<ScatterTipB />} />
          <Scatter
            data={data}
            shape={(props: unknown) => {
              const p = props as { cx: number; cy: number; r?: number; payload?: { iso3?: string } };
              const cx = p.cx;
              const cy = p.cy;
              const r = p.r ?? 5;
              const isFocus = p.payload?.iso3 === focusIso;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={isFocus ? "var(--score-high)" : "var(--accent)"}
                  fillOpacity={isFocus ? 0.9 : 0.55}
                  stroke={isFocus ? "var(--score-high)" : "var(--accent)"}
                  strokeWidth={isFocus ? 2 : 1}
                  onClick={() => p.payload?.iso3 && onClickPoint(p.payload.iso3)}
                  style={{ cursor: "pointer" }}
                />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted mt-1">
        <div>top-left: <em>small but proportionally crushed</em></div>
        <div className="text-right">top-right: <em>large AND proportionally severe</em></div>
        <div>bottom-left: <em>small and moderate</em></div>
        <div className="text-right">bottom-right: <em>large with moderate proportional burden</em></div>
      </div>
    </div>
  );
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: { country: string; x: number; y: number; z: number } }[] }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded border border-border bg-surface p-2 text-xs shadow-lg">
      <div className="font-semibold">{p.country}</div>
      <div>Funding gap: {percent(p.x)}</div>
      <div>Chronic years: {p.y}</div>
      <div>Gap score: {p.z.toFixed(3)}</div>
    </div>
  );
}

function ScatterTipB({ active, payload }: { active?: boolean; payload?: { payload: { country: string; pin: number; y: number; unmet: number } }[] }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded border border-border bg-surface p-2 text-xs shadow-lg">
      <div className="font-semibold">{p.country}</div>
      <div>PIN: {numCompact(p.pin)}</div>
      <div>Share: {percent(p.y)}</div>
      <div>Unmet: {usdCompact(p.unmet)}</div>
    </div>
  );
}
