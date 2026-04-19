# Geo-Insight — UNOCHA Datathon 2026

**Which humanitarian crises are most overlooked?** A ranked gap analysis over documented need (HNO), funding coverage (FTS), pooled-fund allocations (CBPF), and population baselines (COD-PS). Full authoritative brief lives at [`geo-insight-challenge.md`](./geo-insight-challenge.md).

The system is a **lens over the data, not a decision engine**: every composite decomposes into its inputs, every exclusion has a visible reason, and every ranking is reproducible from the URL.

## What's here

- **`pipeline/`** — Python backend. Polars + DuckDB loaders over the Parquet datasets, FastAPI endpoints, frozen Pydantic schemas, and the evaluation module that generates the calibration card.
- **`frontend/`** — Next.js 16 + React 19 + Tailwind 4 app. Server-rendered entry page with a country table, two scatter views, briefing note, custom-weights panel, data-coverage modal, trend view, cluster drill-down, a Leaflet `/maps` route, and keyboard shortcuts. URL state is the source of truth.
- **`outputs/calibration_card.md`** — committed judge-facing deliverable; regenerates deterministically from the pipeline.
- **`datasets/`** — raw Parquet files (read-only); each subdirectory has its own README and scoped CLAUDE.md.

## Prerequisites

- Python 3.12+ (developed on 3.14) with `venv`
- Node 20+ with `npm` (Next.js 16 needs a recent Node)
- ~2 GB free disk (mostly `frontend/node_modules`)

## First-time setup

```bash
# 1. Python env + pipeline deps
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Frontend deps
cd frontend && npm install && cd ..
```

## Run it

```bash
./scripts/run-dev.sh
```

That boots the backend on `http://127.0.0.1:8000` (with `--reload`) and the Next.js dev server on `http://localhost:3001`, with `NEXT_PUBLIC_API_BASE` pre-wired. Ctrl-C shuts both down.

Override ports:

```bash
BACKEND_PORT=9000 FRONTEND_PORT=4000 ./scripts/run-dev.sh
```

### Run them separately

```bash
# Backend
.venv/bin/uvicorn pipeline.api.main:app --port 8000 --reload

# Frontend (in a second terminal)
cd frontend
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000 npm run dev -- --port 3001
```

## Verify

```bash
# Regenerate the calibration card (judge-facing artifact under outputs/)
.venv/bin/python scripts/regenerate_calibration_card.py

# Frontend type-check
(cd frontend && npx tsc --noEmit)
```

## Try the coordinator walkthroughs

With the dev server running at `http://localhost:3001`:

1. **Default view** (`/`) — the top row shows the highest-gap-score country; click its `Gap score` cell for the multiplicative decomposition.
2. **Structural mode** (`/?mode=structural`) — re-sorts by `chronic_years`; Scatter A emphasizes the Y-axis.
3. **Custom weights** (`/?weights=coverage:0.3,pin:0.3,chronic:0.4&scatter=b`) — opens the Advanced panel with a linear composite; Scatter B shows absolute × proportional burden.
4. **Share** — press `u` (or click *Copy share URL*) and paste anywhere; the full view reproduces.

Keyboard shortcuts: `1`/`2`/`3` for mode, `a`/`b` for scatter, `e` for CSV export, `u` for URL copy, `?` for the overlay.

## API surface

| Route | Purpose |
|---|---|
| `GET /api/ranking` | Full in-cohort table; supports `mode`, `sort`, `weights`, `flags` filters |
| `GET /api/country/{iso3}` | Row + clusters + trend + briefing note |
| `GET /api/clusters` | Cohort-wide aggregate (or `?iso3=` for per-country) |
| `GET /api/coverage` | Excluded countries + in-cohort flagged rows |
| `GET /api/export.csv` | Current view as CSV (semicolon-joined `qa_flags`) |
| `GET /api/health` | Liveness + dataset freshness |
| `POST /api/nl-query` | Reserved — returns 501 in the MVP |

## Non-goals (explicit)

- No LLM-generated numbers (briefing lead is template-only; LLM path is post-MVP with numeric validator)
- No external data enrichment (ACLED / IPC / media) in the MVP
- No fairness / counterfactual ranking
- No coverage-by-demographic (FTS doesn't split funding by demographic; PIN disaggregation is read-only context)
