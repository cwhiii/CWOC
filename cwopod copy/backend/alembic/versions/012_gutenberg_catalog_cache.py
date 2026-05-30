"""Add gutenberg_books table for local catalog cache with trigram search.

Revision ID: 012_gutenberg_catalog_cache
Revises: 011_binding_type_and_font_size
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "012_gutenberg_catalog_cache"
down_revision: Union[str, None] = "011_binding_type_and_font_size"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pg_trgm extension for fuzzy/trigram search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Create the gutenberg_books cache table
    op.create_table(
        "gutenberg_books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("gutenberg_id", sa.Integer, nullable=False, unique=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("author", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("publication_year", sa.Integer, nullable=True),
        sa.Column("subjects", sa.Text, nullable=True),
        sa.Column("media_type", sa.String(50), nullable=True),
        sa.Column("download_count", sa.Integer, nullable=True),
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

    # Standard B-tree index on gutenberg_id (for lookups)
    op.create_index("ix_gutenberg_books_gutenberg_id", "gutenberg_books", ["gutenberg_id"])

    # GIN trigram indexes for fuzzy text search
    op.execute(
        "CREATE INDEX ix_gutenberg_books_title_trgm ON gutenberg_books "
        "USING gin (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_gutenberg_books_author_trgm ON gutenberg_books "
        "USING gin (author gin_trgm_ops)"
    )

    # Index on language for filtering
    op.create_index("ix_gutenberg_books_language", "gutenberg_books", ["language"])

    # Index on download_count for sorting by popularity
    op.create_index("ix_gutenberg_books_download_count", "gutenberg_books", ["download_count"])


def downgrade() -> None:
    op.drop_table("gutenberg_books")
    # Note: we don't drop pg_trgm extension as other things might use it
