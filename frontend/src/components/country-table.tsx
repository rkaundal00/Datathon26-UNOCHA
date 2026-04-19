"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment } from "react";
import type { CountryRow, RankingMeta } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { numCompact, percent, usdCompact } from "@/lib/formatters";
import { COLUMN_META, type ColumnKey } from "@/lib/columns";
import { ChronicDots, ScoreBar } from "@/components/ui/score-bar";
import { QaFlagList } from "@/components/qa-flag";
import { Badge } from "@/components/ui/badge";
import { mergeUrl } from "@/lib/url-state";
import { HeaderCell } from "@/components/table/header-cell";
import { ZeroCell } from "@/components/table/zero-cell";
import { ConfidenceGlyph } from "@/components/table/confidence-glyph";
import { Tooltip } from "@/components/ui/tooltip";
import {
  CoverageValueTooltip,
  GapScoreValueTooltip,
  PinShareValueTooltip,
  PinValueTooltip,
  UnmetValueTooltip,
} from "@/components/table/value-tooltip";
import { PLAN_COPY } from "@/lib/help-copy";

type Align = "left" | "right" | "center";

interface ColumnSpec {
  key: ColumnKey;
  align: Align;
}

const BASE_COLS: ColumnSpec[] = [
  { key: "country", align: "left" },
  { key: "pin", align: "right" },
  { key: "pin_share", align: "right" },
  { key: "coverage_ratio", align: "right" },
  { key: "unmet_need_usd", align: "right" },
  { key: "gap_score", align: "right" },
];

const TAIL_COLS: ColumnSpec[] = [
  { key: "chronic_years", align: "center" },
  { key: "hrp_status", align: "left" },
  { key: "qa_flags", align: "left" },
];

export function CountryTable({
  meta,
  rows,
  focusIso,
}: {
  meta: RankingMeta;
  rows: CountryRow[];
  focusIso: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasCustom = rows[0]?.custom_gap_score != null;

  const cols: ColumnSpec[] = hasCustom
    ? [...BASE_COLS, { key: "custom_gap_score", align: "right" }, ...TAIL_COLS]
    : [...BASE_COLS, ...TAIL_COLS];

  function clickRow(iso3: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      focus: iso3,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  function clickSort(key: string) {
    const col = COLUMN_META[key as ColumnKey];
    if (!col?.sortable) return;
    const nextDir = meta.sort === key && meta.sort_dir === "desc" ? "asc" : "desc";
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      sort: key,
      sort_dir: nextDir,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  const sectorName = meta.sector
    ? meta.available_sectors.find((s) => s.code === meta.sector)?.name ?? meta.sector
    : null;

  return (
    <section id="country-table" className="rounded-lg border border-border bg-surface">
      {sectorName && (
        <div className="border-b border-border bg-accent/5 px-3 py-1.5 text-xs">
          <span className="text-text-muted">Viewing:</span>{" "}
          <strong className="text-text">{sectorName}</strong>
          <span className="text-text-muted"> — PIN, coverage and unmet reflect this sector only.</span>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-text-muted">
        <span>
          Sorted by: <strong className="text-text">{meta.sort}</strong> ·{" "}
          <em>{meta.sort_dir}</em>
          {meta.weights && (
            <>
              {" · "}
              weights: coverage {Math.round(meta.weights.w_coverage * 100)}% · pin{" "}
              {Math.round(meta.weights.w_pin * 100)}% · chronic{" "}
              {Math.round(meta.weights.w_chronic * 100)}%
            </>
          )}
        </span>
        <span>{rows.length} rows · analysis year {meta.analysis_year}</span>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[50vh] relative">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-text-muted z-10">
            <tr>
              {cols.map((c) => (
                <HeaderCell
                  key={c.key}
                  col={COLUMN_META[c.key]}
                  sortKey={meta.sort}
                  sortDir={meta.sort_dir}
                  onSort={() => clickSort(c.key)}
                  analysisYear={meta.analysis_year}
                  align={c.align}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const isFocused = focusIso === row.iso3;
              const s = row.sector;
              const vPin = s ? s.pin_cluster : row.pin;
              const vPinShare = s ? s.cluster_pin_share : row.pin_share;
              const vCoverage = s ? s.cluster_coverage_ratio : row.coverage_ratio;
              const vReq = s ? s.cluster_requirements_usd : row.requirements_usd;
              const vFun = s ? s.cluster_funding_usd : row.funding_usd;
              const vUnmet = s ? s.cluster_unmet_need_usd : row.unmet_need_usd;
              const vGap = s ? s.cluster_gap_score : row.gap_score;
              const rowFlags = s ? [...row.qa_flags, ...s.qa_flags] : row.qa_flags;
              return (
                <Fragment key={row.iso3}>
                  <tr
                    onClick={() => clickRow(row.iso3)}
                    className={cn(
                      "cursor-pointer hover:bg-surface-2 tabular",
                      isFocused && "bg-surface-2 border-l-[3px] border-l-accent",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-semibold">{row.country}</span>
                        <span className="text-[11px] text-text-muted">{row.iso3}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center">
                        <PinValueTooltip pin={vPin} year={row.hno_year}>
                          {numCompact(vPin)}
                        </PinValueTooltip>
                        <ConfidenceGlyph col={COLUMN_META.pin} row={row} />
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center">
                        <PinShareValueTooltip
                          pin={vPin}
                          population={row.population}
                          popYear={row.population_reference_year}
                        >
                          {percent(vPinShare)}
                        </PinShareValueTooltip>
                        <ConfidenceGlyph col={COLUMN_META.pin_share} row={row} />
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center">
                        <ZeroCell row={row} kind="coverage">
                          <CoverageValueTooltip
                            requirements={vReq}
                            funding={vFun}
                            year={row.analysis_year}
                          >
                            <span>
                              {percent(vCoverage)}
                            </span>
                          </CoverageValueTooltip>
                        </ZeroCell>
                        <ConfidenceGlyph col={COLUMN_META.coverage_ratio} row={row} />
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center">
                        <ZeroCell row={row} kind="unmet">
                          <UnmetValueTooltip
                            requirements={vReq}
                            funding={vFun}
                            year={row.analysis_year}
                          >
                            <span>{usdCompact(vUnmet)}</span>
                          </UnmetValueTooltip>
                        </ZeroCell>
                        <ConfidenceGlyph col={COLUMN_META.unmet_need_usd} row={row} />
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center">
                        <GapScoreValueTooltip
                          coverage={vCoverage}
                          pinShare={vPinShare}
                          gap={vGap}
                        >
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-semibold">{vGap.toFixed(3)}</span>
                            <ScoreBar value={vGap} className="w-20" />
                          </div>
                        </GapScoreValueTooltip>
                        <ConfidenceGlyph col={COLUMN_META.gap_score} row={row} />
                      </span>
                    </td>

                    {hasCustom && (
                      <td className="px-3 py-2 text-right tabular">
                        <span className="inline-flex items-center">
                          <span className="font-semibold">
                            {row.custom_gap_score?.toFixed(3) ?? "—"}
                          </span>
                          <ConfidenceGlyph col={COLUMN_META.custom_gap_score} row={row} />
                        </span>
                      </td>
                    )}

                    <td className="px-3 py-2 text-center">
                      <ChronicDots value={row.chronic_years} />
                    </td>

                    <td className="px-3 py-2">
                      <Tooltip
                        content={
                          <div className="space-y-1">
                            <div className="font-semibold text-text">
                              {PLAN_COPY[row.hrp_status].label}
                            </div>
                            <div className="text-text-muted">
                              {PLAN_COPY[row.hrp_status].tooltip}
                            </div>
                          </div>
                        }
                      >
                        <span className="inline-flex">
                          <Badge tone={row.hrp_status === "HRP" ? "indigo" : "neutral"}>
                            {PLAN_COPY[row.hrp_status].short}
                          </Badge>
                        </span>
                      </Tooltip>
                    </td>

                    <td className="px-3 py-2">
                      <QaFlagList flags={rowFlags} />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
