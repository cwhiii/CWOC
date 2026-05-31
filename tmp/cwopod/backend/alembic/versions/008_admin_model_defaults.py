"""Add default model settings to system_settings table.

Revision ID: 008_model_defaults
Revises: 007_admin_system
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008_model_defaults"
down_revision: Union[str, None] = "007_admin_system"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add default model columns to system_settings
    op.add_column(
        "system_settings",
        sa.Column(
            "default_text_model",
            sa.String(200),
            server_default="llama3.2:1b",
            nullable=False,
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "default_image_model",
            sa.String(200),
            server_default="v1-5-pruned-emaonly.safetensors",
            nullable=False,
        ),
    )

    # Set defaults on existing rows
    op.execute(
        "UPDATE system_settings SET "
        "default_text_model = 'llama3.2:1b', "
        "default_image_model = 'v1-5-pruned-emaonly.safetensors'"
    )


def downgrade() -> None:
    op.drop_column("system_settings", "default_image_model")
    op.drop_column("system_settings", "default_text_model")
