#!/usr/bin/env bash
# AssignFlow - Run script to start PostgreSQL and the FastAPI application
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PG_BIN="$PROJECT_DIR/.venv/lib/python3.12/site-packages/embedded_postgres/pginstall/bin"
export PATH="$PG_BIN:$PATH"

echo "=== Starting AssignFlow ==="

# 1. Start PostgreSQL if not already running
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    echo "Starting local PostgreSQL server..."
    "$PG_BIN/pg_ctl" -D "$PROJECT_DIR/.pgdata" -l "$PROJECT_DIR/.pgdata/server.log" start
    
    # Wait for PostgreSQL to become ready
    echo "Waiting for PostgreSQL to be ready..."
    until pg_isready -h 127.0.0.1 -p 5432 -q; do
        sleep 0.5
    done
    echo "PostgreSQL is running on port 5432."
else
    echo "PostgreSQL is already running."
fi

# 2. Run Alembic migrations
echo "Applying database migrations..."
"$PROJECT_DIR/.venv/bin/alembic" upgrade head

# 3. Start FastAPI application with Uvicorn
echo "Starting FastAPI server on http://127.0.0.1:8000..."
echo "Web UI: http://127.0.0.1:8000/"
echo "API Docs: http://127.0.0.1:8000/docs"
echo "Health Check: http://127.0.0.1:8000/api/health"
echo "=================================================="

PYTHONPATH=backend "$PROJECT_DIR/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --reload
