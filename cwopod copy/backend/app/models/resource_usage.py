"""Resource usage tracking model — records compute usage per operation per project."""

import uuid
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OperationType(str, PyEnum):
    """Types of compute-intensive operations we track."""
    TYPESET = "typeset"
    COVER_GENERATE = "cover_generate"
    COVER_ASSEMBLE = "cover_assemble"
    SPELLCHECK = "spellcheck"
    ILLUSTRATION = "illustration"
    IMPORT = "import"
    OTHER = "other"


class ResourceUsage(Base, TimestampMixin):
    """Records resource consumption for a single operation.

    Each row = one operation (e.g., one typeset run, one cover image generation).
    Tracks wall time, CPU time, peak RAM, and GPU time where applicable.
    """
    __tablename__ = "resource_usage"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    operation: Mapped[OperationType] = mapped_column(
        Enum(OperationType, values_callable=lambda e: [x.value for x in e]),
        nullable=False, index=True,
    )
    # Timing
    wall_time_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cpu_time_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    gpu_time_seconds: Mapped[float] = mapped_column(Float, nullable=True)

    # Memory (in MB)
    peak_ram_mb: Mapped[float] = mapped_column(Float, nullable=True)
    peak_gpu_ram_mb: Mapped[float] = mapped_column(Float, nullable=True)

    # Provider info (which AI provider was used)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Optional notes (e.g., "page_count=342", "images=4")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
