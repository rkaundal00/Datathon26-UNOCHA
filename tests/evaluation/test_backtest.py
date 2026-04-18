"""2024 back-test tests — classifier + membership transitions."""
from __future__ import annotations

from pipeline.evaluation.backtest import (
    backtest_2024,
    backtest_summary,
    largest_movers,
    transitions,
)

VALID_CLASSES = {
    "cohort_entry",
    "cohort_exit",
    "data_grounded",
    "methodology_sensitive",
    "noise",
}


def test_backtest_returns_rows_for_both_years():
    back = backtest_2024()
    assert len(back) > 0
    statuses = set(back["cls"].to_list())
    assert statuses.issubset(VALID_CLASSES)


def test_backtest_summary_shares_sum_to_one():
    back = backtest_2024()
    summary = backtest_summary(back)
    total_share = sum(summary["share"].to_list())
    assert abs(total_share - 1.0) < 1e-6


def test_largest_movers_uses_countries_in_both_years():
    back = backtest_2024()
    movers = largest_movers(back, top_n=5)
    # each row must be in both years, so rank_2024 and rank_2025 are both non-null
    for r in movers.to_dicts():
        assert r["rank_2024"] is not None
        assert r["rank_2025"] is not None


def test_transitions_entries_have_cohort_entry_cls():
    back = backtest_2024()
    entries = transitions(back, "entry")
    for r in entries.to_dicts():
        assert r["cls"] == "cohort_entry"
        assert r["rank_2024"] is None
        assert r["rank_2025"] is not None


def test_transitions_exits_have_cohort_exit_cls():
    back = backtest_2024()
    exits = transitions(back, "exit")
    for r in exits.to_dicts():
        assert r["cls"] == "cohort_exit"
        assert r["rank_2024"] is not None
        assert r["rank_2025"] is None
