"""Add comprehensive order history fields.

Adds currency, shipping_cost, shipping_address_json, ordered_at to print_orders.
Adds title, author, quantity, unit_price to order_items.
These fields ensure order history is self-contained and survives project deletion.

Revision ID: 006_order_history
Revises: 005_add_phone_number
Create Date: 2025-05-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006_order_history"
down_revision: Union[str, None] = "005_add_phone_number"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to print_orders
    op.add_column(
        "print_orders",
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
    )
    op.add_column(
        "print_orders",
        sa.Column("shipping_cost", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "print_orders",
        sa.Column("shipping_address_json", postgresql.JSONB, nullable=True),
    )
    op.add_column(
        "print_orders",
        sa.Column("ordered_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add new columns to order_items
    op.add_column(
        "order_items",
        sa.Column("title", sa.String(500), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column("author", sa.String(500), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
    )
    op.add_column(
        "order_items",
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("order_items", "unit_price")
    op.drop_column("order_items", "quantity")
    op.drop_column("order_items", "author")
    op.drop_column("order_items", "title")
    op.drop_column("print_orders", "ordered_at")
    op.drop_column("print_orders", "shipping_address_json")
    op.drop_column("print_orders", "shipping_cost")
    op.drop_column("print_orders", "currency")
