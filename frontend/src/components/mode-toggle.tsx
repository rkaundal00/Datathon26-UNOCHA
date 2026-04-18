"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Mode } from "@/lib/api-types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { mergeUrl } from "@/lib/url-state";

const OPTIONS: { value: Mode; label: string; tooltip: string }[] = [
  {
    value: "acute",
    label: "Acute",
    tooltip: "Sort by acute funding gap. Scatter A emphasizes X-axis.",
  },
  {
    value: "structural",
    label: "Structural",
    tooltip: "Sort by chronic-year count. Scatter A emphasizes Y-axis.",
  },
  {
    value: "combined",
    label: "Combined",
    tooltip: "Default. Sort by composite gap score. Scatter A balanced.",
  },
];

export function ModeToggleBar({ value }: { value: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setMode(next: Mode) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      mode: next,
      sort: null,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && setMode(v as Mode)}
      aria-label="Analysis mode"
      variant="outline"
      size="sm"
    >
      {OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          title={opt.tooltip}
          className="px-3"
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
