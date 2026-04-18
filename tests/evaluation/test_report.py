"""Calibration-card generation tests."""
from __future__ import annotations

from pathlib import Path

from pipeline.evaluation.report import generate_calibration_card

REQUIRED_HEADINGS = [
    "# Geo-Insight calibration card",
    "## 1. Default configuration",
    "## 2. Sensitivity",
    "## 3. Cohort strictness",
    "## 4. 2024 back-test",
    "## 5. Component-vs-composite disagreement",
    "## 6. Known limitations",
    "## 7. What the composite does NOT claim",
    "## 8. Reproducibility",
]


def test_card_generates_with_all_sections(tmp_path: Path):
    out = tmp_path / "card.md"
    generate_calibration_card(out_path=str(out), analysis_year=2025)
    text = out.read_text()
    for heading in REQUIRED_HEADINGS:
        assert heading in text, f"missing heading {heading!r}"


def test_card_has_no_unfilled_template_variables(tmp_path: Path):
    out = tmp_path / "card.md"
    generate_calibration_card(out_path=str(out), analysis_year=2025)
    text = out.read_text()
    assert "{{" not in text
    assert "}}" not in text


def test_card_names_excluded_not_overlooked_boundary(tmp_path: Path):
    out = tmp_path / "card.md"
    generate_calibration_card(out_path=str(out), analysis_year=2025)
    text = out.read_text()
    # Required verbatim phrasing per spec-evaluation §9 DoD.
    assert "excluded" in text.lower() and "not overlooked" in text.lower()
