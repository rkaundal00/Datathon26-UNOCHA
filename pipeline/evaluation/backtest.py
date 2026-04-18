"""2024 back-test — classify movers into 5 classes with rule-based rationale."""
from __future__ import annotations

import polars as pl

from pipeline.transform.country_year import (
    build_country_year_table,
    build_excluded_table,
)

CHRONIC_THRESHOLD = 0.5
INPUT_DELTA_THRESHOLD = 0.15
NOISE_RANK_DELTA = 2


def _load_both_years() -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    t24 = build_country_year_table(2024, 1_000_000, True)
    t25 = build_country_year_table(2025, 1_000_000, True)
    e24 = build_excluded_table(2024, 1_000_000, True)
    e25 = build_excluded_table(2025, 1_000_000, True)
    return t24, t25, e24, e25


def _rank_map(df: pl.DataFrame) -> dict[str, int]:
    df_ranked = df.sort("gap_score", descending=True).with_row_index(
        "rank", offset=1
    )
    return {r["iso3"]: int(r["rank"]) for r in df_ranked.to_dicts()}


def _row_map(df: pl.DataFrame) -> dict[str, dict]:
    return {r["iso3"]: r for r in df.to_dicts()}


def _reason_appeared(iso3: str, excluded24: dict, row25: dict) -> str:
    ex = excluded24.get(iso3)
    reqs25 = int(row25.get("requirements_usd") or 0)
    hrp25 = row25.get("hrp_status")
    pin25 = int(row25.get("pin") or 0)

    if ex is None:
        return "appeared in 2025 ranking (no prior excluded record)"
    if ex["exclusion_reason"] == "no_fts_appeal_record" and reqs25 > 0:
        return f"requirements_usd went 0 → ${reqs25:,}"
    if ex["exclusion_reason"] == "no_active_hrp":
        return f"hrp_status changed → {hrp25}"
    if ex["exclusion_reason"] == "stale_hno":
        return f"HNO 2025 row present; PIN={pin25:,}"
    if ex["exclusion_reason"] == "no_population_baseline":
        return "population baseline resolved in 2025"
    return f"cohort-filter transition (reason {ex['exclusion_reason']} resolved)"


def _reason_dropped(iso3: str, row24: dict, excluded25: dict) -> str:
    ex = excluded25.get(iso3)
    reqs24 = int(row24.get("requirements_usd") or 0)
    hrp24 = row24.get("hrp_status")
    if ex is None:
        return "dropped from 2025 ranking"
    if ex["exclusion_reason"] == "no_fts_appeal_record":
        return f"appeal closed (requirements_usd → 0 from ${reqs24:,})"
    if ex["exclusion_reason"] == "no_active_hrp":
        return f"hrp_status {hrp24} no longer in the required set"
    if ex["exclusion_reason"] == "stale_hno":
        return "HNO row missing in 2025 and 2024 lookups"
    return f"cohort-filter transition ({ex['exclusion_reason']})"


def _classify_mover(row24: dict, row25: dict, delta_rank: int) -> tuple[str, str]:
    pin24 = int(row24["pin"] or 0)
    pin25 = int(row25["pin"] or 0)
    cov24 = float(row24["coverage_ratio"] or 0)
    cov25 = float(row25["coverage_ratio"] or 0)
    hrp24 = row24["hrp_status"]
    hrp25 = row25["hrp_status"]

    def direction(delta):
        return "rose" if delta > 0 else "fell"

    if pin24:
        delta_pin_pct = (pin25 - pin24) / pin24
    else:
        delta_pin_pct = 0
    delta_coverage = cov25 - cov24

    if abs(delta_pin_pct) > INPUT_DELTA_THRESHOLD:
        return (
            "data_grounded",
            f"PIN {direction(pin25 - pin24)} {abs(delta_pin_pct):.0%}",
        )
    if abs(delta_coverage) > INPUT_DELTA_THRESHOLD:
        return (
            "data_grounded",
            f"Coverage shifted from {cov24:.0%} to {cov25:.0%}",
        )

    crossed_threshold = (cov24 < CHRONIC_THRESHOLD) != (cov25 < CHRONIC_THRESHOLD)
    if crossed_threshold:
        return (
            "methodology_sensitive",
            f"chronic_years threshold crossed (coverage {cov24:.0%} → {cov25:.0%})",
        )
    if hrp24 != hrp25:
        return (
            "data_grounded",
            f"Appeal type changed: {hrp24} → {hrp25}",
        )
    if abs(delta_rank) <= NOISE_RANK_DELTA:
        return ("noise", "No material input change; composite variance only")
    return (
        "methodology_sensitive",
        "Composite variance above noise threshold; inputs within 15%",
    )


def backtest_2024() -> pl.DataFrame:
    """Classify every iso3 present in either 2024 or 2025 cohort.

    Returns columns:
      iso3, country, rank_2024, rank_2025, delta_rank, cls, rationale
    """
    t24, t25, e24, e25 = _load_both_years()

    r24 = _rank_map(t24)
    r25 = _rank_map(t25)
    row24 = _row_map(t24)
    row25 = _row_map(t25)
    ex24 = {r["iso3"]: r for r in e24.to_dicts()}
    ex25 = {r["iso3"]: r for r in e25.to_dicts()}

    all_iso3s = sorted(set(r24) | set(r25))
    rows = []
    for iso3 in all_iso3s:
        in24 = iso3 in r24
        in25 = iso3 in r25
        if in25 and not in24:
            row = row25[iso3]
            rationale = _reason_appeared(iso3, ex24, row)
            rows.append(
                {
                    "iso3": iso3,
                    "country": row.get("country", iso3),
                    "rank_2024": None,
                    "rank_2025": r25[iso3],
                    "delta_rank": None,
                    "cls": "cohort_entry",
                    "rationale": f"Appeared in 2025 cohort: {rationale}",
                }
            )
            continue
        if in24 and not in25:
            row = row24[iso3]
            rationale = _reason_dropped(iso3, row, ex25)
            rows.append(
                {
                    "iso3": iso3,
                    "country": row.get("country", iso3),
                    "rank_2024": r24[iso3],
                    "rank_2025": None,
                    "delta_rank": None,
                    "cls": "cohort_exit",
                    "rationale": f"Dropped from 2025 cohort: {rationale}",
                }
            )
            continue

        # Present in both years.
        delta_rank = r25[iso3] - r24[iso3]
        cls, rationale = _classify_mover(row24[iso3], row25[iso3], delta_rank)
        rows.append(
            {
                "iso3": iso3,
                "country": row25[iso3].get("country") or row24[iso3].get("country") or iso3,
                "rank_2024": r24[iso3],
                "rank_2025": r25[iso3],
                "delta_rank": delta_rank,
                "cls": cls,
                "rationale": rationale,
            }
        )
    return pl.DataFrame(rows)


def backtest_summary(back: pl.DataFrame) -> pl.DataFrame:
    total = len(back)
    return (
        back.group_by("cls")
        .agg(pl.len().alias("count"))
        .with_columns((pl.col("count") / total).alias("share"))
        .sort("cls")
    )


def largest_movers(back: pl.DataFrame, top_n: int = 5) -> pl.DataFrame:
    both = back.filter(pl.col("delta_rank").is_not_null())
    return both.with_columns(pl.col("delta_rank").abs().alias("abs_delta")).sort(
        "abs_delta", descending=True
    ).head(top_n)


def transitions(back: pl.DataFrame, direction: str, top_n: int = 5) -> pl.DataFrame:
    cls_label = "cohort_entry" if direction == "entry" else "cohort_exit"
    return back.filter(pl.col("cls") == cls_label).head(top_n)
