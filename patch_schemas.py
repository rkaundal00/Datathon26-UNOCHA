with open("pipeline/api/schemas.py", "r") as f:
    content = f.read()

content = content.replace(
    "chronic_years: int",
    "chronic_years: int\n    inform_severity: float | None"
)

content = content.replace(
    "unmet_need_usd: float\n    chronic_years: int",
    "unmet_need_usd: float\n    chronic_years: int\n    inform_severity: float | None"
)

with open("pipeline/api/schemas.py", "w") as f:
    f.write(content)
