"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ColumnMeta } from "@/lib/columns";
import { HEADER_SUBTITLE, HEADER_TOOLTIP } from "@/lib/help-copy";
import { Tooltip } from "@/components/ui/tooltip";
import { HeaderPopover } from "@/components/table/header-popover";

export function HeaderCell({
  col,
  sortKey,
  sortDir,
  onSort,
  analysisYear,
  align = "left",
}: {
  col: ColumnMeta;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: () => void;
  analysisYear: number;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === col.key;
  const subtitle = HEADER_SUBTITLE[col.key];
  const tooltip = HEADER_TOOLTIP[col.key](analysisYear);
  const justify =
    align === "right" ? "items-end" : align === "center" ? "items-center" : "items-start";

  return (
    <th
      aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
      className={cn(
        "px-3 py-2 font-semibold select-none align-top",
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
    >
      <div className={cn("flex flex-col gap-0.5", justify)}>
        <div className="inline-flex items-center gap-1">
          <Tooltip content={tooltip} side="top">
            <button
              type="button"
              onClick={col.sortable ? onSort : undefined}
              disabled={!col.sortable}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-text-muted hover:text-text",
                col.sortable ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span>{col.label}</span>
              {active && col.sortable && (
                sortDir === "desc" ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronUp className="size-3" />
                )
              )}
            </button>
          </Tooltip>
          <HeaderPopover col={col} />
        </div>
        {subtitle && (
          <span className="text-[10px] font-normal normal-case tracking-normal text-text-muted">
            {subtitle}
          </span>
        )}
      </div>
    </th>
  );
}
