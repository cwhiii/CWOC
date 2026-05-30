# Design: Source Service Module

## Overview

The Source Service module provides federated book search, download, and upload capabilities for C.W.'s O-POD. It implements a plugin-based architecture where each source (Project Gutenberg, Standard Ebooks, user uploads) is encapsulated as a SourceProvider plugin. The module exposes three primary API endpoints: federated search, import from source, and file upload. All operations result in the creation of a BookProject entity that feeds into downstream modules (Quality Controller, Typeset Service).

The module is built on FastAPI with async HTTP clients (httpx) for parallel source queries, uses Pandoc for format normalization, and supports configurable file storage (local filesystem or S3-compatible object storage).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (FastAPI)                      │
│  GET /api/search  │  POST /api/projects/import  │  POST /api/projects/upload │
└────────┬──────────┴──────────────┬──────────────┴────────────┬───────────────┘
         │                         │                           │
         ▼                         ▼                           ▼
┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
│  SearchService  │    │   ImportService     │    │   UploadService      │
│  (parallel fan- │    │   (download +       │    │   (validate +        │
│   out to all    │    │    project create)   │    │    normalize +       │
│   providers)    │    │                     │    │    project create)    │
└────────┬────────┘    └──────────┬──────────┘    └──────────┬───────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Provider Registry                                 │
│  ┌──────────────────┐  ┌────────────────────────┐  ┌────────────────┐  │
│  │ GutenbergProvider│  │ StandardEbooksProvider │  │ UploadProvider │  │
│  └──────────────────┘  └────────────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Storage Abstraction                                │
│              (LocalStorage | S3Storage via config)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Parallel fan-out search**: All enabled providers are queried concurrently using `asyncio.gather()` with per-provider timeouts. Results are merged and deduplicated by title+author similarity.
2. **Provider registry pattern**: Providers self-register via a registry. New providers are added by implementing the interface and registering — no changes to core search/download logic.
3. **Pandoc normalization**: All uploaded formats are normalized to structured HTML (XHTML with semantic tags) via Pandoc subprocess, providing a consistent internal representation regardless of input format.
4. **Storage abstraction**: File storage is behind an interface, configured at startup. This allows local development with filesystem storage and production deployment with S3.

## Components and Interfaces

### SourceProvider (Abstract Base Class)

```python
from abc import ABC, abstractmethod
from typing import Optional

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

    @abstractmethod
    async def search(self, query: str, limit: int = 50) -> list["SearchResult"]:
        """
        Search this source for books matching the query.
        Searches title, author, and subject fields.
        Returns up to `limit` results.
        Raises ProviderUnavailableError if the source cannot be reached.
        """
        ...

    @abstractmethod
    async def download(self, source_id: str) -> "SourceDocument":
        """
        Download the full text and metadata for a book identified by source_id.
        Returns a SourceDocument containing text content, format, and metadata.
        Raises DownloadError if the download fails.
        """
        ...

    @abstractmethod
    async def get_metadata(self, source_id: str) -> "BookMetadata":
        """
        Retrieve metadata for a book without downloading the full text.
        Raises ProviderUnavailableError if the source cannot be reached.
        """
        ...
```

### ProviderRegistry

```python
class ProviderRegistry:
    """Registry for source provider plugins. Manages provider lifecycle and discovery."""

    def register(self, provider: SourceProvider) -> None:
        """Register a provider instance. Raises if provider_id already registered."""
        ...

    def get_enabled_providers(self) -> list[SourceProvider]:
        """Return all currently enabled providers."""
        ...

    def get_provider(self, provider_id: str) -> Optional[SourceProvider]:
        """Get a specific provider by ID. Returns None if not found or disabled."""
        ...

    def enable(self, provider_id: str) -> None:
        """Enable a provider by ID."""
        ...

    def disable(self, provider_id: str) -> None:
        """Disable a provider by ID (excluded from search, still registered)."""
        ...
```

### GutenbergProvider

```python
class GutenbergProvider(SourceProvider):
    """
    Source provider for Project Gutenberg.

    Search: Uses the Gutenberg search API endpoint or local catalog (RDF/XML).
    Download: Fetches .epub3.images format (preferred) or .txt.utf-8 fallback.
    Quality label: "community digitized"
    """

    provider_id = "gutenberg"
    display_name = "Project Gutenberg"
    quality_label = "community digitized"

    # Implementation details:
    # - Search endpoint: https://gutendex.com/books/?search={query}
    #   (Gutendex is the JSON API for Project Gutenberg catalog)
    # - Download URL pattern: https://www.gutenberg.org/ebooks/{id}.epub3.images
    # - Fallback: https://www.gutenberg.org/ebooks/{id}.txt.utf-8
    # - Metadata from Gutendex JSON response (title, authors, subjects, languages)
    # - Timeout: configurable, default 8 seconds for search, 30 seconds for download
```

### StandardEbooksProvider

```python
class StandardEbooksProvider(SourceProvider):
    """
    Source provider for Standard Ebooks.

    Search: Parses the OPDS catalog feed (Atom/XML) at https://standardebooks.org/opds
    Download: Fetches EPUB from the catalog entry's acquisition link.
    Quality label: "professionally curated and formatted"
    """

    provider_id = "standard_ebooks"
    display_name = "Standard Ebooks"
    quality_label = "professionally curated and formatted"

    # Implementation details:
    # - OPDS feed: https://standardebooks.org/opds
    # - Search via OPDS search endpoint or local catalog filtering
    # - Download: EPUB acquisition link from feed entry
    # - Metadata from Atom entry (title, author, published date, language, identifier)
    # - All Standard Ebooks texts are high-quality; flag for downstream typo-skip default
```

### UploadProvider

```python
class UploadProvider:
    """
    Handles user file uploads. Not a search provider — only processes uploaded files.

    Supported formats: EPUB, DOCX, TXT, PDF (max 200 MB)
    Processing pipeline:
    1. Validate file format (extension + magic bytes)
    2. Extract metadata (format-specific extraction)
    3. Normalize to internal format via Pandoc
    4. Extract and store images (EPUB)
    5. Create BookProject
    """

    SUPPORTED_FORMATS = {
        ".epub": "application/epub+zip",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
        ".pdf": "application/pdf",
    }
    MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB

    async def validate(self, file: UploadFile) -> ValidationResult:
        """Validate file format, size, and readability."""
        ...

    async def extract_metadata(self, file_path: Path, format: str) -> BookMetadata:
        """
        Extract metadata using format-specific libraries:
        - EPUB: ebooklib (reads OPF metadata)
        - DOCX: python-docx (reads document properties)
        - PDF: pypdf (reads document info dictionary)
        - TXT: no metadata extraction (returns empty BookMetadata)
        """
        ...

    async def normalize(self, file_path: Path, format: str) -> NormalizedDocument:
        """
        Convert to internal format using Pandoc subprocess.
        Pandoc command: pandoc -f {input_format} -t html --extract-media={media_dir} {input_file}
        Preserves document structure (headings, paragraphs, lists) and extracts images.
        """
        ...

    async def extract_images(self, file_path: Path) -> list[ExtractedImage]:
        """Extract embedded images from EPUB files using ebooklib."""
        ...
```

### SearchService

```python
class SearchService:
    """Orchestrates federated search across all enabled providers."""

    async def search(self, query: str, timeout: float = 10.0) -> FederatedSearchResponse:
        """
        Fan out search to all enabled providers in parallel.
        - Validates query length (>= 2 chars)
        - Queries all providers concurrently with per-provider timeout
        - Collects results, noting any provider failures
        - Deduplicates by title+author similarity
        - Returns combined results (max 50) with provider availability info
        """
        ...
```

### ImportService

```python
class ImportService:
    """Handles downloading from a source and creating a BookProject."""

    async def import_from_source(
        self, provider_id: str, source_id: str, user_id: str
    ) -> BookProject:
        """
        1. Resolve provider from registry
        2. Download full text (with retry logic: 3 attempts, exponential backoff)
        3. Extract/confirm metadata
        4. Store files via storage abstraction
        5. Create and return BookProject
        """
        ...
```

### UploadService

```python
class UploadService:
    """Handles file upload processing and BookProject creation."""

    async def process_upload(
        self, file: UploadFile, user_id: str
    ) -> BookProject:
        """
        1. Validate file (format, size, readability)
        2. Store raw upload
        3. Extract metadata
        4. Normalize via Pandoc
        5. Extract images (if EPUB)
        6. Create and return BookProject
        """
        ...
```

### StorageBackend (Abstract)

```python
class StorageBackend(ABC):
    """Abstract file storage interface."""

    @abstractmethod
    async def store(self, key: str, data: bytes, content_type: str) -> str:
        """Store data and return the storage path/URL."""
        ...

    @abstractmethod
    async def retrieve(self, key: str) -> bytes:
        """Retrieve data by key."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete data by key."""
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if a key exists in storage."""
        ...


class LocalStorage(StorageBackend):
    """Filesystem-based storage. Stores files under a configurable base directory."""
    ...


class S3Storage(StorageBackend):
    """S3-compatible object storage. Uses boto3/aioboto3 for async operations."""
    ...
```

## Data Models

### SearchResult

```python
@dataclass
class SearchResult:
    source_id: str              # Provider-specific identifier
    provider_id: str            # Which provider this result came from
    provider_name: str          # Display name of the provider
    quality_label: str          # Quality/curation label
    title: str                  # Book title
    author: str                 # Author name(s)
    language: str               # Language code (e.g., "en")
    publication_year: Optional[int]  # Year of original publication
    subjects: list[str]         # Subject/genre tags
    available_formats: list[str]  # Available download formats
    source_url: str             # URL to the book on the source website
```

### BookMetadata

```python
@dataclass
class BookMetadata:
    title: Optional[str]
    author: Optional[str]
    publication_date: Optional[str]  # ISO 8601 date string
    language: Optional[str]          # ISO 639-1 language code
    source_url: Optional[str]
    source_provider: Optional[str]   # Provider ID
    source_id: Optional[str]         # Provider-specific book ID
    license_text: Optional[str]      # Source license/legal text (e.g., Gutenberg license)
    subjects: list[str] = field(default_factory=list)
```

### SourceDocument

```python
@dataclass
class SourceDocument:
    content: bytes              # Raw file content
    format: str                 # File format (epub, txt, html)
    metadata: BookMetadata      # Extracted metadata
    images: list[ExtractedImage]  # Extracted images (if any)
```

### ExtractedImage

```python
@dataclass
class ExtractedImage:
    filename: str               # Original filename
    content_type: str           # MIME type (image/png, image/jpeg, etc.)
    data: bytes                 # Image binary data
    placement_ref: Optional[str]  # Reference to position in text (e.g., chapter/paragraph ID)
```

### BookProject (Database Model)

```python
class BookProject(Base):
    __tablename__ = "book_projects"

    id: str                     # UUID primary key
    user_id: str                # Foreign key to users table
    title: Optional[str]        # Book title (from metadata or manual entry)
    author: Optional[str]       # Author name
    publication_date: Optional[str]
    language: Optional[str]
    source_provider: Optional[str]  # Provider ID (gutenberg, standard_ebooks, upload)
    source_id: Optional[str]    # Provider-specific identifier
    source_url: Optional[str]   # URL to original source
    quality_label: Optional[str]  # Quality label from source
    license_text: Optional[str] # Preserved license/legal text
    storage_path: str           # Base path in storage for this project's files
    raw_file_key: str           # Storage key for the original downloaded/uploaded file
    normalized_file_key: Optional[str]  # Storage key for Pandoc-normalized output
    status: str                 # draft, processing, ready, error
    chapter_count: Optional[int]  # Number of detected chapters/sections
    image_count: int = 0        # Number of extracted images
    file_size_bytes: int        # Size of the original file
    created_at: datetime
    updated_at: datetime
```

### NormalizedDocument

```python
@dataclass
class NormalizedDocument:
    html_content: str           # Pandoc-generated XHTML
    chapters: list[Chapter]     # Detected chapter divisions
    images: list[ExtractedImage]  # Images extracted during normalization
    word_count: int             # Total word count
```

### API Request/Response Models

```python
# GET /api/search?q={query}
class SearchRequest:
    q: str                      # Search query (min 2 chars)
    providers: Optional[list[str]]  # Filter to specific providers (optional)

class SearchResponse:
    results: list[SearchResult]
    total_count: int
    providers_queried: list[str]
    providers_failed: list[ProviderStatus]  # Providers that failed with reason

class ProviderStatus:
    provider_id: str
    provider_name: str
    status: str                 # "ok", "timeout", "error"
    error_message: Optional[str]

# POST /api/projects/import
class ImportRequest:
    provider_id: str            # Which provider to download from
    source_id: str              # Provider-specific book identifier

class ImportResponse:
    project_id: str
    title: Optional[str]
    author: Optional[str]
    chapter_count: Optional[int]
    status: str

# POST /api/projects/upload
# (multipart/form-data with file field)
class UploadResponse:
    project_id: str
    title: Optional[str]        # Extracted or filename
    author: Optional[str]
    chapter_count: Optional[int]
    image_count: int
    file_size_bytes: int
    status: str
```

## Correctness Properties

### Property 1: Federated Search Completeness

For any search query Q of length >= 2, the search response must contain results from all reachable providers, and the total result count must not exceed 50. If a provider is unreachable, it must appear in the `providers_failed` list with a non-empty error message.

**Validates: Requirements 1.1, 1.6**

### Property 2: Search Response Time Bound

For any search query, the total response time from request receipt to response delivery must not exceed 10 seconds, regardless of individual provider response times. Providers that exceed their individual timeout (default 8 seconds) are treated as failed.

**Validates: Requirements 1.1, 1.7**

### Property 3: Quality Label Accuracy

Every SearchResult returned must have a non-empty `quality_label` field that matches the label declared by its source provider. Standard Ebooks results must always carry the label "professionally curated and formatted". Project Gutenberg results must always carry the label "community digitized".

**Validates: Requirements 1.3, 2.4**

### Property 4: Provider Isolation

Adding, removing, enabling, or disabling a provider must not affect the behavior of other registered providers. A failing provider must not cause other providers' results to be lost or delayed beyond their own timeout.

**Validates: Requirements 2.3, 1.6**

### Property 5: Download Idempotency

Importing the same book (same provider_id + source_id) multiple times by the same user must create separate BookProject instances each time (no deduplication at import level), and each must contain identical content and metadata.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 6: Metadata Preservation

For any successfully imported or uploaded book, all metadata fields that were present in the source must be preserved in the resulting BookProject. No metadata field may be silently dropped or truncated.

**Validates: Requirements 3.2, 4.4, 4.7**

### Property 7: Upload Format Validation

For any uploaded file, the system must either: (a) accept it and produce a valid BookProject with status "ready" or "processing", or (b) reject it with a structured error response. No upload may result in a partial or corrupt BookProject.

**Validates: Requirements 4.1, 4.2, 4.5, 4.6, 5.5**

### Property 8: Image Preservation from EPUB

For any EPUB file containing N embedded images, after upload processing, the resulting BookProject must reference exactly N extracted images, each with valid binary data and a content type matching the original image format.

**Validates: Requirements 4.3**

### Property 9: Storage Consistency

For any successfully created BookProject, the `raw_file_key` must reference a file that exists in the storage backend and contains the exact bytes of the original downloaded/uploaded file. If storage fails, no BookProject is created.

**Validates: Requirements 5.1, 5.4, 5.5**

### Property 10: Error Response Structure

Every error response from any Source Service API endpoint must contain a JSON body with fields: `error_code` (non-empty string), `message` (non-empty string), and `details` (string or null). No error may return an unstructured response.

**Validates: Requirements 6.5**

## Error Handling

### Search Errors

| Error Condition | Behavior | Error Code |
|---|---|---|
| Query too short (< 2 chars) | Reject with 400 | `QUERY_TOO_SHORT` |
| All providers unreachable | Return empty results + all providers in failed list | `ALL_PROVIDERS_FAILED` |
| Some providers unreachable | Return partial results + failed providers noted | (not an error — 200 with degraded results) |
| Internal search error | Return 500 with error details | `SEARCH_INTERNAL_ERROR` |

### Download/Import Errors

| Error Condition | Behavior | Error Code |
|---|---|---|
| Provider not found | Reject with 404 | `PROVIDER_NOT_FOUND` |
| Source ID not found | Reject with 404 | `SOURCE_NOT_FOUND` |
| Download timeout (30s) | Fail after retries, return 504 | `DOWNLOAD_TIMEOUT` |
| Network error during download | Retry up to 3 times, then fail with 502 | `DOWNLOAD_FAILED` |
| Empty/unparseable content | Reject with 422 | `CONTENT_INVALID` |
| Storage failure | Reject with 500 | `STORAGE_ERROR` |

### Upload Errors

| Error Condition | Behavior | Error Code |
|---|---|---|
| Unsupported format | Reject with 415 | `UNSUPPORTED_FORMAT` |
| File too large (> 200 MB) | Reject with 413 | `FILE_TOO_LARGE` |
| Corrupt/unreadable file | Reject with 422 | `FILE_CORRUPT` |
| Pandoc normalization failure | Reject with 422 | `NORMALIZATION_FAILED` |
| Storage failure | Reject with 500 | `STORAGE_ERROR` |
| Missing metadata | Accept (not an error) — fields left empty | — |

### Retry Strategy

Download operations use exponential backoff for transient failures:
- Attempt 1: immediate
- Attempt 2: after 1 second
- Attempt 3: after 3 seconds
- After 3 failures: report error to user

Retries are only applied to network-level errors (connection refused, timeout, 5xx responses). Client errors (4xx) are not retried.

## Testing Strategy

### Unit Tests

1. **SourceProvider interface compliance**: Verify each provider implements all required methods and properties correctly.
2. **GutenbergProvider search parsing**: Test parsing of Gutendex JSON responses with various result shapes (empty, single, multiple, malformed).
3. **GutenbergProvider download**: Test download URL construction and content retrieval with mocked HTTP responses.
4. **StandardEbooksProvider OPDS parsing**: Test parsing of Atom/XML feed entries with various metadata completeness levels.
5. **StandardEbooksProvider download**: Test EPUB acquisition link extraction and download with mocked responses.
6. **UploadProvider validation**: Test format detection (magic bytes + extension) for all supported and unsupported formats.
7. **UploadProvider metadata extraction**: Test metadata extraction from EPUB (ebooklib), DOCX (python-docx), PDF (pypdf), and TXT (empty result).
8. **UploadProvider normalization**: Test Pandoc subprocess invocation and output parsing for each format.
9. **UploadProvider image extraction**: Test image extraction from EPUB files with various image types and counts.
10. **SearchService deduplication**: Test that duplicate titles from multiple providers are properly merged.
11. **SearchService timeout handling**: Test that slow providers are timed out without blocking fast providers.
12. **StorageBackend implementations**: Test LocalStorage and S3Storage for store/retrieve/delete/exists operations.
13. **Error response formatting**: Verify all error paths produce correctly structured error responses.

### Integration Tests

1. **Federated search end-to-end**: Test the full search flow with mocked provider HTTP endpoints, verifying parallel execution, result merging, and timeout handling.
2. **Import flow end-to-end**: Test downloading from a mocked Gutenberg/Standard Ebooks endpoint, storing the file, and creating a BookProject with correct metadata.
3. **Upload flow end-to-end**: Test uploading each supported format, verifying validation, metadata extraction, normalization, and BookProject creation.
4. **Storage backend switching**: Test that the same operations work correctly with both LocalStorage and S3Storage (using localstack or minio for S3 tests).
5. **Provider registry dynamics**: Test enabling/disabling providers and verifying search behavior changes accordingly.
6. **Error propagation**: Test that provider failures, storage failures, and validation failures all produce correct API error responses.
7. **Concurrent search resilience**: Test that multiple simultaneous search requests are handled correctly without race conditions.

### Property-Based Tests

1. **Search result count invariant**: For any query, result count is always 0 <= count <= 50.
2. **Quality label consistency**: For any search result, the quality_label matches the provider's declared label.
3. **Upload round-trip**: For any valid file, upload → retrieve raw file produces identical bytes.
4. **Metadata extraction completeness**: For any file with known metadata, all present fields are extracted (no silent drops).

