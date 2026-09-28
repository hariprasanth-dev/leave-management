"""temporary-password sign in: force a password change afterwards

Revision ID: 008_temp_passwords
Revises: 007_notifications
Create Date: 2026-09-27

Forgot password now emails a one-time temporary password. Its bcrypt hash is stored in
password_reset_tokens.token_hash; old link tokens are discarded.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_temp_passwords"
down_revision: Union[str, Sequence[str], None] = "007_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("DELETE FROM password_reset_tokens")
    op.create_index(
        "ix_password_reset_tokens_created_at", "password_reset_tokens", ["user_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_password_reset_tokens_created_at", table_name="password_reset_tokens")
    op.execute("DELETE FROM password_reset_tokens")
    op.drop_column("users", "must_change_password")
