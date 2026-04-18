"""One-command calibration card regeneration.

Usage:
    .venv/bin/python scripts/regenerate_calibration_card.py [--year 2025] [--out outputs/calibration_card.md]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make the repo root importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.evaluation.report import generate_calibration_card  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--out", default="outputs/calibration_card.md")
    args = parser.parse_args()
    path = generate_calibration_card(out_path=args.out, analysis_year=args.year)
    print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
