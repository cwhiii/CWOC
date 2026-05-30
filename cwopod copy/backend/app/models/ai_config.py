import uuid

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UserScopedMixin


class AIConfig(Base, TimestampMixin, UserScopedMixin):
    __tablename__ = "ai_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    text_provider: Mapped[str] = mapped_column(String(50), default="local")
    text_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_provider: Mapped[str] = mapped_column(String(50), default="local")
    image_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
