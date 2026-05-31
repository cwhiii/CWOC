"""Data models for the source service module."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ValidationErrorCode(str, Enum):
    """Error codes for file validation failures."""

    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    MAGIC_BYTES_MISMATCH = "MAGIC_BYTES_MISMATCH"
    FILE_CORRUPT = "FILE_CORRUPT"


@dataclass
class ValidationResult:
    """Result of file validation, indicating success or failure with details."""

    is_valid: bool
    error_code: Optional[ValidationErrorCode] = None
    error_message: Optional[str] = None
    detected_format: Optional[str] = None  # The validated file extension (e.g., ".epub")
    file_size_bytes: int = 0


@dataclass
class BookMetadata:
    """Structured metadata about a book."""

    title: Optional[str] = None
    author: Optional[str] = None
    publication_date: Optional[str] = None  # ISO 8601 date string
    language: Optional[str] = None  # ISO 639-1 language code
    source_url: Optional[str] = None
    source_provider: Optional[str] = None  # Provider ID
    source_id: Optional[str] = None  # Provider-specific book ID
    license_text: Optional[str] = None  # Source license/legal text
    original_publisher: Optional[str] = None
    publication_year: Optional[str] = None
    edition: Optional[str] = None
    subjects: list[str] = field(default_factory=list)


@dataclass
class SearchResult:
    """A single result item returned from a federated search query."""

    source_id: str  # Provider-specific identifier
    provider_id: str  # Which provider this result came from
    provider_name: str  # Display name of the provider
    quality_label: str  # Quality/curation label
    title: str  # Book title
    author: str  # Author name(s)
    language: str = "en"  # Language code (e.g., "en")
    publication_year: Optional[int] = None  # Year of original publication
    subjects: list[str] = field(default_factory=list)  # Subject/genre tags
    available_formats: list[str] = field(default_factory=list)  # Available download formats
    source_url: str = ""  # URL to the book on the source website
    media_type: Optional[str] = None  # Media type (e.g., "Text", "Sound") to distinguish editions
    download_count: Optional[int] = None  # Popularity/download count from the source


@dataclass
class ExtractedImage:
    """An image extracted from an EPUB or other document."""

    filename: str  # Original filename
    content_type: str  # MIME type (image/png, image/jpeg, etc.)
    data: bytes  # Image binary data
    placement_ref: Optional[str] = None  # Reference to position in text


@dataclass
class SourceDocument:
    """The full text content and associated metadata downloaded from a source."""

    content: bytes  # Raw file content
    format: str  # File format (epub, txt, html)
    metadata: BookMetadata  # Extracted metadata
    images: list[ExtractedImage] = field(default_factory=list)  # Extracted images


@dataclass
class Chapter:
    """A detected chapter or section in a normalized document."""

    title: str  # Chapter heading text
    level: int  # Heading level (1 for h1, 2 for h2)
    start_index: int = 0  # Character offset in the HTML content


@dataclass
class NormalizationResult:
    """Result of Pandoc format normalization."""

    html_content: str  # Pandoc-generated HTML output
    chapters: list[Chapter] = field(default_factory=list)  # Detected chapter divisions
    section_count: int = 0  # Total number of sections detected
    images: list[ExtractedImage] = field(default_factory=list)  # Images extracted during normalization
