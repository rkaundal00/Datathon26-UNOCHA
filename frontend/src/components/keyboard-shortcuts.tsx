"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mergeUrl } from "@/lib/url-state";
import type { Mode } from "@/lib/api-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
      if (e.key === "Escape" && overlay) setOverlay(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, searchParams, overlay]);

  return (
    <Dialog open={overlay} onOpenChange={setOverlay}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are active when no input is focused.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {s.key}
              </kbd>
              <span className="text-muted-foreground">{s.action}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setOverlay(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
