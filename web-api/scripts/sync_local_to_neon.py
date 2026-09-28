"""
Copy row data from local PostgreSQL into Neon (replaces Neon data in app tables).

Usage (from web-api, venv active):
  set PYTHONPATH=%CD%
  python scripts/sync_local_to_neon.py
  python scripts/sync_local_to_neon.py --dry-run

Environment:
  LOCAL_DATABASE_URL — source (default: local leave_management_api)
  DATABASE_URL — target Neon (from repo .env.local via shared.config)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.config import settings

DEFAULT_LOCAL = (
    "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/leave_management_api"
)

# Parent → child insert order
TABLES_IN_ORDER = [
    "roles",
    "permissions",
    "leave_types",
    "departments",
    "holidays",
    "role_permissions",
    "users",
    "user_roles",
    "employees",
    "leave_balances",
    "leave_requests",
    "leave_approvals",
    "refresh_tokens",
    "password_reset_tokens",
    "alembic_version",
]

OPTIONAL_LOCAL_TABLES = ("login_attempts", "notifications")


def _safe_host(url: str) -> str:
    return url.split("@")[-1] if "@" in url else url


def _normalize_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _table_columns(conn, table: str) -> list[str]:
    rows = conn.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :t
            ORDER BY ordinal_position
            """
        ),
        {"t": table},
    ).fetchall()
    return [r[0] for r in rows]


def _copy_table(local: Engine, neon: Engine, table: str, dry_run: bool) -> int:
    with local.connect() as src:
        if table not in inspect(src).get_table_names():
            return -1
        cols = _table_columns(src, table)
        if not cols:
            return 0
        rows = src.execute(text(f'SELECT * FROM "{table}"')).mappings().all()

    if not rows:
        return 0

    if dry_run:
        print(f"  {table}: would copy {len(rows)} rows")
        return len(rows)

    col_sql = ", ".join(f'"{c}"' for c in cols)
    val_sql = ", ".join(f":{c}" for c in cols)
    insert_sql = text(f'INSERT INTO "{table}" ({col_sql}) VALUES ({val_sql})')

    with neon.begin() as dst:
        for row in rows:
            dst.execute(insert_sql, dict(row))

    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy local Postgres data into Neon")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show counts only; do not truncate or insert on Neon",
    )
    parser.add_argument(
        "--local-url",
        default=os.environ.get("LOCAL_DATABASE_URL", DEFAULT_LOCAL),
        help="Source database URL (local pgAdmin)",
    )
    args = parser.parse_args()

    local_url = _normalize_url(args.local_url.strip())
    neon_url = settings.database_url

    print(f"Source (local): {_safe_host(local_url)}")
    print(f"Target (Neon):  {_safe_host(neon_url)}")

    local_engine = create_engine(local_url, pool_pre_ping=True)
    neon_engine = create_engine(neon_url, pool_pre_ping=True)

    try:
        with local_engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception as exc:
        print(f"Cannot connect to local DB: {exc}", file=sys.stderr)
        print(
            "Start PostgreSQL and ensure database leave_management_api exists, or set LOCAL_DATABASE_URL.",
            file=sys.stderr,
        )
        return 1

    with local_engine.connect() as src:
        local_tables = set(inspect(src).get_table_names())
    with neon_engine.connect() as dst:
        neon_tables = set(inspect(dst).get_table_names())

    to_copy: list[str] = []
    for name in TABLES_IN_ORDER:
        if name not in local_tables:
            print(f"Skip {name} (not on local)")
            continue
        if name not in neon_tables:
            print(f"Skip {name} (not on Neon — run alembic upgrade head on Neon first)")
            continue
        to_copy.append(name)

    for extra in OPTIONAL_LOCAL_TABLES:
        if extra in local_tables and extra in neon_tables and extra not in to_copy:
            to_copy.append(extra)
        elif extra in local_tables and extra not in neon_tables:
            print(f"Skip {extra} (local only — no migration in Neon repo)")

    if not to_copy:
        print("Nothing to copy.")
        return 1

    if not args.dry_run:
        truncate_list = ", ".join(f'"{t}"' for t in to_copy)
        print(f"\nTruncating on Neon: {len(to_copy)} tables…")
        with neon_engine.begin() as conn:
            conn.execute(text(f"TRUNCATE {truncate_list} RESTART IDENTITY CASCADE"))

    print("\nCopying rows:")
    total = 0
    for table in to_copy:
        try:
            n = _copy_table(local_engine, neon_engine, table, args.dry_run)
        except Exception as exc:
            print(f"  {table}: FAILED — {exc}", file=sys.stderr)
            return 1
        if n == -1:
            continue
        if n > 0 or not args.dry_run:
            print(f"  {table}: {n} rows")
        total += max(n, 0)

    action = "Would copy" if args.dry_run else "Copied"
    print(f"\n{action} {total} rows total into Neon.")
    if not args.dry_run:
        print("Verify: python scripts/verify_db.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
