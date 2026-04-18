"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mergeUrl } from "@/lib/url-state";
import type { Mode } from "@/lib/api-types";

const SHORTCUTS: { key: string; action: string }[] = [
  { key: "1 / 2 / 3", action: "Switch mode: Acute / Structural / Combined" },
  { key: "a / b", action: "Switch scatter A ↔ B" },
  { key: "w", action: "Toggle custom weights panel (URL ?weights=…)" },
  { key: "e", action: "Export CSV" },
  { key: "u", action: "Copy current URL" },
  { key: "Esc", action: "Close open dialog or clear focus" },
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-4 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Keyboard shortcuts</Dialog.Title>
          <Dialog.Description className="text-xs text-text-muted">
            Shortcuts are active when no input is focused.
          </Dialog.Description>
          <ul className="mt-3 space-y-1 text-sm">
            {SHORTCUTS.map((s) => (
              <li key={s.key} className="flex justify-between">
                <kbd className="rounded border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs">
                  {s.key}
                </kbd>
                <span className="text-text-muted">{s.action}</span>
              </li>
            ))}
          </ul>
          <Dialog.Close className="mt-3 rounded border border-border px-3 py-1 text-sm hover:bg-surface-2">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
