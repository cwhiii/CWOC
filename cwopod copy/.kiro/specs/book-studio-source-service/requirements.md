# Requirements: Source Service Module

## Introduction

The Source Service module (Source_Fetcher) is responsible for searching, discovering, downloading, and uploading book texts into C.W.'s O-POD. It provides a federated search interface across multiple public domain sources (Project Gutenberg, Standard Ebooks), handles full-text downloads with metadata extraction, and accepts user document uploads in common formats. The module uses a plugin architecture to allow new source providers to be added without modifying existing code.

## Glossary

- **Source_Fetcher**: The Source Service module responsible for all text ingestion operations
- **SourceProvider**: An abstract plugin interface that defines how a source is searched and downloaded from
- **GutenbergProvider**: Plugin implementation for searching and downloading from Project Gutenberg
- **StandardEbooksProvider**: Plugin implementation for searching and downloading from Standard Ebooks
- **UploadProvider**: Plugin implementation for handling user-uploaded documents
- **SearchResult**: A single result item returned from a federated search query
- **SourceDocument**: The full text content and associated metadata downloaded from a source
- **BookMetadata**: Structured metadata about a book (title, author, publication date, language, source URL)
- **BookProject**: The internal project entity created when a book is imported or uploaded
- **Quality Label**: A tag indicating the curation level of a source (e.g., "professionally curated" for Standard Ebooks)

## Requirements

### Requirement 1: Federated Search Across Sources

**User Story:** As a user, I want to search for public domain books across multiple sources simultaneously, so that I can find the best available version of a text without searching each source individually.

#### Acceptance Criteria

1.1 WHEN a user enters a search query of at least 2 characters, THE Source_Fetcher SHALL search title, author, and subject fields across all enabled source providers (Project Gutenberg, Standard Ebooks) in parallel and return a combined, deduplicated result set of up to 50 matching results within 10 seconds

1.2 WHEN search results are displayed, each result SHALL indicate which source providers have that title available, allowing the user to choose their preferred source

1.3 WHEN search results are displayed, each result SHALL show a quality label for its source indicating the curation level (Standard Ebooks labeled as "professionally curated and formatted"; Project Gutenberg labeled as "community digitized")

1.4 WHEN a search query of fewer than 2 characters is submitted, THE Source_Fetcher SHALL reject the query and display a message indicating the minimum query length requirement

1.5 IF a search query returns no matching results from any enabled source, THEN THE Source_Fetcher SHALL display a message indicating no results were found and suggest refining the query

1.6 IF an enabled source provider is unreachable or times out during a search, THEN THE Source_Fetcher SHALL return results from the remaining available sources and indicate which sources could not be reached, without failing the entire search

1.7 THE Source_Fetcher SHALL support a configurable timeout per source provider, defaulting to 8 seconds per provider, to ensure the overall 10-second response time is met

### Requirement 2: Plugin Architecture for Source Providers

**User Story:** As a developer, I want to add new source providers without modifying existing search or download logic, so that the system can be extended to support additional public domain repositories.

#### Acceptance Criteria

2.1 THE Source_Fetcher SHALL define a SourceProvider interface that all source plugins must implement, including methods for search, download, and metadata retrieval

2.2 THE Source_Fetcher SHALL maintain a provider registry that discovers and loads all registered SourceProvider implementations at startup

2.3 WHEN a new SourceProvider implementation is registered, THE Source_Fetcher SHALL include it in federated search queries and make it available for download operations without requiring changes to the search API, download API, or any other existing provider

2.4 Each SourceProvider SHALL declare a unique provider identifier, a display name, and a quality label that are used in search results and UI display

2.5 THE Source_Fetcher SHALL allow individual source providers to be enabled or disabled via configuration without code changes

### Requirement 3: Download Full Text and Metadata

**User Story:** As a user, I want to download a selected book's full text and metadata from a source, so that I can import it into my book project for typesetting and printing.

#### Acceptance Criteria

3.1 WHEN a user selects a search result for import, THE Source_Fetcher SHALL download the full text in the best available format (preferring EPUB with images, falling back to plain text UTF-8) from the chosen source within 30 seconds

3.2 WHEN a book is downloaded, THE Source_Fetcher SHALL extract and store the following metadata: title, author, publication date, language, and source URL

3.3 WHEN a download completes successfully, THE Source_Fetcher SHALL create a new BookProject containing the downloaded text, extracted metadata, and a reference to the source provider and source identifier

3.4 IF a download fails due to network error, timeout, or source returning an error response, THEN THE Source_Fetcher SHALL notify the user of the failure with a descriptive error message and allow the user to retry the download

3.5 IF the downloaded content is empty or cannot be parsed as valid text, THEN THE Source_Fetcher SHALL reject the import, notify the user that the content could not be processed, and not create a BookProject

3.6 WHEN downloading from a source that provides license or legal text (e.g., Project Gutenberg license header), THE Source_Fetcher SHALL preserve that text as part of the BookProject metadata for downstream use by the Attribution_Page

### Requirement 4: User Document Upload

**User Story:** As a user, I want to upload my own documents in common formats, so that I can create printed books from texts I already have.

#### Acceptance Criteria

4.1 THE Source_Fetcher SHALL accept file uploads in the following formats: EPUB (.epub), DOCX (.docx), plain text (.txt), and PDF (.pdf), with a maximum file size of 200 MB per document

4.2 WHEN a file is uploaded, THE Source_Fetcher SHALL validate the file format by checking both the file extension and the file's magic bytes/content type to confirm it matches a supported format

4.3 WHEN an EPUB file containing embedded images or illustrations is uploaded, THE Source_Fetcher SHALL extract and preserve all images and their relative placement within the text content

4.4 WHEN a document is uploaded, THE Source_Fetcher SHALL attempt to extract available metadata (title, author, publication date) from the file's internal metadata structures (OPF metadata for EPUB, document properties for DOCX, document info for PDF, none for plain text)

4.5 IF an uploaded file is in an unsupported format (neither EPUB, DOCX, TXT, nor PDF), THEN THE Source_Fetcher SHALL reject the upload and display an error message listing the supported formats

4.6 IF an uploaded file in a supported format cannot be parsed due to corruption, encoding errors, or structural invalidity, THEN THE Source_Fetcher SHALL reject the upload and display an error message indicating the file is unreadable, including the specific error encountered

4.7 IF no metadata fields (title, author, publication date) are present in the uploaded file, THEN THE Source_Fetcher SHALL accept the upload and leave the metadata fields empty for manual entry by the user

4.8 WHEN a document upload and processing completes successfully, THE Source_Fetcher SHALL create a new BookProject and display a confirmation indicating the document title (or filename if title metadata is absent) and the number of extracted chapters or sections

4.9 THE Source_Fetcher SHALL normalize all uploaded documents to a common internal format (structured HTML or EPUB-like representation) using Pandoc for format conversion, preserving text structure (headings, paragraphs, lists) and embedded images

### Requirement 5: File Storage

**User Story:** As an administrator, I want uploaded and downloaded files to be stored reliably with a configurable storage backend, so that the system can scale from local development to cloud deployment.

#### Acceptance Criteria

5.1 THE Source_Fetcher SHALL store all downloaded texts, uploaded files, and extracted assets (images) in a configurable storage backend that supports both local filesystem and S3-compatible object storage

5.2 WHEN the storage backend is configured as local, THE Source_Fetcher SHALL store files in a configurable directory path on the server filesystem

5.3 WHEN the storage backend is configured as S3, THE Source_Fetcher SHALL store files in the configured S3 bucket using the configured endpoint, access key, and secret key

5.4 THE Source_Fetcher SHALL organize stored files by project ID, with subdirectories for source text, extracted images, and normalized output

5.5 IF a file storage operation fails (disk full, S3 unreachable, permission denied), THEN THE Source_Fetcher SHALL report the failure to the user and not create a partial or corrupt BookProject

### Requirement 6: Error Handling and Resilience

**User Story:** As a user, I want clear error messages when something goes wrong during search, download, or upload, so that I can understand what happened and take corrective action.

#### Acceptance Criteria

6.1 WHEN any source provider returns an error during search, THE Source_Fetcher SHALL log the error with full details (provider name, error type, timestamp) and return a user-friendly message indicating which source had an issue

6.2 WHEN a download operation exceeds the 30-second timeout, THE Source_Fetcher SHALL cancel the operation, notify the user of the timeout, and allow retry

6.3 WHEN an upload exceeds the 200 MB size limit, THE Source_Fetcher SHALL reject the upload immediately (before fully receiving the file where possible) and display the maximum allowed size

6.4 THE Source_Fetcher SHALL implement retry logic for transient network failures during download operations, attempting up to 3 retries with exponential backoff before reporting failure to the user

6.5 ALL error responses from the Source_Fetcher API SHALL include a structured error object with fields: error_code (machine-readable), message (human-readable), and details (optional additional context)

