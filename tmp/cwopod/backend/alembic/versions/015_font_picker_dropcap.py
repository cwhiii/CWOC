"""Add font picker and drop cap support: typography fields, font storage tables.

Revision ID: 015_font_picker_dropcap
Revises: 014_profanity_filter
Create Date: 2026-05-29 00:00:00.000000
"""
import logging
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

logger = logging.getLogger(__name__)

revision: str = "015_font_picker_dropcap"
down_revision: Union[str, None] = "014_profanity_filter"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    logger.info("015_font_picker_dropcap: starting upgrade")

    # Add typography fields to book_projects table
    op.add_column(
        "book_projects",
        sa.Column("body_font", sa.String(length=200), nullable=True),
    )
    logger.info("015_font_picker_dropcap: added body_font to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("heading_font", sa.String(length=200), nullable=True),
    )
    logger.info("015_font_picker_dropcap: added heading_font to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("heading_size", sa.String(length=10), nullable=True),
    )
    logger.info("015_font_picker_dropcap: added heading_size to book_projects")

    # Add drop cap fields to book_projects table
    op.add_column(
        "book_projects",
        sa.Column("dropcap_enabled", sa.Boolean(), nullable=True, server_default="false"),
    )
    logger.info("015_font_picker_dropcap: added dropcap_enabled to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("dropcap_font", sa.String(length=200), nullable=True),
    )
    logger.info("015_font_picker_dropcap: added dropcap_font to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("dropcap_lines", sa.Integer(), nullable=True, server_default="3"),
    )
    logger.info("015_font_picker_dropcap: added dropcap_lines to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("dropcap_color", sa.String(length=20), nullable=True, server_default="#000000"),
    )
    logger.info("015_font_picker_dropcap: added dropcap_color to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("dropcap_weight", sa.String(length=20), nullable=True, server_default="normal"),
    )
    logger.info("015_font_picker_dropcap: added dropcap_weight to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("dropcap_style", sa.String(length=20), nullable=True, server_default="normal"),
    )
    logger.info("015_font_picker_dropcap: added dropcap_style to book_projects")

    op.add_column(
        "book_projects",
        sa.Column("dropcap_padding", sa.Float(), nullable=True, server_default="4.0"),
    )
    logger.info("015_font_picker_dropcap: added dropcap_padding to book_projects")

    # Create user_fonts table
    op.create_table(
        "user_fonts",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("font_family", sa.String(length=200), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "font_family", name="uq_user_font_family"),
    )
    logger.info("015_font_picker_dropcap: created user_fonts table")

    # Create user_font_favorites table
    op.create_table(
        "user_font_favorites",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("font_identifier", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "font_identifier", name="uq_user_font_favorite"),
    )
    logger.info("015_font_picker_dropcap: created user_font_favorites table")

    # Create user_font_recent table
    op.create_table(
        "user_font_recent",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("font_identifier", sa.String(length=200), nullable=False),
        sa.Column("selected_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "font_identifier", name="uq_user_font_recent"),
    )
    logger.info("015_font_picker_dropcap: created user_font_recent table")

    logger.info("015_font_picker_dropcap: upgrade complete")


def downgrade() -> None:
    logger.info("015_font_picker_dropcap: starting downgrade")

    # Drop font-related columns from book_projects
    op.drop_column("book_projects", "dropcap_padding")
    op.drop_column("book_projects", "dropcap_style")
    op.drop_column("book_projects", "dropcap_weight")
    op.drop_column("book_projects", "dropcap_color")
    op.drop_column("book_projects", "dropcap_lines")
    op.drop_column("book_projects", "dropcap_font")
    op.drop_column("book_projects", "dropcap_enabled")
    op.drop_column("book_projects", "heading_size")
    op.drop_column("book_projects", "heading_font")
    op.drop_column("book_projects", "body_font")

    # Drop font tables
    op.drop_table("user_font_recent")
    op.drop_table("user_font_favorites")
    op.drop_table("user_fonts")

    logger.info("015_font_picker_dropcap: downgrade complete")
