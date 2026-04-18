"""chronic_years — strict consecutive underfunding logic."""
from __future__ import annotations

import polars as pl

from pipeline.compute.chronic import chronic_markers, chronic_years


def _mk(rows):
    return pl.DataFrame(
        rows,
        schema={
            "iso3": pl.Utf8,
            "year": pl.Int64,
            "requirements_usd": pl.Float64,
            "funding_usd": pl.Float64,
        },
    )


def test_chronic_years_single_underfunded_year():
    history = _mk(
        [
            {"iso3": "AAA", "year": 2024, "requirements_usd": 100.0, "funding_usd": 30.0},
            {"iso3": "AAA", "year": 2023, "requirements_usd": 100.0, "funding_usd": 70.0},
        ]
    )
    assert chronic_years("AAA", 2025, history) == 1


def test_chronic_years_chain_breaks_on_well_funded_year():
    # coverage pattern backward from 2024: 0.3, 0.4, 0.6, 0.3 → terminates at 2022 (cov 0.6)
    history = _mk(
        [
            {"iso3": "BBB", "year": 2024, "requirements_usd": 100.0, "funding_usd": 30.0},
            {"iso3": "BBB", "year": 2023, "requirements_usd": 100.0, "funding_usd": 40.0},
            {"iso3": "BBB", "year": 2022, "requirements_usd": 100.0, "funding_usd": 60.0},
            {"iso3": "BBB", "year": 2021, "requirements_usd": 100.0, "funding_usd": 30.0},
        ]
    )
    assert chronic_years("BBB", 2025, history) == 2


def test_chronic_years_chain_breaks_on_missing_year():
    # 2024 underfunded, 2023 missing → terminates at 2024
    history = _mk(
        [
            {"iso3": "CCC", "year": 2024, "requirements_usd": 100.0, "funding_usd": 30.0},
            {"iso3": "CCC", "year": 2022, "requirements_usd": 100.0, "funding_usd": 30.0},
        ]
    )
    assert chronic_years("CCC", 2025, history) == 1


def test_chronic_years_cap_at_five():
    # seven consecutive underfunded years → capped at 5
    rows = [
        {"iso3": "DDD", "year": y, "requirements_usd": 100.0, "funding_usd": 20.0}
        for y in range(2018, 2025)
    ]
    history = _mk(rows)
    assert chronic_years("DDD", 2025, history) == 5


def test_chronic_years_no_prior_data_is_zero():
    history = _mk([])
    assert chronic_years("EEE", 2025, history) == 0


def test_chronic_markers_match_chronic_definition():
    history = _mk(
        [
            {"iso3": "FFF", "year": y, "requirements_usd": 100.0, "funding_usd": fu}
            for y, fu in [(2020, 30), (2021, 60), (2022, 40)]
        ]
    )
    markers = chronic_markers("FFF", history, [2020, 2021, 2022, 2023])
    # 2020 cov 0.3 < 0.5 → True; 2021 cov 0.6 ≥ 0.5 → False; 2022 cov 0.4 < 0.5 → True;
    # 2023 missing → False
    assert markers == [True, False, True, False]
