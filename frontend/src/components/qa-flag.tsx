import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { QAFlag } from "@/lib/api-types";
import { QA_FLAG_LABEL } from "@/lib/api-types";

const TONE: Record<QAFlag, BadgeTone> = {
  funding_imputed_zero: "red",
  hno_stale: "amber",
  population_stale: "amber",
  donor_conc_2026_only: "neutral",
  cluster_taxonomy_mismatch: "amber",
  severity_unavailable: "neutral",
  preliminary_hno: "amber",
  hrp_status_unknown: "amber",
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
    return (
      <span className="text-text-muted text-xs">—</span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((f) => (
        <Badge key={f} tone={TONE[f]} title={QA_FLAG_LABEL[f]}>
          {shortLabel(f)}
        </Badge>
      ))}
    </span>
  );
}

function shortLabel(flag: QAFlag): string {
  switch (flag) {
    case "funding_imputed_zero":
      return "imputed $0";
    case "hno_stale":
      return "HNO stale";
    case "population_stale":
      return "pop stale";
    case "donor_conc_2026_only":
      return "HHI 2026";
    case "cluster_taxonomy_mismatch":
      return "taxonomy";
    case "severity_unavailable":
      return "no sev";
    case "preliminary_hno":
      return "HNO prelim";
    case "hrp_status_unknown":
      return "HRP ?";
  }
}
