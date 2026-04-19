"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AnalysisYear } from "@/lib/api-types";
import { mergeUrl } from "@/lib/url-state";
import { MapDropdown } from "./map-dropdown";

const YEAR_HINTS: Record<string, string> = {
  "2026": "preliminary",
};

export function YearPicker({ value }: { value: AnalysisYear }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setYear(next: string) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), { year: next });
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }

  return (
    <MapDropdown
      label="Year"
      value={String(value)}
      onChange={setYear}
      options={["2024", "2025", "2026"].map((y) => ({
        value: y,
        label: y,
        hint: YEAR_HINTS[y],
      }))}
      minWidth={140}
    />
  );
}
