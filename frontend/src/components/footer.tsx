"use client";

import { useEffect, useRef, useState } from "react";
import type { RankingMeta } from "@/lib/api-types";
import { dataFreshnessAgo } from "@/lib/formatters";
import { exportCsvHref } from "@/lib/api";
import type { RankingParams } from "@/lib/api";

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
  const stale = Date.now() - new Date(meta.data_freshness).getTime() > 24 * 60 * 60 * 1000;

  return (
    <footer
      role="contentinfo"
      className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
    >
      <span
        className={stale ? "rounded bg-amber-500/20 px-2 py-0.5 text-amber-700 dark:text-amber-300" : "text-text-muted"}
        title={meta.data_freshness}
      >
      </span>
      <span className="flex-1" />
      <a
        ref={linkRef}
        href={exportCsvHref(params)}
        download
        className="rounded border border-border bg-accent px-2.5 py-1 text-accent-ink hover:opacity-90"
        aria-label="Export current view as CSV (keyboard: E)"
      >
        Export CSV
      </a>
      <button
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          setToast("URL copied — share to reproduce this view.");
          setTimeout(() => setToast(null), 3000);
        }}
        className="rounded border border-border px-2.5 py-1 hover:bg-surface-2"
        aria-label="Copy current view URL to clipboard (keyboard: U)"
      >
        Copy share URL
      </button>
      <a
        href={calibrationCardHref}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-text-muted hover:text-text"
        aria-label="Open calibration card (opens in new tab)"
      >
        Calibration card ↗
      </a>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 rounded-lg bg-accent px-3 py-2 text-sm text-accent-ink shadow-lg"
        >
          {toast}
        </div>
      )}
    </footer>
  );
}
