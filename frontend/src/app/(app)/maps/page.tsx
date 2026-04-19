import { fetchCoverage, fetchRanking } from "@/lib/api";
import { apiParamsFromUrlState, parseUrlState } from "@/lib/url-state";
import { mergeRankingAndCoverage } from "@/components/maps/map-data";
import { MapsView } from "@/components/maps/maps-view";

export const dynamic = "force-dynamic";

export default async function MapsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  const urlState = parseUrlState(params);
  const apiParams = apiParamsFromUrlState(urlState);

  const [ranking, coverage] = await Promise.all([
    fetchRanking(apiParams),
    fetchCoverage(apiParams),
  ]);

  const rowsMap = mergeRankingAndCoverage(ranking, coverage);
  const rows = Array.from(rowsMap.values());
  const focusIso = urlState.focus ?? null;

  return (
    <MapsView
      year={urlState.year}
      metric={urlState.metric}
      focusIso={focusIso}
      rows={rows}
      meta={ranking.meta}
      apiParams={apiParams}
    />
  );
}
