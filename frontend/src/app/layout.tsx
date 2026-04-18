import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Geo-Insight — UNOCHA gap analysis",
  description:
    "Which humanitarian crises are most overlooked? A lens over need vs. funding across active HRP cohorts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen flex flex-col bg-bg text-text">
        <a
          href="#country-table"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:text-accent-ink focus:px-3 focus:py-2 focus:rounded"
        >
          Skip to country table
        </a>
        <TooltipProvider delayDuration={200} skipDelayDuration={100}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
