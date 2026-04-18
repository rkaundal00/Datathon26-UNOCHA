with open("frontend/src/lib/api-types.ts", "r") as f:
    text = f.read()

old_int = """export interface ExcludedCountryRow {
  iso3: string;
  country: string;
  pin: number | null;
  exclusion_reason: ExclusionReason;
  detail: string;
}"""

new_int = """export interface ExcludedCountryRow {
  iso3: string;
  country: string;
  pin: number | null;
  requirements_usd: number | null;
  funding_usd: number | null;
  coverage_ratio: number | null;
  exclusion_reason: ExclusionReason;
  detail: string;
}"""

text = text.replace(old_int, new_int)
with open("frontend/src/lib/api-types.ts", "w") as f:
    f.write(text)
