"""System-wide settings (singleton row, not per-user)."""

import uuid
from typing import Optional

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SystemSettings(Base, TimestampMixin):
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    allow_public_registration: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    default_text_model: Mapped[str] = mapped_column(
        String(200), default="llama3.2:1b", server_default="llama3.2:1b"
    )
    default_image_model: Mapped[str] = mapped_column(
        String(200),
        default="v1-5-pruned-emaonly.safetensors",
        server_default="v1-5-pruned-emaonly.safetensors",
    )
    profanity_word_list: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
