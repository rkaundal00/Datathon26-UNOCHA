"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

export function MapDropdown({
  value,
  onChange,
  options,
  label,
  minWidth = 180,
}: {
  value: string;
  onChange: (next: string) => void;
  options: DropdownOption[];
  label: string;
  minWidth?: number;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={label}
        style={{ minWidth }}
        className="group inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-border bg-surface/80 px-3 text-[13px] font-medium text-text shadow-[0_1px_0_0_rgba(0,0,0,0.02)] backdrop-blur transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-map-teal-2/40"
      >
        <span className="flex items-baseline gap-2 overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </span>
          <Select.Value />
        </span>
        <Select.Icon>
          <ChevronDown
            className="h-3.5 w-3.5 text-text-muted transition-transform group-data-[state=open]:rotate-180"
            strokeWidth={2}
          />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[1000] overflow-hidden rounded-xl border border-border bg-surface/95 p-1 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md popover-animate"
        >
          <Select.Viewport className="flex flex-col gap-0.5">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-7 pr-3 text-[13px] outline-none transition-colors data-[highlighted]:bg-foreground/5 data-[state=checked]:text-text"
              >
                <Select.ItemIndicator className="absolute left-2 inline-flex h-3.5 w-3.5 items-center justify-center text-map-teal-3">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </Select.ItemIndicator>
                <Select.ItemText>{o.label}</Select.ItemText>
                {o.hint && (
                  <span className="ml-auto text-[10px] text-text-muted">{o.hint}</span>
                )}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
