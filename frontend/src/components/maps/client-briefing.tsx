"use client";

import { useEffect, useState } from "react";
import type { CountryDetailResponse } from "@/lib/api-types";
import { EXCLUSION_LABEL } from "@/lib/api-types";
import { fetchCountry } from "@/lib/api";
import { BriefingNote } from "@/components/briefing-note";
import type { RankingParams } from "@/lib/api";
import type { MapRow } from "./map-data";

export function ClientBriefing({
  iso3,
  params,
  fallbackRow,
}: {
  iso3: string | null;
  params: RankingParams;
  fallbackRow: MapRow | null;
}) {
  const [data, setData] = useState<CountryDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!iso3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCountry(iso3, params)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso3, params.analysis_year, params.pin_floor, params.require_hrp, params.mode, params.weights, params.flags]);

  if (!iso3) {
    return (
      <section className="rounded-xl border border-border bg-surface/70 p-5 text-[13px] text-text-muted backdrop-blur">
        Hover a country for a quick read; click to pin its briefing here.
      </section>
    );
  }

  if (loading) return <Skeleton iso3={iso3} />;

  if (data) return <BriefingNote detail={data} />;

  if (fallbackRow && !fallbackRow.inCohort) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
        <header className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{fallbackRow.country}</h2>
          <span className="font-mono text-[11px] text-text-muted">{fallbackRow.iso3}</span>
        </header>
        <div className="inline-flex h-5 w-fit items-center rounded-full bg-foreground/5 px-2 text-[11px] font-medium text-text-muted">
          Not in cohort
        </div>
        {fallbackRow.exclusionReason && (
          <p className="text-[13px] leading-relaxed text-text">
            <span className="font-medium">{EXCLUSION_LABEL[fallbackRow.exclusionReason]}.</span>
            {fallbackRow.exclusionDetail && (
              <span className="text-text-muted"> {fallbackRow.exclusionDetail}</span>
            )}
          </p>
        )}
      </section>
    );
  }

  const displayName = fallbackRow?.country ?? iso3;

  if (error) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 text-[13px] text-text-muted">
        Couldn&apos;t load briefing for {displayName}. {error}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{displayName}</h2>
        <span className="font-mono text-[11px] text-text-muted">{iso3}</span>
      </header>
      <p className="text-[13px] text-text-muted">
        No briefing available — this country is outside the HNO / HRP tracking cohort for this year.
      </p>
    </section>
  );
}

function Skeleton({ iso3 }: { iso3: string }) {
  return (
    <section
      aria-busy="true"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-baseline justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-map-teal-0" />
        <span className="font-mono text-[11px] text-text-muted">{iso3}</span>
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-map-teal-0/70" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-map-teal-0/70" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-map-teal-0/50" />
        ))}
      </div>
    </section>
  );
}
