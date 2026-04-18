import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";
import { SiteNavbar } from "@/components/site-navbar";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Geo-Insight — UNOCHA gap analysis",
  description:
    "Which humanitarian crises are most overlooked? A lens over need vs. funding across active HRP cohorts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", "font-sans", geist.variable)}
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <a
          href="#country-table"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-3 focus:py-2 focus:rounded"
        >
          Skip to country table
        </a>
        <SiteNavbar />
        {children}
      </body>
    </html>
  );
}
