"""QA flag assembly."""
from __future__ import annotations

from pipeline.transform.qa import build_flags


def test_severity_unavailable_always_present_in_mvp():
    flags = build_flags(
        analysis_year=2025,
        hno_row_year=2025,
        population_reference_year=2024,
        requirements_usd=1_000_000,
        funding_usd=500_000,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "severity_unavailable" in flags


def test_funding_imputed_zero_fires_only_when_requirements_positive():
    flags_imputed = build_flags(
        analysis_year=2025,
        hno_row_year=2025,
        population_reference_year=2024,
        requirements_usd=1_000_000,
        funding_usd=0,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "funding_imputed_zero" in flags_imputed

    flags_zero_req = build_flags(
        analysis_year=2025,
        hno_row_year=2025,
        population_reference_year=2024,
        requirements_usd=0,
        funding_usd=0,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "funding_imputed_zero" not in flags_zero_req


def test_hno_stale_fires_when_years_differ():
    flags = build_flags(
        analysis_year=2025,
        hno_row_year=2024,
        population_reference_year=2024,
        requirements_usd=1,
        funding_usd=1,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "hno_stale" in flags


def test_population_stale_only_over_two_year_gap():
    fresh = build_flags(
        analysis_year=2025,
        hno_row_year=2025,
        population_reference_year=2023,
        requirements_usd=1,
        funding_usd=1,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "population_stale" not in fresh
    stale = build_flags(
        analysis_year=2025,
        hno_row_year=2025,
        population_reference_year=2022,
        requirements_usd=1,
        funding_usd=1,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "population_stale" in stale


def test_donor_conc_2026_only_when_hhi_present():
    flags = build_flags(
        analysis_year=2026,
        hno_row_year=2026,
        population_reference_year=2025,
        requirements_usd=1,
        funding_usd=1,
        donor_concentration=0.5,
        hrp_status="HRP",
    )
    assert "donor_conc_2026_only" in flags


def test_preliminary_hno_fires_for_2026():
    flags = build_flags(
        analysis_year=2026,
        hno_row_year=2026,
        population_reference_year=2025,
        requirements_usd=1,
        funding_usd=1,
        donor_concentration=None,
        hrp_status="HRP",
    )
    assert "preliminary_hno" in flags


def test_hrp_status_unknown_flags_country():
    flags = build_flags(
        analysis_year=2025,
        hno_row_year=2025,
        population_reference_year=2024,
        requirements_usd=1,
        funding_usd=1,
        donor_concentration=None,
        hrp_status="Unknown",
    )
    assert "hrp_status_unknown" in flags
