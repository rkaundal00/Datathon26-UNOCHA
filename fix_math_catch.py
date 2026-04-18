import re

with open("pipeline/transform/country_year.py", "r") as f:
    text = f.read()

old_block = """        import math
        reqs_val = reqs or 0.0
        fund_val = r.get("funding_usd") or 0.0
        cov = fund_val / reqs_val if reqs_val > 0 else None
        if math.isinf(cov) or math.isinf(reqs_val) or math.isnan(reqs_val):
            cov = None"""
new_block = """        import math
        reqs_val = reqs or 0.0
        fund_val = r.get("funding_usd") or 0.0
        cov = fund_val / reqs_val if reqs_val > 0 else None
        if cov is not None and math.isinf(cov): cov = None
        if cov is not None and math.isnan(cov): cov = None
        if reqs_val is not None and math.isnan(reqs_val): reqs_val = 0.0
        if reqs_val is not None and math.isinf(reqs_val): reqs_val = 0.0"""

text = text.replace(old_block, new_block)
with open("pipeline/transform/country_year.py", "w") as f:
    f.write(text)
