"""Cover Celery tasks: prompt generation, blurb generation, image generation."""

import asyncio
import logging
import traceback
from pathlib import Path
from uuid import UUID

from app.config import settings
from app.worker import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a fresh event loop, ensuring clean teardown.

    Celery prefork workers reuse processes across tasks. If asyncio.run() is used
    directly, residual event loop state (connection pools, transports) from a
    previous task can leak into the next invocation, causing
    'Future attached to a different loop' errors.

    This helper creates a brand-new loop, runs the coroutine, and explicitly
    shuts down all async generators and the executor before closing the loop.
    """
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.run_until_complete(loop.shutdown_default_executor())
        finally:
            asyncio.set_event_loop(None)
            loop.close()


@celery_app.task(bind=True, name="cover.generate_prompts", soft_time_limit=1800, time_limit=1860)
def generate_prompts_task(self, project_id: str, user_id: str, mode: str = "standard", num_prompts: int = 5) -> dict:
    """Background task that generates cover art prompts via AI.

    Args:
        mode: "standard" (all chapters) or "lucky" (1 random sample).
        num_prompts: Number of prompts to generate (3, 5, 7, or 11). Ignored in lucky mode.
    """
    from app.services.resource_tracker import TaskResourceTimer

    logger.info(
        "generate_prompts_task STARTED: project_id=%s, user_id=%s, mode=%s, num_prompts=%d, task_id=%s",
        project_id, user_id, mode, num_prompts, self.request.id,
    )
    timer = TaskResourceTimer()
    timer.start()
    try:
        result = _run_async(_generate_prompts_async(self, project_id, user_id, mode, num_prompts))
        logger.info("generate_prompts_task COMPLETED: project_id=%s, mode=%s, result_count=%s", project_id, mode, result.get("count"))
        timer.stop()
        timer.save(project_id, user_id, "cover_generate", provider="local", notes=f"prompts mode={mode} n={num_prompts}")
        return result
    except Exception as e:
        logger.error(
            "generate_prompts_task FAILED: project_id=%s, mode=%s, error=%s\n%s",
            project_id, mode, str(e), traceback.format_exc(),
        )
        timer.stop()
        timer.save(project_id, user_id, "cover_generate", provider="local", notes=f"prompts FAILED: {str(e)[:100]}")
        return {"error": str(e)}


async def _generate_prompts_async(task, project_id: str, user_id: str, mode: str = "standard", num_prompts: int = 5) -> dict:
    """Async implementation of prompt generation — processes book chapter by chapter.

    Modes:
        - "standard": Analyze all chapters sequentially.
        - "lucky": Pick 1 random section, generate prompts from that alone.
    """
    from sqlalchemy import select

    from app.database import create_worker_session
    from app.models.cover import CoverPrompt
    from app.models.project import BookProject
    from app.services.ai_engine.router import AIRouter
    from app.services.cover.prompt_generator import CoverServiceError, PromptGenerator
    from app.services.typeset.chapter_detector import ChapterDetector

    logger.debug("_generate_prompts_async: creating worker session for current event loop, mode=%s", mode)
    worker_session, worker_engine = create_worker_session()

    try:
        async with worker_session() as db:
            # Load project and read text
            logger.info("_generate_prompts_async: loading project, project_id=%s", project_id)

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
                return {"error": "Project has no text"}

            raw_text = Path(text_path).read_text(encoding="utf-8")
            logger.info("_generate_prompts_async: raw text loaded, length=%d chars", len(raw_text))

            # If the file is HTML (from Pandoc normalization), convert to plain text
            # so the chapter detector can find patterns and the AI gets clean content.
            from app.services.typeset.html_to_text import html_to_text
            if text_path.endswith(".html") or "<p>" in raw_text[:2000]:
                logger.info("_generate_prompts_async: detected HTML content, converting to plain text")
                text = html_to_text(raw_text)
            else:
                text = raw_text

            if not text.strip():
                return {"error": "Text conversion produced empty output"}

            logger.info("_generate_prompts_async: plain text ready, length=%d chars", len(text))

            # Apply profanity filter (strip mode) if enabled for this user
            from app.models.user_preference import UserPreference
            pref_result = await db.execute(
                select(UserPreference).where(UserPreference.user_id == UUID(user_id))
            )
            user_pref = pref_result.scalar_one_or_none()
            profanity_enabled = (
                user_pref.profanity_filter_enabled
                if user_pref and user_pref.profanity_filter_enabled is not None
                else False
            )
            if profanity_enabled:
                logger.info("_generate_prompts_async: profanity filter enabled, stripping from text before AI")
                from app.models.system_settings import SystemSettings as SysSettings
                from app.services.profanity_filter.filter import strip_profanity, load_default_word_list
                sys_result = await db.execute(select(SysSettings).limit(1))
                sys_settings = sys_result.scalar_one_or_none()
                word_list = (
                    sys_settings.profanity_word_list
                    if sys_settings and sys_settings.profanity_word_list
                    else load_default_word_list()
                )
                text = strip_profanity(text, word_list)
                logger.info("_generate_prompts_async: profanity stripped, text length now=%d", len(text))

            # Detect chapters
            epub_nav = project.source_metadata.get("epub_nav") if project.source_metadata else None
            detector = ChapterDetector()
            chapters = detector.detect(text, epub_nav)
            logger.info("_generate_prompts_async: detected %d raw chapters", len(chapters))

            # Filter out chapters with insufficient content so progress reporting
            # accurately reflects actual work (avoids instant jump past empty front-matter).
            processable = [ch for ch in chapters if len(ch.content[:6000].strip()) >= 100]
            skipped = len(chapters) - len(processable)
            if skipped > 0:
                logger.info(
                    "_generate_prompts_async: filtered out %d chapters with < 100 chars, "
                    "%d remain for analysis",
                    skipped, len(processable),
                )
            # Use the filtered list for progress tracking
            # (generate_prompts will also filter internally, but we need the count here
            # for the on_tokens callback and initial state)
            total_chapters = len(processable) if processable else len(chapters)
            first_chapter_title = (
                (processable[0].title or f"Chapter {processable[0].number}")
                if processable
                else (chapters[0].title or f"Chapter {chapters[0].number}" if chapters else "")
            )
            logger.info("_generate_prompts_async: %d chapters to analyze", total_chapters)

            # --- "Lucky" mode: pick 1 random section from the book ---
            if mode == "lucky":
                import random
                source_chapters = processable if processable else chapters
                if not source_chapters:
                    return {"error": "No chapters with enough content to analyze"}
                lucky_chapter = random.choice(source_chapters)
                lucky_title = lucky_chapter.title or f"Chapter {lucky_chapter.number}"
                logger.info(
                    "_generate_prompts_async: LUCKY mode — picked '%s' (chapter %d of %d available)",
                    lucky_title, lucky_chapter.number, len(source_chapters),
                )
                chapters = [lucky_chapter]
                total_chapters = 1
                first_chapter_title = lucky_title

            # Report real progress as we process each chapter.
            # Chapters get 0-95%, synthesis step gets 95-100%.
            def on_progress(current: int, total: int, chapter_title: str, chapter_notes: list):
                if chapter_title == "Synthesizing final prompts":
                    percent = 95
                    stage = "synthesizing"
                else:
                    # Each chapter is an equal slice of 0-95%
                    # current is 1-indexed and called BEFORE processing,
                    # so (current-1)/total gives fraction completed so far
                    percent = int(((current - 1) / total) * 95) if total > 0 else 0
                    stage = "analyzing_chapters"
                logger.info(
                    "on_progress: chapter %d/%d title='%s' -> %d%% stage=%s",
                    current, total, chapter_title, percent, stage,
                )
                task.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": stage,
                        "current_chapter": current,
                        "total_chapters": total,
                        "chapter_title": chapter_title,
                        "percent": percent,
                        "chapter_notes": chapter_notes,
                    },
                )

            # Pre-flight: verify Ollama is reachable before committing to a long inference.
            # This catches the common case where the worker can't reach Ollama at all,
            # rather than hanging for 9 minutes waiting for the httpx timeout.
            import httpx
            ollama_base = settings.ollama_url or "http://ollama:11434"
            logger.info("_generate_prompts_async: pre-flight check to %s/api/tags", ollama_base)
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=15.0)) as preflight_client:
                    preflight_resp = await preflight_client.get(f"{ollama_base}/api/tags")
                    preflight_resp.raise_for_status()
                    logger.info("_generate_prompts_async: Ollama reachable, status=%d", preflight_resp.status_code)
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                logger.error("_generate_prompts_async: Ollama pre-flight FAILED: %s", e)
                return {"error": f"AI service (Ollama) is not reachable: {e}. Ensure the Ollama container is running."}

            ai_router = AIRouter(db, UUID(user_id))
            generator = PromptGenerator(ai_router)

            # Token-level progress: update Celery state with token count during inference
            def on_tokens(current_chapter: int, token_count: int, chapter_title: str, real_total: int):
                if chapter_title == "Synthesizing final prompts":
                    percent = 95
                    stage = "synthesizing"
                else:
                    percent = int(((current_chapter - 1) / real_total) * 95) if real_total > 0 else 0
                    stage = "analyzing_chapters"

                # token_count == -1 means waiting for first token (prompt processing)
                if token_count == -1:
                    meta_tokens = 0
                    loading = True
                    logger.debug(
                        "on_tokens: chapter %d/%d title='%s' -> waiting for first token",
                        current_chapter, real_total, chapter_title,
                    )
                else:
                    meta_tokens = token_count
                    loading = False

                task.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": stage,
                        "current_chapter": current_chapter,
                        "total_chapters": real_total,
                        "chapter_title": chapter_title,
                        "percent": percent,
                        "tokens_generated": meta_tokens,
                        "model_loading": loading,
                        "chapter_notes": [],
                    },
                )

            # Signal "waiting for AI" BEFORE starting inference so the frontend
            # knows the task is alive and working, not stuck.
            task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "waiting_for_ai",
                    "current_chapter": 1,
                    "total_chapters": total_chapters,
                    "chapter_title": first_chapter_title,
                    "percent": 0,
                    "tokens_generated": 0,
                    "model_loading": True,
                    "chapter_notes": [],
                },
            )
            logger.info(
                "_generate_prompts_async: starting AI inference, total_chapters=%d",
                total_chapters,
            )

            try:
                prompts = await generator.generate_prompts(
                    chapters, project.title, project.author or "",
                    on_progress=on_progress,
                    on_tokens=on_tokens,
                    mode=mode,
                    num_prompts=num_prompts,
                )
            except CoverServiceError as e:
                logger.error("_generate_prompts_async: AI error: %s", e.message)
                return {"error": e.message}

            logger.info("_generate_prompts_async: AI returned %d prompts", len(prompts))

            # Store in database
            prompt_records = []
            for i, prompt_text in enumerate(prompts):
                record = CoverPrompt(project_id=UUID(project_id), prompt_text=prompt_text)
                db.add(record)
                prompt_records.append(record)

            await db.flush()
            await db.commit()

            return {
                "prompts": [
                    {"id": str(r.id), "prompt_text": r.prompt_text, "index": i + 1}
                    for i, r in enumerate(prompt_records)
                ],
                "count": len(prompt_records),
            }
    finally:
        await worker_engine.dispose()
        logger.debug("_generate_prompts_async: worker engine disposed")


@celery_app.task(bind=True, name="cover.generate_blurb", soft_time_limit=600, time_limit=660)
def generate_blurb_task(self, project_id: str, user_id: str) -> dict:
    """Background task that generates a back cover blurb via AI."""
    logger.info(
        "generate_blurb_task STARTED: project_id=%s, user_id=%s, task_id=%s",
        project_id, user_id, self.request.id,
    )
    try:
        result = _run_async(_generate_blurb_async(self, project_id, user_id))
        logger.info("generate_blurb_task COMPLETED: project_id=%s", project_id)
        return result
    except Exception as e:
        logger.error(
            "generate_blurb_task FAILED: project_id=%s, error=%s\n%s",
            project_id, str(e), traceback.format_exc(),
        )
        return {"error": str(e)}


async def _generate_blurb_async(task, project_id: str, user_id: str) -> dict:
    """Async implementation of blurb generation."""
    from sqlalchemy import select

    from app.database import create_worker_session
    from app.models.project import BookProject
    from app.services.ai_engine.router import AIRouter
    from app.services.cover.blurb_generator import BlurbGenerator
    from app.services.cover.prompt_generator import CoverServiceError

    logger.debug("_generate_blurb_async: creating worker session for current event loop")
    worker_session, worker_engine = create_worker_session()

    try:
        async with worker_session() as db:
            # Stage 1: Load project and read text
            task.update_state(state="PROGRESS", meta={"stage": "reading_text"})
            logger.info("_generate_blurb_async: stage=reading_text, project_id=%s", project_id)

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
                return {"error": "Project has no text"}

            text = Path(text_path).read_text(encoding="utf-8")
            logger.info("_generate_blurb_async: text loaded, length=%d chars", len(text))

            # Apply profanity filter (strip mode) if enabled for this user
            from app.models.user_preference import UserPreference
            pref_result = await db.execute(
                select(UserPreference).where(UserPreference.user_id == UUID(user_id))
            )
            user_pref = pref_result.scalar_one_or_none()
            profanity_enabled = (
                user_pref.profanity_filter_enabled
                if user_pref and user_pref.profanity_filter_enabled is not None
                else False
            )
            if profanity_enabled:
                logger.info("_generate_blurb_async: profanity filter enabled, stripping from text before AI")
                from app.models.system_settings import SystemSettings as SysSettings
                from app.services.profanity_filter.filter import strip_profanity, load_default_word_list
                sys_result = await db.execute(select(SysSettings).limit(1))
                sys_settings = sys_result.scalar_one_or_none()
                word_list = (
                    sys_settings.profanity_word_list
                    if sys_settings and sys_settings.profanity_word_list
                    else load_default_word_list()
                )
                text = strip_profanity(text, word_list)
                logger.info("_generate_blurb_async: profanity stripped, text length now=%d", len(text))

            # Save chapter extracts to source_metadata for future summarization
            _save_chapter_extracts(project, text)
            await db.flush()
            logger.info("_generate_blurb_async: chapter extracts saved to source_metadata")

            # Stage 2: Send to AI
            task.update_state(state="PROGRESS", meta={"stage": "generating_blurb"})
            logger.info("_generate_blurb_async: stage=generating_blurb, sending to AI")

            ai_router = AIRouter(db, UUID(user_id))
            generator = BlurbGenerator(ai_router)

            # Pass chapter extracts if available for better context
            chapter_extracts = None
            if project.source_metadata and "chapter_extracts" in project.source_metadata:
                chapter_extracts = project.source_metadata["chapter_extracts"]
                logger.info(
                    "_generate_blurb_async: using %d saved chapter extracts",
                    len(chapter_extracts),
                )

            try:
                blurb = await generator.generate_blurb(
                    text, project.title, project.author or "",
                    chapter_extracts=chapter_extracts,
                )
            except CoverServiceError as e:
                logger.error("_generate_blurb_async: AI error: %s", e.message)
                return {"error": e.message}

            word_count = len(blurb.split())
            logger.info("_generate_blurb_async: blurb generated, word_count=%d", word_count)

            return {"blurb": blurb, "word_count": word_count}
    finally:
        await worker_engine.dispose()
        logger.debug("_generate_blurb_async: worker engine disposed")


@celery_app.task(bind=True, name="cover.generate_image", soft_time_limit=600, time_limit=660)
def generate_image_task(self, project_id: str, user_id: str, prompt_id: str, prompt_text: str) -> dict:
    """Background task that generates a cover image with real step-by-step progress.

    Uses ComfyUI WebSocket to report actual sampling steps and preview images.
    """
    from app.services.resource_tracker import TaskResourceTimer

    logger.info(
        "generate_image_task STARTED: project_id=%s, user_id=%s, prompt_id=%s, task_id=%s",
        project_id, user_id, prompt_id, self.request.id,
    )
    timer = TaskResourceTimer()
    timer.start()
    try:
        result = _run_async(_generate_image_async(self, project_id, user_id, prompt_id, prompt_text))
        logger.info("generate_image_task COMPLETED: project_id=%s, prompt_id=%s", project_id, prompt_id)
        timer.stop()
        timer.save(project_id, user_id, "cover_generate", provider="local", notes=f"prompt_id={prompt_id}")
        return result
    except Exception as e:
        logger.error(
            "generate_image_task FAILED: project_id=%s, prompt_id=%s, error=%s\n%s",
            project_id, prompt_id, str(e), traceback.format_exc(),
        )
        timer.stop()
        timer.save(project_id, user_id, "cover_generate", provider="local", notes=f"FAILED: {str(e)[:100]}")
        return {"error": str(e)}


async def _generate_image_async(task, project_id: str, user_id: str, prompt_id: str, prompt_text: str) -> dict:
    """Async implementation of image generation with real progress reporting."""
    from app.config import settings
    from app.database import create_worker_session
    from app.services.ai_engine.router import AIRouter

    logger.debug("_generate_image_async: creating worker session")
    worker_session, worker_engine = create_worker_session()

    # Directory for preview images
    preview_dir = Path(settings.storage_path) / project_id / "cover_previews"
    preview_dir.mkdir(parents=True, exist_ok=True)

    # Report initial state
    task.update_state(
        state="PROGRESS",
        meta={
            "stage": "sending_prompt",
            "percent": 0,
            "current_step": 0,
            "total_steps": 30,
            "preview_url": None,
            "label": "Sending prompt to image provider...",
        },
    )

    try:
        async with worker_session() as db:
            ai_router = AIRouter(db, UUID(user_id))
            config = await ai_router._get_config()
            system_defaults = await ai_router._get_system_defaults()
            provider_name = config.image_provider if config else "local"

            logger.info(
                "_generate_image_async: provider=%s, prompt_id=%s",
                provider_name, prompt_id,
            )

            last_preview_path = [None]  # mutable container for closure

            # For local (ComfyUI) provider, use the progress-aware method
            if provider_name == "local":
                provider = ai_router._get_provider("image", config, system_defaults)

                def on_progress(current_step: int, total_steps: int, preview_bytes):
                    """Callback from ComfyUI WebSocket with real step progress."""
                    # Handle preview image
                    if preview_bytes and len(preview_bytes) > 100:
                        preview_filename = f"{prompt_id}_preview.png"
                        preview_path = preview_dir / preview_filename
                        try:
                            preview_path.write_bytes(preview_bytes)
                            last_preview_path[0] = f"/api/projects/{project_id}/cover/preview/{preview_filename}"
                            logger.debug(
                                "on_progress: saved preview image, size=%d bytes",
                                len(preview_bytes),
                            )
                        except Exception as e:
                            logger.warning("on_progress: failed to save preview: %s", e)

                    # Calculate real percent from steps
                    if current_step > 0 and total_steps > 0:
                        # Steps are 5-95% of total progress (leaving room for setup/save)
                        percent = 5 + int((current_step / total_steps) * 90)
                        stage = "generating_image"
                        label = f"Rendering step {current_step}/{total_steps}..."
                    elif current_step == -1:
                        # Preview image received without step info — use last state
                        return
                    else:
                        percent = 2
                        stage = "generating_image"
                        label = "AI is rendering your cover image..."

                    task.update_state(
                        state="PROGRESS",
                        meta={
                            "stage": stage,
                            "percent": percent,
                            "current_step": max(current_step, 0),
                            "total_steps": total_steps if total_steps > 0 else 30,
                            "preview_url": last_preview_path[0],
                            "label": label,
                        },
                    )

                # Update state to show we're starting generation
                task.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": "generating_image",
                        "percent": 2,
                        "current_step": 0,
                        "total_steps": 30,
                        "preview_url": None,
                        "label": "AI is rendering your cover image...",
                    },
                )

                image_bytes = await asyncio.wait_for(
                    provider.generate_image_with_progress(
                        prompt=prompt_text,
                        width=1600,
                        height=2400,
                        on_progress=on_progress,
                    ),
                    timeout=600,
                )
            else:
                # Non-local providers: no step progress available, just await result
                task.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": "generating_image",
                        "percent": 10,
                        "current_step": 0,
                        "total_steps": 0,
                        "preview_url": None,
                        "label": f"Waiting for {provider_name} to generate image...",
                    },
                )

                result = await ai_router.generate_image(
                    prompt=prompt_text,
                    width=1600,
                    height=2400,
                )

                if not result.success:
                    logger.error("_generate_image_async: AI error: %s", result.error)
                    return {"error": result.error}

                if isinstance(result.data, bytes):
                    image_bytes = result.data
                elif isinstance(result.data, str):
                    # URL — download it
                    import httpx
                    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as dl_client:
                        img_response = await dl_client.get(result.data)
                        img_response.raise_for_status()
                        image_bytes = img_response.content
                else:
                    return {"error": "Unexpected image generation result format"}

            # Save final image
            task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "saving",
                    "percent": 96,
                    "current_step": 30,
                    "total_steps": 30,
                    "preview_url": last_preview_path[0],
                    "label": "Saving image to project storage...",
                },
            )

            storage_dir = Path(settings.storage_path) / project_id / "cover_images"
            storage_dir.mkdir(parents=True, exist_ok=True)

            image_filename = f"{prompt_id}.png"
            image_path = storage_dir / image_filename
            image_path.write_bytes(image_bytes)
            logger.info(
                "_generate_image_async: saved final image to %s, size=%d bytes",
                image_path, len(image_bytes),
            )

            image_url = f"/api/projects/{project_id}/cover/images/{image_filename}"

            return {
                "image_path": str(image_path),
                "image_url": image_url,
                "prompt_id": prompt_id,
            }

    finally:
        await worker_engine.dispose()
        logger.debug("_generate_image_async: worker engine disposed")


@celery_app.task(bind=True, name="cover.upscale_image", soft_time_limit=120, time_limit=180)
def upscale_image_task(self, project_id: str, image_path: str, filename: str) -> dict:
    """Upscale a cover image from native SD resolution to print resolution (1600×2400).

    Uses Pillow Lanczos resampling for high-quality upscaling.
    """
    import io

    from PIL import Image

    logger.info(
        "upscale_image_task STARTED: project_id=%s, image_path=%s, task_id=%s",
        project_id, image_path, self.request.id,
    )

    try:
        self.update_state(
            state="PROGRESS",
            meta={"label": "Reading source image...", "percent": 10},
        )

        source_path = Path(image_path)
        if not source_path.exists():
            logger.error("upscale_image_task: source image not found: %s", image_path)
            return {"error": "Source image not found"}

        img = Image.open(source_path)
        original_w, original_h = img.size
        logger.info(
            "upscale_image_task: loaded image %dx%d from %s",
            original_w, original_h, image_path,
        )

        # Target: 1600×2400 (standard 5.5"×8.5" cover at 300 DPI with bleed)
        target_w, target_h = 1600, 2400

        if original_w >= target_w and original_h >= target_h:
            logger.info("upscale_image_task: image already at or above target resolution, skipping")
            image_url = f"/api/projects/{project_id}/cover/images/{filename}"
            return {
                "image_url": image_url,
                "width": original_w,
                "height": original_h,
                "already_hires": True,
            }

        self.update_state(
            state="PROGRESS",
            meta={
                "label": f"Upscaling {original_w}×{original_h} → {target_w}×{target_h}...",
                "percent": 40,
            },
        )

        # Lanczos upscale — highest quality resampling filter
        img_upscaled = img.resize((target_w, target_h), Image.LANCZOS)
        logger.info("upscale_image_task: upscaled to %dx%d", target_w, target_h)

        self.update_state(
            state="PROGRESS",
            meta={"label": "Saving upscaled image...", "percent": 80},
        )

        # Save upscaled image — overwrite the original
        output = io.BytesIO()
        img_upscaled.save(output, format="PNG", optimize=True)
        upscaled_bytes = output.getvalue()
        source_path.write_bytes(upscaled_bytes)

        logger.info(
            "upscale_image_task COMPLETED: %dx%d -> %dx%d, size=%d bytes, path=%s",
            original_w, original_h, target_w, target_h, len(upscaled_bytes), image_path,
        )

        image_url = f"/api/projects/{project_id}/cover/images/{filename}"
        return {
            "image_url": image_url,
            "width": target_w,
            "height": target_h,
            "original_width": original_w,
            "original_height": original_h,
            "already_hires": False,
        }

    except Exception as e:
        logger.error(
            "upscale_image_task FAILED: project_id=%s, error=%s\n%s",
            project_id, str(e), traceback.format_exc(),
        )
        return {"error": str(e)}


def _save_chapter_extracts(project, text: str) -> None:
    """Extract and save chapter opening passages to source_metadata.

    These extracts can be used later for back cover summarization without
    needing to re-read the full text. Saves the first ~500 chars of each
    detected chapter (up to 20 chapters).
    """
    import re

    logger.debug("_save_chapter_extracts: extracting chapter openings from text")

    # Detect chapter boundaries (common patterns in normalized HTML or plain text)
    chapter_patterns = [
        r'<h[12][^>]*>(.*?)</h[12]>',  # HTML headings
        r'^(?:Chapter|CHAPTER)\s+[\dIVXLCDM]+[.:\s]*(.*)',  # "Chapter 1: Title"
        r'^(?:Part|PART)\s+[\dIVXLCDM]+[.:\s]*(.*)',  # "Part I: Title"
    ]

    chapters = []
    for pattern in chapter_patterns:
        matches = list(re.finditer(pattern, text, re.MULTILINE | re.IGNORECASE))
        if len(matches) >= 3:  # Need at least 3 matches to consider it a valid pattern
            for i, match in enumerate(matches[:20]):  # Cap at 20 chapters
                start = match.end()
                # Get the next ~500 chars after the heading
                end = min(start + 500, len(text))
                if i + 1 < len(matches):
                    end = min(end, matches[i + 1].start())
                extract = text[start:end].strip()
                # Clean HTML tags from extract
                extract = re.sub(r'<[^>]+>', ' ', extract)
                extract = re.sub(r'\s+', ' ', extract).strip()
                title = match.group(1).strip() if match.lastindex else f"Chapter {i + 1}"
                title = re.sub(r'<[^>]+>', '', title).strip()
                if extract:
                    chapters.append({"title": title, "extract": extract[:500]})
            break  # Use the first pattern that works

    if chapters:
        # Update source_metadata with chapter extracts
        metadata = dict(project.source_metadata) if project.source_metadata else {}
        metadata["chapter_extracts"] = chapters
        metadata["chapter_extract_count"] = len(chapters)
        project.source_metadata = metadata
        logger.info(
            "_save_chapter_extracts: saved %d chapter extracts for project_id=%s",
            len(chapters), project.id,
        )
    else:
        logger.debug("_save_chapter_extracts: no chapter boundaries detected")

