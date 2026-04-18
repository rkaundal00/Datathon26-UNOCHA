#!/usr/bin/env bash
# Boot backend + frontend together. Ctrl-C stops both cleanly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
API_BASE="http://127.0.0.1:${BACKEND_PORT}"

if [[ ! -x ".venv/bin/uvicorn" ]]; then
  echo "error: .venv/bin/uvicorn not found. Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi
if [[ ! -d "frontend/node_modules" ]]; then
  echo "error: frontend/node_modules missing. Run: (cd frontend && npm install)" >&2
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  echo ""
  echo "[run-dev] shutting down..."
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[run-dev] backend  → ${API_BASE}"
CORS_ORIGINS="http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}" \
.venv/bin/uvicorn pipeline.api.main:app \
  --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

echo "[run-dev] frontend → http://localhost:${FRONTEND_PORT}"
(cd frontend && NEXT_PUBLIC_API_BASE="$API_BASE" npm run dev -- --port "$FRONTEND_PORT") &
FRONTEND_PID=$!

wait -n "$BACKEND_PID" "$FRONTEND_PID"
