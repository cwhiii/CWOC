import uuid

from sqlalchemy import Boolean, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CoverPrompt(Base, TimestampMixin):
    __tablename__ = "cover_prompts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected: Mapped[bool] = mapped_column(Boolean, default=False)


class CoverLayout(Base, TimestampMixin):
    __tablename__ = "cover_layouts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    template_id: Mapped[str] = mapped_column(Text, nullable=False)
    layout_json: Mapped[dict] = mapped_column(JSONB, default=dict)


class CoverSession(Base, TimestampMixin):
    """Tracks cover generation sessions and enforces regeneration limits."""

    __tablename__ = "cover_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    regeneration_count: Mapped[int] = mapped_column(Integer, default=0)
    max_regenerations: Mapped[int] = mapped_column(Integer, default=20)
    active_task_id: Mapped[str | None] = mapped_column(Text, nullable=True)
