import { Badge } from "@/components/ui/badge";
import type { QAFlag } from "@/lib/api-types";
import { QA_FLAG_LABEL } from "@/lib/api-types";
import { cn } from "@/lib/cn";

export type QaTone = "neutral" | "red" | "amber" | "green" | "indigo";

const TONE: Record<QAFlag, QaTone> = {
  funding_imputed_zero: "red",
  hno_stale: "amber",
  population_stale: "amber",
  donor_conc_2026_only: "neutral",
  cluster_taxonomy_mismatch: "amber",
  severity_unavailable: "neutral",
  preliminary_hno: "amber",
  hrp_status_unknown: "amber",
};

/**
 * Map a domain tone to a shadcn Badge variant + optional colored className.
 * Amber / green / indigo aren't in shadcn's default variant set, so we overlay
 * a subtle colored treatment on top of `outline`.
 */
export function toneToBadgeProps(tone: QaTone): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
} {
  switch (tone) {
    case "red":
      return { variant: "destructive" };
    case "amber":
      return {
        variant: "outline",
        className:
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "green":
      return {
        variant: "outline",
        className:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "indigo":
      return {
        variant: "secondary",
        className:
          "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
      };
    case "neutral":
    default:
      return { variant: "outline" };
  }
}

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
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((f) => {
        const { variant, className } = toneToBadgeProps(TONE[f]);
        return (
          <Badge
            key={f}
            variant={variant}
            className={cn("uppercase text-[10px] tracking-wide", className)}
            title={QA_FLAG_LABEL[f]}
          >
            {shortLabel(f)}
          </Badge>
        );
      })}
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
