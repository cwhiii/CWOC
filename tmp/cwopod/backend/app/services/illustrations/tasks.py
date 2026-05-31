"""Celery tasks for illustrations: full reflow (re-typeset with locked illustrations)."""

import asyncio
import logging
import traceback

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="illustrations.full_reflow",
    soft_time_limit=300,
    time_limit=600,
)
def full_reflow_task(self, project_id: str, user_id: str) -> dict:
    """Background task that re-typesets the entire book with locked illustrations.

    Performs a full reflow: loads all locked illustrations from the database,
    renders the Typst source with illustration markup, compiles to PDF, and
    updates page numbers. Reports real progress stages throughout.

    Args:
        self: Celery task instance (bound).
        project_id: The project UUID string.
        user_id: The user UUID string who triggered the reflow.

    Returns:
        Dictionary with result details (pdf_path, page_count, etc.) or error.
    """
    logger.info(
        "full_reflow_task STARTED: project_id=%s, user_id=%s, task_id=%s",
        project_id,
        user_id,
        self.request.id,
    )
    try:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                _full_reflow_async(self, project_id, user_id)
            )
        finally:
            try:
                loop.run_until_complete(loop.shutdown_asyncgens())
                loop.run_until_complete(loop.shutdown_default_executor())
            finally:
                asyncio.set_event_loop(None)
                loop.close()
        logger.info(
            "full_reflow_task COMPLETED: project_id=%s, result=%s",
            project_id,
            result,
        )
        return result
    except Exception as e:
        logger.error(
            "full_reflow_task FAILED: project_id=%s, error=%s\n%s",
            project_id,
            str(e),
            traceback.format_exc(),
        )
        raise


async def _full_reflow_async(task, project_id: str, user_id: str) -> dict:
    """Async implementation of the full reflow with locked illustrations.

    Stages reported:
    1. loading_illustrations — fetching locked illustration data from DB
    2. rendering_typst — generating Typst source with illustration markup
    3. compiling_pdf — running Typst compiler
    4. updating_pages — updating page numbers in DB

    Args:
        task: The Celery task instance for progress reporting.
        project_id: The project UUID string.
        user_id: The user UUID string.

    Returns:
        Dictionary with pdf_path, page_count, illustrations_included.
    """
    from pathlib import Path
    from uuid import UUID

    from sqlalchemy import select

    from app.config import settings
    from app.database import create_worker_session
    from app.models.illustration import Illustration, PoolType
    from app.models.project import BookProject

    logger.debug(
        "_full_reflow_async: creating worker session for current event loop, "
        "project_id=%s",
        project_id,
    )
    worker_session, worker_engine = create_worker_session()

    try:
        async with worker_session() as db:
            # Stage 1: Load illustrations
            task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "loading_illustrations",
                    "label": "Loading illustrations...",
                    "percent": 10,
                    "status": "progress",
                },
            )
            logger.debug(
                "_full_reflow_async: stage=loading_illustrations, project_id=%s",
                project_id,
            )

            # Load project
            result = await db.execute(
                select(BookProject).where(
                    BookProject.id == UUID(project_id),
                    BookProject.user_id == UUID(user_id),
                )
            )
            project = result.scalar_one_or_none()
            if project is None:
                logger.error(
                    "_full_reflow_async: project not found — project_id=%s, user_id=%s",
                    project_id,
                    user_id,
                )
                return {"error": "Project not found"}

            # Load locked illustrations
            ill_result = await db.execute(
                select(Illustration).where(
                    Illustration.project_id == UUID(project_id),
                    Illustration.user_id == UUID(user_id),
                    Illustration.pool == PoolType.IN_BOOK,
                    Illustration.lock_state == True,  # noqa: E712
                )
            )
            locked_illustrations = ill_result.scalars().all()
            logger.info(
                "_full_reflow_async: loaded %d locked illustrations, project_id=%s",
                len(locked_illustrations),
                project_id,
            )

            # Stage 2: Render Typst template
            task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "rendering_typst",
                    "label": "Rendering template...",
                    "percent": 30,
                    "status": "progress",
                },
            )
            logger.debug(
                "_full_reflow_async: stage=rendering_typst, project_id=%s",
                project_id,
            )

            text_path = project.working_text_path or project.original_text_path
            if not text_path:
                logger.error(
                    "_full_reflow_async: no text to typeset — project_id=%s",
                    project_id,
                )
                return {"error": "No text to typeset"}

            raw_text = Path(text_path).read_text(encoding="utf-8")
            if not raw_text.strip():
                logger.error(
                    "_full_reflow_async: text file is empty — project_id=%s",
                    project_id,
                )
                return {"error": "Text file is empty"}

            # Convert HTML if needed
            from app.services.typeset.html_to_text import html_to_text

            if text_path.endswith(".html") or "<p>" in raw_text[:2000]:
                logger.info(
                    "_full_reflow_async: detected HTML content, converting to plain text"
                )
                text = html_to_text(raw_text)
            else:
                text = raw_text

            if not text.strip():
                return {"error": "Text conversion produced empty output"}

            # Detect chapters and render
            from app.services.typeset.chapter_detector import ChapterDetector
            from app.services.typeset.provider_specs import get_provider_spec
            from app.services.typeset.template_renderer import (
                BookMetadata,
                TemplateRenderer,
                TypesetAssets,
            )
            from app.services.typeset.qr_generator import QRGenerator

            spec = get_provider_spec("lulu")
            detector = ChapterDetector()
            epub_nav = (
                project.source_metadata.get("epub_nav")
                if project.source_metadata
                else None
            )
            chapters = detector.detect(text, epub_nav)

            storage_dir = Path(text_path).parent
            qr_gen = QRGenerator()
            info_qr = qr_gen.generate_info_page_qr(settings.app_url, storage_dir)
            source_url = project.source_url or (
                project.source_metadata.get("source_url")
                if project.source_metadata
                else None
            )
            attribution_qr = None
            if source_url:
                attribution_qr = qr_gen.generate_attribution_qr(
                    source_url, storage_dir
                )

            metadata = BookMetadata(
                title=project.title or "Untitled",
                author=project.author or "Unknown",
                source_name=(
                    project.source_metadata.get("source_provider")
                    if project.source_metadata
                    else None
                ),
                source_url=source_url,
                original_publisher=(
                    project.source_metadata.get("original_publisher")
                    if project.source_metadata
                    else None
                ),
                publication_year=(
                    project.source_metadata.get("publication_year")
                    if project.source_metadata
                    else None
                ),
                edition=(
                    project.source_metadata.get("edition")
                    if project.source_metadata
                    else None
                ),
                license_text=(
                    project.source_metadata.get("license_text")
                    if project.source_metadata
                    else None
                ),
                app_url=settings.app_url,
                dedication_text=project.dedication_text,
                dedication_image_path=(
                    Path(project.dedication_image_path)
                    if project.dedication_image_path
                    else None
                ),
            )
            assets = TypesetAssets(
                info_qr_path=info_qr,
                attribution_qr_path=attribution_qr,
            )
            renderer = TemplateRenderer()
            logger.info(
                "_full_reflow_async: passing %d locked illustrations to renderer, project_id=%s",
                len(locked_illustrations),
                project_id,
            )
            for ill in locked_illustrations:
                logger.info(
                    "_full_reflow_async: illustration — uuid=%s, pool=%s, lock_state=%s, "
                    "placement_mode=%s, page_number=%s, height=%s, file_ext=%s",
                    ill.image_uuid,
                    ill.pool.value if ill.pool else None,
                    ill.lock_state,
                    ill.placement_mode.value if ill.placement_mode else None,
                    ill.page_number,
                    ill.height,
                    ill.file_ext,
                )

            typst_source = renderer.render_full(
                chapters,
                metadata,
                spec,
                assets,
                font_size=project.font_size or "11pt",
                illustrations=locked_illustrations,
            )

            # Ensure all locked illustration image files are accessible from the project
            # images/ directory (Typst resolves relative paths from the source file dir).
            # Shared-pool images live at a different path and must be copied/linked.
            images_dir = storage_dir / "images"
            images_dir.mkdir(parents=True, exist_ok=True)
            from app.services.illustrations.storage import (
                get_project_image_path,
                get_shared_image_path,
            )
            from app.models.illustration import PoolType
            import shutil as _shutil

            for ill in locked_illustrations:
                ext = ill.file_ext or "png"
                dest_path = images_dir / f"{ill.image_uuid}.{ext}"
                if dest_path.exists():
                    logger.debug(
                        "_full_reflow_async: image already in project dir — uuid=%s",
                        ill.image_uuid,
                    )
                    continue
                if ill.pool == PoolType.SHARED:
                    src_path = get_shared_image_path(
                        settings.storage_path, user_id, ill.image_uuid, ext
                    )
                else:
                    src_path = get_project_image_path(
                        settings.storage_path, project_id, ill.image_uuid, ext
                    )
                if src_path.exists():
                    _shutil.copy2(str(src_path), str(dest_path))
                    logger.info(
                        "_full_reflow_async: copied image to project dir — uuid=%s, "
                        "src=%s, dest=%s",
                        ill.image_uuid, src_path, dest_path,
                    )
                else:
                    logger.warning(
                        "_full_reflow_async: image file not found — uuid=%s, "
                        "expected_path=%s",
                        ill.image_uuid, src_path,
                    )

            # Stage 3: Compile PDF
            task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "compiling_pdf",
                    "label": "Compiling PDF...",
                    "percent": 60,
                    "status": "progress",
                },
            )
            logger.debug(
                "_full_reflow_async: stage=compiling_pdf, project_id=%s",
                project_id,
            )

            source_file = storage_dir / "interior.typ"
            source_file.write_text(typst_source, encoding="utf-8")

            output_pdf = storage_dir / "interior.pdf"

            from app.services.typeset.pdf_generator import compile_typst, _read_chapter_pages_from_pdf

            page_count = compile_typst(source_file, output_pdf)
            logger.info(
                "_full_reflow_async: PDF compiled — page_count=%d, project_id=%s",
                page_count,
                project_id,
            )

            # Extract exact chapter page numbers from PDF bookmarks and store in source_metadata
            chapter_page_map = _read_chapter_pages_from_pdf(output_pdf, chapters)
            logger.info(
                "_full_reflow_async: chapter_page_map=%s, project_id=%s",
                chapter_page_map, project_id,
            )

            # Stage 4: Update pages
            task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "updating_pages",
                    "label": "Updating page numbers...",
                    "percent": 90,
                    "status": "progress",
                },
            )
            logger.debug(
                "_full_reflow_async: stage=updating_pages, project_id=%s",
                project_id,
            )

            # Update project record
            project.interior_pdf_path = str(output_pdf)
            project.page_count = page_count

            # Store updated chapter page map in source_metadata
            metadata_update = dict(project.source_metadata) if project.source_metadata else {}
            metadata_update["chapter_page_map"] = chapter_page_map
            project.source_metadata = metadata_update
            logger.info(
                "_full_reflow_async: stored chapter_page_map with %d entries in source_metadata",
                len(chapter_page_map),
            )

            await db.commit()

            logger.info(
                "_full_reflow_async: reflow complete — page_count=%d, "
                "illustrations_included=%d, project_id=%s",
                page_count,
                len(locked_illustrations),
                project_id,
            )

            return {
                "pdf_path": str(output_pdf),
                "page_count": page_count,
                "illustrations_included": len(locked_illustrations),
            }
    finally:
        await worker_engine.dispose()
        logger.debug("_full_reflow_async: worker engine disposed")
