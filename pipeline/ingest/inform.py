import polars as pl
from pathlib import Path

def ingest_inform_severity(data_dir: Path) -> pl.DataFrame:
    path = data_dir / "202603_INFORM_Severity" / "202603_INFORM_Severity_-_March_2026__INFORM_Severity_-_country.parquet"
    if not path.exists():
        return pl.DataFrame({"iso3": [], "inform_severity": []}, schema={"iso3": pl.Utf8, "inform_severity": pl.Float64})

    df = pl.read_parquet(path)

    # Row 0 contains actual column names
    actual_cols = list(df.row(0))
    iso3_index = actual_cols.index("ISO3")
    severity_index = actual_cols.index("INFORM Severity Index")
    country_index = actual_cols.index("COUNTRY") if "COUNTRY" in actual_cols else None

    selects = [
        pl.col(df.columns[iso3_index]).alias("iso3"),
        pl.col(df.columns[severity_index]).alias("inform_severity"),
    ]
    if country_index is not None:
        selects.append(pl.col(df.columns[country_index]).alias("inform_country"))

    extracted = df.select(selects)

    extracted = extracted.filter(
        pl.col("iso3").str.len_chars() == 3
    ).with_columns([
        pl.col("inform_severity").cast(pl.Float64, strict=False)
    ]).drop_nulls("inform_severity")

    if country_index is not None:
        return extracted.group_by("iso3").agg(
            pl.col("inform_severity").max(),
            pl.col("inform_country").first(),
        )
    return extracted.group_by("iso3").agg(pl.col("inform_severity").max())
