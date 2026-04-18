# Geo-Insight: Base Requirements Specification

Specification for the UNOCHA Datathon 2026 "Which Crises Are Most Overlooked?" challenge. Reading-order for a 10-minute validator; detailed design rationale, including three iterations of external critique, lives in the companion design plan (`~/.claude/plans/hey-this-is-the-golden-journal.md`). Authoritative brief: `../geo-insight-challenge.md`.

Scope of this document: the **base requirements spec**. A data-pipeline spec, test plan, and/or UI-component spec may be drafted as supplementary specs, each with its own review checkpoint. No application code is written against this spec until the user explicitly approves the full spec set and says "proceed to implementation."

---

## 1. Problem statement & user

**Problem.** Humanitarian decision-makers need to quickly identify where documented need outpaces funding coverage across active humanitarian crises. Existing data sources (HNO needs data, FTS funding flows, CBPF pooled-fund allocations) are separately authoritative but not integrated: no single view ranks crises by the gap between need and coverage, distinguishes structural (multi-year) neglect from acute gaps, or makes analytical assumptions visible to a non-technical reader.

**User.** Two decision-support personas:
- *Humanitarian Coordinator* (country or regional level) — preparing briefing notes, response-plan revisions, or allocation rationales.
- *Donor advisor* — evaluating where marginal funding is most needed.

Both expect: a defensible ranking that decomposes into its inputs, explicit awareness of what the tool cannot see, and a lens over the data — not an automated decision.

**Goal.** Given a cohort (filtered by PIN floor, active HRP, analysis year) and an optional natural-language or structured query, return ranked crises by the gap between documented humanitarian need and funding coverage. Extend via multi-year signals (chronic-year count, donor concentration) to capture structural neglect. Support decision-making, not automated decision-making.

---

## 2. Scope & non-goals

### In scope

- Country-level gap analysis and ranking for active HRP cohorts in the analysis year (default 2025; 2024 and 2026-preliminary selectable).
- A default **multiplicative** composite (`gap_score`) and an opt-in coordinator-controlled **linear** composite (`custom_gap_score`). Both are always decomposable into their components.
- Two toggleable scatter views: funding-response (Scatter A) and humanitarian-situation (Scatter B).
- A coordinator-facing **mode toggle** (Acute / Structural / Combined) that presets sort + scatter emphasis in one click.
- Cluster-level coverage drill-down per country and cohort-wide (the team's "unfunded population groups" requirement).
- Multi-year trend chart per country: two-curve historical (`requirements` / `funding`) + a 2026-only pledged-vs-paid inset.
- Per-row briefing notes with deterministic template fact sheets and LLM-assisted lead paragraphs under strict grounded-generation constraints.
- Uncertainty surfacing: data freshness, imputed-zero funding, cohort exclusions, data-coverage blind spots.
- Evaluation of composite construction (sensitivity analysis, 2024 back-test, component-vs-composite disagreement cases).
- CSV export + URL state for shareable, reproducible views.

### Non-goals (forward-looking, anticipating likely judge questions)

- **No choropleth map.** Maps imply geographic precision the cohort-scale data doesn't support. Country-level ranking is the right analytical unit.
- **No LLM-generated rankings or numbers.** All ranking-side numbers come from the source data. LLM is used only for briefing-note lead prose, under JSON-only input + strict grounded-generation + numeric-token validator + pure-template fallback. Zero hallucination on numbers is a hard constraint.
- **No external data enrichment** (ACLED conflict events, IPC food-security phases, media salience) in the MVP. API integration + taxonomy work doesn't fit the hackathon budget; blind-spot surfacing is done from internal signals only.
- **No multi-turn conversation.** NL query is one-shot with mandatory echo-back chips; structured filter chips are the source of truth.
- **No fairness framing.** Counterfactual "fair-share allocation" ranking is out of scope — the fairness axiom is normatively loaded and would invite judge pushback on the premise rather than the mechanism.
- **No demographic-level coverage.** HNO tracks PIN by demographic (IDPs, refugees, host community, sex, age, disability). FTS does not split funding by demographic. We show PIN disaggregation as read-only context; we do not compute coverage-by-demographic from a proportional-allocation assumption.
- **No automated decision-making.** Every surface is a lens; rankings always decompose to components. The composite is never imposed as the answer.

---

## 3. Stack decisions

### Frontend

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components (table, sliders, segmented control, dropdown, chips, modal, tooltip)
- **Charting:** Recharts for Scatter A, Scatter B, and the country trend chart. *Rejected:* Plotly — heavier bundle, better for zoom/pan on dense plots, but that isn't core here. If Recharts can't handle a specific interaction (e.g., linked-selection between table row and scatter point), revisit for that one chart only.
- **URL state management:** `useSearchParams` from Next.js. The URL encodes: cohort chips, mode, sort column + direction, active scatter, custom weights, analysis year, filter selections. URL-state-first is the explicit architectural choice — it is literally the defensibility story ("a shared URL reproduces the ranking," true because the URL is the ranking input).

### Backend

- **Framework:** FastAPI + Pydantic (request/response schemas)
- **Query engine:** **DuckDB** for analytical queries over Parquet. DuckDB reads Parquet files natively from disk; no ETL step, no database migration, no dtype round-trip risk on P-codes. SQL-on-Parquet directly. In-process.
- **In-memory ops:** Polars for anything easier to express imperatively than in SQL (row-wise QA flag assembly, Herfindahl computation, trend-series post-processing).
- **No Supabase / no Postgres.** Rejected because: (a) the data is read-only, columnar, and analytical — not the shape Postgres optimizes for; (b) ETL from Parquet into Postgres would eat hackathon hours and risk losing the P-code string dtype preservation that `datasets/CLAUDE.md` flags as load-bearing; (c) URL state covers the "shareable, reproducible view" requirement without a database.
- **Stateless per-request:** each FastAPI handler re-queries DuckDB against the Parquet files. No connection pooling, no long-lived ORM state, no caching layer in MVP. If caching becomes necessary under load, in-process LRU is the first step — not an external store.

### LLM

- **Post-MVP.** The briefing-note lead uses the pure-template fallback until the LLM integration is added as a separate task after the deterministic core ships. The spec's LLM-grounded-generation constraints (JSON-only input, max 3 sentences, numeric validator, template fallback) remain normative for when the integration lands.
- **Validator numeric tolerance (when implemented): ±2% on the raw value**, not on the printed-rounded form. A generated "6.9 million" must match any raw value in `[6,762,000, 7,038,000]`. Otherwise 6,800,000 — which also rounds to "6.8M" and is clearly the same figure modulo rounding — would be rejected on representation alone. The validator's job is to catch hallucinated figures, not casual rounding.

### Deployment

- **Frontend:** Vercel (if a live demo URL is needed)
- **Backend:** long-lived container on Railway / Render / Fly.io. **Not** Vercel serverless functions — cold starts re-parse Parquet metadata per invocation, which makes DuckDB's native-Parquet advantage useless. FastAPI + DuckDB wants a warm container.
- **For the hackathon demo itself:** local (localhost frontend + localhost backend) is fine. Judges care about the working prototype, not infra. Deploy live only if time permits after core ships.

### Data

- **Parquet files as-is, read from disk on the backend.** No ETL, no schema migration. DuckDB registers each Parquet file at query time.
- **Raw data read-only.** Cleaned/joined outputs, when written, go to a `processed/` or `outputs/` directory, gitignored.

### Cross-spec interface contract

**Pydantic schemas on the backend are the canonical type definitions.** TypeScript types on the frontend are generated from Pydantic (via `datamodel-code-generator` or equivalent). Schema changes mid-build surface as compile errors on both sides — this is how parallel agents coordinate without stepping on each other. See Section 11 (Spec-set structure) for the multi-spec breakdown.

---

## 4. Data sources

All sources are Parquet (snappy) under `datasets/`, converted from publicly available UNOCHA CSV. Raw data is read-only.

### Files, coverage, roles

| Dataset | Path (under `datasets/`) | Time coverage | Rows | Join keys | Role |
|---|---|---|---|---|---|
| HNO 2024 | `global-hpc-hno/hpc_hno_2024.parquet` | 2024 | 387,821 | `ISO3` (no P-codes) | PIN (`In Need`), cluster, population-group and demographic breakdowns via `Category` |
| HNO 2025 | `global-hpc-hno/hpc_hno_2025.parquet` | 2025 | 318,261 | `ISO3`, `ADM1_PCODE`–`ADM3_PCODE` | Subnational PIN (`In Need`) + cluster |
| HNO 2026 (preliminary) | `global-hpc-hno/hpc_hno_2026.parquet` | 2026 | 135 | `ISO3` | National-only preliminary; PIN + cluster |
| COD-PS admin0 | `cod-pos-global/cod_population_admin0.parquet` | 2001–2026 | 6,723 | `ISO3` | Population denominator for `pin_share` |
| FTS aggregate | `global-requirements-and-funding-data/fts_requirements_funding_global.parquet` | 1999–2026 | 3,806 | `planCode`, `ISO3`, `year` | `requirements_usd` + `funding_usd` per appeal × year; **no pledged/paid split** |
| FTS cluster | `…/fts_requirements_funding_globalcluster_global.parquet` | 1999–2026 | 10,631 | `+ globalCluster` | Cluster-level funding for drill-down |
| FTS incoming 2026 | `…/fts_incoming_funding_global.parquet` | 2026 only | 10,298 | `destPlanCode`, `destLocations` (transaction-level) | Pledged-vs-paid status; donor granularity for `donor_concentration` |
| CBPF timeline | `humanitarian-response-plans/AllocationsTimeline_*.parquet` | 2018–2026 | 695 | `CBPF`, `fundId` | Historical pooled-fund allocations; validates chronic-year signal |

Schema details per-dataset live in each dataset's own `README.md` and are authoritative over this summary.

### Known quality issues and our handling

- **HNO schema drifts 2024 → 2025 → 2026.** Loaders are per-year. Don't assume columns are stable.
- **No severity column in any HNO Parquet.** Only `Population`, `In Need`, `Targeted`, `Affected`, `Reached` — severity-phase data is absent. This is a hard constraint on the MVP; see `spec-data-pipeline.md` §0.1 for the resulting amendments (severity removed from the composite, Scatter B re-axed).
- **HNO rows overlap** (totals coexist with sectoral/demographic breakdowns in the same file). Handling: explicit group-by on disaggregation columns; no blind `SUM()`.
- **FTS is self-reported and retroactively revised.** Treated as eventually-consistent; download date snapshotted at run time.
- **FTS `incoming` / `internal` / `outgoing` overlap** (same flows, different viewpoints). `incoming` is the primary transaction source for 2026; we never sum across the three.
- **2026 HNO is preliminary** (135 rows, national-only). Gated behind a scope-banner chip with a visible preliminary warning; subnational/cluster columns gray out when 2026 is active.
- **P-code dtype preservation** (leading zeros). Parquet preserves strings; no CSV round-trips without explicit dtype enforcement.
- **Aggregate FTS lacks pledged/paid split.** Two-curve historical trend + 2026-only transaction-based inset; carried as `OPEN_QUESTION_TREND_CURVES`.
- **FTS does not break funding by demographic.** Documented non-goal. PIN-by-demographic shown as read-only disaggregation with explicit "coverage not computable" disclaimer.

### Join convention

**ISO3 + P-codes only.** Never join on country or admin names — names drift across sources (abbreviations, diacritics, "Republic of X" vs "X"). P-codes are the canonical stable ID.

---

## 5. Analytical definitions

Every formula that drives a ranking, column, or visual. Component columns are all visible in the default table; the composite is never shown alone.

### Primary composite (default)

```
gap_score = (1 − min(coverage_ratio, 1)) × pin_share
         ∈ [0, 1]
```

**Multiplicative.** Zeroing either factor zeroes the score. Interprets as "fraction of population affected × fraction of appeal unfunded." Selects crises that fail on both axes at once.

### Custom composite (opt-in Advanced panel)

```
custom_gap_score = w_coverage · coverage_gap
                 + w_pin      · pin_share
                 + w_chronic  · chronic_norm
                   where Σ w_i = 1

coverage_gap   = 1 − min(coverage_ratio, 1)
chronic_norm   = chronic_years / 5
```

**Linear / additive.** Allows weighted tradeoffs across three dimensions. Attribution transfers to the coordinator via sort-by header (*"your weights: coverage X% · pin Y% · chronic Z%"*). URL-preserved. **Cannot reproduce `gap_score`** — a linear composite is never identical to a product of two factors. Panel-header disclaimer makes this explicit.

> **Amended from an earlier four-slider design** (which included `w_severity · severity_norm`). Severity is not computable from the provided HNO Parquet files — no severity column exists — so the severity term and its slider are removed from the MVP. Full reconciliation at `spec-data-pipeline.md` §0.1. If severity data is located post-MVP, the slider is re-added additively.

### Components

```
coverage_ratio   = funding_usd / requirements_usd         (raw, uncapped)
unmet_need_usd   = max(0, requirements_usd − funding_usd)
pin_share        = pin / population_admin0                 (COD-PS, nearest ref year ≤ analysis_year)
```

`coverage_ratio` is preserved raw (uncapped); capping at 1.0 happens only inside the `gap_score` calculation. Overfunding signals (`coverage_ratio > 1`) stay visible in the column.

**`population_stale` behavior: advisory, not blocking.** If the nearest COD-PS reference year is >2 years from `analysis_year`, `pin_share` is still computed using that nearest-available population estimate, still displayed, and the row carries a `population_stale` QA flag. Rationale: population changes slowly; a 2-year-old estimate is better than no estimate, and blocking the calculation would drop too many countries from the ranking. A coordinator who wants to exclude stale-population rows filters by the QA flag.

### chronic_years

```
chronic_years = strict consecutive count of prior years with coverage_ratio < 0.5,
                counting back from (analysis_year − 1),
                capped at 5 years.

Chain breaks on:
    - coverage_ratio ≥ 0.5 in year k → counter terminates at k−1
    - no appeal on record in year k → counter terminates at k−1
      (missing data is not evidence of underfunding)

Threshold: 0.5 (50% funded) — humanitarian-community heuristic for
           "significantly underfunded"
Range: [0, 5]
```

**Rejected alternatives:** rolling "K of last 5" (conflates "persistent" with "chronic"); skip-over-no-appeal (overclaims through data gaps); threshold < 0.3 (too strict, almost no countries hit) or < 0.75 (too loose, most crises count).

### severity_score_weighted — **not computed in MVP**

Severity is not present in the provided HNO Parquet files (`hpc_hno_{2024,2025,2026}.parquet` contain only `Population`, `In Need`, `Targeted`, `Affected`, `Reached` — no severity phase column). The `severity_score_weighted` formula above is preserved as the **future spec** for if severity data becomes available post-MVP. The MVP does not compute, display, or sort on severity; the `severity_unavailable` QA flag is attached to every row. Full reconciliation at `spec-data-pipeline.md` §0.1.

### donor_concentration

```
donor_concentration = Herfindahl-Hirschman Index on donor shares
                      within the analysis year
                    = Σ (s_i)^2    where s_i is donor i's share of total
                                    funding to the country
                    ∈ [0, 1]       (0 = evenly distributed; 1 = single donor)
```

Source: FTS incoming transactions for the analysis year. **Caveat:** transaction-level data is 2026-only. Every display surface that renders `donor_concentration` also renders a `donor_conc_2026_only` QA flag.

### Cohort (default)

```
Cohort = { country c :
           PIN_c ≥ 1,000,000
         ∧ hrp_status_c ≠ 'None'
         ∧ requirements_usd_c > 0
         ∧ ( require_hrp
               ? hrp_status_c ∈ {HRP, FlashAppeal, RegionalRP}
               : hrp_status_c ∈ {HRP, FlashAppeal, RegionalRP, Other, Unknown} ) }

Analysis year default: 2025
Scope-banner chips tunable: { PIN floor, HRP strictness, analysis year, denominator }
```

**Amended from an earlier definition** that was only `PIN ≥ 1M ∧ HRP/Flash active`. The pipeline audit (`spec-data-pipeline.md` §0 / §4.1) surfaced two degenerate cases: (a) countries with no appeal of record (`hrp_status='None'`) silently entering the cohort with `coverage_ratio` undefined; (b) rows with `requirements_usd = 0` producing `gap_score = pin_share`, which inverts the intended signal. Both are now always excluded, so the Pydantic contract (`coverage_ratio`, `gap_score`, `unmet_need_usd` non-Optional) holds.

The `require_hrp` scope-banner chip toggles **strictness-of-plan-type**, not presence-of-plan. `hrp_status='None'` is excluded in both chip states. Tooltip wording frozen in `spec-frontend.md` §4.1.

Excluded countries fall into one of four `ExclusionReason` classes (enum frozen at `spec-data-pipeline.md` §8):

- `no_active_hrp` — `hrp_status ∈ {Other, Unknown}` when `require_hrp=true`
- `stale_hno` — HNO row missing in both `analysis_year` and `analysis_year − 1`
- `no_fts_appeal_record` — `hrp_status='None'` OR `requirements_usd=0` (merged because both mean "no real appeal")
- `no_population_baseline` — nearest COD-PS `Reference_year` missing for this ISO3

Separately, `funding_imputed_zero` is a per-row **QA flag** (not an exclusion reason) attached to in-cohort rows where an appeal exists with `requirements > 0` but reported `funding` is null/0. It does not move a country out of the cohort; it surfaces a data-quality signal on the row.

### Modeling conventions

- **Currency:** USD, nominal (not inflation-adjusted).
- **Year semantics:** calendar year (FTS convention).
- **Coverage ratio:** `funding / requirements` — raw preserved; capped at 1.0 only inside `gap_score`; never capped for display.
- **Missing funding:** treated as 0 for ratio math, with `funding_imputed_zero` QA flag.
- **Primary need denominator:** PIN. `Targeted` or `Affected` used only in sector contexts where PIN is not broken out; documented inline at each such call site.

---

## 6. Default view & interaction model

### Entry state (no input required)

The coordinator lands on an opinionated pre-computed view. The page is never blank.

- **Scope banner** across the top: `PIN ≥ 1M · active HRP · year = 2025 · denominator = PIN · currency = USD (nominal)` · **`[N] crises excluded — [review]`**. All chips editable. Changing any chip re-runs the table and updates the exclusion count.
- **Mode toggle** next to the banner: segmented control `Acute · Structural · Combined (default)`.
- **Country table** sorted by `gap_score` desc with header *"Sorted by: gap_score · [change]"*. All columns sortable.
- **Scatter** below the table. Scatter A visible by default; Scatter B reached via view-toggle.
- **Right rail** shows the briefing note for the top-sorted row; click any row to swap in.

### Columns in the country table

| Column | Type | Source |
|---|---|---|
| `iso3` / `country` | id | HNO / COD-PS |
| `pin` | int | HNO (analysis_year) |
| `pin_share` | float [0,1] | `pin / population_admin0` |
| `requirements_usd` | int | FTS aggregate |
| `funding_usd` | int | FTS aggregate |
| `coverage_ratio` | float (raw) | `funding / requirements` — uncapped |
| `unmet_need_usd` | int | `max(0, requirements − funding)` |
| `gap_score` | float [0,1] | `(1 − min(coverage, 1)) × pin_share` |
| `custom_gap_score` | float [0,1] | linear composite — appears only when Advanced panel is active |
| `chronic_years` | int [0,5] | consecutive prior years with coverage < 0.5 |
| `donor_concentration` | float [0,1] | HHI over donors, 2026 snapshot |
| `hrp_status` | enum | HRP / Flash Appeal / None |
| `hno_year` | int | 2024 / 2025 / 2026 (preliminary) |
| `qa_flags` | list | e.g. `[funding_imputed_zero, donor_conc_2026_only]` |

### Mode toggle presets

| Mode | Default sort | Scatter A emphasis |
|---|---|---|
| **Acute** | `(1 − coverage_ratio)` desc | X-axis (acute gap) primary |
| **Structural** | `chronic_years` desc | Y-axis (chronic years) primary |
| **Combined** (default) | `gap_score` desc | Balanced |

Mode state persists in URL. Primary path for framing switches. The `[change]` column-picker dropdown is the *alternative* path — useful for ad-hoc per-column custom sorts that don't fit a mode preset.

### Two scatters (view-toggle)

- **Scatter A — funding response.** X = `1 − coverage_ratio` (0 = fully funded → 1 = zero funded), Y = `chronic_years` (0 bottom → 5 top), bubble = `gap_score`. **Top-right quadrant = acute + chronic** (high on both response measures — overlooked both acutely and structurally). Bottom-right = acute only. Top-left = chronic only. Bottom-left = well-funded.
- **Scatter B — humanitarian situation.** X = `log10(pin)` (absolute-burden lens), Y = `pin_share` (proportional-burden lens), bubble = `unmet_need_usd`. Top-right = large AND proportionally severe (worst humanitarian situation). Top-left = small but proportionally crushed. Bottom-right = large with moderate proportional burden. Bottom-left = small and moderate. No axis toggle — one axes pair.

Why two: Scatter A is about the funding pipeline's response; Scatter B is about the situation on the ground. A country top-right on B and top-right on A is overlooked on both dimensions. Toggling separates *situation* from *response*.

> **Scatter B amended** from an earlier severity-based design (`Y = severity_score_weighted`) because severity is not in the provided HNO data. Scatter A quadrant labels amended from an earlier text that mis-located *acute + chronic* at bottom-right — with the axes above, bottom-right is acute-only. Both amendments reconciled in `spec-data-pipeline.md` §0.1 and `spec-frontend.md` §0.1.a / §0.1.d.

### Score decomposition

- Click any `gap_score` cell → inline expansion shows the multiplicative form and alternate-sort ranks: `(1 − 0.16) × 0.64 = 0.538 · #2 composite · #7 unmet_need · #1 pin_share · #3 chronic_years`.
- Click any `custom_gap_score` cell → inline expansion shows the linear form: `0.54 = 0.20·0.45 + 0.20·0.62 + 0.40·0.80 + 0.20·0.76`.

### Cluster drill-down

Per-row drill opens two panels:

**Per-country cluster panel.** Clusters × {PIN, requirements_usd, funding_usd, coverage, unmet_need_usd}, sorted by unmet_need desc. Rows with `coverage < 0.20` highlighted. Taxonomy: `globalCluster` by default, chip in panel header, `cluster_taxonomy_mismatch` flag when falling back to raw `cluster`.

**Aggregate cluster view** (cohort-wide, top-level toggleable). Σ over the active cohort: one row per cluster with Σ PIN, Σ requirements, Σ funding, requirements-weighted coverage, Σ unmet_need. Sorted by Σ unmet_need. Answers "which clusters are most unfunded across all ranked countries."

**Population-group panel.** HNO PIN disaggregation (IDPs, refugees, host community, demographic breakdowns) shown read-only with the explicit disclaimer: *"Funding breakdown by population group is not available in FTS. Coverage comparisons are cluster-level only."*

### Trend view (per-country drill)

Two-curve chart of `requirements` and `funding` over time (1999–2026), shaded unmet-need area, markers on years contributing to `chronic_years` (coverage < 0.5). Inset panel visible only when 2026 is in scope: stacked bar of `paid` / `pledged` / `unmet` for 2026, sourced from the incoming-transaction file, with a cross-year-incomparability disclaimer.

### Briefing note (per-row)

1. **Lead paragraph** — LLM-generated under constraints (JSON-only input, max 3 sentences, present tense, human-centered framing). Post-generation regex-extracts all numeric tokens; each must match a value in the input JSON within **±2% tolerance on the raw value** (a generated `6.9 million` must match any raw value in `[6,762,000, 7,038,000]`). The tolerance applies to the raw value, not the printed-rounded form — otherwise a raw 6,800,000 that also rounds to "6.8M" would be rejected on representation alone. The validator's job is to catch hallucinated figures, not casual rounding. On validator failure, the pure-template fallback fires (see Section 3, LLM subsection: this path is post-MVP — until LLM is integrated, the template lead runs unconditionally).
2. **Fact sheet** — pure template, direct dataframe lookup. Zero hallucination surface.
3. **Score box** — `gap_score` decomposition + alternate-sort ranks. If Advanced panel active, `custom_gap_score` linear decomposition also visible.
4. **Qualifiers** — per-country callouts of what the view doesn't capture.
5. **Grounding note** — dataset citations.

Fallback template lead: *"In {country}, {pin:,} people — {pin_share:.0%} of the population — require humanitarian assistance in {hno_year}."*

### Advanced: custom weights panel (opt-in, collapsed by default)

Three sliders (`w_coverage`, `w_pin`, `w_chronic`), normalized to Σw = 1 on every change. Adds `custom_gap_score` column alongside `gap_score` (never replaces). Sort-by header displays attribution text. (Amended from an earlier four-slider design; the `w_severity` slider is removed in the MVP because severity is not in the HNO Parquet — `spec-data-pipeline.md` §0.1.) Panel header:

> **Custom weights use a linear composite; the default score is multiplicative. Setting weights won't reproduce the default — they answer different questions.**

URL-shareable. A reviewer opening the link sees the same ranking under the same weights and can disagree with the weight choice directly.

### NL query (conditional on Day-1 checkpoint)

Single refinement input above the table. Any NL input goes through mandatory **echo-back**: LLM produces structured filter JSON → UI renders editable chips (explicitly naming which taxonomy was chosen: `globalCluster` vs `cluster` vs HNO sector) → user confirms or edits chips → structured filter becomes the state.

**Cut checkpoint: end of Day 1 (or 50% of total build time, whichever comes first).** NL must round-trip cleanly for **≥3 of the brief's 4 example queries**. If ≤2 round-trip: cut NL, ship structured filter controls only (dropdowns, sliders, multi-selects). The echo-back requirement becomes moot in that case.

### Export & share

Export and share controls live in the `<Footer />` component (`spec-frontend.md` §4.11). The Footer renders (left to right): data-freshness timestamp, Export CSV button, Copy share URL button, and a link to the calibration card. Keyboard shortcuts `e` (export) and `u` (copy URL) invoke the same handlers as the buttons — single source of truth between mouse and keyboard paths.

- **CSV export** of the current filtered + sorted view. Columns: the visible table columns plus `qa_flags`.
- **`qa_flags` CSV serialization: semicolon-joined in a single column.** Format: `"funding_imputed_zero;donor_conc_2026_only"`. Rationale: exploding to one boolean column per flag makes the CSV 10+ columns wider and fragile when new flags are added; semicolon-joined is readable in Excel, greppable in a terminal, and round-trippable via `split(";")`. Standard multi-valued-CSV convention.
- **URL state** captures the full viewing context: cohort filters (chips), mode, sort column + direction, active scatter, custom weights (if Advanced panel active), scope-banner chip values, **plus** `focus` (which row is pinned in the briefing), `detail` (which per-country detail tab is open: `clusters` / `trend` / `population`), and `flags` (filter to rows carrying at least one named `QAFlag`). A shared URL reproduces another coordinator's *view*, not just their ranking — exhaustive schema + precedence at `spec-frontend.md` §5.
- **URL precedence rules** (detailed in `spec-frontend.md` §5.2): when mode-preset and explicit sort conflict (e.g. `?mode=structural&sort=gap_score`), the explicit sort wins. Coordinator customization overrides preset.

### Four coordinator walkthroughs

All four must be runnable end-to-end against the built system, with timed rehearsal ≤ 90 seconds each. Full UI-step detail in the design plan (Examples 1–4). Abbreviated here:

1. **"Highest PIN share, lowest funding."** Default view, `gap_score` default sort, decomposition on click. Score appears as the default lens.
2. **"Consistently underfunded across years."** Click **Structural** on the mode toggle — presets `chronic_years` sort + Scatter A Y-axis emphasis in one click. Score stays as a visible column, steps aside from ordering. The `[change]` dropdown is the alternative path for ad-hoc sorts.
3. **"Acute food insecurity with <10% funding."** NL query echo-back → structured filter `cluster = Food Security (globalCluster) · coverage_ratio < 0.10`. Score appears within the filtered subset, decomposition in the fact sheet. The filtered set surfaces at least one row carrying the `cluster_taxonomy_mismatch` QA flag; clicking that row opens the cluster drill-down showing the raw→harmonized taxonomy fallback — the blind spot becomes a concrete artifact rather than a claim. Full UI-step detail in `spec-frontend.md` §9.3.
4. **"Regional coordinator weighting chronic neglect more heavily."** Tier-2 demo. Advanced panel: `w_chronic = 0.40`, `w_coverage` and `w_pin` at 0.30 each (three sliders total, not four — see §5). Mode toggle → Structural. Scatter → B (`log10(pin)` × `pin_share`, bubble = `unmet_need_usd`). Attribution in sort-by header. Export CSV; share URL. Donor advisor opens the link, sees the same ranking under the same weights, can disagree with weights rather than ranking.

---

## 7. Uncertainty surfacing

### Per-row QA badges

Inline on every row:

- `HNO:2025` (green) · `HNO:2024` (amber, stale)
- `funding:imputed_zero` (red)
- `HRP:flash_appeal` (amber)
- `donor_conc_2026_only`
- `population_stale`
- `cluster_taxonomy_mismatch`

### Banner-level exclusion count

`"[N] crises excluded — [review]"` next to scope banner chips. First-class. Clicking `[review]` opens the Data coverage panel. The exclusion is never hidden behind a sidebar.

### Data coverage panel

All four blind-spot classes derivable from the provided UNOCHA datasets (no external integrations). Enum matches the `ExclusionReason` type frozen at `spec-data-pipeline.md` §8:

- `no_active_hrp` — `hrp_status ∈ {Other, Unknown}` when the `require_hrp` chip is on; relaxing the chip moves them into the cohort
- `stale_hno` — HNO row missing in both `analysis_year` and `analysis_year − 1`
- `no_fts_appeal_record` — no real appeal of record: `hrp_status='None'` OR `requirements_usd=0`; always excluded regardless of chip
- `no_population_baseline` — nearest COD-PS `Reference_year` missing for this ISO3 (rare; blocks `pin_share` denominator)

Each country in the panel is listed with its exclusion reason.

**In-cohort QA flags** (not exclusions; attached to ranked rows so a coordinator can filter):
- `funding_imputed_zero` — FTS records the appeal but `funding` is null/0. The row is still ranked (`coverage_ratio = 0`), and the flag says "this zero is imputed, not confirmed." Formerly listed here as `zero_funding`; renamed to match the Pydantic `QAFlag` enum.

### Briefing-note qualifiers

Per-country callouts of what a given view does not capture. Examples: refugee-hosting burden not fully reflected in PIN; 2024 HNO used because a 2025 field is missing for cluster X; coverage-by-demographic not computable in this dataset.

### Score-construction transparency

Every `gap_score` display surface renders its two factors at the same visual level. Decomposition is ≤ 1 click away on every surface. The composite is never shown without its components reachable.

---

## 8. Evaluation

Defensibility checks on the composite's construction, **not** claims about ranking correctness. The goal is to show the composite is meaningful and stable — not that it matches any external "correct answer" (external advocacy lists like CARE's "Suffering in Silence" are editorial, not ground truth, and are explicitly not used as a benchmark).

### Sensitivity analysis

Recompute `gap_score` under:

- Alternative denominators: PIN → Targeted → Affected
- Alternative cohort floors: PIN ≥ 500k / 1M / 2M

= 9 rankings total. Report per non-default ranking:

- Top-10 stability (Jaccard overlap)
- Median rank change per country
- Worst-case rank shift
- Countries gained/lost under the cohort-floor swap

If top-10 Jaccard < 0.5 on any swap, the composite is definition-fragile on that axis — named in the calibration card.

**Auxiliary cohort-strictness swap.** A separate single-axis comparison measures the effect of the `require_hrp` chip: default (`HRP / FlashAppeal / RegionalRP` only) vs relaxed (adds `Other / Unknown`). Reported in the card alongside the main sensitivity matrix so a judge sees how the chip affects top-10 composition. Full definition: `spec-evaluation.md` §2.5.

### 2024 back-test

Compute `gap_score` on 2024 HNO + 2024 FTS aggregates. Compare against the 2025 ranking. Classify every mover into one of five classes:

- `cohort_entry` / `cohort_exit` — country crossed the cohort boundary between years (e.g. `hrp_status` transitioned out of `None`, `requirements_usd` went 0 → positive, or vice-versa). Specific transition reason recorded.
- `data_grounded` — change explainable by a visible input shift (PIN ±>15%, coverage ±>15%, appeal-type change).
- `methodology_sensitive` — change explainable only by composite behavior (e.g. coverage crossed the 0.5 chronic-year threshold).
- `noise` — `|Δrank| ≤ 2` with inputs within 15%.

The five-class enum resolves an edge case the pipeline amendments surfaced: countries can now enter or exit the cohort year-over-year because `hrp_status='None'` and `requirements_usd=0` are always excluded. Full decision tree + reason-helper logic at `spec-evaluation.md` §3.3.

Publish the rank-movers table + a cohort-transitions table (up to 5 each way) with per-country rationale.

### Component-vs-composite disagreement

Surface countries where `gap_score` rank differs sharply from `unmet_need_usd` or `pin_share` rank alone. These are cases where the composite is doing real work (and where the composite's opinion might be wrong or most-informative). Document 5 such cases.

### Calibration card

A single-page artifact in the submission — sensitivity (9-way) + cohort-strictness swap + 2024 back-test + 5 disagreement cases. Readable by a judge in 60 seconds.

- **Format:** Markdown, committed at `outputs/calibration_card.md`. Not PDF (would drift from regenerated analyses). Markdown renders natively in GitHub (judges click through), exports to PDF if needed.
- **Generation:** auto-generated by a Python script in the evaluation module that runs sensitivity + cohort-strictness swap + back-test + disagreement-case selection. Regenerating the analysis regenerates the card. The script's location and template structure are load-bearing for this; both are specified in `spec-evaluation.md`.
- **Access:** reached from the frontend's `<Footer />` component via its `[Calibration card]` link (`spec-frontend.md` §4.11) — `calibrationCardHref` prop points to the committed Markdown file.
- **Ships alongside the working prototype** as a judge-facing artifact.

### Out of scope for evaluation

`custom_gap_score` rankings reflect coordinator framing choices, not a system claim. They are not evaluated. The system's claim is the *default* composite and its component columns; the Advanced weights panel is a transfer of attribution, not a new ranking to be validated.

---

## 9. Open questions

### `OPEN_QUESTION_TREND_CURVES`

**Context.** FTS aggregate files (`fts_requirements_funding_*`) provide only `requirements` + `funding` at appeal × year granularity. The pledged-vs-paid distinction exists only in the 2026 transaction-level file (`fts_incoming_funding_global.parquet`). The team's "three-curve (requested / pledged / received) trend" is therefore not fully reconstructible from provided data for pre-2026 years.

**Proposed default.** Two-curve historical trend (`requirements` + `funding`, 1999–2026) + 2026-only pledged-vs-paid inset bar, visible only when 2026 is in scope, with a cross-year-incomparability disclaimer.

**Alternative.** A three-curve chart with null/flat pledged and paid curves pre-2026, visually communicating that the distinction only resolves for 2026.

**Decision needed before implementation.** No other open questions remain after plan approval.

---

## 10. Definition of done

Mechanical checklist derived from the design plan's 8-category verification suite. Every item is either passing or failing; no ambiguous criteria.

### (a) Analytical checks (score construction)

- [ ] Sensitivity analysis documented for `{PIN, Targeted, Affected} × {500k, 1M, 2M cohort floors}` (9 rankings); top-10 Jaccard overlap reported per non-default
- [ ] Cohort-strictness auxiliary swap (`require_hrp=true` vs `=false`) reported in the card alongside the main sensitivity matrix; countries added by relaxation explicitly named (`spec-evaluation.md` §2.5)
- [ ] 2024 back-test executed; every mover classified into the 5-class enum `{cohort_entry, cohort_exit, data_grounded, methodology_sensitive, noise}`; full rank-movers table **and** cohort-transitions table published with per-country rationale (`spec-evaluation.md` §3)
- [ ] 5 component-vs-composite disagreement cases spot-checked and documented in the calibration card
- [ ] Calibration card committed at `outputs/calibration_card.md` and reached from the app's `<Footer />` via the `[Calibration card]` link (not `docs/`, not an orphan file)

### (b) Default-view surfaces

- [ ] Every `gap_score` display surface renders its two factors at the same level
- [ ] Scope banner chips, QA badges, and banner-level exclusion count render on every table view
- [ ] Data coverage panel enumerates all four `ExclusionReason` classes (`no_active_hrp`, `stale_hno`, `no_fts_appeal_record`, `no_population_baseline`) and surfaces `funding_imputed_zero` separately as an in-cohort QA flag

### (c) Mode toggle (Acute / Structural / Combined)

- [ ] Each of the three modes correctly presets both sort column and Scatter A axis emphasis
- [ ] "Sorted by" header updates with the active mode
- [ ] URL state round-trips across refresh (`?mode=structural` loads Structural active)

### (d) Custom weights panel

- [ ] Sliders live-update `custom_gap_score`; table re-sorts immediately on any weight change
- [ ] Σw = 1 normalization holds after every slider change
- [ ] URL round-trip preserves weights exactly — a shared URL reproduces another coordinator's ranking
- [ ] Sort-by header displays attribution text reflecting the active weights
- [ ] Panel header displays the multiplicative-vs-linear disclaimer verbatim
- [ ] Clicking a `custom_gap_score` cell expands the linear-composition decomposition
- [ ] `gap_score` and `custom_gap_score` columns appear side-by-side when custom is active (neither replaces the other)

### (e) Cluster drill-down

- [ ] Per-country cluster panel loads correct cluster rows for a sample of 3 countries (Sudan, Chad, Yemen)
- [ ] Aggregate cohort-wide cluster view Σ-aggregates equal the sum of corresponding per-country rows within the active cohort
- [ ] `cluster_taxonomy_mismatch` flag renders correctly when `globalCluster` is missing and raw `cluster` fallback kicks in
- [ ] Population-group disaggregation view loads with the "coverage-by-demographic not computable" disclaimer visible

### (f) Scatter B (humanitarian situation — absolute × proportional burden)

- [ ] X-axis is `log10(pin)` with label "People in need (log scale)"; Y-axis is `pin_share` with label "Share of population in need"; bubble = `unmet_need_usd`
- [ ] Quadrant labels match `spec-frontend.md` §4.4 (top-right = "Large AND proportionally severe", etc.)
- [ ] No X-axis toggle is present
- [ ] Hover on a point highlights the corresponding table row (transient, no URL write); click commits `?focus=ISO3`
- [ ] Scatter B toggles cleanly with Scatter A; both views share the same active cohort
- [ ] Severity DoD items (previous draft) are removed because severity is not in the MVP data — see `spec-data-pipeline.md` §0.1

### (g) Trend view

- [ ] Two-curve historical chart renders for a sample country, including `chronic_years` markers on years with coverage < 0.5
- [ ] 2026 pledged/paid inset appears only when 2026 is in the scope-banner year selection
- [ ] Inset cross-year-incomparability disclaimer visible
- [ ] Country with no FTS history renders gracefully (empty chart + `no_fts_appeal_record` flag)

### (h) Briefing note & export

- [ ] Template-only lead renders for every row when the LLM path is disabled or unavailable
- [ ] LLM-lead numeric validator rejects hallucinated figures; fallback template lead fires on validator failure
- [ ] Fact sheet template renders all fields from dataframe lookup (zero LLM-generated numbers)
- [ ] CSV export contains exactly the current filtered + sorted view, including QA flag columns
- [ ] URL state captures: cohort filters, mode, sort column, active scatter, custom weights, scope-banner chip values

### (i) Coordinator walkthroughs

- [ ] All four coordinator walkthroughs (Examples 1–4 in the design plan) runnable end-to-end against the built system
- [ ] Each walkthrough timed and completed under 90 seconds by a user following the exact steps — timed-rehearsal evidence captured in the submission

---

## 11. Spec-set structure

This base spec is the design contract. Implementation is parallelized across three to four supplementary specs, each with its own review checkpoint. **No code is written until the full spec set is approved.**

### The four-spec layout

| Spec | Role | Critical-path status |
|---|---|---|
| `docs/spec.md` | **This document.** Base requirements — what the system does, non-goals, analytical definitions, interaction model, evaluation, definition of done. Every other spec references it. | Must exist and be approved before any other spec is written. |
| `docs/spec-data-pipeline.md` | Python backend. DuckDB/Polars loaders, unified country-year table, analytical column formulas as executable expressions, FastAPI endpoint contracts, **Pydantic schemas**, test cases with expected outputs + fixture data for Sudan / Chad / Yemen. | The critical-path spec. Must be written and approved next. Pydantic schemas at its end are the frozen interface contract. |
| `docs/spec-frontend.md` | Next.js frontend. Component tree (ScopeBanner, ModeToggle, CountryTable, ScatterA, ScatterB, BriefingNote, CustomWeightsPanel, DataCoveragePanel, TrendView, NLQueryBar), props typed from Pydantic via codegen, URL state schema (exhaustive, with precedence rules), per-walkthrough UI step lists, interaction rules, keyboard accessibility. | Can be written in parallel with `spec-evaluation.md` once Pydantic schemas are frozen. |
| `docs/spec-evaluation.md` | Defensibility artifacts. Sensitivity analysis script, 2024 back-test script, disagreement-case selection criteria, calibration card Markdown template. | Parallel with `spec-frontend.md`. Depends only on Pydantic schemas being frozen (needs column names + types). |

An optional fifth spec — `docs/spec-test-plan.md` — is **not planned by default** for the hackathon. Unit/integration/E2E tests are folded into `spec-data-pipeline.md` (backend tests + fixtures) and `spec-frontend.md` (component + E2E walkthrough tests). Extracting them into their own spec adds coordination cost without proportional benefit at this scale.

### Interface contract

**Pydantic schemas on the backend are the canonical type definitions.** The frontend's TypeScript types are generated from those schemas (via `datamodel-code-generator` or equivalent). Schema changes mid-build surface as compile errors on both sides — this is the coordination mechanism for parallel agents. If `spec-data-pipeline.md` changes a schema after it's been frozen, the change must be propagated explicitly and both `spec-frontend.md` and `spec-evaluation.md` re-reviewed.

### Sequencing

1. **Audit pass on this document (`docs/spec.md`)** — incorporate stack decisions, micro-decisions (validator tolerance, `population_stale` behavior, CSV `qa_flags` serialization, calibration card format), and this Spec-set structure section. User reviews. (This pass is the current task.)
2. **Write `docs/spec-data-pipeline.md`** with Pydantic schemas frozen at its end. User reviews — schema review is the critical checkpoint because every other spec depends on it.
3. **Write `docs/spec-frontend.md` and `docs/spec-evaluation.md` in parallel.** User reviews both.
4. **Only after all four specs are approved:** implementation begins as an autonomous run against the frozen spec set.

No application code is written at steps 1–3. Full stop.

---

## 12. Implementation meta-guidance

This section governs agent behavior during the implementation phase (step 4 above).

**Load-bearing ambiguities stop the implementation.** If a new ambiguity emerges during implementation that is not covered by this spec, by a supplementary spec, or by an active open question, **the implementing agent stops and asks.** The agent does not silently choose between reasonable alternatives on load-bearing decisions.

**Load-bearing means: anything affecting**
- Analytical output (what numbers appear in any column, what rank position is assigned)
- User-facing behavior (what happens on a click, a sort, a filter change, a mode switch; what a URL parameter controls)
- Data pipeline structure (how Parquet is loaded, joined, aggregated; which dedup rule applies to HNO overlapping rows; how schema drift across HNO years is handled)
- Evaluation methodology (which cases are surfaced, what counts as a "sharp" disagreement, what the sensitivity swap set is)

**Fair game to decide silently (purely presentational or idiomatic):**
- CSS details, spacing, exact colors within the chosen palette
- Variable naming, file organization, import grouping, linter auto-fix choices
- Test file organization (inside `tests/`, per-module vs per-feature layout)
- Docstring formatting conventions
- Boilerplate layer choices that don't affect behavior (e.g. FastAPI dependency-injection vs explicit construction, when they produce identical request handling)

**When in doubt: treat it as load-bearing and ask.** The cost of a 30-second clarifying question is far lower than the cost of silently implementing against the wrong interpretation.

**What the agent MUST NOT do, regardless of context:**
- Begin coding before the full spec set is approved.
- Silently expand scope (e.g. add a feature mentioned in the design plan but deferred from the spec).
- Silently cut scope (e.g. skip a DoD checklist item because it "feels minor").
- Alter non-goals (e.g. add an external data source that was explicitly ruled out).
- Fabricate data or numbers to fill gaps.
- Skip verification steps.

---

*End of base requirements specification. Supplementary specs (`spec-data-pipeline.md`, `spec-frontend.md`, `spec-evaluation.md`) will be drafted one at a time, each with its own review checkpoint, per Section 11. No application code is written until the user explicitly approves the full spec set and says "proceed to implementation."*
