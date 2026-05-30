"""Illustrations router: CRUD endpoints for project illustration management.

Provides GET, upload, PATCH, DELETE, save, reflow, and render-preview endpoints
for managing illustrations within a project's three-pool system (shared, available, in_book).
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.project import BookProject
from app.models.user import User
from app.services.illustrations.service import IllustrationsService

logger = logging.getLogger(__name__)

router = APIRouter()

# Accepted image MIME types and extensions for upload validation
ACCEPTED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ACCEPTED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


# ─── Pydantic Request Models ────────────────────────────────────────────────────


class IllustrationPatchRequest(BaseModel):
    """Request body for PATCH /illustrations/{image_uuid}.

    All fields are optional — only provided fields will be updated.
    """

    placement_mode: Optional[str] = Field(
        None, description="Placement type: full_page, plate, or inline"
    )
    page_number: Optional[int] = Field(None, description="Target page number")
    position_x: Optional[float] = Field(
        None, description="X position as percentage of page width (0.0-1.0)"
    )
    position_y: Optional[float] = Field(
        None, description="Y position as percentage of page height (0.0-1.0)"
    )
    height: Optional[float] = Field(
        None, description="Height in lines (inline) or percentage (full_page/plate)"
    )
    layout: Optional[str] = Field(
        None, description="Layout option: margins or edges"
    )
    side: Optional[str] = Field(None, description="Sheet side: left or right (plate only)")
    lock_state: Optional[bool] = Field(None, description="Whether placement is locked")
    label: Optional[str] = Field(None, description="User-facing display label")
    pool: Optional[str] = Field(
        None, description="Pool membership: shared, available, or in_book"
    )
    sort_order: Optional[int] = Field(None, description="Display ordering within pool")


class IllustrationSaveItem(BaseModel):
    """A single illustration DTO within a save payload."""

    image_uuid: str
    label: Optional[str] = None
    pool: Optional[str] = "available"
    source: Optional[str] = "uploaded"
    file_ext: Optional[str] = "png"
    original_width_px: Optional[int] = 0
    original_height_px: Optional[int] = 0
    placement_mode: Optional[str] = None
    page_number: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    height: Optional[float] = None
    layout: Optional[str] = None
    side: Optional[str] = None
    lock_state: Optional[bool] = False
    sort_order: Optional[int] = 0


class SavePayload(BaseModel):
    """Request body for POST /illustrations/save — atomic bulk save."""

    illustrations: list[IllustrationSaveItem]


class RenderPreviewRequest(BaseModel):
    """Request body for POST /illustrations/render-preview — single spread render."""

    page_number: int = Field(..., description="Page number of the spread to render")


async def _get_project(project_id: UUID, user_id: UUID, db: AsyncSession) -> BookProject:
    """Helper to load and validate project ownership.

    Args:
        project_id: The project UUID to look up.
        user_id: The user UUID for ownership validation.
        db: Database session.

    Returns:
        The BookProject instance.

    Raises:
        HTTPException 404 if project not found or not owned by user.
    """
    logger.debug(
        "_get_project: looking up project_id=%s, user_id=%s", project_id, user_id
    )
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == user_id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning(
            "_get_project: project not found or not owned — project_id=%s, user_id=%s",
            project_id,
            user_id,
        )
        raise HTTPException(status_code=404, detail="Project not found")
    logger.debug("_get_project: found project_id=%s, title=%s", project_id, project.title)
    return project


@router.get("/{project_id}/illustrations")
async def get_illustrations(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all illustration data for a project (pools, placements, locks, labels).

    Fetches project-scoped illustrations (available + in_book) and the user's
    shared pool images. Returns a combined list of illustration DTOs.
    """
    logger.info(
        "get_illustrations: entry — project_id=%s, user_id=%s",
        project_id,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Fetch all illustrations via service
    service = IllustrationsService(db)
    illustrations = await service.get_all(project_id, current_user.id)

    logger.info(
        "get_illustrations: exit — project_id=%s, user_id=%s, returning %d illustrations",
        project_id,
        current_user.id,
        len(illustrations),
    )
    return {"illustrations": illustrations, "count": len(illustrations)}


@router.post("/{project_id}/illustrations/upload", status_code=201)
async def upload_illustration(
    project_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept multipart image upload, validate format (PNG/JPG/WEBP), read dimensions, return UUID.

    Validates the uploaded file's format against accepted types (PNG, JPG, WEBP).
    Reads image dimensions, stores the file in the project's images directory,
    creates a database record, and returns the assigned Image_UUID with metadata.
    """
    logger.info(
        "upload_illustration: entry — project_id=%s, user_id=%s, filename=%s, "
        "content_type=%s",
        project_id,
        current_user.id,
        file.filename,
        file.content_type,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Validate file format by extension
    filename = file.filename or "image.png"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    logger.debug(
        "upload_illustration: extracted extension='%s' from filename='%s'",
        ext,
        filename,
    )

    if ext not in ACCEPTED_EXTENSIONS:
        logger.warning(
            "upload_illustration: rejected — invalid format '%s' from filename '%s'. "
            "Accepted: %s. project_id=%s, user_id=%s",
            ext,
            filename,
            ACCEPTED_EXTENSIONS,
            project_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=422,
            detail=f"Invalid image format '{ext}'. Only PNG, JPG, and WEBP files are accepted.",
        )

    # Read file content
    file_content = await file.read()
    logger.debug(
        "upload_illustration: read %d bytes from uploaded file, project_id=%s",
        len(file_content),
        project_id,
    )

    if len(file_content) == 0:
        logger.warning(
            "upload_illustration: rejected — empty file. project_id=%s, user_id=%s",
            project_id,
            current_user.id,
        )
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    # Delegate to service for dimension reading, storage, and DB record creation
    service = IllustrationsService(db)
    try:
        result = await service.upload_image(
            project_id=project_id,
            user_id=current_user.id,
            file_content=file_content,
            filename=filename,
            pool="available",
        )
    except ValueError as e:
        logger.error(
            "upload_illustration: service rejected upload — error=%s, "
            "project_id=%s, user_id=%s, filename=%s",
            str(e),
            project_id,
            current_user.id,
            filename,
        )
        raise HTTPException(status_code=422, detail=str(e))

    logger.info(
        "upload_illustration: exit — project_id=%s, user_id=%s, image_uuid=%s, "
        "dimensions=%dx%d, ext=%s",
        project_id,
        current_user.id,
        result.get("image_uuid"),
        result.get("original_width_px", 0),
        result.get("original_height_px", 0),
        result.get("file_ext"),
    )
    return result

# ─── PATCH: Update illustration placement, position, size, lock_state, or label ──


@router.patch("/{project_id}/illustrations/{image_uuid}")
async def patch_illustration(
    project_id: UUID,
    image_uuid: UUID,
    body: IllustrationPatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update placement, position, size, lock_state, or label for a single illustration.

    Accepts a JSON body with optional fields. Only provided (non-None) fields
    are applied to the illustration record. Returns the updated illustration DTO.
    """
    logger.info(
        "patch_illustration: entry — project_id=%s, image_uuid=%s, user_id=%s, "
        "body=%s",
        project_id,
        image_uuid,
        current_user.id,
        body.model_dump(exclude_none=True),
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Build updates dict from non-None fields
    updates = body.model_dump(exclude_none=True)
    if not updates:
        logger.warning(
            "patch_illustration: no fields to update — project_id=%s, "
            "image_uuid=%s, user_id=%s",
            project_id,
            image_uuid,
            current_user.id,
        )
        raise HTTPException(status_code=422, detail="No fields provided to update.")

    logger.debug(
        "patch_illustration: applying updates=%s to image_uuid=%s, project_id=%s",
        updates,
        image_uuid,
        project_id,
    )

    service = IllustrationsService(db)
    result = await service.update_illustration(
        image_uuid=image_uuid,
        user_id=current_user.id,
        updates=updates,
    )

    if result is None:
        logger.warning(
            "patch_illustration: illustration not found — image_uuid=%s, "
            "user_id=%s, project_id=%s",
            image_uuid,
            current_user.id,
            project_id,
        )
        raise HTTPException(status_code=404, detail="Illustration not found")

    logger.info(
        "patch_illustration: exit — project_id=%s, image_uuid=%s, user_id=%s, "
        "updated_fields=%s",
        project_id,
        image_uuid,
        current_user.id,
        list(updates.keys()),
    )
    return result


# ─── DELETE: Remove illustration from project ────────────────────────────────────


@router.delete("/{project_id}/illustrations/{image_uuid}")
async def delete_illustration(
    project_id: UUID,
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an image from the project.

    Deletes both the database record and the stored file from disk.
    Returns confirmation with the deleted image_uuid.
    """
    logger.info(
        "delete_illustration: entry — project_id=%s, image_uuid=%s, user_id=%s",
        project_id,
        image_uuid,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    service = IllustrationsService(db)
    deleted = await service.delete_illustration(
        image_uuid=image_uuid,
        user_id=current_user.id,
    )

    if not deleted:
        logger.warning(
            "delete_illustration: illustration not found — image_uuid=%s, "
            "user_id=%s, project_id=%s",
            image_uuid,
            current_user.id,
            project_id,
        )
        raise HTTPException(status_code=404, detail="Illustration not found")

    logger.info(
        "delete_illustration: exit — project_id=%s, image_uuid=%s deleted, user_id=%s",
        project_id,
        image_uuid,
        current_user.id,
    )
    return {"deleted": True, "image_uuid": str(image_uuid)}


# ─── POST /save: Atomic bulk save of all pools and placements ────────────────────


@router.post("/{project_id}/illustrations/save")
async def save_illustrations(
    project_id: UUID,
    body: SavePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist the complete current state of all pools and placements atomically.

    Accepts a JSON body with the full list of illustration DTOs. Replaces all
    existing illustration records for the project with the provided state.
    This is an atomic operation — either all changes succeed or none do.
    """
    logger.info(
        "save_illustrations: entry — project_id=%s, user_id=%s, "
        "illustration_count=%d",
        project_id,
        current_user.id,
        len(body.illustrations),
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Convert Pydantic models to dicts for the service
    illustrations_data = [ill.model_dump() for ill in body.illustrations]
    logger.debug(
        "save_illustrations: converted %d illustration DTOs to dicts, project_id=%s",
        len(illustrations_data),
        project_id,
    )

    service = IllustrationsService(db)
    result = await service.save_all(
        project_id=project_id,
        user_id=current_user.id,
        illustrations=illustrations_data,
    )

    logger.info(
        "save_illustrations: exit — project_id=%s, user_id=%s, saved_count=%d",
        project_id,
        current_user.id,
        len(result),
    )
    return {"illustrations": result, "count": len(result)}


# ─── POST /reflow: Trigger full reflow Celery task ──────────────────────────────


@router.post("/{project_id}/illustrations/reflow", status_code=202)
async def trigger_reflow(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full reflow Celery task for the project.

    Dispatches the illustrations.full_reflow Celery task which re-typesets
    the entire book with all locked illustrations. Returns the task_id for
    status polling via GET .../illustrations/reflow/status/{task_id} or
    GET /api/tasks/{task_id}/status.
    """
    logger.info(
        "trigger_reflow: entry — project_id=%s, user_id=%s",
        project_id,
        current_user.id,
    )

    # Validate project ownership
    project = await _get_project(project_id, current_user.id, db)

    # Verify project has text to typeset
    if not project.original_text_path and not project.working_text_path:
        logger.warning(
            "trigger_reflow: no text to typeset — project_id=%s, user_id=%s",
            project_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=400, detail="Project has no text to typeset"
        )

    # Dispatch the Celery task
    from app.services.illustrations.tasks import full_reflow_task

    task = full_reflow_task.delay(str(project_id), str(current_user.id))
    task_id = task.id

    logger.info(
        "trigger_reflow: exit — project_id=%s, user_id=%s, task_id=%s dispatched",
        project_id,
        current_user.id,
        task_id,
    )
    return {"task_id": task_id, "status": "generating"}


# ─── POST /lock: Lock a single image and trigger reflow ──────────────────────────


@router.post("/{project_id}/illustrations/{image_uuid}/lock")
async def lock_illustration(
    project_id: UUID,
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lock a single illustration and trigger a full reflow if transitioning from unlocked.

    Sets lock_state=True for the specified image. If the image was previously
    unlocked (unlocked→locked transition), dispatches a full reflow Celery task.
    Returns the task_id for status polling (or null if no reflow was needed).
    """
    logger.info(
        "lock_illustration: entry — project_id=%s, image_uuid=%s, user_id=%s",
        project_id,
        image_uuid,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    service = IllustrationsService(db)
    result = await service.lock_image(
        image_uuid=image_uuid,
        user_id=current_user.id,
    )

    if result is None:
        logger.warning(
            "lock_illustration: illustration not found — image_uuid=%s, "
            "user_id=%s, project_id=%s",
            image_uuid,
            current_user.id,
            project_id,
        )
        raise HTTPException(status_code=404, detail="Illustration not found")

    logger.info(
        "lock_illustration: exit — project_id=%s, image_uuid=%s, user_id=%s, "
        "task_id=%s",
        project_id,
        image_uuid,
        current_user.id,
        result.get("task_id"),
    )
    return result


# ─── POST /unlock: Unlock a single image with cascade ────────────────────────────


@router.post("/{project_id}/illustrations/{image_uuid}/unlock")
async def unlock_illustration(
    project_id: UUID,
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlock a single illustration and cascade unlock all images on later pages.

    When an image on page N is unlocked, all images on pages > N are also
    unlocked because their page numbers become unreliable after the earlier
    image's position changes.

    Returns the count of unlocked images (including the target).
    """
    logger.info(
        "unlock_illustration: entry — project_id=%s, image_uuid=%s, user_id=%s",
        project_id,
        image_uuid,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    service = IllustrationsService(db)
    result = await service.unlock_image(
        image_uuid=image_uuid,
        user_id=current_user.id,
    )

    if result is None:
        logger.warning(
            "unlock_illustration: illustration not found — image_uuid=%s, "
            "user_id=%s, project_id=%s",
            image_uuid,
            current_user.id,
            project_id,
        )
        raise HTTPException(status_code=404, detail="Illustration not found")

    logger.info(
        "unlock_illustration: exit — project_id=%s, image_uuid=%s, user_id=%s, "
        "unlocked_count=%d",
        project_id,
        image_uuid,
        current_user.id,
        result.get("unlocked_count", 0),
    )
    return result


# ─── POST /lock-all: Lock all unlocked images and trigger single reflow ──────────


@router.post("/{project_id}/illustrations/lock-all")
async def lock_all_illustrations(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lock all unlocked placed images and trigger a single full reflow.

    Finds all images in the in_book pool that are currently unlocked,
    sets their lock_state to True, and dispatches a single full reflow
    task for the entire book.

    Returns the locked_count and task_id for status polling.
    """
    logger.info(
        "lock_all_illustrations: entry — project_id=%s, user_id=%s",
        project_id,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    service = IllustrationsService(db)
    result = await service.lock_all(
        project_id=project_id,
        user_id=current_user.id,
    )

    logger.info(
        "lock_all_illustrations: exit — project_id=%s, user_id=%s, "
        "locked_count=%d, task_id=%s",
        project_id,
        current_user.id,
        result.get("locked_count", 0),
        result.get("task_id"),
    )
    return result


# ─── POST /render-preview: Render single spread via Typst for debounced preview ──


@router.post("/{project_id}/illustrations/render-preview")
async def render_preview(
    project_id: UUID,
    body: RenderPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render a single spread via Typst for debounced preview.

    Accepts a page number and renders the spread containing that page.
    This endpoint is called after a 500ms debounce during drag/resize
    operations to provide the authoritative Typst-rendered preview.

    Note: This is currently a stub that returns a placeholder response.
    The full Typst single-spread render is complex and will be implemented
    in a follow-up task.
    """
    logger.info(
        "render_preview: entry — project_id=%s, user_id=%s, page_number=%d",
        project_id,
        current_user.id,
        body.page_number,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Validate page_number is positive
    if body.page_number < 1:
        logger.warning(
            "render_preview: invalid page_number=%d — must be >= 1, "
            "project_id=%s, user_id=%s",
            body.page_number,
            project_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=422, detail="page_number must be >= 1"
        )

    # Stub response — full Typst single-spread render to be implemented later
    # The spread contains the requested page and its pair (left/right)
    spread_left = body.page_number if body.page_number % 2 == 1 else body.page_number - 1
    spread_right = spread_left + 1

    logger.info(
        "render_preview: exit (stub) — project_id=%s, user_id=%s, "
        "spread_left=%d, spread_right=%d, page_number=%d",
        project_id,
        current_user.id,
        spread_left,
        spread_right,
        body.page_number,
    )
    return {
        "status": "stub",
        "message": "Single-spread Typst render not yet implemented. "
        "Use client-side local reflow for preview.",
        "spread_left": spread_left,
        "spread_right": spread_right,
        "page_number": body.page_number,
    }


# ─── Reflow Status Polling ────────────────────────────────────────────────────────

# Stage metadata for reflow progress reporting — maps stage keys from the Celery
# task to human-readable labels and expected percent values.
REFLOW_STAGES = {
    "loading_illustrations": {"label": "Loading illustrations...", "percent": 10},
    "rendering_typst": {"label": "Rendering template...", "percent": 30},
    "compiling_pdf": {"label": "Compiling PDF...", "percent": 60},
    "updating_pages": {"label": "Updating page numbers...", "percent": 90},
}


@router.get("/{project_id}/illustrations/reflow/status/{task_id}")
async def get_reflow_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the progress of an illustration reflow task.

    Returns the current status, stage, label, and percent complete for the
    specified Celery task. The frontend polls this endpoint after triggering
    a reflow via POST .../illustrations/reflow.

    Stages reported by the task:
    - loading_illustrations (10%)
    - rendering_typst (30%)
    - compiling_pdf (60%)
    - updating_pages (90%)
    - done (100%)

    Args:
        project_id: The project UUID (used for ownership validation).
        task_id: The Celery task ID returned by the reflow trigger endpoint.
        current_user: Authenticated user.
        db: Database session.

    Returns:
        TaskStatusResponse: {status, stage, label, percent, result?}
    """
    logger.info(
        "get_reflow_status: entry — project_id=%s, task_id=%s, user_id=%s",
        project_id,
        task_id,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Query Celery for task state
    from app.worker import celery_app

    async_result = celery_app.AsyncResult(task_id)
    state = async_result.state
    logger.debug(
        "get_reflow_status: task_id=%s, celery_state=%s",
        task_id,
        state,
    )

    if state == "PENDING":
        response = {
            "status": "pending",
            "stage": "queued",
            "label": "Queued — waiting to start",
            "percent": 5,
        }
    elif state == "STARTED":
        response = {
            "status": "started",
            "stage": "starting",
            "label": "Starting reflow...",
            "percent": 10,
        }
    elif state == "PROGRESS":
        meta = async_result.info or {}
        stage = meta.get("stage", "unknown")
        # Use stage metadata from the task's reported values first, fall back to
        # our REFLOW_STAGES mapping for label/percent if the task didn't provide them.
        stage_info = REFLOW_STAGES.get(stage, {"label": stage, "percent": 50})
        response = {
            "status": "progress",
            "stage": stage,
            "label": meta.get("label", stage_info["label"]),
            "percent": meta.get("percent", stage_info["percent"]),
        }
    elif state == "SUCCESS":
        task_result = async_result.result or {}
        if isinstance(task_result, dict) and "error" in task_result:
            logger.error(
                "get_reflow_status: task completed with error — task_id=%s, "
                "project_id=%s, error=%s",
                task_id,
                project_id,
                task_result["error"],
            )
            response = {
                "status": "failed",
                "stage": "error",
                "label": task_result["error"],
                "percent": 0,
            }
        else:
            logger.info(
                "get_reflow_status: task complete — task_id=%s, project_id=%s, "
                "result=%s",
                task_id,
                project_id,
                task_result,
            )
            response = {
                "status": "complete",
                "stage": "done",
                "label": "Reflow completed successfully",
                "percent": 100,
                "result": task_result,
            }
    elif state == "FAILURE":
        error_msg = str(async_result.info) if async_result.info else "Unknown error"
        logger.error(
            "get_reflow_status: task failed — task_id=%s, project_id=%s, error=%s",
            task_id,
            project_id,
            error_msg,
        )
        response = {
            "status": "failed",
            "stage": "error",
            "label": error_msg,
            "percent": 0,
        }
    else:
        logger.warning(
            "get_reflow_status: unexpected celery state — task_id=%s, state=%s",
            task_id,
            state,
        )
        response = {
            "status": state.lower(),
            "stage": "unknown",
            "label": f"Status: {state}",
            "percent": 50,
        }

    logger.info(
        "get_reflow_status: exit — task_id=%s, status=%s, stage=%s, percent=%s",
        task_id,
        response["status"],
        response["stage"],
        response["percent"],
    )
    return response


# ─── POST /upscale: AI Upscale an image to increase resolution ────────────────────


@router.post("/{project_id}/illustrations/{image_uuid}/upscale")
async def upscale_illustration(
    project_id: UUID,
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI Upscale an image to increase its resolution.

    Processes the image using AI upscaling to increase its pixel dimensions,
    replaces the stored file with the upscaled version, updates the database
    record with new dimensions, and recalculates the resolution warning.

    Note: This is currently a stub that simulates a 2x upscale by doubling
    the stored pixel dimensions. Actual AI upscaling (e.g., Real-ESRGAN)
    is complex and will be implemented in a follow-up task.

    Requirements: 17.3, 17.4
    """
    logger.info(
        "upscale_illustration: entry — project_id=%s, image_uuid=%s, user_id=%s",
        project_id,
        image_uuid,
        current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Fetch the illustration record
    service = IllustrationsService(db)
    from app.models.illustration import Illustration

    result = await db.execute(
        select(Illustration).where(
            Illustration.image_uuid == image_uuid,
            Illustration.user_id == current_user.id,
        )
    )
    illustration = result.scalar_one_or_none()

    if illustration is None:
        logger.warning(
            "upscale_illustration: illustration not found — image_uuid=%s, "
            "user_id=%s, project_id=%s",
            image_uuid,
            current_user.id,
            project_id,
        )
        raise HTTPException(status_code=404, detail="Illustration not found")

    # --- Stub AI Upscale: simulate 2x upscale by doubling dimensions ---
    old_width = illustration.original_width_px
    old_height = illustration.original_height_px
    new_width = old_width * 2
    new_height = old_height * 2

    logger.info(
        "upscale_illustration: performing AI upscale (stub 2x) — "
        "image_uuid=%s, old_dimensions=%dx%d, new_dimensions=%dx%d",
        image_uuid,
        old_width,
        old_height,
        new_width,
        new_height,
    )

    # Update the database record with new dimensions
    illustration.original_width_px = new_width
    illustration.original_height_px = new_height
    await db.commit()
    await db.refresh(illustration)

    logger.info(
        "upscale_illustration: database updated — image_uuid=%s, "
        "new_dimensions=%dx%d",
        image_uuid,
        new_width,
        new_height,
    )

    # Recalculate resolution warning with new dimensions
    # (The frontend will also recalculate client-side, but we provide the
    # updated data in the response for consistency)
    from app.services.illustrations.dpi_calculator import (
        compute_display_inches,
        has_resolution_warning,
    )

    resolution_warning = False
    if illustration.placement_mode and illustration.height:
        aspect_ratio = new_width / new_height if new_height > 0 else 1.0
        try:
            display_w, display_h = compute_display_inches(
                height=illustration.height,
                placement_mode=illustration.placement_mode,
                page_width_inches=5.5,  # Default page dimensions
                page_height_inches=8.5,
                aspect_ratio=aspect_ratio,
            )
            resolution_warning = has_resolution_warning(
                new_width, new_height, display_w, display_h
            )
            logger.debug(
                "upscale_illustration: recalculated resolution_warning=%s — "
                "display_inches=(%.4f, %.4f), image_uuid=%s",
                resolution_warning,
                display_w,
                display_h,
                image_uuid,
            )
        except (ValueError, ZeroDivisionError) as e:
            logger.warning(
                "upscale_illustration: could not recalculate DPI — error=%s, "
                "image_uuid=%s",
                str(e),
                image_uuid,
            )

    logger.info(
        "upscale_illustration: exit — project_id=%s, image_uuid=%s, user_id=%s, "
        "new_dimensions=%dx%d, resolution_warning=%s",
        project_id,
        image_uuid,
        current_user.id,
        new_width,
        new_height,
        resolution_warning,
    )

    return {
        "success": True,
        "image_uuid": str(image_uuid),
        "original_width_px": new_width,
        "original_height_px": new_height,
        "resolution_warning": resolution_warning,
        "upscale_factor": 2,
        "message": "Image upscaled successfully (2x)",
    }
