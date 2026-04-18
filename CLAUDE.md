# CLAUDE.md — Datathon26-UNOCHA

> **`geo-insight-challenge.md` is the authoritative hackathon brief. Defer to it when anything here conflicts.**

Two points baked in from the brief that are easy to miss:
- **All submissions are reviewed by a human jury** — there is no automated evaluation stage.
- **A ranked gap analysis is one example output, not a required format.** Conversational query tools, briefing-note generators, sector-comparison dashboards, etc. are equally in scope. Judging focuses on the quality and defensibility of whatever need-vs-coverage signal the system produces.

---

## Project

Hackathon challenge **"Geo-Insight: Which Crises Are Most Overlooked?"** — integrate UNOCHA humanitarian data (needs, population baseline, funding) to surface mismatches between documented need and funding coverage across active crises. Solution format is open; judging emphasises analytical quality, ranking defensibility (when rankings are produced), and the breadth of crisis types and queries the system handles well.

## Repo layout

```
Datathon26-UNOCHA/
├── geo-insight-challenge.md     # Authoritative brief — read first
├── README.md                    # One-liner, placeholder
├── CLAUDE.md                    # This file
├── scripts/
│   └── csv_to_parquet.py        # One-shot raw-CSV → Parquet conversion (already run)
├── .venv/                       # Local Python env (gitignored)
└── datasets/
    ├── CLAUDE.md                # Scoped context when working inside datasets/
    ├── cod-pos-global/          # COD-PS — population baseline (admin0–admin4)
    ├── global-hpc-hno/          # HNO — people in need / targeted / affected
    ├── global-requirements-and-funding-data/   # FTS — appeals & funding flows
    ├── humanitarian-response-plans/            # ⚠ README describes HRP Registry; current files are CBPF allocations (likely mislocated)
    └── cbpf-data-pool/          # Empty — reserved for CBPF data (see note on HRP folder)
```

All raw data is in **Parquet (snappy)**. No analysis pipeline code exists yet.

## Datasets at a glance

All files are Parquet. Row counts are exact (from the source CSVs); sizes are post-conversion on disk.

| Dataset | Path (under `datasets/`) | Rows | Size | Join keys | Purpose |
|---|---|---|---|---|---|
| **COD-PS admin0** | `cod-pos-global/cod_population_admin0.parquet` | 6,723 | 70 KB | `ISO3` | National population totals, disaggregated by age / gender |
| **COD-PS admin1** | `cod-pos-global/cod_population_admin1.parquet` | 91,472 | 530 KB | `ISO3`, `ADM1_PCODE` | Province/state population |
| **COD-PS admin2** | `cod-pos-global/cod_population_admin2.parquet` | ~1.0M | 2.9 MB | `ISO3`, `ADM1_PCODE`, `ADM2_PCODE` | District/department population |
| **COD-PS admin3** | `cod-pos-global/cod_population_admin3.parquet` | 241,963 | 850 KB | `+ ADM3_PCODE` | Sub-district / commune |
| **COD-PS admin4** | `cod-pos-global/cod_population_admin4.parquet` | 17,466 | 340 KB | `+ ADM4_PCODE` | Village / ward |
| **HNO 2024** | `global-hpc-hno/hpc_hno_2024.parquet` | 387,821 | 3.7 MB | `ISO3` (no P-codes) | People in need / targeted / affected, 2024 |
| **HNO 2025** | `global-hpc-hno/hpc_hno_2025.parquet` | 318,261 | 2.0 MB | `ISO3`, `ADM{1,2,3}_PCODE` | 2025 subnational breakdowns |
| **HNO 2026** | `global-hpc-hno/hpc_hno_2026.parquet` | 135 | ~10 KB | `ISO3` | **Preliminary**; national only; will expand |
| **FTS appeals** | `global-requirements-and-funding-data/fts_requirements_funding_global.parquet` | 3,806 | 80 KB | `planCode`, `ISO3`, `year` | Headline needs-vs-funding by appeal × year |
| **FTS cluster** | `…/fts_requirements_funding_cluster_global.parquet` | 8,031 | 210 KB | `+ cluster` | Per-cluster requirements/funding |
| **FTS global-cluster** | `…/fts_requirements_funding_globalcluster_global.parquet` | 10,631 | 190 KB | `+ globalCluster` | Harmonized global-cluster taxonomy |
| **FTS COVID** | `…/fts_requirements_funding_covid_global.parquet` | 153 | 20 KB | `ISO3`, `year` | COVID-19 breakout |
| **FTS incoming 2026** | `…/fts_incoming_funding_global.parquet` | 10,298 | 610 KB | `destPlanCode`, `destLocations` | 2026 transaction-level: contributions received |
| **FTS internal 2026** | `…/fts_internal_funding_global.parquet` | 3,062 | 60 KB | — | 2026: inter-org transfers |
| **FTS outgoing 2026** | `…/fts_outgoing_funding_global.parquet` | 3,548 | 240 KB | — | 2026: contributions sent by donors |
| **CBPF allocations snapshot** | `humanitarian-response-plans/Allocations__20260418_124159_UTC.parquet` | 33 | ~5 KB | `Year`, `PooledFund` | 2026 CBPF reserve/standard allocations by country pooled-fund |
| **CBPF allocations timeline** | `humanitarian-response-plans/AllocationsTimeline__20260418_124005_UTC.parquet` | 695 | 280 KB | `CBPF`, `fundId`, `Allocation Title` | Historical CBPF allocations (2018 onward), one row per allocation round |

Deep schema details live in each dataset's own `README.md` — prefer those over duplicating columns here.

## Critical gotchas (load-bearing for any pipeline work)

- **Always join on P-codes, never on country or admin names.** Names vary across sources; P-codes are the stable canonical ID.
- **HNO schema drifts 2024 → 2025 → 2026.** Don't assume columns are stable year-over-year. 2024 has no P-codes; 2025 does; 2026 is preliminary national-only.
- **HNO rows overlap.** Totals and sectoral breakdowns coexist in the same file; blind `SUM()` double-counts. Group by the disaggregation columns explicitly.
- **FTS is self-reported and retroactively revised.** Treat it as eventually-consistent. Don't double-count across `incoming` / `internal` / `outgoing` — they're overlapping views of the same flows.
- **2026 HNO is preliminary.** 135 rows, national only. Any cross-year comparison against 2025/2024 needs to respect that granularity gap.
- **`humanitarian-response-plans/` currently has a content-vs-filename mismatch.** Its `README.md` documents the **HRP Registry** dataset (plan metadata from the HPC Tools API, HXL-hashtagged), but the actual files present are **CBPF allocation exports** (pooled-fund disbursements, `Allocations*.parquet`). The CBPF files look more naturally at home in `cbpf-data-pool/`. Treat the README as conceptual reference about HRPs (useful for joining plan-level data); treat the CBPF files as CBPF data that happens to live here for now.
- **Headline FTS needs-vs-funding data lives under `global-requirements-and-funding-data/`**, not the HRP folder.
- **P-code dtype preservation.** Parquet preserves string dtypes correctly, but if you re-export through CSV or mix in external data, P-codes with leading zeros can silently become integers. Keep them as strings end-to-end.

## Modeling conventions

Committed defaults for any analysis the pipeline produces. Override **explicitly at the call site** when you deviate, and update this section if the default itself changes.

- **Currency:** USD. **Not** inflation-adjusted unless explicitly flagged. If a figure is real-terms/deflated, mark the column name (`…_usd_real_2024`) and note the deflator.
- **Year semantics:** calendar year (FTS convention). If a source uses fiscal year, flag it in the column name (`fy_…`) and document the FY→CY mapping used.
- **Coverage ratio:** `funding / requirements`. **Cap at 1.0 for display** (a country can't be ">100% funded" in a user-facing ranking), but **preserve the raw uncapped value** in the analytical columns — overfunding signals matter for QA and for detecting FTS data anomalies.
- **Missing funding:** treat as `0` for ratio math (so a zero-funded country ranks as most-overlooked rather than NaN-dropped), **but always surface a data-quality flag** on any output row where funding was imputed from null. Never present an imputed zero as equivalent to a confirmed zero.
- **Need denominator:** use **PIN (People in Need)** as the primary denominator. If **Targeted** or **Affected** is used in a specific context (e.g. sector-level analysis where PIN isn't broken out), document it inline at the call site — don't silently swap denominators.
- **Cohort definition (for any ranking / gap-analysis output):** countries with an **active HRP in the analysis year** AND **PIN ≥ 1M**. This is a tunable default. If you tune it, update this line so the documented default stays truthful.

## Tooling defaults

- **Language:** Python. Primary libs: `pandas` + `pyarrow` (already installed in `.venv/`). Switch to `polars` if you want lazy scanning for interactive exploration.
- **Env:** `.venv/` at repo root, populated via `python3 -m venv .venv && .venv/bin/pip install pandas pyarrow`. Activate with `.venv/bin/python …` or `source .venv/bin/activate`.
- **I/O:** `pd.read_parquet(path)` / `df.to_parquet(path, compression="snappy", index=False)`. Parquet preserves dtypes and is 10–50× smaller than the source CSVs (273 MB → 13 MB for this dataset).
- **Conversion script:** `scripts/csv_to_parquet.py` — already run once. Re-run it if a fresh CSV lands in `datasets/`; it walks the tree, converts, and removes the CSV.
- **Suggested layout for the upcoming pipeline:**
  ```
  pipeline/
  ├── ingest/      # Per-source loaders, dtype normalization, P-code sanity checks
  ├── clean/       # Deduplication, schema harmonization across HNO years
  ├── join/        # Country × year × cluster unified tables
  └── analysis/    # Gap scoring, ranking, QA reports
  processed/       # Cleaned parquet outputs (gitignored)
  outputs/         # Final ranked lists, briefing notes, visualisations
  ```
- **Output format:** Parquet everywhere internally. CSV / JSON / Markdown only for final human-facing deliverables.

## Working style

- **Explore before loading.** `pd.read_parquet(path).head(20)` (or `pyarrow.parquet.read_schema(path)`) to confirm columns and dtypes before any heavy operation.
- **Raw data is read-only.** Never mutate files under `datasets/`. Write cleaned outputs to `processed/` (to be created, gitignored).
- **Preserve P-codes through every transformation.** They're the canonical join key; losing them (or silently coercing to int) means losing the ability to re-join downstream.
- **Flag, don't hide, data-quality issues.** Every cleaned output should carry a QA column or sidecar flagging imputation, overlapping rows collapsed, schema mismatches handled, etc.
- **Ground all figures in the provided data** (per `geo-insight-challenge.md`). No fabricated or LLM-hallucinated numbers in any output the jury sees.

## Commit conventions

- **Subject:** imperative mood, ≤70 chars, no trailing period. Use a conventional-commit prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) with an optional `(scope)`.
- **Body is optional.** Use it only to explain *why* — one short paragraph. Never expand into bullet-list tours of the diff or file contents; the diff already shows that.
- **No tool / provenance footers.** Do not append "Generated with Claude Code", "Co-Authored-By: Claude", or similar.
- **No agent narration.** The log is for future humans reading history, not a record of the assistant's reasoning or process.

## Pointers

- **`geo-insight-challenge.md`** — authoritative brief (any conflict with this file → brief wins).
- **`datasets/CLAUDE.md`** — scoped context when working inside the datasets tree.
- **`datasets/<name>/README.md`** — deep schema + caveats per dataset (COD-PS, HNO, HRP).
- **External portals referenced by the brief:**
  - HDX (Humanitarian Data Exchange) — source of COD-PS and HNO
  - FTS (Financial Tracking Service) — source of funding data
  - CBPF Data Hub — `cbpf-data-pool/` is reserved for this but currently empty
