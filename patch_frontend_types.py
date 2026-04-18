with open("frontend/src/lib/api-types.ts", "r") as f:
    content = f.read()

content = content.replace(
    "  chronic_years: number;",
    "  chronic_years: number;\n  inform_severity: number | null;"
)

with open("frontend/src/lib/api-types.ts", "w") as f:
    f.write(content)
