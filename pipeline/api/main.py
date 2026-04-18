"""FastAPI app — mounts routers under /api/*."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pipeline.api import routes_clusters, routes_country, routes_coverage, routes_export, routes_ranking
from pipeline.api.schemas import HealthResponse
from pipeline.api.service import _datasets_freshness

app = FastAPI(
    title="Geo-Insight API",
    description="Humanitarian need-vs-funding gap analysis — UNOCHA Datathon 2026",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(routes_ranking.router, prefix="/api")
app.include_router(routes_country.router, prefix="/api")
app.include_router(routes_clusters.router, prefix="/api")
app.include_router(routes_coverage.router, prefix="/api")
app.include_router(routes_export.router, prefix="/api")


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        datasets_loaded=9,
        last_loaded=_datasets_freshness(),
    )


@app.post("/api/nl-query", status_code=501)
def nl_query() -> dict:
    """Reserved endpoint — NL query path is post-Day-1-checkpoint (see spec-data-pipeline §7.7)."""
    return {"fallback": "structured_filter", "reason": "NL query not implemented in MVP"}
