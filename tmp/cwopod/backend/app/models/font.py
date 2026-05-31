"""Font models: user fonts, favorites, and recent selections."""

import enum
import logging
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

logger = logging.getLogger(__name__)


class FontSource(str, enum.Enum):
    """Source of a font."""

    PRINT = "print"
    GOOGLE = "google"
    UPLOAD = "upload"


class UserFont(Base, TimestampMixin):
    """A font uploaded or downloaded by a user."""

    __tablename__ = "user_fonts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    font_family: Mapped[str] = mapped_column(String(200), nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[FontSource] = mapped_column(
        SAEnum(FontSource, values_callable=lambda e: [x.value for x in e]),
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "font_family", name="uq_user_fonts_user_family"),
    )


class UserFontFavorite(Base, TimestampMixin):
    """A font marked as a favorite by a user."""

    __tablename__ = "user_font_favorites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    font_identifier: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "font_identifier", name="uq_user_font_favorites_user_font"),
    )


class UserFontRecent(Base, TimestampMixin):
    """A font recently selected by a user."""

    __tablename__ = "user_font_recent"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    font_identifier: Mapped[str] = mapped_column(String(200), nullable=False)
    selected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "font_identifier", name="uq_user_font_recent_user_font"),
    )
