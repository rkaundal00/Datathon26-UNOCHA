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
  pin: number;
  year: number;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={`${fmtInt(pin)} people (HNO ${year})`}>
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
  pin: number;
  population: number;
  popYear: number;
  children: React.ReactNode;
}) {
  const content =
    population > 0
      ? `${fmtInt(pin)} of ${fmtInt(population)} (COD-PS ${popYear})`
      : `Population baseline unavailable (COD-PS ${popYear})`;
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
  pinShare: number;
  gap: number;
  children: React.ReactNode;
}) {
  const cov = Math.min(coverage, 1);
  return (
    <Tooltip
      content={`(1 − ${cov.toFixed(2)}) × ${pinShare.toFixed(2)} = ${gap.toFixed(2)}`}
    >
      <span>{children}</span>
    </Tooltip>
  );
}
