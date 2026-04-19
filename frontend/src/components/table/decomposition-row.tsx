import type { CountryRow, RankingMeta } from "@/lib/api-types";
import type { Decomposable } from "@/lib/columns";
import { numCompact, percent, usdCompact } from "@/lib/formatters";

export function DecompositionRow({
  row,
  meta,
  column,
  colSpan,
}: {
  row: CountryRow;
  meta: RankingMeta;
  column: Decomposable;
  colSpan: number;
}) {
  return (
    <tr className="bg-surface-2/60">
      <td colSpan={colSpan} className="px-4 py-2 text-xs text-text-muted">
        {renderBody(row, meta, column)}
      </td>
    </tr>
  );
}

function renderBody(row: CountryRow, meta: RankingMeta, column: Decomposable) {
  switch (column) {
    case "gap_score":
      {
        const shortfall = 1 - Math.min(row.coverage_ratio, 1);
        const logPin = Math.max(0, Math.min(1, (Math.log10(Math.max(row.pin, 1)) - 6) / (8.3 - 6)));
        const need = 0.5 * row.pin_share + 0.5 * logPin;
        return (
          <span>
            <strong className="text-text">Gap score decomposition:</strong>{" "}
            shortfall × (0.5 × pin_share + 0.5 × log_pin) ={" "}
            {shortfall.toFixed(3)} × (0.5 × {row.pin_share.toFixed(3)} + 0.5 × {logPin.toFixed(3)}) ={" "}
            {shortfall.toFixed(3)} × {need.toFixed(3)} ={" "}
            <strong className="text-text">{row.gap_score.toFixed(3)}</strong>
          </span>
        );
      }
    case "custom_gap_score": {
      if (row.custom_gap_score == null || meta.weights == null) {
        return <span>Custom weights are not active for this row.</span>;
      }
      const covGap = 1 - Math.min(row.coverage_ratio, 1);
      const chrNorm = row.chronic_years / 5;
      return (
        <span>
          <strong className="text-text">Custom composite:</strong>{" "}
          {meta.weights.w_coverage.toFixed(2)} × {covGap.toFixed(3)} +{" "}
          {meta.weights.w_pin.toFixed(2)} × {row.pin_share.toFixed(3)} +{" "}
          {meta.weights.w_chronic.toFixed(2)} × {chrNorm.toFixed(3)} ={" "}
          <strong className="text-text">{row.custom_gap_score.toFixed(3)}</strong>
        </span>
      );
    }
    case "coverage_ratio":
      return (
        <span>
          <strong className="text-text">Coverage decomposition:</strong>{" "}
          {usdCompact(row.funding_usd)} funded ÷ {usdCompact(row.requirements_usd)} required ={" "}
          <strong className="text-text">{percent(row.coverage_ratio)}</strong>
          {row.coverage_ratio > 1 && (
            <span className="ml-2">
              (overfunded by {percent(row.coverage_ratio - 1)})
            </span>
          )}
        </span>
      );
    case "pin_share":
      return (
        <span>
          <strong className="text-text">PIN share decomposition:</strong>{" "}
          {numCompact(row.pin)} PIN ÷ {numCompact(row.population)} population (ref{" "}
          {row.population_reference_year}) ={" "}
          <strong className="text-text">{percent(row.pin_share)}</strong>
        </span>
      );
    case "unmet_need_usd":
      return (
        <span>
          <strong className="text-text">Unmet need decomposition:</strong>{" "}
          max(0, {usdCompact(row.requirements_usd)} required − {usdCompact(row.funding_usd)} funded) ={" "}
          <strong className="text-text">{usdCompact(row.unmet_need_usd)}</strong>
        </span>
      );
  }
}
