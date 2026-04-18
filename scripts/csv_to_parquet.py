"""Convert every CSV under datasets/ to Parquet (snappy) and delete the CSV.

Run from the repo root:
    .venv/bin/python scripts/csv_to_parquet.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASETS = REPO_ROOT / "datasets"


def convert(csv_path: Path) -> tuple[int, int]:
    parquet_path = csv_path.with_suffix(".parquet")
    csv_size = csv_path.stat().st_size
    df = pd.read_csv(csv_path, low_memory=False)
    df.to_parquet(parquet_path, engine="pyarrow", compression="snappy", index=False)
    parquet_size = parquet_path.stat().st_size
    csv_path.unlink()
    return csv_size, parquet_size


def main() -> int:
    csvs = sorted(DATASETS.rglob("*.csv"))
    if not csvs:
        print("No CSVs found under", DATASETS)
        return 0

    total_before = 0
    total_after = 0
    for csv in csvs:
        rel = csv.relative_to(REPO_ROOT)
        try:
            before, after = convert(csv)
        except Exception as exc:
            print(f"FAIL  {rel}: {exc}", file=sys.stderr)
            return 1
        total_before += before
        total_after += after
        pct = (1 - after / before) * 100 if before else 0.0
        print(f"OK    {rel}  {before/1e6:7.2f} MB -> {after/1e6:6.2f} MB  ({pct:4.1f}% smaller)")

    print("-" * 72)
    print(f"Total {total_before/1e6:7.2f} MB -> {total_after/1e6:6.2f} MB  "
          f"({(1 - total_after/total_before) * 100:.1f}% smaller)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
