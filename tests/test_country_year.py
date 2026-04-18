"""Canonical country-year table — cohort filter, score math, fixture matching."""
from __future__ import annotations

import json
from pathlib import Path

import polars as pl
import pytest

from pipeline.transform.country_year import (
    build_country_year_table,
    build_excluded_table,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def test_table_non_empty_for_default_params():
    t = build_country_year_table(2025, 1_000_000, True)
    assert len(t) > 0
    assert "gap_score" in t.columns
    assert "qa_flags" in t.columns


def test_sorted_by_gap_score_desc():
    t = build_country_year_table(2025, 1_000_000, True)
    scores = t["gap_score"].to_list()
    assert scores == sorted(scores, reverse=True)


def test_gap_score_matches_multiplicative_formula():
    t = build_country_year_table(2025, 1_000_000, True)
    for row in t.to_dicts():
        cov = min(max(row["coverage_ratio"], 0.0), 1.0)
        expected = (1.0 - cov) * row["pin_share"]
        assert row["gap_score"] == pytest.approx(expected, rel=1e-6, abs=1e-9)


def test_cohort_filter_excludes_none_plans():
    t = build_country_year_table(2025, 1_000_000, True)
    hrp_statuses = set(t["hrp_status"].to_list())
    assert "None" not in hrp_statuses


def test_cohort_filter_excludes_zero_requirements():
    t = build_country_year_table(2025, 1_000_000, True)
    assert (t["requirements_usd"] > 0).all()


def test_pin_floor_boundary():
    t_1m = build_country_year_table(2025, 1_000_000, True)
    t_2m = build_country_year_table(2025, 2_000_000, True)
    # tightening the floor never adds countries
    assert len(t_2m) <= len(t_1m)
    # every country in the 2M cohort has pin >= 2M
    assert (t_2m["pin"] >= 2_000_000).all()


def test_require_hrp_false_is_superset():
    strict = build_country_year_table(2025, 1_000_000, True)
    relaxed = build_country_year_table(2025, 1_000_000, False)
    assert set(strict["iso3"].to_list()).issubset(set(relaxed["iso3"].to_list()))


def test_excluded_table_reasons_are_enum_members():
    e = build_excluded_table(2025, 1_000_000, True)
    reasons = set(e["exclusion_reason"].to_list()) if len(e) > 0 else set()
    assert reasons.issubset(
        {
            "no_active_hrp",
            "stale_hno",
            "no_fts_appeal_record",
            "no_population_baseline",
        }
    )


def test_donor_concentration_is_none_for_non_2026_years():
    t = build_country_year_table(2025, 1_000_000, True)
    # 2025 → donor_concentration should be null for every row
    assert t["donor_concentration"].is_null().all()


def test_donor_concentration_populated_for_2026():
    t = build_country_year_table(2026, 1_000_000, True)
    # at least one row should have a non-null HHI
    assert t["donor_concentration"].is_not_null().any()


@pytest.mark.parametrize("iso3", ["SDN", "TCD", "YEM"])
def test_fixture_matches_pipeline(iso3: str):
    """Regression test: each fixture JSON pins the expected CountryRow for SDN/TCD/YEM.

    Fixtures are committed after hand-verification of the core numbers. If this
    fails, either the pipeline changed behavior or the underlying Parquet shifted.
    """
    fixture_path = FIXTURE_DIR / f"{iso3.lower()}.json"
    if not fixture_path.exists():
        pytest.skip(f"fixture {fixture_path.name} not committed yet")
    with fixture_path.open() as fh:
        expected = json.load(fh)

    t = build_country_year_table(expected["analysis_year"], 1_000_000, True)
    match = t.filter(pl.col("iso3") == iso3)
    if match.is_empty():
        if expected.get("expected_in_cohort", True):
            pytest.fail(f"{iso3} missing from cohort but fixture expects it")
        return

    row = match.row(0, named=True)
    exp = expected["expected_country_row"]
    assert row["pin"] == exp["pin"]
    assert row["requirements_usd"] == pytest.approx(exp["requirements_usd"])
    assert row["funding_usd"] == pytest.approx(exp["funding_usd"])
    assert row["coverage_ratio"] == pytest.approx(exp["coverage_ratio"], rel=1e-4)
    assert row["gap_score"] == pytest.approx(exp["gap_score"], rel=1e-4)
    assert row["chronic_years"] == exp["chronic_years"]
    assert row["hrp_status"] == exp["hrp_status"]
