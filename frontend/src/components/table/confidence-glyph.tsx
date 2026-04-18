"use client";

import * as Popover from "@radix-ui/react-popover";
import type { CountryRow } from "@/lib/api-types";
import { QA_FLAG_LABEL } from "@/lib/api-types";
import type { ColumnMeta } from "@/lib/columns";
import { tierExplanation, tierGlyph } from "@/lib/confidence";
import { cn } from "@/lib/cn";

export function ConfidenceGlyph({
  col,
  row,
  forceVisible = false,
}: {
  col: ColumnMeta;
  row: CountryRow;
  forceVisible?: boolean;
}) {
  const tx = tierExplanation(col, row);
  if (!forceVisible && tx.tier === "authoritative") return null;

  const color =
    tx.tier === "authoritative"
      ? "text-emerald-600 dark:text-emerald-400"
      : tx.tier === "derived"
        ? "text-text-muted"
        : "text-amber-700 dark:text-amber-300";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Confidence: ${tx.heading}`}
          className={cn(
            "ml-1 inline-flex items-baseline rounded text-[11px] leading-none focus-visible:outline-2 focus-visible:outline-accent",
            color,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {tierGlyph(tx.tier)}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[320px] rounded-lg border border-border bg-surface p-3 text-xs text-text shadow-lg"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-semibold text-text">{tx.heading}</h4>
          <p className="mt-1 text-text-muted">{tx.body}</p>
          {tx.flags.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                Flags affecting this value
              </p>
              <ul className="mt-1 space-y-0.5">
                {tx.flags.map((f) => (
                  <li key={f} className="text-text">
                    <span className="font-mono text-[11px] text-text-muted">{f}</span>
                    {" — "}
                    {QA_FLAG_LABEL[f]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
