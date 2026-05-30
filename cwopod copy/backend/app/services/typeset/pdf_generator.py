"""PDF generator: Celery task that compiles Typst source to PDF."""

import logging
import subprocess
import tempfile
from pathlib import Path
from uuid import UUID

from app.worker import celery_app

logger = logging.getLogger(__name__)


class TypesetCompilationError(Exception):
    """Raised when Typst compilation fails."""

    def __init__(self, message: str, stderr: str):
        self.message = message
        self.stderr = stderr
        super().__init__(f"{message}\n\nTypst output:\n{stderr}")


@celery_app.task(bind=True, name="typeset.generate_pdf", soft_time_limit=300, time_limit=600)
def generate_pdf_task(self, project_id: str, user_id: str, provider: str = "lulu") -> dict:
    """Background task that generates a print-ready interior PDF."""
    import asyncio
    import logging
    import traceback
    from app.services.resource_tracker import TaskResourceTimer
    logger = logging.getLogger(__name__)
    logger.info("generate_pdf_task STARTED: project_id=%s, user_id=%s, provider=%s, task_id=%s",
                project_id, user_id, provider, self.request.id)

    timer = TaskResourceTimer()
    timer.start()
    try:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(_generate_pdf_async(self, project_id, user_id, provider))
        finally:
            try:
                loop.run_until_complete(loop.shutdown_asyncgens())
                loop.run_until_complete(loop.shutdown_default_executor())
            finally:
                asyncio.set_event_loop(None)
                loop.close()
        logger.info("generate_pdf_task COMPLETED: project_id=%s, result=%s", project_id, result)
        timer.stop()
        timer.save(project_id, user_id, "typeset", provider="local", notes=f"provider={provider}")
        return result
    except Exception as e:
        logger.error("generate_pdf_task FAILED: project_id=%s, error=%s\n%s",
                     project_id, str(e), traceback.format_exc())
        timer.stop()
        timer.save(project_id, user_id, "typeset", provider="local", notes=f"FAILED: {str(e)[:100]}")
        raise


async def _generate_pdf_async(task, project_id: str, user_id: str, provider: str) -> dict:
    """Async implementation of PDF generation."""
    from sqlalchemy import select

    from app.config import settings
    from app.database import create_worker_session
    from app.models.illustration import Illustration, PoolType
    from app.models.project import BookProject
    from app.services.typeset.chapter_detector import ChapterDetector
    from app.services.typeset.provider_specs import get_provider_spec
    from app.services.typeset.qr_generator import QRGenerator
    from app.services.typeset.template_renderer import (
        BookMetadata,
        TemplateRenderer,
        TypesetAssets,
    )

    logger.debug("_generate_pdf_async: creating worker session for current event loop")
    worker_session, worker_engine = create_worker_session()

    try:
        async with worker_session() as db:
            # Load project
            result = await db.execute(
                select(BookProject).where(
                    BookProject.id == UUID(project_id),
                    BookProject.user_id == UUID(user_id),
                )
            )
            project = result.scalar_one_or_none()
            if project is None:
                return {"error": "Project not found"}

            text_path = project.working_text_path or project.original_text_path
            if not text_path:
                return {"error": "No text to typeset"}

            # Read text
            raw_text = Path(text_path).read_text(encoding="utf-8")
            if not raw_text.strip():
                return {"error": "Text file is empty"}

            # If the file is HTML (from Pandoc normalization), convert to plain text
            from app.services.typeset.html_to_text import html_to_text
            if text_path.endswith(".html") or "<p>" in raw_text[:2000]:
                logger.info("_generate_pdf_async: detected HTML content, converting to plain text")
                text = html_to_text(raw_text)
            else:
                text = raw_text

            if not text.strip():
                return {"error": "Text conversion produced empty output"}

            # Get provider spec
            try:
                spec = get_provider_spec(provider)
            except ValueError as e:
                return {"error": str(e)}

            # Stage 1: Detect chapters
            task.update_state(state="PROGRESS", meta={"stage": "detecting_chapters"})
            detector = ChapterDetector()
            epub_nav = project.source_metadata.get("epub_nav") if project.source_metadata else None
            chapters = detector.detect(text, epub_nav)

            # Stage 2: Generate QR codes
            task.update_state(state="PROGRESS", meta={"stage": "generating_qr_codes"})
            storage_dir = Path(text_path).parent
            qr_gen = QRGenerator()
            info_qr = qr_gen.generate_info_page_qr(settings.app_url, storage_dir)
            attribution_qr = None
            source_url = project.source_url or (
                project.source_metadata.get("source_url") if project.source_metadata else None
            )
            if source_url:
                attribution_qr = qr_gen.generate_attribution_qr(source_url, storage_dir)

            # Stage 2.5: Load locked illustrations from DB
            logger.info(
                "_generate_pdf_async: loading locked illustrations for project_id=%s",
                project_id,
            )
            ill_result = await db.execute(
                select(Illustration).where(
                    Illustration.project_id == UUID(project_id),
                    Illustration.pool == PoolType.IN_BOOK,
                    Illustration.lock_state == True,
                )
            )
            illustrations = list(ill_result.scalars().all())
            logger.info(
                "_generate_pdf_async: loaded %d locked illustrations for project_id=%s",
                len(illustrations), project_id,
            )
            for ill in illustrations:
                logger.debug(
                    "_generate_pdf_async: illustration image_uuid=%s, label=%s, "
                    "placement_mode=%s, page_number=%s, file_ext=%s, lock_state=%s",
                    ill.image_uuid, ill.label, ill.placement_mode,
                    ill.page_number, ill.file_ext, ill.lock_state,
                )

            # Verify image files are accessible relative to the Typst source file
            images_dir = storage_dir / "images"
            if illustrations and not images_dir.exists():
                logger.warning(
                    "_generate_pdf_async: images directory does not exist at %s, "
                    "illustrations may fail to render",
                    images_dir,
                )
            for ill in illustrations:
                image_file = images_dir / f"{ill.image_uuid}.{ill.file_ext}"
                if not image_file.exists():
                    logger.warning(
                        "_generate_pdf_async: image file not found for illustration "
                        "image_uuid=%s, expected path=%s",
                        ill.image_uuid, image_file,
                    )

            # Stage 3: Render template
            task.update_state(state="PROGRESS", meta={"stage": "rendering_template"})
            metadata = BookMetadata(
                title=project.title or "Untitled",
                author=project.author or "Unknown",
                source_name=project.source_metadata.get("source_provider") if project.source_metadata else None,
                source_url=source_url,
                original_publisher=project.source_metadata.get("original_publisher") if project.source_metadata else None,
                publication_year=project.source_metadata.get("publication_year") if project.source_metadata else None,
                edition=project.source_metadata.get("edition") if project.source_metadata else None,
                license_text=project.source_metadata.get("license_text") if project.source_metadata else None,
                app_url=settings.app_url,
                dedication_text=project.dedication_text,
                dedication_image_path=Path(project.dedication_image_path) if project.dedication_image_path else None,
            )
            assets = TypesetAssets(
                info_qr_path=info_qr,
                attribution_qr_path=attribution_qr,
            )
            renderer = TemplateRenderer()
            typst_source = renderer.render_full(
                chapters, metadata, spec, assets,
                font_size=project.font_size or "11pt",
                illustrations=illustrations if illustrations else None,
            )

            # Stage 4: Compile PDF
            task.update_state(state="PROGRESS", meta={"stage": "compiling_pdf"})
            source_file = storage_dir / "interior.typ"
            source_file.write_text(typst_source, encoding="utf-8")

            output_pdf = storage_dir / "interior.pdf"
            page_count = compile_typst(source_file, output_pdf)

            # Update project
            project.interior_pdf_path = str(output_pdf)
            project.page_count = page_count

            # Advance project status to TYPESET
            from app.models.project import ProjectStatus as PS
            if project.status == PS.DRAFT:
                project.status = PS.TYPESET

            await db.commit()

            return {
                "pdf_path": str(output_pdf),
                "page_count": page_count,
                "chapters_detected": len(chapters),
            }
    finally:
        await worker_engine.dispose()
        logger.debug("_generate_pdf_async: worker engine disposed")


def compile_typst(source_path: Path, output_path: Path) -> int:
    """Compile a Typst source file to PDF. Returns page count."""
    cmd = ["typst", "compile", str(source_path), str(output_path)]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
    except FileNotFoundError:
        raise TypesetCompilationError(
            "Typst compiler not found. Ensure typst is installed.", ""
        )
    except subprocess.TimeoutExpired:
        raise TypesetCompilationError("Typst compilation timed out after 120 seconds", "")

    if result.returncode != 0:
        raise TypesetCompilationError(
            "Typst compilation failed", result.stderr
        )

    # Read actual page count from the compiled PDF
    if output_path.exists():
        page_count = _read_pdf_page_count(output_path)
        if page_count > 0:
            return page_count
        # Fallback heuristic if page count reading fails
        file_size = output_path.stat().st_size
        return max(1, file_size // 3000)

    return 0


def _read_pdf_page_count(pdf_path: Path) -> int:
    """Read the actual page count from a PDF file using pikepdf.

    Falls back to pypdf if pikepdf is unavailable, then to a file-size heuristic.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        Number of pages, or 0 if reading fails.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Try pikepdf first (most reliable)
    try:
        import pikepdf
        with pikepdf.open(str(pdf_path)) as pdf:
            count = len(pdf.pages)
            logger.debug("_read_pdf_page_count (pikepdf): %d pages in %s", count, pdf_path)
            return count
    except ImportError:
        logger.debug("_read_pdf_page_count: pikepdf not available, trying pypdf")
    except Exception as e:
        logger.warning("_read_pdf_page_count: pikepdf failed: %s", e)

    # Try pypdf as fallback
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        count = len(reader.pages)
        logger.debug("_read_pdf_page_count (pypdf): %d pages in %s", count, pdf_path)
        return count
    except ImportError:
        logger.debug("_read_pdf_page_count: pypdf not available")
    except Exception as e:
        logger.warning("_read_pdf_page_count: pypdf failed: %s", e)

    return 0
