"""Gutenberg catalog sync — downloads the full Gutendex catalog into local DB.

Paginates through gutendex.com/books/ (32 results per page, ~2300 pages)
and upserts each book into the gutenberg_books table.

Designed to run:
  - Once on first boot (if table is empty)
  - Nightly via Celery Beat at 3:00 AM UTC
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Optional

import httpx
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gutenberg_cache import GutenbergBook

logger = logging.getLogger(__name__)

GUTENDEX_BASE = "https://gutendex.com"
PAGE_SIZE = 32  # Gutendex returns 32 results per page
REQUEST_DELAY = 0.5  # Seconds between requests to be polite
MAX_RETRIES = 3
RETRY_DELAY = 5.0  # Seconds between retries on failure


async def sync_gutenberg_catalog(
    session_factory,
    full_resync: bool = False,
    progress_callback: Optional[callable] = None,
) -> dict:
    """Sync the full Gutenberg catalog from Gutendex into local DB.

    Args:
        session_factory: Async session factory for DB access.
        full_resync: If True, truncate and re-import everything.
                     If False, only fetch pages with new/updated books.
        progress_callback: Optional callable(current_page, total_pages, books_synced)
                          for progress reporting.

    Returns:
        Dict with sync stats: pages_fetched, books_upserted, errors, elapsed_seconds.
    """
    logger.info(
        "sync_gutenberg_catalog: starting, full_resync=%s",
        full_resync,
    )
    start_time = time.time()

    stats = {
        "pages_fetched": 0,
        "books_upserted": 0,
        "books_skipped": 0,
        "errors": 0,
        "elapsed_seconds": 0,
    }

    async with session_factory() as session:
        if full_resync:
            logger.info("sync_gutenberg_catalog: full resync — truncating gutenberg_books")
            await session.execute(text("TRUNCATE TABLE gutenberg_books"))
            await session.commit()

        # Get current count to estimate if this is first sync
        result = await session.execute(select(func.count(GutenbergBook.id)))
        current_count = result.scalar()
        logger.info("sync_gutenberg_catalog: current cached books=%d", current_count)

    # First, get total count from Gutendex
    total_count = await _get_total_count()
    if total_count is None:
        logger.error("sync_gutenberg_catalog: failed to get total count from Gutendex")
        return {**stats, "error": "Failed to connect to Gutendex"}

    total_pages = (total_count + PAGE_SIZE - 1) // PAGE_SIZE
    logger.info(
        "sync_gutenberg_catalog: Gutendex reports %d books, %d pages",
        total_count, total_pages,
    )

    # Paginate through all results
    page = 1
    consecutive_errors = 0
    max_consecutive_errors = 10

    async with httpx.AsyncClient(
        timeout=30.0,
        headers={"User-Agent": "CWOPOD-CatalogSync/1.0"},
        follow_redirects=True,
    ) as client:
        while page <= total_pages:
            books_data = await _fetch_page(client, page)

            if books_data is None:
                consecutive_errors += 1
                stats["errors"] += 1
                logger.warning(
                    "sync_gutenberg_catalog: page %d/%d failed (consecutive_errors=%d)",
                    page, total_pages, consecutive_errors,
                )
                if consecutive_errors >= max_consecutive_errors:
                    logger.error(
                        "sync_gutenberg_catalog: too many consecutive errors (%d), stopping",
                        consecutive_errors,
                    )
                    break
                await asyncio.sleep(RETRY_DELAY)
                continue

            # Reset consecutive error counter on success
            consecutive_errors = 0
            stats["pages_fetched"] += 1

            # Upsert books into DB
            if books_data:
                upserted = await _upsert_books(session_factory, books_data)
                stats["books_upserted"] += upserted

            # Progress reporting
            if progress_callback:
                try:
                    progress_callback(page, total_pages, stats["books_upserted"])
                except Exception as e:
                    logger.debug("sync_gutenberg_catalog: progress_callback error: %s", e)

            # Log progress every 100 pages
            if page % 100 == 0:
                elapsed = time.time() - start_time
                rate = stats["books_upserted"] / elapsed if elapsed > 0 else 0
                logger.info(
                    "sync_gutenberg_catalog: progress page=%d/%d, "
                    "books_upserted=%d, rate=%.1f books/sec, elapsed=%.0fs",
                    page, total_pages, stats["books_upserted"], rate, elapsed,
                )

            page += 1
            await asyncio.sleep(REQUEST_DELAY)

    stats["elapsed_seconds"] = round(time.time() - start_time, 1)
    logger.info(
        "sync_gutenberg_catalog: COMPLETE — pages=%d, books_upserted=%d, "
        "errors=%d, elapsed=%.1fs",
        stats["pages_fetched"], stats["books_upserted"],
        stats["errors"], stats["elapsed_seconds"],
    )
    return stats


async def _get_total_count() -> Optional[int]:
    """Get the total number of books from Gutendex (first page metadata)."""
    logger.debug("_get_total_count: fetching page 1 to get total count")
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": "CWOPOD-CatalogSync/1.0"},
                follow_redirects=True,
            ) as client:
                response = await client.get(f"{GUTENDEX_BASE}/books/", params={"page": 1})
                response.raise_for_status()
                data = response.json()
                count = data.get("count", 0)
                logger.info("_get_total_count: Gutendex total=%d", count)
                return count
        except Exception as e:
            logger.warning(
                "_get_total_count: attempt %d/%d failed: %s",
                attempt + 1, MAX_RETRIES, e,
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY)
    return None


async def _fetch_page(client: httpx.AsyncClient, page: int) -> Optional[list[dict]]:
    """Fetch a single page of results from Gutendex. Returns list of book dicts or None on failure."""
    for attempt in range(MAX_RETRIES):
        try:
            response = await client.get(
                f"{GUTENDEX_BASE}/books/",
                params={"page": page},
            )
            if response.status_code == 404:
                # Past the last page
                logger.debug("_fetch_page: page %d returned 404 — end of catalog", page)
                return []
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            logger.debug("_fetch_page: page %d returned %d results", page, len(results))
            return results
        except httpx.TimeoutException:
            logger.warning("_fetch_page: page %d timeout (attempt %d/%d)", page, attempt + 1, MAX_RETRIES)
        except httpx.HTTPStatusError as e:
            if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                logger.error("_fetch_page: page %d got %d — skipping", page, e.response.status_code)
                return []
            logger.warning(
                "_fetch_page: page %d HTTP %d (attempt %d/%d)",
                page, e.response.status_code, attempt + 1, MAX_RETRIES,
            )
        except Exception as e:
            logger.warning("_fetch_page: page %d error (attempt %d/%d): %s", page, attempt + 1, MAX_RETRIES, e)

        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(RETRY_DELAY)

    return None


async def _upsert_books(session_factory, books_data: list[dict]) -> int:
    """Upsert a batch of books into the gutenberg_books table. Returns count upserted."""
    if not books_data:
        return 0

    rows = []
    for book in books_data:
        gutenberg_id = book.get("id")
        if not gutenberg_id:
            continue

        # Extract author names
        authors = book.get("authors", [])
        author_str = ", ".join(a.get("name", "") for a in authors) if authors else None

        # Extract language
        languages = book.get("languages", [])
        language = languages[0] if languages else None

        # Extract subjects as JSON string
        subjects = book.get("subjects", [])
        subjects_json = json.dumps(subjects) if subjects else None

        # Try to extract publication year from author birth/death years or subjects
        publication_year = _extract_publication_year(book)

        rows.append({
            "id": uuid.uuid4(),
            "gutenberg_id": gutenberg_id,
            "title": book.get("title", "Unknown"),
            "author": author_str,
            "language": language,
            "publication_year": publication_year,
            "subjects": subjects_json,
            "media_type": book.get("media_type"),
            "download_count": book.get("download_count"),
        })

    if not rows:
        return 0

    async with session_factory() as session:
        # Use PostgreSQL upsert (INSERT ... ON CONFLICT DO UPDATE)
        stmt = pg_insert(GutenbergBook).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["gutenberg_id"],
            set_={
                "title": stmt.excluded.title,
                "author": stmt.excluded.author,
                "language": stmt.excluded.language,
                "publication_year": stmt.excluded.publication_year,
                "subjects": stmt.excluded.subjects,
                "media_type": stmt.excluded.media_type,
                "download_count": stmt.excluded.download_count,
                "updated_at": func.now(),
            },
        )
        await session.execute(stmt)
        await session.commit()

    return len(rows)


def _extract_publication_year(book: dict) -> Optional[int]:
    """Try to extract a publication year from Gutendex book data.

    Gutendex doesn't have a dedicated publication_year field, but we can
    sometimes infer it from subjects or bookshelves.
    """
    # Check subjects for year patterns like "1818" or "Published 1818"
    import re
    subjects = book.get("subjects", []) + book.get("bookshelves", [])
    for subject in subjects:
        # Look for 4-digit years in reasonable range
        matches = re.findall(r'\b(1[5-9]\d{2}|20[0-2]\d)\b', subject)
        if matches:
            # Take the earliest year found (likely publication date)
            years = [int(y) for y in matches]
            return min(years)

    return None


async def get_catalog_stats(session_factory) -> dict:
    """Get stats about the local catalog cache."""
    logger.debug("get_catalog_stats: querying catalog stats")
    async with session_factory() as session:
        total = await session.execute(select(func.count(GutenbergBook.id)))
        total_count = total.scalar()

        english = await session.execute(
            select(func.count(GutenbergBook.id)).where(GutenbergBook.language == "en")
        )
        english_count = english.scalar()

        with_year = await session.execute(
            select(func.count(GutenbergBook.id)).where(GutenbergBook.publication_year.isnot(None))
        )
        with_year_count = with_year.scalar()

        latest_update = await session.execute(
            select(func.max(GutenbergBook.updated_at))
        )
        last_synced = latest_update.scalar()

    stats = {
        "total_books": total_count,
        "english_books": english_count,
        "books_with_year": with_year_count,
        "last_synced": last_synced.isoformat() if last_synced else None,
    }
    logger.info("get_catalog_stats: %s", stats)
    return stats
