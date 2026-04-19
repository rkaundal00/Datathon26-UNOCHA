"""Composite scores — default (multiplicative) and custom (linear)."""
from __future__ import annotations

import math

def _norm_log_pin(pin: int | float) -> float:
    """Return log10(pin)."""
    if pin <= 0:
        return 0.0
    return math.log10(max(pin, 1.0))


def gap_score(coverage_ratio: float, pin_share: float, pin: int | float) -> float:
    """Funding-shortfall % × blended need signal.

    need_signal = 0.5 × pin_share  (relative intensity)
                + 0.5 × norm_log10(pin)  (absolute scale, log-dampened)

    A small country with extreme PIN share is prioritised, but a massive country
    with millions in need isn't artificially pushed to the bottom.
    """
    cov = max(0.0, min(coverage_ratio, 1.0))
    shortfall = 1.0 - cov
    share = max(0.0, min(pin_share, 1.0))
    log_pin = _norm_log_pin(pin)
    need = 0.5 * share + 0.5 * log_pin
    return shortfall * need


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
