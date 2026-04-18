import re

with open("pipeline/transform/qa.py", "r") as f:
    content = f.read()

# Update signature
content = content.replace(
    "hrp_status: str,",
    "hrp_status: str,\n    inform_severity: float | None,"
)

# Update logic
content = content.replace(
    'flags: list[str] = ["severity_unavailable"]',
    'flags: list[str] = []\n    if inform_severity is None:\n        flags.append("severity_unavailable")'
)

with open("pipeline/transform/qa.py", "w") as f:
    f.write(content)
