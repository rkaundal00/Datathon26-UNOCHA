"use client";

import * as Slider from "@radix-ui/react-slider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CustomWeights } from "@/lib/api-types";
import { mergeUrl } from "@/lib/url-state";
import { SlidersHorizontal, CircleAlert, RotateCcw, XCircle } from "lucide-react";

type Weights = { coverage: number; pin: number; chronic: number };

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
    <div className={`rounded-lg border transition-colors duration-200 overflow-hidden ${active ? "border-accent/40 bg-accent/5 ring-1 ring-accent/10" : "border-border bg-surface hover:border-text-muted"}`}>
      <button
        className="flex w-full items-center justify-between p-3"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center rounded-md p-1.5 ${active ? "bg-accent text-surface" : "bg-surface-2 text-text-muted"}`}>
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-start px-1 text-left">
            <span className="text-sm font-semibold leading-tight text-text">
              Custom Rank Formula
            </span>
            <span className="text-[11px] text-text-muted flex items-center gap-1 font-medium mt-0.5">
              {active ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  Override Active: Reordering rows below
                </>
              ) : (
                "Design a custom ranking composite"
              )}
            </span>
          </div>
        </div>
        <span className="text-text-muted transition-transform duration-200 p-2" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
           <ChevronDownIcon />
        </span>
      </button>
      
      <AnimatedCollapse open={open}>
        <div className="px-4 pb-4 pt-1 border-t border-border/50">
          <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-400 text-[11.5px] leading-relaxed">
            <CircleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Custom weights use a <strong>linear composite</strong> to reorder crises; the default score is <strong>multiplicative</strong>.
              Setting weights won&apos;t reproduce the default ranking.
            </p>
          </div>
          
          <div className="space-y-5 px-1">
            <WeightSlider
              label="Funding Coverage Gap"
              value={weights.coverage}
              onChange={(v) => setWeights((w) => renormalize("coverage", v, w))}
              onCommit={(v) => commit(renormalize("coverage", v, weights))}
            />
            <WeightSlider
              label="People in Need (PIN) Share"
              value={weights.pin}
              onChange={(v) => setWeights((w) => renormalize("pin", v, w))}
              onCommit={(v) => commit(renormalize("pin", v, weights))}
            />
            <WeightSlider
              label="Chronic Funding Shortfall"
              value={weights.chronic}
              onChange={(v) => setWeights((w) => renormalize("chronic", v, w))}
              onCommit={(v) => commit(renormalize("chronic", v, weights))}
            />
          </div>
          
          <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
            <button
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors font-medium"
              onClick={() => {
                const next = { coverage: 0.34, pin: 0.33, chronic: 0.33 };
                setWeights(next);
                commit(next);
              }}
            >
              <RotateCcw className="h-3 w-3" />
              Reset Balanced
            </button>
            {active && (
              <button 
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface-2 text-xs font-semibold text-text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors" 
                onClick={close}
              >
                <XCircle className="h-3.5 w-3.5" />
                Clear Override
              </button>
            )}
          </div>
        </div>
      </AnimatedCollapse>
    </div>
  );
}

function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (open && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [open]);

  // Update height if content changes while open
  useEffect(() => {
    if (!open || !contentRef.current) return;
    const observer = new ResizeObserver(() => {
      if (contentRef.current) setHeight(contentRef.current.scrollHeight);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [open]);

  return (
    <div
      style={{
        height,
        opacity: open ? 1 : 0,
        overflow: "hidden",
        transition: "height 300ms ease, opacity 250ms ease",
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
  onCommit,
  color = "bg-accent",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  color?: string;
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <label className="font-medium text-text-muted group-hover:text-text transition-colors">{label}</label>
        <span className="tabular-nums font-semibold text-text bg-surface-2 px-1.5 py-0.5 rounded min-w-[3ch] text-center">
          {Math.round(value * 100)}<span className="font-normal text-text-muted">%</span>
        </span>
      </div>
      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[Math.round(value * 100)]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(v[0] / 100)}
        onValueCommit={(v) => onCommit(v[0] / 100)}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-2 overflow-hidden shadow-inner">
          <Slider.Range className={`absolute h-full rounded-full ${color} opacity-80`} />
        </Slider.Track>
        <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-surface bg-text shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 transition-shadow cursor-grab active:cursor-grabbing hover:scale-110" />
      </Slider.Root>
    </div>
  );
}
