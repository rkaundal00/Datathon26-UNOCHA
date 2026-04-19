"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CountryDetailResponse, DetailTab } from "@/lib/api-types";
import { fetchCountry } from "@/lib/api";
import { mergeUrl } from "@/lib/url-state";
import { ClusterDrilldown } from "@/components/cluster-drilldown";
import { TrendView } from "@/components/trend-view";

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
  const [data, setData] = useState<CountryDetailResponse | null>(null);

  const open = Boolean(focusIso && openTab);

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!focusIso || !openTab) return;
    let cancel = false;
    fetchCountry(focusIso, JSON.parse(paramsKey)).then((d) => {
      if (!cancel) setData(d);
    });
    return () => {
      cancel = true;
    };
  }, [focusIso, openTab, paramsKey]);

  function close() {
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
    <Dialog.Root open={open} onOpenChange={(o) => (!o && close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 bottom-0 z-50 h-[80vh] w-[min(960px,calc(100%-2rem))] -translate-x-1/2 rounded-t-lg border border-border bg-surface p-4 shadow-xl overflow-auto">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {data?.country.country ?? focusIso}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-text-muted">
                Detail sheet — clusters, trend, population groups
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-text-muted hover:bg-surface-2">✕</Dialog.Close>
          </div>
          <Tabs.Root
            value={openTab ?? "clusters"}
            onValueChange={(v) => setTab(v as DetailTab)}
            className="mt-3"
          >
            <Tabs.List className="mb-2 flex gap-2 border-b border-border">
              {(
                [
                  ["clusters", "Clusters"],
                  ["trend", "Trend"],
                  ["population", "Population groups"],
                ] as [DetailTab, string][]
              ).map(([k, l]) => (
                <Tabs.Trigger
                  key={k}
                  value={k}
                  className="border-b-2 border-transparent px-3 py-1.5 text-sm data-[state=active]:border-accent data-[state=active]:text-text"
                >
                  {l}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="clusters">
              {data ? (
                <ClusterDrilldown
                  clusters={data.clusters}
                  populationGroups={[]}
                />
              ) : (
                <p className="text-sm text-text-muted py-6">Loading…</p>
              )}
            </Tabs.Content>
            <Tabs.Content value="trend">
              {data ? (
                <TrendView trend={data.trend} year={data.meta.analysis_year} />
              ) : (
                <p className="text-sm text-text-muted py-6">Loading…</p>
              )}
            </Tabs.Content>
            <Tabs.Content value="population">
              {data ? (
                <ClusterDrilldown
                  clusters={[]}
                  populationGroups={data.population_groups}
                />
              ) : (
                <p className="text-sm text-text-muted py-6">Loading…</p>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
