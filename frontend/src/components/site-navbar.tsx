"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/cn";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/slides", label: "Slides" },
];

export function SiteNavbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 py-2.5">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold tracking-tight"
        >
          <span className="size-5 rounded bg-primary" aria-hidden />
          Geo-Insight
          <span className="hidden text-muted-foreground font-normal sm:inline">
            · which crises are most overlooked?
          </span>
        </Link>
        <NavigationMenu>
          <NavigationMenuList>
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink
                    asChild
                    active={active}
                    className={cn(navigationMenuTriggerStyle(), "h-9")}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>
        <span className="flex-1" />
        <span className="hidden text-xs text-muted-foreground md:inline">
          Press ? for keyboard shortcuts
        </span>
      </div>
    </header>
  );
}
