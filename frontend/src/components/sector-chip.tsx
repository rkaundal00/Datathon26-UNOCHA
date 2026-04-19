"use client";

import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SectorOption } from "@/lib/api-types";

export function SectorChip({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: SectorOption[];
  onChange: (code: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? options.find((o) => o.code === value) : null;
  const availableCount = options.filter((o) => o.available).length;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3 hover:border-text-muted transition-colors"
          title="Re-rank table and map by a single humanitarian sector"
        >
          <span className="text-text-muted">Sector:</span>
          <span className="font-medium">{selected ? selected.name : "All"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[1000] mt-2 w-[260px] max-h-[380px] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
          sideOffset={4}
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Humanitarian sector ({availableCount} available)
          </div>
          <div className="flex flex-col gap-0.5 text-sm">
            <button
              className="flex items-center justify-between rounded px-2.5 py-1.5 text-left hover:bg-surface-2 transition-colors"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span>All sectors</span>
              {value === null && <div className="h-1.5 w-1.5 rounded-full bg-accent"></div>}
            </button>
            <div className="h-px bg-border my-1" />
            {options.map((opt) => {
              const disabled = !opt.available;
              return (
                <button
                  key={opt.code}
                  disabled={disabled}
                  title={disabled ? `No ${opt.code} data reported this year` : undefined}
                  className={
                    "flex items-center justify-between rounded px-2.5 py-1.5 text-left transition-colors " +
                    (disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-surface-2 cursor-pointer")
                  }
                  onClick={() => {
                    if (disabled) return;
                    onChange(opt.code);
                    setOpen(false);
                  }}
                >
                  <span>
                    {opt.name}
                    <span className="ml-1.5 text-[10px] text-text-muted">{opt.code}</span>
                  </span>
                  {value === opt.code && <div className="h-1.5 w-1.5 rounded-full bg-accent"></div>}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
