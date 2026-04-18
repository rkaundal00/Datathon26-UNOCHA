"""Sensitivity sweep — 9 rankings (denominator × cohort floor) + cohort-strictness swap."""
from __future__ import annotations

import polars as pl

from pipeline.compute.chronic import chronic_years
from pipeline.ingest.cod_ps import country_names, load_admin0
from pipeline.ingest.fts import appeals_country_year, hrp_status_table, load_appeals
from pipeline.ingest.hno import country_level_pin_table, load_hno
from pipeline.transform.country_year import (
    ANY_HRP_TYPES,
    STRICT_HRP_TYPES,
    _nearest_population,
)

DENOMINATORS = ("PIN", "Targeted", "Affected")
COHORT_FLOORS = (500_000, 1_000_000, 2_000_000)
DEFAULT_DENOMINATOR = "PIN"
DEFAULT_FLOOR = 1_000_000


def _rank_under_denominator(
    denominator: str,
    floor: int,
    analysis_year: int,
    *,
    require_hrp: bool = True,
) -> pl.DataFrame:
    """Recompute the ranking with `denominator` in place of PIN everywhere PIN appears.

    Returns (iso3, rank, gap_score, coverage_ratio, pin_share).
    """
    column_for = {"PIN": "pin", "Targeted": "targeted", "Affected": "affected"}[denominator]

    hno = country_level_pin_table(load_hno(analysis_year))
    # Fallback to previous year for any iso3 missing in primary.
    prev_hno = country_level_pin_table(load_hno(analysis_year - 1))
    missing = prev_hno.filter(~pl.col("iso3").is_in(hno["iso3"].to_list()))
    hno_all = pl.concat([hno, missing], how="diagonal")

    # Swap the denominator column to pin_like (alias `pin_like`).
    if column_for not in hno_all.columns:
        raise KeyError(f"HNO is missing column {column_for!r}")
    hno_all = hno_all.with_columns(
        pl.col(column_for).alias("pin_like"),
    )

    pop = _nearest_population(load_admin0(), analysis_year)
    appeals = load_appeals()
    fts_agg = appeals_country_year(appeals, analysis_year)
    hrp = hrp_status_table(appeals, analysis_year)
    names = country_names()

    df = (
        hno_all.join(names, on="iso3", how="left")
        .join(pop, on="iso3", how="left")
        .join(fts_agg, on="iso3", how="left")
        .join(hrp, on="iso3", how="left")
        .with_columns(
            pl.col("requirements_usd").fill_null(0.0),
            pl.col("funding_usd").fill_null(0.0),
            pl.col("hrp_status").fill_null("None"),
        )
    )

    valid_types = STRICT_HRP_TYPES if require_hrp else ANY_HRP_TYPES
    df = df.filter(
        (pl.col("pin_like").is_not_null())
        & (pl.col("pin_like") >= floor)
        & (pl.col("hrp_status") != "None")
        & (pl.col("requirements_usd") > 0)
        & pl.col("hrp_status").is_in(list(valid_types))
        & pl.col("population").is_not_null()
    )
    df = df.with_columns(
        (pl.col("pin_like") / pl.col("population")).alias("pin_share"),
        (pl.col("funding_usd") / pl.col("requirements_usd")).alias("coverage_ratio"),
    ).with_columns(
        (
            (1.0 - pl.min_horizontal([pl.col("coverage_ratio"), pl.lit(1.0)]))
            * pl.col("pin_share")
        ).alias("gap_score"),
    )
    df = df.sort("gap_score", descending=True).with_row_index("rank", offset=1)
    return df.select(
        pl.col("iso3"),
        pl.col("rank").cast(pl.Int64),
        pl.col("gap_score"),
        pl.col("coverage_ratio"),
        pl.col("pin_share"),
    )


def sensitivity_sweep(analysis_year: int = 2025) -> pl.DataFrame:
    """Return (definition, iso3, rank, gap_score, is_default) for all 9 rankings."""
    frames: list[pl.DataFrame] = []
    for denom in DENOMINATORS:
        for floor in COHORT_FLOORS:
            label = f"{denom}_{floor // 1_000_000}M" if floor >= 1_000_000 else f"{denom}_{floor // 1_000}k"
            try:
                ranking = _rank_under_denominator(denom, floor, analysis_year)
            except KeyError:
                continue
            ranking = ranking.with_columns(
                pl.lit(label).alias("definition"),
                pl.lit(denom == DEFAULT_DENOMINATOR and floor == DEFAULT_FLOOR).alias(
                    "is_default"
                ),
            )
            frames.append(ranking)
    return pl.concat(frames, how="diagonal")


def sensitivity_summary(sweep_df: pl.DataFrame) -> pl.DataFrame:
    """Per non-default definition: Jaccard top-10, median Δrank, max Δrank, counts."""
    default_label = f"{DEFAULT_DENOMINATOR}_{DEFAULT_FLOOR // 1_000_000}M"
    default = sweep_df.filter(pl.col("definition") == default_label)
    default_top10 = set(
        default.sort("rank").head(10)["iso3"].to_list()
    )
    default_iso3s = set(default["iso3"].to_list())

    rows = []
    definitions = sweep_df["definition"].unique().to_list()
    for definition in sorted(definitions):
        sub = sweep_df.filter(pl.col("definition") == definition)
        swap_top10 = set(sub.sort("rank").head(10)["iso3"].to_list())
        intersection = default_top10 & swap_top10
        union = default_top10 | swap_top10
        jaccard = len(intersection) / len(union) if union else 1.0
        swap_iso3s = set(sub["iso3"].to_list())
        dropped = sorted(default_iso3s - swap_iso3s)
        added = sorted(swap_iso3s - default_iso3s)

        # rank deltas on iso3s ranked in both
        default_ranks = {r["iso3"]: r["rank"] for r in default.to_dicts()}
        deltas = [
            abs(default_ranks[r["iso3"]] - r["rank"])
            for r in sub.to_dicts()
            if r["iso3"] in default_ranks
        ]
        median_delta = sorted(deltas)[len(deltas) // 2] if deltas else 0
        max_delta = max(deltas) if deltas else 0
        rows.append(
            {
                "definition": definition,
                "cohort_size": len(sub),
                "jaccard_top10": jaccard if definition != default_label else 1.0,
                "median_rank_delta": median_delta,
                "max_rank_delta": max_delta,
                "countries_dropped": dropped,
                "countries_added": added,
                "is_default": definition == default_label,
            }
        )
    return pl.DataFrame(rows)


def cohort_strictness_swap(analysis_year: int = 2025) -> dict:
    """Single comparison: require_hrp=true vs require_hrp=false."""
    default = _rank_under_denominator(DEFAULT_DENOMINATOR, DEFAULT_FLOOR, analysis_year, require_hrp=True)
    relaxed = _rank_under_denominator(
        DEFAULT_DENOMINATOR, DEFAULT_FLOOR, analysis_year, require_hrp=False
    )
    default_top10 = set(default.head(10)["iso3"].to_list())
    relaxed_top10 = set(relaxed.head(10)["iso3"].to_list())
    intersection = default_top10 & relaxed_top10
    union = default_top10 | relaxed_top10
    jaccard = len(intersection) / len(union) if union else 1.0

    default_ranks = {r["iso3"]: r["rank"] for r in default.to_dicts()}
    relaxed_ranks = {r["iso3"]: r["rank"] for r in relaxed.to_dicts()}
    common = set(default_ranks) & set(relaxed_ranks)
    deltas = [abs(default_ranks[i] - relaxed_ranks[i]) for i in common]
    median_delta = sorted(deltas)[len(deltas) // 2] if deltas else 0
    max_delta = max(deltas) if deltas else 0

    appeals = load_appeals()
    hrp = hrp_status_table(appeals, analysis_year)
    hrp_map = {r["iso3"]: r["hrp_status"] for r in hrp.to_dicts()}

    added_by_relaxation = [
        {
            "iso3": iso3,
            "hrp_status": hrp_map.get(iso3, "Unknown"),
            "rank_in_relaxed": relaxed_ranks[iso3],
        }
        for iso3 in (set(relaxed_ranks) - set(default_ranks))
    ]

    return {
        "default": {
            "cohort_size": len(default),
            "top10": default.head(10)["iso3"].to_list(),
        },
        "relaxed": {
            "cohort_size": len(relaxed),
            "top10": relaxed.head(10)["iso3"].to_list(),
        },
        "jaccard_top10": jaccard,
        "countries_added_by_relaxation": added_by_relaxation,
        "rank_delta_median": median_delta,
        "rank_delta_max": max_delta,
    }
