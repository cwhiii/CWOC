"""Add active_task_id to cover_sessions table.

Tracks the currently running image generation task so that page refreshes
don't queue duplicate ComfyUI jobs.

Revision ID: 009_active_task
Revises: 008_model_defaults
Create Date: 2026-05-28 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009_active_task"
down_revision: Union[str, None] = "008_model_defaults"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cover_sessions",
        sa.Column("active_task_id", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cover_sessions", "active_task_id")
