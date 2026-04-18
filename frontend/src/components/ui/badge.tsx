import * as React from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "red" | "amber" | "green" | "indigo";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-text-muted border-border",
  red: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide border",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
