"""Source service base classes: provider interface and data models."""

from abc import ABC, abstractmethod

# Re-export models and exceptions for backward compatibility.
# New code should import directly from models.py and exceptions.py.
from app.services.source_service.exceptions import (  # noqa: F401
    DownloadError,
    ProviderUnavailableError,
    ValidationError,
)
from app.services.source_service.models import (  # noqa: F401
    BookMetadata,
    ExtractedImage,
    SearchResult,
    SourceDocument,
)


class SourceProvider(ABC):
    """Abstract base class for all source providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier for this provider (e.g., 'gutenberg', 'standard_ebooks')."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable name for display in UI."""
        ...

    @property
    @abstractmethod
    def quality_label(self) -> str:
        """Quality/curation label (e.g., 'professionally curated and formatted')."""
        ...

    @property
    def is_high_quality(self) -> bool:
        """Whether this source should skip typo correction by default."""
        return False

    @abstractmethod
    async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
        """
        Search this source for books matching the query.
        Searches title, author, and subject fields.
        Returns up to `limit` results.
        Raises ProviderUnavailableError if the source cannot be reached.
        """
        ...

    @abstractmethod
    async def download(self, source_id: str) -> SourceDocument:
        """
        Download the full text and metadata for a book identified by source_id.
        Returns a SourceDocument containing text content, format, and metadata.
        Raises DownloadError if the download fails.
        """
        ...

    @abstractmethod
    async def get_metadata(self, source_id: str) -> BookMetadata:
        """
        Retrieve metadata for a book without downloading the full text.
        Raises ProviderUnavailableError if the source cannot be reached.
        """
        ...
