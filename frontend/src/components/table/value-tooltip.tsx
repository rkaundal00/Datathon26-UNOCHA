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
  pin,
  gap,
  children,
}: {
  coverage: number;
  pinShare: number | null;
  pin: number | null;
  gap: number;
  children: React.ReactNode;
}) {
  const cov = Math.min(coverage, 1);
  let content = `(1 − ${cov.toFixed(2)}) × severity/10 = ${gap.toFixed(2)}`;
  if (pinShare != null && pin != null) {
    const logPin = pin <= 0 ? 0 : Math.log10(Math.max(pin, 1));
    content = `(1 − ${cov.toFixed(2)}) × (0.5 × ${pinShare.toFixed(2)} + 0.5 × ${logPin.toFixed(2)}) = ${gap.toFixed(2)}`;
  }
  return (
    <Tooltip content={content}>
      <span>{children}</span>
    </Tooltip>
  );
}
