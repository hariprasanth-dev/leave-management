"""Ensure Module 2 manager permission exists on already-seeded databases."""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.db.session import SessionLocal
from shared.models import Permission, Role, RolePermission


def ensure() -> None:
    db = SessionLocal()
    try:
        manager = db.scalars(select(Role).where(Role.name == "manager")).first()
        perm = db.scalars(select(Permission).where(Permission.code == "employee:manage")).first()
        if not manager or not perm:
            print("Roles/permissions missing — run scripts/seed.py on a fresh DB.")
            return
        exists = db.scalars(
            select(RolePermission).where(
                RolePermission.role_id == manager.id,
                RolePermission.permission_id == perm.id,
            )
        ).first()
        if exists:
            print("Manager already has employee:manage")
            return
        db.add(RolePermission(role_id=manager.id, permission_id=perm.id))
        db.commit()
        print("Granted employee:manage to manager role")
    finally:
        db.close()


if __name__ == "__main__":
    ensure()
