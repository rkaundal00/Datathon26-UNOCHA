# Geo-Insight — Submission

**Challenge:** Which Crises Are Most Overlooked? ([`geo-insight-challenge.md`](./geo-insight-challenge.md))
**Submission date:** 2026-04-19

This document is the technical write-up. The prototype, API, and dashboard live alongside it in the repo; the defensibility artifact is [`outputs/calibration_card.md`](./outputs/calibration_card.md).

## Deliverables map

| # | Deliverable | Where it lives |
|---|---|---|
| 1 | Working prototype | [`pipeline/`](./pipeline) (FastAPI backend) + [`frontend/`](./frontend) (Next.js 16 dashboard) |
| 2 | Short technical write-up | this file |
| 3 | Demo / API / dashboard | `./scripts/run-dev.sh` → dashboard at `:3001`, API at `:8000`. Endpoint map in [README §API surface](./README.md#api-surface) |
| 4 | Gap-scoring & ranking logic | [§2 below](#2-gap-scoring--ranking-logic) + [`pipeline/compute/composites.py`](./pipeline/compute/composites.py) |
| 5 | Failure cases, limitations, open problems | [§6 below](#6-failure-cases-limitations-open-problems) + [`outputs/calibration_card.md`](./outputs/calibration_card.md) §6, §7 |

## 1. Problem framing & scope

A humanitarian coordinator or donor advisor wants to know which crises are **overlooked relative to documented need** — not merely which crises are largest, and not which are best-funded in absolute terms.

Our scope is the **strict cohort** of country-years with all three prerequisites of a meaningful gap calculation:

```
PIN ≥ 1,000,000  ∧  hrp_status ∈ {HRP, FlashAppeal, RegionalRP}  ∧  requirements_usd > 0
```

Any row that fails any prerequisite cannot be ranked apples-to-apples in a single column. We deliberately **do not** assign those rows a fabricated `gap_score`. Instead:

- Countries with no appeal of record, stale HNO, or no population baseline go to the **Excluded** bucket, each tagged with a specific `ExclusionReason`.
- Countries that have an FTS appeal but are missing HNO PIN or COD-PS population go to the **watch list** ([`InCohortFallbackRow`](./pipeline/api/schemas.py)), surfaced separately with their INFORM Severity and dollar figures but **no gap score**.

A country with no documented appeal is often *more* overlooked than anything the ranking captures. The cohort filter is an analytical boundary, not a claim of safety. The UI's Data-coverage panel is the primary-source-of-truth for what the ranking cannot see.

Non-goals, explicit:
- No LLM-generated numbers anywhere the jury sees a figure (the briefing lead is a Jinja template; the LLM path is post-MVP with a numeric validator).
- No external data enrichment in the ranked table (no ACLED, IPC, or media signals).
- No coverage-by-demographic (FTS does not split funding by demographic; PIN disaggregation is read-only context).
- No fairness / counterfactual ranking.

## 2. Gap-scoring & ranking logic

### Default composite — multiplicative

Implemented at [`pipeline/compute/composites.py::gap_score`](./pipeline/compute/composites.py):

```
gap_score = (1 − min(coverage_ratio, 1)) × (0.5 · pin_share + 0.5 · norm_log10(pin))

coverage_ratio = funding_usd / requirements_usd         # raw, uncapped for display; clipped at 1.0 only inside the score
pin_share      = pin / population                        # proportional burden, in [0, 1]
norm_log10(pin)= (log10(pin) − 6.0) / (8.3 − 6.0)       # absolute scale, clipped to [0, 1]; bounds = log10(1M) and log10(~200M)
```

**Why multiplicative, not additive.** The question is *how much of a large need is left unfunded.* A country with perfect funding (shortfall = 0) should score zero regardless of its need signal, and a country with enormous need but no funding gap should also score zero. A sum can't express that; a product can. The shortfall term gates the need term.

**Why a blended need signal.** Proportional burden alone (`pin_share`) over-weights tiny countries where a modest PIN is a large share of the population. Absolute scale alone (`log10(pin)`) over-weights megacountries. We blend them 50/50 with log dampening on the absolute term so a 10× jump in PIN is a single step on the normalized axis. The fixed bounds (`log10(1M)` … `log10(~200M)`) are tied to the cohort floor and a practical ceiling; they do not drift from run to run.

**Why `min(coverage, 1)` inside the score but raw `coverage_ratio` on display.** Over-coverage (`ratio > 1`) is real in FTS — late-reporting and multi-year pledges routinely push a country past 100%. Clipping avoids negative shortfalls in the score; preserving the raw ratio elsewhere tells the coordinator the country is actually funded.

### Opt-in custom composite — linear

Also in [`composites.py::custom_gap_score`](./pipeline/compute/composites.py):

```
custom_gap_score = w_coverage · coverage_gap
                 + w_pin      · pin_share
                 + w_chronic  · chronic_years / 5
                 (weights must sum to 1.0)
```

The Advanced panel in the UI exposes these three weights for a coordinator asking a different question ("what if I weight chronic neglect more heavily?"). The panel's verbatim disclaimer: *"Custom weights use a linear composite; the default score is multiplicative. Setting weights won't reproduce the default — they answer different questions."*

### Ranking modes

Exposed via the `Mode` enum ([`schemas.py`](./pipeline/api/schemas.py)):

| Mode | Sort | What it emphasises |
|---|---|---|
| `acute` | `gap_score desc` | point-in-time shortfall × need |
| `structural` | `chronic_years desc`, tiebreak `gap_score` | long-term neglect |
| `combined` | default mixed view | both lenses in one table |

`structural` is not a different score — it is a re-sort of the same rows. The structural vs acute distinction is the bonus task's explicit question; the mode switch and the `chronic_years` column together answer it.

### Decomposition

Every `gap_score` cell in the UI is clickable. The modal shows, for that row: `coverage_ratio`, `pin_share`, `norm_log10(pin)`, the multiplicative decomposition, the 2024 rank (if applicable), and the component-vs-composite disagreement note. No numbers in the modal are computed on the frontend — all come from the same backend row.

## 3. Data handling — missing, outdated, inconsistent

Humanitarian data is messy by nature. We encode every assumption as either an [`ExclusionReason`](./pipeline/api/schemas.py) (row can't be ranked) or a [`QAFlag`](./pipeline/api/schemas.py) (row is ranked but flagged).

### Joins

- **Always on P-codes, never on country / admin names.** Names vary across sources; P-codes are the stable canonical ID. See [`CLAUDE.md`](./CLAUDE.md) §gotchas.
- **COD-PS has only ISO3 at admin-0**; admin-1 P-codes are used for subnational views in 2025.

### HNO schema drift (2024 → 2025 → 2026)

The three years of HNO parquet files have **different schemas**. 2024 has no P-codes and numeric columns stored as strings; 2025 adds P-codes and keeps string-typed numerics; 2026 is preliminary and national-only. Loaders are per-year in [`pipeline/ingest/hno.py`](./pipeline/ingest/hno.py), the HXL tag row is dropped, and `population_stale` fires when `analysis_year − Reference_year > 2` (COD-PS tops out at 2024).

Country-level PIN is the single row where `cluster='ALL' AND category IS NULL` — no blind `SUM()`. This is one of the easiest places to double-count.

### FTS: self-reported, eventually-consistent

- `typeName` is ~32% populated. We cascade: known type → `HRP`/`FlashAppeal`/`RegionalRP`; else `requirements > 0` → `Unknown`; else `None`. `None` is always excluded.
- Three 2026 transaction files (`incoming`, `internal`, `outgoing`) are overlapping views of the same flows — never summed across.
- Missing funding is treated as 0 for ratio math and carries a `funding_imputed_zero` flag when requirements > 0.

### Watch-list rescue for countries without HNO PIN

The watch list uses three layered rescue rules (see [`calibration_card.md`](./outputs/calibration_card.md) §8):

| QA flag | What's missing | What survives |
|---|---|---|
| `fts_year_fallback` | Analysis-year FTS requirements = 0 | Prior-year requirements, funding, coverage |
| `population_unavailable` | COD-PS has no row for this ISO3 | PIN, severity, dollar figures (no `pin_share`) |
| `need_proxy_inform` | HNO PIN unavailable both years | INFORM Severity + dollar figures only |

None of these rows receive a `gap_score`. Mixing them into the ranked column would mislead a coordinator sorting by it. They are surfaced in their own section, sorted by INFORM Severity.

### QA flag taxonomy

Twelve values, all defined in [`schemas.py`](./pipeline/api/schemas.py): `funding_imputed_zero`, `hno_stale`, `population_stale`, `donor_conc_2026_only`, `cluster_taxonomy_mismatch`, `severity_unavailable`, `preliminary_hno`, `hrp_status_unknown`, `cluster_funding_missing`, `fts_year_fallback`, `need_proxy_inform`, `population_unavailable`. Every ranked row carries the full list; every exclusion has an `ExclusionReason`: `no_active_hrp`, `stale_hno`, `no_fts_appeal_record`, `no_population_baseline`.

We flag, we don't hide.

## 4. Models, heuristics, external systems

### What we use

- **Python stack:** Polars + DuckDB (no pandas), FastAPI + Pydantic v2, Jinja2 for rendering the [calibration card template](./pipeline/evaluation/templates). Python 3.12+, developed on 3.14.
- **Frontend:** Next.js 16 + React 19 + Tailwind 4, shadcn-style primitives, `nuqs` for URL state, `recharts` for visualizations, Leaflet for the `/maps` route.
- **INFORM Severity Index — March 2026 country-level snapshot** ([`datasets/202603_INFORM_Severity/`](./datasets/202603_INFORM_Severity)). The only dataset we use that was not in the original challenge list. We do **not** use it as a score input — the HNO parquet has no severity column, so INFORM is exposed as a separate `inform_severity` field on every row and is the sort key for the watch list. Disclosed per the brief's "declare external data sources" rule.
- **CBPF allocations** as a **read-only validator** ([`pipeline/ingest/cbpf.py`](./pipeline/ingest/cbpf.py)). The provided `humanitarian-response-plans/` directory has a filename/content mismatch — it actually contains CBPF pooled-fund files. We read them to cross-check FTS flows, not to drive the ranking.

### What we deliberately don't use

- **No LLM in production scoring.** The briefing-note lead is a deterministic Python template (`_briefing_lead` in [`pipeline/api/service.py`](./pipeline/api/service.py); `lead_source: "template"`). An `"llm"` variant is wired in the schema but disabled until a numeric validator can certify that no figure is hallucinated. The brief's rule "do not fabricate or hallucinate funding or need figures" is load-bearing for this choice.
- **No ACLED, IPC, or ReliefWeb in the MVP.** Extensions discussed in §7.
- **No automated NLQ layer.** `POST /api/nl-query` is reserved and returns 501 in the MVP. Coordinator intent is expressed through URL state instead: sort, mode, sector, floor, weights, scatter view.

## 5. Temporal & cross-source signals we actually ship

This is where the bonus question is addressed. Four signals, all implemented, all visible in the dashboard.

### 5.1 `chronic_years` — strict consecutive-underfunded count

[`pipeline/compute/chronic.py::chronic_years`](./pipeline/compute/chronic.py).

Rules:
- Walk backward from `analysis_year − 1` up to 5 years.
- A year counts as underfunded if `coverage < 0.5`.
- The chain breaks on either `coverage ≥ 0.5` or a missing-appeal year (missing data is **not** evidence of underfunding).
- **Only the 3rd and later consecutive underfunded years are counted.** Two-year gaps are not "chronic."
- Capped at 5.

A country with five consecutive sub-50%-covered years returns 3. The threshold-before-count design deliberately resists labelling one-off dips as structural.

### 5.2 `structural` mode

Re-sorts the same cohort by `chronic_years desc` with `gap_score` as the tiebreak. The answer to *"what ranks differently if I prioritise long-term neglect?"* is a one-keystroke toggle. Scatter A shifts emphasis to the Y-axis (`chronic_years`) in this mode.

### 5.3 Donor HHI — concentration risk

[`pipeline/compute/donor_hhi.py::donor_concentration`](./pipeline/compute/donor_hhi.py). Herfindahl-Hirschman Index over per-donor commitment shares for a country-year. Higher = more concentrated = more exposed to a single donor's retreat.

2026-only, because the provided transaction-level data does not exist pre-2026. Every HHI figure in the UI carries the `donor_conc_2026_only` QA flag and the label **"Top donors by commitment (HHI)"** — we include pledge + paid + commitment statuses, because the question is *who is on the hook*, not *who has paid*.

### 5.4 Sector-level gap projection

[`pipeline/transform/sector_ranking.py::build_sector_projection_rows`](./pipeline/transform/sector_ranking.py). The same `gap_score` formula projected onto cluster-level data:

```
cluster_gap_score = (1 − min(cluster_coverage_ratio, 1)) × cluster_pin_share
```

When a sector is active (chip in the UI), each country's rank is driven by the sector-specific version of the formula. Implementation details that matter:

- **PRO-\* collapse.** `PRO-GBV`, `PRO-CP`, `PRO-HLP` are already carved out of the country-level PRO row in HNO. Summing them with PRO would double-count; the umbrella sector sums PRO only.
- **ETE → ETC alias.** 2025 uses `ETE` for Emergency Telecommunications; the loader treats it as `ETC`.
- **Harmonized taxonomy with fallback.** We prefer `fts_requirements_funding_globalcluster_global.parquet`; the raw cluster file is fallback when harmonized has no rows for the year.
- **`cluster_funding_missing` QA flag** when HNO has PIN but FTS has neither requirements nor funding for that cluster — the row stays in the sector view and is flagged, not hidden.

### 5.5 2024 back-test

[`pipeline/evaluation/backtest.py`](./pipeline/evaluation/backtest.py). Re-runs the ranking at `analysis_year=2024` and classifies each country-transition:

| Class | Meaning |
|---|---|
| `data_grounded` | Rank moved because the underlying data (PIN, funding, coverage) moved |
| `methodology_sensitive` | Rank moved because of a methodology-level sensitivity, not a real data shift |
| `cohort_entry` / `cohort_exit` | Country moved in or out of the strict cohort between years |

Five largest movers plus the full transition sample land in [`outputs/calibration_card.md`](./outputs/calibration_card.md) §4. This is what lets a coordinator answer *"has this ranking been stable?"* without running anything.

### 5.6 Sensitivity and disagreement — calibration card

The calibration card ([`outputs/calibration_card.md`](./outputs/calibration_card.md)) regenerates from the pipeline (`scripts/regenerate_calibration_card.py`) and is the defensibility artifact. It reports:

- Top-10 Jaccard across 9 denominator × cohort-floor variants (default stays 1.00; worst non-default is Affected_1M at 0.08, with the drop explained row-by-row).
- `require_hrp` toggle sensitivity.
- Component-vs-composite disagreement cases — e.g. Sudan's `gap_score` rank is 1 even though its raw `coverage_gap` rank is 13, because `pin_share` and `log10(pin)` dominate its need term.
- Watch-list coverage.

## 6. Failure cases, limitations, open problems

Canonical list in [`outputs/calibration_card.md`](./outputs/calibration_card.md) §6 & §7. Adding the following from this write-up's perspective:

- **Watch-list misread risk.** A coordinator who skims the ranked table and stops there will miss countries on the watch list (YEM, UKR, SYR, MMR, PSE, PAK, etc.). These rows often represent larger-scale neglect than anything the ranking surfaces — the data is too sparse to assign a score, not the need too small. The UI surfaces them in a dedicated section sorted by INFORM Severity; a jury reading only the table would miss this affordance.
- **Cohort filter is a lens, not a safety claim.** A country excluded as `no_active_hrp` is not "not overlooked" — it often is overlooked in a stronger sense. We state this explicitly in the calibration card §7 and in the UI exclusion panel.
- **2026 HNO is preliminary and national-only.** Subnational views and cluster drill-downs are disabled when 2026 is selected. The `preliminary_hno` flag attaches.
- **Donor HHI is 2026-only.** Transaction-level data pre-2026 does not exist in the provided files; the metric simply cannot be back-computed. We do not synthesize one.
- **No severity in HNO.** The challenge brief lists severity as a signal; no HNO parquet exposes a severity column. Scatter B uses an absolute × proportional burden frame (`X = log10(pin)`, `Y = pin_share`, bubble = `unmet_need_usd`) instead. INFORM Severity is available as a separate field but is not wired into the composite — doing so would mean swapping out the `log10(pin)` term, which the calibration card cannot yet validate.
- **`cluster_taxonomy_mismatch` stays in-cohort.** When a country's cluster-level FTS request doesn't resolve in the harmonized `globalCluster` taxonomy, the row is flagged but not excluded, and the drill-down shows a raw-taxonomy fallback header.
- **FTS retroactive revisions cause non-determinism across runs.** Running the same ranking twice, a week apart, can produce different numbers as FTS absorbs revisions. The `data_freshness` field on every response exposes the snapshot timestamp; the calibration card carries the max parquet mtime.
- **No counterfactual or fairness ranking.** We do not model what a ranking would look like under different donor allocation priors, nor do we surface group-level fairness across demographics or clusters beyond the per-sector lens.

## 7. Forward-looking extensions (bonus continuation)

Narrative only — none of these are shipped. Listed with their concrete integration point so a follow-up contributor can pick any one off the shelf:

| Extension | Signal | Integration point |
|---|---|---|
| **ACLED event density** | Conflict events per capita per country-year | New ingestor; join on ISO3/P-code; new column `acled_event_density` surfaced in the need axis or as a multiplier on `gap_score` |
| **IPC food-security phases** | % of population in IPC 3+ | Replaces or augments `norm_log10(pin)` with a severity-weighted need term; requires a calibration-card re-run to validate stability |
| **ReliefWeb media-attention index** | Log article count over the last N days per ISO3 | Multiplier: countries with low media attention rank higher as "overlooked"; new column, not in the need axis to keep `gap_score` data-only |
| **Multi-year coverage slope** | Linear trend of `coverage_ratio` across last 3–5 years | Continuous temporal signal; complements the binary `chronic_years` count. Hook at `transform/trend.py` |
| **Demographic / displacement disaggregation** | IDP counts, gender-disaggregated PIN | Addresses the brief's "populations consistently missed"; surfaced at the row-detail level, not in the composite, until it can be aggregated without loss |
| **LLM briefing lead with numeric validator** | Fluent prose over the already-computed fact sheet | Replace the Jinja template; validator asserts every number in the lead comes from the fact sheet verbatim. `lead_source: "llm"` is already in the schema |
| **NL query decomposition** | Route "show me WASH gaps > 1M PIN" to URL state | `POST /api/nl-query` is reserved (501 today); implementation is a thin LLM-to-filter layer — no numeric generation |

## 8. How it fits into a coordinator's workflow

**Scan.** Open the dashboard. Default view is the strict cohort sorted by `gap_score` descending. The top row is the most likely starting point for a briefing.

**Decompose.** Click the `gap_score` cell. The modal opens with the multiplicative decomposition, component ranks, and the 2024 rank (if applicable). A coordinator can immediately see whether the top rank is driven by coverage, proportional burden, or absolute scale.

**Flip lenses.** Press `2` for structural mode; press `b` for Scatter B. The same cohort, re-sorted. Chronic cases surface. `3` for combined, `1` for acute.

**Share.** Press `u` (or click *Copy share URL*). URL state is the source of truth — every filter, sort, weight, and scatter choice reproduces exactly from the URL.

**Justify.** Link [`outputs/calibration_card.md`](./outputs/calibration_card.md) to the briefing. The card names the largest 2024→2025 movers, classifies each transition as `data_grounded` or `methodology_sensitive`, and reports the top-10 Jaccard across nine methodology variants.

The tool is **a lens over the data, not a decision engine.** Every composite decomposes into its inputs. Every exclusion has a visible reason. Every ranking is reproducible from the URL.

## 9. Data sources & declarations

Per the brief's "declare any external data sources" rule:

- **Provided datasets used as primary sources:** HNO (HPC), HRP (note: the directory contains CBPF files — handled as validation context), COD-PS Global, FTS global requirements & funding (appeals, harmonized cluster, raw cluster, 2026 incoming transactions).
- **External dataset added:** INFORM Severity Index, March 2026 country-level snapshot (`datasets/202603_INFORM_Severity/`). Used only as a display field and the watch-list sort key — **not** a score input.
- **No external models or APIs used in production scoring.** No ACLED, IPC, ReliefWeb, or LLM API is called anywhere in the ranked-table code path.
- **Briefing-note lead is a deterministic template** (`_briefing_lead` in [`pipeline/api/service.py`](./pipeline/api/service.py)); `lead_source="template"` in every response today.
- **License / redistribution:** All datasets are used read-only under their original humdata.org licenses. No dataset is redistributed in `datasets/` modified form.

## 10. Reproducibility & verification

```bash
# First-time setup
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
(cd frontend && npm install)

# Boot backend (:8000) + frontend (:3001) in one command
./scripts/run-dev.sh

# Regenerate the calibration card (judge-facing artifact)
.venv/bin/python scripts/regenerate_calibration_card.py

# Frontend type-check
(cd frontend && npx tsc --noEmit)
```

Cross-checks a jury can run without reading any code:

1. `GET http://127.0.0.1:8000/api/ranking` — full in-cohort table. Meta block reports `total_count`, `excluded_count`, `fallback_count`, `data_freshness`.
2. `GET http://127.0.0.1:8000/api/ranking?mode=structural` — structural re-sort.
3. `GET http://127.0.0.1:8000/api/coverage` — excluded countries + watch list.
4. `GET http://127.0.0.1:8000/api/country/SDN` — row + clusters + trend + briefing note for Sudan.
5. `GET http://127.0.0.1:8000/api/health` — liveness + dataset freshness.
6. Open `http://localhost:3001/?weights=coverage:0.3,pin:0.3,chronic:0.4&scatter=b` — custom linear composite, Scatter B.

Everything the jury sees on screen is derivable from the committed parquets plus this repo. No network calls, no API keys, no secrets.
