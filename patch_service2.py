with open("pipeline/api/service.py", "r") as f:
    content = f.read()

content = content.replace(
    "        qa_flags=list(row[\"qa_flags\"]),\n    )",
    "        qa_flags=list(row[\"qa_flags\"]),\n        inform_severity=float(row.get(\"inform_severity\")) if row.get(\"inform_severity\") is not None else None,\n    )"
)

with open("pipeline/api/service.py", "w") as f:
    f.write(content)
