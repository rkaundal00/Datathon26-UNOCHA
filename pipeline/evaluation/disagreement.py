"""Component-vs-composite disagreement cases — surface the top 5."""
from __future__ import annotations

import polars as pl

from pipeline.transform.country_year import build_country_year_table


def disagreement_cases(analysis_year: int = 2025, top_n: int = 5) -> pl.DataFrame:
    """Return the top_n countries where gap_score rank diverges sharply from components.

    disagreement_score(iso3) = max(
        |rank_gap − rank_unmet|,
        |rank_gap − rank_pinshare|
    )
    """
    table = build_country_year_table(analysis_year, 1_000_000, True)
    if len(table) == 0:
        return pl.DataFrame()
    table = table.sort("gap_score", descending=True).with_row_index(
        "rank_gap", offset=1
    )
    table = (
        table.sort("unmet_need_usd", descending=True)
        .with_row_index("rank_unmet", offset=1)
        .sort("pin_share", descending=True)
        .with_row_index("rank_pinshare", offset=1)
        .sort(
            pl.when(pl.col("coverage_ratio") > 1.0)
            .then(pl.lit(0.0))
            .otherwise(1.0 - pl.col("coverage_ratio")),
            descending=True,
        )
        .with_row_index("rank_coverage_gap", offset=1)
    )
    table = table.with_columns(
        pl.max_horizontal(
            (pl.col("rank_gap") - pl.col("rank_unmet")).abs(),
            (pl.col("rank_gap") - pl.col("rank_pinshare")).abs(),
        ).alias("disagreement_score")
    )
    table = table.sort("disagreement_score", descending=True).head(top_n)

    def interpret(r: dict) -> str:
        if r["rank_gap"] < r["rank_unmet"] and r["rank_gap"] < r["rank_pinshare"]:
            return (
                f"{r['country']} ranks higher on the composite than on either absolute "
                "unmet need or proportional burden alone — the composite is combining "
                "moderate signals across both axes."
            )
        if r["rank_gap"] < r["rank_unmet"]:
            return (
                f"{r['country']} ranks above its position on absolute unmet need — the "
                "composite is weighted toward proportional burden (pin_share) here."
            )
        if r["rank_gap"] < r["rank_pinshare"]:
            return (
                f"{r['country']} ranks above its position on proportional burden alone — "
                "the coverage gap is doing the lifting."
            )
        return (
            f"{r['country']} ranks below at least one of its components; the composite "
            "is dampening a loud single-axis signal."
        )

    rows = []
    for r in table.to_dicts():
        rows.append(
            {
                "iso3": r["iso3"],
                "country": r["country"],
                "rank_gap": int(r["rank_gap"]),
                "rank_unmet": int(r["rank_unmet"]),
                "rank_pinshare": int(r["rank_pinshare"]),
                "rank_coverage_gap": int(r["rank_coverage_gap"]),
                "disagreement_score": int(r["disagreement_score"]),
                "interpretation": interpret(r),
            }
        )
    return pl.DataFrame(rows)
