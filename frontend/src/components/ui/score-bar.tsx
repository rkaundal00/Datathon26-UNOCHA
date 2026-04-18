import { cn } from "@/lib/cn";

export function ScoreBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const color =
    pct >= 0.4
      ? "bg-[color:var(--color-score-high)]"
      : pct >= 0.2
        ? "bg-[color:var(--color-score-mid)]"
        : "bg-[color:var(--color-score-low)]";
  return (
    <div
      className={cn(
        "h-1.5 rounded-full bg-surface-2 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn("h-full", color)}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function ChronicDots({ value }: { value: number }) {
  const n = Math.max(0, Math.min(5, value));
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      aria-label={`${n} of 5 years chronically underfunded`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-2 rounded-full",
            i < n
              ? "bg-[color:var(--color-score-high)]"
              : "bg-surface-2 border border-border",
          )}
        />
      ))}
    </span>
  );
}
