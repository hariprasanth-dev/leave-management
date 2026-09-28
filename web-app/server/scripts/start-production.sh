#!/bin/sh
set -e

cd "$(dirname "$0")/.."
export PYTHONPATH="${PYTHONPATH:-$(pwd)}"

PORT="${PORT:-8000}"

if [ -n "${DATABASE_URL:-}" ] || [ -n "${DATABASE_PASSWORD:-}" ]; then
  echo "Running database migrations..."
  alembic upgrade head
fi

echo "Starting internal services..."
uvicorn services.auth_service.main:app --host 127.0.0.1 --port 8001 &
uvicorn services.employee_service.main:app --host 127.0.0.1 --port 8002 &
uvicorn services.leave_service.main:app --host 127.0.0.1 --port 8003 &
uvicorn services.approval_service.main:app --host 127.0.0.1 --port 8004 &

sleep 2

echo "Starting gateway on 0.0.0.0:${PORT}..."
exec uvicorn gateway.main:app --host 0.0.0.0 --port "${PORT}"
