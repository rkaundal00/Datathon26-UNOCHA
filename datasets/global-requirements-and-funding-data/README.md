# Global Humanitarian Requirements and Funding Data (OCHA FTS)

This folder contains the **Global Requirements and Funding Data** published by
the UN Office for the Coordination of Humanitarian Affairs (OCHA), via its
**Financial Tracking Service (FTS)**.

- **Source page:** <https://data.humdata.org/dataset/global-requirements-and-funding-data>
- **Publisher:** OCHA Financial Tracking Service (FTS)
- **License:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)
- **Coverage:** Global (all countries / appeals)
- **Time period:** 01 January 1999 – 17 April 2026
- **Last modified (upstream):** 17 April 2026
- **Added to HDX:** 24 April 2025
- **Expected update frequency:** Daily
- **File format:** CSV

## What this dataset is

FTS tracks humanitarian funding flows worldwide. It records **appeal
requirements** (how much money humanitarian response plans ask for), **funding
and pledges** against those requirements, and the underlying **transactions**
between donors, pooled funds, and implementing organizations. Data is
self-reported by governments, private donors, UN agencies, and NGOs, then
manually curated, validated, and reconciled by the FTS team on a rolling basis.

## Files in this folder

| File | Size | Granularity | What it contains |
|---|---|---|---|
| `fts_requirements_funding_global.csv` | 270.7 KB | Appeal × year | Annual appeal requirements vs. funding received, globally. The headline "how much was needed vs. how much was funded" table. |
| `fts_requirements_funding_covid_global.csv` | 22.2 KB | Appeal × year | Same as above but broken out to show COVID-19-specific requirements and funding. |
| `fts_requirements_funding_cluster_global.csv` | 1.0 MB | Appeal × cluster × year | Requirements and funding broken down by **cluster** (e.g. Health, WASH, Food Security) within each appeal. |
| `fts_requirements_funding_globalcluster_global.csv` | 1.3 MB | Appeal × global cluster × year | Same as above but using the standardized **global cluster** classification (harmonized across appeals). |
| `fts_incoming_funding_global.csv` | 3.9 MB | Transaction | Individual **incoming** funding flows for 2026 — contributions and pledges flowing into recipient organizations. |
| `fts_internal_funding_global.csv` | 457.6 KB | Transaction | **Internal** funding flows for 2026 — transfers between organizations within the humanitarian system (e.g. UN agency to NGO sub-grant). |
| `fts_outgoing_funding_global.csv` | 1.3 MB | Transaction | **Outgoing** funding flows for 2026 — contributions leaving donor organizations. |

### Requirements & funding files vs. transaction files

- The first four files (`requirements_funding_*`) are **aggregated** tables: one
  row per appeal (and cluster, and year). Use these for yearly summaries,
  funding-gap analysis, or cluster-level comparisons across the full 1999–2026
  history.
- The last three files (`incoming`, `internal`, `outgoing`) are
  **transaction-level** tables scoped to **2026 only**. Use these to trace
  individual flows between donors and recipients, or to compute custom
  aggregations for the current year.

### Incoming vs. internal vs. outgoing

The same humanitarian contribution can appear in more than one of these files
depending on whose perspective you take — **do not sum them together** without
deduplicating, or you will double-count:

- `incoming` = the receiving organization's view.
- `outgoing` = the donor organization's view.
- `internal` = transfers inside the humanitarian system (agency-to-agency
  sub-grants, pooled-fund allocations, etc.).

## Methodology (summary)

FTS is open to any government, private donor, fund, recipient agency, or
implementing organization wishing to report financial pledges and contributions
for humanitarian action. The FTS team manually reviews, validates, and
reconciles incoming reports and updates records on an ongoing basis, so older
figures can still change as new information is reported or corrected.

Full methodology: <https://fts.unocha.org/content/about-fts>

## Caveats

- **Self-reported.** Coverage depends on donors and recipients reporting their
  flows to FTS. Flows that are never reported are not captured.
- **Retroactive revisions.** Because curation is ongoing, historical figures
  can shift between downloads. If reproducibility matters, snapshot the files
  and record the download date.
- **Current-year files are incomplete by construction.** The 2026 transaction
  files will keep growing throughout the year as new flows are reported.
- **Don't double-count transactions.** See the incoming/internal/outgoing note
  above.
- **Currency.** Values are typically reported in USD; check the specific
  currency columns in each file before doing arithmetic.

## Tags

`covid-19` · `funding` · `humanitarian` · `financial tracking service-fts`
