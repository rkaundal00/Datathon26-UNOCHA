# Geo-Insight calibration card — 2026-04-18

**What this card claims.** The default composite `gap_score = (1 − min(coverage, 1)) × (0.5 × pin_share + 0.5 × norm_log10(pin))`
is stable under reasonable denominator and cohort-floor variations, and does meaningful
ranking work above its components alone. It is not a claim of ground-truth "correctness."

---

## 1. Default configuration

- Analysis year: **2025**
- Denominator: **PIN** (People in Need)
- Cohort floor: **PIN ≥ 1,000,000**
- Active HRP / Flash / Regional required: **yes**
- Cohort size: **18** countries

## 2. Sensitivity — denominator × cohort floor

_9 rankings; canonical is `PIN_1M`._

| Definition | Top-10 Jaccard vs default | Median \|Δrank\| | Max \|Δrank\| | Countries gained/lost |
|---|---|---|---|---|
| Affected_1M | 0.08 | 10 | 14 | +0 / −15 |
| Affected_2M | 0.08 | 10 | 14 | +0 / −15 |
| Affected_500k | 0.08 | 10 | 14 | +0 / −15 |
| PIN_1M | 1.00 (default) | 0 | 0 | +0 / −0 |
| PIN_2M | 1.00 | 0 | 2 | +0 / −2 |
| PIN_500k | 1.00 | 0 | 1 | +1 / −0 |
| Targeted_1M | 0.82 | 1 | 4 | +0 / −1 |
| Targeted_2M | 0.82 | 1 | 4 | +0 / −4 |
| Targeted_500k | 0.82 | 1 | 4 | +0 / −0 |


**Reading.** Top-10 Jaccard ≥ 0.7 under all eight swaps → composite is stable. The worst
non-default Jaccard is **0.08** on **Affected_1M**,
driven by 15 countries dropped and 0 added.

## 3. Cohort strictness (auxiliary swap)

_Single-axis: `require_hrp=true` (default) vs `require_hrp=false` (adds `Other` + `Unknown`
plan types). Both always exclude `hrp_status='None'` and `requirements_usd=0`._

- Default cohort size: **18**. Relaxed cohort size: **18**.
- Top-10 Jaccard, default ↔ relaxed: **1.00**
- Countries added by relaxation: *(none)*
- Median \|Δrank\| on iso3s in both: **0**; max: **0**

**Reading.** If Jaccard ≥ 0.8 the chip is a minor framing choice. If < 0.6 the chip is
load-bearing for the top-10 and the added countries are named above.

## 4. 2024 back-test

_Comparing `analysis_year=2024` to `analysis_year=2025`. Cohort membership can change
between years because the amended cohort filter always excludes `hrp_status='None'` and
`requirements_usd=0`._

| Class | Count | Share |
|---|---|---|
| cohort_entry | 3 | 16% |
| cohort_exit | 1 | 5% |
| data_grounded | 12 | 63% |
| methodology_sensitive | 3 | 16% |


**Largest movers (top 5 by |Δrank|, among iso3s ranked in both years):**

| Country | Rank 2024 | Rank 2025 | Δ | Class | Rationale |
|---|---|---|---|---|---|
| Ethiopia | 2 | 18 | 16 | data_grounded | Coverage shifted from 34% to 179% |
| Sudan | 9 | 1 | -8 | data_grounded | PIN rose 23% |
| Chad | 16 | 9 | -7 | data_grounded | PIN rose 17% |
| Guatemala | 11 | 16 | 5 | data_grounded | PIN fell 59% |
| South Sudan | 10 | 5 | -5 | data_grounded | Coverage shifted from 79% to 54% |


**Cohort transitions (sample of up to 5 each way):**

| Country | 2024 → 2025 | Specific reason |
|---|---|---|
| Cameroon | excluded → ranked | Appeared in 2025 cohort: appeared in 2025 ranking (no prior excluded record) |
| Colombia | excluded → ranked | Appeared in 2025 cohort: appeared in 2025 ranking (no prior excluded record) |
| Mozambique | excluded → ranked | Appeared in 2025 cohort: appeared in 2025 ranking (no prior excluded record) |
| El Salvador | ranked → excluded | Dropped from 2025 cohort: dropped from 2025 ranking |


## 5. Component-vs-composite disagreement

_Cases where the composite departs from its loudest component._

| Country | rank_gap | rank_unmet | rank_pinshare | rank_coverage_gap | What the composite is doing |
|---|---|---|---|---|---|
| Haiti | 3 | 7 | 4 | 8 | Haiti ranks higher on the composite than on either absolute unmet need or proportional burden alone — the composite is combining moderate signals across both axes. |
| Niger | 15 | 14 | 16 | 12 | Niger ranks above its position on proportional burden alone — the coverage gap is doing the lifting. |
| Sudan | 1 | 1 | 2 | 13 | Sudan ranks above its position on proportional burden alone — the coverage gap is doing the lifting. |
| Guatemala | 16 | 17 | 14 | 15 | Guatemala ranks above its position on absolute unmet need — the composite is weighted toward proportional burden (pin_share) here. |
| Afghanistan | 2 | 3 | 3 | 16 | Afghanistan ranks higher on the composite than on either absolute unmet need or proportional burden alone — the composite is combining moderate signals across both axes. |


## 6. Known limitations

- **Severity not modeled in MVP.** No severity column in the provided HNO Parquet files.
  Scatter B uses an absolute-vs-proportional burden frame instead: X = `log10(pin)`,
  Y = `pin_share`, bubble = `unmet_need_usd`. Severity wiring is post-MVP.
- **Cohort always excludes countries with no appeal of record.** `hrp_status='None'` and
  `requirements_usd=0` rows are never in-cohort — the ranking can't say anything about
  them. This is an analytical boundary, not a claim that those countries are
  well-resourced or not overlooked. Excluded countries appear in the Data coverage panel
  with their exclusion reason.
- **`cluster_taxonomy_mismatch` is a QA flag, not an exclusion reason.** When a country's
  cluster-level request doesn't resolve in the harmonized `globalCluster` taxonomy, the
  row stays in-cohort and carries the flag; the cluster drill-down shows the raw-taxonomy
  fallback in its header.
- **Donor concentration is 2026-only.** HHI cannot be back-computed pre-2026 from the
  provided transaction file.
- **2026 HNO is preliminary.** National-only. Subnational views are disabled when 2026 is
  selected.
- **FTS is self-reported.** Funding figures are eventually-consistent and retroactively
  revised.

## 7. What the composite does NOT claim

- That a country ranked #1 is objectively "most overlooked" in any external-validation
  sense.
- That a country **excluded** from the cohort is "not overlooked" — a country with no
  appeal of record often is overlooked in a stronger sense than one the ranking captures.
  The ranking is a lens over countries with documented need AND a declared plan.
- That coordinator weights in the Advanced panel reproduce the default ranking (they
  can't — linear vs multiplicative).
- That ranking changes between runs are errors — `data_freshness` shifts with FTS
  revisions.

## 8. Watch list (data-too-sparse rows)

_Countries with an FTS appeal but missing the HNO PIN or COD-PS population
needed for the upstream `(0.5 × pin_share + 0.5 × norm_log10(pin))` need axis.
Surfaced separately from the ranked table so the gap_score column stays
apples-to-apples — assigning these rows a fabricated gap_score (e.g. on a
severity proxy) would mix incomparable scores in the same column and mislead a
coordinator sorting by it._

Watch-list size: **34** rows for analysis year 2025.
Sorted by INFORM Severity desc in the API and the data-coverage modal.

| QA flag | What's missing | Evidence shown in the watch list | Count | Examples |
|---|---|---|---|---|
| `fts_year_fallback` | Analysis-year FTS requirements = 0; prior-year requirements, funding, and `hrp_status` substitute. | Requirements, funding, coverage, unmet (from the prior year). | 2 | IRQ, MDG |
| `population_unavailable` | COD-PS has no row for this ISO3 (or no reference year ≤ analysis year). PIN survives. | INFORM Severity, requirements, funding, coverage, unmet. `pin_share` cannot be computed. | 5 | YEM, UKR, SYR, MMR, CAF |
| `need_proxy_inform` | HNO PIN is unavailable for both analysis year and prior year. | INFORM Severity, requirements, funding, coverage, unmet. | 34 | YEM, UKR, SYR, MMR, PSE, PAK |

**Reading.** Rows on the watch list are deliberately **not** scored — there is no
`gap_score` field on the watch-list response. A coordinator reads them on their
own evidence (severity, requirements, coverage, unmet) and the QA flag chip
identifies which data is missing. Rows that fail the strict filter AND every
rescue rule remain in the **Excluded** bucket with their `exclusion_reason`. The
ranked table contains only strict-cohort rows; every score in that column is
computed by the same upstream blend.

## 9. Reproducibility

- Regenerate: `python scripts/regenerate_calibration_card.py`
- Data freshness (max Parquet mtime): **2026-04-18T13:47:10.586485+00:00**
- This card is linked from the app's Footer via `<Footer calibrationCardHref={...} />`
  (see `spec-frontend.md` §4.11).