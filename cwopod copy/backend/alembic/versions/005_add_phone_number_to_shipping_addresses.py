"""Add phone_number to shipping_addresses.

Revision ID: 005_add_phone_number
Revises: 004_shipping_addresses
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "005_add_phone_number"
down_revision = "004_shipping_addresses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shipping_addresses",
        sa.Column("phone_number", sa.String(30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shipping_addresses", "phone_number")
