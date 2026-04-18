"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { mergeUrl } from "@/lib/url-state";
import type { AnalysisYear, RankingMeta } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
      aria-label="Cohort scope"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
    >
      <PinFloorChip
        value={meta.pin_floor}
        onChange={(v) => update({ pin_floor: v })}
      />
      <HrpChip
        value={meta.require_hrp}
        onChange={(v) => update({ hrp: v ? "true" : "false" })}
      />
      <YearChip
        value={meta.analysis_year}
        onChange={(v) => update({ year: v })}
      />
      <ReadonlyChip>denom = PIN</ReadonlyChip>
      <ReadonlyChip>currency = USD (nominal)</ReadonlyChip>
    </div>
  );
}

function ReadonlyChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      {children}
    </span>
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          PIN ≥ {compact(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        <div className="flex flex-col gap-0.5 text-xs">
          {[500_000, 1_000_000, 2_000_000].map((v) => (
            <button
              key={v}
              className="rounded px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              PIN ≥ {compact(v)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          title='When on, cohort is restricted to HRP, Flash Appeal, and Regional Response Plan countries. When off, "Other" and "Unknown" plan types are included too. Countries with no appeal record are always excluded — see the [review] panel.'
        >
          {value ? "active HRP" : "any plan (incl. Other/Unknown)"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-xs">
        <p className="mb-3 leading-relaxed text-muted-foreground">
          When on, cohort is restricted to{" "}
          <strong className="text-foreground">
            HRP, Flash Appeal, and Regional Response Plan
          </strong>{" "}
          countries. When off, <em>Other</em> and <em>Unknown</em> plan types are
          included too. Countries with no appeal record are always excluded — see
          the <strong>Data coverage</strong> panel.
        </p>
        <div className="flex gap-2">
          <Button
            variant={value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onChange(true);
              setOpen(false);
            }}
          >
            Require HRP/Flash/Regional
          </Button>
          <Button
            variant={!value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onChange(false);
              setOpen(false);
            }}
          >
            Include all plan types
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          year = {value}
          {value === 2026 && (
            <span className="ml-1 text-amber-700 dark:text-amber-400">
              (preliminary)
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-40 p-1">
        <div className="flex flex-col gap-0.5 text-xs">
          {[2024, 2025, 2026].map((y) => (
            <button
              key={y}
              className="rounded px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onChange(y as AnalysisYear);
                setOpen(false);
              }}
            >
              {y}
              {y === 2026 && (
                <span className="ml-2 text-[11px] text-amber-600 dark:text-amber-400">
                  preliminary
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M`;
  if (v >= 1_000) return `${v / 1_000}k`;
  return String(v);
}
