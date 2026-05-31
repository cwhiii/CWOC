import uuid
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UserScopedMixin


class SourceType(str, PyEnum):
    GUTENBERG = "gutenberg"
    STANDARD_EBOOKS = "standard_ebooks"
    UPLOAD = "upload"


class ProjectStatus(str, PyEnum):
    DRAFT = "draft"
    TYPESET = "typeset"
    COVER_READY = "cover_ready"
    PRINT_READY = "print_ready"
    ORDERED = "ordered"
    SHIPPED = "shipped"


class BookProject(Base, TimestampMixin, UserScopedMixin):
    __tablename__ = "book_projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str] = mapped_column(String(500), nullable=True)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, values_callable=lambda e: [x.value for x in e]),
        nullable=False,
    )
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    original_text_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    working_text_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    interior_pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, values_callable=lambda e: [x.value for x in e]),
        default=ProjectStatus.DRAFT,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    print_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Presentation inscription page (optional — user-customizable text or image between title and copyright)
    dedication_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    dedication_image_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Print options (per-book overrides; null = use user defaults)
    trim_size: Mapped[str | None] = mapped_column(String(20), nullable=True)
    paper_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    color_interior: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    cover_finish: Mapped[str | None] = mapped_column(String(20), nullable=True)
    binding_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    font_size: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Typography settings (per-book overrides; null = use defaults)
    body_font: Mapped[str | None] = mapped_column(String(200), nullable=True)
    heading_font: Mapped[str | None] = mapped_column(String(200), nullable=True)
    heading_size: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Drop cap settings (per-book overrides; null = disabled)
    dropcap_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True, server_default="false")
    dropcap_font: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dropcap_lines: Mapped[int | None] = mapped_column(Integer, nullable=True, server_default="3")
    dropcap_color: Mapped[str | None] = mapped_column(String(20), nullable=True, server_default="#000000")
    dropcap_weight: Mapped[str | None] = mapped_column(String(20), nullable=True, server_default="normal")
    dropcap_style: Mapped[str | None] = mapped_column(String(20), nullable=True, server_default="normal")
    dropcap_padding: Mapped[float | None] = mapped_column(Float, nullable=True, server_default="4.0")
