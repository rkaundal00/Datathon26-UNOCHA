"""FastAPI endpoint tests — uses TestClient."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from pipeline.api.main import app

client = TestClient(app)


def test_health_returns_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["datasets_loaded"] > 0


def test_ranking_default_returns_sorted_rows():
    r = client.get("/api/ranking")
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["sort"] == "gap_score"
    assert body["meta"]["total_count"] == len(body["rows"])
    scores = [row["gap_score"] for row in body["rows"]]
    assert scores == sorted(scores, reverse=True)


def test_ranking_mode_structural_sorts_by_chronic_years():
    r = client.get("/api/ranking?mode=structural")
    assert r.status_code == 200
    years = [row["chronic_years"] for row in r.json()["rows"]]
    assert years == sorted(years, reverse=True)


def test_ranking_explicit_sort_overrides_mode():
    r = client.get("/api/ranking?mode=structural&sort=gap_score&sort_dir=desc")
    body = r.json()
    assert body["meta"]["sort"] == "gap_score"
    scores = [row["gap_score"] for row in body["rows"]]
    assert scores == sorted(scores, reverse=True)


def test_ranking_weights_populates_custom_gap_score():
    r = client.get("/api/ranking?weights=coverage:0.3,pin:0.3,chronic:0.4")
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["weights"] is not None
    for row in body["rows"]:
        assert row["custom_gap_score"] is not None


def test_ranking_weights_rejecting_non_unit_sum():
    r = client.get("/api/ranking?weights=coverage:0.3,pin:0.3,chronic:0.5")
    assert r.status_code == 422


def test_ranking_flag_filter():
    r = client.get("/api/ranking?flags=funding_imputed_zero")
    assert r.status_code == 200
    for row in r.json()["rows"]:
        assert "funding_imputed_zero" in row["qa_flags"]


def test_country_detail_returns_full_payload():
    r = client.get("/api/country/SDN")
    assert r.status_code == 200
    body = r.json()
    assert body["country"]["iso3"] == "SDN"
    assert len(body["trend"]["years"]) > 20
    assert body["briefing"]["lead"].startswith("In ")
    assert body["briefing"]["lead_source"] == "template"


def test_country_detail_unknown_iso3_returns_404():
    r = client.get("/api/country/XXX")
    assert r.status_code == 404


def test_country_detail_iso3_must_be_three_chars():
    r = client.get("/api/country/X")
    assert r.status_code == 400


def test_clusters_cohort_aggregate():
    r = client.get("/api/clusters")
    assert r.status_code == 200
    body = r.json()
    assert body["scope"] == "cohort"
    assert body["iso3"] is None
    assert len(body["rows"]) > 0


def test_clusters_per_country():
    r = client.get("/api/clusters?iso3=SDN")
    assert r.status_code == 200
    body = r.json()
    assert body["scope"] == "country"
    assert body["iso3"] == "SDN"


def test_coverage_returns_excluded_and_flagged():
    r = client.get("/api/coverage")
    assert r.status_code == 200
    body = r.json()
    assert "excluded" in body
    assert "in_cohort_flagged" in body


def test_export_csv_content_type_and_headers():
    r = client.get("/api/export.csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    lines = r.text.strip().split("\n")
    headers = lines[0].split(",")
    assert "qa_flags" in headers
    # semicolon-joined flags: first data row should have semicolons when it has ≥2 flags
    # (all rows have at least severity_unavailable, so field won't be empty)
    data_cols = lines[1].split(",")
    qa_idx = headers.index("qa_flags")
    assert "severity_unavailable" in data_cols[qa_idx]


def test_nl_query_returns_501_in_mvp():
    r = client.post("/api/nl-query", json={"query": "food insecurity"})
    assert r.status_code == 501
