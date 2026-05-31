"""Standard Ebooks provider: search and download from Standard Ebooks OPDS feed.

Standard Ebooks provides professionally curated and formatted public domain ebooks.
This provider uses their OPDS catalog feed (Atom/XML) for search and discovery,
with local caching to avoid repeated downloads (24-hour TTL).

Requirements: 1.1, 1.3, 1.6, 1.7
"""

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Optional

import httpx

from app.services.source_service.base import (
    BookMetadata,
    DownloadError,
    ProviderUnavailableError,
    SearchResult,
    SourceDocument,
    SourceProvider,
)

logger = logging.getLogger(__name__)

# Atom/OPDS XML namespaces
ATOM_NS = "http://www.w3.org/2005/Atom"
OPDS_NS = "http://opds-spec.org/2010/catalog"
DC_NS = "http://purl.org/dc/terms/"
DCTERMS_NS = "http://purl.org/dc/terms/"


class StandardEbooksProvider(SourceProvider):
    """Source provider for Standard Ebooks using their OPDS catalog.

    Search: Parses the OPDS catalog feed (Atom/XML) at https://standardebooks.org/feeds/opds
    Download: Fetches EPUB from the catalog entry's acquisition link.
    Quality label: "professionally curated and formatted"

    The OPDS feed is cached locally with a 24-hour TTL to reduce load on the
    Standard Ebooks server.

    NOTE: Standard Ebooks requires Patrons Circle membership to access OPDS feeds.
    Authentication is HTTP Basic with email as username and empty password.
    Configure your Patrons Circle email in Settings > Book Sources to enable access.
    """

    OPDS_URL = "https://standardebooks.org/feeds/opds"
    CATALOG_URL = "https://standardebooks.org/feeds/opds/all"
    CACHE_TTL_HOURS = 24

    def __init__(self, timeout: float = 30.0) -> None:
        """Initialize the Standard Ebooks provider.

        Args:
            timeout: Configurable timeout in seconds for HTTP requests (default 30s).
        """
        import os
        self._timeout = timeout
        self._catalog_cache: Optional[list[dict]] = None
        self._cache_expires: Optional[datetime] = None
        # Auth email: primarily configured via Settings > Book Sources (stored in DB).
        # Falls back to STANDARD_EBOOKS_EMAIL env var if set (legacy/server-level override).
        self._auth_email: Optional[str] = os.environ.get("STANDARD_EBOOKS_EMAIL", "").strip() or None
        logger.info(
            f"StandardEbooksProvider initialized: timeout={timeout}s, "
            f"auth_from_env={self._auth_email is not None}, "
            f"catalog_url={self.CATALOG_URL}"
        )

    @property
    def provider_id(self) -> str:
        return "standard_ebooks"

    @property
    def display_name(self) -> str:
        return "Standard Ebooks"

    @property
    def quality_label(self) -> str:
        return "professionally curated and formatted"

    @property
    def is_high_quality(self) -> bool:
        """Standard Ebooks texts are high-quality; skip typo correction by default."""
        return True

    async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
        """Search Standard Ebooks catalog by filtering cached OPDS entries.

        Performs case-insensitive substring matching against title, author,
        and subject fields.

        Args:
            query: Search query string.
            limit: Maximum number of results to return (default 50).

        Returns:
            List of SearchResult objects matching the query.

        Raises:
            ProviderUnavailableError: If the catalog cannot be fetched.
        """
        logger.info(
            f"Standard Ebooks search: query={query!r}, limit={limit}, "
            f"strategy=case-insensitive substring match on title+author+subjects"
        )
        start_time = time.time()

        catalog = await self._get_catalog()
        logger.info(
            f"Standard Ebooks catalog loaded: {len(catalog)} entries, "
            f"cache_valid={self._cache_expires and datetime.utcnow() < self._cache_expires}"
        )

        query_lower = query.lower()
        # Split query into individual words for better matching
        query_words = query_lower.split()

        results: list[SearchResult] = []
        for entry in catalog:
            # Case-insensitive substring match against title, author, subjects
            title = entry.get("title", "")
            author = entry.get("author", "")
            subjects = entry.get("subjects", [])
            searchable = f"{title} {author} {' '.join(subjects)}".lower()

            # Match if ALL query words appear in the searchable text
            if all(word in searchable for word in query_words):
                results.append(
                    SearchResult(
                        source_id=entry["id"],
                        provider_id=self.provider_id,
                        provider_name=self.display_name,
                        quality_label=self.quality_label,
                        title=title or "Unknown",
                        author=author or "Unknown",
                        language=entry.get("language", "en"),
                        subjects=subjects[:5],
                        available_formats=entry.get("formats", ["epub"]),
                        source_url=entry.get("url", ""),
                    )
                )
                if len(results) >= limit:
                    break

        elapsed = time.time() - start_time
        logger.info(
            f"Standard Ebooks search complete: query={query!r}, "
            f"results={len(results)}, catalog_size={len(catalog)}, "
            f"elapsed={elapsed:.2f}s"
        )
        return results

    async def download(self, source_id: str) -> SourceDocument:
        """Download EPUB from Standard Ebooks acquisition link.

        Parses the OPDS entry to find the EPUB download URL (application/epub+zip),
        downloads with a 30-second timeout, and retries up to 3 times with exponential
        backoff for transient errors (0s, 1s, 3s delays).

        The source is flagged as high-quality for downstream typo-skip default
        via the provider's is_high_quality property.

        Args:
            source_id: The Standard Ebooks identifier for the book.

        Returns:
            SourceDocument with EPUB content and extracted metadata including
            title, author, published date, language, and identifier as source URL.

        Raises:
            DownloadError: If the book is not found in the catalog, no EPUB URL
                          is available, or download fails after all retry attempts.
        """
        catalog = await self._get_catalog()

        # Find entry in cached catalog
        entry = next((e for e in catalog if e["id"] == source_id), None)
        if entry is None:
            raise DownloadError(
                "standard_ebooks", f"Book '{source_id}' not found in catalog"
            )

        # Get the EPUB acquisition URL (application/epub+zip link)
        epub_url = entry.get("epub_url")
        if not epub_url:
            raise DownloadError(
                "standard_ebooks",
                f"No EPUB acquisition link found for '{source_id}'",
            )

        # Retry with exponential backoff: delays of 0s, 1s, 3s
        retry_delays = [0, 1, 3]
        last_error: Optional[Exception] = None

        for attempt in range(3):
            # Apply backoff delay (first attempt is immediate)
            if attempt > 0:
                await asyncio.sleep(retry_delays[attempt])

            # Use auth for downloads too (Standard Ebooks requires it)
            auth = None
            if self._auth_email:
                auth = httpx.BasicAuth(username=self._auth_email, password="")

            try:
                async with httpx.AsyncClient(
                    timeout=30.0, follow_redirects=True,
                    headers={"User-Agent": "CWOPOD/1.0 (Open Print-On-Demand; contact: g-pod@cwholemaniii.com)"},
                    auth=auth
                ) as client:
                    response = await client.get(epub_url)
                    response.raise_for_status()

                    # Extract metadata from the OPDS entry
                    metadata = BookMetadata(
                        title=entry.get("title"),
                        author=entry.get("author"),
                        publication_date=entry.get("publication_date"),
                        language=entry.get("language", "en"),
                        source_url=entry.get("url"),
                        source_provider="standard_ebooks",
                        source_id=source_id,
                        subjects=entry.get("subjects", []),
                    )

                    return SourceDocument(
                        content=response.content,
                        format="epub",
                        metadata=metadata,
                    )

            except httpx.TimeoutException as e:
                last_error = e
                continue
            except httpx.ConnectError as e:
                last_error = e
                continue
            except httpx.HTTPStatusError as e:
                # Only retry on server errors (5xx); client errors (4xx) fail immediately
                if e.response.status_code >= 500:
                    last_error = e
                    continue
                raise DownloadError(
                    "standard_ebooks",
                    f"Download failed with HTTP {e.response.status_code} for '{source_id}'",
                )
            except httpx.RequestError as e:
                # Other transient request errors (DNS, connection reset, etc.)
                last_error = e
                continue

        # All retries exhausted
        error_detail = str(last_error) if last_error else "Unknown error"
        raise DownloadError(
            "standard_ebooks",
            f"Failed to download '{source_id}' after 3 attempts: {error_detail}",
        )

    async def get_metadata(self, source_id: str) -> BookMetadata:
        """Get metadata from cached OPDS catalog entry.

        Looks up the book by source_id in the cached OPDS feed and parses
        the entry into a BookMetadata dataclass. If the book is not found,
        returns a minimal BookMetadata with only source_provider and source_id
        set (graceful handling of missing entries).

        Args:
            source_id: The Standard Ebooks identifier for the book.

        Returns:
            BookMetadata populated from the catalog entry, or a minimal
            BookMetadata if the entry is not found.

        Raises:
            ProviderUnavailableError: If the catalog cannot be fetched.
        """
        catalog = await self._get_catalog()
        entry = next((e for e in catalog if e["id"] == source_id), None)

        if entry is None:
            # Gracefully handle missing book - return minimal metadata
            return BookMetadata(source_provider="standard_ebooks", source_id=source_id)

        return BookMetadata(
            title=entry.get("title"),
            author=entry.get("author"),
            publication_date=entry.get("publication_date"),
            language=entry.get("language", "en"),
            source_url=entry.get("url"),
            source_provider="standard_ebooks",
            source_id=source_id,
            subjects=entry.get("subjects", []),
        )

    async def _get_catalog(self) -> list[dict]:
        """Fetch and cache the OPDS catalog with 24-hour TTL and retry logic.

        If the cache is still valid, returns cached entries. Otherwise fetches
        the full OPDS feed from Standard Ebooks with up to 3 retry attempts
        (delays: 0s, 3s, 8s).

        If a fetch fails but we have a stale cache, returns the stale cache
        as a fallback (graceful degradation).

        Returns:
            List of parsed catalog entry dicts.

        Raises:
            ProviderUnavailableError: If fetch fails and no cache is available.
        """
        now = datetime.utcnow()
        if self._catalog_cache is not None and self._cache_expires and now < self._cache_expires:
            logger.debug(
                f"Standard Ebooks using cached catalog: "
                f"{len(self._catalog_cache)} entries, expires={self._cache_expires}"
            )
            return self._catalog_cache

        logger.info(
            f"Standard Ebooks fetching catalog from {self.CATALOG_URL} "
            f"(cache expired or empty), auth_configured={self._auth_email is not None}"
        )

        headers = {
            "User-Agent": "CWOPOD/1.0 (Open Print-On-Demand; contact: g-pod@cwholemaniii.com)"
        }

        # Standard Ebooks requires Patrons Circle auth (email as username, empty password)
        auth = None
        if self._auth_email:
            auth = httpx.BasicAuth(username=self._auth_email, password="")
            logger.info(f"Standard Ebooks using HTTP Basic Auth with email={self._auth_email}")
        else:
            logger.warning(
                "Standard Ebooks: No auth email configured. "
                "OPDS feeds require Patrons Circle membership. "
                "Configure your Patrons Circle email in Settings > Book Sources."
            )

        # Retry with backoff: 0s, 3s, 8s
        retry_delays = [0, 3, 8]
        last_error: str = "Unknown error"
        overall_start = time.time()

        for attempt, delay in enumerate(retry_delays):
            if delay > 0:
                logger.info(
                    f"Standard Ebooks catalog retry: attempt={attempt + 1}/{len(retry_delays)}, "
                    f"waiting {delay}s"
                )
                await asyncio.sleep(delay)

            start_time = time.time()
            try:
                async with httpx.AsyncClient(
                    timeout=self._timeout, follow_redirects=True, headers=headers, auth=auth
                ) as client:
                    response = await client.get(self.CATALOG_URL)
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Standard Ebooks catalog response: attempt={attempt + 1}, "
                        f"status={response.status_code}, "
                        f"size={len(response.text)} chars, elapsed={elapsed:.2f}s"
                    )

                    # 401 without auth configured is a permanent failure — don't retry
                    if response.status_code == 401 and not self._auth_email:
                        logger.error(
                            "Standard Ebooks returned 401 and no auth is configured. "
                            "OPDS feeds require Patrons Circle membership. "
                            "Configure email in Settings > Book Sources."
                        )
                        if self._catalog_cache is not None:
                            logger.warning("Using stale cache as fallback")
                            return self._catalog_cache
                        raise ProviderUnavailableError(
                            "standard_ebooks",
                            "HTTP 401 Unauthorized — Standard Ebooks requires Patrons Circle "
                            "membership. Configure your patron email in Settings > Book Sources.",
                        )

                    # 401 with auth configured — credentials may be wrong, don't retry
                    if response.status_code == 401:
                        logger.error(
                            f"Standard Ebooks returned 401 with auth email={self._auth_email}. "
                            "Credentials may be invalid or membership expired."
                        )
                        if self._catalog_cache is not None:
                            logger.warning("Using stale cache as fallback")
                            return self._catalog_cache
                        raise ProviderUnavailableError(
                            "standard_ebooks",
                            "HTTP 401 Unauthorized — your Patrons Circle email may be invalid "
                            "or membership expired. Update it in Settings > Book Sources.",
                        )

                    # Other 4xx — non-retryable
                    if 400 <= response.status_code < 500:
                        last_error = f"HTTP {response.status_code}"
                        logger.error(
                            f"Standard Ebooks non-retryable error: status={response.status_code}"
                        )
                        if self._catalog_cache is not None:
                            logger.warning("Using stale cache as fallback")
                            return self._catalog_cache
                        raise ProviderUnavailableError(
                            "standard_ebooks",
                            f"HTTP error {response.status_code} fetching catalog",
                        )

                    # 5xx — retryable
                    if response.status_code >= 500:
                        last_error = f"HTTP {response.status_code}"
                        logger.warning(
                            f"Standard Ebooks server error: status={response.status_code}, "
                            f"attempt={attempt + 1}/{len(retry_delays)}"
                        )
                        continue

                    response.raise_for_status()
                    entries = self._parse_opds_feed(response.text)
                    total_elapsed = time.time() - overall_start
                    logger.info(
                        f"Standard Ebooks catalog parsed: {len(entries)} entries, "
                        f"attempt={attempt + 1}, total_elapsed={total_elapsed:.2f}s"
                    )
                    self._catalog_cache = entries
                    self._cache_expires = now + timedelta(hours=self.CACHE_TTL_HOURS)
                    return entries

            except httpx.TimeoutException:
                elapsed = time.time() - start_time
                last_error = f"Timeout after {elapsed:.1f}s"
                logger.warning(
                    f"Standard Ebooks catalog TIMEOUT: attempt={attempt + 1}/{len(retry_delays)}, "
                    f"elapsed={elapsed:.2f}s"
                )
                continue
            except httpx.ConnectError as e:
                elapsed = time.time() - start_time
                last_error = f"Connection error: {e}"
                logger.warning(
                    f"Standard Ebooks CONNECT ERROR: attempt={attempt + 1}/{len(retry_delays)}, "
                    f"elapsed={elapsed:.2f}s, error={e}"
                )
                continue
            except ProviderUnavailableError:
                raise  # Don't retry non-retryable errors
            except httpx.RequestError as e:
                elapsed = time.time() - start_time
                last_error = f"Request error: {e}"
                logger.warning(
                    f"Standard Ebooks REQUEST ERROR: attempt={attempt + 1}/{len(retry_delays)}, "
                    f"elapsed={elapsed:.2f}s, error={e}"
                )
                continue

        # All retries exhausted
        total_elapsed = time.time() - overall_start
        logger.error(
            f"Standard Ebooks catalog fetch FAILED after all retries: "
            f"total_elapsed={total_elapsed:.2f}s, last_error={last_error}"
        )
        if self._catalog_cache is not None:
            logger.warning("Using stale cache as fallback after all retries exhausted")
            return self._catalog_cache
        raise ProviderUnavailableError(
            "standard_ebooks",
            f"Catalog fetch failed after 3 attempts: {last_error}",
        )

    def _parse_opds_feed(self, xml_text: str) -> list[dict]:
        """Parse OPDS Atom feed XML into a list of book entry dicts.

        Extracts from each <entry>:
        - id: derived from the Atom <id> element (URL path segment)
        - title: from <title>
        - author: from <author>/<name>
        - language: from <dcterms:language> or defaults to "en"
        - url: the full Atom <id> URL
        - epub_url: the EPUB acquisition link
        - subjects: from <category> elements
        - formats: list of available format strings
        - publication_date: from <dcterms:issued>, <published>, or <updated>

        Args:
            xml_text: Raw XML string of the OPDS feed.

        Returns:
            List of dicts, one per catalog entry.
        """
        entries: list[dict] = []
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return entries

        for entry_el in root.findall(f"{{{ATOM_NS}}}entry"):
            title_el = entry_el.find(f"{{{ATOM_NS}}}title")
            author_el = entry_el.find(f"{{{ATOM_NS}}}author/{{{ATOM_NS}}}name")
            id_el = entry_el.find(f"{{{ATOM_NS}}}id")

            # Extract language from dcterms:language
            language = "en"
            lang_el = entry_el.find(f"{{{DCTERMS_NS}}}language")
            if lang_el is not None and lang_el.text:
                language = lang_el.text.strip()

            # Find EPUB acquisition link
            epub_url = ""
            formats: list[str] = []
            for link in entry_el.findall(f"{{{ATOM_NS}}}link"):
                href = link.get("href", "")
                link_type = link.get("type", "")
                link_rel = link.get("rel", "")

                # Track available formats from acquisition links
                if "acquisition" in link_rel or link_type.startswith("application/"):
                    if "epub" in link_type or href.endswith(".epub"):
                        if "epub" not in formats:
                            formats.append("epub")
                        if not epub_url:
                            epub_url = href
                            if not epub_url.startswith("http"):
                                epub_url = f"https://standardebooks.org{epub_url}"

            if not formats:
                formats = ["epub"]

            # Extract subjects from <category> elements
            subjects: list[str] = []
            for cat in entry_el.findall(f"{{{ATOM_NS}}}category"):
                term = cat.get("term", "")
                if term:
                    subjects.append(term)

            # Extract publication date (dcterms:issued, atom:published, or atom:updated)
            publication_date: Optional[str] = None
            issued_el = entry_el.find(f"{{{DCTERMS_NS}}}issued")
            if issued_el is not None and issued_el.text:
                publication_date = issued_el.text.strip()
            else:
                published_el = entry_el.find(f"{{{ATOM_NS}}}published")
                if published_el is not None and published_el.text:
                    publication_date = published_el.text.strip()
                else:
                    updated_el = entry_el.find(f"{{{ATOM_NS}}}updated")
                    if updated_el is not None and updated_el.text:
                        publication_date = updated_el.text.strip()

            # Derive a stable source_id from the Atom <id> URL
            entry_id = id_el.text if id_el is not None else ""
            # Use the URL path as a stable ID (e.g., "jane-austen/pride-and-prejudice")
            source_id = entry_id
            if "standardebooks.org/ebooks/" in entry_id:
                source_id = entry_id.split("standardebooks.org/ebooks/")[-1]
            elif "/" in entry_id:
                source_id = entry_id.split("/")[-1]

            entries.append(
                {
                    "id": source_id,
                    "title": title_el.text if title_el is not None else "Unknown",
                    "author": author_el.text if author_el is not None else "Unknown",
                    "language": language,
                    "url": entry_id,
                    "epub_url": epub_url,
                    "subjects": subjects,
                    "formats": formats,
                    "publication_date": publication_date,
                }
            )

        return entries
