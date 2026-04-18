import re

with open("pipeline/transform/country_year.py", "r") as f:
    text = f.read()

old_rows_append = """        rows.append(
            {
                "iso3": iso3,
                "country": country,
                "pin": int(pin) if pin is not None else None,
                "exclusion_reason": reason,
                "detail": detail,
            }
        )"""

new_rows_append = """        reqs_val = reqs or 0.0
        fund_val = r.get("funding_usd") or 0.0
        cov = fund_val / reqs_val if reqs_val > 0 else None
        
        rows.append(
            {
                "iso3": iso3,
                "country": country,
                "pin": int(pin) if pin is not None else None,
                "requirements_usd": reqs_val,
                "funding_usd": fund_val,
                "coverage_ratio": cov,
                "exclusion_reason": reason,
                "detail": detail,
            }
        )"""

text = text.replace(old_rows_append, new_rows_append)
with open("pipeline/transform/country_year.py", "w") as f:
    f.write(text)
