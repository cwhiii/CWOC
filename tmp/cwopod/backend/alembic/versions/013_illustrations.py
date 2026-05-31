"""Create illustrations table with pool/placement enums and indexes.

Revision ID: 013_illustrations
Revises: 012_gutenberg_catalog_cache
Create Date: 2026-06-01 00:00:00.000000
"""
import logging
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

logger = logging.getLogger(__name__)

revision: str = "013_illustrations"
down_revision: Union[str, None] = "012_gutenberg_catalog_cache"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    logger.info("013_illustrations: starting upgrade")

    conn = op.get_bind()

    # Create enum types with IF NOT EXISTS via PL/pgSQL to handle partial prior runs
    conn.execute(sa.text("DO $$ BEGIN CREATE TYPE pool_type AS ENUM ('shared', 'available', 'in_book'); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
    conn.execute(sa.text("DO $$ BEGIN CREATE TYPE source_type_ill AS ENUM ('extracted', 'uploaded'); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
    conn.execute(sa.text("DO $$ BEGIN CREATE TYPE placement_mode_type AS ENUM ('full_page', 'plate', 'inline'); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
    conn.execute(sa.text("DO $$ BEGIN CREATE TYPE layout_type AS ENUM ('margins', 'edges'); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
    conn.execute(sa.text("DO $$ BEGIN CREATE TYPE side_type AS ENUM ('left', 'right'); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
    logger.info("013_illustrations: enums ensured")

    # Check if table already exists (from a partial prior run)
    table_exists = conn.execute(
        sa.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'illustrations')")
    ).scalar()

    if table_exists:
        logger.info("013_illustrations: table already exists, skipping creation")
    else:
        # Use raw SQL to create the table so SQLAlchemy doesn't try to auto-create enums
        conn.execute(sa.text("""
            CREATE TABLE illustrations (
                id UUID PRIMARY KEY,
                project_id UUID,
                user_id UUID NOT NULL,
                image_uuid UUID NOT NULL,
                label VARCHAR(255) NOT NULL,
                pool pool_type NOT NULL,
                source source_type_ill NOT NULL,
                file_ext VARCHAR(10) NOT NULL,
                original_width_px INTEGER NOT NULL,
                original_height_px INTEGER NOT NULL,
                placement_mode placement_mode_type,
                page_number INTEGER,
                position_x DOUBLE PRECISION,
                position_y DOUBLE PRECISION,
                height DOUBLE PRECISION,
                layout layout_type,
                side side_type,
                lock_state BOOLEAN NOT NULL DEFAULT false,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        """))
        logger.info("013_illustrations: table created")

        conn.execute(sa.text("CREATE INDEX ix_illustrations_project_id ON illustrations (project_id);"))
        conn.execute(sa.text("CREATE INDEX ix_illustrations_user_id ON illustrations (user_id);"))
        conn.execute(sa.text("CREATE UNIQUE INDEX ix_illustrations_image_uuid ON illustrations (image_uuid);"))
        conn.execute(sa.text("CREATE INDEX ix_illustrations_project_pool ON illustrations (project_id, pool);"))
        logger.info("013_illustrations: indexes created")

    logger.info("013_illustrations: upgrade complete")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS illustrations")
    op.execute("DROP TYPE IF EXISTS side_type")
    op.execute("DROP TYPE IF EXISTS layout_type")
    op.execute("DROP TYPE IF EXISTS placement_mode_type")
    op.execute("DROP TYPE IF EXISTS source_type_ill")
    op.execute("DROP TYPE IF EXISTS pool_type")
