"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import type { CountryRow, RankingMeta } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { numCompact, percent, usdCompact } from "@/lib/formatters";
import { ChronicDots, ScoreBar } from "@/components/ui/score-bar";
import { QaFlagList } from "@/components/qa-flag";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mergeUrl } from "@/lib/url-state";

interface Column {
  key: string;
  label: string;
  className?: string;
  sortable: boolean;
}

const COLUMNS: Column[] = [
  { key: "country", label: "Country", sortable: true },
  { key: "pin", label: "PIN", sortable: true, className: "text-right" },
  { key: "pin_share", label: "PIN share", sortable: true, className: "text-right" },
  { key: "coverage_ratio", label: "Coverage", sortable: true, className: "text-right" },
  { key: "unmet_need_usd", label: "Unmet need", sortable: true, className: "text-right" },
  { key: "gap_score", label: "Gap score", sortable: true, className: "text-right" },
  { key: "chronic_years", label: "Chronic", sortable: true, className: "text-center" },
  { key: "hrp_status", label: "Plan", sortable: true },
  { key: "qa_flags", label: "Flags", sortable: false },
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasCustom = rows[0]?.custom_gap_score != null;

  const customCol: Column | null = hasCustom
    ? { key: "custom_gap_score", label: "Custom", sortable: true, className: "text-right" }
    : null;
  const allCols = customCol
    ? [...COLUMNS.slice(0, 6), customCol, ...COLUMNS.slice(6)]
    : COLUMNS;

  function clickRow(iso3: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      focus: iso3,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  function clickSort(col: Column) {
    if (!col.sortable) return;
    const nextDir =
      meta.sort === col.key && meta.sort_dir === "desc" ? "asc" : "desc";
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      sort: col.key,
      sort_dir: nextDir,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <section id="country-table" className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
        <span>
          Sorted by:{" "}
          <strong className="text-foreground">{meta.sort}</strong> ·{" "}
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
        <span>{rows.length} rows</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {allCols.map((col) => (
              <TableHead
                key={col.key}
                aria-sort={
                  meta.sort === col.key
                    ? meta.sort_dir === "desc"
                      ? "descending"
                      : "ascending"
                    : "none"
                }
                className={cn(
                  "select-none",
                  col.className,
                  col.sortable && "cursor-pointer hover:text-foreground",
                )}
                onClick={() => clickSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {meta.sort === col.key &&
                    (meta.sort_dir === "desc" ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronUp className="size-3" />
                    ))}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isFocused = focusIso === row.iso3;
            const isOpen = expanded === row.iso3;
            return (
              <Fragment key={row.iso3}>
                <TableRow
                  onClick={() => clickRow(row.iso3)}
                  className={cn(
                    "cursor-pointer tabular",
                    isFocused && "bg-muted/60 border-l-[3px] border-l-primary",
                  )}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{row.country}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {row.iso3}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    title={row.pin.toLocaleString()}
                  >
                    {numCompact(row.pin)}
                  </TableCell>
                  <TableCell className="text-right">
                    {percent(row.pin_share)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    title={`raw ${row.coverage_ratio.toFixed(4)}`}
                  >
                    {percent(row.coverage_ratio)}
                    {row.coverage_ratio > 1 && (
                      <span className="ml-1 text-amber-600">↑</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    title={row.unmet_need_usd.toLocaleString()}
                  >
                    {usdCompact(row.unmet_need_usd)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(isOpen ? null : row.iso3);
                    }}
                  >
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold">{row.gap_score.toFixed(3)}</span>
                      <ScoreBar value={row.gap_score} className="w-20" />
                    </div>
                  </TableCell>
                  {customCol && (
                    <TableCell className="text-right tabular">
                      <span className="font-semibold">
                        {row.custom_gap_score?.toFixed(3) ?? "—"}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <ChronicDots value={row.chronic_years} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.hrp_status === "HRP" ? "secondary" : "outline"}
                      className={
                        row.hrp_status === "HRP"
                          ? "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                          : undefined
                      }
                    >
                      {row.hrp_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <QaFlagList flags={row.qa_flags} />
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={allCols.length}
                      className="text-xs text-muted-foreground"
                    >
                      <strong className="text-foreground">Gap score decomposition:</strong>{" "}
                      (1 − min(coverage, 1)) × pin_share = (1 −{" "}
                      {Math.min(row.coverage_ratio, 1).toFixed(3)}) ×{" "}
                      {row.pin_share.toFixed(3)} ={" "}
                      <strong className="text-foreground">
                        {row.gap_score.toFixed(3)}
                      </strong>
                      {row.custom_gap_score != null && meta.weights && (
                        <span className="ml-4">
                          <strong className="text-foreground">Custom:</strong>{" "}
                          {meta.weights.w_coverage.toFixed(2)} × coverage_gap +{" "}
                          {meta.weights.w_pin.toFixed(2)} × pin_share +{" "}
                          {meta.weights.w_chronic.toFixed(2)} × chronic/5 ={" "}
                          <strong className="text-foreground">
                            {row.custom_gap_score.toFixed(3)}
                          </strong>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
