"""Synopsis lookup service: fetches book descriptions from Open Library and Google Books."""

import logging
import asyncio
import re
from typing import Optional
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
OPEN_LIBRARY_WORKS_URL = "https://openlibrary.org/works"
OPEN_LIBRARY_ISBN_URL = "https://openlibrary.org/isbn"
GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

REQUEST_TIMEOUT = 10.0
DEFAULT_HEADERS = {
    "User-Agent": "CWOPOD/1.0 (book cover tool; contact: admin@localhost)",
    "Accept": "application/json",
}


def _normalize_author(author: Optional[str]) -> Optional[str]:
    """Normalize author name from 'Last, First (Full)' format to 'First Last'.

    Gutenberg stores authors as 'Nesbit, E. (Edith)' but search APIs expect
    'E. Nesbit' or 'Edith Nesbit'. This converts common catalog formats.

    Examples:
        'Nesbit, E. (Edith)' -> 'E. Nesbit'
        'Twain, Mark' -> 'Mark Twain'
        'Doyle, Arthur Conan' -> 'Arthur Conan Doyle'
        'E. Nesbit' -> 'E. Nesbit' (already normal, no change)
    """
    if not author:
        return None

    author = author.strip()
    logger.debug("_normalize_author: input=%r", author)

    # Strip parenthetical suffixes like '(Edith)' — the short form before the comma is fine
    author = re.sub(r"\s*\([^)]*\)\s*$", "", author).strip()

    # If it contains a comma, assume 'Last, First' format
    if "," in author:
        parts = [p.strip() for p in author.split(",", 1)]
        if len(parts) == 2 and parts[1]:
            normalized = f"{parts[1]} {parts[0]}"
            logger.debug("_normalize_author: normalized=%r", normalized)
            return normalized

    logger.debug("_normalize_author: no change needed, result=%r", author)
    return author


@dataclass
class SynopsisResult:
    """Result from a synopsis lookup attempt."""

    synopsis: str
    source: str  # "open_library" or "google_books"
    word_count: int


class SynopsisLookupService:
    """Looks up book synopses from Open Library and Google Books (free, no API key required)."""

    async def lookup(
        self, title: str, author: Optional[str] = None, isbn: Optional[str] = None
    ) -> Optional[SynopsisResult]:
        """Look up a synopsis. Tries Open Library first, falls back to Google Books.

        Args:
            title: Book title
            author: Author name (optional but improves accuracy)
            isbn: ISBN if available (most precise lookup)

        Returns:
            SynopsisResult if found, None otherwise
        """
        author = _normalize_author(author)
        logger.info(
            "synopsis_lookup: starting lookup title=%r, author=%r, isbn=%r",
            title, author, isbn,
        )

        # Try Open Library first (better for older/public domain works)
        result = await self._try_open_library(title, author, isbn)
        if result:
            logger.info(
                "synopsis_lookup: found via Open Library, word_count=%d",
                result.word_count,
            )
            return result

        # Fall back to Google Books (better for modern titles)
        result = await self._try_google_books(title, author, isbn)
        if result:
            logger.info(
                "synopsis_lookup: found via Google Books, word_count=%d",
                result.word_count,
            )
            return result

        logger.info("synopsis_lookup: no synopsis found from any source")
        return None

    async def lookup_all(
        self, title: str, author: Optional[str] = None, isbn: Optional[str] = None
    ) -> list[SynopsisResult]:
        """Look up synopses from all sources in parallel. Returns all found results.

        Useful for letting the user choose between multiple descriptions.
        """
        author = _normalize_author(author)
        logger.info(
            "synopsis_lookup_all: starting parallel lookup title=%r, author=%r, isbn=%r",
            title, author, isbn,
        )

        results = await asyncio.gather(
            self._try_open_library(title, author, isbn),
            self._try_google_books(title, author, isbn),
            return_exceptions=True,
        )

        found = []
        for r in results:
            if isinstance(r, SynopsisResult):
                found.append(r)
            elif isinstance(r, Exception):
                logger.warning("synopsis_lookup_all: provider error: %s", r)

        logger.info("synopsis_lookup_all: found %d results", len(found))
        return found

    async def _try_open_library(
        self, title: str, author: Optional[str], isbn: Optional[str]
    ) -> Optional[SynopsisResult]:
        """Try to get a description from Open Library."""
        logger.debug("synopsis_lookup: trying Open Library")

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, headers=DEFAULT_HEADERS) as client:
                # If we have an ISBN, try direct lookup first
                if isbn:
                    description = await self._open_library_by_isbn(client, isbn)
                    if description:
                        return SynopsisResult(
                            synopsis=description,
                            source="open_library",
                            word_count=len(description.split()),
                        )

                # Strategy: try general 'q' search first (most forgiving), then title-specific
                searches_to_try = []

                # 1. General query (best for fuzzy matching)
                q_query = title
                if author:
                    q_query += f" {author}"
                searches_to_try.append({"q": q_query, "limit": 5})

                # 2. Title-specific search
                title_params = {"title": title, "limit": 5}
                if author:
                    title_params["author"] = author
                searches_to_try.append(title_params)

                # 3. Title-only (if author was specified, try without)
                if author:
                    searches_to_try.append({"title": title, "limit": 5})

                for params in searches_to_try:
                    logger.debug("synopsis_lookup: Open Library search params=%s", params)
                    resp = await client.get(OPEN_LIBRARY_SEARCH_URL, params=params)
                    resp.raise_for_status()
                    data = resp.json()

                    docs = data.get("docs", [])
                    logger.debug("synopsis_lookup: Open Library returned %d docs", len(docs))

                    result = await self._search_open_library_docs(client, docs)
                    if result:
                        return result

                logger.debug("synopsis_lookup: Open Library — no description found in results")
                return None

        except httpx.HTTPError as e:
            logger.warning("synopsis_lookup: Open Library HTTP error: %s", e)
            return None
        except Exception as e:
            logger.error("synopsis_lookup: Open Library unexpected error: %s", e)
            return None

    async def _search_open_library_docs(
        self, client: httpx.AsyncClient, docs: list
    ) -> Optional[SynopsisResult]:
        """Iterate Open Library search docs and return the first one with a description."""
        for doc in docs:
            work_key = doc.get("key")
            if not work_key:
                continue

            # Fetch the work details for the full description
            work_url = f"https://openlibrary.org{work_key}.json"
            logger.debug("synopsis_lookup: fetching work details: %s", work_url)
            work_resp = await client.get(work_url)

            if work_resp.status_code != 200:
                continue

            work_data = work_resp.json()
            description = work_data.get("description")

            if description:
                # Description can be a string or a dict with "value" key
                if isinstance(description, dict):
                    description = description.get("value", "")
                if isinstance(description, str) and len(description.strip()) > 30:
                    synopsis = description.strip()
                    logger.debug(
                        "synopsis_lookup: found description from work %s, word_count=%d",
                        work_key, len(synopsis.split()),
                    )
                    return SynopsisResult(
                        synopsis=synopsis,
                        source="open_library",
                        word_count=len(synopsis.split()),
                    )

        return None

    async def _open_library_by_isbn(self, client: httpx.AsyncClient, isbn: str) -> Optional[str]:
        """Direct ISBN lookup on Open Library."""
        logger.debug("synopsis_lookup: Open Library ISBN lookup: %s", isbn)
        try:
            url = f"{OPEN_LIBRARY_ISBN_URL}/{isbn}.json"
            resp = await client.get(url)
            if resp.status_code != 200:
                return None

            data = resp.json()

            # The ISBN endpoint returns an edition; follow the work link for description
            works = data.get("works", [])
            if works:
                work_key = works[0].get("key")
                if work_key:
                    work_resp = await client.get(f"https://openlibrary.org{work_key}.json")
                    if work_resp.status_code == 200:
                        work_data = work_resp.json()
                        description = work_data.get("description")
                        if description:
                            if isinstance(description, dict):
                                description = description.get("value", "")
                            if isinstance(description, str) and len(description.strip()) > 30:
                                return description.strip()

            # Check edition-level description
            description = data.get("description")
            if description:
                if isinstance(description, dict):
                    description = description.get("value", "")
                if isinstance(description, str) and len(description.strip()) > 30:
                    return description.strip()

            return None
        except Exception as e:
            logger.debug("synopsis_lookup: ISBN lookup failed: %s", e)
            return None

    async def _try_google_books(
        self, title: str, author: Optional[str], isbn: Optional[str]
    ) -> Optional[SynopsisResult]:
        """Try to get a description from Google Books API (free, no key required)."""
        logger.debug("synopsis_lookup: trying Google Books")

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, headers=DEFAULT_HEADERS) as client:
                # Build query — try structured first, then plain
                queries = []
                if isbn:
                    queries.append(f"isbn:{isbn}")
                else:
                    # Structured query
                    structured = f"intitle:{title}"
                    if author:
                        structured += f'+inauthor:"{author}"'
                    queries.append(structured)
                    # Plain query as fallback
                    plain = title
                    if author:
                        plain += f" {author}"
                    queries.append(plain)

                for query in queries:
                    params = {"q": query, "maxResults": 5}
                    logger.debug("synopsis_lookup: Google Books query=%s", query)

                    resp = await client.get(GOOGLE_BOOKS_URL, params=params)
                    resp.raise_for_status()
                    data = resp.json()

                    items = data.get("items", [])
                    logger.debug("synopsis_lookup: Google Books returned %d items", len(items))

                    for item in items:
                        volume_info = item.get("volumeInfo", {})
                        description = volume_info.get("description")

                        if description and len(description.strip()) > 30:
                            synopsis = description.strip()
                            return SynopsisResult(
                                synopsis=synopsis,
                                source="google_books",
                                word_count=len(synopsis.split()),
                            )

                logger.debug("synopsis_lookup: Google Books — no description found")
                return None

        except httpx.HTTPError as e:
            logger.warning("synopsis_lookup: Google Books HTTP error: %s", e)
            return None
        except Exception as e:
            logger.error("synopsis_lookup: Google Books unexpected error: %s", e)
            return None
