with open("pipeline/api/schemas.py", "r") as f:
    text = f.read()

old_schema = """class ExcludedCountryRow(BaseModel):
    iso3: str
    country: str
    pin: int | None = None
    exclusion_reason: ExclusionReason
    detail: str"""
new_schema = """class ExcludedCountryRow(BaseModel):
    iso3: str
    country: str
    pin: int | None = None
    requirements_usd: float | None = None
    funding_usd: float | None = None
    coverage_ratio: float | None = None
    exclusion_reason: ExclusionReason
    detail: str"""

text = text.replace(old_schema, new_schema)
with open("pipeline/api/schemas.py", "w") as f:
    f.write(text)
