"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import type { ColumnMeta } from "@/lib/columns";

export function HeaderPopover({ col }: { col: ColumnMeta }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`About ${col.label}`}
          className="inline-flex items-center justify-center rounded text-text-muted opacity-60 hover:opacity-100 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[360px] rounded-lg border border-border bg-surface p-3 text-xs text-text shadow-lg"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-semibold text-text">{col.displayLabel}</h4>
          <dl className="mt-2 space-y-2">
            <Section label="What" body={col.popover.what} />
            <Section label="How" body={col.popover.how} mono />
            <Section label="Source" body={col.popover.source} />
            <Section label="Why it matters" body={col.popover.whyItMatters} />
          </dl>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Section({
  label,
  body,
  mono = false,
}: {
  label: string;
  body: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-muted">{label}</dt>
      <dd
        className={
          mono
            ? "mt-0.5 break-words font-mono text-[11px] text-text"
            : "mt-0.5 text-text"
        }
      >
        {body}
      </dd>
    </div>
  );
}
