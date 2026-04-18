import { SlidesDeck } from "@/components/slides-deck";

export const metadata = {
  title: "Slides — Geo-Insight",
  description: "Presentation deck for the UNOCHA Datathon 2026 submission.",
};

export default function SlidesPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Presentation</h1>
        <p className="text-sm text-muted-foreground">
          Use ← / → to navigate. Placeholder slides — edit in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            src/components/slides-deck.tsx
          </code>
          .
        </p>
      </div>
      <div className="flex-1 px-12">
        <SlidesDeck />
      </div>
    </main>
  );
}
