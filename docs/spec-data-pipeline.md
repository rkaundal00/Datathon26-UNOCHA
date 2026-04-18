# Geo-Insight: Data Pipeline Specification

Supplementary spec. Implements the backend half of `spec.md` (base requirements): DuckDB/Polars loaders, a unified country-year table, analytical columns as executable expressions, FastAPI endpoint contracts, and Pydantic schemas. Pydantic schemas at the end of this document are the **frozen interface contract** — the frontend and evaluation specs depend on them. Any later change to a schema requires re-review of every downstream spec.

Reads in order alongside `spec.md`. Where this spec resolves a load-bearing question, the resolution cites the base-spec section it amends.

---

## 0. Reconciliation with base spec (load-bearing resolutions)

Discovered during dataset audit. Each resolution is a formal amendment to `spec.md`.

### 0.1 `OPEN_QUESTION_SEVERITY_SOURCE` — **resolved: severity is post-MVP; Scatter B re-axed**

**Finding.** No `severity` or severity-phase column exists in any `hpc_hno_{2024,2025,2026}.parquet`. Only `Population`, `In Need`, `Targeted`, `Affected`, `Reached`. The base spec's `severity_score_weighted` (§5) cannot be computed from provided data.

**Resolution for MVP.**

- `severity_score_weighted` and `severity_norm` are **removed from the MVP's analytical columns and `custom_gap_score` default weights.**
- Scatter B's axes are re-cast using dataset primitives alone. **X = `log10(pin)` (absolute burden), Y = `pin_share` (proportional burden), bubble = `unmet_need_usd`.** No toggle — a single axes pair. The humanitarian-situation lens is preserved: top-right = large AND proportionally severe (Sudan / Yemen class); top-left = small but proportionally crushed; bottom-right = large with moderate proportional burden; bottom-left = small and moderate.
- **Rejected alternative.** An earlier draft proposed `need_intensity = In Need / Population` as the Y-axis. That is arithmetically equal to `pin_share`, so Scatter B collapsed to `y = x`. Any future Y-axis must be independent of `pin_share`.
- The custom composite loses its `w_severity` slider. Remaining sliders (`w_coverage`, `w_pin`, `w_chronic`) normalize to Σ=1.
- The `severity` concept is dropped from the MVP country-year table entirely. Any downstream surface that needs severity must feature-flag off it via the `severity_unavailable` QA flag, which is attached to every row in the MVP.
- **Post-MVP:** if severity data is located (HPC Tools API, separate HDX resource, or UNOCHA export), wire it in as a pure additive column + restore the slider. Scatter B axes stay as redefined here; severity would become Scatter C.

**This resolution amends:** `spec.md` §5 (remove `severity_score_weighted` formula from MVP scope), §6 columns table (drop `severity` from MVP; no replacement column — Scatter B reads `pin` and `pin_share` directly), §6 Scatter B (X = `log10(pin)`, Y = `pin_share`, bubble = `unmet_need_usd`), §6 custom weights panel (three sliders, not four), §10(f) (Scatter B DoD rewritten; see frontend spec §12).

### 0.2 PIN naming

HNO's numeric "People in Need" column is literally named **`In Need`** (with a space). All loaders rename it to `pin` (snake_case int) at the ingest boundary. Elsewhere in the pipeline and API, `pin` is canonical.

### 0.3 COD-PS coverage ends at 2025

`cod_population_admin0.parquet` `Reference_year` max is **2025**. `pin_share` denominator for `analysis_year=2026` uses the 2025 reference year. The `population_stale` flag fires when **`analysis_year − Reference_year > 2`**; for 2026, gap is 1 and the flag does not fire.

### 0.4 HNO 2024/2025 numeric columns are stored as strings

All `Population`, `In Need`, `Targeted`, `Affected`, `Reached` columns in HNO 2024 and 2025 are `large_string`. The HNO 2024/2025 loaders cast these via `polars.Utf8 → Int64` after stripping commas (if any) and dropping the first metadata/tag row. HNO 2026 stores them as numeric already.

### 0.5 FTS `typeName` is sparse (~32% populated)

`hrp_status` derivation, in order:

1. If FTS aggregate row has non-null `typeName`: map `{"Humanitarian response plan", "Humanitarian needs and response plan", "Strategic response plan", "Consolidated appeals process", "Consolidated inter-agency appeal"} → HRP`; `Flash appeal → FlashAppeal`; `Regional response plan → RegionalRP`; else `Other`.
2. Otherwise, if `requirements > 0` for the appeal × year: `Unknown` (still potentially in-cohort).
3. Otherwise (no appeal record): `None`.

Cohort filter interacts with the `require_hrp` chip (see §4.1 step 5 for the final expression):

- `require_hrp=true` (default) → include `{HRP, FlashAppeal, RegionalRP}` only.
- `require_hrp=false` → include `{HRP, FlashAppeal, RegionalRP, Other, Unknown}`.

`hrp_status='None'` is **always** excluded, regardless of the chip value; the chip toggles strictness-of-plan-type, not presence-of-plan. `Unknown` inclusion (when the chip is off) is documented in the scope-banner tooltip as *"Plans without a declared type are included as appeals-of-record. Countries with no appeal record at all are never included — see the [review] panel."*

### 0.6 CBPF timeline keyed by country name, not ISO3

Out of MVP scope for chronic-year computation — chronic-year uses FTS aggregate coverage ratios (§5 in base spec). CBPF timeline is **read-only validation context** in the briefing-note fact sheet ("pooled-fund allocations for this country, historical") and is country-name→ISO3-mapped via a small lookup table at load time. Mapping table committed at `pipeline/ingest/cbpf_country_map.csv`; mismatches log a warning and exclude the row.

### 0.7 Donor concentration granularity

FTS incoming 2026 `srcOrganization` is the donor key for HHI. Rows with `contributionType != "financial"` are excluded (in-kind contributions don't translate cleanly to donor share). Rows with `status in {"pledge", "commitment"}` and no `"paid"` counterpart are included — HHI captures *who is committing*, not *who has paid*.

**Display label requirement.** Because the metric mixes pledges, commitments, and paid contributions, every display surface that renders `donor_concentration` must label the metric as **"Top donors by commitment (HHI)"** — never "Top donors" alone. Subtitle, where space allows: *"HHI over all pledged, committed, and paid contributions — 2026 only."* This keeps the semantics legible to a judge who might cross-reference the briefing-note prose against the dataset.

---

## 1. Layout

```
pipeline/
├── __init__.py
├── config.py                # paths, constants (PIN floor, analysis year default, etc.)
├── ingest/
│   ├── __init__.py
│   ├── cod_ps.py            # load_admin0() → DataFrame(ISO3, population, reference_year)
│   ├── hno.py               # load_hno(year) → DataFrame(iso3, cluster, category, pin, targeted, affected, reached, population, admin1_pcode?, admin2_pcode?, admin3_pcode?)
│   ├── fts.py               # load_appeals(), load_cluster(), load_globalcluster(), load_incoming_2026()
│   ├── cbpf.py              # load_allocations_timeline() + name→ISO3 mapping
│   └── cbpf_country_map.csv # CBPF country-name → ISO3 lookup (~20 rows)
├── transform/
│   ├── __init__.py
│   ├── cohort.py            # build_cohort(analysis_year, pin_floor, require_hrp) → DataFrame
│   ├── country_year.py      # build_country_year_table(analysis_year) → DataFrame — the canonical table
│   ├── clusters.py          # cluster_drilldown_per_country(), cluster_drilldown_aggregate()
│   ├── trend.py             # trend_series(iso3) → two-curve + 2026 pledged/paid inset
│   └── qa.py                # apply_qa_flags(df) — uniform flag assembly
├── compute/
│   ├── __init__.py
│   ├── composites.py        # gap_score(), custom_gap_score(weights)
│   ├── chronic.py           # chronic_years(iso3, analysis_year, history_df)
│   ├── donor_hhi.py         # donor_concentration(iso3, year, incoming_df)
│   └── sensitivity.py       # used by evaluation spec; lives here since formulas live here
├── api/
│   ├── __init__.py
│   ├── main.py              # FastAPI app; mounts routers
│   ├── routes_ranking.py    # GET /api/ranking
│   ├── routes_country.py    # GET /api/country/{iso3}
│   ├── routes_clusters.py   # GET /api/clusters (cohort-wide), GET /api/country/{iso3}/clusters
│   ├── routes_coverage.py   # GET /api/coverage (data-coverage panel)
│   ├── routes_export.py     # GET /api/export.csv
│   └── schemas.py           # Pydantic models — frozen interface (§8)
└── tests/
    ├── fixtures/
    │   ├── sudan.json       # expected outputs for SDN
    │   ├── chad.json        # expected outputs for TCD
    │   └── yemen.json       # expected outputs for YEM
    ├── test_ingest.py
    ├── test_country_year.py
    ├── test_composites.py
    ├── test_chronic.py
    ├── test_qa.py
    └── test_api.py
processed/                   # DuckDB cache + intermediate Parquet (gitignored)
outputs/                     # calibration card output dir (gitignored; see spec-evaluation.md)
```

One module per table/concept. Everything importable from `pipeline` without side effects on import — I/O happens only in functions.

---

## 2. Engine choice per operation

| Operation | Engine | Rationale |
|---|---|---|
| Read Parquet; filter + aggregate appeal × year | DuckDB | SQL over Parquet, no ETL, preserves string dtypes. |
| Join country-year, cohort filter | DuckDB | Set-based; DuckDB handles it better than row loops. |
| Row-wise QA flag assembly | Polars | Imperative Python is clearer than SQL CASE ladders. |
| Herfindahl computation | Polars | Group-by + sum-of-squares; trivial in Polars. |
| Trend post-processing (year fill, marker flags) | Polars | Interval logic against a known year range. |
| HNO row-overlap handling (total vs breakdown) | Polars (with explicit group-by) | The base spec mandates "no blind SUM" — explicit code is safer than SQL. |

No pandas — polars + duckdb cover everything and avoid the dtype-drift footgun on P-codes.

---

## 3. Ingest

Each loader returns a Polars `DataFrame` with canonical snake_case columns and correct dtypes. Raw data is never mutated.

### 3.1 `ingest/cod_ps.py`

```python
def load_admin0() -> pl.DataFrame:
    """
    Returns columns:
        iso3: str
        population: Int64
        reference_year: Int64

    Filter to Population_group == 'T_TL' (total, all ages, all genders).
    Keep one row per (iso3, reference_year).
    """
```

For each `iso3` in the returned frame, the pipeline later picks the **nearest `reference_year ≤ analysis_year`** (if ≤ 2 years old → fresh; > 2 years → `population_stale=True`). If no row exists with `reference_year ≤ analysis_year` at all, the country is excluded with reason `no_population_baseline`.

### 3.2 `ingest/hno.py`

```python
def load_hno(year: Literal[2024, 2025, 2026]) -> pl.DataFrame:
    """
    Returns columns (union across years; columns absent in a year are null):
        iso3: str
        admin1_pcode: str | None
        admin2_pcode: str | None
        admin3_pcode: str | None
        cluster: str               # e.g. 'ALL', 'EDU', 'FSC' — raw value
        category: str | None       # demographic breakdown; None = 'total row' for that cluster
        pin: Int64                 # renamed from 'In Need', cast from str to int for 2024/2025
        targeted: Int64
        affected: Int64
        reached: Int64 | None
        population: Int64 | None

    Per-year handling:
      - 2024: no P-codes (admin*_pcode all null). Drop first row (metadata tag row).
              Cast numeric string columns (strip commas, Int64).
      - 2025: P-codes present. Drop first metadata row. Same cast.
      - 2026: preliminary, national only (no P-codes even though file has 135 rows).
              Numeric columns already typed. No header row to drop.
    """
```

**Country-level PIN** for the ranking is the row where `cluster == 'ALL'` AND `category IS NULL`. This is the single source of truth for the `pin` field in the country-year table — no SUM over disaggregation rows.

**Cluster-level PIN** (for the drilldown) is the row where `cluster != 'ALL'` AND `category IS NULL`, one row per (iso3, cluster). SUM is applied across admin rows within a cluster only when admin-level rows exist (2025 only).

### 3.3 `ingest/fts.py`

```python
def load_appeals() -> pl.DataFrame:
    """
    fts_requirements_funding_global.parquet → columns:
        iso3: str              # renamed from countryCode
        plan_code: str         # renamed from code
        plan_name: str         # renamed from name
        plan_type_raw: str | None   # renamed from typeName
        year: Int64
        requirements_usd: Float64
        funding_usd: Float64
        percent_funded_reported: Float64
    """

def load_cluster(harmonized: bool = True) -> pl.DataFrame:
    """
    fts_requirements_funding_globalcluster_global.parquet if harmonized else
    fts_requirements_funding_cluster_global.parquet.
    Columns as above plus:
        cluster_code: str
        cluster_name: str
    The pipeline prefers harmonized=True (globalCluster taxonomy). If a requested
    (iso3, year, cluster_name) is missing in harmonized, fall back to the raw
    cluster file and set qa_flag = cluster_taxonomy_mismatch.
    """

def load_incoming_2026() -> pl.DataFrame:
    """
    fts_incoming_funding_global.parquet → columns (subset):
        dest_plan_code: str | None
        dest_locations_raw: str | None     # ISO3 codes, comma-separated
        src_organization: str              # donor
        contribution_type: str             # 'financial' | 'in kind'
        status: str                        # 'pledge' | 'paid' | 'commitment'
        amount_usd: Int64
        flow_type: str                     # 'Carryover' | 'Parked' | 'Pass through' | 'Standard'

    Filter out contribution_type != 'financial'.
    Expand dest_locations_raw by comma → one row per (iso3, donor, status, amount_usd).
    """
```

### 3.4 `ingest/cbpf.py` — read-only validation context only

Keyed on country name; mapped to ISO3 via `cbpf_country_map.csv`. Used in briefing-note fact sheet for the "historical CBPF allocations" line. Not a ranking input.

---

## 4. Transform: the canonical country-year table

The single table that the entire ranking surface reads from.

### 4.1 `transform/country_year.py`

```python
def build_country_year_table(
    analysis_year: int = 2025,
    pin_floor: int = 1_000_000,
    require_hrp: bool = True,
) -> pl.DataFrame:
    """
    Returns one row per in-cohort country with columns:
        iso3: str
        country: str
        analysis_year: int
        pin: Int64                        # from HNO[analysis_year], cluster='ALL', category NULL
        population: Int64                 # from COD-PS admin0, nearest ref year ≤ analysis_year
        population_reference_year: int
        pin_share: Float64                # pin / population
        requirements_usd: Int64           # from FTS appeals aggregate (sum over all plans for iso3 × year)
        funding_usd: Int64                # idem
        coverage_ratio: Float64           # funding_usd / requirements_usd (uncapped; requirements=0 rows are not in cohort — see step 5)
        unmet_need_usd: Int64             # max(0, requirements - funding)
        gap_score: Float64                # (1 - min(coverage, 1)) * pin_share
        chronic_years: Int8               # 0-5; see compute/chronic.py
        donor_concentration: Float64      # HHI; see compute/donor_hhi.py; null if analysis_year != 2026
        hrp_status: str                   # 'HRP' | 'FlashAppeal' | 'RegionalRP' | 'Other' | 'Unknown' | 'None'
        hno_year: int                     # analysis_year if HNO has data; else nearest prior year
        qa_flags: list[str]
    """
```

Build order inside the function (each step uses only the tables named):

1. Load HNO[analysis_year]; fall back to HNO[analysis_year-1] per country if the analysis year HNO has no country-level row for that country (flag `hno_stale`).
2. Load COD-PS admin0 → resolve `population` + `population_reference_year` + `population_stale` per iso3.
3. Load FTS appeals aggregate → sum `requirements_usd`, `funding_usd` per (iso3, analysis_year).
4. Derive `hrp_status` per §0.5.
5. Apply cohort filter:
   ```
   pin >= pin_floor
     AND hrp_status != 'None'
     AND requirements_usd > 0
     AND (
           require_hrp
             ? hrp_status in {HRP, FlashAppeal, RegionalRP}
             : hrp_status in {HRP, FlashAppeal, RegionalRP, Other, Unknown}
         )
   ```
   Rationale: zero-requirements rows would make `coverage_ratio` undefined and `gap_score` degenerate to `pin_share`, which inverts the intended signal. Excluded here rather than handled as `Optional` fields — keeps the Pydantic contract (§8) non-Optional for `coverage_ratio`, `gap_score`, and `unmet_need_usd`.
6. Compute `pin_share`, `coverage_ratio`, `unmet_need_usd`, `gap_score`.
7. Compute `chronic_years` (reads full FTS history; §6).
8. Compute `donor_concentration` (only when analysis_year == 2026; §6).
9. Assemble `qa_flags` (see §7).
10. Return, sorted by `gap_score DESC`.

Excluded countries (those failing the cohort filter) are returned by a sibling function `build_excluded_table(analysis_year, pin_floor, require_hrp)` with `exclusion_reason in {no_active_hrp, stale_hno, no_fts_appeal_record, no_population_baseline}`. Mapping from filter-failure to reason:

| Failure cause | `exclusion_reason` |
|---|---|
| `pin < pin_floor` | _(not listed — below floor, not excluded from data; frontend filters in the table)_ |
| `hrp_status == 'None'` | `no_fts_appeal_record` |
| `requirements_usd == 0` (with `hrp_status` in a permitted type) | `no_fts_appeal_record` |
| `hrp_status in {Other, Unknown}` when `require_hrp=true` | `no_active_hrp` |
| Nearest COD-PS reference year missing | `no_population_baseline` |
| HNO row missing in both `analysis_year` and `analysis_year-1` | `stale_hno` |

### 4.2 `transform/clusters.py`

```python
def cluster_drilldown_per_country(iso3: str, analysis_year: int) -> pl.DataFrame:
    """
    Columns:
        cluster_name: str      # globalCluster (harmonized)
        pin_cluster: Int64     # from HNO[analysis_year], one row per cluster (cluster != 'ALL', category NULL)
        requirements_usd: Int64
        funding_usd: Int64
        coverage_ratio: Float64
        unmet_need_usd: Int64
        coverage_flag: Literal['low', 'normal']   # 'low' if coverage < 0.20
        qa_flags: list[str]    # e.g. ['cluster_taxonomy_mismatch']
    Sorted by unmet_need_usd DESC.
    """

def cluster_drilldown_aggregate(analysis_year: int, cohort_iso3s: list[str]) -> pl.DataFrame:
    """
    Cohort-wide. Same columns as per-country but with:
        - pin_cluster = Σ pin_cluster over cohort
        - coverage_ratio = (Σ funding) / (Σ requirements)   — requirements-weighted
    """
```

### 4.3 `transform/trend.py`

```python
def trend_series(iso3: str) -> dict:
    """
    Returns:
      {
        "years": [1999, 2000, ..., 2026],
        "requirements_usd": [int | null, ...],
        "funding_usd": [int | null, ...],
        "chronic_markers": [bool, ...],     # True on years contributing to chronic_years
        "inset_2026": {                      # present only if 2026 has incoming data
           "paid_usd": int,
           "pledged_usd": int,
           "commitment_usd": int,
           "unmet_usd": int                  # requirements - (paid + pledged + commitment)
        } | None
      }
    """
```

---

## 5. Compute: analytical formulas as code

The formulas in `spec.md` §5, rendered as executable expressions. Any ambiguity in the spec is resolved here and back-annotated.

### 5.1 `compute/composites.py`

```python
def gap_score(coverage_ratio: float, pin_share: float) -> float:
    """Primary composite. Multiplicative. Range [0, 1].
       (1 - min(coverage, 1)) * pin_share
       Either factor zero => score zero. Overfunding (>100%) clips to 0 on the
       coverage side inside the score; raw coverage_ratio column stays uncapped.
    """
    return (1.0 - min(max(coverage_ratio, 0.0), 1.0)) * pin_share

def custom_gap_score(
    coverage_gap: float,   # 1 - min(coverage, 1)
    pin_share: float,
    chronic_norm: float,   # chronic_years / 5
    *,
    w_coverage: float,
    w_pin: float,
    w_chronic: float,
) -> float:
    """Linear composite. Σ weights = 1 (normalized upstream).
       No severity term in MVP — see §0.1.
    """
    assert abs(w_coverage + w_pin + w_chronic - 1.0) < 1e-6
    return w_coverage * coverage_gap + w_pin * pin_share + w_chronic * chronic_norm
```

### 5.2 `compute/chronic.py`

```python
def chronic_years(iso3: str, analysis_year: int, history: pl.DataFrame) -> int:
    """
    Strict consecutive count of prior years with coverage_ratio < 0.5,
    counting back from analysis_year - 1, capped at 5.

    Chain breaks on:
      - coverage_ratio >= 0.5 in year k
      - no FTS appeal record in year k
    Missing data is NOT evidence of underfunding.

    history: the FTS appeals frame, pre-aggregated to (iso3, year, coverage_ratio).
    """
```

### 5.3 `compute/donor_hhi.py`

```python
def donor_concentration(iso3: str, year: int, incoming: pl.DataFrame) -> float | None:
    """
    Herfindahl-Hirschman Index on donor shares within year, country.
    Returns None if year != 2026 (no transaction-level data for other years) OR
    if the iso3 has no incoming contributions recorded.

    Share: s_i = donor_i_total_amountUSD / total_amountUSD_for_country_year
    HHI: Σ s_i^2
    Includes rows of any status in {'pledge', 'paid', 'commitment'}
    (documented on every display surface that renders this field).
    Excludes contribution_type != 'financial'.
    """
```

---

## 6. QA flags

Canonical enum. Every flag that can attach to a row appears here.

| Flag | Trigger | Display color |
|---|---|---|
| `funding_imputed_zero` | FTS appeal exists with requirements > 0 but funding null/0 | red |
| `hno_stale` | HNO row for analysis_year missing; fell back to prior year | amber |
| `population_stale` | `analysis_year − Reference_year > 2` | amber |
| `donor_conc_2026_only` | `donor_concentration` is non-null (it's always 2026-only) | neutral |
| `cluster_taxonomy_mismatch` | fell back from globalCluster to raw cluster | amber |
| `severity_unavailable` | severity field requested but unavailable (MVP-always) | neutral |
| `preliminary_hno` | `analysis_year == 2026` for this row | amber |
| `hrp_status_unknown` | `hrp_status == 'Unknown'` | amber |

`qa.apply_qa_flags(df)` attaches flags via a single pass. Flags are stored as a `list[str]` column; CSV export joins with `";"` (base spec §6 export).

---

## 7. API endpoint contracts

FastAPI, JSON. All endpoints stateless — each handler opens a DuckDB in-process connection, runs its queries, returns. No background work.

Every response includes a top-level `meta` object with the query parameters echoed back and a `data_freshness` timestamp (the download time of the latest FTS/HNO file read during the request).

### 7.1 `GET /api/ranking`

Query params:
- `analysis_year` (int, default 2025; enum {2024, 2025, 2026})
- `pin_floor` (int, default 1_000_000)
- `require_hrp` (bool, default true)
- `mode` (enum {acute, structural, combined}, default combined) — used only for default sort choice; the full table is always returned, sort is advisory
- `sort` (string, default matches mode; overrides mode if explicitly set — precedence rule)
- `sort_dir` (enum {asc, desc}, default desc)
- `weights` (optional string: `"coverage:0.3,pin:0.3,chronic:0.4"`) — if present, adds `custom_gap_score` to response rows

Response: `RankingResponse` (§8).

### 7.2 `GET /api/country/{iso3}`

Returns the country's row from the country-year table **plus** the cluster drilldown, trend series, and briefing-note fact sheet. Heavy endpoint; called on row click.

Response: `CountryDetailResponse` (§8).

### 7.3 `GET /api/clusters`

Query params: same cohort filters as `/api/ranking` plus optional `iso3` (if provided, per-country drilldown; else cohort-wide aggregate).

Response: `ClusterDrilldownResponse` (§8).

### 7.4 `GET /api/coverage`

Data-coverage panel contents — the excluded-countries table + the in-cohort flagged table.

Response: `CoverageResponse` (§8).

### 7.5 `GET /api/export.csv`

Same params as `/api/ranking`. Returns CSV with the current filtered + sorted view. `Content-Type: text/csv; charset=utf-8`. Filename: `geo-insight_{analysis_year}_{timestamp}.csv`. `qa_flags` is a single semicolon-joined column.

### 7.6 `GET /api/health`

Returns `{"status": "ok", "datasets_loaded": N, "last_loaded": "..."}`. For container health checks.

### 7.7 `POST /api/nl-query` (reserved)

Implementation is conditional on the Day-1 checkpoint in `spec.md` §6 (≥3 of 4 example queries round-trip cleanly). Shape is reserved now so the frontend can mock against it in parallel — `<NLQueryBar>` / `<StructuredFilterBar>` in `spec-frontend.md` §4.10 builds against this contract regardless of whether the live handler ships.

**Request body:**
```json
{
  "query": "acute food insecurity with less than 10% funding",
  "cohort": {
    "analysis_year": 2025,
    "pin_floor": 1000000,
    "require_hrp": true
  }
}
```

**Response body (`NLQueryResponse`):**
```python
class ParsedFilter(BaseModel):
    field: Literal["cluster", "coverage_ratio", "pin_share", "chronic_years", "hrp_status"]
    op: Literal["eq", "lt", "lte", "gt", "gte", "in"]
    value: str | float | list[str]
    taxonomy: str | None                    # e.g. "globalCluster" — names the source taxonomy used
                                            # for a cluster match, so echo-back chips can disclose it

class EchoBackChip(BaseModel):
    label: str                              # human-readable chip text
    filter: ParsedFilter                    # the structured filter the chip represents
    editable: bool                          # true if the user can adjust this chip without retyping the query

class NLQueryResponse(BaseModel):
    filters: list[ParsedFilter]
    echo_back_chips: list[EchoBackChip]
    caveats: list[str]                      # e.g. "assumed globalCluster taxonomy for 'food insecurity'"
```

**MVP handler behavior (if the Day-1 checkpoint passes):** LLM call constrained to return only this JSON shape; response validated by Pydantic before being returned. If the LLM call fails or validation fails, respond 503 with `{"fallback": "structured_filter"}` and the frontend falls back to `<StructuredFilterBar>`. If the checkpoint fails, the endpoint returns 501 Not Implemented and the frontend routes exclusively through the structured filter bar.

---

## 8. Pydantic schemas — **frozen interface contract**

Any change to this section after this spec is approved requires explicit re-review of `spec-frontend.md` and `spec-evaluation.md`. The TypeScript frontend types are generated from these models via `datamodel-code-generator`.

```python
# pipeline/api/schemas.py
from typing import Literal
from pydantic import BaseModel, Field

# ---------- enums ----------

HRPStatus = Literal["HRP", "FlashAppeal", "RegionalRP", "Other", "Unknown", "None"]
Mode = Literal["acute", "structural", "combined"]
QAFlag = Literal[
    "funding_imputed_zero",
    "hno_stale",
    "population_stale",
    "donor_conc_2026_only",
    "cluster_taxonomy_mismatch",
    "severity_unavailable",
    "preliminary_hno",
    "hrp_status_unknown",
]
ExclusionReason = Literal[
    "no_active_hrp",
    "stale_hno",
    "no_fts_appeal_record",
    "no_population_baseline",
]

# ---------- country row ----------

class CountryRow(BaseModel):
    iso3: str
    country: str
    analysis_year: int
    pin: int
    population: int
    population_reference_year: int
    pin_share: float = Field(..., ge=0.0, le=1.0)
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float                          # raw, uncapped; may exceed 1.0
    unmet_need_usd: int
    gap_score: float = Field(..., ge=0.0, le=1.0)
    custom_gap_score: float | None = None          # present iff weights were supplied
    chronic_years: int = Field(..., ge=0, le=5)
    donor_concentration: float | None = None       # null unless analysis_year == 2026
    hrp_status: HRPStatus
    hno_year: int
    qa_flags: list[QAFlag]

class CustomWeights(BaseModel):
    w_coverage: float = Field(..., ge=0.0, le=1.0)
    w_pin: float = Field(..., ge=0.0, le=1.0)
    w_chronic: float = Field(..., ge=0.0, le=1.0)
    # Σ = 1 enforced by validator

class RankingMeta(BaseModel):
    analysis_year: int
    pin_floor: int
    require_hrp: bool
    mode: Mode
    sort: str
    sort_dir: Literal["asc", "desc"]
    weights: CustomWeights | None
    total_count: int
    excluded_count: int
    data_freshness: str                            # ISO 8601

class RankingResponse(BaseModel):
    meta: RankingMeta
    rows: list[CountryRow]

# ---------- country detail ----------

class ClusterRow(BaseModel):
    cluster_name: str
    pin_cluster: int
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float
    unmet_need_usd: int
    coverage_flag: Literal["low", "normal"]
    qa_flags: list[QAFlag]

class PopulationGroupRow(BaseModel):
    category: str                                   # e.g. 'Adults', 'Boys', 'IDP'
    pin: int
    # No coverage fields — explicitly not computable (base spec §2)

class TrendInset2026(BaseModel):
    paid_usd: int
    pledged_usd: int
    commitment_usd: int
    unmet_usd: int

class TrendSeries(BaseModel):
    years: list[int]
    requirements_usd: list[int | None]
    funding_usd: list[int | None]
    chronic_markers: list[bool]
    inset_2026: TrendInset2026 | None

class FactSheet(BaseModel):
    pin: int
    pin_share: float
    requirements_usd: int
    funding_usd: int
    coverage_ratio: float
    unmet_need_usd: int
    chronic_years: int
    donor_concentration: float | None
    hrp_status: HRPStatus
    hno_year: int
    cbpf_allocations_total_usd: int | None          # from cbpf timeline; context only

class BriefingNote(BaseModel):
    lead: str                                       # template for MVP; LLM post-MVP
    lead_source: Literal["template", "llm"]         # always "template" in MVP
    fact_sheet: FactSheet
    qualifiers: list[str]
    grounding: list[str]                            # dataset citation strings

class CountryDetailResponse(BaseModel):
    meta: RankingMeta
    country: CountryRow
    clusters: list[ClusterRow]
    population_groups: list[PopulationGroupRow]
    trend: TrendSeries
    briefing: BriefingNote

# ---------- clusters endpoint ----------

class ClusterAggregateRow(ClusterRow):
    countries_count: int                            # in-cohort countries contributing

class ClusterDrilldownResponse(BaseModel):
    meta: RankingMeta
    scope: Literal["country", "cohort"]
    iso3: str | None
    rows: list[ClusterAggregateRow]

# ---------- coverage endpoint ----------

class ExcludedCountryRow(BaseModel):
    iso3: str
    country: str
    pin: int | None
    exclusion_reason: ExclusionReason
    detail: str                                     # human-readable explanation

class InCohortFlaggedRow(BaseModel):
    iso3: str
    country: str
    qa_flags: list[QAFlag]

class CoverageResponse(BaseModel):
    meta: RankingMeta
    excluded: list[ExcludedCountryRow]
    in_cohort_flagged: list[InCohortFlaggedRow]
```

Validator rules (implemented as Pydantic validators):
- `CustomWeights`: `abs(w_coverage + w_pin + w_chronic - 1.0) < 1e-6` else 422.
- `CountryRow.coverage_ratio`: no upper bound — 1.8 is valid (overfunded). Only `gap_score` clips.
- `CountryRow.iso3`: length == 3, uppercase.

---

## 9. Test fixtures

Three countries with known-distinct profiles exercise every code path.

| Country | ISO3 | Profile | What this fixture validates |
|---|---|---|---|
| Sudan | SDN | Large PIN, high unmet; chronic history | Happy path, chronic_years > 0, large scores |
| Chad | TCD | Medium PIN, moderate underfund, HNO 2025 subnational | Admin1/admin3 aggregation; cluster drill-down |
| Yemen | YEM | Very high requirements, recurring appeal | Multi-year trend; donor concentration |

Each fixture JSON file under `tests/fixtures/` contains:

```json
{
  "iso3": "SDN",
  "analysis_year": 2025,
  "expected_country_row": { /* the full CountryRow object */ },
  "expected_cluster_count": 11,
  "expected_trend_years_span": [1999, 2026],
  "expected_chronic_years": 3,
  "expected_qa_flags_subset": ["funding_imputed_zero"],
  "note": "Numbers pulled once at spec time from the actual datasets; regenerate if upstream data changes."
}
```

Fixtures are **computed once** by a script `tests/regenerate_fixtures.py` that runs the pipeline and serializes the current outputs, then hand-verified against the source Parquet. The fixtures then pin the implementation: any unintended change to pipeline output surfaces as a test failure.

---

## 10. Test plan

### 10.1 Ingest tests (`test_ingest.py`)

- Each loader returns the documented columns in the documented dtypes.
- HNO 2024: no P-codes (admin*_pcode null), metadata row dropped, numeric cast succeeded.
- HNO 2025: P-codes present, string dtype preserved (leading zeros intact).
- HNO 2026: national-only (admin*_pcode null).
- COD-PS admin0: `Population_group == 'T_TL'` filter applied.
- FTS incoming 2026: multi-ISO3 `destLocations` expanded to multiple rows.

### 10.2 Country-year table (`test_country_year.py`)

- For each fixture (SDN, TCD, YEM): `build_country_year_table(2025)` row matches `expected_country_row` exactly (tolerance 1e-6 on floats).
- `pin` equals the HNO row where `cluster='ALL' AND category IS NULL` (no blind SUM).
- Cohort filter excludes a seeded country with `pin < 1M` and includes a seeded country at `pin == 1M` (boundary).
- `gap_score = (1 - min(cov, 1)) * pin_share` exact.
- `hrp_status` derivation cascade (§0.5) covered on all branches.

### 10.3 Composites (`test_composites.py`)

- `gap_score`: coverage = 0 → score = pin_share; coverage ≥ 1 → score = 0; overfunded 1.5 → same as 1.0.
- `custom_gap_score`: weights not summing to 1 → assertion error.
- `custom_gap_score`: linear form verified against hand-computed values on 3 rows.

### 10.4 Chronic years (`test_chronic.py`)

- Strict consecutive: `[0.3, 0.4, 0.6, 0.3]` backward from analysis_year − 1 → 2 (terminates at the 0.6 year).
- No appeal in year k → terminates at k − 1.
- Cap at 5 (construct 7-year run; returns 5).
- Single-year underfund → 1.

### 10.5 QA flags (`test_qa.py`)

- Every QAFlag enum value produced by at least one synthetic input.
- `funding_imputed_zero` only fires when requirements > 0 AND funding is null/0 (not when requirements = 0).

### 10.6 API tests (`test_api.py`) — using FastAPI `TestClient`

- `GET /api/ranking` default params returns sorted-by-gap_score-desc `rows`; `meta.total_count` matches.
- `GET /api/ranking?mode=structural` returns rows sorted by chronic_years desc.
- `GET /api/ranking?mode=structural&sort=gap_score` → explicit sort wins (precedence rule).
- `GET /api/ranking?weights=coverage:0.3,pin:0.3,chronic:0.4` → `custom_gap_score` populated; Σ=1 validated.
- `GET /api/ranking?weights=coverage:0.3,pin:0.3,chronic:0.5` → 422.
- `GET /api/country/SDN` → valid `CountryDetailResponse` against fixture.
- `GET /api/country/XXX` (nonexistent) → 404.
- `GET /api/export.csv` → `Content-Type: text/csv`; first row is headers; `qa_flags` column is semicolon-joined.

---

## 11. Performance & caching

- Cohort size ≤ ~30 countries → the entire country-year table is a trivial compute (<200ms on a laptop). No caching needed in MVP.
- Trend series touches 28 years × full FTS appeals history (~3.8K rows) — also trivial.
- Donor HHI requires scanning `fts_incoming_funding_global.parquet` (~8K rows) — also trivial.
- If p95 latency exceeds 500ms in practice, first mitigation is an in-process `functools.lru_cache` on `build_country_year_table(year, pin_floor, require_hrp)` keyed by its arguments. No external cache store.

---

## 12. Data freshness & reproducibility

- `meta.data_freshness` is the max `mtime` of the Parquet files actually read during a request, as an ISO 8601 timestamp. Surfaced in the footer of every frontend view.
- Re-running the pipeline against the same input Parquet files must produce byte-identical CSV exports (modulo timestamp). This is a test: `test_export_reproducibility` runs the export twice and diffs.

---

## 13. Definition of done (pipeline)

- [ ] All loaders return documented schema; dtype preservation tested for P-codes and ISO3 leading zeros
- [ ] Country-year table matches SDN / TCD / YEM fixtures exactly
- [ ] **SDN / TCD / YEM fixture expected values are hand-traced to source Parquet rows** — at minimum `pin`, `requirements_usd`, `funding_usd`, `coverage_ratio`, `chronic_years` per country — and signed off by a second reader **before** implementation concludes. Fixtures generated solely by running the pipeline then asserting against that same run would tautologically pass; the hand-trace prevents that silent-regression path.
- [ ] All composites unit-tested on boundary and typical cases
- [ ] Chronic-year logic handles: strict consecutive, chain-break on ≥0.5, chain-break on missing, cap at 5
- [ ] All QA flags reachable by synthetic inputs; all paths tested
- [ ] All API endpoints return valid Pydantic responses; 4xx/5xx paths tested
- [ ] CSV export is semicolon-joined for qa_flags; reproducible byte-identical across runs (modulo timestamp)
- [ ] Cohort filter exhaustively tested on the branch matrix in §4.1 (every combination of `hrp_status × require_hrp × requirements_usd > 0` resolves to either cohort or the correct `exclusion_reason`)
- [ ] Test suite runs in < 10s on a developer laptop

---

*End of data-pipeline spec. Frozen Pydantic schemas at §8 are the interface for `spec-frontend.md` and `spec-evaluation.md`. No application code is written until the spec set is approved and the user says "proceed to implementation."*
