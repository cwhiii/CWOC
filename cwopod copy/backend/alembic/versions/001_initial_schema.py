"""Initial schema - all core tables.

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=True),
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

    # Sessions table
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("token", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "last_active",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Book projects table
    op.create_table(
        "book_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(500), nullable=True),
        sa.Column(
            "source_type",
            sa.Enum("gutenberg", "standard_ebooks", "upload", name="sourcetype"),
            nullable=False,
        ),
        sa.Column("source_url", sa.Text, nullable=True),
        sa.Column("source_metadata", postgresql.JSONB, server_default="{}"),
        sa.Column("original_text_path", sa.Text, nullable=True),
        sa.Column("working_text_path", sa.Text, nullable=True),
        sa.Column("interior_pdf_path", sa.Text, nullable=True),
        sa.Column("cover_pdf_path", sa.Text, nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "draft", "typeset", "cover_ready", "print_ready", "ordered", "shipped",
                name="projectstatus",
            ),
            server_default="draft",
        ),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("isbn", sa.String(20), nullable=True),
        sa.Column("print_provider", sa.String(50), nullable=True),
        sa.Column("page_count", sa.Integer, nullable=True),
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
    op.create_index("ix_book_projects_user_status", "book_projects", ["user_id", "status"])

    # Corrections table
    op.create_table(
        "corrections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("original_text", sa.Text, nullable=False),
        sa.Column("suggested_text", sa.Text, nullable=False),
        sa.Column("context_sentence", sa.Text, nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "accepted", "rejected", name="correctionstatus"),
            server_default="pending",
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

    # Cover prompts table
    op.create_table(
        "cover_prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("prompt_text", sa.Text, nullable=False),
        sa.Column("image_path", sa.Text, nullable=True),
        sa.Column("selected", sa.Boolean, server_default="false"),
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

    # Cover layouts table
    op.create_table(
        "cover_layouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("template_id", sa.Text, nullable=False),
        sa.Column("layout_json", postgresql.JSONB, server_default="{}"),
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

    # Cover sessions table (regeneration tracking)
    op.create_table(
        "cover_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("regeneration_count", sa.Integer, server_default="0"),
        sa.Column("max_regenerations", sa.Integer, server_default="20"),
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

    # Print orders table
    op.create_table(
        "print_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_order_id", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "submitted", "printing", "shipped", "delivered", "failed",
                name="orderstatus",
            ),
            server_default="pending",
        ),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("shipping_address", sa.Text, nullable=False),
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
    op.create_index("ix_print_orders_user_status", "print_orders", ["user_id", "status"])

    # Order items table
    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
    )

    # AI configs table
    op.create_table(
        "ai_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column("text_provider", sa.String(50), server_default="local"),
        sa.Column("text_model", sa.String(100), nullable=True),
        sa.Column("text_api_key_encrypted", sa.Text, nullable=True),
        sa.Column("image_provider", sa.String(50), server_default="local"),
        sa.Column("image_model", sa.String(100), nullable=True),
        sa.Column("image_api_key_encrypted", sa.Text, nullable=True),
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

    # Provider credentials table
    op.create_table(
        "provider_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("credentials_encrypted", sa.Text, nullable=False),
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
    op.create_index(
        "ix_provider_credentials_user_provider",
        "provider_credentials",
        ["user_id", "provider"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("provider_credentials")
    op.drop_table("ai_configs")
    op.drop_table("order_items")
    op.drop_table("print_orders")
    op.drop_table("cover_sessions")
    op.drop_table("cover_layouts")
    op.drop_table("cover_prompts")
    op.drop_table("corrections")
    op.drop_table("book_projects")
    op.drop_table("sessions")
    op.drop_table("users")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS sourcetype")
    op.execute("DROP TYPE IF EXISTS projectstatus")
    op.execute("DROP TYPE IF EXISTS correctionstatus")
    op.execute("DROP TYPE IF EXISTS orderstatus")
