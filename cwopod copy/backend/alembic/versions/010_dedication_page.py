"""Add dedication_text and dedication_image_path to book_projects.

Allows users to add a customizable dedication/gift message page
(text with markdown formatting, or an uploaded image) that appears
after the title page in the typeset PDF.

Revision ID: 010_dedication
Revises: 009_active_task
Create Date: 2026-05-28 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010_dedication"
down_revision: Union[str, None] = "009_active_task"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "book_projects",
        sa.Column("dedication_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "book_projects",
        sa.Column("dedication_image_path", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("book_projects", "dedication_image_path")
    op.drop_column("book_projects", "dedication_text")
