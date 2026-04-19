"use client";

import type { CountryDetailResponse } from "@/lib/api-types";
import { numCompact, percent, usdCompact } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { ChronicDots } from "@/components/ui/score-bar";
import { QaFlagList } from "@/components/qa-flag";
import { useRouter, useSearchParams } from "next/navigation";
import { mergeUrl } from "@/lib/url-state";
import { ChartLine, Network, Users } from "lucide-react";

export function BriefingNote({ detail }: { detail: CountryDetailResponse }) {
  const { country, briefing } = detail;
  const fact = briefing.fact_sheet;
  const router = useRouter();
  const searchParams = useSearchParams();

  function openDetail(tab: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      detail: tab,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <section
      aria-labelledby="briefing-heading"
      className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3"
    >
      <header className="flex items-center justify-between">
        <h2 id="briefing-heading" className="text-lg font-semibold">
          {country.country}
        </h2>
        <div className="flex gap-1">
          <button 
            onClick={() => openDetail("trend")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 transition-colors border border-border rounded text-xs font-medium text-text-muted hover:text-text"
          >
            <ChartLine className="h-3.5 w-3.5" />
            <span>Open Trend Graph</span>
          </button>
        </div>
      </header>

      <p className="text-sm leading-relaxed text-text" aria-live="polite">
        {briefing.lead}
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Fact label="PIN" value={`${numCompact(fact.pin)} (${percent(fact.pin_share)})`} />
        <Fact label="Requirements" value={usdCompact(fact.requirements_usd)} />
        <Fact label="Funding" value={usdCompact(fact.funding_usd)} />
        <Fact
          label="Coverage"
          value={
            <>
              {percent(fact.coverage_ratio)}
            </>
          }
        />
        <Fact label="Funding gap" value={usdCompact(fact.unmet_need_usd)} />
        <Fact
          label="Chronic underfunding"
          value={
            <span className="inline-flex items-center gap-1">
              <ChronicDots value={fact.chronic_years} />
              <span>{fact.chronic_years}/5</span>
            </span>
          }
        />
        {fact.donor_concentration != null && (
          <div className="col-span-2">
            <div className="text-text-muted uppercase tracking-wider text-[10px]">
              Top donors by commitment (HHI)
            </div>
            <div className="font-semibold">{fact.donor_concentration.toFixed(3)}</div>
            <div className="text-[11px] text-text-muted">
              HHI over all pledged, committed, and paid contributions — 2026 only.
            </div>
          </div>
        )}
        {fact.cbpf_allocations_total_usd != null && (
          <Fact label="CBPF total (historical)" value={usdCompact(fact.cbpf_allocations_total_usd)} />
        )}
        <Fact label="Population" value={`${numCompact(fact.pin / fact.pin_share)} (${country.population_reference_year})`} />
        <Fact label="HNO year" value={String(fact.hno_year)} />
      </dl>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">How the gap score is calculated</h3>
        <div className="text-xs space-y-3">
          <div className="border-l-2 border-border pl-3">
            <div className="font-medium mb-1">Default Score (Multiplicative)</div>
            <ul className="text-text-muted space-y-1">
              <li className="flex justify-between items-center gap-4">
                <span>Funding shortfall (100% - coverage)</span>
                <span className="tabular">{(1 - Math.min(country.coverage_ratio, 1)).toFixed(3)}</span>
              </li>
              <li className="flex justify-between items-center gap-4">
                <span>× Share of global need (PIN share)</span>
                <span className="tabular">{country.pin_share.toFixed(3)}</span>
              </li>
              <li className="flex justify-between items-center gap-4 font-semibold text-text pt-1 mt-1 border-t border-border">
                <span>Resulting Score</span>
                <span className="tabular">{country.gap_score.toFixed(3)}</span>
              </li>
            </ul>
          </div>
          {country.custom_gap_score != null && detail.meta.weights && (
            <div className="border-l-2 border-border pl-3 mt-3">
              <div className="font-medium mb-1">Custom Score (Weighted Average)</div>
              <ul className="text-text-muted space-y-1">
                <li className="flex justify-between items-center gap-4">
                  <span>Coverage gap (weight: {detail.meta.weights.w_coverage.toFixed(2)})</span>
                  <span className="tabular">{(detail.meta.weights.w_coverage * (1 - Math.min(country.coverage_ratio, 1))).toFixed(3)}</span>
                </li>
                <li className="flex justify-between items-center gap-4">
                  <span>+ Needs scale (weight: {detail.meta.weights.w_pin.toFixed(2)})</span>
                  <span className="tabular">{(detail.meta.weights.w_pin * country.pin_share).toFixed(3)}</span>
                </li>
                <li className="flex justify-between items-center gap-4">
                  <span>+ Chronic neglect (weight: {detail.meta.weights.w_chronic.toFixed(2)})</span>
                  <span className="tabular">{(detail.meta.weights.w_chronic * (fact.chronic_years / 5)).toFixed(3)}</span>
                </li>
                <li className="flex justify-between items-center gap-4 font-semibold text-text pt-1 mt-1 border-t border-border">
                  <span>Resulting Score</span>
                  <span className="tabular">{country.custom_gap_score.toFixed(3)}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {briefing.qualifiers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Qualifiers</h3>
          <ul className="text-xs mt-1 space-y-1 list-disc pl-5 text-text-muted">
            {briefing.qualifiers.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">QA flags</h3>
        <div className="mt-1">
          <QaFlagList flags={country.qa_flags} hideSeverity={false} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Grounding</h3>
        <ul className="text-[11px] mt-1 space-y-0.5 text-text-muted">
          {briefing.grounding.map((g, i) => (
            <li key={i}>· {g}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text-muted uppercase tracking-wider text-[10px]">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  );
}
