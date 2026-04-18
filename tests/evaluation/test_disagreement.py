"""Component-vs-composite disagreement tests."""
from __future__ import annotations

from pipeline.evaluation.disagreement import disagreement_cases


def test_disagreement_returns_top_5():
    cases = disagreement_cases(2025, top_n=5)
    assert len(cases) == 5


def test_disagreement_sorted_descending():
    cases = disagreement_cases(2025, top_n=5)
    scores = cases["disagreement_score"].to_list()
    assert scores == sorted(scores, reverse=True)


def test_disagreement_all_have_interpretations():
    cases = disagreement_cases(2025, top_n=5)
    for r in cases.to_dicts():
        assert r["interpretation"]
        assert isinstance(r["interpretation"], str)
