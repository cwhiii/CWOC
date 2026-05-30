# Implementation Plan: Source Service Module

## Overview

This plan covers the implementation of the Source Service module, which provides federated book search across Project Gutenberg and Standard Ebooks, download/import functionality, user file uploads, and configurable file storage. The module uses a plugin architecture for source providers and exposes REST API endpoints for all operations.

Technology stack: Python 3.11+, FastAPI, httpx (async HTTP), ebooklib, python-docx, pypdf, Pandoc (subprocess), boto3/aioboto3 (S3), SQLAlchemy (async).

## Tasks

- [x] 1. Define SourceProvider interface and provider registry
  - [x] 1.1 Create the SourceProvider abstract base class
    - Create `backend/app/services/source_service/__init__.py`
    - Create `backend/app/services/source_service/base.py` with the `SourceProvider` ABC defining: `provider_id`, `display_name`, `quality_label` properties, and `search()`, `download()`, `get_metadata()` abstract methods
    - Define data classes: `SearchResult`, `SourceDocument`, `BookMetadata`, `ExtractedImage` in `backend/app/services/source_service/models.py`
    - Define custom exceptions: `ProviderUnavailableError`, `DownloadError`, `ValidationError` in `backend/app/services/source_service/exceptions.py`
    - _Requirements: 2.1, 2.4_

  - [x] 1.2 Implement the ProviderRegistry
    - Create `backend/app/services/source_service/registry.py` with the `ProviderRegistry` class
    - Implement `register()`, `get_enabled_providers()`, `get_provider()`, `enable()`, `disable()` methods
    - Load enabled/disabled state from application config (environment variable or config file)
    - Register all built-in providers at application startup in `backend/app/services/source_service/__init__.py`
    - _Requirements: 2.2, 2.3, 2.5_

- [x] 2. Implement GutenbergProvider (search + download)
  - [x] 2.1 Implement Gutenberg search
    - Create `backend/app/services/source_service/providers/gutenberg.py`
    - Implement `search()` method using the Gutendex API (`https://gutendex.com/books/?search={query}`)
    - Parse JSON response into `SearchResult` objects (map: id, title, authors, subjects, languages, formats)
    - Handle pagination from Gutendex (fetch first page only, up to 50 results)
    - Set `quality_label` to "community digitized" on all results
    - Implement configurable timeout (default 8 seconds) using httpx async client
    - Raise `ProviderUnavailableError` on connection errors or timeouts
    - _Requirements: 1.1, 1.3, 1.6, 1.7_

  - [x] 2.2 Implement Gutenberg download
    - Implement `download()` method that fetches the book content by Gutenberg ID
    - Prefer `.epub3.images` format; fall back to `.epub.images`, then `.txt.utf-8`
    - Construct download URLs from the Gutendex `formats` field
    - Implement 30-second download timeout
    - Implement retry logic: 3 attempts with exponential backoff (0s, 1s, 3s) for transient errors
    - Extract metadata from the Gutendex API response (title, author, publication date, language, source URL)
    - Preserve Gutenberg license text if present in the downloaded content
    - Raise `DownloadError` on failure after retries
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 6.4_

  - [x] 2.3 Implement Gutenberg get_metadata
    - Implement `get_metadata()` method using Gutendex API (`https://gutendex.com/books/{id}`)
    - Parse response into `BookMetadata` dataclass
    - Handle missing fields gracefully (return None for absent fields)
    - _Requirements: 3.2_

- [x] 3. Implement StandardEbooksProvider (search + download)
  - [x] 3.1 Implement Standard Ebooks search
    - Create `backend/app/services/source_service/providers/standard_ebooks.py`
    - Implement `search()` method using the OPDS catalog feed (`https://standardebooks.org/opds`)
    - Parse Atom/XML feed entries using `xml.etree.ElementTree` or `lxml`
    - Filter entries by matching query against title, author, and subject fields (case-insensitive substring match)
    - Map feed entries to `SearchResult` objects (extract: id, title, author, language, subjects, acquisition links)
    - Set `quality_label` to "professionally curated and formatted" on all results
    - Implement local caching of the OPDS feed (refresh every 24 hours) to avoid repeated downloads
    - Implement configurable timeout (default 8 seconds)
    - Raise `ProviderUnavailableError` on connection errors or timeouts
    - _Requirements: 1.1, 1.3, 1.6, 1.7_

  - [x] 3.2 Implement Standard Ebooks download
    - Implement `download()` method that fetches the EPUB from the acquisition link in the catalog entry
    - Parse the OPDS entry to find the EPUB download URL (look for `application/epub+zip` link)
    - Implement 30-second download timeout
    - Implement retry logic: 3 attempts with exponential backoff for transient errors
    - Extract metadata from the OPDS entry (title, author, published date, language, identifier as source URL)
    - Flag the source as high-quality for downstream typo-skip default
    - Raise `DownloadError` on failure after retries
    - _Requirements: 3.1, 3.2, 3.4, 6.4_

  - [x] 3.3 Implement Standard Ebooks get_metadata
    - Implement `get_metadata()` method by looking up the book in the cached OPDS feed
    - Parse entry into `BookMetadata` dataclass
    - Handle missing fields gracefully
    - _Requirements: 3.2_

- [x] 4. Implement UploadProvider (file validation, metadata extraction, format normalization)
  - [x] 4.1 Implement file validation
    - Create `backend/app/services/source_service/providers/upload.py`
    - Implement `validate()` method that checks:
      - File extension is one of: .epub, .docx, .txt, .pdf
      - File magic bytes match expected content type (use `python-magic` or manual byte checks)
      - File size does not exceed 200 MB
      - File is readable/not corrupt (attempt to open with appropriate library)
    - Return structured `ValidationResult` with success/failure and error details
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 6.3_

  - [x] 4.2 Implement metadata extraction
    - Implement `extract_metadata()` with format-specific logic:
      - EPUB: use `ebooklib` to read OPF metadata (dc:title, dc:creator, dc:date, dc:language)
      - DOCX: use `python-docx` to read core properties (title, author, created date)
      - PDF: use `pypdf` to read document info dictionary (/Title, /Author, /CreationDate)
      - TXT: return empty `BookMetadata` (no metadata available)
    - Handle missing or malformed metadata gracefully (return None for absent fields)
    - _Requirements: 4.4, 4.7_

  - [x] 4.3 Implement format normalization via Pandoc
    - Implement `normalize()` method that invokes Pandoc as a subprocess
    - Construct Pandoc command: `pandoc -f {format} -t html --extract-media={media_dir} -o {output} {input}`
    - Map input formats to Pandoc format identifiers (epub, docx, plain text as markdown, pdf via pdftotext preprocessing)
    - Parse Pandoc HTML output to detect chapters (h1/h2 headings) and count sections
    - Handle Pandoc errors (non-zero exit code, stderr output) and raise `NormalizationError`
    - For PDF: preprocess with `pdftotext` (poppler-utils) to extract text, then normalize the text
    - _Requirements: 4.9_

  - [x] 4.4 Implement image extraction from EPUB
    - Implement `extract_images()` using `ebooklib` to iterate over image items in the EPUB
    - Extract each image's filename, content type, and binary data
    - Determine image placement by parsing the EPUB spine and finding image references in HTML content
    - Return list of `ExtractedImage` objects with placement references
    - _Requirements: 4.3_

- [x] 5. Implement search API endpoint (federated, parallel queries)
  - [x] 5.1 Create the SearchService
    - Create `backend/app/services/source_service/search_service.py`
    - Implement `search()` method that:
      - Validates query length (>= 2 characters, return 400 if too short)
      - Gets all enabled providers from the registry
      - Fans out search to all providers using `asyncio.gather()` with `return_exceptions=True`
      - Applies per-provider timeout (default 8 seconds)
      - Collects successful results and notes failed providers
      - Deduplicates results by title+author similarity (normalize and compare)
      - Limits total results to 50
      - Returns `FederatedSearchResponse` with results, counts, and provider statuses
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [x] 5.2 Create the search API route
    - Create or update `backend/app/routers/search.py` with `GET /api/search` endpoint
    - Accept query parameter `q` (required, min 2 chars) and optional `providers` filter
    - Call `SearchService.search()` and return the response as JSON
    - Handle and format errors using structured error response format
    - Add request validation with Pydantic models
    - _Requirements: 1.1, 1.4, 6.5_

- [x] 6. Implement import endpoint (download from source, create project)
  - [x] 6.1 Create the ImportService
    - Create `backend/app/services/source_service/import_service.py`
    - Implement `import_from_source()` method that:
      - Resolves the provider from the registry (raise 404 if not found)
      - Calls `provider.download(source_id)` to get the `SourceDocument`
      - Validates the downloaded content is non-empty and parseable
      - Stores the raw file via the storage backend
      - Runs Pandoc normalization on the downloaded content
      - Stores the normalized output
      - Creates a `BookProject` database record with all metadata
      - Returns the created BookProject
    - Implement retry logic wrapper for the download step
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2, 6.4_

  - [x] 6.2 Create the import API route
    - Add `POST /api/projects/import` endpoint to `backend/app/routers/projects.py`
    - Accept JSON body with `provider_id` and `source_id` fields
    - Require authentication (user must be logged in)
    - Call `ImportService.import_from_source()` with the authenticated user's ID
    - Return `ImportResponse` with project details
    - Handle errors: provider not found (404), download failed (502/504), content invalid (422), storage error (500)
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 6.5_

- [x] 7. Implement upload endpoint (file handling, validation, project creation)
  - [x] 7.1 Create the UploadService
    - Create `backend/app/services/source_service/upload_service.py`
    - Implement `process_upload()` method that:
      - Calls `UploadProvider.validate()` to check format, size, and readability
      - Stores the raw uploaded file via storage backend
      - Calls `UploadProvider.extract_metadata()` to get available metadata
      - Calls `UploadProvider.normalize()` to convert to internal format
      - Calls `UploadProvider.extract_images()` for EPUB files
      - Stores normalized output and extracted images
      - Creates a `BookProject` database record
      - Returns the created BookProject with confirmation details
    - Handle each failure mode and clean up partial storage on error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 7.2 Create the upload API route
    - Add `POST /api/projects/upload` endpoint to `backend/app/routers/projects.py`
    - Accept multipart/form-data with a `file` field
    - Implement early size rejection (check Content-Length header before reading full body)
    - Require authentication (user must be logged in)
    - Call `UploadService.process_upload()` with the file and user ID
    - Return `UploadResponse` with project details (title, author, chapter count, image count, file size)
    - Handle errors: unsupported format (415), file too large (413), corrupt file (422), normalization failed (422), storage error (500)
    - _Requirements: 4.1, 4.5, 4.6, 4.8, 6.3, 6.5_

- [x] 8. Implement file storage abstraction (local + S3)
  - [x] 8.1 Create the StorageBackend interface and LocalStorage implementation
    - Create `backend/app/services/source_service/storage/__init__.py`
    - Create `backend/app/services/source_service/storage/base.py` with `StorageBackend` ABC (store, retrieve, delete, exists methods)
    - Create `backend/app/services/source_service/storage/local.py` with `LocalStorage` implementation
    - Organize files by project ID: `{base_dir}/{project_id}/raw/{filename}`, `{base_dir}/{project_id}/normalized/{filename}`, `{base_dir}/{project_id}/images/{filename}`
    - Handle filesystem errors (permission denied, disk full) with appropriate exceptions
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 8.2 Create the S3Storage implementation
    - Create `backend/app/services/source_service/storage/s3.py` with `S3Storage` implementation
    - Use `aioboto3` for async S3 operations
    - Configure from environment variables: `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`
    - Use same key structure as LocalStorage: `{project_id}/raw/{filename}`, etc.
    - Handle S3 errors (bucket not found, access denied, network error) with appropriate exceptions
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 8.3 Create storage factory and configuration
    - Create `backend/app/services/source_service/storage/factory.py` with a `create_storage_backend()` factory function
    - Read `STORAGE_BACKEND` environment variable ("local" or "s3") to determine which implementation to instantiate
    - For local: read `STORAGE_LOCAL_PATH` for the base directory (default: `./data/storage`)
    - For S3: read S3 configuration variables
    - Instantiate and return the appropriate backend as a singleton for the application lifecycle
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. Write unit tests for each provider
  - [x] 9.1 Unit tests for GutenbergProvider
    - Create `backend/tests/services/source_service/test_gutenberg_provider.py`
    - Test search: mock Gutendex API responses (empty results, single result, multiple results, malformed JSON)
    - Test search: verify SearchResult fields are correctly mapped from Gutendex response
    - Test search: verify timeout raises ProviderUnavailableError
    - Test download: mock successful EPUB download, verify SourceDocument content and metadata
    - Test download: mock fallback from epub3.images to txt.utf-8
    - Test download: mock network failure, verify retry behavior (3 attempts)
    - Test download: mock timeout after retries, verify DownloadError raised
    - Test get_metadata: mock API response, verify BookMetadata fields
    - _Requirements: 1.1, 1.6, 3.1, 3.2, 3.4, 6.4_

  - [x] 9.2 Unit tests for StandardEbooksProvider
    - Create `backend/tests/services/source_service/test_standard_ebooks_provider.py`
    - Test search: mock OPDS feed XML (empty feed, single entry, multiple entries)
    - Test search: verify SearchResult fields are correctly parsed from Atom entries
    - Test search: verify case-insensitive matching on title, author, subject
    - Test search: verify timeout raises ProviderUnavailableError
    - Test download: mock EPUB download from acquisition link, verify SourceDocument
    - Test download: mock network failure, verify retry behavior
    - Test get_metadata: verify BookMetadata parsed from OPDS entry
    - Test feed caching: verify feed is not re-fetched within cache TTL
    - _Requirements: 1.1, 1.6, 3.1, 3.2, 3.4, 6.4_

  - [x] 9.3 Unit tests for UploadProvider
    - Create `backend/tests/services/source_service/test_upload_provider.py`
    - Test validation: valid EPUB, DOCX, TXT, PDF files pass validation
    - Test validation: unsupported format (.zip, .html, .mobi) rejected with correct error
    - Test validation: file exceeding 200 MB rejected
    - Test validation: corrupt EPUB (invalid zip) rejected with FILE_CORRUPT error
    - Test validation: magic bytes mismatch (e.g., .epub extension but not a zip file) rejected
    - Test metadata extraction: EPUB with full OPF metadata returns complete BookMetadata
    - Test metadata extraction: DOCX with document properties returns correct fields
    - Test metadata extraction: PDF with document info returns correct fields
    - Test metadata extraction: TXT returns empty BookMetadata
    - Test metadata extraction: file with no metadata returns all-None BookMetadata
    - Test normalization: mock Pandoc subprocess, verify correct command construction for each format
    - Test normalization: mock Pandoc failure (non-zero exit), verify NormalizationError raised
    - Test image extraction: EPUB with 3 images returns 3 ExtractedImage objects with correct data
    - Test image extraction: EPUB with no images returns empty list
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9_

  - [x] 9.4 Unit tests for SearchService and services
    - Create `backend/tests/services/source_service/test_search_service.py`
    - Test: query < 2 chars returns 400 error
    - Test: all providers return results, verify merged and deduplicated output
    - Test: one provider fails, verify partial results returned with failed provider noted
    - Test: all providers fail, verify empty results with all providers in failed list
    - Test: result count never exceeds 50
    - Test: slow provider is timed out, fast provider results still returned
    - Test deduplication: same book from two providers appears once with both providers listed
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7_

  - [x] 9.5 Unit tests for storage backends
    - Create `backend/tests/services/source_service/test_storage.py`
    - Test LocalStorage: store, retrieve, delete, exists operations
    - Test LocalStorage: store creates directory structure automatically
    - Test LocalStorage: retrieve non-existent key raises appropriate error
    - Test LocalStorage: disk full simulation raises StorageError
    - Test S3Storage: store, retrieve, delete, exists with mocked boto3 client
    - Test S3Storage: connection error raises StorageError
    - Test storage factory: creates LocalStorage when STORAGE_BACKEND=local
    - Test storage factory: creates S3Storage when STORAGE_BACKEND=s3
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Write integration tests for search and import endpoints
  - [x] 10.1 Integration tests for search endpoint
    - Create `backend/tests/integration/test_search_endpoint.py`
    - Set up test fixtures with mocked HTTP endpoints for Gutenberg and Standard Ebooks
    - Test: `GET /api/search?q=pride` returns results from both providers with correct structure
    - Test: `GET /api/search?q=a` returns 400 (query too short)
    - Test: `GET /api/search?q=nonexistent` returns empty results with appropriate message
    - Test: search with one provider down returns partial results and provider status
    - Test: search respects 10-second overall timeout
    - Test: response includes correct quality labels per provider
    - Test: authentication is required (401 without valid session)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.5_

  - [x] 10.2 Integration tests for import endpoint
    - Create `backend/tests/integration/test_import_endpoint.py`
    - Set up test fixtures with mocked download endpoints
    - Test: `POST /api/projects/import` with valid provider_id and source_id creates BookProject
    - Test: import creates correct storage structure (raw file stored, normalized file stored)
    - Test: import extracts and stores metadata correctly
    - Test: import with invalid provider_id returns 404
    - Test: import with unreachable source returns 502 after retries
    - Test: import with empty content returns 422
    - Test: authentication is required (401 without valid session)
    - Test: created project is scoped to the authenticated user
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.2, 6.4, 6.5_

  - [x] 10.3 Integration tests for upload endpoint
    - Create `backend/tests/integration/test_upload_endpoint.py`
    - Set up test fixtures with sample files (valid EPUB, DOCX, TXT, PDF, and invalid files)
    - Test: `POST /api/projects/upload` with valid EPUB creates BookProject with images extracted
    - Test: upload with valid DOCX creates BookProject with metadata extracted
    - Test: upload with valid TXT creates BookProject with empty metadata
    - Test: upload with valid PDF creates BookProject
    - Test: upload with unsupported format returns 415
    - Test: upload with file > 200 MB returns 413
    - Test: upload with corrupt file returns 422
    - Test: upload response includes title, chapter_count, image_count, file_size
    - Test: authentication is required (401 without valid session)
    - Test: created project is scoped to the authenticated user
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 6.3, 6.5_

## Notes

- All HTTP calls to external sources (Gutenberg, Standard Ebooks) use `httpx.AsyncClient` with configurable timeouts
- Pandoc must be installed on the system (added to Dockerfile) for format normalization
- The `ebooklib`, `python-docx`, and `pypdf` libraries are used for format-specific metadata extraction
- For PDF text extraction, `pdftotext` (from poppler-utils) is used as a preprocessing step before Pandoc
- The OPDS feed for Standard Ebooks is cached locally (in-memory or Redis) with a 24-hour TTL to reduce load on their server
- All provider HTTP interactions should be mockable via `httpx` mock transport for testing
- The storage abstraction allows running tests with LocalStorage (tmpdir) without needing S3

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2", "3.3", "4.1", "4.2", "4.3", "4.4", "8.1", "8.2", "8.3"] },
    { "id": 2, "tasks": ["5.1", "5.2", "6.1", "6.2", "7.1", "7.2"] },
    { "id": 3, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 4, "tasks": ["10.1", "10.2", "10.3"] }
  ]
}
```
