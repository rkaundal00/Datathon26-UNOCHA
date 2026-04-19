"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { feature } from "topojson-client";
import { ArrowLeft } from "lucide-react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { numericToIso3 } from "@/lib/iso-map";
import { CountryDetailSheet } from "@/components/country-detail-sheet";
import { parseUrlState } from "@/lib/url-state";
import type { AnalysisYear, RankingMeta } from "@/lib/api-types";
import type { MapMetric } from "@/lib/url-state";
import { mergeUrl } from "@/lib/url-state";
import type { RankingParams } from "@/lib/api";
import { MetricSelector } from "./metric-selector";
import { YearPicker } from "./year-picker";
import { TopTenPanel } from "./top-ten-panel";
import { ClientBriefing } from "./client-briefing";
import { SectorChip } from "@/components/sector-chip";
import type { MapRow } from "./map-data";
import { legendStopsFor, metricLabel, PALETTE } from "./color-scales";
import type { MapHandle } from "./world-choropleth";

const WorldChoropleth = dynamic(
  () => import("./world-choropleth").then((m) => m.WorldChoropleth),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-full w-full animate-pulse rounded-xl border border-border bg-gradient-to-b from-surface to-surface-2" />
    ),
  },
);

const MAP_HEIGHT = "clamp(520px, calc(100vh - 220px), 760px)";

// Shift longitudes in rings that straddle the antimeridian so Leaflet draws the
// polygon without connecting lines across the whole world (fixes Russia's strips).
function normalizeRing(ring: number[][]): number[][] {
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const pt of ring) {
    const lng = pt[0];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (maxLng - minLng > 180) {
    return ring.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat]);
  }
  return ring;
}

function normalizeGeometry(g: Geometry): Geometry {
  if (g.type === "Polygon") {
    return {
      ...g,
      coordinates: g.coordinates.map((ring) => normalizeRing(ring as number[][])),
    };
  }
  if (g.type === "MultiPolygon") {
    return {
      ...g,
      coordinates: g.coordinates.map((poly) =>
        poly.map((ring) => normalizeRing(ring as number[][])),
      ),
    };
  }
  return g;
}

function normalizeFeatures(fc: FeatureCollection): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f: Feature<Geometry>) => ({
      ...f,
      geometry: f.geometry ? (normalizeGeometry(f.geometry) as Geometry) : f.geometry,
    })),
  };
}

export function MapsView({
  year,
  metric,
  focusIso,
  rows: rowsArray,
  meta,
  apiParams,
}: {
  year: AnalysisYear;
  metric: MapMetric;
  focusIso: string | null;
  rows: MapRow[];
  meta: RankingMeta;
  apiParams: RankingParams;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [features, setFeatures] = useState<FeatureCollection | null>(null);
  const mapRef = useRef<MapHandle>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries-110m.json")
      .then((r) => r.json())
      .then((topo: Topology<{ countries: GeometryCollection }>) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
        setFeatures(normalizeFeatures(fc));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const m = new Map<string, MapRow>();
    for (const r of rowsArray) m.set(r.iso3, r);
    return m;
  }, [rowsArray]);

  // Extend with every feature's English name so any clicked country has a display name.
  const rowsWithNames = useMemo(() => {
    if (!features) return rows;
    const merged = new Map(rows);
    for (const f of features.features) {
      const iso3 = numericToIso3(f.id as string | number);
      if (!iso3 || merged.has(iso3)) continue;
      const name = ((f.properties ?? {}) as { name?: string }).name ?? iso3;
      merged.set(iso3, { iso3, country: name, inCohort: false });
    }
    return merged;
  }, [rows, features]);

  function setFocus(iso3: string | null) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), { focus: iso3 });
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    if (iso3) mapRef.current?.panToIso3(iso3);
  }

  const fallbackRow = focusIso ? rowsWithNames.get(focusIso) ?? null : null;
  const cohortCount = rowsArray.filter((r) => r.inCohort).length;

  const sectorName = meta.sector
    ? meta.available_sectors.find((s) => s.code === meta.sector)?.name ?? meta.sector
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            World view · <span className="text-text-muted font-normal">
              {sectorName ? `${sectorName} — ` : ""}{metricLabel(metric)}
            </span>
          </h1>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {cohortCount} countries in cohort ({year})
            {sectorName && <> under <strong className="text-text">{sectorName}</strong></>} ·{" "}
            {meta.excluded_count} excluded · hover to read, click to pin
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SectorChip
            value={meta.sector}
            options={meta.available_sectors}
            onChange={(code) => {
              const base: Record<string, string | null> = { sector: code, sort: null };
              if (code && meta.mode === "structural") base.mode = "acute";
              const qs = mergeUrl(new URLSearchParams(searchParams.toString()), base);
              router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
            }}
          />
          <MetricSelector value={metric} sectorActive={Boolean(sectorName)} />
          <YearPicker value={year} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="flex flex-col gap-3 lg:col-span-8">
          <div className="relative" style={{ height: MAP_HEIGHT }}>
            {features ? (
              <WorldChoropleth
                ref={mapRef}
                features={features}
                rows={rowsWithNames}
                metric={metric}
                focusIso={focusIso}
                onSelect={setFocus}
              />
            ) : (
              <div className="h-full w-full animate-pulse rounded-xl border border-border bg-gradient-to-b from-surface to-surface-2" />
            )}
          </div>

          <Legend metric={metric} />
        </section>

        <aside className="flex min-h-0 flex-col lg:col-span-4" style={{ height: MAP_HEIGHT }}>
          {focusIso ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-surface/60 p-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setFocus(null)}
                className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 text-[11px] font-medium text-text-muted transition-colors hover:bg-foreground/5 hover:text-text"
              >
                <ArrowLeft className="h-3 w-3" strokeWidth={2.25} />
                Back to Top 10
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <ClientBriefing iso3={focusIso} params={apiParams} fallbackRow={fallbackRow} />
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <TopTenPanel rows={rowsWithNames} metric={metric} focusIso={focusIso} onSelect={setFocus} />
            </div>
          )}
        </aside>
      </div>

      <CountryDetailSheet
        focusIso={focusIso}
        openTab={parseUrlState(Object.fromEntries(searchParams.entries())).detail}
        params={apiParams}
      />
    </div>
  );
}

function Legend({ metric }: { metric: MapMetric }) {
  const l = legendStopsFor(metric);
  if (l.kind === "categorical" && l.categories) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-[11px] text-text-muted backdrop-blur">
        <span className="font-semibold uppercase tracking-wider">{metricLabel(metric)}</span>
        {l.categories.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-inset ring-black/5"
              style={{ background: c.color }}
            />
            <span className="text-text">{c.label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-inset ring-black/5"
            style={{ background: PALETTE.excluded }}
          />
          <span>Excluded / out of scope</span>
        </span>
      </div>
    );
  }
  const gradient = `linear-gradient(to right, ${l.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ")})`;
  const [lo, hi] = l.domain ?? [0, 1];
  const fmt = (v: number) =>
    metric === "coverage_ratio" || metric === "pin_share" ? `${Math.round(v * 100)}%` : formatDomain(metric, v);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-3 py-2 text-[11px] text-text-muted backdrop-blur">
      <span className="font-semibold uppercase tracking-wider">{metricLabel(metric)}</span>
      <span className="tabular-nums">{fmt(lo)}</span>
      <div className="h-2 flex-1 rounded-full ring-1 ring-inset ring-black/5" style={{ background: gradient }} />
      <span className="tabular-nums">{fmt(hi)}</span>
      <span className="inline-flex items-center gap-1.5 border-l border-border pl-3">
        <span
          className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-inset ring-black/5"
          style={{ background: PALETTE.excluded }}
        />
        <span>Excluded</span>
      </span>
    </div>
  );
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
function formatDomain(metric: MapMetric, v: number): string {
  switch (metric) {
    case "pin":
      return compact.format(v);
    case "chronic_years":
      return String(v);
    default:
      return v.toFixed(2);
  }
}
