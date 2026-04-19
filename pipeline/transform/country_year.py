"""Canonical country-year table — the single input to the ranking surface."""
from __future__ import annotations

from functools import lru_cache

import polars as pl

from pipeline.compute.chronic import chronic_years
from pipeline.compute.composites import coverage_gap, gap_score, _LOG_PIN_MIN, _LOG_PIN_MAX
from pipeline.compute.donor_hhi import donor_concentration_table
from pipeline.config import (
    DEFAULT_ANALYSIS_YEAR,
    DEFAULT_PIN_FLOOR,
    DEFAULT_REQUIRE_HRP,
)
from pipeline.ingest.cod_ps import country_names, load_admin0
from pipeline.ingest.fts import (
    appeals_country_year,
    hrp_status_table,
    load_appeals,
    load_incoming_2026,
)
from pipeline.ingest.hno import country_level_pin_table, load_hno
from pipeline.ingest.inform import ingest_inform_severity
from pathlib import Path
from pipeline.transform.qa import build_flags

STRICT_HRP_TYPES = {"HRP", "FlashAppeal", "RegionalRP"}
ANY_HRP_TYPES = STRICT_HRP_TYPES | {"Other", "Unknown"}


def _nearest_population(
    admin0: pl.DataFrame, analysis_year: int
) -> pl.DataFrame:
    """One row per iso3 with (population, reference_year) for the nearest year ≤ analysis_year."""
    eligible = admin0.filter(pl.col("reference_year") <= analysis_year)
    return (
        eligible.sort(["iso3", "reference_year"], descending=[False, True])
        .group_by("iso3", maintain_order=True)
        .agg(
            pl.col("population").first(),
            pl.col("reference_year").first().alias("population_reference_year"),
        )
    )


def _hno_with_fallback(analysis_year: int) -> tuple[pl.DataFrame, int]:
    """Load HNO for analysis_year; add hno_year column recording where the row came from."""
    primary = country_level_pin_table(load_hno(analysis_year)).with_columns(
        pl.lit(analysis_year).alias("hno_year")
    )
    fallback_year = analysis_year - 1
    if fallback_year in (2024, 2025, 2026):
        present = set(primary["iso3"].to_list())
        fallback = country_level_pin_table(load_hno(fallback_year)).filter(
            ~pl.col("iso3").is_in(list(present))
        ).with_columns(pl.lit(fallback_year).alias("hno_year"))
        primary = pl.concat([primary, fallback], how="diagonal")
    return primary, fallback_year


@lru_cache(maxsize=16)
def _cached_appeals() -> pl.DataFrame:
    return load_appeals()


@lru_cache(maxsize=1)
def _cached_incoming() -> pl.DataFrame:
    return load_incoming_2026()


@lru_cache(maxsize=1)
def _cached_admin0() -> pl.DataFrame:
    return load_admin0()


@lru_cache(maxsize=1)
def _cached_inform_severity() -> pl.DataFrame:
    return ingest_inform_severity(Path("datasets"))

@lru_cache(maxsize=1)
def _cached_country_names() -> pl.DataFrame:
    return country_names()


def build_country_year_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """One row per in-cohort country for `analysis_year`. Sorted by gap_score desc.

    See spec-data-pipeline.md §4.1 for the authoritative column list and build order.
    """
    appeals = _cached_appeals()
    admin0 = _cached_admin0()

    hno, _ = _hno_with_fallback(analysis_year)
    population = _nearest_population(admin0, analysis_year)
    names = _cached_country_names()
    fts_agg = appeals_country_year(appeals, analysis_year)
    hrp = hrp_status_table(appeals, analysis_year)
    donors = donor_concentration_table(_cached_incoming()) if analysis_year == 2026 else None
    inform_severity = _cached_inform_severity()

    df = (
        hno.join(names, on="iso3", how="left")
        .join(population, on="iso3", how="left")
        .join(fts_agg, on="iso3", how="left")
        .join(hrp, on="iso3", how="left")
        .join(inform_severity, on="iso3", how="left")
    )
    df = df.with_columns(
        pl.col("requirements_usd").fill_null(0.0),
        pl.col("funding_usd").fill_null(0.0),
        pl.col("hrp_status").fill_null("None"),
    )

    # Apply cohort filter — see §4.1 step 5.
    valid_types = STRICT_HRP_TYPES if require_hrp else ANY_HRP_TYPES
    df = df.filter(
        (pl.col("pin") >= pin_floor)
        & (pl.col("hrp_status") != "None")
        & (pl.col("requirements_usd") > 0)
        & pl.col("hrp_status").is_in(list(valid_types))
        & pl.col("population").is_not_null()
    )

    # Derived columns.
    df = df.with_columns(
        (pl.col("pin") / pl.col("population")).alias("pin_share"),
        (pl.col("funding_usd") / pl.col("requirements_usd")).alias("coverage_ratio"),
        pl.when(pl.col("requirements_usd") > pl.col("funding_usd"))
        .then(pl.col("requirements_usd") - pl.col("funding_usd"))
        .otherwise(0.0)
        .alias("unmet_need_usd"),
    ).with_columns(
        # Normalized log10(PIN) for the blended need signal.
        (
            (pl.col("pin").cast(pl.Float64).log(10) - _LOG_PIN_MIN)
            / (_LOG_PIN_MAX - _LOG_PIN_MIN)
        ).clip(0.0, 1.0).alias("_norm_log_pin"),
    ).with_columns(
        (
            (1.0 - pl.min_horizontal([pl.col("coverage_ratio"), pl.lit(1.0)]))
            * (0.5 * pl.col("pin_share") + 0.5 * pl.col("_norm_log_pin"))
        ).alias("gap_score"),
    ).drop("_norm_log_pin")

    # chronic_years per country.
    chronic_col = pl.Series(
        "chronic_years",
        [chronic_years(iso, analysis_year, appeals) for iso in df["iso3"].to_list()],
        dtype=pl.Int8,
    )
    df = df.with_columns(chronic_col)

    # donor_concentration per country (2026 only).
    if donors is not None:
        df = df.join(donors, on="iso3", how="left")
    else:
        df = df.with_columns(pl.lit(None, dtype=pl.Float64).alias("donor_concentration"))

    # Build QA flags.
    rows = df.to_dicts()
    for row in rows:
        row["qa_flags"] = build_flags(
            analysis_year=analysis_year,
            hno_row_year=int(row["hno_year"]) if row.get("hno_year") is not None else None,
            population_reference_year=(
                int(row["population_reference_year"])
                if row.get("population_reference_year") is not None
                else None
            ),
            requirements_usd=row.get("requirements_usd"),
            funding_usd=row.get("funding_usd"),
            donor_concentration=row.get("donor_concentration"),
            hrp_status=row.get("hrp_status", "None"),
            inform_severity=row.get("inform_severity"),
        )
    out = pl.from_dicts(rows)

    # Clean cast + sort.
    out = out.with_columns(
        pl.col("pin").cast(pl.Int64),
        pl.col("population").cast(pl.Int64),
        pl.col("population_reference_year").cast(pl.Int64),
        pl.col("requirements_usd").cast(pl.Float64),
        pl.col("funding_usd").cast(pl.Float64),
        pl.col("coverage_ratio").cast(pl.Float64),
        pl.col("unmet_need_usd").cast(pl.Float64),
        pl.col("pin_share").cast(pl.Float64),
        pl.col("inform_severity").cast(pl.Float64),
        pl.col("gap_score").cast(pl.Float64),
        pl.col("chronic_years").cast(pl.Int8),
        pl.col("hno_year").cast(pl.Int64),
        pl.lit(analysis_year).cast(pl.Int64).alias("analysis_year"),
    )
    return out.sort("gap_score", descending=True)


def build_excluded_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """One row per excluded country with {iso3, country, pin, exclusion_reason, detail}."""
    appeals = _cached_appeals()
    admin0 = _cached_admin0()

    hno, fallback_year = _hno_with_fallback(analysis_year)
    population = _nearest_population(admin0, analysis_year)
    names = _cached_country_names()
    fts_agg = appeals_country_year(appeals, analysis_year)
    hrp = hrp_status_table(appeals, analysis_year)
    inform_severity = _cached_inform_severity()

    # Universe: any iso3 with real signal of a current crisis — an HNO row in
    # analysis_year or the fallback year, or an FTS appeal with requirements > 0.
    # Countries with no signal at all are simply out of scope, not "excluded."
    fts_with_reqs = fts_agg.filter(pl.col("requirements_usd") > 0).select("iso3")
    universe = (
        pl.concat([hno.select("iso3"), fts_with_reqs], how="vertical")
        .unique()
        .drop_nulls()
    )

    df = (
        universe.join(names, on="iso3", how="left")
        .join(hno.select("iso3", "pin", "hno_year"), on="iso3", how="left")
        .join(population, on="iso3", how="left")
        .join(fts_agg, on="iso3", how="left")
        .join(hrp, on="iso3", how="left")
        .join(inform_severity, on="iso3", how="left")
    )
    df = df.with_columns(
        pl.col("requirements_usd").fill_null(0.0),
        pl.col("funding_usd").fill_null(0.0),
        pl.col("hrp_status").fill_null("None"),
    )

    valid_types = STRICT_HRP_TYPES if require_hrp else ANY_HRP_TYPES

    rows = []
    for r in df.to_dicts():
        iso3 = r["iso3"]
        country = r.get("country") or iso3
        pin = r.get("pin")
        pop = r.get("population")
        reqs = r.get("requirements_usd") or 0
        hrp_status = r.get("hrp_status") or "None"

        if pin is not None and pin < pin_floor and hrp_status != "None":
            # Below floor — not listed as excluded per spec §4.1 mapping.
            continue

        reason: str | None = None
        detail = ""
        if pop is None:
            reason = "no_population_baseline"
            detail = "Nearest COD-PS reference year missing or unavailable for this ISO3."
        elif pin is None:
            reason = "stale_hno"
            detail = f"HNO row missing in both {analysis_year} and {analysis_year - 1}."
        elif hrp_status == "None" or reqs <= 0:
            reason = "no_fts_appeal_record"
            detail = "No FTS appeal of record for this country-year."
        elif hrp_status not in valid_types:
            reason = "no_active_hrp"
            detail = (
                f"hrp_status={hrp_status} is excluded when require_hrp={require_hrp}."
            )

        if reason is None:
            continue  # In cohort; not excluded.

        import math
        import math
        reqs_val = reqs or 0.0
        fund_val = r.get("funding_usd") or 0.0
        cov = fund_val / reqs_val if reqs_val > 0 else None
        if cov is not None and math.isinf(cov): cov = None
        if cov is not None and math.isnan(cov): cov = None
        if reqs_val is not None and math.isnan(reqs_val): reqs_val = 0.0
        if reqs_val is not None and math.isinf(reqs_val): reqs_val = 0.0
        
        rows.append(
            {
                "iso3": iso3,
                "country": country,
                "pin": int(pin) if pin is not None else None,
                "requirements_usd": reqs_val,
                "funding_usd": fund_val,
                "coverage_ratio": cov,
                "exclusion_reason": reason,
                "detail": detail,
            }
        )

    if not rows:
        return pl.DataFrame(
            schema={
                "iso3": pl.Utf8,
                "country": pl.Utf8,
                "pin": pl.Int64,
                "exclusion_reason": pl.Utf8,
                "detail": pl.Utf8,
            }
        )
    return pl.DataFrame(rows).sort(["exclusion_reason", "iso3"])


def in_cohort_flagged_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """Rows in-cohort that carry at least one non-default QA flag (beyond severity_unavailable)."""
    table = build_country_year_table(analysis_year, pin_floor, require_hrp)
    rows = []
    for r in table.to_dicts():
        flags = [f for f in r["qa_flags"] if f != "severity_unavailable"]
        if flags:
            rows.append(
                {"iso3": r["iso3"], "country": r["country"], "qa_flags": flags}
            )
    if not rows:
        return pl.DataFrame(
            schema={
                "iso3": pl.Utf8,
                "country": pl.Utf8,
                "qa_flags": pl.List(pl.Utf8),
            }
        )
    return pl.DataFrame(rows)
