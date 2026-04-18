with open("pipeline/api/service.py", "r") as f:
    content = f.read()
content = content.replace("        hno_year=match.hno_year,\n        \n        \n        cbpf_allocations_total_usd=(", "        hno_year=match.hno_year,\n        inform_severity=match.inform_severity,\n        cbpf_allocations_total_usd=(")
with open("pipeline/api/service.py", "w") as f:
    f.write(content)
