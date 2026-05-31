"""Add resource_usage table for tracking compute costs per project.

Revision ID: 016_resource_usage
Revises: 015_font_picker_dropcap
Create Date: 2026-05-29
"""
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

logger = logging.getLogger(__name__)

revision = "016_resource_usage"
down_revision = "015_font_picker_dropcap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    logger.info("016_resource_usage: starting upgrade")
    
    conn = op.get_bind()
    
    # Check if table already exists (from a previous partial run)
    table_exists = conn.execute(
        sa.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resource_usage')")
    ).scalar()
    
    if table_exists:
        logger.info("016_resource_usage: table already exists, skipping creation")
    else:
        op.create_table(
            "resource_usage",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("project_id", UUID(as_uuid=True), nullable=True, index=True),
            sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
            sa.Column("operation", sa.String(50), nullable=False, index=True),
            sa.Column("wall_time_seconds", sa.Float, nullable=False, server_default="0"),
            sa.Column("cpu_time_seconds", sa.Float, nullable=False, server_default="0"),
            sa.Column("gpu_time_seconds", sa.Float, nullable=True),
            sa.Column("peak_ram_mb", sa.Float, nullable=True),
            sa.Column("peak_gpu_ram_mb", sa.Float, nullable=True),
            sa.Column("provider", sa.String(50), nullable=True),
            sa.Column("model_name", sa.String(200), nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        logger.info("016_resource_usage: table created")
    
    logger.info("016_resource_usage: upgrade complete")


def downgrade() -> None:
    op.drop_table("resource_usage")
