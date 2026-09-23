"""Add browse views so names/emails are visible in SQL clients.

Revision ID: 004_browse_views
Revises: 003_balance_cap
Create Date: 2026-09-23

Employees store profile data on users (joined by user_id). These views make
pgAdmin / DBeaver listings match what the UI shows.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "004_browse_views"
down_revision: Union[str, Sequence[str], None] = "003_balance_cap"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW v_employee_directory AS
        SELECT
            e.id,
            e.employee_code,
            u.full_name,
            u.email,
            d.name AS department,
            e.manager_id,
            e.hire_date,
            e.is_active,
            e.created_at,
            e.updated_at
        FROM employees e
        JOIN users u ON u.id = e.user_id
        JOIN departments d ON d.id = e.department_id
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW v_leave_request_list AS
        SELECT
            lr.id,
            e.employee_code,
            u.full_name AS employee_name,
            lt.code AS leave_type,
            lt.name AS leave_type_name,
            lr.start_date,
            lr.end_date,
            lr.days,
            lr.status,
            lr.reason,
            lr.created_at,
            lr.updated_at
        FROM leave_requests lr
        JOIN employees e ON e.id = lr.employee_id
        JOIN users u ON u.id = e.user_id
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_leave_request_list")
    op.execute("DROP VIEW IF EXISTS v_employee_directory")
