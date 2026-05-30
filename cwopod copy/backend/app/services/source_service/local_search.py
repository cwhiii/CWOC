"""Local search service — queries the cached gutenberg_books table.

Uses PostgreSQL trigram similarity for fuzzy matching, falling back to
ILIKE for simple substring search. Much faster than hitting Gutendex live.
"""

import json
import logging
import random
import time
from typing import Optional

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gutenberg_cache import GutenbergBook
from app.services.source_service.models import SearchResult

logger = logging.getLogger(__name__)


async def local_search_gutenberg(
    session: AsyncSession,
    query: str,
    limit: int = 50,
    language: Optional[str] = None,
) -> list[SearchResult]:
    """Search the local Gutenberg cache using trigram similarity.

    Uses pg_trgm similarity scoring on title and author fields.
    Results are ranked by combined similarity score + download popularity.

    Args:
        session: Async DB session.
        query: Search query string.
        limit: Max results to return.
        language: Optional language filter (ISO 639-1 code, e.g., "en").

    Returns:
        List of SearchResult objects from the local cache.
    """
    logger.info(
        "local_search_gutenberg: query=%r, limit=%d, language=%r",
        query, limit, language,
    )
    start_time = time.time()

    # Check if cache has data
    count_result = await session.execute(select(func.count(GutenbergBook.id)))
    cache_count = count_result.scalar()
    logger.debug("local_search_gutenberg: cache has %d books", cache_count)

    if cache_count == 0:
        logger.warning("local_search_gutenberg: cache is empty, returning no results")
        return []

    # Use trigram similarity for fuzzy matching
    # similarity() returns a float 0-1, higher = better match
    title_sim = func.similarity(GutenbergBook.title, query)
    author_sim = func.coalesce(func.similarity(GutenbergBook.author, query), 0)

    # Combined score: weight title higher than author
    combined_score = (title_sim * 0.7 + author_sim * 0.3)

    # Build query with similarity threshold
    stmt = (
        select(
            GutenbergBook,
            combined_score.label("score"),
        )
        .where(
            or_(
                title_sim > 0.15,
                author_sim > 0.15,
                GutenbergBook.title.ilike(f"%{query}%"),
                GutenbergBook.author.ilike(f"%{query}%"),
            )
        )
        .where(GutenbergBook.media_type != "Sound")  # Exclude audiobooks
    )

    if language:
        stmt = stmt.where(GutenbergBook.language == language)

    # Order by similarity score (best matches first), then by download popularity
    stmt = stmt.order_by(
        text("score DESC"),
        GutenbergBook.download_count.desc().nullslast(),
    ).limit(limit)

    result = await session.execute(stmt)
    rows = result.all()

    elapsed = time.time() - start_time
    logger.info(
        "local_search_gutenberg: found %d results in %.3fs for query=%r",
        len(rows), elapsed, query,
    )

    # Convert to SearchResult objects
    results = []
    for row in rows:
        book = row[0]  # GutenbergBook instance
        score = row[1]  # similarity score

        # Parse subjects from JSON string
        subjects = []
        if book.subjects:
            try:
                subjects = json.loads(book.subjects)[:5]
            except (json.JSONDecodeError, TypeError):
                pass

        results.append(
            SearchResult(
                source_id=str(book.gutenberg_id),
                provider_id="gutenberg",
                provider_name="Project Gutenberg",
                quality_label="community digitized",
                title=book.title,
                author=book.author or "Unknown",
                language=book.language or "en",
                publication_year=book.publication_year,
                subjects=subjects,
                available_formats=[],
                source_url=f"https://www.gutenberg.org/ebooks/{book.gutenberg_id}",
                media_type=book.media_type,
                download_count=book.download_count,
            )
        )

    return results


async def get_random_book(
    session: AsyncSession,
    language: Optional[str] = "en",
) -> Optional[SearchResult]:
    """Get a random book from the local Gutenberg cache.

    Selects a random text-type book (excludes audiobooks) from the cache.
    Prefers English books by default but can be overridden.

    Args:
        session: Async DB session.
        language: Language filter. Pass None for any language.

    Returns:
        A single SearchResult, or None if cache is empty.
    """
    logger.info("get_random_book: language=%r", language)
    start_time = time.time()

    # Use TABLESAMPLE for efficient random selection on large tables,
    # but fall back to ORDER BY RANDOM() for correctness
    stmt = select(GutenbergBook).where(
        GutenbergBook.media_type != "Sound",
    )

    if language:
        stmt = stmt.where(GutenbergBook.language == language)

    # Filter to books with reasonable download counts (avoid obscure fragments)
    stmt = stmt.where(GutenbergBook.download_count > 10)

    # ORDER BY RANDOM() LIMIT 1 — fine for ~74k rows
    stmt = stmt.order_by(func.random()).limit(1)

    result = await session.execute(stmt)
    book = result.scalar_one_or_none()

    elapsed = time.time() - start_time
    logger.info(
        "get_random_book: found=%s, elapsed=%.3fs",
        book is not None, elapsed,
    )

    if book is None:
        logger.warning("get_random_book: no books found in cache")
        return None

    # Parse subjects
    subjects = []
    if book.subjects:
        try:
            subjects = json.loads(book.subjects)[:5]
        except (json.JSONDecodeError, TypeError):
            pass

    return SearchResult(
        source_id=str(book.gutenberg_id),
        provider_id="gutenberg",
        provider_name="Project Gutenberg",
        quality_label="community digitized",
        title=book.title,
        author=book.author or "Unknown",
        language=book.language or "en",
        publication_year=book.publication_year,
        subjects=subjects,
        available_formats=[],
        source_url=f"https://www.gutenberg.org/ebooks/{book.gutenberg_id}",
        media_type=book.media_type,
        download_count=book.download_count,
    )


async def is_cache_populated(session: AsyncSession, min_threshold: int = 10000) -> bool:
    """Check if the local Gutenberg cache has enough data to be trustworthy.

    The full Gutenberg catalog has ~70,000+ books. If the cache has fewer than
    min_threshold entries, it's likely an incomplete sync and we should fall back
    to the live Gutendex API instead of returning empty results.

    Args:
        session: Async DB session.
        min_threshold: Minimum number of cached books to consider the cache
                       reliable. Default 10,000.

    Returns:
        True if cache has at least min_threshold books, False otherwise.
    """
    result = await session.execute(select(func.count(GutenbergBook.id)))
    count = result.scalar()
    logger.debug("is_cache_populated: count=%d, threshold=%d", count, min_threshold)
    if count > 0 and count < min_threshold:
        logger.warning(
            "is_cache_populated: cache has only %d books (threshold=%d), "
            "treating as incomplete — will fall back to live API",
            count, min_threshold,
        )
    return count >= min_threshold
