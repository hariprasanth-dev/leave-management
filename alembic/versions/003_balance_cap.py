"""tighten leave balance cap for postgres

Revision ID: 003_balance_cap
Revises: 002_auth_tokens
Create Date: 2026-09-23

"""

from typing import Sequence, Union

from alembic import op

revision: str = "003_balance_cap"
down_revision: Union[str, Sequence[str], None] = "002_auth_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_leave_balances_cap", "leave_balances", type_="check")
    op.create_check_constraint(
        "ck_leave_balances_cap",
        "leave_balances",
        "used + pending <= entitled",
    )


def downgrade() -> None:
    op.drop_constraint("ck_leave_balances_cap", "leave_balances", type_="check")
    op.create_check_constraint(
        "ck_leave_balances_cap",
        "leave_balances",
        "used + pending <= entitled + 1",
    )
