"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Map as MapIcon, BarChart3 } from "lucide-react";

const LINKS = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/maps", label: "Maps", icon: MapIcon },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-4 py-2.5">
        <Link
          href={`/${suffix}`}
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
        >
          <Compass className="h-4 w-4 text-map-teal-2" strokeWidth={1.75} />
          <span>CrisisCompass</span>
          <span className="hidden text-[12px] font-normal text-text-muted sm:inline">
            · makes every human life count
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface/70 p-0.5 backdrop-blur">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={`${l.href}${suffix}`}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-foreground/5 text-text shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                    : "text-text-muted hover:text-text",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
