"""Search router: federated book search across all enabled sources."""

import asyncio
import csv
import io
import json
import logging
import time

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.print_service.credential_service import CredentialService
from app.services.source_service.base import ProviderUnavailableError
from app.services.source_service.local_search import (
    get_random_book,
    is_cache_populated,
    local_search_gutenberg,
)
from app.services.source_service.registry import provider_registry
from app.services.source_service.search_service import SearchService

logger = logging.getLogger(__name__)


class SearchResultOut(BaseModel):
    source_id: str
    provider_id: str
    provider_name: str
    quality_label: str
    title: str
    author: str
    language: str
    subjects: list[str]
    source_url: str
    media_type: str | None = None
    download_count: int | None = None


class ProviderStatusOut(BaseModel):
    provider_id: str
    provider_name: str
    status: str
    result_count: int = 0
    error_message: str | None = None


class SearchResponse(BaseModel):
    results: list[SearchResultOut]
    total_count: int
    providers_queried: list[str]
    provider_details: list[ProviderStatusOut]
    providers_failed: list[ProviderStatusOut]


router = APIRouter()


@router.get("/", response_model=SearchResponse)
async def search_books(
    q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for books across all enabled sources."""
    logger.info(f"Search request: q={q!r}, user_id={current_user.id}")

    # Load Standard Ebooks credentials from DB and inject into provider
    cred_service = CredentialService(db, current_user.id)
    se_creds = await cred_service.get_credentials("standard_ebooks")
    if se_creds and se_creds.get("email"):
        from app.services.source_service.registry import provider_registry
        se_provider = provider_registry.get_all_providers().get("standard_ebooks")
        if se_provider:
            se_provider._auth_email = se_creds["email"]
            logger.info(f"Standard Ebooks auth loaded from settings: email={se_creds['email']}")
    else:
        logger.debug("No Standard Ebooks credentials configured in settings")

    service = SearchService()

    # Use local cache for Gutenberg if available (much faster, fuzzy search)
    cache_ready = await is_cache_populated(db)
    if cache_ready:
        logger.info(f"Search: using local Gutenberg cache for q={q!r}")
        response = await service.search(q, use_local_gutenberg=True, db_session=db)
    else:
        logger.info(f"Search: Gutenberg cache empty, using live API for q={q!r}")
        response = await service.search(q)

    logger.info(
        f"Search complete: q={q!r}, results={response.total_count}, "
        f"providers_queried={response.providers_queried}, "
        f"providers_failed={[p.provider_id for p in response.providers_failed]}"
    )

    return SearchResponse(
        results=[
            SearchResultOut(
                source_id=r.source_id,
                provider_id=r.provider_id,
                provider_name=r.provider_name,
                quality_label=r.quality_label,
                title=r.title,
                author=r.author,
                language=r.language,
                subjects=r.subjects,
                source_url=r.source_url,
                media_type=r.media_type,
                download_count=r.download_count,
            )
            for r in response.results
            if r.media_type != "Sound"
        ],
        total_count=response.total_count,
        providers_queried=response.providers_queried,
        provider_details=[
            ProviderStatusOut(
                provider_id=p.provider_id,
                provider_name=p.provider_name,
                status=p.status,
                result_count=p.result_count,
                error_message=p.error_message,
            )
            for p in response.provider_details
        ],
        providers_failed=[
            ProviderStatusOut(
                provider_id=p.provider_id,
                provider_name=p.provider_name,
                status=p.status,
                result_count=p.result_count,
                error_message=p.error_message,
            )
            for p in response.providers_failed
        ],
    )


@router.get("/stream")
async def search_books_stream(
    q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    mode: str = Query("auto", description="Search mode: 'auto' (use cache if ready), 'live' (always hit live API), 'cache' (always use local cache)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream search results per-provider as each completes (SSE).

    Emits events:
      - provider_start: {provider_id, provider_name} — when a provider search begins
      - provider_done: {provider_id, provider_name, results: [...]} — when a provider finishes
      - provider_error: {provider_id, provider_name, error} — when a provider fails
      - complete: {} — all providers finished

    Query params:
      - mode: 'auto' (default) uses cache if populated above threshold,
              'live' always hits the live Gutendex API,
              'cache' always uses the local DB cache.
    """
    logger.info(f"Streaming search request: q={q!r}, mode={mode!r}, user_id={current_user.id}")

    # Load Standard Ebooks credentials
    cred_service = CredentialService(db, current_user.id)
    se_creds = await cred_service.get_credentials("standard_ebooks")
    if se_creds and se_creds.get("email"):
        se_provider = provider_registry.get_all_providers().get("standard_ebooks")
        if se_provider:
            se_provider._auth_email = se_creds["email"]
            logger.info(f"Standard Ebooks auth loaded from settings: email={se_creds['email']}")

    providers = provider_registry.get_enabled_providers()
    logger.info(
        f"Streaming search: enabled providers={[p.provider_id for p in providers]}, "
        f"query={q!r}"
    )

    async def event_generator():
        """Generate SSE events as each provider completes."""
        logger.debug(f"SSE event_generator started for query={q!r}")

        if not providers:
            logger.warning("No enabled providers — sending complete immediately")
            yield f"data: {json.dumps({'event': 'complete', 'providers_queried': []})}\n\n"
            return

        # Emit provider_start for all providers so frontend knows what to expect
        provider_names = []
        for provider in providers:
            provider_names.append({
                "provider_id": provider.provider_id,
                "provider_name": provider.display_name,
            })
        yield f"data: {json.dumps({'event': 'search_start', 'providers': provider_names})}\n\n"

        # Create tasks for each provider
        async def search_one(provider):
            """Search a single provider and return (provider, results_or_exception).

            For Gutenberg: respects the 'mode' query param:
              - 'auto': uses local DB cache if populated above threshold
              - 'live': always hits the live Gutendex API
              - 'cache': always uses the local DB cache
            For other providers: hits their API directly.
            """
            wrapper_timeout = 150.0
            logger.info(f"SSE: Starting search for provider={provider.provider_id}, mode={mode!r}")
            start_time = time.time()
            try:
                # Use local cache for Gutenberg based on mode
                if provider.provider_id == "gutenberg":
                    use_cache = False
                    if mode == "cache":
                        use_cache = True
                        logger.info("SSE: mode=cache, forcing LOCAL cache for Gutenberg")
                    elif mode == "live":
                        use_cache = False
                        logger.info("SSE: mode=live, forcing LIVE API for Gutenberg")
                    else:
                        # auto mode — use cache if populated above threshold
                        cache_ready = await is_cache_populated(db)
                        if cache_ready:
                            use_cache = True
                            logger.info("SSE: mode=auto, cache ready — using LOCAL cache")
                        else:
                            logger.info("SSE: mode=auto, cache incomplete — falling back to live API")

                    if use_cache:
                        results = await local_search_gutenberg(db, q)
                        elapsed = time.time() - start_time
                        logger.info(
                            f"SSE: Gutenberg LOCAL search done: "
                            f"results={len(results)}, elapsed={elapsed:.2f}s"
                        )
                        return (provider, results)
                    else:
                        logger.info("SSE: Using LIVE Gutendex API for Gutenberg search")

                results = await asyncio.wait_for(
                    provider.search(q), timeout=wrapper_timeout
                )
                elapsed = time.time() - start_time
                logger.info(
                    f"SSE: Provider done: provider={provider.provider_id}, "
                    f"results={len(results)}, elapsed={elapsed:.2f}s"
                )
                return (provider, results)
            except asyncio.TimeoutError:
                elapsed = time.time() - start_time
                logger.error(
                    f"SSE: Provider TIMEOUT: provider={provider.provider_id}, "
                    f"elapsed={elapsed:.2f}s"
                )
                return (provider, ProviderUnavailableError(provider.provider_id, "Search timed out"))
            except Exception as e:
                elapsed = time.time() - start_time
                logger.error(
                    f"SSE: Provider ERROR: provider={provider.provider_id}, "
                    f"error={e}, elapsed={elapsed:.2f}s",
                    exc_info=e,
                )
                return (provider, e)

        # Use asyncio.as_completed to yield results as each provider finishes
        tasks = [asyncio.create_task(search_one(p)) for p in providers]
        pending = set(tasks)

        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                provider, result = task.result()
                if isinstance(result, (ProviderUnavailableError, Exception)):
                    error_msg = result.message if isinstance(result, ProviderUnavailableError) else str(result)
                    logger.info(
                        f"SSE: Emitting provider_error for {provider.provider_id}: {error_msg}"
                    )
                    yield f"data: {json.dumps({'event': 'provider_error', 'provider_id': provider.provider_id, 'provider_name': provider.display_name, 'error': error_msg})}\n\n"
                else:
                    logger.info(
                        f"SSE: Emitting provider_done for {provider.provider_id}: "
                        f"{len(result)} results"
                    )
                    serialized_results = [
                        {
                            "source_id": r.source_id,
                            "provider_id": r.provider_id,
                            "provider_name": r.provider_name,
                            "quality_label": r.quality_label,
                            "title": r.title,
                            "author": r.author,
                            "language": r.language,
                            "subjects": r.subjects,
                            "source_url": r.source_url,
                            "publication_year": r.publication_year,
                            "media_type": r.media_type,
                            "download_count": r.download_count,
                        }
                        for r in result
                        if r.media_type != "Sound"
                    ]
                    # Collect audiobook entries separately (not importable)
                    audiobook_results = [
                        {
                            "title": r.title,
                            "author": r.author,
                            "source_url": r.source_url,
                            "source_id": r.source_id,
                        }
                        for r in result
                        if r.media_type == "Sound"
                    ]
                    yield f"data: {json.dumps({'event': 'provider_done', 'provider_id': provider.provider_id, 'provider_name': provider.display_name, 'result_count': len(serialized_results), 'results': serialized_results, 'audiobooks': audiobook_results})}\n\n"

        logger.info(f"SSE: All providers complete for query={q!r}")
        yield f"data: {json.dumps({'event': 'complete'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Random Book ---


@router.get("/random")
async def get_random_book_endpoint(
    language: str = Query("en", description="Language filter (ISO 639-1 code, e.g., 'en'). Pass empty string for any."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a random book from the local Gutenberg catalog cache.

    Returns a single random book suitable for discovery/exploration.
    Only returns books with >10 downloads to avoid obscure fragments.
    """
    logger.info(f"Random book request: language={language!r}, user_id={current_user.id}")

    lang_filter = language if language else None

    # Check if cache is populated
    cache_ready = await is_cache_populated(db)
    if not cache_ready:
        logger.warning("Random book requested but cache is empty")
        raise HTTPException(
            status_code=503,
            detail="Gutenberg catalog cache is not yet populated. It will be available shortly after first boot.",
        )

    result = await get_random_book(db, language=lang_filter)
    if result is None:
        raise HTTPException(status_code=404, detail="No books found matching criteria.")

    logger.info(f"Random book result: title={result.title!r}, author={result.author!r}, id={result.source_id}")

    return {
        "source_id": result.source_id,
        "provider_id": result.provider_id,
        "provider_name": result.provider_name,
        "quality_label": result.quality_label,
        "title": result.title,
        "author": result.author,
        "language": result.language,
        "subjects": result.subjects,
        "source_url": result.source_url,
        "publication_year": result.publication_year,
        "media_type": result.media_type,
        "download_count": result.download_count,
    }


# --- Catalog Cache Status & Sync ---


@router.get("/catalog/status")
async def get_catalog_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the status of the local Gutenberg catalog cache."""
    logger.info(f"Catalog status request: user_id={current_user.id}")

    from app.services.source_service.catalog_sync import get_catalog_stats
    from app.database import async_session

    stats = await get_catalog_stats(async_session)
    return stats


@router.post("/catalog/sync")
async def trigger_catalog_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a Gutenberg catalog sync (admin only).

    This queues a background task to re-sync the catalog from Gutendex.
    """
    logger.info(f"Manual catalog sync requested: user_id={current_user.id}")

    # Check if user is admin
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.services.source_service.tasks import sync_gutenberg_catalog_task
    task = sync_gutenberg_catalog_task.delay(full_resync=False)

    logger.info(f"Catalog sync task queued: task_id={task.id}")
    return {"task_id": task.id, "status": "queued"}


@router.get("/catalog/export")
async def export_catalog(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export the local Gutenberg catalog cache as a CSV file for backup/seeding.

    Returns a streaming CSV download with all cached book metadata.
    """
    logger.info(f"Catalog export request: user_id={current_user.id}")

    from sqlalchemy import select
    from app.models.gutenberg_cache import GutenbergBook

    result = await db.execute(select(GutenbergBook).order_by(GutenbergBook.gutenberg_id))
    books = result.scalars().all()

    logger.info(f"Catalog export: streaming {len(books)} books as CSV")

    def generate_csv():
        """Stream CSV rows one at a time to avoid loading everything into memory."""
        output = io.StringIO()
        writer = csv.writer(output)
        # Header row
        writer.writerow([
            "gutenberg_id", "title", "author", "language",
            "publication_year", "subjects", "media_type", "download_count",
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for book in books:
            writer.writerow([
                book.gutenberg_id,
                book.title,
                book.author or "",
                book.language or "",
                book.publication_year or "",
                book.subjects or "",
                book.media_type or "",
                book.download_count or "",
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gutenberg_catalog.csv"},
    )


@router.post("/catalog/import")
async def import_catalog(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a Gutenberg catalog CSV file to seed/replace the local cache.

    Accepts a CSV file previously exported via /catalog/export.
    Truncates the existing cache and replaces it with the imported data.
    """
    logger.info(f"Catalog import request: user_id={current_user.id}, filename={file.filename}")

    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    import uuid
    from sqlalchemy import text, func, select
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.gutenberg_cache import GutenbergBook

    # Read the entire file (catalog CSV is ~15-20 MB, fits in memory)
    content = await file.read()
    logger.info(f"Catalog import: read {len(content)} bytes from uploaded file")

    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text_content))

    # Validate header
    expected_fields = {"gutenberg_id", "title"}
    if not expected_fields.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must have at least columns: {expected_fields}. Got: {reader.fieldnames}",
        )

    # Parse rows
    rows = []
    parse_errors = 0
    for i, row in enumerate(reader):
        try:
            gutenberg_id = int(row["gutenberg_id"])
        except (ValueError, TypeError):
            parse_errors += 1
            continue

        title = row.get("title", "").strip()
        if not title:
            parse_errors += 1
            continue

        pub_year = row.get("publication_year", "").strip()
        download_count = row.get("download_count", "").strip()

        rows.append({
            "id": uuid.uuid4(),
            "gutenberg_id": gutenberg_id,
            "title": title,
            "author": row.get("author", "").strip() or None,
            "language": row.get("language", "").strip() or None,
            "publication_year": int(pub_year) if pub_year else None,
            "subjects": row.get("subjects", "").strip() or None,
            "media_type": row.get("media_type", "").strip() or None,
            "download_count": int(download_count) if download_count else None,
        })

    logger.info(
        f"Catalog import: parsed {len(rows)} valid rows, {parse_errors} parse errors"
    )

    if len(rows) == 0:
        raise HTTPException(status_code=400, detail="No valid rows found in CSV")

    # Truncate and bulk insert
    logger.info("Catalog import: truncating gutenberg_books table")
    await db.execute(text("TRUNCATE TABLE gutenberg_books"))

    # Insert in batches of 1000
    batch_size = 1000
    total_inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        stmt = pg_insert(GutenbergBook).values(batch)
        await db.execute(stmt)
        total_inserted += len(batch)

    await db.commit()

    # Verify
    count_result = await db.execute(select(func.count(GutenbergBook.id)))
    final_count = count_result.scalar()

    logger.info(
        f"Catalog import COMPLETE: inserted={total_inserted}, "
        f"final_count={final_count}, parse_errors={parse_errors}"
    )

    return {
        "status": "success",
        "books_imported": total_inserted,
        "final_count": final_count,
        "parse_errors": parse_errors,
    }


# --- Source Provider Credentials ---


class SourceCredentialRequest(BaseModel):
    provider: str
    credentials: dict


class SourceCredentialStatus(BaseModel):
    provider: str
    provider_name: str
    configured: bool
    description: str


@router.get("/credentials")
async def get_source_credentials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List source provider credential status (does not return actual values)."""
    logger.info(f"get_source_credentials: user_id={current_user.id}")

    cred_service = CredentialService(db, current_user.id)
    configured = await cred_service.list_configured_providers()

    return {
        "providers": [
            {
                "provider": "standard_ebooks",
                "provider_name": "Standard Ebooks",
                "configured": "standard_ebooks" in configured,
                "description": "Patrons Circle email for OPDS catalog access",
            },
        ]
    }


@router.post("/credentials")
async def store_source_credentials(
    body: SourceCredentialRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store credentials for a source provider."""
    logger.info(f"store_source_credentials: provider={body.provider}, user_id={current_user.id}")

    if body.provider == "standard_ebooks":
        if "email" not in body.credentials or not body.credentials["email"].strip():
            raise HTTPException(
                status_code=422,
                detail="Standard Ebooks credentials require an 'email' field (your Patrons Circle email).",
            )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown source provider: {body.provider}")

    cred_service = CredentialService(db, current_user.id)
    await cred_service.store_credentials(body.provider, body.credentials)

    logger.info(f"store_source_credentials: stored for provider={body.provider}")
    return {"provider": body.provider, "status": "stored"}


@router.delete("/credentials/{provider}")
async def delete_source_credentials(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete stored credentials for a source provider."""
    logger.info(f"delete_source_credentials: provider={provider}, user_id={current_user.id}")

    if provider not in ("standard_ebooks",):
        raise HTTPException(status_code=400, detail=f"Unknown source provider: {provider}")

    cred_service = CredentialService(db, current_user.id)
    await cred_service.delete_credentials(provider)

    # Clear the in-memory auth on the provider
    from app.services.source_service.registry import provider_registry
    se_provider = provider_registry.get_all_providers().get("standard_ebooks")
    if se_provider:
        se_provider._auth_email = None
        logger.info("Standard Ebooks auth cleared from provider instance")

    return {"provider": provider, "status": "deleted"}
