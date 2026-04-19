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

export function ScatterPanels({
  rows,
  focusIso,
}: {
  rows: CountryRow[];
  focusIso: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function clickPoint(iso3: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      focus: iso3,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  // Use PIN (log scale) as "Level of Need" and INFORM Severity as "Severity Proxy"
  const data = rows
    .filter((r) => r.pin > 0 && r.inform_severity != null)
    .map((r) => ({
      iso3: r.iso3,
      country: r.country,
      x: Math.log10(Math.max(1, r.pin)),
      y: r.inform_severity!,
      z: Math.max(1, r.unmet_need_usd),
      pin: r.pin,
      unmet: r.unmet_need_usd,
    }));

  // Calculate medians to create dynamic 4-quadrant crosshairs
  const sortedX = [...data].sort((a, b) => a.x - b.x);
  const sortedY = [...data].sort((a, b) => a.y - b.y);
  
  const medianX = sortedX.length > 0 ? sortedX[Math.floor(sortedX.length / 2)].x : 6;
  const medianY = sortedY.length > 0 ? sortedY[Math.floor(sortedY.length / 2)].y : 5.0;

  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <header className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-semibold">
          Crisis Compass: Need vs. Severity
        </h2>
      </header>

      <div className="h-80 relative">
        {/* Quadrant background colors (optional) or just rely on crosshairs */}
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 30 }} accessibilityLayer={false} style={{ outline: "none" }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis
              type="number"
              dataKey="x"
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tickFormatter={(v) => numCompact(10 ** v)}
              label={{
                value: "Level of Need (Absolute PIN, log scale)",
                position: "bottom",
                offset: 10,
                fontSize: 11,
              }}
              stroke="var(--text-muted)"
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 10]}
              tickFormatter={(v) => v.toFixed(1)}
              label={{
                value: "INFORM Severity Index (0-10)",
                angle: -90,
                position: "left",
                offset: 10,
                fontSize: 11,
              }}
              stroke="var(--text-muted)"
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} />
            <Tooltip content={<CompassTooltip />} cursor={false} isAnimationActive={false} />
            
            {/* The Crosshairs creating the 4 Quadrants */}
            <ReferenceLine x={medianX} stroke="var(--text-muted)" strokeWidth={1} />
            <ReferenceLine y={medianY} stroke="var(--text-muted)" strokeWidth={1} />

            <Scatter
              data={data}
              activeShape={false}
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
                    fillOpacity={isFocus ? 0.9 : 0.6}
                    stroke={isFocus ? "var(--score-high)" : "var(--accent)"}
                    strokeWidth={isFocus ? 2 : 1}
                    onClick={() => p.payload?.iso3 && clickPoint(p.payload.iso3)}
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
        
        {/* Quadrant Labels overlay */}
        <div className="absolute top-2 left-25 text-[10px] font-medium text-text-muted opacity-60">
          High Severity,<br />Lower Absolute Need
        </div>
        <div className="absolute top-2 right-4 text-right text-[10px] font-medium text-text-muted opacity-60">
          High Severity &<br />High Absolute Need
        </div>
        <div className="absolute bottom-20 left-25 text-[10px] font-medium text-text-muted opacity-60">
          Lower Severity,<br />Lower Absolute Need
        </div>
        <div className="absolute bottom-20 right-4 text-right text-[10px] font-medium text-text-muted opacity-60">
          Lower Severity,<br />High Absolute Need
        </div>
      </div>
      
      <p className="mt-4 text-[11px] italic text-text-muted">
        Quadrant crosshairs are dynamically centered on the median of the current views dataset group. Severity is estimated using the INFORM Severity Index (March 2026 dataset). Countries missing severity data are excluded from this view.
      </p>
    </section>
  );
}

function CompassTooltip({ active, payload }: { active?: boolean; payload?: { payload: { country: string; pin: number; y: number; unmet: number } }[] }) {
  const show = active && payload && payload.length > 0;
  const p = show ? payload![0].payload : null;
  return (
    <div
      className="rounded border border-border bg-surface p-2 text-xs shadow-lg transition-opacity duration-400"
      style={{ opacity: show ? 1 : 0 }}
    >
      {p && (
        <>
          <div className="font-semibold border-b border-border pb-1 mb-1">{p.country}</div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <span className="text-text-muted">Level of Need (PIN):</span>
            <span className="font-medium">{numCompact(p.pin)}</span>
            <span className="text-text-muted">INFORM Severity:</span>
            <span className="font-medium">{p.y.toFixed(1)}/10</span>
            <span className="text-text-muted">Unmet Need:</span>
            <span className="font-medium">{usdCompact(p.unmet)}</span>
          </div>
        </>
      )}
    </div>
  );
}
