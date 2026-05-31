"""Celery tasks for source service: catalog sync."""

import asyncio
import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="source_service.sync_gutenberg_catalog",
    soft_time_limit=7200,   # 2 hours soft limit (full sync is ~2300 pages)
    time_limit=7500,        # 2.5 hours hard limit
)
def sync_gutenberg_catalog_task(self, full_resync: bool = False) -> dict:
    """Background task that syncs the Gutenberg catalog from Gutendex.

    Paginates through the entire Gutendex API and upserts book metadata
    into the local gutenberg_books table for instant search.

    Args:
        full_resync: If True, truncate table and re-import everything.
                     If False (default), upsert only (incremental update).

    Returns:
        Dict with sync stats.
    """
    logger.info(
        "sync_gutenberg_catalog_task: starting, full_resync=%s, task_id=%s",
        full_resync, self.request.id,
    )

    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            _sync_catalog_async(self, full_resync)
        )
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.run_until_complete(loop.shutdown_default_executor())
        finally:
            asyncio.set_event_loop(None)
            loop.close()


async def _sync_catalog_async(task, full_resync: bool) -> dict:
    """Async implementation of the catalog sync task."""
    from app.database import create_worker_session
    from app.services.source_service.catalog_sync import sync_gutenberg_catalog

    logger.debug("_sync_catalog_async: creating worker session")
    worker_session, worker_engine = create_worker_session()

    try:
        def progress_callback(current_page, total_pages, books_synced):
            """Report progress to Celery state."""
            percent = round((current_page / total_pages) * 100) if total_pages > 0 else 0
            task.update_state(
                state="PROGRESS",
                meta={
                    "current_page": current_page,
                    "total_pages": total_pages,
                    "books_synced": books_synced,
                    "percent": percent,
                },
            )

        result = await sync_gutenberg_catalog(
            session_factory=worker_session,
            full_resync=full_resync,
            progress_callback=progress_callback,
        )

        logger.info("_sync_catalog_async: sync complete, result=%s", result)
        return result

    finally:
        await worker_engine.dispose()
        logger.debug("_sync_catalog_async: worker engine disposed")


@celery_app.task(
    name="source_service.sync_gutenberg_catalog_if_empty",
    soft_time_limit=7200,
    time_limit=7500,
)
def sync_gutenberg_catalog_if_empty_task() -> dict:
    """Sync the catalog if the local cache is empty or incomplete.

    This is called on app startup to populate the cache if it hasn't been
    fully populated yet. If the cache already has enough data (>= 10,000 books),
    it's a no-op. If it has a partial sync (e.g., 64 books from a failed run),
    it will re-sync.
    """
    logger.info("sync_gutenberg_catalog_if_empty_task: checking if cache needs sync")

    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_sync_if_empty_async())
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.run_until_complete(loop.shutdown_default_executor())
        finally:
            asyncio.set_event_loop(None)
            loop.close()


async def _sync_if_empty_async() -> dict:
    """Check if cache is incomplete and sync if so."""
    from sqlalchemy import func, select

    from app.database import create_worker_session
    from app.models.gutenberg_cache import GutenbergBook
    from app.services.source_service.catalog_sync import sync_gutenberg_catalog

    # Same threshold as is_cache_populated — below this, the cache is incomplete
    MIN_CACHE_THRESHOLD = 10000

    worker_session, worker_engine = create_worker_session()

    try:
        async with worker_session() as session:
            result = await session.execute(select(func.count(GutenbergBook.id)))
            count = result.scalar()

        if count >= MIN_CACHE_THRESHOLD:
            logger.info(
                "sync_gutenberg_catalog_if_empty_task: cache has %d books (>= %d threshold), skipping sync",
                count, MIN_CACHE_THRESHOLD,
            )
            return {"status": "skipped", "existing_count": count}

        logger.info(
            "sync_gutenberg_catalog_if_empty_task: cache has %d books (< %d threshold), starting sync",
            count, MIN_CACHE_THRESHOLD,
        )
        result = await sync_gutenberg_catalog(
            session_factory=worker_session,
            full_resync=False,
        )
        return result

    finally:
        await worker_engine.dispose()
