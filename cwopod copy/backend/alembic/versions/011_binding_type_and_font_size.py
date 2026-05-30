"""Add binding_type and font_size to book_projects and user_preferences.

Revision ID: 011_binding_type_and_font_size
Revises: 010_dedication_page
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011_binding_type_and_font_size"
down_revision: Union[str, None] = "010_dedication"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Per-book binding type and font size
    op.add_column(
        "book_projects",
        sa.Column("binding_type", sa.String(20), nullable=True),
    )
    op.add_column(
        "book_projects",
        sa.Column("font_size", sa.String(10), nullable=True),
    )

    # User preference defaults
    op.add_column(
        "user_preferences",
        sa.Column("default_binding_type", sa.String(20), nullable=True, server_default="paperback"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("default_font_size", sa.String(10), nullable=True, server_default="11pt"),
    )


def downgrade() -> None:
    op.drop_column("book_projects", "font_size")
    op.drop_column("book_projects", "binding_type")
    op.drop_column("user_preferences", "default_font_size")
    op.drop_column("user_preferences", "default_binding_type")
