"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MAP_METRICS, type MapMetric, mergeUrl } from "@/lib/url-state";
import { metricLabel } from "./color-scales";
import { MapDropdown } from "./map-dropdown";

export function MetricSelector({ value }: { value: MapMetric }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setMetric(next: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), { metric: next });
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }

  return (
    <MapDropdown
      label="Color by"
      value={value}
      onChange={setMetric}
      options={MAP_METRICS.map((m) => ({ value: m, label: metricLabel(m) }))}
      minWidth={220}
    />
  );
}
