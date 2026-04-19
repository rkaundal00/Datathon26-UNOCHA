"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MAP_METRICS, type MapMetric, mergeUrl } from "@/lib/url-state";
import { metricLabel } from "./color-scales";
import { MapDropdown } from "./map-dropdown";

export function MetricSelector({
  value,
  sectorActive = false,
}: {
  value: MapMetric;
  sectorActive?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setMetric(next: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), { metric: next });
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }

  // Under a sector lens, chronic_years has no cluster-level counterpart and hrp_status
  // stays country-level; drop chronic_years from the metric list rather than let users
  // pick a metric the color scale doesn't re-interpret.
  const metrics = sectorActive
    ? MAP_METRICS.filter((m) => m !== "chronic_years")
    : MAP_METRICS;

  return (
    <MapDropdown
      label="Color by"
      value={value}
      onChange={setMetric}
      options={metrics.map((m) => ({ value: m, label: metricLabel(m) }))}
      minWidth={220}
    />
  );
}
