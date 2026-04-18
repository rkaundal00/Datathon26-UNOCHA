import re

with open("pipeline/transform/country_year.py", "r") as f:
    content = f.read()

# Fix NameError in build_excluded_table
content = content.replace(
    "    hrp = hrp_status_table(appeals, analysis_year)\n\n    # Universe:",
    "    hrp = hrp_status_table(appeals, analysis_year)\n    inform_severity = _cached_inform_severity()\n\n    # Universe:"
)

with open("pipeline/transform/country_year.py", "w") as f:
    f.write(content)

