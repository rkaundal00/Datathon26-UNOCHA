import type { CountryDetailResponse } from "@/lib/api-types";
import { numCompact, percent, usdCompact } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChronicDots } from "@/components/ui/score-bar";
import { QaFlagList } from "@/components/qa-flag";

export function BriefingNote({ detail }: { detail: CountryDetailResponse }) {
  const { country, briefing } = detail;
  const fact = briefing.fact_sheet;
  return (
    <Card aria-labelledby="briefing-heading">
      <CardHeader>
        <CardTitle id="briefing-heading">{country.country}</CardTitle>
        <CardDescription>
          {country.iso3} · HNO {country.hno_year} · {country.hrp_status}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="leading-relaxed" aria-live="polite">
          {briefing.lead}
        </p>

        <Separator />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Fact
            label="PIN"
            value={`${numCompact(fact.pin)} (${percent(fact.pin_share)})`}
          />
          <Fact label="Requirements" value={usdCompact(fact.requirements_usd)} />
          <Fact label="Funding" value={usdCompact(fact.funding_usd)} />
          <Fact
            label="Coverage"
            value={
              <>
                {percent(fact.coverage_ratio)}
                {fact.coverage_ratio > 1 && (
                  <span className="ml-1 text-amber-600">↑</span>
                )}
              </>
            }
          />
          <Fact label="Unmet need" value={usdCompact(fact.unmet_need_usd)} />
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
              <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                Top donors by commitment (HHI)
              </div>
              <div className="font-semibold tabular">
                {fact.donor_concentration.toFixed(3)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                HHI over all pledged, committed, and paid contributions — 2026
                only.
              </div>
            </div>
          )}
          {fact.cbpf_allocations_total_usd != null && (
            <Fact
              label="CBPF total (historical)"
              value={usdCompact(fact.cbpf_allocations_total_usd)}
            />
          )}
          <Fact
            label="Population"
            value={`${numCompact(fact.pin / fact.pin_share)} (ref ${country.population_reference_year})`}
          />
          <Fact label="HNO year" value={String(fact.hno_year)} />
        </dl>

        <Separator />

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Score decomposition
          </h3>
          <p className="text-xs mt-1">
            gap_score = (1 −{" "}
            <span className="tabular">
              {Math.min(country.coverage_ratio, 1).toFixed(3)}
            </span>
            ) × <span className="tabular">{country.pin_share.toFixed(3)}</span> ={" "}
            <strong className="tabular">{country.gap_score.toFixed(3)}</strong>
          </p>
          {country.custom_gap_score != null && detail.meta.weights && (
            <p className="text-xs mt-1 text-muted-foreground">
              custom_gap_score ={" "}
              {detail.meta.weights.w_coverage.toFixed(2)} · coverage_gap +{" "}
              {detail.meta.weights.w_pin.toFixed(2)} · pin_share +{" "}
              {detail.meta.weights.w_chronic.toFixed(2)} · chronic/5 ={" "}
              <strong className="text-foreground tabular">
                {country.custom_gap_score.toFixed(3)}
              </strong>
            </p>
          )}
        </div>

        {briefing.qualifiers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Qualifiers
            </h3>
            <ul className="text-xs mt-1 space-y-1 list-disc pl-5 text-muted-foreground">
              {briefing.qualifiers.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            QA flags
          </h3>
          <div className="mt-1">
            <QaFlagList flags={country.qa_flags} hideSeverity={false} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Grounding
          </h3>
          <ul className="text-[11px] mt-1 space-y-0.5 text-muted-foreground">
            {briefing.grounding.map((g, i) => (
              <li key={i}>· {g}</li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline">lead source: {briefing.lead_source}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
        {label}
      </dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  );
}
