"""File storage utilities for illustrations.

Handles path construction, directory creation, and file copy operations
for project-level and shared-pool images. All paths follow the layout:

    {storage_path}/{project_id}/images/{uuid}.{ext}       — project images
    {storage_path}/shared/{user_id}/images/{uuid}.{ext}   — shared pool images

All file operations are logged with full paths for traceability.
"""

import logging
import shutil
from pathlib import Path
from uuid import UUID

logger = logging.getLogger(__name__)


def get_project_image_path(
    storage_path: str | Path,
    project_id: str | UUID,
    image_uuid: str | UUID,
    ext: str,
) -> Path:
    """Construct the full file path for a project-level image.

    Args:
        storage_path: Root storage directory.
        project_id: The project's unique identifier.
        image_uuid: The image's UUID.
        ext: File extension (e.g. 'png', 'jpg', 'webp').

    Returns:
        Path: {storage_path}/{project_id}/images/{uuid}.{ext}
    """
    logger.debug(
        "get_project_image_path: storage_path=%s, project_id=%s, image_uuid=%s, ext=%s",
        storage_path, project_id, image_uuid, ext,
    )
    # Strip leading dot from extension if present
    ext = ext.lstrip(".")
    result = Path(storage_path) / str(project_id) / "images" / f"{image_uuid}.{ext}"
    logger.debug("get_project_image_path: result=%s", result)
    return result


def get_shared_image_path(
    storage_path: str | Path,
    user_id: str | UUID,
    image_uuid: str | UUID,
    ext: str,
) -> Path:
    """Construct the full file path for a shared-pool image.

    Args:
        storage_path: Root storage directory.
        user_id: The user's unique identifier.
        image_uuid: The image's UUID.
        ext: File extension (e.g. 'png', 'jpg', 'webp').

    Returns:
        Path: {storage_path}/shared/{user_id}/images/{uuid}.{ext}
    """
    logger.debug(
        "get_shared_image_path: storage_path=%s, user_id=%s, image_uuid=%s, ext=%s",
        storage_path, user_id, image_uuid, ext,
    )
    # Strip leading dot from extension if present
    ext = ext.lstrip(".")
    result = Path(storage_path) / "shared" / str(user_id) / "images" / f"{image_uuid}.{ext}"
    logger.debug("get_shared_image_path: result=%s", result)
    return result


def ensure_image_directory(path: Path) -> None:
    """Create the parent directory for an image path if it does not exist.

    Args:
        path: The full file path whose parent directory should be ensured.
    """
    directory = path.parent
    logger.debug("ensure_image_directory: ensuring directory exists: %s", directory)
    directory.mkdir(parents=True, exist_ok=True)
    logger.debug("ensure_image_directory: directory ready: %s", directory)


def copy_image_to_project(shared_path: Path, project_path: Path) -> None:
    """Copy an image file from the shared pool to a project's image directory.

    Used when transitioning an image from the Shared pool to a project's
    Available pool. The destination directory is created if it does not exist.

    Args:
        shared_path: Source file path in the shared pool.
        project_path: Destination file path in the project's images directory.

    Raises:
        FileNotFoundError: If the source file does not exist.
        OSError: If the copy operation fails.
    """
    logger.info(
        "copy_image_to_project: copying shared_path=%s -> project_path=%s",
        shared_path, project_path,
    )

    if not shared_path.exists():
        logger.error("copy_image_to_project: source file not found: %s", shared_path)
        raise FileNotFoundError(f"Source image not found: {shared_path}")

    ensure_image_directory(project_path)
    shutil.copy2(str(shared_path), str(project_path))

    logger.info(
        "copy_image_to_project: copy complete, destination exists=%s, size=%d bytes",
        project_path.exists(), project_path.stat().st_size if project_path.exists() else 0,
    )
