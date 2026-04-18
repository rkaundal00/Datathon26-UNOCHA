"""Composite math — gap_score, custom_gap_score, coverage_gap, chronic_norm."""
from __future__ import annotations

import pytest

from pipeline.compute.composites import (
    chronic_norm,
    coverage_gap,
    custom_gap_score,
    gap_score,
)


def test_gap_score_zero_coverage_equals_pin_share():
    assert gap_score(0.0, 0.5) == pytest.approx(0.5)


def test_gap_score_full_coverage_is_zero():
    assert gap_score(1.0, 0.5) == pytest.approx(0.0)


def test_gap_score_overfunded_clips_to_zero():
    assert gap_score(1.5, 0.5) == pytest.approx(0.0)


def test_gap_score_negative_coverage_treated_as_zero():
    assert gap_score(-0.2, 0.5) == pytest.approx(0.5)


def test_gap_score_is_multiplicative():
    assert gap_score(0.4, 0.5) == pytest.approx(0.3)
    assert gap_score(0.2, 0.1) == pytest.approx(0.08)


def test_custom_gap_score_linear_form():
    # weights: 0.4, 0.3, 0.3 → values: coverage_gap=0.5, pin_share=0.2, chronic_norm=0.6
    out = custom_gap_score(
        0.5, 0.2, 0.6, w_coverage=0.4, w_pin=0.3, w_chronic=0.3
    )
    expected = 0.4 * 0.5 + 0.3 * 0.2 + 0.3 * 0.6
    assert out == pytest.approx(expected)


def test_custom_gap_score_rejects_non_unit_weights():
    with pytest.raises(AssertionError):
        custom_gap_score(
            0.5, 0.2, 0.6, w_coverage=0.4, w_pin=0.3, w_chronic=0.5
        )


def test_coverage_gap_clips():
    assert coverage_gap(0.0) == 1.0
    assert coverage_gap(1.0) == 0.0
    assert coverage_gap(1.5) == 0.0
    assert coverage_gap(-0.2) == 1.0


def test_chronic_norm_scales_0_to_1():
    assert chronic_norm(0) == 0.0
    assert chronic_norm(5) == 1.0
    assert chronic_norm(3) == 0.6
