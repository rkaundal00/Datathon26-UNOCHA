import re

with open("pipeline/transform/country_year.py", "r") as f:
    content = f.read()

# Imports
content = content.replace(
    "from pipeline.ingest.hno import country_level_pin_table, load_hno\nfrom pipeline.transform.qa import build_flags",
    "from pipeline.ingest.hno import country_level_pin_table, load_hno\nfrom pipeline.ingest.inform import ingest_inform_severity\nfrom pathlib import Path\nfrom pipeline.transform.qa import build_flags"
)

content = content.replace(
    "@lru_cache(maxsize=1)\ndef _cached_country_names() -> pl.DataFrame:",
    "@lru_cache(maxsize=1)\ndef _cached_inform_severity() -> pl.DataFrame:\n    return ingest_inform_severity(Path(\"datasets\"))\n\n@lru_cache(maxsize=1)\ndef _cached_country_names() -> pl.DataFrame:"
)

# Join
content = content.replace(
    "    hrp = hrp_status_table(appeals, analysis_year)\n    donors = donor_concentration_table(_cached_incoming()) if analysis_year == 2026 else None",
    "    hrp = hrp_status_table(appeals, analysis_year)\n    donors = donor_concentration_table(_cached_incoming()) if analysis_year == 2026 else None\n    inform_severity = _cached_inform_severity()"
)

content = content.replace(
    "        .join(fts_agg, on=\"iso3\", how=\"left\")\n        .join(hrp, on=\"iso3\", how=\"left\")\n    )",
    "        .join(fts_agg, on=\"iso3\", how=\"left\")\n        .join(hrp, on=\"iso3\", how=\"left\")\n        .join(inform_severity, on=\"iso3\", how=\"left\")\n    )"
)

# QA FLAGS build call
content = content.replace(
    "            hrp_status=row.get(\"hrp_status\", \"None\"),",
    "            hrp_status=row.get(\"hrp_status\", \"None\"),\n            inform_severity=row.get(\"inform_severity\"),"
)

# Add cast
content = content.replace(
    "        pl.col(\"pin_share\").cast(pl.Float64),",
    "        pl.col(\"pin_share\").cast(pl.Float64),\n        pl.col(\"inform_severity\").cast(pl.Float64),"
)

with open("pipeline/transform/country_year.py", "w") as f:
    f.write(content)
