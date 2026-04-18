"""Composite scores — default (multiplicative) and custom (linear)."""
from __future__ import annotations


def gap_score(coverage_ratio: float, pin_share: float) -> float:
    """(1 − min(coverage, 1)) × pin_share, in [0, 1].

    Either factor zero → score zero. Overfunded (>100%) clips to 0 on the coverage side
    inside the score; the raw coverage_ratio column stays uncapped upstream.
    """
    cov = max(coverage_ratio, 0.0)
    cov = min(cov, 1.0)
    share = max(min(pin_share, 1.0), 0.0)
    return (1.0 - cov) * share


def custom_gap_score(
    coverage_gap: float,
    pin_share: float,
    chronic_norm: float,
    *,
    w_coverage: float,
    w_pin: float,
    w_chronic: float,
) -> float:
    """Linear composite. Σ weights must be 1 (normalized upstream).

    No severity term in MVP (see spec-data-pipeline §0.1).
    """
    total = w_coverage + w_pin + w_chronic
    assert abs(total - 1.0) < 1e-6, f"weights must sum to 1.0, got {total}"
    return (
        w_coverage * coverage_gap
        + w_pin * pin_share
        + w_chronic * chronic_norm
    )


def coverage_gap(coverage_ratio: float) -> float:
    """1 - min(coverage, 1). The uncapped coverage_ratio is preserved separately for display."""
    return 1.0 - min(max(coverage_ratio, 0.0), 1.0)


def chronic_norm(chronic_years: int) -> float:
    """chronic_years / 5, in [0, 1]."""
    return max(0, min(chronic_years, 5)) / 5.0
