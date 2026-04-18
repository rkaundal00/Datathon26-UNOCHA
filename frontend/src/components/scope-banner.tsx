"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { mergeUrl } from "@/lib/url-state";
import type { AnalysisYear, RankingMeta } from "@/lib/api-types";

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
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
    >
      <PinFloorChip value={meta.pin_floor} onChange={(v) => update({ pin_floor: v })} />
      <HrpChip
        value={meta.require_hrp}
        onChange={(v) => update({ hrp: v ? "true" : "false" })}
      />
      <YearChip
        value={meta.analysis_year}
        onChange={(v) => update({ year: v })}
      />
      <Chip>denom = PIN</Chip>
      <Chip>currency = USD (nominal)</Chip>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text">
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs hover:bg-border">
          PIN ≥ {compact(value)}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 mt-2 rounded-lg border border-border bg-surface p-2 shadow-lg" sideOffset={4}>
          <div className="flex flex-col gap-1 text-xs">
            {[500_000, 1_000_000, 2_000_000].map((v) => (
              <button
                key={v}
                className="rounded px-2 py-1 text-left hover:bg-surface-2"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                PIN ≥ {compact(v)}
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
          className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs hover:bg-border"
          title='When on, cohort is restricted to HRP, Flash Appeal, and Regional Response Plan countries. When off, "Other" and "Unknown" plan types are included too. Countries with no appeal record are always excluded — see the [review] panel.'
        >
          {value ? "active HRP" : "any plan (incl. Other/Unknown)"}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 mt-2 rounded-lg border border-border bg-surface p-3 shadow-lg max-w-sm text-xs" sideOffset={4}>
          <p className="mb-2">
            When on, cohort is restricted to <strong>HRP, Flash Appeal, and Regional Response Plan</strong> countries.
            When off, <em>Other</em> and <em>Unknown</em> plan types are included too. Countries with no appeal record
            are always excluded — see the <strong>Data coverage</strong> panel.
          </p>
          <div className="flex gap-2">
            <button
              className="rounded border border-border px-2 py-1 hover:bg-surface-2"
              onClick={() => {
                onChange(true);
                setOpen(false);
              }}
            >
              Require HRP/Flash/Regional
            </button>
            <button
              className="rounded border border-border px-2 py-1 hover:bg-surface-2"
              onClick={() => {
                onChange(false);
                setOpen(false);
              }}
            >
              Include all plan types
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
        <button className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs hover:bg-border">
          year = {value}
          {value === 2026 && (
            <span className="ml-1 text-amber-700 dark:text-amber-300">(preliminary)</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 mt-2 rounded-lg border border-border bg-surface p-2 shadow-lg" sideOffset={4}>
          <div className="flex flex-col gap-1 text-xs">
            {[2024, 2025, 2026].map((y) => (
              <button
                key={y}
                className="rounded px-2 py-1 text-left hover:bg-surface-2"
                onClick={() => {
                  onChange(y as AnalysisYear);
                  setOpen(false);
                }}
              >
                {y}
                {y === 2026 && (
                  <span className="ml-2 text-[11px] text-amber-700 dark:text-amber-300">preliminary</span>
                )}
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
