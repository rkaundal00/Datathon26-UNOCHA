with open("pipeline/api/routes_coverage.py", "r") as f:
    text = f.read()

old_map = """    excluded = [
        ExcludedCountryRow(
            iso3=r["iso3"],
            country=r["country"] or r["iso3"],
            pin=r.get("pin"),
            exclusion_reason=r["exclusion_reason"],
            detail=r["detail"],
        )
        for r in excluded_raw
    ]"""

new_map = """    excluded = [
        ExcludedCountryRow(
            iso3=r["iso3"],
            country=r["country"] or r["iso3"],
            pin=r.get("pin"),
            requirements_usd=r.get("requirements_usd"),
            funding_usd=r.get("funding_usd"),
            coverage_ratio=r.get("coverage_ratio"),
            exclusion_reason=r["exclusion_reason"],
            detail=r["detail"],
        )
        for r in excluded_raw
    ]"""

text = text.replace(old_map, new_map)
with open("pipeline/api/routes_coverage.py", "w") as f:
    f.write(text)
