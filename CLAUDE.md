# CLAUDE.md — Datathon26-UNOCHA

> **`geo-insight-challenge.md` is the authoritative hackathon brief. Defer to it when anything here conflicts.**

Two points baked in from the brief that are easy to miss:
- **All submissions are reviewed by a human jury** — there is no automated evaluation stage.
- **A ranked gap analysis is one example output, not a required format.** Judging focuses on the quality and defensibility of whatever need-vs-coverage signal the system produces.

## Project

**Geo-Insight** — a working prototype for the "Which Crises Are Most Overlooked?" challenge. A pipeline + API + frontend that ranks active HRP cohorts by the gap between documented need (HNO) and funding coverage (FTS), decomposes every score into its inputs, surfaces what the data cannot see (exclusion panel + per-row QA flags), and ships with a regenerable calibration card as the defensibility artifact.

## Repo layout

```
Datathon26-UNOCHA/
├── geo-insight-challenge.md       # Authoritative brief — read first
├── README.md                      # How to run it
├── CLAUDE.md                      # This file
├── pipeline/                      # Python backend
│   ├── config.py                  # Paths, defaults, thresholds
│   ├── ingest/                    # COD-PS, HNO, FTS, CBPF, INFORM loaders
│   ├── compute/                   # gap_score, chronic_years, donor HHI
│   ├── transform/                 # country_year, clusters, trend, qa
│   ├── api/                       # FastAPI routers + schemas.py
│   └── evaluation/                # Sensitivity, backtest, disagreement, report
├── frontend/                      # Next.js 16 + TS + Tailwind 4
│   ├── src/app/                   # Server-rendered entry page + /maps route
│   ├── src/components/            # UI components (table, modal, scatter, maps, …)
│   └── src/lib/                   # api-types, api client, url-state, formatters
├── scripts/
│   ├── run-dev.sh                 # Boots backend + frontend together
│   ├── csv_to_parquet.py          # One-shot raw-CSV → Parquet (already run)
│   └── regenerate_calibration_card.py
├── outputs/
│   └── calibration_card.md        # Committed judge-facing artifact
├── processed/                     # Gitignored pipeline outputs
├── .venv/                         # Local Python env (gitignored)
└── datasets/                      # Raw Parquet (read-only)
    ├── CLAUDE.md                  # Scoped guidance inside datasets/
    ├── cod-pos-global/            # Population baseline
    ├── global-hpc-hno/            # People in need / targeted / affected
    ├── global-requirements-and-funding-data/   # FTS appeals + flows
    ├── humanitarian-response-plans/   # ⚠ CBPF files, not HRP Registry
    ├── cbpf-data-pool/            # Empty — reserved
    └── 202603_INFORM_Severity/    # March 2026 INFORM Severity Index (country-level)
```

## How to run it

Short version lives in `README.md`. One command to boot both:

```bash
./scripts/run-dev.sh
```

Runs uvicorn on `:8000` with `--reload`, Next dev on `:3001`, wires `NEXT_PUBLIC_API_BASE` between them, and Ctrl-C tears both down. Set `BACKEND_PORT` / `FRONTEND_PORT` to override.

## Critical gotchas (load-bearing for any pipeline work)

- **Always join on P-codes, never on country or admin names.** Names vary across sources; P-codes are the stable canonical ID.
- **HNO schema drifts 2024 → 2025 → 2026.** Don't assume columns are stable year-over-year. 2024 has no P-codes; 2025 does; 2026 is preliminary national-only. Loaders in `pipeline/ingest/hno.py` are per-year.
- **HNO 2024/2025 first row is HXL tags** (`#country+code`, etc.) — the loader drops it. Numeric columns in 2024/2025 are stored as strings and get cast after comma-stripping.
- **HNO rows overlap.** Country-level PIN is the single row where `cluster='ALL' AND category IS NULL` — no blind `SUM()`.
- **FTS is self-reported and retroactively revised.** Treat it as eventually-consistent. The three 2026 transaction files (`incoming`, `internal`, `outgoing`) are overlapping views of the same flows — never sum across them.
- **FTS `typeName` is sparse (~32% populated).** `hrp_status` derivation cascades: known type → `HRP`/`FlashAppeal`/`RegionalRP`; else `requirements > 0` → `Unknown`; else `None`. `None` is always excluded.
- **Cohort filter always excludes** `hrp_status='None'` AND `requirements_usd=0` rows — these would make `coverage_ratio` undefined. The `require_hrp` chip toggles strictness-of-plan-type (adds `Other`/`Unknown`), not presence-of-plan. See `pipeline/transform/country_year.py` §`build_country_year_table` step 5.
- **No severity column in any HNO Parquet.** Severity is sourced separately from `datasets/202603_INFORM_Severity/` (country-level INFORM Severity Index, March 2026) and exposed as `inform_severity` on every row. Rows missing INFORM coverage carry `severity_unavailable`.
- **COD-PS max `Reference_year` is 2024.** `population_stale` fires when `analysis_year − Reference_year > 2`. SDN's 2024 reference for a 2025 analysis year is fresh (gap = 1); a 2026 analysis gap is 2, still not stale.
- **`humanitarian-response-plans/` has a content-vs-filename mismatch.** Its README describes the HRP Registry, but the files present are CBPF allocations — handled as read-only validation context only (see `pipeline/ingest/cbpf.py`), keyed by country name via `pipeline/ingest/cbpf_country_map.csv`.
- **Donor HHI is 2026-only.** Transaction-level data pre-2026 doesn't exist in the provided files; the metric is always rendered with the label **"Top donors by commitment (HHI)"** and the `donor_conc_2026_only` QA flag.

## Interface contract

**Pydantic schemas in `pipeline/api/schemas.py` are the frozen interface** between backend and frontend. TypeScript mirror lives at `frontend/src/lib/api-types.ts`. Any change to one side must be propagated to the other in the same commit.

Enums worth knowing from memory:
- `HRPStatus` — `HRP | FlashAppeal | RegionalRP | Other | Unknown | None`
- `Mode` — `acute | structural | combined` (drives preset sort + scatter emphasis)
- `QAFlag` — 8 values; see schemas.py
- `ExclusionReason` — 4 values

## Modeling conventions

Committed defaults. Override **explicitly at the call site** if you deviate, and update this section if the default itself changes.

- **Currency:** USD, nominal. Not inflation-adjusted unless column is explicitly suffixed (`…_usd_real_2024`).
- **Year semantics:** calendar year (FTS convention).
- **Coverage ratio:** `funding / requirements`. **Raw uncapped** everywhere for display; clipped at 1.0 only inside `gap_score`.
- **Missing funding:** treated as 0 for ratio math; `funding_imputed_zero` QA flag attaches when requirements > 0 and funding is null/0.
- **Need denominator:** PIN. `Targeted` / `Affected` appear only in explicit sector contexts — never as silent swaps.
- **Cohort default:** `PIN ≥ 1M ∧ hrp_status ∈ {HRP, FlashAppeal, RegionalRP} ∧ requirements_usd > 0`. Tunable via the scope banner; always surfaces the exclusion count next to it.
- **Chronic-year threshold:** `coverage < 0.5`, strict consecutive backward from `analysis_year − 1`. Capped at 5. Missing-year or ≥0.5-year breaks the chain.

## Composites

Two composites. Decomposable on click in the UI.

```
gap_score         = (1 − min(coverage_ratio, 1)) × pin_share          # default, multiplicative, [0,1]
custom_gap_score  = w_coverage · coverage_gap                         # opt-in, linear, Σw=1
                  + w_pin      · pin_share
                  + w_chronic  · chronic_years/5
```

Panel disclaimer (verbatim, in the Advanced panel header): *"Custom weights use a linear composite; the default score is multiplicative. Setting weights won't reproduce the default — they answer different questions."*

## Tooling defaults

- **Python 3.12+** (developed on 3.14). `.venv/` at repo root.
- **Libraries:** `polars` + `duckdb` (no pandas); `fastapi` + `pydantic v2`; `jinja2`. Full list in `requirements.txt`.
- **Node 20+** with `npm`. Next.js 16 + React 19 + Tailwind 4 + shadcn-style primitives + `nuqs` (URL state) + `recharts`.
- **I/O:** `pl.read_parquet(path)` for Parquet. Raw data is read-only. Derived outputs go to `processed/` (gitignored).
- **P-code dtype preservation:** strings end-to-end. Never round-trip through CSV without explicit dtype enforcement.

## Working style

- **Schema is the contract.** Any change to `pipeline/api/schemas.py` must be mirrored in `frontend/src/lib/api-types.ts` in the same commit; the two sides must not drift.
- **Raw data is read-only.** Never mutate files under `datasets/`.
- **Flag, don't hide, data-quality issues.** Every ranked row carries a `qa_flags` list; every exclusion has a specific `exclusion_reason` enum value and a human-readable detail string.
- **Ground all figures in the provided data.** No fabricated or LLM-hallucinated numbers in any output the jury sees — the briefing lead is template-only in the MVP.

## Verification

```bash
# Regenerate the calibration card — must be byte-identical modulo timestamp + dataset freshness
.venv/bin/python scripts/regenerate_calibration_card.py

# Frontend type-check
(cd frontend && npx tsc --noEmit)
```

## Commit conventions

- **Subject:** imperative mood, ≤70 chars, no trailing period. Conventional-commit prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) with an optional `(scope)`.
- **Body is optional.** Use it only for the *why* — one short paragraph. Never expand into bullet-list tours of the diff.
- **No tool / provenance footers** (no "Generated with Claude Code" or "Co-Authored-By: Claude").
- **No agent narration.** The log is for future humans, not a record of the assistant's process.

## Pointers

- **`geo-insight-challenge.md`** — authoritative brief.
- **`datasets/CLAUDE.md`** — scoped context when working inside the datasets tree.
- **`datasets/<name>/README.md`** — deep schema + caveats per dataset.
