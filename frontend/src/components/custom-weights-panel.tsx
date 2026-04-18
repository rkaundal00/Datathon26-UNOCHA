"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CustomWeights } from "@/lib/api-types";
import { mergeUrl } from "@/lib/url-state";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

type Weights = { coverage: number; pin: number; chronic: number };

function serializeWeights(w: Weights): string {
  return `coverage:${w.coverage.toFixed(2)},pin:${w.pin.toFixed(2)},chronic:${w.chronic.toFixed(2)}`;
}

function renormalize(
  which: keyof Weights,
  next: number,
  current: Weights,
): Weights {
  const fixed = Math.max(0, Math.min(1, next));
  const remaining = 1 - fixed;
  const otherA = which === "coverage" ? "pin" : "coverage";
  const otherB = which === "chronic" ? "coverage" : "chronic";
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
    <div className="rounded-lg border bg-card p-3">
      <button
        className="flex w-full items-center justify-between text-sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold">Advanced: Custom weights</span>
        <span className="text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">
              Custom weights use a linear composite; the default score is
              multiplicative.
            </strong>{" "}
            Setting weights won&apos;t reproduce the default — they answer
            different questions.
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = { coverage: 0.34, pin: 0.33, chronic: 0.33 };
                setWeights(next);
                commit(next);
              }}
            >
              Reset to balanced
            </Button>
            {active && (
              <Button variant="ghost" size="sm" onClick={close}>
                Close &amp; remove custom
              </Button>
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
        <span className="tabular font-semibold">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        className="mt-2"
        value={[Math.round(value * 100)]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(v[0] / 100)}
        onValueCommit={(v) => onCommit(v[0] / 100)}
      />
    </div>
  );
}
