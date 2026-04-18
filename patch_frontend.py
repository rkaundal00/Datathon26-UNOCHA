with open("frontend/src/lib/api-types.ts", "r") as f:
    content = f.read()

content = content.replace(
    "  inform_severity: number | null;\n  inform_severity: number | null;",
    "  inform_severity: number | null;"
)

with open("frontend/src/lib/api-types.ts", "w") as f:
    f.write(content)
