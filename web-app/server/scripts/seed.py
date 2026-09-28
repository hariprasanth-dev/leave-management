"""Seed reference data: roles/permissions/policy + one manager + one employee."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path
from uuid import UUID

import bcrypt
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.db.session import SessionLocal
from shared.models import (
    Department,
    Employee,
    LeaveBalance,
    LeaveType,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)

# Stable IDs so local docs stay consistent
ROLE_EMPLOYEE = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1")
ROLE_MANAGER = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2")
ROLE_HR = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3")
ROLE_ADMIN = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4")

USER_EMPLOYEE = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1")
USER_MANAGER = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2")

DEPT_ENG = UUID("cccccccc-cccc-cccc-cccc-ccccccccccc1")

EMP_EMPLOYEE = UUID("dddddddd-dddd-dddd-dddd-ddddddddddd1")
EMP_MANAGER = UUID("dddddddd-dddd-dddd-dddd-ddddddddddd2")

YEAR = date.today().year


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Role.id).limit(1)):
            print("Seed skipped: database already has roles.")
            return

        roles = [
            Role(id=ROLE_EMPLOYEE, name="employee", description="Standard employee"),
            Role(id=ROLE_MANAGER, name="manager", description="Team manager"),
            Role(id=ROLE_HR, name="hr", description="Human resources"),
            Role(id=ROLE_ADMIN, name="admin", description="System administrator"),
        ]
        db.add_all(roles)

        permissions = [
            Permission(code="leave:create", description="Submit leave requests"),
            Permission(code="leave:read_own", description="View own leaves"),
            Permission(code="leave:read_team", description="View team leaves"),
            Permission(code="leave:approve", description="Approve or reject leaves"),
            Permission(code="employee:read", description="View employees"),
            Permission(code="employee:manage", description="Manage employees"),
            Permission(code="admin:all", description="Full administrative access"),
        ]
        db.add_all(permissions)
        db.flush()

        perm_by_code = {p.code: p for p in permissions}
        role_perms = [
            (ROLE_EMPLOYEE, "leave:create"),
            (ROLE_EMPLOYEE, "leave:read_own"),
            (ROLE_MANAGER, "leave:create"),
            (ROLE_MANAGER, "leave:read_own"),
            (ROLE_MANAGER, "leave:read_team"),
            (ROLE_MANAGER, "leave:approve"),
            (ROLE_MANAGER, "employee:read"),
            (ROLE_MANAGER, "employee:manage"),
            (ROLE_HR, "leave:create"),
            (ROLE_HR, "leave:read_own"),
            (ROLE_HR, "leave:read_team"),
            (ROLE_HR, "leave:approve"),
            (ROLE_HR, "employee:read"),
            (ROLE_HR, "employee:manage"),
            (ROLE_ADMIN, "admin:all"),
        ]
        db.add_all(
            [
                RolePermission(role_id=role_id, permission_id=perm_by_code[code].id)
                for role_id, code in role_perms
            ]
        )

        password = _hash("password123")
        db.add_all(
            [
                User(
                    id=USER_EMPLOYEE,
                    email="employee@example.com",
                    password_hash=password,
                    full_name="Alex Employee",
                ),
                User(
                    id=USER_MANAGER,
                    email="harip5340@gmail.com",
                    password_hash=password,
                    full_name="Morgan Manager",
                ),
            ]
        )
        db.add_all(
            [
                UserRole(user_id=USER_EMPLOYEE, role_id=ROLE_EMPLOYEE),
                UserRole(user_id=USER_MANAGER, role_id=ROLE_MANAGER),
            ]
        )

        db.add(Department(id=DEPT_ENG, name="Engineering", code="ENG"))

        db.add_all(
            [
                Employee(
                    id=EMP_MANAGER,
                    user_id=USER_MANAGER,
                    department_id=DEPT_ENG,
                    manager_id=None,
                    employee_code="ST-02",
                    hire_date=date(2020, 1, 15),
                ),
                Employee(
                    id=EMP_EMPLOYEE,
                    user_id=USER_EMPLOYEE,
                    department_id=DEPT_ENG,
                    manager_id=EMP_MANAGER,
                    employee_code="ST-01",
                    hire_date=date(2022, 6, 1),
                ),
            ]
        )

        leave_defs = [
            ("earned", "Earned Leave", True, 12),
            ("sick", "Sick Leave", True, 10),
        ]
        leave_types = [
            LeaveType(
                code=code,
                name=name,
                is_paid=is_paid,
                requires_approval=True,
                default_days_per_year=days,
            )
            for code, name, is_paid, days in leave_defs
        ]
        db.add_all(leave_types)
        db.flush()

        for emp_id in (EMP_EMPLOYEE, EMP_MANAGER):
            for lt in leave_types:
                db.add(
                    LeaveBalance(
                        employee_id=emp_id,
                        leave_type_id=lt.id,
                        year=YEAR,
                        entitled=float(lt.default_days_per_year),
                        used=0,
                        pending=0,
                    )
                )

        db.commit()
        print("Seed completed: 1 manager + 1 employee (no leave requests).")
        print("  harip5340@gmail.com / password123")
        print("  employee@example.com / password123")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def ensure_manager_permissions() -> None:
    """Idempotent: grant employee:manage to manager."""
    db = SessionLocal()
    try:
        manager = db.scalars(select(Role).where(Role.name == "manager")).first()
        perm = db.scalars(select(Permission).where(Permission.code == "employee:manage")).first()
        if not manager or not perm:
            return
        exists = db.scalars(
            select(RolePermission).where(
                RolePermission.role_id == manager.id,
                RolePermission.permission_id == perm.id,
            )
        ).first()
        if exists:
            return
        db.add(RolePermission(role_id=manager.id, permission_id=perm.id))
        db.commit()
        print("Granted employee:manage to manager role")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    ensure_manager_permissions()
