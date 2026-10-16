#!/usr/bin/env bash
# AssignFlow - Stop script to cleanly shut down the server and PostgreSQL
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PG_BIN="$PROJECT_DIR/.venv/lib/python3.12/site-packages/embedded_postgres/pginstall/bin"

echo "=== Stopping AssignFlow ==="

# Stop Uvicorn server running on port 8000
PID=$(lsof -t -i:8000 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo "Stopping FastAPI server (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
fi

# Stop PostgreSQL
if [ -d "$PROJECT_DIR/.pgdata" ]; then
    echo "Stopping PostgreSQL server..."
    "$PG_BIN/pg_ctl" -D "$PROJECT_DIR/.pgdata" stop -m fast 2>/dev/null || true
fi

echo "AssignFlow stopped."
