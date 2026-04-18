"""Repo-wide constants and paths. No side effects on import."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASETS = REPO_ROOT / "datasets"

HNO_DIR = DATASETS / "global-hpc-hno"
FTS_DIR = DATASETS / "global-requirements-and-funding-data"
COD_DIR = DATASETS / "cod-pos-global"
HRP_DIR = DATASETS / "humanitarian-response-plans"

HNO_FILE = {
    2024: HNO_DIR / "hpc_hno_2024.parquet",
    2025: HNO_DIR / "hpc_hno_2025.parquet",
    2026: HNO_DIR / "hpc_hno_2026.parquet",
}
FTS_APPEALS = FTS_DIR / "fts_requirements_funding_global.parquet"
FTS_GLOBAL_CLUSTER = FTS_DIR / "fts_requirements_funding_globalcluster_global.parquet"
FTS_RAW_CLUSTER = FTS_DIR / "fts_requirements_funding_cluster_global.parquet"
FTS_INCOMING_2026 = FTS_DIR / "fts_incoming_funding_global.parquet"
COD_ADMIN0 = COD_DIR / "cod_population_admin0.parquet"
CBPF_TIMELINE = HRP_DIR / "AllocationsTimeline__20260418_124005_UTC.parquet"
CBPF_SNAPSHOT = HRP_DIR / "Allocations__20260418_124159_UTC.parquet"

CBPF_COUNTRY_MAP = REPO_ROOT / "pipeline" / "ingest" / "cbpf_country_map.csv"

# Cohort defaults
DEFAULT_ANALYSIS_YEAR = 2025
DEFAULT_PIN_FLOOR = 1_000_000
DEFAULT_REQUIRE_HRP = True

# Chronic-year definition
CHRONIC_COVERAGE_THRESHOLD = 0.5
CHRONIC_MAX_YEARS = 5

# Population staleness threshold
POPULATION_STALE_GAP = 2

# HNO numeric columns that are string-typed in 2024/2025 and need casting
HNO_NUMERIC_COLS = ("Population", "In Need", "Targeted", "Affected", "Reached")

# ISO3 of countries commonly referenced as fixtures
FIXTURE_ISO3 = ("SDN", "TCD", "YEM")
