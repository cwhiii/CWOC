"""Add is_admin to users and create system_settings table.

Revision ID: 007_admin_system
Revises: 006_order_history
Create Date: 2025-05-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007_admin_system"
down_revision: Union[str, None] = "006_order_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_admin column to users
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False),
    )

    # Create system_settings table
    op.create_table(
        "system_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "allow_public_registration",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Insert default system settings row
    op.execute(
        "INSERT INTO system_settings (id, allow_public_registration) "
        "VALUES (gen_random_uuid(), false)"
    )


def downgrade() -> None:
    op.drop_table("system_settings")
    op.drop_column("users", "is_admin")
