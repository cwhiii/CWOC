"""User preferences model for persisting user settings like default print provider and view mode."""

import uuid
from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserPreference(Base, TimestampMixin):
    """Stores per-user preferences (default print provider, bookshelf view mode, print defaults, etc.)."""

    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    default_print_provider: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default="lulu"
    )
    bookshelf_view_mode: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default="grid"
    )

    # Print defaults
    default_trim_size: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default="5.5x8.5"
    )
    default_paper_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default="white"
    )
    default_color_interior: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False
    )
    default_cover_finish: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default="glossy"
    )
    default_binding_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default="paperback"
    )
    default_font_size: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, default="11pt"
    )

    # Profanity filter toggle (default off)
    profanity_filter_enabled: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False, server_default="false"
    )

    # Extensible preferences stored as JSON
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
