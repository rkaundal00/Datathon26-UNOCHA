import type { ClusterRow, PopulationGroupRow } from "@/lib/api-types";
import { numCompact, percent, usdCompact } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";

export function ClusterDrilldown({
  clusters,
  populationGroups,
}: {
  clusters: ClusterRow[];
  populationGroups: PopulationGroupRow[];
}) {
  const taxonomyMismatch = clusters.some((c) =>
    c.qa_flags.includes("cluster_taxonomy_mismatch"),
  );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Clusters (by unmet need)</h3>
          <Badge tone={taxonomyMismatch ? "amber" : "neutral"}>
            Source: {taxonomyMismatch ? "raw cluster (globalCluster unavailable)" : "globalCluster (harmonized)"}
          </Badge>
        </div>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-2 py-1.5 text-left">Cluster</th>
                <th className="px-2 py-1.5 text-right">Cluster PIN</th>
                <th className="px-2 py-1.5 text-right">Requirements</th>
                <th className="px-2 py-1.5 text-right">Funding</th>
                <th className="px-2 py-1.5 text-right">Coverage</th>
                <th className="px-2 py-1.5 text-right">Unmet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular">
              {clusters.map((c) => (
                <tr
                  key={c.cluster_name}
                  className={
                    c.coverage_flag === "low"
                      ? "bg-rose-500/5"
                      : ""
                  }
                >
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span>{c.cluster_name}</span>
                      {c.qa_flags.map((f) => (
                        <Badge key={f} tone="amber">{f}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">{numCompact(c.pin_cluster)}</td>
                  <td className="px-2 py-1.5 text-right">{usdCompact(c.requirements_usd)}</td>
                  <td className="px-2 py-1.5 text-right">{usdCompact(c.funding_usd)}</td>
                  <td className="px-2 py-1.5 text-right">{percent(c.coverage_ratio)}</td>
                  <td className="px-2 py-1.5 text-right">{usdCompact(c.unmet_need_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Population groups (PIN disaggregation)</h3>
        <p className="text-[11px] text-text-muted italic mb-2">
          Funding breakdown by population group is not available in FTS. Coverage comparisons are cluster-level only.
        </p>
        {populationGroups.length === 0 ? (
          <p className="text-xs text-text-muted">No disaggregated population groups available for this country-year.</p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border text-sm">
            {populationGroups.slice(0, 20).map((p) => (
              <li key={p.category} className="flex items-center justify-between px-2 py-1.5">
                <span>{p.category}</span>
                <span className="tabular font-semibold">{numCompact(p.pin)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
