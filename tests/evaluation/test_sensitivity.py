"""Sensitivity sweep + cohort strictness swap tests."""
from __future__ import annotations

from pipeline.evaluation.sensitivity import (
    cohort_strictness_swap,
    sensitivity_summary,
    sensitivity_sweep,
)


def test_sensitivity_sweep_returns_9_definitions():
    sweep = sensitivity_sweep(2025)
    definitions = sweep["definition"].unique().to_list()
    assert len(definitions) == 9


def test_sensitivity_sweep_includes_default_label():
    sweep = sensitivity_sweep(2025)
    is_default = sweep["is_default"].any()
    assert is_default


def test_sensitivity_summary_columns():
    sweep = sensitivity_sweep(2025)
    summary = sensitivity_summary(sweep)
    needed = {
        "definition",
        "cohort_size",
        "jaccard_top10",
        "median_rank_delta",
        "max_rank_delta",
        "countries_dropped",
        "countries_added",
    }
    assert needed.issubset(set(summary.columns))


def test_sensitivity_jaccard_bounded():
    sweep = sensitivity_sweep(2025)
    summary = sensitivity_summary(sweep)
    for j in summary["jaccard_top10"].to_list():
        assert 0.0 <= j <= 1.0


def test_cohort_strictness_swap_shape():
    result = cohort_strictness_swap(2025)
    assert set(result.keys()) == {
        "default",
        "relaxed",
        "jaccard_top10",
        "countries_added_by_relaxation",
        "rank_delta_median",
        "rank_delta_max",
    }
    assert 0.0 <= result["jaccard_top10"] <= 1.0


def test_cohort_strictness_relaxed_is_superset():
    result = cohort_strictness_swap(2025)
    # Relaxed cohort should not be smaller than default.
    assert result["relaxed"]["cohort_size"] >= result["default"]["cohort_size"]
