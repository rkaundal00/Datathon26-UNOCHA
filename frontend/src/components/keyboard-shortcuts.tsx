"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mergeUrl } from "@/lib/url-state";
import type { Mode } from "@/lib/api-types";

const SHORTCUTS: { key: string; action: string }[] = [
  { key: "1 / 2 / 3", action: "Switch mode — Acute / Structural / Combined" },
  { key: "a / b", action: "Switch scatter chart view" },
  { key: "e", action: "Export current view as CSV" },
  { key: "u", action: "Copy shareable URL" },
  { key: "Esc", action: "Close dialog / clear focus" },
  { key: "?", action: "Show this overlay" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      if (ae?.getAttribute("role") === "slider") return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOverlay((x) => !x);
        return;
      }
      let mode: Mode | null = null;
      if (e.key === "1") mode = "acute";
      else if (e.key === "2") mode = "structural";
      else if (e.key === "3") mode = "combined";
      if (mode) {
        e.preventDefault();
        const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
          mode,
          sort: null,
        });
        router.replace(`/?${qs}`, { scroll: false });
        return;
      }
      if (e.key === "a" || e.key === "b") {
        e.preventDefault();
        const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
          scatter: e.key,
        });
        router.replace(`/?${qs}`, { scroll: false });
      }
      if (e.key === "Escape") {
        if (overlay) setOverlay(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, searchParams, overlay]);

  return (
    <Dialog.Root open={overlay} onOpenChange={setOverlay}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface-2 p-4 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Keyboard shortcuts</Dialog.Title>
          <Dialog.Description className="text-xs text-text-muted">
            Shortcuts are active when no input is focused.
          </Dialog.Description>
          <div className="mt-3 grid text-sm" style={{ gridTemplateColumns: "80px 1fr" }}>
            <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Key</div>
            <div className="pb-1.5 pl-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Action</div>
            {SHORTCUTS.map((s, i) => (
              <>
                <div key={`key-${s.key}`} className={`flex items-center py-1 pr-2 ${i % 2 === 0 ? "bg-surface-2/50" : ""} rounded-l`}>
                  <kbd className="rounded border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs">
                    {s.key}
                  </kbd>
                </div>
                <div key={`action-${s.key}`} className={`flex items-center border-l border-border py-1 pl-3 ${i % 2 === 0 ? "bg-surface-2/50" : ""} rounded-r`}>
                  <span>{s.action}</span>
                </div>
              </>
            ))}
          </div>
          <Dialog.Close className="mt-3 rounded border border-border px-3 py-1 text-sm hover:bg-surface-2">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
