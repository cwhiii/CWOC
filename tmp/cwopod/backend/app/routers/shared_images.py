"""Shared images router: manage user-level shared image pool.

Provides endpoints for listing, uploading, and deleting images in the
user's shared pool. These images persist across all book projects and
can be copied into any project's Available pool.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.illustrations.service import IllustrationsService, ACCEPTED_FORMATS

logger = logging.getLogger(__name__)

router = APIRouter()

# Maximum upload size: 50MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024


@router.get("/shared-images")
async def get_shared_images(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all shared images for the current user.

    Returns a list of illustration DTOs for images in the user's shared pool.
    These are user-level images not tied to any specific project.
    """
    logger.info(
        "get_shared_images: entry — user_id=%s",
        current_user.id,
    )

    service = IllustrationsService(db)

    from sqlalchemy import select
    from app.models.illustration import Illustration, PoolType

    query = select(Illustration).where(
        Illustration.user_id == current_user.id,
        Illustration.pool == PoolType.SHARED,
        Illustration.project_id.is_(None),
    )
    result = await db.execute(query)
    shared_illustrations = result.scalars().all()

    images = [service._to_dto(ill) for ill in shared_illustrations]

    logger.info(
        "get_shared_images: exit — user_id=%s, returning %d shared images",
        current_user.id,
        len(images),
    )
    return {"images": images, "count": len(images)}


@router.post("/shared-images/upload")
async def upload_shared_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image to the user's shared pool.

    Accepts PNG, JPG, and WEBP file formats. Validates the format,
    reads image dimensions, stores the file, and creates a DB record
    with a generated Image_UUID.

    Returns the created illustration DTO with the assigned UUID.
    """
    logger.info(
        "upload_shared_image: entry — user_id=%s, filename=%s, content_type=%s",
        current_user.id,
        file.filename,
        file.content_type,
    )

    # Validate filename exists
    if not file.filename:
        logger.warning(
            "upload_shared_image: rejected — no filename provided, user_id=%s",
            current_user.id,
        )
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate file extension
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ACCEPTED_FORMATS:
        logger.warning(
            "upload_shared_image: rejected — invalid format '%s' from filename '%s', "
            "user_id=%s. Accepted: %s",
            ext,
            file.filename,
            current_user.id,
            ACCEPTED_FORMATS,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image format '{ext}'. Only PNG, JPG, and WEBP files are accepted.",
        )

    # Read file content
    file_content = await file.read()
    logger.debug(
        "upload_shared_image: read %d bytes from file '%s', user_id=%s",
        len(file_content),
        file.filename,
        current_user.id,
    )

    # Validate file size
    if len(file_content) > MAX_UPLOAD_SIZE:
        logger.warning(
            "upload_shared_image: rejected — file too large (%d bytes > %d max), "
            "filename='%s', user_id=%s",
            len(file_content),
            MAX_UPLOAD_SIZE,
            file.filename,
            current_user.id,
        )
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
        )

    # Validate file is not empty
    if len(file_content) == 0:
        logger.warning(
            "upload_shared_image: rejected — empty file, filename='%s', user_id=%s",
            file.filename,
            current_user.id,
        )
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Use the service to handle upload logic
    service = IllustrationsService(db)

    try:
        result = await service.upload_image(
            project_id=None,
            user_id=current_user.id,
            file_content=file_content,
            filename=file.filename,
            pool="shared",
        )
    except ValueError as e:
        logger.error(
            "upload_shared_image: service rejected upload — error='%s', "
            "filename='%s', user_id=%s",
            str(e),
            file.filename,
            current_user.id,
        )
        raise HTTPException(status_code=422, detail=str(e))

    logger.info(
        "upload_shared_image: exit — user_id=%s, image_uuid=%s, label='%s'",
        current_user.id,
        result.get("image_uuid"),
        result.get("label"),
    )
    return result


@router.delete("/shared-images/{image_uuid}")
async def delete_shared_image(
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an image from the user's shared pool.

    Deletes both the database record and the stored file from disk.
    Only images in the shared pool (project_id=None) owned by the
    current user can be deleted via this endpoint.
    """
    logger.info(
        "delete_shared_image: entry — image_uuid=%s, user_id=%s",
        image_uuid,
        current_user.id,
    )

    service = IllustrationsService(db)

    # Verify the image exists and is in the shared pool before deleting
    from sqlalchemy import select
    from app.models.illustration import Illustration, PoolType

    query = select(Illustration).where(
        Illustration.image_uuid == image_uuid,
        Illustration.user_id == current_user.id,
        Illustration.pool == PoolType.SHARED,
        Illustration.project_id.is_(None),
    )
    result = await db.execute(query)
    illustration = result.scalar_one_or_none()

    if illustration is None:
        logger.warning(
            "delete_shared_image: not found — image_uuid=%s, user_id=%s "
            "(either doesn't exist, not owned by user, or not in shared pool)",
            image_uuid,
            current_user.id,
        )
        raise HTTPException(
            status_code=404,
            detail="Shared image not found",
        )

    # Use the service to delete (handles file removal + DB record)
    deleted = await service.delete_illustration(image_uuid, current_user.id)

    if not deleted:
        logger.error(
            "delete_shared_image: service failed to delete — image_uuid=%s, user_id=%s",
            image_uuid,
            current_user.id,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to delete shared image",
        )

    logger.info(
        "delete_shared_image: exit — image_uuid=%s deleted successfully, user_id=%s",
        image_uuid,
        current_user.id,
    )
    return {"deleted": True, "image_uuid": str(image_uuid)}


@router.get("/shared-images/{image_uuid}/thumb")
async def get_shared_image_thumb(
    image_uuid: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve the original image file as a thumbnail for a shared pool image.

    Returns the stored image file (PNG/JPG/WEBP) for display in pool thumbnails.
    Currently serves the full-size image; a future optimization could generate
    and cache actual thumbnails at a smaller resolution.
    """
    logger.info(
        "get_shared_image_thumb: entry — image_uuid=%s, user_id=%s",
        image_uuid, current_user.id,
    )

    # Fetch the illustration record to get the file extension
    from sqlalchemy import select
    from app.models.illustration import Illustration, PoolType

    query = select(Illustration).where(
        Illustration.image_uuid == image_uuid,
        Illustration.user_id == current_user.id,
        Illustration.pool == PoolType.SHARED,
        Illustration.project_id.is_(None),
    )
    result = await db.execute(query)
    illustration = result.scalar_one_or_none()

    if illustration is None:
        logger.warning(
            "get_shared_image_thumb: illustration not found — image_uuid=%s, user_id=%s",
            image_uuid, current_user.id,
        )
        raise HTTPException(status_code=404, detail="Shared image not found")

    # Get the file path
    from app.services.illustrations.storage import get_shared_image_path
    from app.config import settings
    from fastapi.responses import FileResponse

    ext = illustration.file_ext or "png"
    image_path = get_shared_image_path(
        settings.storage_path, current_user.id, image_uuid, ext
    )

    if not image_path.exists():
        logger.warning(
            "get_shared_image_thumb: image file not found — path=%s, image_uuid=%s",
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
        "get_shared_image_thumb: serving image — image_uuid=%s, path=%s, media_type=%s",
        image_uuid, image_path, media_type,
    )
    return FileResponse(
        path=str(image_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


from pydantic import BaseModel
from typing import Optional


class SharedImagePatchRequest(BaseModel):
    """Request body for PATCH /shared-images/{image_uuid}."""
    label: Optional[str] = None


@router.patch("/shared-images/{image_uuid}")
async def patch_shared_image(
    image_uuid: UUID,
    body: SharedImagePatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a shared image's label.

    Accepts a JSON body with optional label field. Only provided (non-None)
    fields are applied to the illustration record.
    """
    logger.info(
        "patch_shared_image: entry — image_uuid=%s, user_id=%s, body=%s",
        image_uuid, current_user.id, body.model_dump(exclude_none=True),
    )

    # Fetch the illustration record
    from sqlalchemy import select
    from app.models.illustration import Illustration, PoolType

    query = select(Illustration).where(
        Illustration.image_uuid == image_uuid,
        Illustration.user_id == current_user.id,
        Illustration.pool == PoolType.SHARED,
        Illustration.project_id.is_(None),
    )
    result = await db.execute(query)
    illustration = result.scalar_one_or_none()

    if illustration is None:
        logger.warning(
            "patch_shared_image: not found — image_uuid=%s, user_id=%s",
            image_uuid, current_user.id,
        )
        raise HTTPException(status_code=404, detail="Shared image not found")

    # Apply updates
    updates = body.model_dump(exclude_none=True)
    if not updates:
        logger.warning(
            "patch_shared_image: no fields to update — image_uuid=%s, user_id=%s",
            image_uuid, current_user.id,
        )
        raise HTTPException(status_code=422, detail="No fields provided to update.")

    if "label" in updates:
        illustration.label = updates["label"]
        logger.debug(
            "patch_shared_image: updated label to '%s' for image_uuid=%s",
            updates["label"], image_uuid,
        )

    await db.commit()
    await db.refresh(illustration)

    # Return updated DTO
    service = IllustrationsService(db)
    dto = service._to_dto(illustration)

    logger.info(
        "patch_shared_image: exit — image_uuid=%s, user_id=%s, updated_fields=%s",
        image_uuid, current_user.id, list(updates.keys()),
    )
    return dto
