"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { usdCompact } from "@/lib/formatters";

function fmtInt(n: number): string {
  return n.toLocaleString();
}

export function PinValueTooltip({
  pin,
  year,
  children,
}: {
  pin: number | null;
  year: number | null;
  children: React.ReactNode;
}) {
  const content =
    pin != null && year != null
      ? `${fmtInt(pin)} people (HNO ${year})`
      : "No HNO row published — need approximated from INFORM Severity";
  return (
    <Tooltip content={content}>
      <span>{children}</span>
    </Tooltip>
  );
}

export function PinShareValueTooltip({
  pin,
  population,
  popYear,
  children,
}: {
  pin: number | null;
  population: number | null;
  popYear: number | null;
  children: React.ReactNode;
}) {
  let content: string;
  if (pin != null && population != null && population > 0 && popYear != null) {
    content = `${fmtInt(pin)} of ${fmtInt(population)} (COD-PS ${popYear})`;
  } else if (population == null) {
    content = "No COD-PS population baseline — per-capita share unavailable";
  } else if (pin == null) {
    content = "No HNO row — per-capita share unavailable";
  } else {
    content = `Population baseline unavailable (COD-PS ${popYear ?? "?"})`;
  }
  return (
    <Tooltip content={content}>
      <span>{children}</span>
    </Tooltip>
  );
}

export function CoverageValueTooltip({
  requirements,
  funding,
  year,
  children,
}: {
  requirements: number;
  funding: number;
  year: number;
  children: React.ReactNode;
}) {
  return (
    <Tooltip
      content={`${usdCompact(funding)} funded / ${usdCompact(requirements)} requested (FTS ${year})`}
    >
      <span>{children}</span>
    </Tooltip>
  );
}

export function UnmetValueTooltip({
  requirements,
  funding,
  year,
  children,
}: {
  requirements: number;
  funding: number;
  year: number;
  children: React.ReactNode;
}) {
  return (
    <Tooltip
      content={`${usdCompact(requirements)} − ${usdCompact(funding)} (FTS ${year})`}
    >
      <span>{children}</span>
    </Tooltip>
  );
}

export function GapScoreValueTooltip({
  coverage,
  pinShare,
  gap,
  children,
}: {
  coverage: number;
  pinShare: number | null;
  gap: number;
  children: React.ReactNode;
}) {
  const cov = Math.min(coverage, 1);
  const need =
    pinShare != null
      ? `${pinShare.toFixed(3)}`
      : `severity/10 (need_proxy_inform)`;
  return (
    <Tooltip
      content={`(1 − ${cov.toFixed(2)}) × ${need} = ${gap.toFixed(2)}`}
    >
      <span>{children}</span>
    </Tooltip>
  );
}
