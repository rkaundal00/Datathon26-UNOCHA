"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { QAFlag } from "@/lib/api-types";
import { FLAG_COPY } from "@/lib/help-copy";
import { Tooltip } from "@/components/ui/tooltip";

const TONE: Record<QAFlag, BadgeTone> = {
  funding_imputed_zero: "red",
  hno_stale: "amber",
  population_stale: "amber",
  donor_conc_2026_only: "neutral",
  cluster_taxonomy_mismatch: "amber",
  severity_unavailable: "neutral",
  preliminary_hno: "amber",
  hrp_status_unknown: "amber",
  cluster_funding_missing: "amber",
  fts_year_fallback: "amber",
  need_proxy_inform: "amber",
  population_unavailable: "amber",
};

export function QaFlagList({
  flags,
  hideSeverity = true,
}: {
  flags: QAFlag[];
  hideSeverity?: boolean;
}) {
  const visible = hideSeverity
    ? flags.filter((f) => f !== "severity_unavailable")
    : flags;
  if (visible.length === 0) {
    return <span className="text-text-muted text-xs">—</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((f) => {
        const copy = FLAG_COPY[f];
        return (
          <Tooltip
            key={f}
            content={
              <div className="space-y-1">
                <div className="font-semibold text-text">{copy.label}</div>
                <div className="text-text-muted">{copy.tooltip}</div>
              </div>
            }
          >
            <span className="inline-flex">
              <Badge tone={TONE[f]}>{copy.short}</Badge>
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
}
