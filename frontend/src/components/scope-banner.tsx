"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { mergeUrl } from "@/lib/url-state";
import type { AnalysisYear, RankingMeta } from "@/lib/api-types";
import { ChevronDown, Filter, Info } from "lucide-react";

export function ScopeBanner({ meta }: { meta: RankingMeta }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(patch: Record<string, string | number | boolean | null>) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), patch);
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <div
      role="toolbar"
      aria-label="Cohort scope filters"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-text-muted mr-1">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters:</span>
      </div>
      
      <PinFloorChip value={meta.pin_floor} onChange={(v) => update({ pin_floor: v })} />
      <HrpChip
        value={meta.require_hrp}
        onChange={(v) => update({ hrp: v ? "true" : "false" })}
      />
      <YearChip
        value={meta.analysis_year}
        onChange={(v) => update({ year: v })}
      />
      
      <div className="ml-auto flex items-center gap-2 text-xs text-text-muted">
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-1 hover:text-text transition-colors">
              <Info className="h-3.5 w-3.5" />
              <span>Assumptions</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="z-50 mt-2 rounded-lg border border-border bg-surface p-3 shadow-lg text-xs w-64" sideOffset={4}>
              <p className="font-semibold mb-1">Data Assumptions</p>
              <ul className="list-disc pl-4 space-y-1 text-text-muted mt-2">
                <li><strong>Denominator:</strong> People in Need (PIN)</li>
                <li><strong>Currency:</strong> USD (nominal)</li>
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}

function PinFloorChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3 hover:border-text-muted transition-colors">
          <span className="text-text-muted">Min PIN:</span>
          <span className="font-medium">{compact(value)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 mt-2 min-w-[160px] rounded-lg border border-border bg-surface p-1 shadow-lg" sideOffset={4}>
          <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Minimum People in Need
          </div>
          <div className="flex flex-col gap-0.5 text-sm">
            {[500_000, 1_000_000, 2_000_000].map((v) => (
              <button
                key={v}
                className="flex items-center justify-between rounded px-2.5 py-1.5 text-left hover:bg-surface-2 transition-colors"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                <span>{compact(v)}</span>
                {value === v && <div className="h-1.5 w-1.5 rounded-full bg-accent"></div>}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function HrpChip({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3 hover:border-text-muted transition-colors"
          title="Filter by response plan type"
        >
          <span className="text-text-muted">Plans:</span>
          <span className="font-medium">{value ? "HRP/Flash Only" : "All Types"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 mt-2 rounded-lg border border-border bg-surface p-1 shadow-lg w-[280px]" sideOffset={4}>
           <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Response Plan Type
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              className="flex flex-col items-start rounded px-2.5 py-2 hover:bg-surface-2 transition-colors relative"
              onClick={() => {
                onChange(true);
                setOpen(false);
              }}
            >
              <div className="flex items-center w-full">
                <span className="text-sm font-medium">Strict (HRP/Flash Only)</span>
                {value && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent"></div>}
              </div>
              <span className="text-xs text-text-muted mt-1 text-left">Only Humanitarian Response Plans, Flash Appeals, and Regional Plans.</span>
            </button>
            <button
              className="flex flex-col items-start rounded px-2.5 py-2 hover:bg-surface-2 transition-colors relative"
              onClick={() => {
                onChange(false);
                setOpen(false);
              }}
            >
              <div className="flex items-center w-full">
                <span className="text-sm font-medium">Broad (All Types)</span>
                {!value && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent"></div>}
              </div>
              <span className="text-xs text-text-muted mt-1 text-left">Includes Other and Unknown plans.</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function YearChip({
  value,
  onChange,
}: {
  value: AnalysisYear;
  onChange: (v: AnalysisYear) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3 hover:border-text-muted transition-colors">
          <span className="text-text-muted">Year:</span>
          <span className="font-medium">
            {value}
            {value === 2026 && <span className="ml-1 text-amber-600 dark:text-amber-400 font-normal"> (prelim)</span>}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 mt-2 min-w-[140px] rounded-lg border border-border bg-surface p-1 shadow-lg" sideOffset={4}>
          <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Analysis Year
          </div>
          <div className="flex flex-col gap-0.5 text-sm">
            {[2024, 2025, 2026].map((y) => (
              <button
                key={y}
                className="flex items-center justify-between rounded px-2.5 py-1.5 text-left hover:bg-surface-2 transition-colors"
                onClick={() => {
                  onChange(y as AnalysisYear);
                  setOpen(false);
                }}
              >
                <span>
                  {y}
                  {y === 2026 && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">prelim</span>}
                </span>
                {value === y && <div className="h-1.5 w-1.5 rounded-full bg-accent"></div>}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M`;
  if (v >= 1_000) return `${v / 1_000}k`;
  return String(v);
}
