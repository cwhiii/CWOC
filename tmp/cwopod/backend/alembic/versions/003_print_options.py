"""Add print options to user_preferences and book_projects.

Revision ID: 003_print_options
Revises: 002_user_preferences
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_print_options"
down_revision: Union[str, None] = "002_user_preferences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add print default columns to user_preferences
    op.add_column(
        "user_preferences",
        sa.Column("default_trim_size", sa.String(20), nullable=True, server_default="5.5x8.5"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("default_paper_type", sa.String(20), nullable=True, server_default="white"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("default_color_interior", sa.Boolean(), nullable=True, server_default="false"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("default_cover_finish", sa.String(20), nullable=True, server_default="glossy"),
    )

    # Add per-book print option columns to book_projects
    op.add_column(
        "book_projects",
        sa.Column("trim_size", sa.String(20), nullable=True),
    )
    op.add_column(
        "book_projects",
        sa.Column("paper_type", sa.String(20), nullable=True),
    )
    op.add_column(
        "book_projects",
        sa.Column("color_interior", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "book_projects",
        sa.Column("cover_finish", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("book_projects", "cover_finish")
    op.drop_column("book_projects", "color_interior")
    op.drop_column("book_projects", "paper_type")
    op.drop_column("book_projects", "trim_size")

    op.drop_column("user_preferences", "default_cover_finish")
    op.drop_column("user_preferences", "default_color_interior")
    op.drop_column("user_preferences", "default_paper_type")
    op.drop_column("user_preferences", "default_trim_size")
