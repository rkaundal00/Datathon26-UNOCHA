"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";
import type { CoverageResponse, ExcludedCountryRow } from "@/lib/api-types";
import { EXCLUSION_LABEL } from "@/lib/api-types";
import { fetchCoverage } from "@/lib/api";
import { QaFlagList } from "@/components/qa-flag";
import { Badge } from "@/components/ui/badge";

export function DataCoverageAnchor({
  params,
  excludedCount,
}: {
  params: Parameters<typeof fetchCoverage>[0];
  excludedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CoverageResponse | null>(null);

  useEffect(() => {
    if (open && !data) {
      fetchCoverage(params)
        .then(setData)
        .catch(() => setData(null));
    }
  }, [open, data, params]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          id="data-coverage-modal"
          className="text-xs text-text-muted underline hover:text-text"
        >
          {excludedCount} crises excluded — [review]
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-1/2 z-50 max-h-[80vh] w-[min(720px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-border bg-surface p-4 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Data coverage</Dialog.Title>
              <Dialog.Description className="text-xs text-text-muted">
                Countries considered but excluded, and in-cohort rows carrying QA flags.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-text-muted hover:bg-surface-2">✕</Dialog.Close>
          </div>
          {data ? (
            <Tabs.Root defaultValue="excluded" className="mt-3">
              <Tabs.List className="mb-2 flex gap-2 border-b border-border">
                <Tabs.Trigger
                  value="excluded"
                  className="border-b-2 border-transparent px-3 py-1.5 text-sm data-[state=active]:border-accent data-[state=active]:text-text"
                >
                  Excluded ({data.excluded.length})
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="flagged"
                  className="border-b-2 border-transparent px-3 py-1.5 text-sm data-[state=active]:border-accent data-[state=active]:text-text"
                >
                  In cohort — flagged ({data.in_cohort_flagged.length})
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="excluded">
                <ExcludedTable rows={data.excluded} />
              </Tabs.Content>
              <Tabs.Content value="flagged">
                <FlaggedTable rows={data.in_cohort_flagged} />
              </Tabs.Content>
            </Tabs.Root>
          ) : (
            <div className="py-12 text-center text-sm text-text-muted">Loading…</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExcludedTable({ rows }: { rows: ExcludedCountryRow[] }) {
  const byReason = rows.reduce<Record<string, ExcludedCountryRow[]>>((acc, r) => {
    (acc[r.exclusion_reason] ??= []).push(r);
    return acc;
  }, {});
  const reasons = Object.keys(byReason).sort();
  return (
    <div className="space-y-3">
      {reasons.map((reason) => (
        <div key={reason}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {EXCLUSION_LABEL[reason as keyof typeof EXCLUSION_LABEL] ?? reason} ({byReason[reason].length})
          </h3>
          <ul className="text-xs divide-y divide-border border border-border rounded">
            {byReason[reason].map((r) => (
              <li key={r.iso3} className="flex justify-between px-3 py-1.5">
                <span>
                  <strong>{r.country}</strong>{" "}
                  <span className="text-text-muted">({r.iso3})</span>
                </span>
                <span className="text-text-muted">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FlaggedTable({ rows }: { rows: { iso3: string; country: string; qa_flags: string[] }[] }) {
  if (rows.length === 0) return <p className="text-xs text-text-muted">No rows in cohort carry non-default flags.</p>;
  return (
    <ul className="text-xs divide-y divide-border rounded border border-border">
      {rows.map((r) => (
        <li key={r.iso3} className="flex items-center justify-between px-3 py-2 gap-3">
          <span className="flex-1">
            <strong>{r.country}</strong>{" "}
            <span className="text-text-muted">({r.iso3})</span>
          </span>
          <span className="flex flex-wrap gap-1 justify-end">
            {r.qa_flags.map((f) => (
              <Badge key={f} tone="amber">{f}</Badge>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
