"use client";

import * as Slider from "@radix-ui/react-slider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CustomWeights } from "@/lib/api-types";
import { mergeUrl } from "@/lib/url-state";

type Weights = { coverage: number; pin: number; chronic: number };

function parseWeights(raw: string | null): Weights {
  if (!raw) return { coverage: 0.34, pin: 0.33, chronic: 0.33 };
  const out: Weights = { coverage: 0, pin: 0, chronic: 0 };
  for (const tok of raw.split(",")) {
    const [k, v] = tok.split(":");
    if (!k || v == null) continue;
    if (k === "coverage") out.coverage = Number(v);
    if (k === "pin") out.pin = Number(v);
    if (k === "chronic") out.chronic = Number(v);
  }
  return out;
}

function serializeWeights(w: Weights): string {
  const c = Math.round(w.coverage * 100) / 100;
  const p = Math.round(w.pin * 100) / 100;
  const ch = Math.round((1 - c - p) * 100) / 100;
  return `coverage:${c.toFixed(2)},pin:${p.toFixed(2)},chronic:${ch.toFixed(2)}`;
}

function renormalize(
  which: keyof Weights,
  next: number,
  current: Weights,
): Weights {
  const fixed = Math.max(0, Math.min(1, next));
  const remaining = 1 - fixed;
  const others = (["coverage", "pin", "chronic"] as const).filter(
    (k) => k !== which,
  );
  const [otherA, otherB] = others;
  // otherA + otherB must sum to remaining; scale proportionally
  const othersSum = current[otherA] + current[otherB];
  if (othersSum <= 0) {
    return {
      ...current,
      [which]: fixed,
      [otherA]: remaining / 2,
      [otherB]: remaining / 2,
    } as Weights;
  }
  const ratio = remaining / othersSum;
  return {
    ...current,
    [which]: fixed,
    [otherA]: current[otherA] * ratio,
    [otherB]: current[otherB] * ratio,
  } as Weights;
}

export function CustomWeightsPanel({
  active,
  initial,
}: {
  active: boolean;
  initial: CustomWeights | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(active);
  const [weights, setWeights] = useState<Weights>(
    initial
      ? {
          coverage: initial.w_coverage,
          pin: initial.w_pin,
          chronic: initial.w_chronic,
        }
      : { coverage: 0.34, pin: 0.33, chronic: 0.33 },
  );

  useEffect(() => {
    if (!active && !initial) {
      setWeights({ coverage: 0.34, pin: 0.33, chronic: 0.33 });
    }
  }, [active, initial]);

  function commit(next: Weights) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      weights: serializeWeights(next),
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  function close() {
    setOpen(false);
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      weights: null,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <button
        className="flex w-full items-center justify-between text-sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold">Advanced: Custom weights</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-[11px] text-text-muted leading-relaxed">
            <strong className="text-text">
              Custom weights use a linear composite; the default score is multiplicative.
            </strong>{" "}
            Setting weights won&apos;t reproduce the default — they answer different questions.
          </p>
          <WeightSlider
            label="coverage gap"
            value={weights.coverage}
            onChange={(v) => setWeights((w) => renormalize("coverage", v, w))}
            onCommit={(v) => commit(renormalize("coverage", v, weights))}
          />
          <WeightSlider
            label="pin share"
            value={weights.pin}
            onChange={(v) => setWeights((w) => renormalize("pin", v, w))}
            onCommit={(v) => commit(renormalize("pin", v, weights))}
          />
          <WeightSlider
            label="chronic years"
            value={weights.chronic}
            onChange={(v) => setWeights((w) => renormalize("chronic", v, w))}
            onCommit={(v) => commit(renormalize("chronic", v, weights))}
          />
          <div className="flex items-center justify-between pt-1">
            <button
              className="text-xs text-text-muted underline hover:text-text"
              onClick={() => {
                const next = { coverage: 0.34, pin: 0.33, chronic: 0.33 };
                setWeights(next);
                commit(next);
              }}
            >
              Reset to balanced
            </button>
            {active && (
              <button className="text-xs text-text-muted underline hover:text-text" onClick={close}>
                Close &amp; remove custom
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <label>{label}</label>
        <span className="tabular font-semibold">{Math.round(value * 100)}%</span>
      </div>
      <Slider.Root
        className="relative mt-1 flex h-5 w-full touch-none select-none items-center"
        value={[Math.round(value * 100)]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(v[0] / 100)}
        onValueCommit={(v) => onCommit(v[0] / 100)}
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block size-3 rounded-full border-2 border-accent bg-surface shadow" />
      </Slider.Root>
    </div>
  );
}
