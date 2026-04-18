import re

with open("pipeline/api/service.py", "r") as f:
    content = f.read()

content = content.replace(
    "        cbpf_allocations_total_usd=(",
    "        inform_severity=match.inform_severity,\n        cbpf_allocations_total_usd=("
)

with open("pipeline/api/service.py", "w") as f:
    f.write(content)
