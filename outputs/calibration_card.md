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
| cohort_exit | 1 | 2% |
| data_grounded | 40 | 75% |
| methodology_sensitive | 7 | 13% |
| noise | 5 | 9% |


**Largest movers (top 5 by |Δrank|, among iso3s ranked in both years):**

| Country | Rank 2024 | Rank 2025 | Δ | Class | Rationale |
|---|---|---|---|---|---|
| Pakistan | 52 | 11 | -41 | data_grounded | Coverage shifted from 110% to 44% |
| Costa Rica | 53 | 18 | -35 | data_grounded | Coverage shifted from 187% to 6% |
| Libya | 44 | 9 | -35 | data_grounded | Coverage shifted from 106% to 32% |
| Syria | 4 | 39 | 35 | data_grounded | Coverage shifted from 49% to 85% |
| Yemen | 51 | 17 | -34 | data_grounded | Coverage shifted from 102% to 56% |


**Cohort transitions (sample of up to 5 each way):**

| Country | 2024 → 2025 | Specific reason |
|---|---|---|
| El Salvador | ranked → excluded | Dropped from 2025 cohort: dropped from 2025 ranking |


## 5. Component-vs-composite disagreement

_Cases where the composite departs from its loudest component._

| Country | rank_gap | rank_unmet | rank_pinshare | rank_coverage_gap | What the composite is doing |
|---|---|---|---|---|---|
| Myanmar | 6 | 7 | 3 | 24 | Myanmar ranks above its position on absolute unmet need — the composite is weighted toward proportional burden (pin_share) here. |
| Rwanda | 21 | 39 | 22 | 25 | Rwanda ranks higher on the composite than on either absolute unmet need or proportional burden alone — the composite is combining moderate signals across both axes. |
| Uganda | 10 | 12 | 6 | 8 | Uganda ranks above its position on absolute unmet need — the composite is weighted toward proportional burden (pin_share) here. |
| Peru | 7 | 24 | 10 | 6 | Peru ranks higher on the composite than on either absolute unmet need or proportional burden alone — the composite is combining moderate signals across both axes. |
| Burundi | 16 | 35 | 19 | 29 | Burundi ranks higher on the composite than on either absolute unmet need or proportional burden alone — the composite is combining moderate signals across both axes. |


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

## 8. Fallback scoring (rescued rows)

_Rows that fail the strict cohort filter but are included via a sanctioned
fallback rule. Every rescued row carries the corresponding QA flag so the rescue
is auditable per-row in the API and the data-coverage modal._

Total rescued: **34** rows for analysis year 2025.

| QA flag | What it means | Math (composite branch) | Count | Examples |
|---|---|---|---|---|
| `fts_year_fallback` | Analysis-year FTS requirements = 0 and prior year > 0; prior-year requirements, funding, and `hrp_status` substitute. | unchanged blended formula: `(1 − min(coverage, 1)) × (0.5 × pin_share + 0.5 × norm_log10(pin))` — uses prior-year FTS. | 2 | MDG, IRQ |
| `population_unavailable` | COD-PS has no row for this ISO3 (or no reference year ≤ analysis year). The population gate is dropped. PIN survives. | `(1 − min(coverage, 1)) × (severity_inform / 10)` — `pin_share` is undefined without a population denominator. Per-capita derivations are not valid for this row. | 5 | MMR, CAF, YEM, UKR, SYR |
| `need_proxy_inform` | HNO PIN is unavailable for both analysis year and prior year (or co-occurs with `population_unavailable`). | `(1 − min(coverage, 1)) × (severity_inform / 10)` — `severity_inform` is the March 2026 INFORM Severity Index, country-level (1–10 → 0–1). | 34 | IRN, TUR, LBN, ECU, ZWE, MMR |

**Reading.** A rescued row is in-cohort and ranked alongside strict-cohort rows.
The QA flag chip identifies the rescue rule(s) applied. Rows that fail BOTH the
strict filter AND every rescue rule remain in the **Excluded** bucket and surface
in the data-coverage modal with their `exclusion_reason` enum value. The custom
linear composite uses the same need-axis substitution when `pin_share` is null.

## 9. Reproducibility

- Regenerate: `python scripts/regenerate_calibration_card.py`
- Data freshness (max Parquet mtime): **2026-04-18T13:47:10.586485+00:00**
- This card is linked from the app's Footer via `<Footer calibrationCardHref={...} />`
  (see `spec-frontend.md` §4.11).