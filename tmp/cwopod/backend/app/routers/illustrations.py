"""Illustrations router: CRUD endpoints for project illustration management.

Provides GET, upload, PATCH, DELETE, save, reflow, and render-preview endpoints
for managing illustrations within a project's three-pool system (shared, available, in_book).
"""

import logging
import subprocess
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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
        "get_illustrations: ENTRY — project_id=%s, user_id=%s",
        project_id,
        current_user.id,
    )

    # Validate project ownership
    project = await _get_project(project_id, current_user.id, db)

    # Fetch all illustrations via service
    service = IllustrationsService(db)
    illustrations = await service.get_all(project_id, current_user.id)

    # Log each illustration being returned
    logger.info(
        "get_illustrations: returning %d illustrations",
        len(illustrations),
    )
    for ill in illustrations:
        logger.info(
            "get_illustrations: RETURNING — uuid=%s, pool=%s, lock_state=%s, "
            "placement=%s, page_number=%s",
            ill.get("image_uuid"),
            ill.get("pool"),
            ill.get("lock_state"),
            ill.get("placement"),
            ill.get("placement", {}).get("page_number") if ill.get("placement") else None,
        )

    logger.info(
        "get_illustrations: EXIT — project_id=%s, user_id=%s, returning %d illustrations, page_count=%s",
        project_id,
        current_user.id,
        len(illustrations),
        project.page_count,
    )
    return {
        "illustrations": illustrations,
        "count": len(illustrations),
        "page_count": project.page_count,
    }


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
        "lock_all_illustrations: ENTRY — project_id=%s, user_id=%s",
        project_id,
        current_user.id,
    )

    # Validate project ownership
    project = await _get_project(project_id, current_user.id, db)
    logger.info(
        "lock_all_illustrations: project validated — title=%s, status=%s",
        project.title,
        project.status,
    )

    # Log all illustrations for this project BEFORE lock_all
    from app.models.illustration import Illustration
    all_query = select(Illustration).where(
        Illustration.project_id == project_id,
        Illustration.user_id == current_user.id,
    )
    all_result = await db.execute(all_query)
    all_images = all_result.scalars().all()
    logger.info(
        "lock_all_illustrations: BEFORE — total illustrations for project: %d",
        len(all_images),
    )
    for img in all_images:
        logger.info(
            "lock_all_illustrations: BEFORE — uuid=%s, pool=%s, lock_state=%s, "
            "placement_mode=%s, page_number=%s",
            img.image_uuid,
            img.pool.value if img.pool else None,
            img.lock_state,
            img.placement_mode.value if img.placement_mode else None,
            img.page_number,
        )

    service = IllustrationsService(db)
    result = await service.lock_all(
        project_id=project_id,
        user_id=current_user.id,
    )

    logger.info(
        "lock_all_illustrations: service.lock_all returned — result=%s",
        result,
    )

    # Commit the transaction explicitly
    logger.info("lock_all_illustrations: committing transaction...")
    await db.commit()
    logger.info("lock_all_illustrations: transaction committed")

    # Log all illustrations AFTER lock_all and commit
    all_result_after = await db.execute(all_query)
    all_images_after = all_result_after.scalars().all()
    logger.info(
        "lock_all_illustrations: AFTER COMMIT — total illustrations: %d",
        len(all_images_after),
    )
    for img in all_images_after:
        logger.info(
            "lock_all_illustrations: AFTER COMMIT — uuid=%s, pool=%s, lock_state=%s, "
            "placement_mode=%s, page_number=%s",
            img.image_uuid,
            img.pool.value if img.pool else None,
            img.lock_state,
            img.placement_mode.value if img.placement_mode else None,
            img.page_number,
        )

    logger.info(
        "lock_all_illustrations: EXIT — project_id=%s, user_id=%s, "
        "locked_count=%d, task_id=%s",
        project_id,
        current_user.id,
        result.get("locked_count", 0),
        result.get("task_id"),
    )
    return result


# ─── GET /thumb: Serve a thumbnail for an illustration ────────────────────────────


@router.get("/{project_id}/illustrations/{image_uuid}/thumb")
async def get_illustration_thumb(
    project_id: UUID,
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve the original image file as a thumbnail for the given illustration.

    Returns the stored image file (PNG/JPG/WEBP) for display in pool thumbnails.
    Currently serves the full-size image; a future optimization could generate
    and cache actual thumbnails at a smaller resolution.
    """
    logger.info(
        "get_illustration_thumb: entry — project_id=%s, image_uuid=%s, user_id=%s",
        project_id, image_uuid, current_user.id,
    )

    # Validate project ownership
    await _get_project(project_id, current_user.id, db)

    # Fetch the illustration record to get the file extension
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
            "get_illustration_thumb: illustration not found — image_uuid=%s, "
            "user_id=%s, project_id=%s",
            image_uuid, current_user.id, project_id,
        )
        raise HTTPException(status_code=404, detail="Illustration not found")

    # Determine the file path based on pool type
    from app.services.illustrations.storage import (
        get_project_image_path,
        get_shared_image_path,
    )
    from app.models.illustration import PoolType

    ext = illustration.file_ext or "png"
    if illustration.pool == PoolType.SHARED:
        image_path = get_shared_image_path(
            settings.storage_path, current_user.id, image_uuid, ext
        )
    else:
        image_path = get_project_image_path(
            settings.storage_path, project_id, image_uuid, ext
        )

    if not image_path.exists():
        logger.warning(
            "get_illustration_thumb: image file not found — path=%s, image_uuid=%s",
            image_path, image_uuid,
        )
        raise HTTPException(status_code=404, detail="Image file not found")

    # Determine media type from extension
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }
    media_type = media_types.get(ext.lower(), "image/png")

    logger.info(
        "get_illustration_thumb: serving image — image_uuid=%s, path=%s, media_type=%s",
        image_uuid, image_path, media_type,
    )
    return FileResponse(
        path=str(image_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ─── GET /page-image: Serve a rendered page image ─────────────────────────────────


@router.get("/{project_id}/illustrations/page-image/{page_number}")
async def get_page_image(
    project_id: UUID,
    page_number: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve a pre-rendered page image (PNG) for the spread preview.

    Returns the PNG image for the given page number. Images are generated
    by the render-preview endpoint and cached on disk.
    """
    logger.info(
        "get_page_image: entry — project_id=%s, user_id=%s, page_number=%d",
        project_id, current_user.id, page_number,
    )

    if page_number < 1:
        raise HTTPException(status_code=422, detail="page_number must be >= 1")

    # Validate project ownership
    project = await _get_project(project_id, current_user.id, db)

    # Check if the page image exists in the preview cache
    storage_dir = Path(settings.storage_path) / str(project_id)
    preview_dir = storage_dir / "page_previews"
    image_path = preview_dir / f"page-{page_number}.png"

    if not image_path.exists():
        logger.debug(
            "get_page_image: image not found at %s — returning 404, project_id=%s",
            image_path, project_id,
        )
        raise HTTPException(
            status_code=404,
            detail=f"Page image not available for page {page_number}. Run render-preview first.",
        )

    logger.info(
        "get_page_image: serving image — project_id=%s, page_number=%d, path=%s",
        project_id, page_number, image_path,
    )
    return FileResponse(
        path=str(image_path),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=60"},
    )


# ─── POST /render-preview: Render pages via Typst for spread preview ──────────────


@router.post("/{project_id}/illustrations/render-preview")
async def render_preview(
    project_id: UUID,
    body: RenderPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render a spread (two pages) via Typst as PNG images for the preview.

    Accepts a page number, determines the spread (left/right pair), and
    compiles those pages from the existing interior.typ source into PNG images.
    The images are cached on disk and served via the page-image endpoint.

    Requires that the book has been typeset at least once (interior.typ exists).
    """
    logger.info(
        "render_preview: entry — project_id=%s, user_id=%s, page_number=%d",
        project_id,
        current_user.id,
        body.page_number,
    )

    # Validate project ownership
    project = await _get_project(project_id, current_user.id, db)

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

    # Determine the spread to render
    # We want to show two facing pages: left (even) and right (odd)
    # If page_number is odd (right page), left page is page_number-1 (if exists)
    # If page_number is even (left page), right page is page_number+1
    # Special case: page 1 (odd) has no left page, so we show it on the right
    # with a blank/placeholder on the left
    if body.page_number % 2 == 1:  # odd (right page)
        # For page 1, show pages 1-2 (page 1 will be displayed on right)
        # For other odd pages, show (page_number-1, page_number)
        spread_left = body.page_number - 1 if body.page_number > 1 else 1
        spread_right = body.page_number if body.page_number > 1 else 2
    else:  # even (left page)
        spread_left = body.page_number
        spread_right = body.page_number + 1

    # Locate the Typst source file
    storage_dir = Path(settings.storage_path) / str(project_id)
    source_file = storage_dir / "interior.typ"

    if not source_file.exists():
        logger.warning(
            "render_preview: interior.typ not found — project_id=%s, path=%s. "
            "Book must be typeset first.",
            project_id, source_file,
        )
        raise HTTPException(
            status_code=400,
            detail="Book has not been typeset yet. Please typeset the book first, "
            "then return to the Illustrations step.",
        )

    # Patch interior.typ in-place to fix any known Typst syntax errors from older templates.
    # Specifically: #set heading() does not accept font: or size: arguments in this Typst version.
    # The correct syntax is: #set heading(numbering: none) + #show heading: set text(font: ..., size: ...)
    try:
        source_text = source_file.read_text(encoding="utf-8")
        import re as _re
        # Match: #set heading(numbering: none, font: "...", size: ...pt)
        # Replace with two separate rules
        patched = _re.sub(
            r'#set heading\(numbering: none, font: "([^"]+)", size: ([^)]+)\)',
            r'#set heading(numbering: none)\n#show heading: set text(font: "\1", size: \2)',
            source_text,
        )
        if patched != source_text:
            source_file.write_text(patched, encoding="utf-8")
            logger.info(
                "render_preview: patched interior.typ to fix #set heading font argument, project_id=%s",
                project_id,
            )
        else:
            logger.debug("render_preview: interior.typ does not need patching, project_id=%s", project_id)
    except Exception as patch_err:
        logger.warning(
            "render_preview: could not patch interior.typ — error=%s, project_id=%s",
            patch_err, project_id,
        )

    # Create preview output directory
    preview_dir = storage_dir / "page_previews"
    preview_dir.mkdir(parents=True, exist_ok=True)

    # Render the two pages of the spread as PNG using Typst
    # typst compile supports: typst compile input.typ output-{p}.png --pages 1-2
    # The {p} placeholder in the output path is replaced with the page number
    pages_to_render = f"{spread_left}-{spread_right}"
    # Clamp to actual page count if known
    if project.page_count and spread_right > project.page_count:
        pages_to_render = f"{spread_left}-{project.page_count}"

    # Use a temp output pattern, then rename to our naming convention
    # Typst outputs: output-{page_number}.png (1-indexed)
    output_pattern = str(preview_dir / "render-{p}.png")

    cmd = [
        "typst", "compile",
        str(source_file),
        output_pattern,
        "--pages", pages_to_render,
        "--ppi", "150",
    ]

    logger.info(
        "render_preview: running Typst compile — cmd=%s, project_id=%s",
        " ".join(cmd), project_id,
    )

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30,
            cwd=str(storage_dir),
        )
    except FileNotFoundError:
        logger.error("render_preview: typst binary not found")
        raise HTTPException(
            status_code=500, detail="Typst compiler not available on server."
        )
    except subprocess.TimeoutExpired:
        logger.error("render_preview: typst compile timed out after 30s, project_id=%s", project_id)
        raise HTTPException(
            status_code=500, detail="Page rendering timed out."
        )

    if result.returncode != 0:
        logger.error(
            "render_preview: typst compile failed — returncode=%d, stderr=%s, project_id=%s",
            result.returncode, result.stderr, project_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Page rendering failed: {result.stderr[:200]}",
        )

    logger.info(
        "render_preview: typst compile succeeded — project_id=%s, pages=%s",
        project_id, pages_to_render,
    )

    # Rename Typst output files to our naming convention (page-N.png)
    rendered_pages = []
    for page_num in range(spread_left, spread_right + 1):
        typst_output = preview_dir / f"render-{page_num}.png"
        final_path = preview_dir / f"page-{page_num}.png"
        if typst_output.exists():
            typst_output.rename(final_path)
            rendered_pages.append(page_num)
            logger.debug(
                "render_preview: renamed %s → %s", typst_output.name, final_path.name
            )
        else:
            logger.debug(
                "render_preview: page %d not rendered (may exceed page count), project_id=%s",
                page_num, project_id,
            )

    logger.info(
        "render_preview: complete — project_id=%s, spread_left=%d, spread_right=%d, "
        "rendered_pages=%s",
        project_id, spread_left, spread_right, rendered_pages,
    )

    return {
        "status": "complete",
        "spread_left": spread_left,
        "spread_right": spread_right,
        "rendered_pages": rendered_pages,
        "page_count": project.page_count,
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
