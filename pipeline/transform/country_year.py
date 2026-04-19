"""Canonical country-year table — the single input to the ranking surface."""
from __future__ import annotations

import math
from functools import lru_cache

import polars as pl

from pipeline.compute.chronic import chronic_years
from pipeline.compute.composites import coverage_gap, gap_score
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


def _fts_with_year_fallback(
    appeals: pl.DataFrame, analysis_year: int
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Return (fts_aggregates, hrp_status) per iso3 with prior-year fallback applied.

    When analysis_year requirements_usd <= 0 and prior_year > 0, prior-year values
    substitute for both the aggregates and the hrp_status. A boolean column
    `fts_year_fallback` flags every substituted row.
    """
    cur_agg = appeals_country_year(appeals, analysis_year)
    prior_agg = appeals_country_year(appeals, analysis_year - 1).rename(
        {"requirements_usd": "requirements_usd_prior", "funding_usd": "funding_usd_prior"}
    )
    cur_hrp = hrp_status_table(appeals, analysis_year)
    prior_hrp = hrp_status_table(appeals, analysis_year - 1).rename(
        {"hrp_status": "hrp_status_prior"}
    )

    iso3_universe = (
        pl.concat(
            [
                cur_agg.select("iso3"),
                prior_agg.select("iso3"),
                cur_hrp.select("iso3"),
                prior_hrp.select("iso3"),
            ],
            how="vertical",
        )
        .unique()
        .drop_nulls()
    )
    merged = (
        iso3_universe.join(cur_agg, on="iso3", how="left")
        .join(prior_agg, on="iso3", how="left")
        .join(cur_hrp, on="iso3", how="left")
        .join(prior_hrp, on="iso3", how="left")
    )
    merged = merged.with_columns(
        pl.col("requirements_usd").fill_null(0.0),
        pl.col("funding_usd").fill_null(0.0),
        pl.col("requirements_usd_prior").fill_null(0.0),
        pl.col("funding_usd_prior").fill_null(0.0),
        pl.col("hrp_status").fill_null("None"),
        pl.col("hrp_status_prior").fill_null("None"),
    )
    fallback_mask = (pl.col("requirements_usd") <= 0) & (
        pl.col("requirements_usd_prior") > 0
    )
    merged = merged.with_columns(
        fallback_mask.alias("fts_year_fallback"),
        pl.when(fallback_mask)
        .then(pl.col("requirements_usd_prior"))
        .otherwise(pl.col("requirements_usd"))
        .alias("requirements_usd"),
        pl.when(fallback_mask)
        .then(pl.col("funding_usd_prior"))
        .otherwise(pl.col("funding_usd"))
        .alias("funding_usd"),
        pl.when(fallback_mask)
        .then(pl.col("hrp_status_prior"))
        .otherwise(pl.col("hrp_status"))
        .alias("hrp_status"),
    )
    fts_agg = merged.select("iso3", "requirements_usd", "funding_usd", "fts_year_fallback")
    hrp = merged.select("iso3", "hrp_status")
    return fts_agg, hrp


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


def _classify_in_cohort(
    pin: int | None,
    population: int | None,
    requirements_usd: float | None,
    hrp_status: str,
    inform_severity: float | None,
    pin_floor: int,
    valid_types: set,
) -> tuple[bool, list[str]]:
    """Return (is_in_cohort, rescue_flags). rescue_flags is a subset of
    {fts_year_fallback, need_proxy_inform, population_unavailable} that the caller
    should attach to qa_flags. fts_year_fallback is added separately by the caller
    based on the FTS column.

    Rules:
      Strict cohort — pin>=floor, hrp valid, reqs>0, population not null.
      Rescue 1 (population_unavailable) — pin>=floor + hrp valid + reqs>0 + pop null + severity present.
      Rescue 2 (need_proxy_inform) — pin null + hrp valid + reqs>0 + severity present.
      Otherwise excluded.
    """
    reqs = requirements_usd or 0
    if reqs <= 0 or hrp_status == "None" or hrp_status not in valid_types:
        return False, []
    # Strict
    if pin is not None and pin >= pin_floor and population is not None:
        return True, []
    # Rescue 1: missing population only
    if pin is not None and pin >= pin_floor and population is None and inform_severity is not None:
        return True, ["population_unavailable", "need_proxy_inform"]
    # Rescue 2: missing PIN entirely
    if pin is None and inform_severity is not None:
        return True, ["need_proxy_inform"]
    return False, []


def build_country_year_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """One row per **strict-cohort** country for `analysis_year`. Sorted by gap_score desc.

    Strict cohort only — rows missing PIN or COD-PS population are surfaced
    separately via `in_cohort_fallback_table()` because their need-axis math
    differs from the upstream blend `0.5 × pin_share + 0.5 × norm_log10(pin)`.
    Mixing them into the ranked table would put incomparable scores in the
    same column.
    """
    appeals = _cached_appeals()
    admin0 = _cached_admin0()

    hno, _ = _hno_with_fallback(analysis_year)
    population = _nearest_population(admin0, analysis_year)
    names = _cached_country_names()
    fts_agg, hrp = _fts_with_year_fallback(appeals, analysis_year)
    donors = donor_concentration_table(_cached_incoming()) if analysis_year == 2026 else None
    inform_severity = _cached_inform_severity()

    # Universe: any iso3 with HNO or FTS (current or prior year) signal.
    universe = (
        pl.concat(
            [
                hno.select("iso3"),
                fts_agg.filter(pl.col("requirements_usd") > 0).select("iso3"),
            ],
            how="vertical",
        )
        .unique()
        .drop_nulls()
    )

    df = (
        universe.join(hno, on="iso3", how="left")
        .join(names, on="iso3", how="left")
        .join(population, on="iso3", how="left")
        .join(fts_agg, on="iso3", how="left")
        .join(hrp, on="iso3", how="left")
        .join(inform_severity, on="iso3", how="left")
    )
    df = df.with_columns(
        pl.col("requirements_usd").fill_null(0.0),
        pl.col("funding_usd").fill_null(0.0),
        pl.col("hrp_status").fill_null("None"),
        pl.col("fts_year_fallback").fill_null(False),
    )
    # Country name fallback: COD-PS → INFORM → iso3.
    if "inform_country" in df.columns:
        df = df.with_columns(
            pl.coalesce([pl.col("country"), pl.col("inform_country"), pl.col("iso3")]).alias("country")
        )
    else:
        df = df.with_columns(pl.col("country").fill_null(pl.col("iso3")))

    valid_types = STRICT_HRP_TYPES if require_hrp else ANY_HRP_TYPES

    # Per-row classification (strict + rescues).
    rows = df.to_dicts()
    kept: list[dict] = []
    for r in rows:
        in_cohort, rescue_flags = _classify_in_cohort(
            pin=r.get("pin"),
            population=r.get("population"),
            requirements_usd=r.get("requirements_usd"),
            hrp_status=r.get("hrp_status", "None"),
            inform_severity=r.get("inform_severity"),
            pin_floor=pin_floor,
            valid_types=valid_types,
        )
        if not in_cohort:
            continue
        if rescue_flags:
            # Rescued rows leave the ranked table — they appear in
            # `in_cohort_fallback_table()` instead so the gap_score column stays
            # apples-to-apples across all rows it contains.
            continue
        r["_rescue_flags"] = rescue_flags
        kept.append(r)

    if not kept:
        return pl.DataFrame(
            schema={
                "iso3": pl.Utf8,
                "country": pl.Utf8,
                "analysis_year": pl.Int64,
                "pin": pl.Int64,
                "population": pl.Int64,
                "population_reference_year": pl.Int64,
                "pin_share": pl.Float64,
                "requirements_usd": pl.Float64,
                "funding_usd": pl.Float64,
                "coverage_ratio": pl.Float64,
                "unmet_need_usd": pl.Float64,
                "gap_score": pl.Float64,
                "chronic_years": pl.Int8,
                "inform_severity": pl.Float64,
                "donor_concentration": pl.Float64,
                "hrp_status": pl.Utf8,
                "hno_year": pl.Int64,
                "qa_flags": pl.List(pl.Utf8),
            }
        )

    # Compute derived columns per-row (need to handle nullability cleanly).
    for r in kept:
        pin = r.get("pin")
        pop = r.get("population")
        sev = r.get("inform_severity")
        reqs = r.get("requirements_usd") or 0.0
        funds = r.get("funding_usd") or 0.0

        cov = funds / reqs if reqs > 0 else 0.0
        r["coverage_ratio"] = cov
        r["unmet_need_usd"] = max(reqs - funds, 0.0)

        # pin_share = pin / population (per-capita PIN). Null when either is missing.
        if pin is not None and pop is not None and pop > 0:
            r["pin_share"] = pin / pop
        else:
            r["pin_share"] = None

        # gap_score: blended need signal (pin_share + log_pin) for strict rows;
        # severity-based proxy for rescued rows missing pin or population.
        cov_clipped = max(min(cov, 1.0), 0.0)
        if r["pin_share"] is not None and pin is not None:
            log_pin = 0.0 if pin <= 0 else math.log10(max(pin, 1))
            need_axis = 0.5 * max(min(r["pin_share"], 1.0), 0.0) + 0.5 * log_pin
        elif sev is not None:
            need_axis = max(min(sev / 10.0, 1.0), 0.0)
        else:
            need_axis = 0.0
        r["gap_score"] = (1.0 - cov_clipped) * need_axis

    df = pl.from_dicts(kept, infer_schema_length=len(kept))

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

    # Build QA flags (incl. rescue flags from the per-row classification).
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
            fts_year_fallback=bool(row.get("fts_year_fallback")),
            extra_flags=row.get("_rescue_flags") or [],
        )
    out = pl.from_dicts(rows)

    # Clean cast + sort. Allow nullables for pin/population/pin_share.
    out = out.with_columns(
        pl.col("pin").cast(pl.Int64, strict=False),
        pl.col("population").cast(pl.Int64, strict=False),
        pl.col("population_reference_year").cast(pl.Int64, strict=False),
        pl.col("requirements_usd").cast(pl.Float64),
        pl.col("funding_usd").cast(pl.Float64),
        pl.col("coverage_ratio").cast(pl.Float64),
        pl.col("unmet_need_usd").cast(pl.Float64),
        pl.col("pin_share").cast(pl.Float64),
        pl.col("inform_severity").cast(pl.Float64),
        pl.col("gap_score").cast(pl.Float64),
        pl.col("chronic_years").cast(pl.Int8),
        pl.col("hno_year").cast(pl.Int64, strict=False),
        pl.lit(analysis_year).cast(pl.Int64).alias("analysis_year"),
    )
    return out.sort("gap_score", descending=True)


def build_excluded_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """One row per excluded country (failed both strict cohort and all rescue rules)."""
    appeals = _cached_appeals()
    admin0 = _cached_admin0()

    hno, fallback_year = _hno_with_fallback(analysis_year)
    population = _nearest_population(admin0, analysis_year)
    names = _cached_country_names()
    fts_agg, hrp = _fts_with_year_fallback(appeals, analysis_year)
    inform_severity = _cached_inform_severity()

    # Universe: any iso3 with HNO or any FTS appeal (current or prior year).
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
    if "inform_country" in df.columns:
        df = df.with_columns(
            pl.coalesce([pl.col("country"), pl.col("inform_country"), pl.col("iso3")]).alias("country")
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
        sev = r.get("inform_severity")

        # Skip rows that are in cohort (strict OR rescued).
        in_cohort, _ = _classify_in_cohort(
            pin=pin,
            population=pop,
            requirements_usd=reqs,
            hrp_status=hrp_status,
            inform_severity=sev,
            pin_floor=pin_floor,
            valid_types=valid_types,
        )
        if in_cohort:
            continue

        if pin is not None and pin < pin_floor and hrp_status != "None":
            # Below floor — not listed as excluded per spec §4.1 mapping.
            continue

        # Diagnose primary exclusion reason. INFORM-absent rows are still excluded
        # because no rescue could fire; we surface the most upstream missing source.
        reason: str | None = None
        detail = ""
        if pop is None and sev is None:
            reason = "no_population_baseline"
            detail = "Nearest COD-PS reference year missing or unavailable for this ISO3."
        elif pin is None and sev is None:
            reason = "stale_hno"
            detail = f"HNO row missing in both {analysis_year} and {analysis_year - 1}."
        elif hrp_status == "None" or reqs <= 0:
            reason = "no_fts_appeal_record"
            detail = "No FTS appeal of record for this country-year (current or prior)."
        elif hrp_status not in valid_types:
            reason = "no_active_hrp"
            detail = (
                f"hrp_status={hrp_status} is excluded when require_hrp={require_hrp}."
            )
        elif pop is None:
            reason = "no_population_baseline"
            detail = "Nearest COD-PS reference year missing or unavailable for this ISO3."
        elif pin is None:
            reason = "stale_hno"
            detail = f"HNO row missing in both {analysis_year} and {analysis_year - 1}."

        if reason is None:
            continue

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


# Flags considered "fallback markers" — a row carrying any of them was rescued
# and should appear in the "Included via fallback" bucket.
FALLBACK_FLAGS = {"fts_year_fallback", "need_proxy_inform", "population_unavailable"}


def in_cohort_flagged_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """Rows in-cohort that carry at least one non-default QA flag (excluding fallbacks)."""
    table = build_country_year_table(analysis_year, pin_floor, require_hrp)
    rows = []
    for r in table.to_dicts():
        flags = [
            f for f in r["qa_flags"]
            if f != "severity_unavailable" and f not in FALLBACK_FLAGS
        ]
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


def in_cohort_fallback_table(
    analysis_year: int = DEFAULT_ANALYSIS_YEAR,
    pin_floor: int = DEFAULT_PIN_FLOOR,
    require_hrp: bool = DEFAULT_REQUIRE_HRP,
) -> pl.DataFrame:
    """Watch-list of rows that pass a rescue rule but cannot be scored on the
    same axis as the strict cohort.

    Each row is a country with an FTS appeal but missing PIN or COD-PS
    population. These cannot be ranked alongside strict-cohort rows because the
    upstream `0.5 × pin_share + 0.5 × norm_log10(pin)` need axis is undefined.
    The watch list surfaces them with their auditable evidence (severity,
    requirements, funding, unmet) so a coordinator can judge them on the data
    that exists, without contaminating the ranked column with mixed-formula
    scores. Sorted by INFORM Severity desc.
    """
    appeals = _cached_appeals()
    admin0 = _cached_admin0()

    hno, _ = _hno_with_fallback(analysis_year)
    population = _nearest_population(admin0, analysis_year)
    names = _cached_country_names()
    fts_agg, hrp = _fts_with_year_fallback(appeals, analysis_year)
    inform_severity = _cached_inform_severity()

    universe = (
        pl.concat(
            [hno.select("iso3"), fts_agg.filter(pl.col("requirements_usd") > 0).select("iso3")],
            how="vertical",
        )
        .unique()
        .drop_nulls()
    )

    df = (
        universe.join(hno, on="iso3", how="left")
        .join(names, on="iso3", how="left")
        .join(population, on="iso3", how="left")
        .join(fts_agg, on="iso3", how="left")
        .join(hrp, on="iso3", how="left")
        .join(inform_severity, on="iso3", how="left")
    )
    df = df.with_columns(
        pl.col("requirements_usd").fill_null(0.0),
        pl.col("funding_usd").fill_null(0.0),
        pl.col("hrp_status").fill_null("None"),
        pl.col("fts_year_fallback").fill_null(False),
    )
    if "inform_country" in df.columns:
        df = df.with_columns(
            pl.coalesce([pl.col("country"), pl.col("inform_country"), pl.col("iso3")]).alias("country")
        )
    else:
        df = df.with_columns(pl.col("country").fill_null(pl.col("iso3")))

    valid_types = STRICT_HRP_TYPES if require_hrp else ANY_HRP_TYPES

    rows = []
    for r in df.to_dicts():
        in_cohort, rescue_flags = _classify_in_cohort(
            pin=r.get("pin"),
            population=r.get("population"),
            requirements_usd=r.get("requirements_usd"),
            hrp_status=r.get("hrp_status", "None"),
            inform_severity=r.get("inform_severity"),
            pin_floor=pin_floor,
            valid_types=valid_types,
        )
        if not in_cohort or not rescue_flags:
            continue

        all_flags = list(rescue_flags)
        if r.get("fts_year_fallback") and "fts_year_fallback" not in all_flags:
            all_flags.append("fts_year_fallback")

        reqs = float(r.get("requirements_usd") or 0)
        funds = float(r.get("funding_usd") or 0)
        cov = funds / reqs if reqs > 0 else None
        unmet = max(reqs - funds, 0.0)

        rows.append(
            {
                "iso3": r["iso3"],
                "country": r.get("country") or r["iso3"],
                "qa_flags": sorted(all_flags),
                "requirements_usd": int(reqs),
                "funding_usd": int(funds),
                "coverage_ratio": cov,
                "unmet_need_usd": int(unmet),
                "inform_severity": float(r["inform_severity"]) if r.get("inform_severity") is not None else None,
            }
        )

    if not rows:
        return pl.DataFrame(
            schema={
                "iso3": pl.Utf8,
                "country": pl.Utf8,
                "qa_flags": pl.List(pl.Utf8),
                "requirements_usd": pl.Int64,
                "funding_usd": pl.Int64,
                "coverage_ratio": pl.Float64,
                "unmet_need_usd": pl.Int64,
                "inform_severity": pl.Float64,
            }
        )
    return pl.DataFrame(rows).sort(
        "inform_severity", descending=True, nulls_last=True
    )
