"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { COLUMN_META } from "@/lib/columns";
import type { HRPStatus, QAFlag } from "@/lib/api-types";
import {
  CONFIDENCE_TIER_COPY,
  FLAG_COPY,
  GAP_SCORE_GUARDRAIL,
  METHODOLOGY_INTRO,
  PLAN_COPY,
} from "@/lib/help-copy";

const PLAN_ORDER: HRPStatus[] = [
  "HRP",
  "FlashAppeal",
  "RegionalRP",
  "Other",
  "Unknown",
  "None",
];

const FLAG_ORDER: QAFlag[] = [
  "funding_imputed_zero",
  "hno_stale",
  "population_stale",
  "hrp_status_unknown",
  "preliminary_hno",
  "donor_conc_2026_only",
  "cluster_taxonomy_mismatch",
  "severity_unavailable",
];

export function MethodologyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text hover:bg-surface-2"
      >
        <BookOpen className="size-3.5" aria-hidden />
        Methodology
      </button>
      {open && createPortal(<MethodologyDrawer onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function MethodologyDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Methodology"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <button
        aria-label="Close methodology"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside
        className={cn(
          "relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg",
          "border border-border bg-surface shadow-2xl",
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-text">Methodology</h2>
            <p className="text-xs text-text-muted">Data dictionary, plan types, and flag glossary.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          <section className="space-y-2">
            <p className="text-text">{METHODOLOGY_INTRO}</p>
            <p className="rounded border-l-2 border-amber-500/60 bg-amber-500/5 px-3 py-2 text-xs text-text">
              {GAP_SCORE_GUARDRAIL}
            </p>
          </section>

          <Section title="Column dictionary">
            <ul className="space-y-3">
              {Object.values(COLUMN_META).map((col) => (
                <li key={col.key} className="rounded border border-border bg-surface-2 p-3 text-xs">
                  <h4 className="mb-1 text-sm font-semibold text-text">{col.displayLabel}</h4>
                  <Field label="What" body={col.popover.what} />
                  <Field label="How" body={col.popover.how} mono />
                  <Field label="Source" body={col.popover.source} />
                  <Field label="Why it matters" body={col.popover.whyItMatters} />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Plan types (FTS typeName cascade)">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1 pr-2 font-medium">Badge</th>
                  <th className="py-1 font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PLAN_ORDER.map((k) => (
                  <tr key={k} className="align-top">
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-text">{PLAN_COPY[k].short}</td>
                    <td className="py-1.5 text-text">{PLAN_COPY[k].tooltip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Data-quality flags">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1 pr-2 font-medium">Badge</th>
                  <th className="py-1 pr-2 font-medium">Full label</th>
                  <th className="py-1 font-medium">Implication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {FLAG_ORDER.map((f) => (
                  <tr key={f} className="align-top">
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-text">{FLAG_COPY[f].short}</td>
                    <td className="py-1.5 pr-2 text-text">{FLAG_COPY[f].label}</td>
                    <td className="py-1.5 text-text">{FLAG_COPY[f].tooltip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Confidence tiers">
            <ul className="space-y-2 text-xs">
              {(["authoritative", "derived", "imputed"] as const).map((t) => (
                <li key={t} className="rounded border border-border bg-surface-2 p-3">
                  <h4 className="mb-1 text-sm font-semibold text-text">
                    <span className="mr-1">{CONFIDENCE_TIER_COPY[t].glyph}</span>
                    {CONFIDENCE_TIER_COPY[t].label}
                  </h4>
                  <p className="text-text-muted">{CONFIDENCE_TIER_COPY[t].body}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Provenance">
            <ul className="space-y-1 text-xs text-text-muted">
              <li>
                <strong className="text-text">HNO</strong> — OCHA Humanitarian Needs Overview, per-year Parquet.
                2026 is preliminary national-only.
              </li>
              <li>
                <strong className="text-text">FTS</strong> — OCHA Financial Tracking Service. Self-reported and
                retroactively revised; treat as eventually-consistent.{" "}
                <a
                  className="underline hover:text-text"
                  href="https://fts.unocha.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  fts.unocha.org
                </a>
              </li>
              <li>
                <strong className="text-text">COD-PS</strong> — Common Operational Dataset, Population Statistics.
                Reference year is the most recent available ≤ analysis year.
              </li>
            </ul>
          </Section>

          <Section title="Known limitations">
            <ul className="list-disc space-y-1 pl-4 text-xs text-text-muted">
              <li>Donor HHI is 2026-only; pre-2026 transaction data is not in the dataset.</li>
              <li>Names vary across sources — all joins are on ISO3 / P-codes, never names.</li>
              <li>FTS typeName is ~32% populated; Unknown is the fallback when requirements exist but no type is declared.</li>
            </ul>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  body,
  mono = false,
}: {
  label: string;
  body: string;
  mono?: boolean;
}) {
  return (
    <div className="mt-1.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <div className={mono ? "mt-0.5 break-words font-mono text-[11px] text-text" : "mt-0.5 text-text"}>
        {body}
      </div>
    </div>
  );
}
