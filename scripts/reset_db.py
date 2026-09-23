"""Reset leave_management_api schema, run migrations, and seed demo data."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from alembic import command
from alembic.config import Config

from scripts.seed import ensure_manager_permissions, seed
from shared.config import settings
from shared.db.session import engine


def reset() -> None:
    url = str(engine.url)
    if "leave_management_api" not in url:
        raise SystemExit(f"Refusing to reset unexpected database: {url}")

    print(f"Resetting schema on {url} ...")
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public"))

    cfg = Config(str(ROOT / "alembic.ini"))
    command.upgrade(cfg, "head")
    print("Migrations applied.")

    seed()
    ensure_manager_permissions()
    print("Database ready.")


if __name__ == "__main__":
    reset()
