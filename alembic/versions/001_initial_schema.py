"""initial leaveflow schema

Revision ID: 001_initial
Revises:
Create Date: 2026-09-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "leave_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("requires_approval", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("default_days_per_year", sa.Numeric(6, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("default_days_per_year >= 0", name="ck_leave_types_default_days"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "holidays",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("is_optional", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("holiday_date", name="uq_holidays_date"),
    )
    op.create_index("ix_holidays_holiday_date", "holidays", ["holiday_date"])

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_is_active", "users", ["is_active"])

    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permissions"),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_roles"),
    )
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"])

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_code", sa.String(length=30), nullable=False),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["manager_id"], ["employees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
        sa.UniqueConstraint("employee_code"),
    )
    op.create_index("ix_employees_department_id", "employees", ["department_id"])
    op.create_index("ix_employees_manager_id", "employees", ["manager_id"])
    op.create_index("ix_employees_is_active", "employees", ["is_active"])

    op.create_table(
        "leave_balances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("entitled", sa.Numeric(6, 2), nullable=False),
        sa.Column("used", sa.Numeric(6, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("pending", sa.Numeric(6, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("entitled >= 0", name="ck_leave_balances_entitled"),
        sa.CheckConstraint("used >= 0", name="ck_leave_balances_used"),
        sa.CheckConstraint("pending >= 0", name="ck_leave_balances_pending"),
        sa.CheckConstraint("used + pending <= entitled", name="ck_leave_balances_cap"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["leave_type_id"], ["leave_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balances_emp_type_year"),
    )
    op.create_index("ix_leave_balances_employee_id", "leave_balances", ["employee_id"])
    op.create_index("ix_leave_balances_year", "leave_balances", ["year"])

    op.create_table(
        "leave_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Numeric(6, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("end_date >= start_date", name="ck_leave_requests_date_range"),
        sa.CheckConstraint("days > 0", name="ck_leave_requests_days"),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="ck_leave_requests_status",
        ),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["leave_type_id"], ["leave_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])
    op.create_index("ix_leave_requests_status", "leave_requests", ["status"])
    op.create_index("ix_leave_requests_dates", "leave_requests", ["start_date", "end_date"])
    op.create_index("ix_leave_requests_leave_type_id", "leave_requests", ["leave_type_id"])

    op.create_table(
        "leave_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("leave_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("action IN ('approved', 'rejected')", name="ck_leave_approvals_action"),
        sa.ForeignKeyConstraint(["approver_id"], ["employees.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["leave_request_id"], ["leave_requests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leave_approvals_leave_request_id", "leave_approvals", ["leave_request_id"])
    op.create_index("ix_leave_approvals_approver_id", "leave_approvals", ["approver_id"])


def downgrade() -> None:
    op.drop_index("ix_leave_approvals_approver_id", table_name="leave_approvals")
    op.drop_index("ix_leave_approvals_leave_request_id", table_name="leave_approvals")
    op.drop_table("leave_approvals")

    op.drop_index("ix_leave_requests_leave_type_id", table_name="leave_requests")
    op.drop_index("ix_leave_requests_dates", table_name="leave_requests")
    op.drop_index("ix_leave_requests_status", table_name="leave_requests")
    op.drop_index("ix_leave_requests_employee_id", table_name="leave_requests")
    op.drop_table("leave_requests")

    op.drop_index("ix_leave_balances_year", table_name="leave_balances")
    op.drop_index("ix_leave_balances_employee_id", table_name="leave_balances")
    op.drop_table("leave_balances")

    op.drop_index("ix_employees_is_active", table_name="employees")
    op.drop_index("ix_employees_manager_id", table_name="employees")
    op.drop_index("ix_employees_department_id", table_name="employees")
    op.drop_table("employees")

    op.drop_index("ix_user_roles_role_id", table_name="user_roles")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")

    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_holidays_holiday_date", table_name="holidays")
    op.drop_table("holidays")
    op.drop_table("leave_types")
    op.drop_table("departments")
    op.drop_table("permissions")
    op.drop_table("roles")
