"""Gutenberg catalog cache model — local copy of title/author/year for instant search."""

import uuid

from sqlalchemy import Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GutenbergBook(Base, TimestampMixin):
    """Cached metadata for a Project Gutenberg book.

    Stores just enough info for instant local search + random selection.
    Full content is still fetched from Gutenberg on demand.
    """

    __tablename__ = "gutenberg_books"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    gutenberg_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    publication_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subjects: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array as text
    media_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    download_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        # Trigram indexes for fuzzy search (requires pg_trgm extension)
        Index("ix_gutenberg_books_title_trgm", "title", postgresql_using="gin",
              postgresql_ops={"title": "gin_trgm_ops"}),
        Index("ix_gutenberg_books_author_trgm", "author", postgresql_using="gin",
              postgresql_ops={"author": "gin_trgm_ops"}),
    )
