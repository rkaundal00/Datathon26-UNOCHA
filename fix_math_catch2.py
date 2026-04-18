with open("pipeline/transform/country_year.py", "r") as f:
    text = f.read()

text = text.replace("        if math.isinf(cov) or math.isinf(reqs_val) or math.isnan(reqs_val):\n            cov = None\n", "")
with open("pipeline/transform/country_year.py", "w") as f:
    f.write(text)
