"use client";

import { useEffect, useRef, useState } from "react";
import type { RankingMeta } from "@/lib/api-types";
import { dataFreshnessAgo } from "@/lib/formatters";
import { exportCsvHref } from "@/lib/api";
import type { RankingParams } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function Footer({
  meta,
  params,
  calibrationCardHref = "/calibration_card.md",
}: {
  meta: RankingMeta;
  params: RankingParams;
  calibrationCardHref?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      if (ae?.getAttribute("role") === "slider") return;
      if (e.key === "e") {
        e.preventDefault();
        linkRef.current?.click();
      } else if (e.key === "u") {
        e.preventDefault();
        navigator.clipboard.writeText(window.location.href);
        setToast("URL copied — share to reproduce this view.");
        setTimeout(() => setToast(null), 3000);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const freshAgo = dataFreshnessAgo(meta.data_freshness);
  const stale =
    Date.now() - new Date(meta.data_freshness).getTime() > 24 * 60 * 60 * 1000;

  return (
    <footer
      role="contentinfo"
      className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs"
    >
      <span
        className={
          stale
            ? "rounded bg-amber-500/20 px-2 py-0.5 text-amber-700 dark:text-amber-300"
            : "text-muted-foreground"
        }
        title={meta.data_freshness}
      >
        Data last refreshed {freshAgo}
      </span>
      <span className="flex-1" />
      <Button asChild size="sm">
        <a
          ref={linkRef}
          href={exportCsvHref(params)}
          download
          aria-label="Export current view as CSV (keyboard: E)"
        >
          Export CSV
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          setToast("URL copied — share to reproduce this view.");
          setTimeout(() => setToast(null), 3000);
        }}
        aria-label="Copy current view URL to clipboard (keyboard: U)"
      >
        Copy share URL
      </Button>
      <Button variant="link" size="sm" asChild className="h-auto p-0">
        <a
          href={calibrationCardHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open calibration card (opens in new tab)"
        >
          Calibration card ↗
        </a>
      </Button>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground shadow-lg"
        >
          {toast}
        </div>
      )}
    </footer>
  );
}
