"use client";

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

const SLIDES: { title: string; body: string }[] = [
  {
    title: "Geo-Insight",
    body: "Which humanitarian crises are most overlooked? A lens over documented need (HNO) vs. funding coverage (FTS) across active HRP cohorts — every ranking decomposes into its components, every exclusion has a visible reason.",
  },
  {
    title: "Default composite",
    body: "gap_score = (1 − min(coverage, 1)) × pin_share. Multiplicative — zeroing either factor zeros the score. Either component is always visible alongside the composite; click any score cell for the inline decomposition.",
  },
];

export function SlidesDeck() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <div className="flex flex-col items-center gap-6">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        className="w-full max-w-4xl"
      >
        <CarouselContent>
          {SLIDES.map((s, i) => (
            <CarouselItem key={i}>
              <Card className="aspect-[16/9] flex items-center justify-center">
                <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
                  <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                    {s.title}
                  </h2>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {s.body}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Slide {i + 1} of {SLIDES.length}
                  </span>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-10" />
        <CarouselNext className="-right-10" />
      </Carousel>
      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label="Slide navigation"
      >
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => api?.scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-selected={i === current}
            role="tab"
            className={
              "h-1.5 rounded-full transition-all " +
              (i === current
                ? "w-8 bg-primary"
                : "w-4 bg-muted hover:bg-muted-foreground/30")
            }
          />
        ))}
      </div>
    </div>
  );
}
