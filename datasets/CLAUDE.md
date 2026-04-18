# CLAUDE.md — `datasets/`

Scoped context for work inside this directory. See [`../CLAUDE.md`](../CLAUDE.md) for project-level conventions (modeling defaults, tooling, working style) and [`../geo-insight-challenge.md`](../geo-insight-challenge.md) for the authoritative hackathon brief.

**All files here are raw and read-only.** Raw data is stored as **Parquet (snappy)** — use `../scripts/csv_to_parquet.py` to convert any new CSVs dropped into this tree (the script walks `datasets/`, converts each `*.csv` → `*.parquet`, and removes the original). Cleaned / joined outputs go to a sibling `processed/` or `outputs/` directory (to be created), never in-place.

## Index

| Dataset | Source | Time coverage | Admin levels | Subdirectory |
|---|---|---|---|---|
| **COD-PS** (population baseline) | HDX | 2001–2026 (varies) | admin0 → admin4 | [`cod-pos-global/`](./cod-pos-global/) |
| **HPC / HNO** (needs overview) | HPC Tools (OCHA) | 2024, 2025, 2026 (preliminary) | National + admin1–3 (2025 only) | [`global-hpc-hno/`](./global-hpc-hno/) |
| **FTS** (requirements & funding) | OCHA Financial Tracking Service | 1999–2026 aggregates; 2026 transactions | Country × appeal × cluster | [`global-requirements-and-funding-data/`](./global-requirements-and-funding-data/) |
| **HRP Registry** (plan metadata) | HPC Tools (OCHA) | 2008–2026 | Global, by plan | [`humanitarian-response-plans/`](./humanitarian-response-plans/) — ⚠ README describes HRP Registry (not yet present); folder currently holds CBPF allocation exports (see below) |
| **CBPF** (pooled funds) | CBPF Data Hub | 2018–2026 | Country pooled-fund level | [`cbpf-data-pool/`](./cbpf-data-pool/) — empty; actual CBPF exports currently sit inside `humanitarian-response-plans/` |

## Files at a glance

All files are Parquet. Row counts are exact; sizes are on-disk after conversion.

| File | Rows | Size | Notes |
|---|---|---|---|
| `cod-pos-global/cod_population_admin0.parquet` | 6,723 | 70 KB | National totals, age × gender |
| `cod-pos-global/cod_population_admin1.parquet` | 91,472 | 530 KB | Province/state |
| `cod-pos-global/cod_population_admin2.parquet` | ~1.0M | 2.9 MB | District — largest, but trivially in-memory now |
| `cod-pos-global/cod_population_admin3.parquet` | 241,963 | 850 KB | Sub-district/commune |
| `cod-pos-global/cod_population_admin4.parquet` | 17,466 | 340 KB | Village/ward |
| `global-hpc-hno/hpc_hno_2024.parquet` | 387,821 | 3.7 MB | No P-codes |
| `global-hpc-hno/hpc_hno_2025.parquet` | 318,261 | 2.0 MB | Has P-codes (admin1–3) |
| `global-hpc-hno/hpc_hno_2026.parquet` | 135 | ~10 KB | **Preliminary, national only** |
| `global-requirements-and-funding-data/fts_requirements_funding_global.parquet` | 3,806 | 80 KB | Appeal × year aggregates |
| `…/fts_requirements_funding_cluster_global.parquet` | 8,031 | 210 KB | + cluster |
| `…/fts_requirements_funding_globalcluster_global.parquet` | 10,631 | 190 KB | + harmonized global-cluster |
| `…/fts_requirements_funding_covid_global.parquet` | 153 | 20 KB | COVID-19 breakout |
| `…/fts_incoming_funding_global.parquet` | 10,298 | 610 KB | **2026 only**, transaction-level |
| `…/fts_internal_funding_global.parquet` | 3,062 | 60 KB | 2026, inter-org transfers |
| `…/fts_outgoing_funding_global.parquet` | 3,548 | 240 KB | 2026, outgoing contributions |
| `humanitarian-response-plans/Allocations__20260418_124159_UTC.parquet` | 33 | ~5 KB | **CBPF** — 2026 pooled-fund allocations snapshot (`Year`, `PooledFund`, `AllocationType`, `Budget`) |
| `humanitarian-response-plans/AllocationsTimeline__20260418_124005_UTC.parquet` | 695 | 280 KB | **CBPF** — historical allocations 2018→ (one row per allocation round, with project counts, approval dates, CBPF country) |

Each subdirectory carries its own `README.md` with full schema + methodology — prefer those over duplicating column lists here.

## Canonical join keys

| Key | Appears in | Notes |
|---|---|---|
| `ISO3` | COD-PS (all), HNO (all years), FTS | **Primary country key.** Always prefer over country names. |
| `ADM1_PCODE` | COD-PS admin1+, HNO 2025 | Province/state. Stable across sources where present. |
| `ADM2_PCODE` | COD-PS admin2+, HNO 2025 | District/department. |
| `ADM3_PCODE`, `ADM4_PCODE` | COD-PS admin3 / admin4 | Lower admin; population baseline only. |
| `planCode` (FTS: `destPlanCode` on transactions) | FTS files, HRP Registry (when present) | Joins FTS transactions to appeal aggregates; also the stable join key between HRP Registry plans and FTS funding. Don't match on plan *name* — names get revised between drafts. |
| `year` | FTS, HNO filenames, CBPF `Year` / `CBPF` | Calendar year (FTS convention). |
| `cluster` / `globalCluster` | FTS cluster tables, HNO `Cluster` | Prefer `globalCluster` for cross-country — harmonized taxonomy. |
| `PooledFund` / `CBPF` | CBPF allocation files | Country pooled-fund identifier (e.g. "Afghanistan", "Sudan", "Ukraine"). Not directly tied to `ISO3` — map via country name with care. |

**Never join on country or admin names.** Names drift (abbreviations, diacritics, "Republic of X" vs "X"). ISO3 + P-codes are the only stable IDs.

## Critical gotchas

- **HNO schema drifts 2024 → 2025 → 2026.** 2024 has no P-codes; 2025 has subnational P-codes; 2026 is national-only (preliminary, 135 rows). Don't assume columns are stable year-over-year.
- **HNO rows overlap.** A file contains both totals and sectoral/demographic breakdowns side-by-side. Blind `SUM()` double-counts — group by disaggregation columns explicitly.
- **FTS is self-reported and retroactively revised.** Treat as eventually-consistent. Don't sum across `incoming` / `internal` / `outgoing` — they're overlapping views of the same flows.
- **`humanitarian-response-plans/` content-vs-filename mismatch.** The folder's `README.md` documents the **HRP Registry** dataset (plan metadata, HXL-hashtagged CSV + JSON from HPC Tools API). But the actual files present are **CBPF allocation exports** (`Allocations*.parquet`), which by naming belong in `cbpf-data-pool/`. Treat the README as conceptual reference about HRPs; treat the CBPF files as CBPF data that happens to live here for now. The actual HRP Registry files (`humanitarian-response-plans.csv`, `HPC Tools API output.json`) are **not yet present** despite the README describing them.
- **P-code dtype preservation.** Parquet preserves string dtypes correctly. If you round-trip through CSV or join external data, be careful not to silently coerce P-codes with leading zeros into integers.
- **Always explore before loading.** `pd.read_parquet(path).head(20)` (or `pyarrow.parquet.read_schema(path)`) first to confirm schema.

## Subdirectory pointers

### [`cod-pos-global/`](./cod-pos-global/) — COD-PS population baseline
Five Parquet files, one per admin level (0–4). Age- and gender-disaggregated population across ~139 countries, reference years 2001–2026. Baseline for any per-capita or severity calculation. Join on `ISO3` + `ADM{n}_PCODE`.

### [`global-hpc-hno/`](./global-hpc-hno/) — Humanitarian Needs Overview
Annual files: People in Need / Targeted / Affected / Reached per country, sector, and (2025) admin level. Covers ~24 active-crisis countries. Per project-level convention (`../CLAUDE.md`): use **PIN as the primary need denominator**.

### [`global-requirements-and-funding-data/`](./global-requirements-and-funding-data/) — FTS appeals & funding flows
**Aggregates** (`fts_requirements_funding_*.parquet`) — appeal × year (× cluster) requirements and funding received, 1999–2026. **Transactions** (`fts_incoming_/_internal_/_outgoing_funding_global.parquet`) — 2026 individual contributions with donor, recipient, plan, cluster metadata.

### [`humanitarian-response-plans/`](./humanitarian-response-plans/) — ⚠ mixed
The folder's own `README.md` documents the **HRP Registry** dataset (plan-level metadata from the HPC Tools API — plan ID / plan code, country, period, headline requirements & funding, type HRP / Flash Appeal / Regional). Its primary value when present is as the join table between `planCode` in FTS and the plan narrative on HumanitarianAction.info. The actual Registry files described in that README (`humanitarian-response-plans.csv` with HXL hashtags + `HPC Tools API output.json`) are **not yet present**.

What *is* here now: two **CBPF** (Country-Based Pooled Fund) allocation exports downloaded from `cbpf.data.unocha.org` — a 2026 allocations snapshot (33 rows) and a historical allocations timeline (695 rows, 2018 onward). These look mislocated and likely belong in `cbpf-data-pool/`.

### [`cbpf-data-pool/`](./cbpf-data-pool/) — empty
Reserved for Country-Based Pooled Fund allocations. External reference: <https://cbpf.data.unocha.org/>. Note: CBPF export files are currently sitting in `humanitarian-response-plans/` instead — see note above.
