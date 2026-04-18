with open("pipeline/api/service.py", "r") as f:
    content = f.read()
content = content.replace("        inform_severity=match.inform_severity,\n        inform_severity=match.inform_severity,\n", "        inform_severity=match.inform_severity,\n")
with open("pipeline/api/service.py", "w") as f:
    f.write(content)
