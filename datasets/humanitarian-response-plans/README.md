# Humanitarian Response Plans (HRP) Registry

This folder contains the **registry of Humanitarian Response Plans** — the
catalog of every coordinated humanitarian plan (HRPs, Flash Appeals, Regional
Refugee Response Plans, and related appeals) that OCHA and its partners have
launched. Sourced live from OCHA's **HPC Tools** API.

- **Source page:** <https://data.humdata.org/dataset/humanitarian-response-plans>
- **Publisher:** HPC Tools (OCHA)
- **Contributor:** OCHA Financial Tracking Service (FTS)
- **License:** Public Domain / No restrictions (**CC0**)
- **Coverage:** Global — every country that has had a coordinated humanitarian plan
- **Time period:** 01 January 2008 – 18 April 2026 (some historical plans reach back to 1999)
- **Last modified (upstream):** 17 April 2026
- **Added to HDX:** 4 December 2018
- **Expected update frequency:** **Live** (pulled from the API on request)
- **File format:** CSV, JSON

## What this dataset is

A **Humanitarian Response Plan (HRP)** is the coordinated strategic plan that
humanitarian partners in a crisis country produce each year (or for the
duration of a crisis) to lay out their collective response: who they'll
assist, with what, how much it will cost, and over what period. HRPs derive
their needs figures from the **HNO**, and their financial requirements are
what the **FTS** then tracks funding against.

This dataset is the **registry** of those plans — not the plan documents
themselves, and not the detailed needs or funding tables, but the **metadata
index** of every plan: plan name, country, period, type, total requirements,
current funding status, and identifiers you can use to join to other HPC /
FTS datasets.

In the humanitarian data stack:

- **HNO** — how many people need help and how badly (the needs assessment).
- **HRP (this dataset)** — *the plan* that responds to those needs, and what
  it costs.
- **FTS** — the money that flows against those HRP requirements.
- **COD-PS** — the underlying population denominators.

## Files in this folder

| File | Size | Format | What it is |
|---|---|---|---|
| `humanitarian-response-plans.csv` | 124.9 KB | CSV with **HXL hashtags** | Simplified, flat, spreadsheet-friendly view of the registry. One row per plan. Converted live from the JSON API output. |
| `HPC Tools API output.json` | 3.8 MB | JSON | Full, nested API response — **complete** information. Contains nested structures (locations, sectors, emergencies, categories) that don't fit in a flat CSV. |

**Use the CSV** for quick spreadsheet/Pandas work and most analyses.
**Use the JSON** when you need the nested fields — like the full list of
countries for a regional plan, the list of emergencies a plan covers, or the
per-sector category breakdowns.

### What "HXL" means

The CSV is **HXL-hashtagged**: the second row of the file (immediately below
the human-readable header) contains **HXL hashtags** like `#country+name`,
`#date+start`, `#value+funding+required+usd`. These are standardized tags
from the [Humanitarian Exchange Language](https://hxlstandard.org/) that let
humanitarian tools automatically understand what each column contains
regardless of how the header is worded.

When loading the CSV:

- With **pandas**, skip the HXL row: `pd.read_csv(path, skiprows=[1])`.
- With **HXL-aware tools** (`libhxl`, HXL Proxy), load normally — they'll use
  the hashtags for type inference and joins.

## Typical fields you'll see

Expect variants of:

- **Identifiers:** plan ID, plan code, plan name (e.g. "Afghanistan
  Humanitarian Response Plan 2024")
- **Plan type:** HRP, Flash Appeal, Regional Response Plan, Other
- **Geography:** country name, ISO3 code, region (plans can be single-country
  or regional)
- **Period:** start date, end date, year(s) covered
- **Status:** planned / active / closed
- **Scope:** people in need, people targeted (headline figures only — full
  breakdowns live in the HNO dataset)
- **Financials (USD):** requirements, funding received, coverage %,
  unmet requirements
- **Links:** URL to the published plan document on HumanitarianAction.info

All currency amounts are in **USD**.

## Working with this data — notes and caveats

- **Registry, not documents.** This dataset tells you *which* plans exist and
  their headline numbers. The actual plan narrative, response strategy, and
  cluster-level detail live in the plan PDFs linked from each row.
- **Live data = moving target.** Because it's pulled live from the HPC Tools
  API, figures (especially current-year funding and coverage %) can change
  between reads. The CSV snapshot date is noted in the HDX resource
  description — use the JSON for the freshest view.
- **JSON is the source of truth.** The CSV is a simplified derivative. Any
  column missing from the CSV is probably present in the JSON under a nested
  key — check there before concluding the data doesn't exist.
- **Plan vs. country is not 1:1.** A country can have multiple plans active
  in the same year (e.g. an HRP plus a Flash Appeal for a sudden-onset
  disaster), and regional plans cover many countries in one row. Don't
  assume one-plan-per-country-per-year.
- **Historical back-coverage varies.** The stated time period starts in 2008,
  but the CSV resource notes go back to 1999 for some plans — expect the
  older entries to have sparser fields.
- **Coverage % can exceed 100%.** Same as in FTS — over-funded plans are real,
  usually when late contributions arrive against a revised appeal.
- **Join keys.** The plan ID / plan code is the stable join key to FTS
  funding data and HNO needs data. Don't match on plan name — names get
  revised between drafts (e.g. "Flash Appeal" → "Revised Flash Appeal").

## Related datasets

- **Needs assessment behind the plan:** Global HPC HNO dataset — the plan's
  people-in-need and targeted figures come from here, at full
  sector/admin-level detail.
- **Money flowing against the plan:** FTS Global Requirements and Funding
  dataset — funding and requirements at the cluster level, plus individual
  transactions. Join on plan ID.
- **Population denominators:** COD-PS global population statistics — useful
  for per-capita or percent-of-population analyses.

## Tags

`humanitarian response plan-hrp` · `hxl`
