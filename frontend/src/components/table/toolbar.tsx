"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { mergeUrl } from "@/lib/url-state";

export function TableToolbar({
  highlight,
  density,
}: {
  highlight: boolean;
  density: "default" | "detailed";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function patch(v: Record<string, string | null>) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), v);
    router.replace(`/?${qs}`, { scroll: false });
  }

  return (
    <div
      role="toolbar"
      aria-label="Table display"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/30 px-3 py-2 text-xs"
    >
      <button
        type="button"
        aria-pressed={highlight}
        onClick={() => patch({ highlight: highlight ? null : "on" })}
        className={cn(
          "rounded-full border px-2.5 py-1 transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent",
          highlight
            ? "border-accent bg-accent/10 text-text"
            : "border-border text-text-muted",
        )}
        title="Highlight spec-defined thresholds (keyboard: h)"
      >
        <span aria-hidden className="mr-1">
          {highlight ? "◼" : "◻"}
        </span>
        Highlight thresholds
      </button>
      <button
        type="button"
        aria-pressed={density === "detailed"}
        onClick={() => patch({ density: density === "detailed" ? null : "detailed" })}
        className={cn(
          "rounded-full border px-2.5 py-1 transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent",
          density === "detailed"
            ? "border-accent bg-accent/10 text-text"
            : "border-border text-text-muted",
        )}
        title="Show confidence glyphs on every cell, not only imputed (keyboard: d)"
      >
        Density: {density === "detailed" ? "detailed" : "default"}
      </button>
    </div>
  );
}
