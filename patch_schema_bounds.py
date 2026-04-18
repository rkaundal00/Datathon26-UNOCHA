with open("pipeline/api/schemas.py", "r") as f:
    content = f.read()

content = content.replace(
    "    inform_severity: float | None = Field(..., ge=0, le=5)",
    "    inform_severity: float | None = Field(..., ge=0, le=10)"
)
with open("pipeline/api/schemas.py", "w") as f:
    f.write(content)
