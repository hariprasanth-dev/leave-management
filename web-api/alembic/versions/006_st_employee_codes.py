"""convert EMPnnn employee codes to company format ST-nn

Revision ID: 006_st_employee_codes
Revises: 005_login_attempts
Create Date: 2026-09-27

"""

from typing import Sequence, Union

from alembic import op

revision: str = "006_st_employee_codes"
down_revision: Union[str, Sequence[str], None] = "005_login_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE employees
        SET employee_code = 'ST-' || lpad(
            (substring(employee_code FROM '^EMP([0-9]+)$'))::int::text, 2, '0'
        )
        WHERE employee_code ~ '^EMP[0-9]+$'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE employees
        SET employee_code = 'EMP' || lpad(
            (substring(employee_code FROM '^ST-([0-9]+)$'))::int::text, 3, '0'
        )
        WHERE employee_code ~ '^ST-[0-9]+$'
        """
    )
