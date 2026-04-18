"""Render the calibration card Markdown from sensitivity / backtest / disagreement outputs."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from pipeline import config as cfg
from pipeline.evaluation.backtest import (
    backtest_2024,
    backtest_summary,
    largest_movers,
    transitions,
)
from pipeline.evaluation.disagreement import disagreement_cases
from pipeline.evaluation.sensitivity import (
    DEFAULT_DENOMINATOR,
    DEFAULT_FLOOR,
    cohort_strictness_swap,
    sensitivity_summary,
    sensitivity_sweep,
)

TEMPLATES_DIR = Path(__file__).parent / "templates"
DEFAULT_LABEL = f"{DEFAULT_DENOMINATOR}_{DEFAULT_FLOOR // 1_000_000}M"


def _latest_parquet_mtime() -> str:
    files = [
        cfg.COD_ADMIN0,
        cfg.FTS_APPEALS,
        cfg.FTS_GLOBAL_CLUSTER,
        cfg.FTS_RAW_CLUSTER,
        cfg.FTS_INCOMING_2026,
        cfg.CBPF_TIMELINE,
        cfg.HNO_FILE[2024],
        cfg.HNO_FILE[2025],
        cfg.HNO_FILE[2026],
    ]
    mtime = max(os.path.getmtime(Path(p)) for p in files)
    return datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()


def generate_calibration_card(
    out_path: str = "outputs/calibration_card.md",
    analysis_year: int = 2025,
) -> Path:
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        undefined=StrictUndefined,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template("calibration_card.md.jinja")

    sweep = sensitivity_sweep(analysis_year)
    summary = sensitivity_summary(sweep)
    summary_rows = summary.to_dicts()
    non_default = [r for r in summary_rows if not r["is_default"]]
    worst = (
        min(non_default, key=lambda r: r["jaccard_top10"]) if non_default else None
    )

    strictness = cohort_strictness_swap(analysis_year)

    back = backtest_2024()
    back_summary = backtest_summary(back).to_dicts()
    movers = largest_movers(back).to_dicts()
    entries = transitions(back, "entry").to_dicts()
    exits = transitions(back, "exit").to_dicts()

    disagreement = disagreement_cases(analysis_year).to_dicts()

    default_row = next(r for r in summary_rows if r["is_default"])
    context = {
        "analysis_date": _latest_parquet_mtime().split("T")[0],
        "analysis_year": analysis_year,
        "default_cohort_size": default_row["cohort_size"],
        "sensitivity_rows": summary_rows,
        "worst_jaccard": worst["jaccard_top10"] if worst else 1.0,
        "worst_definition": worst["definition"] if worst else DEFAULT_LABEL,
        "worst_drop_count": len(worst["countries_dropped"]) if worst else 0,
        "worst_add_count": len(worst["countries_added"]) if worst else 0,
        "strictness": strictness,
        "backtest_summary": back_summary,
        "largest_movers": movers,
        "transitions_in": entries,
        "transitions_out": exits,
        "disagreement": disagreement,
        "data_freshness": _latest_parquet_mtime(),
    }
    text = template.render(**context)

    out_path_p = Path(out_path)
    out_path_p.parent.mkdir(parents=True, exist_ok=True)
    out_path_p.write_text(text)
    return out_path_p
