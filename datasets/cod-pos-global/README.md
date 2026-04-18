# Global Population Statistics — Common Operational Datasets (COD-PS)

This folder contains global **population statistics** compiled daily by HDX
from the **Common Operational Datasets – Population Statistics (COD-PS)** —
the authoritative baseline population figures used across the humanitarian
system.

- **Source page:** <https://data.humdata.org/dataset/cod-ps-global>
- **Publisher / contributor:** HDX (compiled from per-country COD-PS source datasets)
- **Original sources:** Multiple — national statistics offices, UN agencies, and other in-country authorities (varies per country)
- **License:** Creative Commons Attribution International (CC BY)
- **Coverage:** Global — 139 countries and territories (listed below)
- **Time period:** 01 January 2001 – 31 December 2026
- **Expected update frequency:** Yearly (per country); the compiled global files here are refreshed **daily** as any source updates
- **File format:** CSV

## What this dataset is

Common Operational Datasets (CODs) are OCHA-endorsed reference datasets that
the humanitarian community agrees to use as the **common baseline** for a
country — so that every agency's maps, needs assessments, and response plans
are counting the same people against the same boundaries. **COD-PS** is the
population-statistics component: how many people live in each administrative
area, disaggregated by **sex and age (GADD — Gender and Age Disaggregated
Data)**.

This dataset stitches together the individual country COD-PS files into five
global tables, one per administrative level.

## Files in this folder

| File | Size | Admin level | P-coded | What it is |
|---|---|---|---|---|
| `cod_population_admin0.csv` | 786 KB | **Admin 0** (country) | — | One row per country per year — national totals and sex/age breakdowns. |
| `cod_population_admin1.csv` | 11.3 MB | **Admin 1** (province / state / region) | Yes | First-level subdivisions. Roughly the level you'd map for a national-scale dashboard. |
| `cod_population_admin2.csv` | 135.3 MB | **Admin 2** (district / department) | Yes | Second-level subdivisions. The most detailed level with broad country coverage — and by far the largest file. |
| `cod_population_admin3.csv` | 35.4 MB | **Admin 3** (sub-district / commune) | Yes | Third-level subdivisions. Available only for countries whose COD goes this deep. |
| `cod_population_admin4.csv` | 4.6 MB | **Admin 4** (village / ward) | Yes | Fourth-level subdivisions. Small file because very few countries publish COD-PS this granularly. |

### What "P-coded" means

Every subnational file contains **P-codes** — standardized administrative-area
identifiers from the matching **COD-AB (Administrative Boundaries)** dataset
for each country (e.g. `ET0101` for a woreda in Ethiopia). Always join on
P-code, never on name: place names in COD files can differ from names in other
datasets due to transliteration, renaming, or admin reforms, but P-codes are
stable and unambiguous.

Matching boundary shapefiles are published as **COD-AB** on HDX — one dataset
per country. To map this population data, download the corresponding COD-AB
file and join on the P-code column at the same admin level.

## Typical columns you'll see

Schemas are broadly harmonized across countries but can vary slightly. Expect:

- **Country:** country name, ISO3 code
- **Geography:** admin level name(s) at this level and all parent levels (e.g. an admin2 row typically carries admin1 and admin0 names too), plus matching P-codes
- **Reference year:** the year the population figures apply to
- **Total population**
- **Sex breakdown:** male / female totals
- **Age–sex breakdown (GADD):** population counts by 5-year age band × sex (e.g. `f_0_4`, `m_5_9`, ..., `f_80plus`)
- **Source metadata:** original source, projection method, last-updated date

Inspect the header row before building pipelines — a handful of countries
publish slightly different column names or age bandings.

## Countries covered (139)

Afghanistan, Albania, Angola, Anguilla, Antigua and Barbuda, Argentina,
Armenia, Aruba, Azerbaijan, Bahamas, Bangladesh, Barbados, Belize, Benin,
Bermuda, Bhutan, Bolivia (Plurinational State of), Botswana, Brazil, British
Virgin Islands, Burkina Faso, Burundi, Cabo Verde, Cambodia, Cameroon, Cayman
Islands, Central African Republic, Chad, Chile, Colombia, Comoros, Costa Rica,
Côte d'Ivoire, Cuba, Curaçao, Democratic People's Republic of Korea,
Democratic Republic of the Congo, Dominican Republic, Ecuador, Egypt, El
Salvador, Eritrea, Eswatini, Ethiopia, Fiji, French Guiana, Gabon, Gambia,
Georgia, Ghana, Grenada, Guadeloupe, Guatemala, Guinea, Guyana, Haiti,
Honduras, Hungary, Indonesia, Iran (Islamic Republic of), Iraq, Jamaica,
Kazakhstan, Kenya, Kiribati, Kyrgyzstan, Lao People's Democratic Republic,
Lesotho, Liberia, Madagascar, Malawi, Malaysia, Maldives, Mali, Marshall
Islands, Martinique, Mauritania, Mauritius, Mexico, Micronesia (Federated
States of), Mongolia, Montserrat, Morocco, Mozambique, Myanmar, Namibia,
Nepal, Nicaragua, Niger, Nigeria, Niue, Pakistan, Palau, Panama, Papua New
Guinea, Paraguay, Peru, Philippines, Poland, Qatar, Republic of Moldova,
Romania, Rwanda, Saint Barthélemy, Saint Kitts and Nevis, Saint Lucia, Saint
Martin, Saint Vincent and the Grenadines, Sao Tome and Principe, Saudi Arabia,
Senegal, Seychelles, Sierra Leone, Sint Maarten, Slovakia, Solomon Islands,
Somalia, South Africa, South Sudan, Sri Lanka, State of Palestine, Sudan,
Suriname, Tajikistan, Thailand, Timor-Leste, Togo, Tokelau, Tonga, Trinidad
and Tobago, Tunisia, Turks and Caicos Islands, Türkiye, Uganda, United
Republic of Tanzania, United States Virgin Islands, Uruguay, Uzbekistan,
Vanuatu, Venezuela (Bolivarian Republic of), Viet Nam, Zambia, Zimbabwe.

Not every country is present at every admin level — countries drop out of the
deeper-level files if their national COD doesn't go that deep.

## Methodology

From the HDX source page: compiled daily from individual country COD
population-statistics files. The underlying methodology — projection model,
base census year, age-band construction — is set by each country's source
authority and differs between countries. Always consult the country-level
COD-PS dataset for the specific methodology behind a given country's figures.

## Working with this data — notes and caveats

- **Different update schedules per country.** The compiled global files here
  are rebuilt daily, but a country's numbers only change when *its* COD-PS
  source is updated — which can be anywhere from yearly to every several
  years depending on when the next census or projection is published.
- **Reference year ≠ file modification date.** A row labeled 2024 might have
  been produced years earlier as a projection. Filter on the reference-year
  column, not the file's last-modified date.
- **Don't cross-sum admin levels.** Admin0 totals, admin1 totals, and admin2
  totals for the same country-year should be approximately equal — if you sum
  rows across multiple admin levels you'll multiply-count the same population.
  Pick one level per analysis.
- **Admin-level meaning varies by country.** Admin1 in India is a state of
  tens of millions; admin1 in Luxembourg is a canton of tens of thousands.
  Don't compare admin-level figures across countries without normalizing.
- **Different base censuses.** Some countries' projections start from a recent
  census (2020+), others from much older ones (2000s, 1990s). Precision and
  age-band reliability drop the further the projection is extrapolated.
- **Join on P-code.** Place-name joins will fail silently on diacritics,
  transliteration variants, and renamed areas. P-codes from the matching
  COD-AB boundary file are the canonical join key.

## Related datasets

- **Administrative boundaries (shapefiles) for mapping:** per-country
  **COD-AB** datasets on HDX — one per country, P-codes match the ones in
  this dataset.
- **Humanitarian needs per admin area:** Global HPC HNO dataset — pairs
  naturally with this one (HNO says how many are in need; COD-PS says how
  many people live there in total, giving you a denominator for severity or
  percent-affected calculations).

## License

Creative Commons Attribution International (**CC BY**). Attribute HDX and the
underlying country sources when redistributing.