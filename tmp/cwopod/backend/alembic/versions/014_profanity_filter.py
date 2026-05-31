"""Add profanity filter: word list in system_settings, toggle in user_preferences.

Revision ID: 014_profanity_filter
Revises: 013_illustrations
Create Date: 2026-05-29 00:00:00.000000
"""
import logging
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

logger = logging.getLogger(__name__)

revision: str = "014_profanity_filter"
down_revision: Union[str, None] = "013_illustrations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    logger.info("014_profanity_filter: starting upgrade")

    # Add profanity_word_list TEXT column to system_settings
    op.add_column(
        "system_settings",
        sa.Column("profanity_word_list", sa.Text(), nullable=True),
    )
    logger.info("014_profanity_filter: added profanity_word_list to system_settings")

    # Add profanity_filter_enabled BOOLEAN to user_preferences (default false)
    op.add_column(
        "user_preferences",
        sa.Column(
            "profanity_filter_enabled",
            sa.Boolean(),
            nullable=True,
            server_default="false",
        ),
    )
    logger.info("014_profanity_filter: added profanity_filter_enabled to user_preferences")

    logger.info("014_profanity_filter: upgrade complete")


def downgrade() -> None:
    logger.info("014_profanity_filter: starting downgrade")
    op.drop_column("user_preferences", "profanity_filter_enabled")
    op.drop_column("system_settings", "profanity_word_list")
    logger.info("014_profanity_filter: downgrade complete")
