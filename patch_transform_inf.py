import re

with open("pipeline/transform/country_year.py", "r") as f:
    text = f.read()

old_block = """        reqs_val = reqs or 0.0
        fund_val = r.get("funding_usd") or 0.0
        cov = fund_val / reqs_val if reqs_val > 0 else None"""

new_block = """        import math
        reqs_val = reqs or 0.0
        fund_val = r.get("funding_usd") or 0.0
        cov = fund_val / reqs_val if reqs_val > 0 else None
        if math.isinf(cov) or math.isinf(reqs_val) or math.isnan(reqs_val):
            cov = None"""

text = text.replace(old_block, new_block)

with open("pipeline/transform/country_year.py", "w") as f:
    f.write(text)
