"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useRouter, useSearchParams } from "next/navigation";
import type { Mode } from "@/lib/api-types";
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
      sort: null, // clear explicit sort → mode preset takes over
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && setMode(v as Mode)}
      aria-label="Analysis mode"
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          title={opt.tooltip}
          className="h-9 min-w-20 rounded px-3 text-sm data-[state=on]:bg-accent data-[state=on]:text-accent-ink hover:bg-surface-2 data-[state=on]:hover:bg-accent"
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
