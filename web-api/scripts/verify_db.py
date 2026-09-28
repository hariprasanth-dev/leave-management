"""Verify PostgreSQL connection and LeaveFlow schema (local or Neon)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from shared.config import settings
from shared.db.session import engine

# Core tables created by Alembic migrations (views are optional extras)
EXPECTED_TABLES = frozenset(
    {
        "alembic_version",
        "departments",
        "employees",
        "holidays",
        "leave_approvals",
        "leave_balances",
        "leave_requests",
        "leave_types",
        "password_reset_tokens",
        "permissions",
        "refresh_tokens",
        "role_permissions",
        "roles",
        "user_roles",
        "users",
    }
)

OPTIONAL_VIEWS = ("v_employee_directory", "v_leave_request_list")


def _safe_host(url: str) -> str:
    return url.split("@")[-1] if "@" in url else url


def main() -> int:
    host = _safe_host(settings.database_url)
    print(f"Connecting to: {host}")

    try:
        with engine.connect() as conn:
            db_name = conn.execute(text("SELECT current_database()")).scalar()
            version = conn.execute(text("SELECT version()")).scalar()
            print(f"Database: {db_name}")
            print(f"Server: {str(version).split(',')[0]}")

            inspector = inspect(conn)
            tables = set(inspector.get_table_names())
            views = set(inspector.get_view_names())

            missing = sorted(EXPECTED_TABLES - tables)
            extra = sorted(tables - EXPECTED_TABLES)

            print(f"\nTables found: {len(tables)}")
            if missing:
                print(f"Missing tables ({len(missing)}): {', '.join(missing)}")
                print("Run: alembic upgrade head")
            else:
                print("All expected LeaveFlow tables are present.")

            if extra:
                print(f"Extra tables (OK if you added them): {', '.join(extra)}")

            for view in OPTIONAL_VIEWS:
                if view in views:
                    print(f"View OK: {view}")
                else:
                    print(f"View missing (run migrations): {view}")

            if not missing:
                counts = {
                    "users": conn.execute(text("SELECT count(*) FROM users")).scalar(),
                    "employees": conn.execute(text("SELECT count(*) FROM employees")).scalar(),
                }
                print(f"\nRow counts: users={counts['users']}, employees={counts['employees']}")
                if counts["users"] == 0:
                    print("Empty database — run: python scripts/seed.py")

    except Exception as exc:
        print(f"Connection failed: {exc}", file=sys.stderr)
        print(
            "\nCheck DATABASE_URL:\n"
            "  Repo root: neon link … (writes .env.local)\n"
            "  Or web-api/.env with DATABASE_URL from Neon dashboard",
            file=sys.stderr,
        )
        return 1

    return 0 if not missing else 2


if __name__ == "__main__":
    raise SystemExit(main())
