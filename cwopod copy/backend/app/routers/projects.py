"""Projects router: import, upload, list, and manage book projects."""

import json
import logging
import shutil
import time
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session, get_db
from app.middleware.auth import get_current_user
from app.models.correction import Correction
from app.models.cover import CoverLayout, CoverPrompt, CoverSession
from app.models.order import OrderItem
from app.models.project import BookProject, ProjectStatus, SourceType
from app.models.user import User
from app.services.source_service.registry import provider_registry

logger = logging.getLogger(__name__)
router = APIRouter()


class ImportRequest(BaseModel):
    provider_id: str
    source_id: str


@router.get("/")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all book projects for the authenticated user."""
    logger.info("list_projects: user_id=%s", current_user.id)
    result = await db.execute(
        select(BookProject)
        .where(BookProject.user_id == current_user.id)
        .order_by(BookProject.sort_order, BookProject.created_at.desc())
    )
    projects = result.scalars().all()
    logger.info("list_projects: returning %d projects", len(projects))

    return {
        "projects": [
            {
                "id": str(p.id),
                "title": p.title,
                "author": p.author,
                "status": p.status.value,
                "source_type": p.source_type.value,
                "source_url": p.source_url,
            }
            for p in projects
        ]
    }


@router.get("/{project_id}")
async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single book project by ID."""
    logger.info(f"get_project called: project_id={project_id}, user_id={current_user.id}")

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning(f"get_project: project not found, project_id={project_id}, user_id={current_user.id}")
        raise HTTPException(status_code=404, detail="Project not found")

    logger.info(f"get_project: returning project '{project.title}', status={project.status.value}")
    return {
        "id": str(project.id),
        "title": project.title,
        "author": project.author,
        "status": project.status.value,
        "source_type": project.source_type.value,
        "source_url": project.source_url,
        "interior_pdf_path": project.interior_pdf_path,
        "cover_pdf_path": project.cover_pdf_path,
        "page_count": project.page_count,
        "source_metadata": project.source_metadata,
        "trim_size": project.trim_size,
        "paper_type": project.paper_type,
        "color_interior": project.color_interior,
        "cover_finish": project.cover_finish,
        "binding_type": project.binding_type,
        "font_size": project.font_size,
        "has_dedication": bool(project.dedication_text or project.dedication_image_path),
    }


class PrintOptionsUpdate(BaseModel):
    trim_size: str | None = None
    paper_type: str | None = None
    color_interior: bool | None = None
    cover_finish: str | None = None
    binding_type: str | None = None
    font_size: str | None = None


@router.patch("/{project_id}/print-options")
async def update_print_options(
    project_id: uuid.UUID,
    body: PrintOptionsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update per-book print options (trim size, paper, color, cover finish, binding, font size)."""
    logger.info(
        "update_print_options: project_id=%s, user_id=%s, trim=%s, paper=%s, color=%s, finish=%s, binding=%s, font=%s",
        project_id, current_user.id, body.trim_size, body.paper_type, body.color_interior, body.cover_finish,
        body.binding_type, body.font_size,
    )

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    valid_sizes = {"5x8", "5.06x7.81", "5.25x8", "5.5x8.5", "6x9", "8.5x11"}
    valid_papers = {"white", "cream"}
    valid_finishes = {"glossy", "matte"}
    valid_bindings = {"paperback", "hardback", "micro"}
    valid_font_sizes = {"9pt", "10pt", "11pt", "12pt", "13pt", "14pt"}

    if body.trim_size is not None:
        if body.trim_size not in valid_sizes:
            raise HTTPException(status_code=422, detail=f"Invalid trim_size. Must be one of: {', '.join(valid_sizes)}")
        project.trim_size = body.trim_size

    if body.paper_type is not None:
        if body.paper_type not in valid_papers:
            raise HTTPException(status_code=422, detail=f"Invalid paper_type. Must be one of: {', '.join(valid_papers)}")
        project.paper_type = body.paper_type

    if body.color_interior is not None:
        project.color_interior = body.color_interior

    if body.cover_finish is not None:
        if body.cover_finish not in valid_finishes:
            raise HTTPException(status_code=422, detail=f"Invalid cover_finish. Must be one of: {', '.join(valid_finishes)}")
        project.cover_finish = body.cover_finish

    if body.binding_type is not None:
        if body.binding_type not in valid_bindings:
            raise HTTPException(status_code=422, detail=f"Invalid binding_type. Must be one of: {', '.join(valid_bindings)}")
        project.binding_type = body.binding_type

    if body.font_size is not None:
        if body.font_size not in valid_font_sizes:
            raise HTTPException(status_code=422, detail=f"Invalid font_size. Must be one of: {', '.join(valid_font_sizes)}")
        project.font_size = body.font_size

    await db.flush()
    logger.info("update_print_options: saved for project_id=%s", project_id)

    return {
        "trim_size": project.trim_size,
        "paper_type": project.paper_type,
        "color_interior": project.color_interior,
        "cover_finish": project.cover_finish,
        "binding_type": project.binding_type,
        "font_size": project.font_size,
    }


@router.post("/import", status_code=201)
async def import_from_source(
    body: ImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a book from a public domain source."""
    logger.info(
        "import_from_source: provider=%s, source_id=%s, user_id=%s",
        body.provider_id, body.source_id, current_user.id,
    )
    provider = provider_registry.get_provider(body.provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail=f"Provider '{body.provider_id}' not found")

    try:
        document = await provider.download(body.source_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Store the raw file
    project_id = uuid.uuid4()
    storage_dir = Path(settings.storage_path) / str(project_id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    ext = "epub" if document.format == "epub" else "txt"
    raw_path = storage_dir / f"original.{ext}"
    raw_path.write_bytes(document.content)

    # Normalize via Pandoc (extract chapters and images)
    from app.services.source_service.providers.upload import UploadProvider
    upload_provider = UploadProvider()
    normalized_path = None
    chapter_count = 0
    image_count = 0

    try:
        normalization = await upload_provider.normalize(raw_path, f".{ext}")
        chapter_count = normalization.section_count
        image_count = len(normalization.images)
        logger.info(
            "import_from_source: normalization complete, chapters=%d, images=%d",
            chapter_count, image_count,
        )
        normalized_file = storage_dir / "normalized.html"
        normalized_file.write_text(normalization.html_content, encoding="utf-8")
        normalized_path = str(normalized_file)

        if normalization.images:
            images_dir = storage_dir / "images"
            images_dir.mkdir(exist_ok=True)
            for img in normalization.images:
                img_path = images_dir / img.filename
                img_path.write_bytes(img.data)
    except Exception as e:
        logger.warning("import_from_source: normalization failed (non-fatal): %s", e)

    # Map source type
    source_type_map = {
        "gutenberg": SourceType.GUTENBERG,
        "standard_ebooks": SourceType.STANDARD_EBOOKS,
    }
    source_type = source_type_map.get(body.provider_id, SourceType.UPLOAD)

    # Create project
    project = BookProject(
        id=project_id,
        user_id=current_user.id,
        title=document.metadata.title or "Untitled",
        author=document.metadata.author,
        source_type=source_type,
        source_url=document.metadata.source_url,
        source_metadata={
            "source_provider": document.metadata.source_provider,
            "source_id": document.metadata.source_id,
            "language": document.metadata.language,
            "subjects": document.metadata.subjects,
            "license_text": document.metadata.license_text,
            "original_publisher": document.metadata.original_publisher,
            "publication_year": document.metadata.publication_year,
            "edition": document.metadata.edition,
            "chapter_count": chapter_count,
            "image_count": image_count,
        },
        original_text_path=str(raw_path),
        working_text_path=normalized_path,
        status=ProjectStatus.DRAFT,
    )
    db.add(project)
    await db.flush()

    logger.info(
        "import_from_source: created project '%s' (id=%s)",
        project.title, project.id,
    )
    return {
        "project_id": str(project.id),
        "title": project.title,
        "author": project.author,
        "source_type": project.source_type.value,
        "status": project.status.value,
    }


@router.get("/import/stream")
async def import_from_source_stream(
    request: Request,
    provider_id: str = Query(...),
    source_id: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Import a book from a public domain source with real-time SSE progress.

    Streams Server-Sent Events reporting download progress (bytes), normalization
    status, and project creation. Each event has a JSON data payload with:
      - step: "downloading" | "normalizing" | "creating" | "complete" | "error"
      - percent: 0-100 (real progress for download, indeterminate for others)
      - label: human-readable description
      - detail: extra info (file size, bytes downloaded, chapter count, etc.)
    """
    logger.info(
        "import_from_source_stream: provider=%s, source_id=%s, user_id=%s",
        provider_id, source_id, current_user.id,
    )

    provider = provider_registry.get_provider(provider_id)
    if provider is None:
        # Can't use HTTPException inside a generator, so return error as SSE
        async def error_gen():
            yield _sse_event({"step": "error", "label": f"Provider '{provider_id}' not found"})
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def stream_import():
        """Full import pipeline with SSE progress events."""
        try:
            # --- Phase 1: Download ---
            yield _sse_event({
                "step": "downloading",
                "percent": 0,
                "label": "Fetching book metadata...",
                "detail": {"status": "metadata"},
            })

            # Get download URL from provider
            # For Gutenberg: fetch book data, select format, then stream download
            # For Standard Ebooks: get catalog entry, then stream download
            download_url = None
            file_format = "epub"
            book_metadata = None

            if provider_id == "gutenberg":
                from app.services.source_service.providers.gutenberg import GutenbergProvider
                gp = provider  # type: GutenbergProvider
                try:
                    book_data = await gp._fetch_book_data(source_id)
                    formats = book_data.get("formats", {})
                    book_metadata = gp._extract_metadata(book_data, source_id)
                    download_url, file_format = gp._select_format(formats, source_id)
                    logger.info(
                        "import_stream: gutenberg metadata fetched, title=%s, format=%s, url=%s",
                        book_metadata.title, file_format, download_url,
                    )
                except Exception as e:
                    logger.error("import_stream: failed to fetch gutenberg metadata: %s", e)
                    yield _sse_event({"step": "error", "label": f"Failed to fetch book info: {e}"})
                    return

            elif provider_id == "standard_ebooks":
                from app.services.source_service.providers.standard_ebooks import StandardEbooksProvider
                sep = provider  # type: StandardEbooksProvider
                try:
                    catalog = await sep._get_catalog()
                    entry = next((e for e in catalog if e["id"] == source_id), None)
                    if entry is None:
                        yield _sse_event({"step": "error", "label": f"Book '{source_id}' not found in catalog"})
                        return
                    download_url = entry.get("epub_url")
                    if not download_url:
                        yield _sse_event({"step": "error", "label": "No EPUB download link found"})
                        return
                    file_format = "epub"
                    from app.services.source_service.models import BookMetadata as BM
                    book_metadata = BM(
                        title=entry.get("title"),
                        author=entry.get("author"),
                        publication_date=entry.get("publication_date"),
                        language=entry.get("language", "en"),
                        source_url=entry.get("url"),
                        source_provider="standard_ebooks",
                        source_id=source_id,
                        subjects=entry.get("subjects", []),
                    )
                    logger.info(
                        "import_stream: standard_ebooks metadata fetched, title=%s, url=%s",
                        book_metadata.title, download_url,
                    )
                except Exception as e:
                    logger.error("import_stream: failed to fetch standard_ebooks metadata: %s", e)
                    yield _sse_event({"step": "error", "label": f"Failed to fetch book info: {e}"})
                    return
            else:
                # Fallback: use the provider's download method directly (no streaming)
                yield _sse_event({
                    "step": "downloading",
                    "percent": 0,
                    "label": "Downloading book...",
                    "detail": {"status": "downloading"},
                })
                try:
                    document = await provider.download(source_id)
                    content = document.content
                    file_format = document.format
                    book_metadata = document.metadata
                except Exception as e:
                    yield _sse_event({"step": "error", "label": f"Download failed: {e}"})
                    return

                yield _sse_event({
                    "step": "downloading",
                    "percent": 100,
                    "label": f"Downloaded ({len(content):,} bytes)",
                    "detail": {"bytes_downloaded": len(content), "total_bytes": len(content)},
                })
                # Skip the streaming download below
                download_url = None
                content_downloaded = content

            # Stream the actual file download with progress
            if download_url:
                yield _sse_event({
                    "step": "downloading",
                    "percent": 0,
                    "label": "Starting download...",
                    "detail": {"status": "starting"},
                })

                content_chunks = []
                total_bytes = 0
                bytes_downloaded = 0
                download_start = time.time()

                # Prepare auth for Standard Ebooks
                auth = None
                if provider_id == "standard_ebooks":
                    sep = provider
                    if hasattr(sep, '_auth_email') and sep._auth_email:
                        auth = httpx.BasicAuth(username=sep._auth_email, password="")

                try:
                    async with httpx.AsyncClient(
                        timeout=httpx.Timeout(60.0, connect=15.0),
                        follow_redirects=True,
                        headers={"User-Agent": "CWOPOD/1.0"},
                        auth=auth,
                    ) as client:
                        async with client.stream("GET", download_url) as response:
                            if response.status_code != 200:
                                yield _sse_event({
                                    "step": "error",
                                    "label": f"Download failed: HTTP {response.status_code}",
                                })
                                return

                            # Get content-length if available
                            content_length = response.headers.get("content-length")
                            if content_length:
                                total_bytes = int(content_length)
                                logger.info(
                                    "import_stream: download started, content_length=%d bytes (%.1f MB)",
                                    total_bytes, total_bytes / 1024 / 1024,
                                )
                                yield _sse_event({
                                    "step": "downloading",
                                    "percent": 0,
                                    "label": f"Downloading... 0 / {_format_bytes(total_bytes)}",
                                    "detail": {
                                        "bytes_downloaded": 0,
                                        "total_bytes": total_bytes,
                                    },
                                })
                            else:
                                logger.info("import_stream: download started, content_length unknown")
                                yield _sse_event({
                                    "step": "downloading",
                                    "percent": 0,
                                    "label": "Downloading... (size unknown)",
                                    "detail": {"bytes_downloaded": 0, "total_bytes": 0},
                                })

                            # Stream chunks and report progress
                            last_event_time = time.time()
                            async for chunk in response.aiter_bytes(chunk_size=32768):
                                if await request.is_disconnected():
                                    logger.info("import_stream: client disconnected during download")
                                    return
                                content_chunks.append(chunk)
                                bytes_downloaded += len(chunk)

                                # Send progress event at most every 200ms to avoid flooding
                                now = time.time()
                                if now - last_event_time >= 0.2:
                                    last_event_time = now
                                    if total_bytes > 0:
                                        pct = min(99, int(bytes_downloaded * 100 / total_bytes))
                                        label = f"Downloading... {_format_bytes(bytes_downloaded)} / {_format_bytes(total_bytes)}"
                                    else:
                                        pct = 0
                                        label = f"Downloading... {_format_bytes(bytes_downloaded)}"
                                    yield _sse_event({
                                        "step": "downloading",
                                        "percent": pct,
                                        "label": label,
                                        "detail": {
                                            "bytes_downloaded": bytes_downloaded,
                                            "total_bytes": total_bytes,
                                        },
                                    })

                except httpx.TimeoutException:
                    yield _sse_event({"step": "error", "label": "Download timed out"})
                    return
                except httpx.ConnectError as e:
                    yield _sse_event({"step": "error", "label": f"Connection failed: {e}"})
                    return
                except Exception as e:
                    logger.error("import_stream: download error: %s", e)
                    yield _sse_event({"step": "error", "label": f"Download failed: {e}"})
                    return

                content = b"".join(content_chunks)
                download_elapsed = time.time() - download_start
                logger.info(
                    "import_stream: download complete, size=%d bytes, elapsed=%.2fs",
                    len(content), download_elapsed,
                )
                yield _sse_event({
                    "step": "downloading",
                    "percent": 100,
                    "label": f"Downloaded {_format_bytes(len(content))} in {download_elapsed:.1f}s",
                    "detail": {
                        "bytes_downloaded": len(content),
                        "total_bytes": len(content),
                        "elapsed_seconds": round(download_elapsed, 2),
                    },
                })
            else:
                content = content_downloaded

            # Also extract license text for Gutenberg txt files
            license_text = None
            if provider_id == "gutenberg" and file_format == "txt":
                from app.services.source_service.providers.gutenberg import GutenbergProvider
                gp_inst = provider
                license_text = gp_inst._extract_license_text(content, file_format)
                if license_text and book_metadata:
                    book_metadata.license_text = license_text

            # --- Phase 2: Normalize ---
            yield _sse_event({
                "step": "normalizing",
                "percent": 0,
                "label": "Saving raw file...",
                "detail": {"status": "saving_raw"},
            })

            project_id = uuid.uuid4()
            storage_dir = Path(settings.storage_path) / str(project_id)
            storage_dir.mkdir(parents=True, exist_ok=True)

            ext = "epub" if file_format == "epub" else "txt"
            raw_path = storage_dir / f"original.{ext}"
            raw_path.write_bytes(content)
            logger.info("import_stream: raw file saved, path=%s, size=%d", raw_path, len(content))

            yield _sse_event({
                "step": "normalizing",
                "percent": 20,
                "label": "Running Pandoc normalization (extracting chapters & images)...",
                "detail": {"status": "pandoc"},
            })

            from app.services.source_service.providers.upload import UploadProvider
            upload_provider = UploadProvider()
            normalized_path = None
            chapter_count = 0
            image_count = 0

            try:
                normalize_start = time.time()
                normalization = await upload_provider.normalize(raw_path, f".{ext}")
                normalize_elapsed = time.time() - normalize_start
                chapter_count = normalization.section_count
                image_count = len(normalization.images)
                logger.info(
                    "import_stream: normalization complete, chapters=%d, images=%d, elapsed=%.2fs",
                    chapter_count, image_count, normalize_elapsed,
                )

                yield _sse_event({
                    "step": "normalizing",
                    "percent": 70,
                    "label": f"Normalization complete — {chapter_count} chapters, {image_count} images",
                    "detail": {
                        "chapter_count": chapter_count,
                        "image_count": image_count,
                        "elapsed_seconds": round(normalize_elapsed, 2),
                    },
                })

                normalized_file = storage_dir / "normalized.html"
                normalized_file.write_text(normalization.html_content, encoding="utf-8")
                normalized_path = str(normalized_file)

                if normalization.images:
                    images_dir = storage_dir / "images"
                    images_dir.mkdir(exist_ok=True)
                    for img in normalization.images:
                        img_path = images_dir / img.filename
                        img_path.write_bytes(img.data)
                    logger.info("import_stream: saved %d images to %s", image_count, images_dir)

                yield _sse_event({
                    "step": "normalizing",
                    "percent": 100,
                    "label": f"Normalized — {chapter_count} chapters, {image_count} images extracted",
                    "detail": {"status": "done"},
                })

            except Exception as e:
                logger.warning("import_stream: normalization failed (non-fatal): %s", e)
                yield _sse_event({
                    "step": "normalizing",
                    "percent": 100,
                    "label": "Normalization skipped (non-fatal error)",
                    "detail": {"status": "skipped", "error": str(e)},
                })

            # --- Phase 3: Create project ---
            # NOTE: We must use our own session here because the generator
            # executes AFTER FastAPI's dependency lifecycle has already closed
            # the injected `db` session. Without an explicit session + commit,
            # the project row is never persisted.
            yield _sse_event({
                "step": "creating",
                "percent": 0,
                "label": "Creating project record...",
                "detail": {"status": "creating"},
            })

            source_type_map = {
                "gutenberg": SourceType.GUTENBERG,
                "standard_ebooks": SourceType.STANDARD_EBOOKS,
            }
            source_type = source_type_map.get(provider_id, SourceType.UPLOAD)

            async with async_session() as db_session:
                project = BookProject(
                    id=project_id,
                    user_id=current_user.id,
                    title=book_metadata.title or "Untitled",
                    author=book_metadata.author,
                    source_type=source_type,
                    source_url=book_metadata.source_url,
                    source_metadata={
                        "source_provider": book_metadata.source_provider,
                        "source_id": book_metadata.source_id,
                        "language": book_metadata.language,
                        "subjects": book_metadata.subjects,
                        "license_text": getattr(book_metadata, 'license_text', None),
                        "original_publisher": getattr(book_metadata, 'original_publisher', None),
                        "publication_year": getattr(book_metadata, 'publication_year', None),
                        "edition": getattr(book_metadata, 'edition', None),
                        "chapter_count": chapter_count,
                        "image_count": image_count,
                    },
                    original_text_path=str(raw_path),
                    working_text_path=normalized_path,
                    status=ProjectStatus.DRAFT,
                )
                db_session.add(project)
                await db_session.commit()

            logger.info(
                "import_stream: created project '%s' (id=%s)",
                project.title, project.id,
            )

            yield _sse_event({
                "step": "creating",
                "percent": 100,
                "label": f"Project created: {project.title}",
                "detail": {"status": "done"},
            })

            # --- Complete ---
            yield _sse_event({
                "step": "complete",
                "percent": 100,
                "label": "Import complete!",
                "detail": {
                    "project_id": str(project.id),
                    "title": project.title,
                    "author": project.author,
                },
            })

        except Exception as e:
            logger.error(
                "import_stream: unexpected error, provider=%s, source_id=%s, error=%s",
                provider_id, source_id, str(e), exc_info=True,
            )
            yield _sse_event({"step": "error", "label": f"Import failed: {e}"})

    return StreamingResponse(
        stream_import(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"data: {json.dumps(data)}\n\n"


def _format_bytes(num_bytes: int) -> str:
    """Format byte count as human-readable string."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    else:
        return f"{num_bytes / (1024 * 1024):.1f} MB"


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a user document to create a new book project.

    Processing pipeline:
    1. Validate format and size
    2. Store raw file
    3. Extract metadata (title, author, date) from file contents
    4. Normalize to HTML via Pandoc (extracts chapters and images)
    5. Create BookProject with extracted metadata
    """
    logger.info(
        "upload_document: filename=%s, user_id=%s",
        file.filename, current_user.id,
    )
    # Validate format
    allowed_extensions = {".epub", ".docx", ".txt", ".pdf"}
    filename = file.filename or "upload.txt"
    ext = Path(filename).suffix.lower()

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(allowed_extensions)}",
        )

    # Read content
    content = await file.read()

    # Validate size (200 MB max)
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 200 MB maximum")

    # Store the raw file
    project_id = uuid.uuid4()
    storage_dir = Path(settings.storage_path) / str(project_id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    raw_path = storage_dir / f"original{ext}"
    raw_path.write_bytes(content)
    logger.info("upload_document: stored raw file at %s (%d bytes)", raw_path, len(content))

    # --- Extract metadata from file contents ---
    from app.services.source_service.providers.upload import UploadProvider
    upload_provider = UploadProvider()

    # Validate file integrity
    validation = await upload_provider.validate(raw_path)
    if not validation.is_valid:
        logger.warning("upload_document: validation failed: %s", validation.error_message)
        # Clean up stored file
        raw_path.unlink(missing_ok=True)
        storage_dir.rmdir()
        if validation.error_code and validation.error_code.value == "FILE_CORRUPT":
            raise HTTPException(status_code=422, detail=validation.error_message)
        raise HTTPException(status_code=415, detail=validation.error_message)

    # Extract metadata
    metadata = await upload_provider.extract_metadata(raw_path, ext)
    title = metadata.title or Path(filename).stem
    author = metadata.author
    logger.info(
        "upload_document: extracted metadata title='%s', author='%s'",
        title, author,
    )

    # --- Normalize via Pandoc (extract chapters and images) ---
    chapter_count = 0
    image_count = 0
    normalized_path = None

    try:
        normalization = await upload_provider.normalize(raw_path, ext)
        chapter_count = normalization.section_count
        image_count = len(normalization.images)
        logger.info(
            "upload_document: normalization complete, chapters=%d, images=%d",
            chapter_count, image_count,
        )

        # Store normalized HTML
        normalized_file = storage_dir / "normalized.html"
        normalized_file.write_text(normalization.html_content, encoding="utf-8")
        normalized_path = str(normalized_file)

        # Store extracted images
        if normalization.images:
            images_dir = storage_dir / "images"
            images_dir.mkdir(exist_ok=True)
            for img in normalization.images:
                img_path = images_dir / img.filename
                img_path.write_bytes(img.data)
            logger.info("upload_document: stored %d extracted images", len(normalization.images))

    except Exception as e:
        # Normalization failure is non-fatal — project can still be created
        logger.warning("upload_document: normalization failed (non-fatal): %s", e)

    # --- Extract images from EPUB specifically ---
    if ext == ".epub":
        try:
            epub_images = await upload_provider.extract_images(raw_path)
            if epub_images and image_count == 0:
                image_count = len(epub_images)
                images_dir = storage_dir / "images"
                images_dir.mkdir(exist_ok=True)
                for img in epub_images:
                    img_path = images_dir / img.filename
                    img_path.write_bytes(img.data)
                logger.info("upload_document: extracted %d EPUB images", len(epub_images))
        except Exception as e:
            logger.warning("upload_document: EPUB image extraction failed (non-fatal): %s", e)

    # Create project with extracted metadata
    project = BookProject(
        id=project_id,
        user_id=current_user.id,
        title=title,
        author=author,
        source_type=SourceType.UPLOAD,
        source_metadata={
            "original_filename": filename,
            "file_format": ext.lstrip("."),
            "chapter_count": chapter_count,
            "image_count": image_count,
            "publication_date": metadata.publication_date,
            "language": metadata.language,
        },
        original_text_path=str(raw_path),
        working_text_path=normalized_path,
        status=ProjectStatus.DRAFT,
    )
    db.add(project)
    await db.flush()

    logger.info(
        "upload_document: created project '%s' (id=%s, size=%d bytes, chapters=%d, images=%d)",
        project.title, project.id, len(content), chapter_count, image_count,
    )
    return {
        "project_id": str(project.id),
        "title": project.title,
        "author": project.author,
        "filename": filename,
        "file_size_bytes": len(content),
        "chapter_count": chapter_count,
        "image_count": image_count,
        "status": project.status.value,
    }


@router.get("/{project_id}/source-file")
async def download_source_file(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the original source file that was imported/uploaded for this project."""
    logger.info(
        "download_source_file: project_id=%s, user_id=%s",
        project_id, current_user.id,
    )

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning(
            "download_source_file: project not found, project_id=%s, user_id=%s",
            project_id, current_user.id,
        )
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.original_text_path:
        logger.warning(
            "download_source_file: no original file path stored, project_id=%s",
            project_id,
        )
        raise HTTPException(status_code=404, detail="No source file available for this project")

    source_path = Path(project.original_text_path)
    if not source_path.exists():
        logger.error(
            "download_source_file: file missing from disk, path=%s, project_id=%s",
            source_path, project_id,
        )
        raise HTTPException(status_code=500, detail="Source file not found on disk")

    # Determine media type from extension
    ext = source_path.suffix.lower()
    media_types = {
        ".epub": "application/epub+zip",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    # Build a friendly filename
    title_slug = (project.title or "book").replace(" ", "_")[:50]
    filename = f"{title_slug}_source{ext}"

    logger.info(
        "download_source_file: serving file, path=%s, media_type=%s, filename=%s",
        source_path, media_type, filename,
    )

    return FileResponse(
        path=str(source_path),
        media_type=media_type,
        filename=filename,
    )


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a book project and all associated data (covers, corrections, files)."""
    logger.info("delete_project: project_id=%s, user_id=%s", project_id, current_user.id)

    # Verify project exists and belongs to user
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("delete_project: project not found, project_id=%s, user_id=%s", project_id, current_user.id)
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete related records
    logger.debug("delete_project: removing related cover_prompts for project_id=%s", project_id)
    await db.execute(sa_delete(CoverPrompt).where(CoverPrompt.project_id == project_id))

    logger.debug("delete_project: removing related cover_layouts for project_id=%s", project_id)
    await db.execute(sa_delete(CoverLayout).where(CoverLayout.project_id == project_id))

    logger.debug("delete_project: removing related cover_sessions for project_id=%s", project_id)
    await db.execute(sa_delete(CoverSession).where(CoverSession.project_id == project_id))

    logger.debug("delete_project: removing related corrections for project_id=%s", project_id)
    await db.execute(sa_delete(Correction).where(Correction.project_id == project_id))

    logger.debug("delete_project: removing related order_items for project_id=%s", project_id)
    await db.execute(sa_delete(OrderItem).where(OrderItem.project_id == project_id))

    # Delete the project record
    await db.delete(project)
    await db.flush()
    logger.info("delete_project: database records deleted for project_id=%s", project_id)

    # Remove storage directory
    storage_dir = Path(settings.storage_path) / str(project_id)
    if storage_dir.exists():
        shutil.rmtree(storage_dir)
        logger.info("delete_project: removed storage directory %s", storage_dir)
    else:
        logger.debug("delete_project: no storage directory found at %s", storage_dir)

    logger.info("delete_project: completed successfully for project_id=%s", project_id)


@router.post("/{project_id}/duplicate", status_code=201)
async def duplicate_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate a book project, copying metadata and storage files.

    The duplicate starts in DRAFT status regardless of the original's status.
    """
    logger.info("duplicate_project: project_id=%s, user_id=%s", project_id, current_user.id)

    # Fetch original project
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    original = result.scalar_one_or_none()
    if original is None:
        logger.warning("duplicate_project: project not found, project_id=%s, user_id=%s", project_id, current_user.id)
        raise HTTPException(status_code=404, detail="Project not found")

    # Create new project ID and storage directory
    new_id = uuid.uuid4()
    new_storage_dir = Path(settings.storage_path) / str(new_id)
    new_storage_dir.mkdir(parents=True, exist_ok=True)
    logger.debug("duplicate_project: new project_id=%s, storage=%s", new_id, new_storage_dir)

    # Copy storage files from original
    original_storage_dir = Path(settings.storage_path) / str(project_id)
    new_original_text_path = None
    new_working_text_path = None
    new_interior_pdf_path = None
    new_cover_pdf_path = None

    if original_storage_dir.exists():
        logger.debug("duplicate_project: copying storage from %s to %s", original_storage_dir, new_storage_dir)
        # Remove the empty dir we just created so copytree can replace it
        new_storage_dir.rmdir()
        shutil.copytree(original_storage_dir, new_storage_dir)

        # Remap file paths to new directory
        if original.original_text_path:
            new_original_text_path = original.original_text_path.replace(
                str(project_id), str(new_id)
            )
        if original.working_text_path:
            new_working_text_path = original.working_text_path.replace(
                str(project_id), str(new_id)
            )
        if original.interior_pdf_path:
            new_interior_pdf_path = original.interior_pdf_path.replace(
                str(project_id), str(new_id)
            )
        if original.cover_pdf_path:
            new_cover_pdf_path = original.cover_pdf_path.replace(
                str(project_id), str(new_id)
            )
        logger.info("duplicate_project: storage files copied successfully")
    else:
        logger.debug("duplicate_project: no storage directory for original project")

    # Create the duplicate project record
    duplicate = BookProject(
        id=new_id,
        user_id=current_user.id,
        title=f"{original.title} (Copy)",
        author=original.author,
        source_type=original.source_type,
        source_url=original.source_url,
        source_metadata=dict(original.source_metadata) if original.source_metadata else {},
        original_text_path=new_original_text_path,
        working_text_path=new_working_text_path,
        interior_pdf_path=new_interior_pdf_path,
        cover_pdf_path=new_cover_pdf_path,
        status=ProjectStatus.DRAFT,
        sort_order=0,
        isbn=None,
        print_provider=None,
        page_count=original.page_count,
    )
    db.add(duplicate)
    await db.flush()

    logger.info(
        "duplicate_project: created duplicate '%s' (id=%s) from original '%s' (id=%s)",
        duplicate.title, duplicate.id, original.title, original.id,
    )
    return {
        "project_id": str(duplicate.id),
        "title": duplicate.title,
        "author": duplicate.author,
        "status": duplicate.status.value,
        "source_type": duplicate.source_type.value,
    }


class CancelTaskRequest(BaseModel):
    task_id: str


class DedicationTextRequest(BaseModel):
    text: str | None = None


@router.get("/{project_id}/dedication")
async def get_dedication(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the dedication page content for a project."""
    logger.info("get_dedication: project_id=%s, user_id=%s", project_id, current_user.id)

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("get_dedication: project not found, project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    # Determine mode: image takes precedence if set
    mode = "none"
    if project.dedication_image_path:
        mode = "image"
    elif project.dedication_text:
        mode = "text"

    logger.info("get_dedication: project_id=%s, mode=%s", project_id, mode)
    return {
        "mode": mode,
        "text": project.dedication_text,
        "has_image": project.dedication_image_path is not None,
    }


@router.put("/{project_id}/dedication/text")
async def save_dedication_text(
    project_id: uuid.UUID,
    body: DedicationTextRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or clear the dedication page text (supports markdown)."""
    logger.info("save_dedication_text: project_id=%s, user_id=%s, text_length=%s",
                project_id, current_user.id, len(body.text) if body.text else 0)

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("save_dedication_text: project not found, project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    project.dedication_text = body.text if body.text and body.text.strip() else None
    # Clear image when switching to text mode
    if project.dedication_text:
        if project.dedication_image_path:
            # Remove old image file
            old_path = Path(project.dedication_image_path)
            if old_path.exists():
                old_path.unlink()
                logger.info("save_dedication_text: removed old dedication image at %s", old_path)
        project.dedication_image_path = None

    await db.flush()
    logger.info("save_dedication_text: saved for project_id=%s", project_id)
    return {"mode": "text" if project.dedication_text else "none", "text": project.dedication_text}


@router.put("/{project_id}/dedication/image")
async def save_dedication_image(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image for the dedication page (replaces text if set)."""
    logger.info("save_dedication_image: project_id=%s, user_id=%s, filename=%s",
                project_id, current_user.id, file.filename)

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("save_dedication_image: project not found, project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate image format
    filename = file.filename or "dedication.png"
    ext = Path(filename).suffix.lower()
    allowed_image_exts = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in allowed_image_exts:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image format '{ext}'. Supported: {', '.join(allowed_image_exts)}",
        )

    # Read and validate size (10 MB max for dedication image)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB maximum")

    # Store the image
    storage_dir = Path(settings.storage_path) / str(project_id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Remove old dedication image if exists
    if project.dedication_image_path:
        old_path = Path(project.dedication_image_path)
        if old_path.exists():
            old_path.unlink()
            logger.info("save_dedication_image: removed old image at %s", old_path)

    image_path = storage_dir / f"dedication{ext}"
    image_path.write_bytes(content)
    logger.info("save_dedication_image: stored image at %s (%d bytes)", image_path, len(content))

    project.dedication_image_path = str(image_path)
    # Clear text when switching to image mode
    project.dedication_text = None

    await db.flush()
    logger.info("save_dedication_image: saved for project_id=%s", project_id)
    return {"mode": "image", "has_image": True}


@router.delete("/{project_id}/dedication")
async def clear_dedication(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the dedication page entirely (both text and image)."""
    logger.info("clear_dedication: project_id=%s, user_id=%s", project_id, current_user.id)

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("clear_dedication: project not found, project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    # Remove image file if exists
    if project.dedication_image_path:
        old_path = Path(project.dedication_image_path)
        if old_path.exists():
            old_path.unlink()
            logger.info("clear_dedication: removed image at %s", old_path)

    project.dedication_text = None
    project.dedication_image_path = None
    await db.flush()
    logger.info("clear_dedication: cleared for project_id=%s", project_id)
    return {"mode": "none"}


@router.post("/{project_id}/cancel-task")
async def cancel_task(
    project_id: uuid.UUID,
    body: CancelTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel any Celery task by ID, scoped to the user's project.

    This is a generic cancel endpoint that revokes any running Celery task.
    The caller must provide the task_id they received when starting the task.
    """
    logger.info(
        "cancel_task called: project_id=%s, task_id=%s, user_id=%s",
        project_id, body.task_id, current_user.id,
    )

    # Verify the project belongs to this user
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        logger.warning("cancel_task: project %s not found for user %s", project_id, current_user.id)
        raise HTTPException(status_code=404, detail="Project not found")

    from app.worker import celery_app

    # Check current task state
    async_result = celery_app.AsyncResult(body.task_id)
    state = async_result.state
    logger.info("cancel_task: task_id=%s current state=%s", body.task_id, state)

    if state in ("PENDING", "STARTED", "PROGRESS"):
        celery_app.control.revoke(body.task_id, terminate=True, signal="SIGTERM")
        logger.info("cancel_task: revoke sent for task_id=%s", body.task_id)
        return {"cancelled": True, "task_id": body.task_id, "previous_state": state}
    else:
        logger.info("cancel_task: task_id=%s already in terminal state %s", body.task_id, state)
        return {"cancelled": False, "task_id": body.task_id, "state": state, "message": f"Task already in state: {state}"}
