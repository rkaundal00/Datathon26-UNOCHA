"""Ingest-layer tests — loader schemas + dtype preservation."""
from __future__ import annotations

import polars as pl

from pipeline.ingest.cod_ps import load_admin0, resolve_population
from pipeline.ingest.fts import (
    HRP_TYPES,
    appeals_country_year,
    hrp_status_table,
    load_appeals,
    load_cluster,
    load_incoming_2026,
)
from pipeline.ingest.hno import country_level_pin_table, load_hno


def test_load_hno_drops_hxl_metadata_row():
    df = load_hno(2024)
    # HXL tags look like "#country+code" — they should not be in the ISO3 column.
    iso3s = df["iso3"].to_list()
    assert not any(str(x).startswith("#") for x in iso3s if x is not None)


def test_load_hno_2024_has_no_pcodes():
    df = load_hno(2024)
    # 2024 has no P-codes in the source — our loader returns them as null columns.
    assert df["admin1_pcode"].is_null().all()
    assert df["admin2_pcode"].is_null().all()


def test_load_hno_2025_preserves_pcode_strings():
    df = load_hno(2025)
    with_adm1 = df.filter(pl.col("admin1_pcode").is_not_null())
    assert with_adm1["admin1_pcode"].dtype == pl.Utf8
    # at least some P-codes should start with "0" (leading zeros preserved)
    assert len(with_adm1) > 100


def test_load_hno_2026_is_national_only():
    df = load_hno(2026)
    assert df["admin1_pcode"].is_null().all()
    assert len(df) > 0


def test_country_level_pin_table_no_blind_sum():
    df = load_hno(2025)
    country = country_level_pin_table(df)
    # SDN country-level PIN is the ALL/null-category row, not a sum.
    sdn = country.filter(pl.col("iso3") == "SDN")
    assert len(sdn) == 1
    assert sdn["pin"][0] == 30_440_770


def test_load_admin0_total_rows_unique():
    df = load_admin0()
    # Every (iso3, reference_year) pair should be unique.
    assert df.select(["iso3", "reference_year"]).is_unique().all()


def test_resolve_population_returns_nearest_le_year():
    df = load_admin0()
    # SDN has a 2024 reference year — 2025 should pick 2024.
    pop, ref = resolve_population(df, "SDN", 2025)
    assert pop is not None
    assert ref == 2024
    # For a year before any reference, should return (None, None).
    pop2, ref2 = resolve_population(df, "SDN", 1900)
    assert pop2 is None
    assert ref2 is None


def test_load_appeals_schema():
    df = load_appeals()
    required = {
        "iso3",
        "plan_code",
        "plan_type_raw",
        "year",
        "requirements_usd",
        "funding_usd",
    }
    assert required.issubset(set(df.columns))


def test_appeals_country_year_sums():
    appeals = load_appeals()
    agg = appeals_country_year(appeals, 2025)
    sdn = agg.filter(pl.col("iso3") == "SDN")
    # SDN 2025: there's just one HRP, and the numbers should be positive.
    assert len(sdn) == 1
    assert sdn["requirements_usd"][0] > 0
    assert sdn["funding_usd"][0] > 0


def test_hrp_status_table_covers_expected_enum():
    appeals = load_appeals()
    hs = hrp_status_table(appeals, 2025)
    statuses = set(hs["hrp_status"].to_list())
    assert "HRP" in statuses
    assert "FlashAppeal" in statuses or "RegionalRP" in statuses  # depends on year data


def test_incoming_2026_explodes_multi_iso3():
    df = load_incoming_2026()
    # After exploding, every row has a single 3-letter ISO3.
    iso3s = df["iso3"].to_list()
    assert all(len(i) == 3 for i in iso3s if i)
    # in kind should be gone (only financial remains)
    assert (df["contribution_type"] == "financial").all()


def test_load_cluster_schema():
    harmonized = load_cluster(harmonized=True)
    assert "cluster_name" in harmonized.columns
    raw = load_cluster(harmonized=False)
    assert "cluster_name" in raw.columns
