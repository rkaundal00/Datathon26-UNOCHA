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
  const focusIso =
    urlState.focus && ranking.rows.find((r) => r.iso3 === urlState.focus)
      ? urlState.focus
      : ranking.rows[0]?.iso3 ?? null;
  const detail = focusIso ? await fetchCountry(focusIso, apiParams) : null;

  return (
    <>
      <KeyboardShortcuts />
      <div className="sticky top-[53px] z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <ScopeBanner meta={ranking.meta} />
            <ModeToggleBar value={urlState.mode} />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <DataCoverageAnchor
              params={apiParams}
              excludedCount={ranking.meta.excluded_count}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <CustomWeightsPanel
            active={Boolean(urlState.weights)}
            initial={ranking.meta.weights}
          />
          <Suspense
            fallback={
              <div className="text-sm text-muted-foreground">Loading table…</div>
            }
          >
            <CountryTable
              meta={ranking.meta}
              rows={ranking.rows}
              focusIso={focusIso}
            />
          </Suspense>
          <ScatterPanels
            rows={ranking.rows}
            active={urlState.scatter}
            focusIso={focusIso}
          />
        </div>
        <aside className="lg:col-span-4">
          {detail ? (
            <BriefingNote detail={detail} />
          ) : (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
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
