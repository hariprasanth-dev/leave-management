"""Create tables (SQLite/Postgres) and seed demo data."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.db.base import Base
from shared.db.session import engine
from shared.models import (  # noqa: F401 — register metadata
    Department,
    Employee,
    Holiday,
    LeaveApproval,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    PasswordResetToken,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from scripts.seed import seed


def main() -> None:
    print(f"Creating tables on {engine.url} ...")
    Base.metadata.create_all(bind=engine)
    seed()


if __name__ == "__main__":
    main()
