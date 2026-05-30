"""Gutenberg provider: search and download from Project Gutenberg via Gutendex API."""

import asyncio
import logging
import time

import httpx

from app.services.source_service.base import SourceProvider
from app.services.source_service.exceptions import (
    DownloadError,
    ProviderUnavailableError,
)
from app.services.source_service.models import (
    BookMetadata,
    SearchResult,
    SourceDocument,
)

logger = logging.getLogger(__name__)

# Delays between retry attempts (in seconds): immediate, 1s, 3s
_RETRY_DELAYS = [0, 1, 3]

# HTTP status codes that are transient and worth retrying
_RETRYABLE_STATUS_CODES = {500, 502, 503, 504}


class GutenbergProvider(SourceProvider):
    """Source provider for Project Gutenberg using the Gutendex API.

    Search: Uses the Gutendex JSON API (https://gutendex.com/books/?search={query})
    Download: Fetches .epub3.images format (preferred), falls back to .epub.images, then .txt.utf-8
    Quality label: "community digitized"
    """

    GUTENDEX_BASE = "https://gutendex.com"

    def __init__(self, search_timeout: float = 45.0, download_timeout: float = 60.0) -> None:
        """Initialize the Gutenberg provider.

        Args:
            search_timeout: Timeout in seconds for search and metadata requests.
                            Defaults to 45 seconds. Gutendex is notoriously slow;
                            we'd rather wait than fail.
            download_timeout: Timeout in seconds for download requests.
                              Defaults to 60 seconds.
        """
        self._search_timeout = search_timeout
        self._download_timeout = download_timeout

    @property
    def provider_id(self) -> str:
        return "gutenberg"

    @property
    def display_name(self) -> str:
        return "Project Gutenberg"

    @property
    def quality_label(self) -> str:
        return "community digitized"

    async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
        """Search Gutenberg via Gutendex API with aggressive retry logic.

        Queries the Gutendex API with the given search term. Retries up to 3 times
        with exponential backoff (0s, 2s, 5s) on timeouts and transient errors.
        Will wait up to ~2 minutes total to get a result rather than failing.

        Args:
            query: Search string to match against title, author, and subject fields.
            limit: Maximum number of results to return (default 50).

        Returns:
            List of SearchResult objects from Project Gutenberg.

        Raises:
            ProviderUnavailableError: Only after all retry attempts are exhausted.
        """
        search_url = f"{self.GUTENDEX_BASE}/books/"
        params = {"search": query, "page": 1}
        logger.info(
            f"Gutenberg search: query={query!r}, url={search_url}, "
            f"params={params}, timeout={self._search_timeout}s, max_retries=3"
        )

        # Retry delays: immediate, 2s, 5s — total potential wait ~2 min with 45s timeouts
        retry_delays = [0, 2, 5]
        last_error: str = "Unknown error"
        overall_start = time.time()

        async with httpx.AsyncClient(
            timeout=self._search_timeout,
            headers={"User-Agent": "CWOPOD/1.0"},
            follow_redirects=True,
        ) as client:
            for attempt, delay in enumerate(retry_delays):
                if delay > 0:
                    logger.info(
                        f"Gutenberg search retry: attempt={attempt + 1}/{len(retry_delays)}, "
                        f"waiting {delay}s before retry, query={query!r}"
                    )
                    await asyncio.sleep(delay)

                start_time = time.time()
                try:
                    response = await client.get(search_url, params=params)
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Gutenberg API response: attempt={attempt + 1}, "
                        f"status={response.status_code}, elapsed={elapsed:.2f}s"
                    )

                    if response.status_code in _RETRYABLE_STATUS_CODES:
                        last_error = f"HTTP {response.status_code}"
                        logger.warning(
                            f"Gutenberg retryable HTTP error: status={response.status_code}, "
                            f"attempt={attempt + 1}/{len(retry_delays)}"
                        )
                        continue

                    response.raise_for_status()
                    data = response.json()

                    # Success — parse and return
                    total_elapsed = time.time() - overall_start
                    total_in_response = data.get("count", 0)
                    raw_results = data.get("results", [])
                    logger.info(
                        f"Gutenberg search SUCCESS: query={query!r}, "
                        f"total_available={total_in_response}, "
                        f"returned_in_page={len(raw_results)}, "
                        f"attempt={attempt + 1}, total_elapsed={total_elapsed:.2f}s"
                    )
                    return self._parse_search_results(raw_results, limit)

                except httpx.TimeoutException:
                    elapsed = time.time() - start_time
                    last_error = f"Timeout after {elapsed:.1f}s"
                    logger.warning(
                        f"Gutenberg search TIMEOUT: attempt={attempt + 1}/{len(retry_delays)}, "
                        f"elapsed={elapsed:.2f}s, query={query!r}"
                    )
                    continue
                except httpx.ConnectError as e:
                    elapsed = time.time() - start_time
                    last_error = f"Connection error: {e}"
                    logger.warning(
                        f"Gutenberg CONNECT ERROR: attempt={attempt + 1}/{len(retry_delays)}, "
                        f"elapsed={elapsed:.2f}s, error={e}"
                    )
                    continue
                except httpx.HTTPStatusError as e:
                    elapsed = time.time() - start_time
                    last_error = f"HTTP {e.response.status_code}"
                    # Non-retryable client errors
                    if 400 <= e.response.status_code < 500:
                        logger.error(
                            f"Gutenberg non-retryable HTTP ERROR: "
                            f"status={e.response.status_code}, query={query!r}"
                        )
                        raise ProviderUnavailableError(
                            "gutenberg", f"Gutendex returned HTTP {e.response.status_code}"
                        )
                    # Server errors — retry
                    logger.warning(
                        f"Gutenberg server error: status={e.response.status_code}, "
                        f"attempt={attempt + 1}/{len(retry_delays)}"
                    )
                    continue
                except httpx.RequestError as e:
                    elapsed = time.time() - start_time
                    last_error = f"Request error: {e}"
                    logger.warning(
                        f"Gutenberg REQUEST ERROR: attempt={attempt + 1}/{len(retry_delays)}, "
                        f"elapsed={elapsed:.2f}s, error={e}"
                    )
                    continue

        # All retries exhausted
        total_elapsed = time.time() - overall_start
        logger.error(
            f"Gutenberg search FAILED after all retries: query={query!r}, "
            f"total_elapsed={total_elapsed:.2f}s, last_error={last_error}"
        )
        raise ProviderUnavailableError("gutenberg", f"Search request failed after 3 attempts: {last_error}")

    def _parse_search_results(self, raw_results: list[dict], limit: int) -> list[SearchResult]:
        """Parse raw Gutendex results into SearchResult objects."""
        results: list[SearchResult] = []
        for book in raw_results[:limit]:
            # Map authors list to comma-separated string
            authors = ", ".join(
                a.get("name", "") for a in book.get("authors", [])
            )

            # Extract languages (list of ISO 639-1 codes)
            languages = book.get("languages", [])
            language = languages[0] if languages else "en"

            # Extract subjects (limit to first 5 for display)
            subjects = book.get("subjects", [])

            # Extract available format MIME types
            formats = list(book.get("formats", {}).keys())

            # Extract media_type and download_count for distinguishing duplicate titles
            media_type = book.get("media_type")  # e.g., "Text", "Sound"
            download_count = book.get("download_count")

            results.append(
                SearchResult(
                    source_id=str(book["id"]),
                    provider_id=self.provider_id,
                    provider_name=self.display_name,
                    quality_label=self.quality_label,
                    title=book.get("title", "Unknown"),
                    author=authors if authors else "Unknown",
                    language=language,
                    subjects=subjects[:5],
                    available_formats=formats,
                    source_url=f"https://www.gutenberg.org/ebooks/{book['id']}",
                    media_type=media_type,
                    download_count=download_count,
                )
            )

        logger.info(f"Gutenberg parsed {len(results)} results from {len(raw_results)} raw entries")
        return results

    async def download(self, source_id: str) -> SourceDocument:
        """Download book content by Gutenberg ID.

        Fetches book info from Gutendex to get available formats, then downloads
        the content preferring .epub3.images > .epub.images > .txt.utf-8.

        Implements:
        - 30-second download timeout
        - 3 retry attempts with exponential backoff (0s, 1s, 3s) for transient errors
        - Metadata extraction from Gutendex response
        - License text preservation

        Args:
            source_id: The Gutenberg book ID.

        Returns:
            SourceDocument with the downloaded content and metadata.

        Raises:
            DownloadError: If all download attempts fail or no suitable format found.
        """
        # Fetch book info from Gutendex to get formats and metadata
        book_data = await self._fetch_book_data(source_id)
        formats = book_data.get("formats", {})

        # Extract metadata from the Gutendex response
        metadata = self._extract_metadata(book_data, source_id)

        # Determine download URL by format preference
        download_url, file_format = self._select_format(formats, source_id)

        # Download the content with retry logic
        content = await self._download_with_retry(download_url, source_id)

        # Preserve license text if present in text content
        license_text = self._extract_license_text(content, file_format)
        if license_text:
            metadata.license_text = license_text

        return SourceDocument(
            content=content,
            format=file_format,
            metadata=metadata,
        )

    async def _fetch_book_data(self, source_id: str) -> dict:
        """Fetch book data from Gutendex API with retry logic.

        Retries up to 3 times with backoff (0s, 2s, 5s) on transient errors.

        Args:
            source_id: The Gutenberg book ID.

        Returns:
            Parsed JSON response from Gutendex.

        Raises:
            DownloadError: If the API request fails after all retries.
        """
        url = f"{self.GUTENDEX_BASE}/books/{source_id}/"
        logger.info(f"Gutenberg fetching book data: source_id={source_id}, url={url}")

        retry_delays = [0, 2, 5]
        last_error: str = "Unknown error"

        for attempt, delay in enumerate(retry_delays):
            if delay > 0:
                logger.info(f"Gutenberg book data retry: attempt={attempt + 1}, waiting {delay}s")
                await asyncio.sleep(delay)

            start_time = time.time()
            try:
                async with httpx.AsyncClient(
                    timeout=self._search_timeout,
                    headers={"User-Agent": "CWOPOD/1.0"},
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url)
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Gutenberg book data response: source_id={source_id}, "
                        f"status={response.status_code}, elapsed={elapsed:.2f}s, "
                        f"attempt={attempt + 1}"
                    )

                    if response.status_code in _RETRYABLE_STATUS_CODES:
                        last_error = f"HTTP {response.status_code}"
                        continue

                    response.raise_for_status()
                    return response.json()

            except httpx.TimeoutException:
                elapsed = time.time() - start_time
                last_error = f"Timeout after {elapsed:.1f}s"
                logger.warning(
                    f"Gutenberg book data TIMEOUT: source_id={source_id}, "
                    f"attempt={attempt + 1}/{len(retry_delays)}, elapsed={elapsed:.2f}s"
                )
                continue
            except httpx.ConnectError as e:
                elapsed = time.time() - start_time
                last_error = f"Connection error: {e}"
                logger.warning(
                    f"Gutenberg book data CONNECT ERROR: source_id={source_id}, "
                    f"attempt={attempt + 1}/{len(retry_delays)}, error={e}"
                )
                continue
            except httpx.HTTPStatusError as e:
                # Non-retryable client errors
                if 400 <= e.response.status_code < 500:
                    raise DownloadError(
                        "gutenberg",
                        f"Failed to fetch book info for {source_id}: HTTP {e.response.status_code}",
                    )
                last_error = f"HTTP {e.response.status_code}"
                continue

        raise DownloadError(
            "gutenberg",
            f"Failed to fetch book info for {source_id} after 3 attempts: {last_error}",
        )

    def _select_format(
        self, formats: dict[str, str], source_id: str
    ) -> tuple[str, str]:
        """Select the best available format from the Gutendex formats field.

        Preference order:
        1. EPUB with 'epub3.images' in URL
        2. EPUB with 'epub.images' in URL
        3. Any remaining EPUB
        4. text/plain; charset=utf-8

        Args:
            formats: The formats dict from Gutendex (mime_type -> URL).
            source_id: The Gutenberg book ID (for error messages).

        Returns:
            Tuple of (download_url, format_type).

        Raises:
            DownloadError: If no suitable format is found.
        """
        # Collect all EPUB URLs from the formats dict
        epub_urls: list[str] = []
        for mime_type, url in formats.items():
            if "epub" in mime_type.lower() and "zip" in mime_type.lower():
                epub_urls.append(url)

        # Prefer epub3.images over epub.images
        for url in epub_urls:
            if ".epub3.images" in url:
                return (url, "epub")

        for url in epub_urls:
            if ".epub.images" in url:
                return (url, "epub")

        # Any remaining epub URL
        if epub_urls:
            return (epub_urls[0], "epub")

        # Fall back to plain text UTF-8
        for mime_type, url in formats.items():
            if "text/plain" in mime_type and "utf-8" in mime_type:
                return (url, "txt")

        # No suitable format found
        raise DownloadError(
            "gutenberg",
            f"No suitable download format found for book {source_id}",
        )

    async def _download_with_retry(self, url: str, source_id: str) -> bytes:
        """Download content from URL with retry logic.

        3 attempts with exponential backoff (0s, 1s, 3s) for transient errors.
        30-second timeout per attempt.
        Only retries on network errors and 5xx status codes.

        Args:
            url: The download URL.
            source_id: The Gutenberg book ID (for error messages).

        Returns:
            The downloaded content as bytes.

        Raises:
            DownloadError: If all retry attempts fail or a non-retryable error occurs.
        """
        last_error: str | None = None

        for attempt, delay in enumerate(_RETRY_DELAYS):
            if delay > 0:
                await asyncio.sleep(delay)

            try:
                async with httpx.AsyncClient(
                    timeout=self._download_timeout, follow_redirects=True,
                    headers={"User-Agent": "CWOPOD/1.0"}
                ) as client:
                    response = await client.get(url)

                    if response.status_code == 200:
                        return response.content

                    # Non-retryable client errors (4xx)
                    if 400 <= response.status_code < 500:
                        raise DownloadError(
                            "gutenberg",
                            f"Download failed for book {source_id}: HTTP {response.status_code}",
                        )

                    # Retryable server errors (5xx)
                    if response.status_code in _RETRYABLE_STATUS_CODES:
                        last_error = f"HTTP {response.status_code}"
                        continue

                    # Other unexpected status codes - don't retry
                    raise DownloadError(
                        "gutenberg",
                        f"Download failed for book {source_id}: HTTP {response.status_code}",
                    )

            except httpx.TimeoutException:
                last_error = "Download timed out"
                continue
            except httpx.ConnectError:
                last_error = "Connection failed"
                continue
            except DownloadError:
                raise  # Re-raise non-retryable errors

        raise DownloadError(
            "gutenberg",
            f"Failed to download book {source_id} after {len(_RETRY_DELAYS)} attempts: {last_error}",
        )

    def _extract_metadata(self, book_data: dict, source_id: str) -> BookMetadata:
        """Extract metadata from a Gutendex API response.

        Args:
            book_data: Parsed JSON response from Gutendex.
            source_id: The Gutenberg book ID.

        Returns:
            BookMetadata populated from the response.
        """
        authors = ", ".join(
            a.get("name", "") for a in book_data.get("authors", [])
        )
        languages = book_data.get("languages", [])

        # Gutendex doesn't provide a direct publication_date field.
        # We leave it as None since there's no reliable date in the API response.
        publication_date = None

        return BookMetadata(
            title=book_data.get("title"),
            author=authors or None,
            publication_date=publication_date,
            language=languages[0] if languages else None,
            source_url=f"https://www.gutenberg.org/ebooks/{source_id}",
            source_provider="gutenberg",
            source_id=source_id,
            subjects=book_data.get("subjects", []),
        )

    def _extract_license_text(self, content: bytes, file_format: str) -> str | None:
        """Extract Gutenberg license text from downloaded content if present.

        Project Gutenberg books typically include license text at the beginning
        and/or end of the text content. For EPUB, the license is embedded in
        the file structure and preserved as-is within the content bytes.

        Args:
            content: The downloaded file content.
            file_format: The format of the content ('epub' or 'txt').

        Returns:
            The extracted license text, or None if not found.
        """
        if file_format != "txt":
            # For EPUB, the license is preserved within the file structure
            return None

        try:
            text = content.decode("utf-8")
        except (UnicodeDecodeError, ValueError):
            return None

        # Look for the standard Gutenberg license at the end of the file
        license_start_markers = [
            "*** END OF THE PROJECT GUTENBERG EBOOK",
            "*** END OF THIS PROJECT GUTENBERG EBOOK",
            "End of the Project Gutenberg EBook",
            "End of Project Gutenberg's",
        ]

        for marker in license_start_markers:
            idx = text.find(marker)
            if idx != -1:
                # Return everything from this marker to the end
                license_text = text[idx:].strip()
                if license_text:
                    return license_text

        # Also check for license header at the beginning
        header_end_markers = [
            "*** START OF THE PROJECT GUTENBERG EBOOK",
            "*** START OF THIS PROJECT GUTENBERG EBOOK",
        ]

        for marker in header_end_markers:
            idx = text.find(marker)
            if idx != -1:
                # The license/header is everything before this marker
                header_text = text[:idx].strip()
                if header_text and "Project Gutenberg" in header_text:
                    return header_text

        return None

    async def get_metadata(self, source_id: str) -> BookMetadata:
        """Retrieve metadata from Gutendex API with retry logic.

        Fetches book details from https://gutendex.com/books/{id} and parses
        the response into a BookMetadata dataclass. Retries up to 3 times
        with backoff (0s, 2s, 5s) on transient errors.

        Args:
            source_id: The Gutenberg book ID.

        Returns:
            BookMetadata populated from the Gutendex response.

        Raises:
            ProviderUnavailableError: If the API cannot be reached after all retries.
        """
        url = f"{self.GUTENDEX_BASE}/books/{source_id}/"
        retry_delays = [0, 2, 5]
        last_error: str = "Unknown error"

        for attempt, delay in enumerate(retry_delays):
            if delay > 0:
                logger.info(
                    f"Gutenberg get_metadata retry: source_id={source_id}, "
                    f"attempt={attempt + 1}, waiting {delay}s"
                )
                await asyncio.sleep(delay)

            start_time = time.time()
            try:
                async with httpx.AsyncClient(
                    timeout=self._search_timeout,
                    headers={"User-Agent": "CWOPOD/1.0"},
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url)
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Gutenberg get_metadata response: source_id={source_id}, "
                        f"status={response.status_code}, elapsed={elapsed:.2f}s, "
                        f"attempt={attempt + 1}"
                    )

                    if response.status_code in _RETRYABLE_STATUS_CODES:
                        last_error = f"HTTP {response.status_code}"
                        continue

                    response.raise_for_status()
                    data = response.json()
                    return self._parse_metadata(data, source_id)

            except httpx.TimeoutException:
                elapsed = time.time() - start_time
                last_error = f"Timeout after {elapsed:.1f}s"
                logger.warning(
                    f"Gutenberg get_metadata TIMEOUT: source_id={source_id}, "
                    f"attempt={attempt + 1}/{len(retry_delays)}"
                )
                continue
            except httpx.ConnectError as e:
                last_error = f"Connection error: {e}"
                logger.warning(
                    f"Gutenberg get_metadata CONNECT ERROR: source_id={source_id}, "
                    f"attempt={attempt + 1}/{len(retry_delays)}"
                )
                continue
            except httpx.HTTPStatusError as e:
                if 400 <= e.response.status_code < 500:
                    raise ProviderUnavailableError(
                        "gutenberg", f"HTTP {e.response.status_code}"
                    )
                last_error = f"HTTP {e.response.status_code}"
                continue

        raise ProviderUnavailableError(
            "gutenberg", f"Metadata request failed after 3 attempts: {last_error}"
        )

    def _parse_metadata(self, data: dict, source_id: str) -> BookMetadata:
        """Parse a Gutendex book JSON object into a BookMetadata dataclass.

        Handles missing fields gracefully by returning None for absent values.
        """
        # Authors: join multiple author names with comma
        authors_list = data.get("authors") or []
        authors = (
            ", ".join(a.get("name", "") for a in authors_list) or None
        )

        # Language: take the first language code if available
        languages = data.get("languages") or []
        language = languages[0] if languages else None

        # Publication date: Gutendex doesn't provide a dedicated field,
        # but we leave it as None since it's not reliably available.
        publication_date = None

        # Subjects
        subjects = data.get("subjects") or []

        # License/copyright info from Gutendex
        # copyright=False means the work is in the public domain
        copyright_info = data.get("copyright")
        license_text = None
        if copyright_info is False:
            license_text = "Public Domain"

        return BookMetadata(
            title=data.get("title") or None,
            author=authors,
            publication_date=publication_date,
            language=language,
            source_url=f"https://www.gutenberg.org/ebooks/{source_id}",
            source_provider="gutenberg",
            source_id=source_id,
            license_text=license_text,
            subjects=subjects,
        )
