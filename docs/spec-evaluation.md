# Geo-Insight: Evaluation Specification

Supplementary spec. Implements `spec.md` §8 (Evaluation): sensitivity analysis, 2024 back-test, component-vs-composite disagreement surfacing, and the calibration card deliverable. Depends on frozen Pydantic schemas in `spec-data-pipeline.md` §8 (column names + types).

Reads after `spec.md` and `spec-data-pipeline.md`.

---

## 0. Goal, non-goal, and reconciliation

### 0.1 Goal

Show the composite `gap_score` is *meaningful* (does real work relative to its components) and *stable* (not fragile to reasonable definition swaps). Produce a calibration card that a judge can read in 60 seconds and leave with a defensible mental model of what the ranking does and does not claim.

### 0.2 Non-goal

Proving the ranking is *correct* against an external benchmark. External advocacy lists (CARE's "Suffering in Silence", etc.) are editorial, not ground truth. `spec.md` §8 is explicit on this.

### 0.3 Reconciliation with the spec set

Changes landed in `spec-data-pipeline.md` §0 and `spec-frontend.md` §0.1 propagate into this spec. Each amendment names the upstream origin and the surface it changes here.

#### 0.3.a Severity sensitivity swaps dropped

**Origin.** `spec-data-pipeline.md` §0.1 — no severity column in the HNO Parquet files.
**Change here.** Sensitivity sweeps are over denominator (PIN / Targeted / Affected) × cohort floor (500k / 1M / 2M) only. No severity axis. The old §2 axis table is updated accordingly. Calibration card's "Known limitations" notes severity as post-MVP.

#### 0.3.b Cohort-strictness swap added

**Origin.** `spec-data-pipeline.md` §4.1 — cohort filter tightened so `hrp_status='None'` and `requirements_usd=0` are always excluded; `require_hrp` now toggles strictness-of-plan-type rather than presence-of-plan.
**Change here.** A new auxiliary sensitivity swap (§2.5) measures the single-axis effect of `require_hrp=false` at the default denominator + floor. The sweep as a whole stays 9 rankings (not 18) — the new swap is reported separately so the card doesn't balloon.

#### 0.3.c Back-test classifier handles cohort-membership transitions

**Origin.** Same as 0.3.b — tightened cohort can make a country appear in one year's ranking and not the other, even when the country itself didn't change.
**Change here.** §3.3 classifier gets a new first branch for cohort-in/out transitions with a specific reason recorded (requirements went from 0→positive, `hrp_status` shifted out of `None`, PIN crossed the floor, etc.). Rank-delta logic only runs on iso3s ranked in both years.

#### 0.3.d sensitivity_sweep module ownership

**Origin.** `spec-data-pipeline.md` §1 layout mentioned `compute/sensitivity.py` ("used by evaluation spec; lives here since formulas live here"), but this spec puts `sensitivity_sweep()` under `pipeline/evaluation/sensitivity.py`.
**Resolution.** `pipeline/evaluation/sensitivity.py` owns the sweep driver and metrics (Jaccard, rank-delta). Any re-usable primitives that truly belong to the composite math (e.g. the `gap_score` function itself) stay in `pipeline/compute/`. Pipeline spec's placeholder `compute/sensitivity.py` is **deleted from the final layout**; evaluation owns sensitivity end-to-end. No re-review of the pipeline's frozen Pydantic schemas required (schemas unchanged).

#### 0.3.e Calibration-card link surface

**Origin.** `spec-frontend.md` §4.11 — `<Footer />` component renders the calibration-card link.
**Change here.** §5 and §8 reference frontend spec §4.11 explicitly: the card is loaded into the Footer's `[Calibration card]` link with `calibrationCardHref` passed as a prop. Not "linked from the frontend" loosely.

#### 0.3.f Calibration-card content reflects amended state

**Change here.** §5.2 template's "Known limitations" and "What this card does NOT claim" sections are updated:
- Severity text no longer says "Scatter B uses need intensity (PIN / population)" — it names the current Scatter B axes (`log10(pin)` × `pin_share`).
- New bullet: cohort filter always excludes countries with no appeal of record; this is an analytical boundary, not a claim that those countries are well-resourced.
- New bullet: `cluster_taxonomy_mismatch` is surfaced as a QA flag, not an exclusion reason — the card explains how to read it.

---

## 1. Layout

```
pipeline/evaluation/
├── __init__.py
├── sensitivity.py        # sensitivity_sweep() — returns a DataFrame of (definition, iso3, rank) tuples
├── backtest.py           # backtest_2024() — returns a DataFrame of (iso3, rank_2024, rank_2025, delta, rationale)
├── disagreement.py       # disagreement_cases() — returns top 5 component-vs-composite divergence cases
├── report.py             # generate_calibration_card() — writes outputs/calibration_card.md
└── templates/
    └── calibration_card.md.jinja   # Jinja2 template — everything the card renders

scripts/
└── regenerate_calibration_card.py  # CLI entrypoint; one shell command to rebuild the card

outputs/
└── calibration_card.md             # Committed artifact — the single deliverable
tests/
└── evaluation/
    ├── test_sensitivity.py
    ├── test_backtest.py
    ├── test_disagreement.py
    └── test_report.py
```

One module per evaluation concern. The calibration card is Markdown — not PDF — so it renders natively on GitHub and regenerates deterministically from the scripts.

---

## 2. Sensitivity analysis

### 2.1 Sweep definition

Recompute the full ranking under each combination of:

| Axis | Values |
|---|---|
| Denominator | `PIN`, `Targeted`, `Affected` |
| Cohort floor (applied to the chosen denominator) | `500_000`, `1_000_000`, `2_000_000` |

= 3 × 3 = **9 rankings**. One of them (PIN / 1M) is the canonical default.

For each ranking, compute the country-year table using the chosen denominator everywhere the pipeline references `pin` (i.e., `pin_share`, `gap_score`, cohort filter).

### 2.2 Metrics reported

Per non-default ranking, compared to the default:

- **Top-10 Jaccard overlap** — `|top10_default ∩ top10_swap| / |top10_default ∪ top10_swap|`. Range [0, 1]. 1 = identical top-10.
- **Median rank change** — median of `|rank_default(iso3) − rank_swap(iso3)|` across iso3 present in both rankings.
- **Worst-case rank shift** — max of the same.
- **Countries dropped / added** by the cohort filter change.

### 2.3 Interpretation thresholds

- Top-10 Jaccard ≥ 0.7 across all 8 swaps: composite is **stable**.
- Any swap with Jaccard < 0.5: composite is **definition-fragile** on that axis; documented explicitly in the calibration card with the offending swap named.

These thresholds are decisions, not derivations. Documented as such in the card ("we call ≥0.7 stable because…").

### 2.4 API

```python
def sensitivity_sweep(analysis_year: int = 2025) -> pl.DataFrame:
    """
    Returns one row per (definition, iso3) pair with:
        definition: str              # 'PIN_1M' (default) | 'Targeted_500k' | …
        iso3: str
        rank: int                    # 1 = top-ranked in this definition's ranking
        gap_score: float
        is_default: bool
    """

def sensitivity_summary(sweep_df: pl.DataFrame) -> pl.DataFrame:
    """
    Pivots the sweep into the metrics table:
        definition | jaccard_top10 | median_rank_delta | max_rank_delta | countries_dropped | countries_added
    """
```

The frontend `/api/evaluation/sensitivity` endpoint (optional; not in MVP DoD) would return `sensitivity_summary(sweep_df)` as JSON. For MVP, the card is the only consumer.

### 2.5 Auxiliary swap: cohort strictness

Reported separately from the 9-ranking matrix to avoid doubling the sweep to 18. Single comparison:

| Definition | Cohort filter |
|---|---|
| Default | `require_hrp=true` → `hrp_status ∈ {HRP, FlashAppeal, RegionalRP}` |
| Relaxed | `require_hrp=false` → `hrp_status ∈ {HRP, FlashAppeal, RegionalRP, Other, Unknown}` |

Both definitions always exclude `hrp_status='None'` and `requirements_usd=0` (per `spec-data-pipeline.md` §4.1).

**Metrics reported** (same as §2.2):

- Top-10 Jaccard overlap, default ↔ relaxed.
- Median and max `|Δrank|` for iso3s present in both definitions.
- **Countries added by relaxation** — explicitly named in the card. These are countries that enter the cohort only because `Other` or `Unknown` plan-type inclusions are allowed. Their presence in the relaxed ranking is load-bearing for judging whether the chip tooltip's promise ("includes Other / Unknown") matches reality.

**Interpretation threshold.**

- Top-10 Jaccard ≥ 0.8 → the chip is a minor framing choice; the ranking's "top of mind" is stable.
- Top-10 Jaccard < 0.6 → the chip is load-bearing for top-10 composition; the card documents this with the shifting countries named.

**API.**

```python
def cohort_strictness_swap(analysis_year: int = 2025) -> dict:
    """
    Returns:
      {
        "default": {"cohort_size": N, "top10": [iso3, …]},
        "relaxed": {"cohort_size": M, "top10": [iso3, …]},
        "jaccard_top10": float,
        "countries_added_by_relaxation": [{"iso3": …, "hrp_status": …, "rank_in_relaxed": …}],
        "rank_delta_median": int,
        "rank_delta_max": int,
      }
    """
```

---

## 3. 2024 back-test

### 3.1 Procedure

Run the pipeline with `analysis_year=2024`. Compare to `analysis_year=2025` (canonical default). For each ISO3 present in either ranking, compute `Δrank = rank_2025 − rank_2024`.

Classify each mover into one of:

| Class | Criterion | Example |
|---|---|---|
| `data_grounded` | Change explainable by a shift in a visible input (PIN up/down significantly; funding arrived/didn't; appeal type changed) | "Sudan's PIN rose 22% and funding lagged → rank rose 3 places" |
| `methodology_sensitive` | Change explainable only by composite behavior (e.g. coverage just crossed 0.5 threshold for chronic-year chain) | "Ethiopia: coverage 0.49 → 0.52 flipped chronic_years from 2 to 0 → rank fell 4" |
| `noise` | No material change (`|Δrank| ≤ 2` and no visible input shift) | "Chad: rank 7 → 8, inputs within 5%" |

### 3.2 Output

A table with all iso3s × `(rank_2024, rank_2025, Δrank, class, rationale)`. `rationale` is a one-sentence human-readable explanation keyed off the same visible inputs a coordinator can see.

### 3.3 Rationale generation

**Rule-based, not LLM.** A small decision tree produces the rationale from numeric deltas. The first branch handles countries that cross the cohort boundary between years (added by the pipeline amendment at `spec-data-pipeline.md` §0.1 / §4.1, where `hrp_status='None'` and `requirements_usd=0` are always excluded).

```python
# First branch: cohort-membership transitions. Rank-delta logic cannot run here
# because at least one year has no rank for this iso3.
if iso3 not in ranking_2024 and iso3 in ranking_2025:
    rationale = (
        f"Appeared in 2025 cohort: "
        f"{membership_change_reason_appeared(iso3)}"
    )  # e.g. "requirements_usd went 0 → $120M"; "hrp_status None → HRP"; "PIN crossed 1M floor"
    cls = "cohort_entry"
elif iso3 in ranking_2024 and iso3 not in ranking_2025:
    rationale = (
        f"Dropped from 2025 cohort: "
        f"{membership_change_reason_dropped(iso3)}"
    )  # e.g. "appeal closed (requirements_usd 0)"; "hrp_status now None"; "PIN fell below 1M"
    cls = "cohort_exit"

# Subsequent branches: iso3 ranked in both years; delta rank well-defined.
elif abs(delta_pin_pct) > 0.15:
    rationale = f"PIN {direction(delta_pin)} {abs(delta_pin_pct):.0%}"
    cls = "data_grounded"
elif abs(delta_coverage) > 0.15:
    rationale = f"Coverage shifted from {cov_2024:.0%} to {cov_2025:.0%}"
    cls = "data_grounded"
elif crossed_chronic_threshold:
    rationale = f"chronic_years threshold crossed (coverage {cov_2024:.0%} → {cov_2025:.0%})"
    cls = "methodology_sensitive"
elif delta_hrp_status:
    rationale = f"Appeal type changed: {hrp_2024} → {hrp_2025}"
    cls = "data_grounded"
elif abs(delta_rank) <= 2:
    rationale = "No material input change; composite variance only"
    cls = "noise"
else:
    rationale = "Composite variance above noise threshold; inputs within 15%"
    cls = "methodology_sensitive"
```

**Class enum (updated).** `cohort_entry`, `cohort_exit`, `data_grounded`, `methodology_sensitive`, `noise`. The calibration card's §3 summary table lists all five classes.

**Reason helpers.** `membership_change_reason_appeared` / `_dropped` inspect the filter-failure columns from `build_excluded_table` (pipeline spec §4.1) and pick the single most-specific reason:

```python
def membership_change_reason_appeared(iso3) -> str:
    row_2024 = excluded_table_2024.row_for(iso3)   # may be None if never recorded
    row_2025 = country_year_2025.row_for(iso3)
    if row_2024 is None:
        return "appeared in 2025 ranking (no prior record)"
    if row_2024.exclusion_reason == "no_fts_appeal_record" and row_2025.requirements_usd > 0:
        return f"requirements_usd went 0 → ${row_2025.requirements_usd:,}"
    if row_2024.hrp_status == "None" and row_2025.hrp_status != "None":
        return f"hrp_status {row_2024.hrp_status} → {row_2025.hrp_status}"
    if row_2024.pin < 1_000_000 and row_2025.pin >= 1_000_000:
        return f"PIN crossed 1M floor: {row_2024.pin:,} → {row_2025.pin:,}"
    return f"cohort-filter transition (reason {row_2024.exclusion_reason} resolved)"
```

`_dropped` is symmetric.

Hard-coded thresholds (0.15 = 15%; noise `|Δrank| ≤ 2`) are documented in the card as calibration choices.

---

## 4. Component-vs-composite disagreement

### 4.1 Motivation (from spec.md §8)

Cases where `gap_score` rank disagrees sharply with `unmet_need_usd` rank or `pin_share` rank expose where the composite is doing real work — for better or worse. Surface 5.

### 4.2 Selection criterion

For each iso3 in the default ranking, compute:

```
disagreement_score(iso3) =
    max(
        |rank_gap(iso3) − rank_unmet(iso3)|,
        |rank_gap(iso3) − rank_pinshare(iso3)|
    )
```

Top 5 by `disagreement_score`. For each, the card shows a side-by-side table:

| ISO3 | rank_gap | rank_unmet | rank_pinshare | rank_coverage_gap | interpretation |
|---|---|---|---|---|---|
| (example) X | 2 | 11 | 3 | 1 | "X ranks top on coverage gap and PIN share but low on unmet need in dollar terms; composite captures 'large fraction of population, poorly funded' even though the absolute dollar gap is modest." |

### 4.3 Interpretation generation

Rule-based one-sentence selector off the pattern of which components are high/low. Documented in code as an enum of templates, not generated prose.

---

## 5. Calibration card — the deliverable

### 5.1 Format and location

- **Format:** Markdown, committed at `outputs/calibration_card.md`. Source-controlled in a way that the card is always a regeneration of the analysis, not an orphan artifact. (`.gitignore` excludes `outputs/` from the repo root except for this one file — whitelisted via `!outputs/calibration_card.md`.)
- **Cover page image:** none. Markdown, nothing else.
- **Generation:** `python scripts/regenerate_calibration_card.py`. One command. Zero flags for the default analysis.

### 5.2 Structure

Target reading time: **60 seconds**. Target page length: **one printed A4 if rendered**.

```markdown
# Geo-Insight calibration card — {analysis_date}

**What this card claims.** The default composite `gap_score = (1 − min(coverage, 1)) × pin_share`
is stable under reasonable denominator and cohort-floor variations, and does meaningful
ranking work above its components alone. It is not a claim of ground-truth "correctness."

---

## 1. Default configuration
- Analysis year: **2025**
- Denominator: **PIN** (People in Need)
- Cohort floor: **PIN ≥ 1,000,000**
- Active HRP / Flash / Regional required: **yes**
- Cohort size: **{N}** countries

## 2. Sensitivity — denominator × cohort floor

_9 rankings; canonical is `PIN_1M`._

| Definition | Top-10 Jaccard vs default | Median |Δrank| | Max |Δrank| | Countries gained/lost |
|---|---|---|---|---|
| PIN_1M | 1.00 (default) | 0 | 0 | — |
| PIN_500k | … | … | … | +{N} / −0 |
| PIN_2M | … | … | … | 0 / −{N} |
| Targeted_500k | … | … | … | +{N} / −{N} |
| … (8 total non-default rows) |

**Reading.** Top-10 Jaccard ≥ 0.7 under all eight swaps → composite is stable.
The worst Jaccard was {X} on {definition}, driven by {N} countries below the new floor.

## 3. Cohort strictness (auxiliary swap)

_Single-axis: `require_hrp=true` (default) vs `require_hrp=false` (adds `Other` + `Unknown` plan types). Both always exclude `hrp_status='None'` and `requirements_usd=0`._

- Default cohort size: **{N}**. Relaxed cohort size: **{M}**.
- Top-10 Jaccard, default ↔ relaxed: **{J}**
- Countries added by relaxation: **{list}**
- Median |Δrank| on iso3s in both: **{x}**; max: **{y}**

**Reading.** If Jaccard ≥ 0.8 the chip is a minor framing choice. If < 0.6 the chip is load-bearing for the top-10 and the added countries are named above.

## 4. 2024 back-test

_Comparing `analysis_year=2024` to `analysis_year=2025`. Cohort membership can change between years because the amended cohort filter (pipeline spec §4.1) always excludes `hrp_status='None'` and `requirements_usd=0`._

| Class | Count | Share |
|---|---|---|
| cohort_entry (new in 2025) | {N} | {pct} |
| cohort_exit (dropped in 2025) | {N} | {pct} |
| data_grounded | {N} | {pct} |
| methodology_sensitive | {N} | {pct} |
| noise | {N} | {pct} |

**Largest movers (top 5 by |Δrank|, among iso3s ranked in both years):**

| Country | Rank 2024 | Rank 2025 | Δ | Class | Rationale |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

**Cohort transitions (sample of up to 5 each way):**

| Country | 2024 → 2025 | Specific reason |
|---|---|---|
| … (entry) | excluded → ranked | e.g. "requirements_usd went 0 → $120M" |
| … (exit)  | ranked → excluded | e.g. "hrp_status HRP → None" |

## 5. Component-vs-composite disagreement

_Cases where the composite departs from its loudest component._

| Country | rank_gap | rank_unmet | rank_pinshare | rank_coverage_gap | What the composite is doing |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

## 6. Known limitations
- **Severity not modeled in MVP.** No severity column in the provided HNO Parquet files.
  Scatter B uses an absolute-vs-proportional burden frame instead: X = `log10(pin)`,
  Y = `pin_share`, bubble = `unmet_need_usd`. Severity wiring is post-MVP.
- **Cohort always excludes countries with no appeal of record.** `hrp_status='None'`
  and `requirements_usd=0` rows are never in-cohort — the ranking can't say anything
  about them. This is an analytical boundary, not a claim that those countries are
  well-resourced or not overlooked. Excluded countries appear in the Data coverage
  panel with their exclusion reason.
- **`cluster_taxonomy_mismatch` is a QA flag, not an exclusion reason.** When a
  country's cluster-level request doesn't resolve in the harmonized `globalCluster`
  taxonomy, the row stays in-cohort and carries the flag; the cluster drill-down
  shows the raw-taxonomy fallback in its header.
- **Donor concentration is 2026-only.** HHI cannot be back-computed pre-2026 from the
  provided transaction file.
- **2026 HNO is preliminary.** National-only. Subnational views are disabled when 2026
  is selected.
- **FTS is self-reported.** Funding figures are eventually-consistent and retroactively revised.

## 7. What the composite does NOT claim
- That a country ranked #1 is objectively "most overlooked" in any external-validation sense.
- That a country **excluded** from the cohort is "not overlooked" — a country with no
  appeal of record often is overlooked in a stronger sense than one the ranking captures.
  The ranking is a lens over countries with documented need AND a declared plan.
- That coordinator weights in the Advanced panel reproduce the default ranking
  (they can't — linear vs multiplicative).
- That ranking changes between runs are errors — `data_freshness` shifts with FTS revisions.

## 8. Reproducibility
- Regenerate: `python scripts/regenerate_calibration_card.py`
- Data snapshots: {parquet_mtimes_table}
- Pipeline version: {git_sha}
- This card is linked from the app's Footer via `<Footer calibrationCardHref={...} />`
  (see `spec-frontend.md` §4.11).
```

### 5.3 Template implementation

Jinja2 template at `pipeline/evaluation/templates/calibration_card.md.jinja`. Template variables supplied by `report.py`:

```python
def generate_calibration_card(out_path: str = "outputs/calibration_card.md") -> None:
    """
    Runs sensitivity_sweep + cohort_strictness_swap + backtest_2024 + disagreement_cases,
    renders templates/calibration_card.md.jinja, writes to out_path.
    Deterministic given the same input Parquet files.
    """
```

All numbers in the card trace to a specific function's output — no prose-level numbers inserted outside the template variables.

---

## 6. Reproducibility guarantees

- Running `scripts/regenerate_calibration_card.py` twice on the same Parquet snapshot produces byte-identical output (modulo the `{analysis_date}` timestamp which is fixed to the latest Parquet `mtime`, not `now()`).
- Every figure in the card has a test that asserts it matches the underlying computation. If a future pipeline change flips a number, the test fails — no silent regression.

---

## 7. Tests

### 7.1 `test_sensitivity.py`

- `sensitivity_sweep(2025)` returns a frame with 9 definitions × cohort-size rows.
- Jaccard helper: hand-computed on a 3-country toy example.
- Swap to an absurd cohort floor (e.g., 500M) returns an empty sweep slot → handled, not crashed.
- `cohort_strictness_swap(2025)` returns a dict matching the §2.5 schema: `default`, `relaxed`, `jaccard_top10`, `countries_added_by_relaxation`, `rank_delta_median`, `rank_delta_max`.
- `cohort_strictness_swap`: relaxed cohort is a superset of default; Jaccard in `[0, 1]`; `countries_added_by_relaxation` is disjoint from default top-10 plus a subset of relaxed cohort.

### 7.2 `test_backtest.py`

- `backtest_2024()` returns a frame with one row per iso3 present in either year.
- Rationale classifier: each branch of the decision tree hit by at least one synthetic input — **including both cohort-transition branches** (`cohort_entry`, `cohort_exit`).
- Countries present in 2024 only, 2025 only, both — all three cases covered, with the correct class assignment per case:
  - 2025 only + was excluded in 2024 → `cohort_entry` with a specific reason matching one of `membership_change_reason_appeared`'s branches.
  - 2024 only + excluded in 2025 → `cohort_exit` with a specific reason from `_dropped`.
  - Both years → one of `data_grounded`, `methodology_sensitive`, `noise`.
- `membership_change_reason_appeared` / `_dropped`: each branch (requirements 0 → positive, `hrp_status` None → named, PIN crossed floor, generic) hit by synthetic input.

### 7.3 `test_disagreement.py`

- `disagreement_cases()` returns exactly 5 rows.
- Top row has the largest `disagreement_score`.
- Rows are sorted by score desc.
- All interpretation templates have at least one test input that picks them.

### 7.4 `test_report.py`

- `generate_calibration_card()` writes a file at the expected path.
- The output file contains all section headings from the template.
- The output file contains no `{{` or `}}` — asserts all template variables were filled.
- Byte-identical across two runs on the same input data.

---

## 8. What runs when

| Trigger | Action |
|---|---|
| On commit to `main` (CI) | Regenerate the card; fail CI if it doesn't parse as valid Markdown |
| On pipeline spec change | Regenerate the card manually and commit the output alongside the code change |
| On Parquet snapshot refresh | Regenerate and commit |
| During hackathon demo | Card is a judge-facing artifact in `outputs/`, linked from the `<Footer />` component's `[Calibration card]` link (`spec-frontend.md` §4.11); `calibrationCardHref` prop carries the URL |

---

## 9. Definition of done (evaluation)

- [ ] `sensitivity_sweep(2025)` produces 9-definition results; sensitivity summary table matches the §5.2 card format
- [ ] `cohort_strictness_swap(2025)` returns the §2.5 schema; default and relaxed cohort sizes + Jaccard + added-countries list populate the card's §3
- [ ] `backtest_2024()` classifies every mover into the full 5-class enum `{cohort_entry, cohort_exit, data_grounded, methodology_sensitive, noise}`
- [ ] `membership_change_reason_appeared` and `_dropped` produce a specific, single-sentence reason for every cohort transition in the test fixtures
- [ ] `disagreement_cases()` surfaces 5 cases with interpretation text
- [ ] `generate_calibration_card()` writes a Markdown file with **all eight** section headings (Default config, Sensitivity, Cohort strictness, 2024 back-test, Component-vs-composite disagreement, Known limitations, What the composite does NOT claim, Reproducibility) populated
- [ ] Card regenerates byte-identically on the same input
- [ ] Card renders correctly on GitHub (inspected visually)
- [ ] Card's "Known limitations" section explicitly names the cohort-filter boundary and the `cluster_taxonomy_mismatch` QA-flag semantics per §5.2
- [ ] Card's "What this card does NOT claim" section contains the "excluded ≠ not overlooked" bullet verbatim
- [ ] Card is reached via `<Footer />`'s `[Calibration card]` link (spec-frontend.md §4.11) — the `calibrationCardHref` prop points to the committed `outputs/calibration_card.md`
- [ ] All evaluation unit tests pass

---

*End of evaluation spec. Depends on Pydantic schemas in `spec-data-pipeline.md` §8 and the evaluation requirements in `spec.md` §8. No application code is written until the full spec set is approved.*
