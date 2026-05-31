"""Celery tasks for quality controller: typo scanning."""

import logging
import time
from pathlib import Path
from uuid import UUID

from app.worker import celery_app

logger = logging.getLogger(__name__)

# Per-chunk timeout: if a single chunk takes longer than this, skip it and move on.
# This prevents one slow chunk from blocking the entire scan and triggering the
# frontend's "stuck" detection (which fires after 3 minutes of no progress change).
CHUNK_TIMEOUT_SECONDS = 120  # 2 minutes per chunk — generous for CPU inference


@celery_app.task(
    bind=True,
    name="quality_controller.scan_typos",
    soft_time_limit=7200,   # 2 hours soft limit (CPU inference is slow)
    time_limit=7500,        # 2.5 hours hard limit
)
def scan_typos_task(self, project_id: str, user_id: str) -> dict:
    """Background task that scans a project's text for typos, chapter by chapter.

    Uses the ChapterDetector to split text into natural chapter boundaries,
    then sends each chapter (or sub-chunk of large chapters) to the AI Engine.
    Progress is reported per chapter so the UI can show meaningful updates.

    Uses streaming mode with token-level progress reporting so the frontend
    can see the model is actively generating (prevents false "stuck" detection).
    """
    import asyncio
    from app.services.resource_tracker import TaskResourceTimer

    timer = TaskResourceTimer()
    timer.start()
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_scan_typos_async(self, project_id, user_id))
        timer.stop()
        timer.save(project_id, user_id, "spellcheck", provider="local")
        return result
    except Exception as e:
        timer.stop()
        timer.save(project_id, user_id, "spellcheck", provider="local", notes=f"FAILED: {str(e)[:100]}")
        raise
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.run_until_complete(loop.shutdown_default_executor())
        finally:
            asyncio.set_event_loop(None)
            loop.close()


async def _scan_typos_async(task, project_id: str, user_id: str) -> dict:
    """Async implementation of the chapter-based typo scan."""
    import asyncio

    from sqlalchemy import delete, select

    from app.database import create_worker_session
    from app.models.correction import Correction, CorrectionStatus
    from app.models.project import BookProject
    from app.services.ai_engine.router import AIRouter
    from app.services.quality_controller.prompts import (
        TYPO_DETECTION_SYSTEM_PROMPT,
        build_user_prompt,
    )
    from app.services.quality_controller.scanner import (
        chunk_by_chapters,
        deduplicate_corrections,
        parse_ai_response,
    )

    logger.debug("_scan_typos_async: creating worker session for current event loop")
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
                logger.error("_scan_typos_async: project not found project_id=%s", project_id)
                return {"error": "Project not found"}

            if not project.original_text_path:
                logger.error("_scan_typos_async: no text to scan project_id=%s", project_id)
                return {"error": "No text to scan"}

            # Read text
            text_path = Path(project.working_text_path or project.original_text_path)
            logger.info(
                "_scan_typos_async: reading text from %s, project_id=%s",
                text_path, project_id,
            )
            text = text_path.read_text(encoding="utf-8")

            if not text.strip():
                logger.error("_scan_typos_async: text file is empty project_id=%s", project_id)
                return {"error": "Text file is empty"}

            logger.info(
                "_scan_typos_async: text loaded, length=%d chars, project_id=%s",
                len(text), project_id,
            )

            # Clear existing corrections for a fresh scan
            await db.execute(
                delete(Correction).where(Correction.project_id == UUID(project_id))
            )

            # Get EPUB nav if available (for better chapter detection)
            epub_nav = project.source_metadata.get("epub_nav") if project.source_metadata else None

            # Chunk by chapters (sub-chunks large chapters automatically)
            chunks = chunk_by_chapters(text, epub_nav)
            total_chunks = len(chunks)
            logger.info(
                "_scan_typos_async: chunked into %d chunks, project_id=%s",
                total_chunks, project_id,
            )

            # Scan each chunk
            ai_router = AIRouter(db, UUID(user_id))
            all_corrections = []
            chunks_succeeded = 0
            chunks_failed = 0
            chunks_timed_out = 0

            for i, chunk in enumerate(chunks):
                chunk_start_time = time.time()
                chunk_word_count = len(chunk.text.split())
                logger.info(
                    "_scan_typos_async: processing chunk %d/%d, chapter=%d, "
                    "title=%s, words=%d, project_id=%s",
                    i + 1, total_chunks, chunk.chapter_number,
                    chunk.chapter_title, chunk_word_count, project_id,
                )

                # Report progress BEFORE processing (shows which chunk is in-flight)
                task.update_state(
                    state="PROGRESS",
                    meta={
                        "current_chunk": i + 1,
                        "total_chunks": total_chunks,
                        "chapter_number": chunk.chapter_number,
                        "chapter_title": chunk.chapter_title,
                        "sub_chunk": chunk.chunk_index,
                        "chunks_completed": i,
                        "corrections_so_far": len(all_corrections),
                        "recent_corrections": [],
                        "tokens_generated": 0,
                        "inference_active": True,
                    },
                )

                user_prompt = build_user_prompt(chunk.text)

                # Token progress callback — updates Celery state so frontend sees activity
                token_count_holder = [0]

                def on_token(count: int) -> None:
                    token_count_holder[0] = count
                    # Update state every 20 tokens to show the model is actively working
                    if count > 0 and count % 20 == 0:
                        task.update_state(
                            state="PROGRESS",
                            meta={
                                "current_chunk": i + 1,
                                "total_chunks": total_chunks,
                                "chapter_number": chunk.chapter_number,
                                "chapter_title": chunk.chapter_title,
                                "sub_chunk": chunk.chunk_index,
                                "chunks_completed": i,
                                "corrections_so_far": len(all_corrections),
                                "recent_corrections": [],
                                "tokens_generated": count,
                                "inference_active": True,
                            },
                        )

                # Retry each chunk up to 2 times on failure, with per-chunk timeout
                ai_result = None
                for attempt in range(3):
                    logger.debug(
                        "_scan_typos_async: chunk %d/%d attempt %d, project_id=%s",
                        i + 1, total_chunks, attempt + 1, project_id,
                    )
                    try:
                        ai_result = await asyncio.wait_for(
                            ai_router.generate_text(
                                prompt=user_prompt,
                                system_prompt=TYPO_DETECTION_SYSTEM_PROMPT,
                                max_tokens=4096,
                                on_token=on_token,
                            ),
                            timeout=CHUNK_TIMEOUT_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        elapsed = time.time() - chunk_start_time
                        logger.warning(
                            "_scan_typos_async: chunk %d/%d timed out after %.1fs "
                            "(attempt %d), tokens_generated=%d, project_id=%s",
                            i + 1, total_chunks, elapsed, attempt + 1,
                            token_count_holder[0], project_id,
                        )
                        from app.services.ai_engine.base import AIResult
                        ai_result = AIResult(
                            success=False,
                            error=f"Chunk timed out after {CHUNK_TIMEOUT_SECONDS}s",
                            provider_used="local",
                            can_retry=True,
                        )

                    if ai_result and ai_result.success:
                        break
                    # Brief pause before retry
                    await asyncio.sleep(2)

                chunk_elapsed = time.time() - chunk_start_time

                if ai_result and ai_result.success and ai_result.data:
                    corrections = parse_ai_response(ai_result.data, chunk.start_position)
                    all_corrections.extend(corrections)
                    chunks_succeeded += 1
                    logger.info(
                        "_scan_typos_async: chunk %d/%d completed in %.1fs, "
                        "corrections_found=%d, tokens=%d, project_id=%s",
                        i + 1, total_chunks, chunk_elapsed,
                        len(corrections), token_count_holder[0], project_id,
                    )

                    # Report progress AFTER processing with corrections found this chunk
                    recent = [
                        {"original": c["original_text"], "suggested": c["suggested_text"]}
                        for c in corrections[-5:]
                    ]
                    task.update_state(
                        state="PROGRESS",
                        meta={
                            "current_chunk": i + 1,
                            "total_chunks": total_chunks,
                            "chapter_number": chunk.chapter_number,
                            "chapter_title": chunk.chapter_title,
                            "sub_chunk": chunk.chunk_index,
                            "chunks_completed": i + 1,
                            "corrections_so_far": len(all_corrections),
                            "recent_corrections": recent,
                            "tokens_generated": token_count_holder[0],
                            "inference_active": False,
                        },
                    )
                else:
                    error_msg = ai_result.error if ai_result else "No result"
                    if "timed out" in error_msg.lower():
                        chunks_timed_out += 1
                    chunks_failed += 1
                    logger.warning(
                        "_scan_typos_async: chunk %d/%d failed after %.1fs: %s, project_id=%s",
                        i + 1, total_chunks, chunk_elapsed, error_msg, project_id,
                    )
                    # Still update completed count so progress advances
                    task.update_state(
                        state="PROGRESS",
                        meta={
                            "current_chunk": i + 1,
                            "total_chunks": total_chunks,
                            "chapter_number": chunk.chapter_number,
                            "chapter_title": chunk.chapter_title,
                            "sub_chunk": chunk.chunk_index,
                            "chunks_completed": i + 1,
                            "corrections_so_far": len(all_corrections),
                            "recent_corrections": [],
                            "tokens_generated": token_count_holder[0],
                            "inference_active": False,
                        },
                    )

            # Deduplicate (handles overlap between sub-chunks)
            all_corrections = deduplicate_corrections(all_corrections)

            # Store corrections
            for c in all_corrections:
                correction = Correction(
                    project_id=UUID(project_id),
                    original_text=c["original_text"],
                    suggested_text=c["suggested_text"],
                    context_sentence=c["context_sentence"],
                    position=c["position"],
                    status=CorrectionStatus.PENDING,
                )
                db.add(correction)

            await db.commit()

            logger.info(
                "_scan_typos_async: scan complete, corrections=%d, succeeded=%d, "
                "failed=%d, timed_out=%d, total_chunks=%d, project_id=%s",
                len(all_corrections), chunks_succeeded, chunks_failed,
                chunks_timed_out, total_chunks, project_id,
            )

            return {
                "corrections_found": len(all_corrections),
                "chunks_processed": chunks_succeeded,
                "chunks_failed": chunks_failed,
                "chunks_timed_out": chunks_timed_out,
                "total_chunks": total_chunks,
            }
    finally:
        await worker_engine.dispose()
        logger.debug("_scan_typos_async: worker engine disposed")
