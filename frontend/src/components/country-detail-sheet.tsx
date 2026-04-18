"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CountryDetailResponse, DetailTab } from "@/lib/api-types";
import { fetchCountry } from "@/lib/api";
import { mergeUrl } from "@/lib/url-state";
import { ClusterDrilldown } from "@/components/cluster-drilldown";
import { TrendView } from "@/components/trend-view";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export function CountryDetailSheet({
  focusIso,
  openTab,
  params,
}: {
  focusIso: string | null;
  openTab: DetailTab | null;
  params: Parameters<typeof fetchCountry>[1];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(Boolean(focusIso && openTab));
  const [data, setData] = useState<CountryDetailResponse | null>(null);

  useEffect(() => {
    setOpen(Boolean(focusIso && openTab));
  }, [focusIso, openTab]);

  useEffect(() => {
    if (!focusIso || !openTab) return;
    let cancel = false;
    fetchCountry(focusIso, params).then((d) => {
      if (!cancel) setData(d);
    });
    return () => {
      cancel = true;
    };
  }, [focusIso, openTab, params]);

  function close() {
    setOpen(false);
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      detail: null,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  function setTab(tab: DetailTab) {
    const qs = mergeUrl(new URLSearchParams(searchParams.toString()), {
      detail: tab,
    });
    router.replace(`/?${qs}`, { scroll: false });
  }

  if (!focusIso) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <SheetContent
        side="bottom"
        className="h-[80vh] overflow-auto sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle>{data?.country.country ?? focusIso}</SheetTitle>
          <SheetDescription>
            Detail sheet — clusters, trend, population groups
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <Tabs
            value={openTab ?? "clusters"}
            onValueChange={(v) => setTab(v as DetailTab)}
          >
            <TabsList>
              {(
                [
                  ["clusters", "Clusters"],
                  ["trend", "Trend"],
                  ["population", "Population groups"],
                ] as [DetailTab, string][]
              ).map(([k, l]) => (
                <TabsTrigger key={k} value={k}>
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="clusters" className="mt-3">
              {data ? (
                <ClusterDrilldown
                  clusters={data.clusters}
                  populationGroups={[]}
                />
              ) : (
                <p className="py-6 text-sm text-muted-foreground">Loading…</p>
              )}
            </TabsContent>
            <TabsContent value="trend" className="mt-3">
              {data ? (
                <TrendView trend={data.trend} year={data.meta.analysis_year} />
              ) : (
                <p className="py-6 text-sm text-muted-foreground">Loading…</p>
              )}
            </TabsContent>
            <TabsContent value="population" className="mt-3">
              {data ? (
                <ClusterDrilldown
                  clusters={[]}
                  populationGroups={data.population_groups}
                />
              ) : (
                <p className="py-6 text-sm text-muted-foreground">Loading…</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
