# Global Humanitarian Needs Overview (HPC HNO) Data

This folder contains the **Global HPC HNO** dataset published by the UN Office
for the Coordination of Humanitarian Affairs (OCHA), sourced from the **HPC
Tools** system that supports the annual Humanitarian Programme Cycle.

- **Source page:** <https://data.humdata.org/dataset/global-hpc-hno>
- **Publisher:** OCHA (data contributed by humanitarian partners in-country)
- **Coverage:** Global — 24 countries with active humanitarian response plans
- **Time period:** 01 January 2024 – 31 December 2026
- **Expected update frequency:** Yearly
- **File format:** CSV

## What this dataset is

An **HNO (Humanitarian Needs Overview)** is the annual product in which OCHA
and its humanitarian partners estimate, for each crisis country, how many
people need humanitarian assistance and how severe those needs are — broken
down by sector (cluster), population group, sex, age, and disability status.
The HNO is the evidence base that feeds into the Humanitarian Response Plan
(HRP) and the appeal requirements tracked by FTS.

This dataset consolidates those country-level HNO figures into a single
standardized global table per year. Data is extracted from OCHA's **HPC Tools**
platform, which is under active development — so schemas can change between
years.

## Countries covered (24)

Afghanistan · Burkina Faso · Cameroon · Central African Republic · Chad ·
Colombia · Democratic Republic of the Congo · El Salvador · Ethiopia ·
Guatemala · Haiti · Honduras · Mali · Mozambique · Myanmar · Niger · Nigeria ·
Somalia · South Sudan · Sudan · Syrian Arab Republic · Ukraine · Venezuela
(Bolivarian Republic of) · Yemen

The country list can change year to year as crises escalate or response plans
conclude.

## Files in this folder

| File | Size | Geographic level | P-coded | Notes |
|---|---|---|---|---|
| `Global HPC HNO 2026.csv` | 6.5 KB | **National** | Yes | 2026 figures. Much smaller because it is currently national-level only; subnational detail is typically added later in the cycle. |
| `Global HPC HNO 2025.csv` | 26.2 MB | **Subnational** | Yes | 2025 figures, broken down to admin sub-levels within each country. |
| `Global HPC HNO 2024.csv` | 31.0 MB | **Subnational** | — | 2024 figures, broken down to admin sub-levels within each country. |

### What "P-coded" means

The 2025 and 2026 files include **P-codes** — standardized
OCHA/[Common Operational Datasets](https://data.humdata.org/dashboards/cod)
administrative-area identifiers (e.g. `AF01` for Kabul province). P-codes let
you join HNO figures to official administrative boundary shapefiles without
having to match on place names (which is fragile due to spelling variants and
transliteration). If you're mapping or spatially joining this data, always
prefer the P-code column over the name column.

## Typical columns you'll see

Schemas vary across years as HPC Tools evolves, but expect variants of:

- **Geography:** country name, country ISO3, admin level name(s), admin P-code(s)
- **Population breakdown:** sector / cluster, population group, sex, age group, disability status
- **Figures:** total population, people in need (PiN), people targeted, severity of needs (usually a 1–5 phase classification)
- **Metadata:** reporting year, data source, last updated

Always inspect the header row of each yearly file before writing joins — column
names and coded values (e.g. sector codes) can differ between years.

## Working with this data — notes and caveats

- **Don't blindly sum across rows.** HNO files are typically long-format with
  overlapping breakdowns (e.g. a "total PiN" row plus separate rows for each
  sex/age/cluster slice of the same population). Summing everything
  double-counts people. Filter to a single consistent breakdown dimension
  before aggregating.
- **PiN ≠ Targeted ≠ Reached.** *People in Need* is the assessed caseload;
  *Targeted* is who the response plan intends to reach; *Reached* (tracked
  elsewhere, not in this dataset) is who actually received assistance. They
  are different numbers and mean different things.
- **2026 is preliminary.** The small 2026 file is a snapshot early in the
  planning cycle and will be superseded by a fuller subnational release later
  in the year.
- **Schema drift between years.** Because HPC Tools is under active
  development, column names and classifications can shift between 2024, 2025,
  and 2026 files. Build loaders per-year rather than assuming one schema.
- **Country coverage changes.** Don't assume a country present in one year is
  present in the next.

## Related datasets

- **Humanitarian funding against these needs:** see the FTS Global
  Requirements and Funding dataset — the HNO sizes the need, FTS tracks the
  money that responds to it.
- **Administrative boundaries for joining:** HDX
  [Common Operational Datasets (COD)](https://data.humdata.org/dashboards/cod)
  provide the shapefiles and P-code registries that match the P-codes used here.

## License

Check the HDX source page for the specific license terms — HDX datasets from
OCHA are most commonly published under **CC BY** or **CC BY-IGO**, but confirm
on the dataset page before redistribution.
