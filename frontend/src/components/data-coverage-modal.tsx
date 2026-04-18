"use client";

import { useEffect, useState } from "react";
import type { CoverageResponse, ExcludedCountryRow } from "@/lib/api-types";
import { EXCLUSION_LABEL } from "@/lib/api-types";
import { fetchCoverage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toneToBadgeProps } from "@/components/qa-flag";

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground"
        >
          {excludedCount} crises excluded — [review]
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Data coverage</DialogTitle>
          <DialogDescription>
            Countries considered but excluded, and in-cohort rows carrying QA flags.
          </DialogDescription>
        </DialogHeader>
        {data ? (
          <Tabs defaultValue="excluded">
            <TabsList>
              <TabsTrigger value="excluded">
                Excluded ({data.excluded.length})
              </TabsTrigger>
              <TabsTrigger value="flagged">
                In cohort — flagged ({data.in_cohort_flagged.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="excluded">
              <ExcludedTable rows={data.excluded} />
            </TabsContent>
            <TabsContent value="flagged">
              <FlaggedTable rows={data.in_cohort_flagged} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
      </DialogContent>
    </Dialog>
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
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {EXCLUSION_LABEL[reason as keyof typeof EXCLUSION_LABEL] ?? reason} (
            {byReason[reason].length})
          </h3>
          <ul className="divide-y rounded border text-xs">
            {byReason[reason].map((r) => (
              <li key={r.iso3} className="flex justify-between px-3 py-1.5">
                <span>
                  <strong>{r.country}</strong>{" "}
                  <span className="text-muted-foreground">({r.iso3})</span>
                </span>
                <span className="text-muted-foreground">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FlaggedTable({
  rows,
}: {
  rows: { iso3: string; country: string; qa_flags: string[] }[];
}) {
  if (rows.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        No rows in cohort carry non-default flags.
      </p>
    );
  return (
    <ul className="divide-y rounded border text-xs">
      {rows.map((r) => (
        <li
          key={r.iso3}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span className="flex-1">
            <strong>{r.country}</strong>{" "}
            <span className="text-muted-foreground">({r.iso3})</span>
          </span>
          <span className="flex flex-wrap justify-end gap-1">
            {r.qa_flags.map((f) => (
              <Badge key={f} {...toneToBadgeProps("amber")}>
                {f}
              </Badge>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
