"use client";

import * as Popover from "@radix-ui/react-popover";
import { CircleX } from "lucide-react";
import type { CountryRow } from "@/lib/api-types";

/**
 * Wraps a coverage or unmet-need cell whose zero value is imputed
 * (funding_imputed_zero flag). Renders the formatted value with a rose tint
 * and an explanatory popover. If no imputation, renders children as-is.
 */
export function ZeroCell({
  row,
  kind,
  children,
}: {
  row: CountryRow;
  kind: "coverage" | "unmet";
  children: React.ReactNode;
}) {
  const imputed = row.qa_flags.includes("funding_imputed_zero");
  if (!imputed) return <>{children}</>;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Funding is an imputed zero — click for detail"
          className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1 py-0.5 text-rose-700 dark:text-rose-300 focus-visible:outline-2 focus-visible:outline-accent"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
          <CircleX className="size-3" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[340px] rounded-lg border border-border bg-surface p-3 text-xs text-text shadow-lg"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-semibold text-text">Funding: imputed zero</h4>
          <p className="mt-1 text-text-muted">
            {kind === "coverage"
              ? "An appeal of record exists for this country-year (requirements > 0), but FTS reports no funding. The 0% coverage shown here is an imputed value, not a confirmed zero."
              : "The full requirements amount is shown as unmet because FTS reports no funding. If funding exists but hasn't been posted to FTS, the real unmet need is smaller."}
          </p>
          <p className="mt-2 text-text-muted">
            Verify at{" "}
            <a
              href="https://fts.unocha.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-mono text-[11px] hover:text-text"
            >
              fts.unocha.org
            </a>{" "}
            before citing.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
