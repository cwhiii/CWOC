"""Cover router: prompt generation, image generation, blurb, upload, assembly, templates."""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.cover import CoverPrompt, CoverSession
from app.models.project import BookProject
from app.models.user import User
from app.services.cover.assembler import CoverAssembler, CoverValidationError
from app.services.cover.templates import list_templates, get_template

import logging

logger = logging.getLogger(__name__)

MAX_REGENERATIONS_PER_SESSION = 20

router = APIRouter()


class AssembleRequest(BaseModel):
    layout: dict
    paper_stock: str = "standard_white"


class GeneratePromptsRequest(BaseModel):
    mode: str = "standard"  # "standard" | "lucky"
    num_prompts: int = 5    # 3, 5, 7, or 11 (ignored in lucky mode)


@router.post("/{project_id}/cover/generate-prompts", status_code=202)
async def generate_prompts(
    project_id: UUID,
    body: GeneratePromptsRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kick off background task to generate spoiler-free cover art prompts.

    Modes:
        - "standard": Analyze every chapter (thorough, slower).
        - "lucky": Pick 1 random section of the book (fast, ~1 AI call).
    """
    mode = (body.mode if body else "standard") or "standard"
    num_prompts = (body.num_prompts if body else 5) or 5
    logger.info("generate_prompts called: project_id=%s, user_id=%s, mode=%s, num_prompts=%d", project_id, current_user.id, mode, num_prompts)

    if mode not in ("standard", "lucky"):
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}. Must be 'standard' or 'lucky'.")

    if mode != "lucky" and num_prompts not in (3, 5, 7, 11):
        raise HTTPException(status_code=400, detail=f"Invalid num_prompts: {num_prompts}. Must be 3, 5, 7, or 11.")
    # Lucky mode always generates 3 prompts regardless of what's sent
    if mode == "lucky":
        num_prompts = 3

    project = await _get_project(project_id, current_user.id, db)

    text_path = project.working_text_path or project.original_text_path
    if not text_path:
        logger.warning("generate_prompts: no text for project_id=%s", project_id)
        raise HTTPException(status_code=400, detail="Project has no text")

    from app.services.cover.tasks import generate_prompts_task

    task = generate_prompts_task.delay(str(project_id), str(current_user.id), mode, num_prompts)
    logger.info("generate_prompts: task dispatched task_id=%s, project_id=%s, mode=%s, num_prompts=%d", task.id, project_id, mode, num_prompts)

    return {"task_id": task.id, "status": "generating"}


# No fake stage percentages — progress is reported by the task itself
# based on actual chapters processed.


@router.get("/{project_id}/cover/generate-prompts/status/{task_id}")
async def get_prompt_generation_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the progress of a prompt generation task."""
    logger.debug("get_prompt_generation_status: project_id=%s, task_id=%s", project_id, task_id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    from app.worker import celery_app as celery

    result = celery.AsyncResult(task_id)
    state = result.state
    logger.debug("get_prompt_generation_status: task_id=%s, state=%s", task_id, state)

    if state == "PENDING":
        return {"status": "pending", "stage": "queued", "label": "Queued — waiting to start", "percent": 0}
    elif state == "STARTED":
        return {"status": "started", "stage": "starting", "label": "Starting...", "percent": 0}
    elif state == "PROGRESS":
        meta = result.info or {}
        current_chapter = meta.get("current_chapter", 0)
        total_chapters = meta.get("total_chapters", 1)
        chapter_title = meta.get("chapter_title", "")
        percent = meta.get("percent", 0)
        chapter_notes = meta.get("chapter_notes", [])
        tokens_generated = meta.get("tokens_generated", 0)
        model_loading = meta.get("model_loading", False)
        stage = meta.get("stage", "analyzing_chapters")

        if stage == "waiting_for_ai":
            label = "Waiting for AI model (CPU inference can take 1-3 minutes to start)..."
        elif chapter_title and chapter_title == "Synthesizing final prompts":
            label = "Synthesizing final prompts from all chapters"
        elif chapter_title:
            label = f"Analyzing chapter {current_chapter}/{total_chapters}: {chapter_title}"
        else:
            label = f"Analyzing chapter {current_chapter}/{total_chapters}"

        if model_loading and stage != "waiting_for_ai":
            label += " (processing...)"
        elif tokens_generated > 0:
            label += f" ({tokens_generated} tokens)"
        return {
            "status": "progress",
            "stage": stage,
            "label": label,
            "percent": percent,
            "current_chapter": current_chapter,
            "total_chapters": total_chapters,
            "tokens_generated": tokens_generated,
            "model_loading": model_loading,
            "chapter_notes": chapter_notes,
        }
    elif state == "SUCCESS":
        task_result = result.result or {}
        if "error" in task_result:
            logger.error("get_prompt_generation_status: task completed with error: %s", task_result["error"])
            return {"status": "failed", "stage": "error", "label": task_result["error"], "percent": 0}
        return {"status": "complete", "stage": "done", "label": "Prompts generated", "percent": 100, "result": task_result}
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("get_prompt_generation_status: task failed task_id=%s, error=%s", task_id, error_msg)
        return {"status": "failed", "stage": "error", "label": error_msg, "percent": 0}
    else:
        return {"status": state.lower(), "stage": "unknown", "label": f"Status: {state}", "percent": 0}


@router.get("/{project_id}/cover/prompts")
async def get_cover_prompts(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all saved cover prompts for a project."""
    logger.info("get_cover_prompts called: project_id=%s, user_id=%s", project_id, current_user.id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    result = await db.execute(
        select(CoverPrompt)
        .where(CoverPrompt.project_id == project_id)
        .order_by(CoverPrompt.created_at)
    )
    prompts = result.scalars().all()
    logger.info("get_cover_prompts: found %d prompts for project_id=%s", len(prompts), project_id)

    return {
        "prompts": [
            {
                "id": str(p.id),
                "prompt_text": p.prompt_text,
                "image_path": p.image_path,
                "selected": p.selected,
                "index": i + 1,
            }
            for i, p in enumerate(prompts)
        ],
        "count": len(prompts),
    }


class CreatePromptRequest(BaseModel):
    prompt_text: str


@router.post("/{project_id}/cover/prompts")
async def create_cover_prompt(
    project_id: UUID,
    body: CreatePromptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a manual cover prompt for a project."""
    logger.info("create_cover_prompt called: project_id=%s, user_id=%s, prompt_text_len=%d",
                project_id, current_user.id, len(body.prompt_text))

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    prompt_text = body.prompt_text.strip()
    if not prompt_text:
        logger.warning("create_cover_prompt: empty prompt_text, project_id=%s", project_id)
        raise HTTPException(status_code=400, detail="Prompt text cannot be empty")

    new_prompt = CoverPrompt(
        project_id=project_id,
        prompt_text=prompt_text,
    )
    db.add(new_prompt)
    await db.flush()

    logger.info("create_cover_prompt: created prompt_id=%s for project_id=%s", new_prompt.id, project_id)

    return {"id": str(new_prompt.id), "prompt_text": new_prompt.prompt_text}


@router.delete("/{project_id}/cover/prompts/{prompt_id}")
async def delete_cover_prompt(
    project_id: UUID,
    prompt_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single cover prompt by ID."""
    logger.info("delete_cover_prompt called: project_id=%s, prompt_id=%s, user_id=%s", project_id, prompt_id, current_user.id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    result = await db.execute(
        select(CoverPrompt).where(
            CoverPrompt.id == prompt_id,
            CoverPrompt.project_id == project_id,
        )
    )
    prompt = result.scalar_one_or_none()
    if prompt is None:
        logger.warning("delete_cover_prompt: prompt not found, prompt_id=%s, project_id=%s", prompt_id, project_id)
        raise HTTPException(status_code=404, detail="Prompt not found")

    await db.delete(prompt)
    await db.flush()
    logger.info("delete_cover_prompt: deleted prompt_id=%s from project_id=%s", prompt_id, project_id)

    return {"deleted": True, "prompt_id": str(prompt_id)}


@router.delete("/{project_id}/cover/prompts")
async def delete_all_cover_prompts(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all cover prompts for a project."""
    logger.info("delete_all_cover_prompts called: project_id=%s, user_id=%s", project_id, current_user.id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    result = await db.execute(
        select(CoverPrompt).where(CoverPrompt.project_id == project_id)
    )
    all_prompts = result.scalars().all()
    count = len(all_prompts)
    logger.info("delete_all_cover_prompts: found %d prompts to delete for project_id=%s", count, project_id)

    for prompt in all_prompts:
        await db.delete(prompt)

    await db.flush()
    logger.info("delete_all_cover_prompts: deleted %d prompts from project_id=%s", count, project_id)

    return {"deleted": True, "count": count}


@router.post("/{project_id}/cover/lookup-blurb")
async def lookup_blurb(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Look up a synopsis from Open Library / Google Books (free, no AI needed).

    This is the primary option for getting a back cover blurb. Falls back to
    Open Library first, then Google Books. Returns all found results so the
    user can pick the best one.
    """
    logger.info("lookup_blurb called: project_id=%s, user_id=%s", project_id, current_user.id)
    project = await _get_project(project_id, current_user.id, db)

    from app.services.cover.synopsis_lookup import SynopsisLookupService

    service = SynopsisLookupService()
    isbn = project.isbn or None
    author = project.author or None
    title = project.title

    logger.info(
        "lookup_blurb: searching title=%r, author=%r, isbn=%r",
        title, author, isbn,
    )

    results = await service.lookup_all(title, author, isbn)

    if not results:
        logger.info("lookup_blurb: no synopsis found for project_id=%s", project_id)
        return {
            "found": False,
            "results": [],
            "message": "No synopsis found. Try generating one with AI instead.",
        }

    logger.info("lookup_blurb: found %d results for project_id=%s", len(results), project_id)
    return {
        "found": True,
        "results": [
            {
                "synopsis": r.synopsis,
                "source": r.source,
                "word_count": r.word_count,
            }
            for r in results
        ],
    }


@router.post("/{project_id}/cover/generate-blurb", status_code=202)
async def generate_blurb(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kick off background task to generate a spoiler-free back cover synopsis (secondary option)."""
    logger.info("generate_blurb called: project_id=%s, user_id=%s", project_id, current_user.id)
    project = await _get_project(project_id, current_user.id, db)

    text_path = project.working_text_path or project.original_text_path
    if not text_path:
        logger.warning("generate_blurb: no text for project_id=%s", project_id)
        raise HTTPException(status_code=400, detail="Project has no text")

    from app.services.cover.tasks import generate_blurb_task

    task = generate_blurb_task.delay(str(project_id), str(current_user.id))
    logger.info("generate_blurb: task dispatched task_id=%s, project_id=%s", task.id, project_id)

    return {"task_id": task.id, "status": "generating"}


# Blurb generation is a single AI call — no granular progress available.
# Report honest status without fake percentages.


@router.get("/{project_id}/cover/generate-blurb/status/{task_id}")
async def get_blurb_generation_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the progress of a blurb generation task."""
    logger.debug("get_blurb_generation_status: project_id=%s, task_id=%s", project_id, task_id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    from app.worker import celery_app as celery

    result = celery.AsyncResult(task_id)
    state = result.state
    logger.debug("get_blurb_generation_status: task_id=%s, state=%s", task_id, state)

    if state == "PENDING":
        return {"status": "pending", "stage": "queued", "label": "Queued — waiting to start", "percent": None}
    elif state == "STARTED":
        return {"status": "started", "stage": "starting", "label": "Starting...", "percent": None}
    elif state == "PROGRESS":
        meta = result.info or {}
        stage = meta.get("stage", "generating_blurb")
        label = "Writing synopsis..." if stage == "generating_blurb" else "Reading book text..."
        return {"status": "progress", "stage": stage, "label": label, "percent": None}
    elif state == "SUCCESS":
        task_result = result.result or {}
        if "error" in task_result:
            logger.error("get_blurb_generation_status: task completed with error: %s", task_result["error"])
            return {"status": "failed", "stage": "error", "label": task_result["error"], "percent": None}
        return {"status": "complete", "stage": "done", "label": "Synopsis generated", "percent": 100, "result": task_result}
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("get_blurb_generation_status: task failed task_id=%s, error=%s", task_id, error_msg)
        return {"status": "failed", "stage": "error", "label": error_msg, "percent": None}
    else:
        return {"status": state.lower(), "stage": "unknown", "label": f"Status: {state}", "percent": None}


@router.post("/{project_id}/cover/assemble")
async def assemble_cover(
    project_id: UUID,
    body: AssembleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assemble the final print-ready cover PDF."""
    project = await _get_project(project_id, current_user.id, db)

    page_count = project.page_count or 200  # Default estimate

    assembler = CoverAssembler(trim_size=project.trim_size)

    try:
        storage_dir = Path(settings.storage_path) / str(project_id)
        storage_dir.mkdir(parents=True, exist_ok=True)

        # Inject app_url for back cover QR code
        layout = dict(body.layout)
        layout["app_url"] = settings.app_url

        # Resolve image URLs to filesystem paths
        # Frontend sends URLs like /api/projects/{id}/cover/images/{filename}
        # These need to be converted to /app/storage/{id}/cover_images/{filename}
        def resolve_image_path(url_or_path: str) -> str:
            if not url_or_path:
                return url_or_path
            # If it's already a filesystem path that exists, use it directly
            if Path(url_or_path).exists():
                return url_or_path
            # Try to extract filename from URL pattern
            prefix = f"/api/projects/{project_id}/cover/images/"
            if prefix in url_or_path:
                filename = url_or_path.split(prefix)[-1]
                resolved = str(storage_dir / "cover_images" / filename)
                logger.debug("assemble_cover: resolved image URL '%s' -> '%s'", url_or_path, resolved)
                return resolved
            # Fallback: try treating as relative to storage
            return url_or_path

        # Resolve front_image and front_cover.image_path
        if layout.get("front_image"):
            layout["front_image"] = resolve_image_path(layout["front_image"])
        if layout.get("front_cover", {}).get("image_path"):
            layout["front_cover"]["image_path"] = resolve_image_path(layout["front_cover"]["image_path"])

        pdf_path = await assembler.assemble_cover(
            layout=layout,
            page_count=page_count,
            paper_stock=body.paper_stock,
            output_dir=storage_dir,
            binding_type=project.binding_type or "paperback",
        )
    except CoverValidationError as e:
        raise HTTPException(status_code=422, detail={"error": "Missing required elements", "missing": e.missing_elements})

    # Update project
    project.cover_pdf_path = str(pdf_path)
    from app.models.project import ProjectStatus as PS
    if project.interior_pdf_path and project.cover_pdf_path:
        # Both PDFs ready — mark as print-ready
        project.status = PS.PRINT_READY
    elif project.status in (PS.DRAFT, PS.TYPESET):
        project.status = PS.COVER_READY
    await db.flush()

    spine_width = assembler.calculate_spine_width(page_count, body.paper_stock, binding_type=project.binding_type or "paperback")

    return {
        "pdf_path": str(pdf_path),
        "spine_width_mm": spine_width,
        "page_count": page_count,
    }


@router.get("/{project_id}/cover/spine-width")
async def get_spine_width(
    project_id: UUID,
    page_count: int = 200,
    paper_stock: str = "standard_white",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate spine width for preview."""
    project = await _get_project(project_id, current_user.id, db)
    assembler = CoverAssembler(trim_size=project.trim_size)
    spine_width = assembler.calculate_spine_width(page_count, paper_stock, binding_type=project.binding_type or "paperback")
    return {"spine_width_mm": spine_width, "page_count": page_count, "paper_stock": paper_stock}


class GenerateImageRequest(BaseModel):
    prompt_id: str
    prompt_text: str


@router.post("/{project_id}/cover/generate-image/cancel")
async def cancel_image_generation(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an in-progress image generation task for this project.

    Revokes the Celery task and clears the active_task_id so a new
    generation can be started immediately.
    """
    logger.info("cancel_image_generation called: project_id=%s, user_id=%s", project_id, current_user.id)
    await _get_project(project_id, current_user.id, db)

    result = await db.execute(
        select(CoverSession).where(CoverSession.project_id == project_id)
    )
    session = result.scalar_one_or_none()

    if not session or not session.active_task_id:
        logger.info("cancel_image_generation: no active task to cancel for project %s", project_id)
        return {"cancelled": False, "message": "No active generation task to cancel."}

    task_id = session.active_task_id

    # Verify the task is actually still running before revoking
    from app.worker import celery_app as celery
    existing_result = celery.AsyncResult(task_id)
    state = existing_result.state
    logger.info(
        "cancel_image_generation: revoking task_id=%s (state=%s) for project %s",
        task_id, state, project_id,
    )

    if state in ("PENDING", "STARTED", "PROGRESS"):
        # Revoke with terminate=True to kill the worker process if it's mid-execution
        celery.control.revoke(task_id, terminate=True, signal="SIGTERM")
        logger.info("cancel_image_generation: revoke sent for task_id=%s", task_id)

    # Clear the active task regardless of state
    session.active_task_id = None
    await db.flush()

    logger.info("cancel_image_generation: active_task_id cleared for project %s", project_id)
    return {"cancelled": True, "task_id": task_id, "previous_state": state}


@router.get("/{project_id}/cover/generate-image/active")
async def get_active_image_task(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if there's an active image generation task for this project.

    Called on page load so the frontend can resume polling an in-progress
    task instead of starting a new one (e.g. after a page refresh).
    """
    logger.debug("get_active_image_task: project_id=%s", project_id)
    await _get_project(project_id, current_user.id, db)

    result = await db.execute(
        select(CoverSession).where(CoverSession.project_id == project_id)
    )
    session = result.scalar_one_or_none()

    if not session or not session.active_task_id:
        return {"active": False, "task_id": None}

    # Verify the task is actually still running
    from app.worker import celery_app as celery
    existing_result = celery.AsyncResult(session.active_task_id)
    state = existing_result.state
    logger.info(
        "get_active_image_task: task_id=%s, state=%s for project %s",
        session.active_task_id, state, project_id,
    )

    if state in ("PENDING", "STARTED", "PROGRESS"):
        return {"active": True, "task_id": session.active_task_id, "state": state}

    # Task is done — clear it
    session.active_task_id = None
    await db.flush()
    return {"active": False, "task_id": None}


@router.post("/{project_id}/cover/generate-image", status_code=202)
async def generate_image(
    project_id: UUID,
    body: GenerateImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start background image generation from a prompt using the AI Engine.

    Returns a task_id for polling progress. The task reports real step-by-step
    progress (sampling steps) and preview images via the status endpoint.

    Enforces a maximum of 20 regenerations per cover generation session.

    If a generation task is already in progress for this project, returns the
    existing task_id instead of starting a new one (prevents ComfyUI queue
    conflicts on page refresh).
    """
    logger.info(f"generate_image called: project_id={project_id}, prompt_id={body.prompt_id}")

    project = await _get_project(project_id, current_user.id, db)

    # Check/create cover session and enforce regeneration limit
    result = await db.execute(
        select(CoverSession).where(CoverSession.project_id == project_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        session = CoverSession(project_id=project_id)
        db.add(session)
        await db.flush()
        logger.debug("generate_image: created new CoverSession for project %s", project_id)

    # Check if there's already an active task running for this project.
    # This prevents queueing a second ComfyUI job when the user refreshes
    # the page mid-generation (ComfyUI can only process one job at a time).
    if session.active_task_id:
        from app.worker import celery_app as celery
        existing_result = celery.AsyncResult(session.active_task_id)
        existing_state = existing_result.state
        logger.info(
            "generate_image: found active_task_id=%s in state=%s for project %s",
            session.active_task_id, existing_state, project_id,
        )
        if existing_state in ("PENDING", "STARTED", "PROGRESS"):
            # Task is still running — return it so the frontend can resume polling
            logger.info(
                "generate_image: returning existing in-progress task %s instead of starting new one",
                session.active_task_id,
            )
            return {
                "task_id": session.active_task_id,
                "status": "generating",
                "resumed": True,
                "regenerations_used": session.regeneration_count,
                "regenerations_remaining": MAX_REGENERATIONS_PER_SESSION - session.regeneration_count,
            }
        else:
            # Task finished (SUCCESS/FAILURE/REVOKED) — clear it
            logger.debug(
                "generate_image: clearing stale active_task_id=%s (state=%s)",
                session.active_task_id, existing_state,
            )
            session.active_task_id = None
            await db.flush()

    if session.regeneration_count >= MAX_REGENERATIONS_PER_SESSION:
        logger.warning(
            "generate_image: regeneration limit reached (%d/%d) for project %s",
            session.regeneration_count, MAX_REGENERATIONS_PER_SESSION, project_id,
        )
        raise HTTPException(
            status_code=429,
            detail=f"Maximum regenerations ({MAX_REGENERATIONS_PER_SESSION}) reached for this session. "
                   f"Please use one of the existing images or upload your own.",
        )

    # Increment regeneration count
    session.regeneration_count += 1
    await db.flush()
    logger.info(
        "generate_image: regeneration %d/%d for project %s",
        session.regeneration_count, MAX_REGENERATIONS_PER_SESSION, project_id,
    )

    from app.services.cover.tasks import generate_image_task

    task = generate_image_task.delay(
        str(project_id), str(current_user.id), body.prompt_id, body.prompt_text
    )
    logger.info("generate_image: task dispatched task_id=%s, project_id=%s, prompt_id=%s", task.id, project_id, body.prompt_id)

    # Store the active task ID so we can detect duplicate requests on refresh
    session.active_task_id = task.id
    await db.flush()

    return {
        "task_id": task.id,
        "status": "generating",
        "regenerations_used": session.regeneration_count,
        "regenerations_remaining": MAX_REGENERATIONS_PER_SESSION - session.regeneration_count,
    }


@router.get("/{project_id}/cover/generate-image/status/{task_id}")
async def get_image_generation_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the progress of an image generation task.

    Returns real step progress (step X/30), percentage, stage label,
    and a preview_url that updates as the image becomes clearer.
    """
    logger.debug("get_image_generation_status: project_id=%s, task_id=%s", project_id, task_id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    from app.worker import celery_app as celery

    result = celery.AsyncResult(task_id)
    state = result.state
    logger.debug("get_image_generation_status: task_id=%s, state=%s", task_id, state)

    if state == "PENDING":
        return {
            "status": "pending",
            "stage": "queued",
            "label": "Queued — waiting for worker...",
            "percent": 0,
            "current_step": 0,
            "total_steps": 30,
            "preview_url": None,
        }
    elif state == "STARTED":
        return {
            "status": "started",
            "stage": "starting",
            "label": "Starting image generation...",
            "percent": 0,
            "current_step": 0,
            "total_steps": 30,
            "preview_url": None,
        }
    elif state == "PROGRESS":
        meta = result.info or {}
        return {
            "status": "progress",
            "stage": meta.get("stage", "generating_image"),
            "label": meta.get("label", "Generating..."),
            "percent": meta.get("percent", 0),
            "current_step": meta.get("current_step", 0),
            "total_steps": meta.get("total_steps", 30),
            "preview_url": meta.get("preview_url"),
        }
    elif state == "SUCCESS":
        task_result = result.result or {}
        # Clear active_task_id since the task is done
        await _clear_active_task(project_id, task_id, db)
        if "error" in task_result:
            logger.error("get_image_generation_status: task completed with error: %s", task_result["error"])
            return {
                "status": "failed",
                "stage": "error",
                "label": task_result["error"],
                "percent": 0,
                "current_step": 0,
                "total_steps": 30,
                "preview_url": None,
            }
        return {
            "status": "complete",
            "stage": "done",
            "label": "Image generated!",
            "percent": 100,
            "current_step": 30,
            "total_steps": 30,
            "preview_url": None,
            "result": task_result,
        }
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("get_image_generation_status: task failed task_id=%s, error=%s", task_id, error_msg)
        # Clear active_task_id since the task is done
        await _clear_active_task(project_id, task_id, db)
        return {
            "status": "failed",
            "stage": "error",
            "label": error_msg,
            "percent": 0,
            "current_step": 0,
            "total_steps": 30,
            "preview_url": None,
        }
    else:
        return {
            "status": state.lower(),
            "stage": "unknown",
            "label": f"Status: {state}",
            "percent": 0,
            "current_step": 0,
            "total_steps": 30,
            "preview_url": None,
        }


@router.get("/{project_id}/cover/preview/{filename}")
async def serve_cover_preview(
    project_id: UUID,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve an intermediate preview image generated during sampling.

    These are low-res, noisy images that get progressively clearer as
    sampling steps advance. They are stored temporarily during generation.
    """
    logger.debug(f"serve_cover_preview: project_id={project_id}, filename={filename}")

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    preview_path = Path(settings.storage_path) / str(project_id) / "cover_previews" / safe_filename

    if not preview_path.exists():
        raise HTTPException(status_code=404, detail="Preview not found")

    from fastapi.responses import FileResponse
    # Add cache-busting headers so the browser always fetches the latest preview
    return FileResponse(
        str(preview_path),
        media_type="image/png",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


class UpscaleImageRequest(BaseModel):
    image_url: str  # URL path like /api/projects/{id}/cover/images/{filename}


@router.post("/{project_id}/cover/upscale-image", status_code=202)
async def upscale_image(
    project_id: UUID,
    body: UpscaleImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upscale a generated cover image from native resolution (512×768) to print resolution (1600×2400).

    Returns a task_id for polling progress. The upscaled image replaces the original.
    """
    logger.info(f"upscale_image called: project_id={project_id}, image_url={body.image_url}")

    await _get_project(project_id, current_user.id, db)

    # Resolve the image URL to a filesystem path
    safe_filename = Path(body.image_url).name
    image_path = Path(settings.storage_path) / str(project_id) / "cover_images" / safe_filename

    if not image_path.exists():
        logger.warning("upscale_image: image not found at %s", image_path)
        raise HTTPException(status_code=404, detail="Image not found")

    from app.services.cover.tasks import upscale_image_task

    task = upscale_image_task.delay(str(project_id), str(image_path), safe_filename)
    logger.info("upscale_image: task dispatched task_id=%s, project_id=%s, filename=%s", task.id, project_id, safe_filename)

    return {"task_id": task.id, "status": "upscaling"}


@router.get("/{project_id}/cover/upscale-image/status/{task_id}")
async def get_upscale_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the progress of an image upscale task."""
    logger.debug("get_upscale_status: project_id=%s, task_id=%s", project_id, task_id)

    await _get_project(project_id, current_user.id, db)

    from app.worker import celery_app as celery

    result = celery.AsyncResult(task_id)
    state = result.state

    if state == "PENDING":
        return {"status": "pending", "label": "Queued...", "percent": 0}
    elif state == "PROGRESS":
        meta = result.info or {}
        return {
            "status": "progress",
            "label": meta.get("label", "Upscaling..."),
            "percent": meta.get("percent", 50),
        }
    elif state == "SUCCESS":
        task_result = result.result or {}
        if "error" in task_result:
            return {"status": "failed", "label": task_result["error"], "percent": 0}
        return {
            "status": "complete",
            "label": "Upscale complete!",
            "percent": 100,
            "result": task_result,
        }
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        return {"status": "failed", "label": error_msg, "percent": 0}
    else:
        return {"status": state.lower(), "label": f"Status: {state}", "percent": 0}


@router.post("/{project_id}/cover/upload-image")
async def upload_cover_image(
    project_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a user-provided cover image."""
    logger.info(f"upload_cover_image called: project_id={project_id}, filename={file.filename}")

    project = await _get_project(project_id, current_user.id, db)

    # Validate format
    filename = file.filename or "cover.png"
    ext = Path(filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(status_code=415, detail="Only PNG and JPEG images are supported")

    content = await file.read()

    # Validate size (25 MB max)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 25 MB maximum")

    # Store image
    storage_dir = Path(settings.storage_path) / str(project_id) / "cover_images"
    storage_dir.mkdir(parents=True, exist_ok=True)

    image_path = storage_dir / f"uploaded{ext}"
    image_path.write_bytes(content)

    logger.info(f"upload_cover_image: saved {len(content)} bytes to {image_path}")
    image_url = f"/api/projects/{project_id}/cover/images/uploaded{ext}"
    return {"image_path": str(image_path), "image_url": image_url, "filename": filename}


@router.get("/{project_id}/cover/images")
async def list_cover_images(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all generated/uploaded cover images for a project.

    Returns image URLs and which one (if any) is currently selected.
    This allows the frontend to restore state after navigating away.
    """
    logger.info("list_cover_images: project_id=%s, user_id=%s", project_id, current_user.id)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    storage_dir = Path(settings.storage_path) / str(project_id) / "cover_images"
    images = []

    if storage_dir.exists():
        for img_file in sorted(storage_dir.iterdir()):
            if img_file.suffix.lower() in (".png", ".jpg", ".jpeg") and not img_file.name.endswith("_preview.png"):
                image_url = f"/api/projects/{project_id}/cover/images/{img_file.name}"
                # Derive a prompt_id from the filename (strip extension)
                prompt_id = img_file.stem
                # Check if image is print-resolution (upscaled)
                is_upscaled = False
                try:
                    from PIL import Image as PILImage
                    with PILImage.open(img_file) as img:
                        w, h = img.size
                        # Consider upscaled if at least 1600px wide or 2400px tall
                        is_upscaled = w >= 1600 or h >= 2400
                except Exception:
                    # If PIL not available or image unreadable, check file size heuristic
                    # Upscaled images are typically > 2MB, generated 512x768 are < 1MB
                    is_upscaled = img_file.stat().st_size > 2_000_000
                images.append({
                    "prompt_id": prompt_id,
                    "image_url": image_url,
                    "filename": img_file.name,
                    "size_bytes": img_file.stat().st_size,
                    "is_upscaled": is_upscaled,
                })

    # Read selected image from the selection file
    selection_file = storage_dir / ".selected"
    selected_image_url = None
    if selection_file.exists():
        try:
            selected_image_url = selection_file.read_text().strip()
            logger.debug("list_cover_images: selected image from file: %s", selected_image_url)
        except Exception as e:
            logger.warning("list_cover_images: failed to read selection file: %s", e)

    logger.info("list_cover_images: found %d images, selected=%s", len(images), selected_image_url)
    return {
        "images": images,
        "selected_image_url": selected_image_url,
    }


class SelectImageRequest(BaseModel):
    image_url: str


@router.post("/{project_id}/cover/select-image")
async def select_cover_image(
    project_id: UUID,
    body: SelectImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist the user's selected cover image choice.

    Stores the selection so it survives page navigation.
    Pass an empty image_url to clear the selection.
    """
    logger.info("select_cover_image: project_id=%s, image_url=%s", project_id, body.image_url)

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    storage_dir = Path(settings.storage_path) / str(project_id) / "cover_images"
    storage_dir.mkdir(parents=True, exist_ok=True)

    selection_file = storage_dir / ".selected"
    if body.image_url:
        selection_file.write_text(body.image_url)
        logger.info("select_cover_image: saved selection to %s", selection_file)
    else:
        # Clear selection
        if selection_file.exists():
            selection_file.unlink()
            logger.info("select_cover_image: cleared selection")

    return {"selected": body.image_url}


@router.get("/{project_id}/cover/images/{filename}")
async def serve_cover_image(
    project_id: UUID,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve a generated or uploaded cover image."""
    logger.debug(f"serve_cover_image: project_id={project_id}, filename={filename}")

    # Verify project ownership
    await _get_project(project_id, current_user.id, db)

    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    image_path = Path(settings.storage_path) / str(project_id) / "cover_images" / safe_filename

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    from fastapi.responses import FileResponse
    return FileResponse(str(image_path), media_type="image/png")


@router.get("/cover-templates")
async def get_templates(
    current_user: User = Depends(get_current_user),
):
    """Return all available cover templates."""
    logger.debug("get_templates: user_id=%s", current_user.id)
    templates = list_templates()
    logger.info("get_templates: returning %d templates", len(templates))
    return {"templates": templates, "count": len(templates)}


@router.get("/{project_id}/cover/pdf")
async def download_cover_pdf(
    project_id: UUID,
    request: Request,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Download the assembled cover PDF.

    Supports two auth modes:
    - Session cookie (normal user download)
    - Signed token query param (print provider download)
    """
    from app.middleware.auth import get_optional_user
    from app.utils.encryption import verify_download_token

    logger.info("download_cover_pdf: project_id=%s, has_token=%s", project_id, token is not None)
    project = None

    if token:
        result = verify_download_token(token)
        if result is None:
            raise HTTPException(status_code=403, detail="Invalid or expired download token")
        token_project_id, token_file_type = result
        if token_project_id != str(project_id) or token_file_type != "cover":
            raise HTTPException(status_code=403, detail="Token does not match requested file")
        project = await _get_project_by_id(project_id, db)
    else:
        user = await get_optional_user(request, db)
        if user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        project = await _get_project(project_id, user.id, db)

    if not project.cover_pdf_path:
        raise HTTPException(status_code=404, detail="No cover PDF generated yet")

    pdf_path = Path(project.cover_pdf_path)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Cover PDF file not found")

    from fastapi.responses import FileResponse
    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"{project.title or 'cover'}_cover.pdf",
    )


async def _get_project_by_id(project_id: UUID, db: AsyncSession) -> BookProject:
    """Load a project by ID without user ownership check (for token-based access)."""
    result = await db.execute(
        select(BookProject).where(BookProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_project(project_id: UUID, user_id: UUID, db: AsyncSession) -> BookProject:
    """Helper to load and validate project ownership."""
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == user_id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _clear_active_task(project_id: UUID, task_id: str, db: AsyncSession) -> None:
    """Clear the active_task_id from CoverSession when a task reaches a terminal state."""
    result = await db.execute(
        select(CoverSession).where(CoverSession.project_id == project_id)
    )
    session = result.scalar_one_or_none()
    if session and session.active_task_id == task_id:
        logger.debug("_clear_active_task: clearing task_id=%s for project %s", task_id, project_id)
        session.active_task_id = None
        await db.flush()
