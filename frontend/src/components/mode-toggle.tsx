"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useRouter, useSearchParams } from "next/navigation";
import type { Mode } from "@/lib/api-types";
import { mergeUrl } from "@/lib/url-state";

const OPTIONS: { value: Mode; label: string; tooltip: string }[] = [
  {
    value: "acute",
    label: "Emerging",
    tooltip: "Crises that need funding right now but aren't getting it.",
  },
  {
    value: "structural",
    label: "Recurring",
    tooltip: "Crises consistently underfunded over 3+ years.",
  },
  {
    value: "combined",
    label: "Overall",
    tooltip: "Combined view of both emerging and recurring underfunding.",
  },
];

export function ModeToggleBar({
  value,
  sectorActive = false,
}: {
  value: Mode;
  sectorActive?: boolean;
}) {
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
      {OPTIONS.map((opt) => {
        const disabled = sectorActive && opt.value === "structural";
        const title = disabled
          ? "Disabled: cluster-level multi-year funding is too sparse to show recurring trends."
          : opt.tooltip;
        return (
          <ToggleGroup.Item
            key={opt.value}
            value={opt.value}
            title={title}
            disabled={disabled}
            className="h-9 min-w-20 rounded px-3 text-sm data-[state=on]:bg-accent data-[state=on]:text-accent-ink hover:bg-surface-2 data-[state=on]:hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            {opt.label}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
