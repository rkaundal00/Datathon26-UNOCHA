import { Suspense } from "react";
import { fetchCountry, fetchRanking } from "@/lib/api";
import { apiParamsFromUrlState, parseUrlState } from "@/lib/url-state";
import { ScopeBanner } from "@/components/scope-banner";
import { ModeToggleBar } from "@/components/mode-toggle";
import { CountryTable } from "@/components/country-table";
import { ScatterPanels } from "@/components/scatter-panels";
import { BriefingNote } from "@/components/briefing-note";
import { CustomWeightsPanel } from "@/components/custom-weights-panel";
import { DataCoverageAnchor } from "@/components/data-coverage-modal";
import { Footer } from "@/components/footer";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { CountryDetailSheet } from "@/components/country-detail-sheet";

export const dynamic = "force-dynamic";

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  const urlState = parseUrlState(params);
  const apiParams = apiParamsFromUrlState(urlState);

  const ranking = await fetchRanking(apiParams);
  const focusIso = urlState.focus && ranking.rows.find((r) => r.iso3 === urlState.focus)
    ? urlState.focus
    : ranking.rows[0]?.iso3 ?? null;
  const detailPromise = focusIso ? fetchCountry(focusIso, apiParams) : Promise.resolve(null);
  const detail = await detailPromise;

  return (
    <>
      <KeyboardShortcuts />
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-4 py-3">
          <div className="flex items-center justify-between pb-2">
            <h1 className="text-lg font-bold">
              Geo-Insight <span className="text-text-muted font-normal">· which crises are most overlooked?</span>
            </h1>
            <div className="flex items-center gap-2">
              <ModeToggleBar value={urlState.mode} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ScopeBanner meta={ranking.meta} />
          </div>
          <div className="pt-2 flex items-center gap-3 text-xs">
            <DataCoverageAnchor params={apiParams} excludedCount={ranking.meta.excluded_count} />
            <span className="text-text-muted">Press ? for keyboard shortcuts</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <CustomWeightsPanel
            active={Boolean(urlState.weights)}
            initial={ranking.meta.weights}
          />
          <Suspense fallback={<div className="text-sm text-text-muted">Loading table…</div>}>
            <CountryTable meta={ranking.meta} rows={ranking.rows} focusIso={focusIso} />
          </Suspense>
          <ScatterPanels rows={ranking.rows} active={urlState.scatter} focusIso={focusIso} />
        </div>
        <aside className="lg:col-span-4">
          {detail ? (
            <BriefingNote detail={detail} />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
              Select a country to view its briefing note.
            </div>
          )}
        </aside>
      </main>

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-6">
        <Footer
          meta={ranking.meta}
          params={apiParams}
          calibrationCardHref="https://github.com/"
        />
      </div>

      <CountryDetailSheet
        focusIso={focusIso}
        openTab={urlState.detail}
        params={apiParams}
      />
    </>
  );
}
