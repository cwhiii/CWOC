"""Illustrations service: business logic for image pool management, placement, and storage.

Handles CRUD operations for illustrations across three pools (shared, available, in_book),
file storage, dimension reading, lock cascade, reflow dispatch, and atomic bulk save operations.
"""

import logging
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.illustration import (
    Illustration,
    LayoutType,
    PlacementModeType,
    PoolType,
    SideType,
    SourceTypeIll,
)
from app.services.illustrations.storage import (
    copy_image_to_project,
    get_project_image_path,
    get_shared_image_path,
)

logger = logging.getLogger(__name__)

# Accepted image formats for upload validation
ACCEPTED_FORMATS = {"png", "jpg", "jpeg", "webp"}


class IllustrationsService:
    """Service layer for illustration management.

    Provides methods for querying, uploading, updating, deleting, and
    bulk-saving illustrations. All operations are scoped to a user_id
    for data isolation.
    """

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session for database operations.
        """
        self.db = db
        logger.debug("IllustrationsService.__init__: initialized with db session")

    async def get_all(self, project_id: uuid.UUID, user_id: uuid.UUID) -> list[dict]:
        """Return all illustrations for a project plus the user's shared pool.

        Fetches project-scoped illustrations (available + in_book) and user-scoped
        shared pool images. Returns a list of DTOs suitable for API response.

        Args:
            project_id: The project UUID to fetch illustrations for.
            user_id: The user UUID for ownership scoping and shared pool access.

        Returns:
            List of illustration DTOs as dictionaries.
        """
        logger.info(
            "IllustrationsService.get_all: entry — project_id=%s, user_id=%s",
            project_id,
            user_id,
        )

        # Fetch project illustrations (available + in_book pools)
        project_query = select(Illustration).where(
            Illustration.project_id == project_id,
            Illustration.user_id == user_id,
        )
        project_result = await self.db.execute(project_query)
        project_illustrations = project_result.scalars().all()
        logger.debug(
            "IllustrationsService.get_all: found %d project illustrations for project_id=%s",
            len(project_illustrations),
            project_id,
        )

        # Fetch shared pool illustrations (user-level, no project_id)
        shared_query = select(Illustration).where(
            Illustration.user_id == user_id,
            Illustration.pool == PoolType.SHARED,
            Illustration.project_id.is_(None),
        )
        shared_result = await self.db.execute(shared_query)
        shared_illustrations = shared_result.scalars().all()
        logger.debug(
            "IllustrationsService.get_all: found %d shared illustrations for user_id=%s",
            len(shared_illustrations),
            user_id,
        )

        all_illustrations = list(project_illustrations) + list(shared_illustrations)
        result = [self._to_dto(ill) for ill in all_illustrations]

        logger.info(
            "IllustrationsService.get_all: exit — returning %d total illustrations "
            "(project=%d, shared=%d)",
            len(result),
            len(project_illustrations),
            len(shared_illustrations),
        )
        return result

    async def upload_image(
        self,
        project_id: uuid.UUID | None,
        user_id: uuid.UUID,
        file_content: bytes,
        filename: str,
        pool: str,
    ) -> dict:
        """Validate format, read dimensions, store file, create DB record, return DTO.

        Args:
            project_id: The project UUID (None for shared pool uploads).
            user_id: The user UUID who owns the image.
            file_content: Raw bytes of the uploaded file.
            filename: Original filename for extension extraction.
            pool: Target pool — "shared" or "available".

        Returns:
            Illustration DTO dictionary with assigned UUID and metadata.

        Raises:
            ValueError: If the file format is not accepted or dimensions cannot be read.
        """
        logger.info(
            "IllustrationsService.upload_image: entry — project_id=%s, user_id=%s, "
            "filename=%s, pool=%s, file_size=%d bytes",
            project_id,
            user_id,
            filename,
            pool,
            len(file_content),
        )

        # Validate file format
        ext = self._extract_extension(filename)
        if ext not in ACCEPTED_FORMATS:
            logger.error(
                "IllustrationsService.upload_image: rejected — invalid format '%s' "
                "from filename '%s'. Accepted: %s",
                ext,
                filename,
                ACCEPTED_FORMATS,
            )
            raise ValueError(
                f"Invalid image format '{ext}'. Accepted formats: PNG, JPG, WEBP."
            )

        # Normalize jpeg -> jpg for storage
        file_ext = "jpg" if ext == "jpeg" else ext

        # Read image dimensions
        width_px, height_px = self._read_dimensions(file_content)
        logger.debug(
            "IllustrationsService.upload_image: dimensions read — %dx%d px",
            width_px,
            height_px,
        )

        # Generate UUID for the image
        image_uuid = uuid.uuid4()
        logger.debug(
            "IllustrationsService.upload_image: generated image_uuid=%s", image_uuid
        )

        # Determine storage path and write file
        if pool == PoolType.SHARED.value or pool == "shared":
            storage_dir = (
                Path(settings.storage_path) / "shared" / str(user_id) / "images"
            )
        else:
            storage_dir = (
                Path(settings.storage_path) / str(project_id) / "images"
            )

        storage_dir.mkdir(parents=True, exist_ok=True)
        file_path = storage_dir / f"{image_uuid}.{file_ext}"
        file_path.write_bytes(file_content)
        logger.debug(
            "IllustrationsService.upload_image: file written to %s", file_path
        )

        # Determine pool enum
        pool_enum = PoolType.SHARED if pool == "shared" else PoolType.AVAILABLE

        # Create DB record
        illustration = Illustration(
            project_id=project_id if pool_enum != PoolType.SHARED else None,
            user_id=user_id,
            image_uuid=image_uuid,
            label=self._generate_label(filename),
            pool=pool_enum,
            source=SourceTypeIll.UPLOADED,
            file_ext=file_ext,
            original_width_px=width_px,
            original_height_px=height_px,
            lock_state=False,
            sort_order=0,
        )
        self.db.add(illustration)
        await self.db.flush()
        logger.debug(
            "IllustrationsService.upload_image: DB record created — id=%s, image_uuid=%s",
            illustration.id,
            illustration.image_uuid,
        )

        result = self._to_dto(illustration)
        logger.info(
            "IllustrationsService.upload_image: exit — image_uuid=%s, pool=%s, "
            "dimensions=%dx%d, ext=%s",
            image_uuid,
            pool_enum.value,
            width_px,
            height_px,
            file_ext,
        )
        return result

    async def update_illustration(
        self,
        image_uuid: uuid.UUID,
        user_id: uuid.UUID,
        updates: dict[str, Any],
    ) -> dict | None:
        """Patch placement, label, lock_state, etc. for a single illustration.

        Args:
            image_uuid: The image UUID to update.
            user_id: The user UUID for ownership validation.
            updates: Dictionary of fields to update. Supported keys:
                label, placement_mode, page_number, position_x, position_y,
                height, layout, side, lock_state, sort_order, pool.

        Returns:
            Updated illustration DTO, or None if not found.
        """
        logger.info(
            "IllustrationsService.update_illustration: entry — image_uuid=%s, "
            "user_id=%s, updates=%s",
            image_uuid,
            user_id,
            updates,
        )

        illustration = await self._get_by_image_uuid(image_uuid, user_id)
        if illustration is None:
            logger.error(
                "IllustrationsService.update_illustration: not found — "
                "image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return None

        # Apply updates to allowed fields
        allowed_fields = {
            "label",
            "placement_mode",
            "page_number",
            "position_x",
            "position_y",
            "height",
            "layout",
            "side",
            "lock_state",
            "sort_order",
            "pool",
        }

        applied = {}
        for key, value in updates.items():
            if key not in allowed_fields:
                logger.warning(
                    "IllustrationsService.update_illustration: skipping disallowed "
                    "field '%s' for image_uuid=%s",
                    key,
                    image_uuid,
                )
                continue

            # Convert string enum values to proper enum types
            converted_value = self._convert_enum_value(key, value)
            setattr(illustration, key, converted_value)
            applied[key] = value

        await self.db.flush()
        logger.debug(
            "IllustrationsService.update_illustration: applied fields=%s for image_uuid=%s",
            list(applied.keys()),
            image_uuid,
        )

        result = self._to_dto(illustration)
        logger.info(
            "IllustrationsService.update_illustration: exit — image_uuid=%s, "
            "applied_updates=%s",
            image_uuid,
            applied,
        )
        return result

    async def delete_illustration(
        self, image_uuid: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Remove DB record and file for an illustration.

        Args:
            image_uuid: The image UUID to delete.
            user_id: The user UUID for ownership validation.

        Returns:
            True if deleted successfully, False if not found.
        """
        logger.info(
            "IllustrationsService.delete_illustration: entry — image_uuid=%s, user_id=%s",
            image_uuid,
            user_id,
        )

        illustration = await self._get_by_image_uuid(image_uuid, user_id)
        if illustration is None:
            logger.error(
                "IllustrationsService.delete_illustration: not found — "
                "image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return False

        # Determine file path and remove from disk
        file_path = self._resolve_file_path(illustration)
        if file_path and file_path.exists():
            file_path.unlink()
            logger.debug(
                "IllustrationsService.delete_illustration: file removed — %s",
                file_path,
            )
        else:
            logger.warning(
                "IllustrationsService.delete_illustration: file not found on disk — "
                "expected path=%s, image_uuid=%s",
                file_path,
                image_uuid,
            )

        # Remove DB record
        await self.db.delete(illustration)
        await self.db.flush()
        logger.info(
            "IllustrationsService.delete_illustration: exit — image_uuid=%s deleted "
            "(pool=%s, project_id=%s)",
            image_uuid,
            illustration.pool.value if illustration.pool else None,
            illustration.project_id,
        )
        return True

    async def save_all(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        illustrations: list[dict],
    ) -> list[dict]:
        """Atomic bulk save of all pool/placement state for a project.

        Replaces all project illustrations and user's shared illustrations with
        the provided state. This is an atomic operation — either all changes
        succeed or none do.

        Args:
            project_id: The project UUID.
            user_id: The user UUID for ownership scoping.
            illustrations: List of illustration DTOs to persist.

        Returns:
            List of saved illustration DTOs.
        """
        logger.info(
            "IllustrationsService.save_all: entry — project_id=%s, user_id=%s, "
            "illustration_count=%d",
            project_id,
            user_id,
            len(illustrations),
        )

        # Delete existing project illustrations for this user
        delete_project_query = sa_delete(Illustration).where(
            Illustration.project_id == project_id,
            Illustration.user_id == user_id,
        )
        await self.db.execute(delete_project_query)
        logger.debug(
            "IllustrationsService.save_all: deleted existing project illustrations "
            "for project_id=%s, user_id=%s",
            project_id,
            user_id,
        )

        # Delete existing shared illustrations for this user
        delete_shared_query = sa_delete(Illustration).where(
            Illustration.user_id == user_id,
            Illustration.pool == PoolType.SHARED,
            Illustration.project_id.is_(None),
        )
        await self.db.execute(delete_shared_query)
        logger.debug(
            "IllustrationsService.save_all: deleted existing shared illustrations "
            "for user_id=%s",
            user_id,
        )

        # Insert all provided illustrations
        saved = []
        for idx, ill_data in enumerate(illustrations):
            pool_value = ill_data.get("pool", "available")
            pool_enum = self._parse_pool(pool_value)
            is_shared = pool_enum == PoolType.SHARED

            illustration = Illustration(
                project_id=None if is_shared else project_id,
                user_id=user_id,
                image_uuid=uuid.UUID(ill_data["image_uuid"])
                if isinstance(ill_data.get("image_uuid"), str)
                else ill_data.get("image_uuid", uuid.uuid4()),
                label=ill_data.get("label", f"Image {idx + 1}"),
                pool=pool_enum,
                source=self._parse_source(ill_data.get("source", "uploaded")),
                file_ext=ill_data.get("file_ext", "png"),
                original_width_px=ill_data.get("original_width_px", 0),
                original_height_px=ill_data.get("original_height_px", 0),
                placement_mode=self._parse_placement_mode(
                    ill_data.get("placement_mode")
                ),
                page_number=ill_data.get("page_number"),
                position_x=ill_data.get("position_x"),
                position_y=ill_data.get("position_y"),
                height=ill_data.get("height"),
                layout=self._parse_layout(ill_data.get("layout")),
                side=self._parse_side(ill_data.get("side")),
                lock_state=ill_data.get("lock_state", False),
                sort_order=ill_data.get("sort_order", idx),
            )
            self.db.add(illustration)
            saved.append(illustration)

        await self.db.flush()
        logger.debug(
            "IllustrationsService.save_all: inserted %d illustrations", len(saved)
        )

        result = [self._to_dto(ill) for ill in saved]
        logger.info(
            "IllustrationsService.save_all: exit — saved %d illustrations "
            "(project_id=%s, user_id=%s)",
            len(result),
            project_id,
            user_id,
        )
        return result

    # ─── Lock Cascade and Reflow Dispatch ────────────────────────────────────────

    async def lock_image(
        self, image_uuid: uuid.UUID, user_id: uuid.UUID
    ) -> dict | None:
        """Lock a single image and dispatch a full reflow task.

        Sets lock_state=True for the specified image. If the image was previously
        unlocked (transition from unlocked→locked), dispatches a full reflow
        Celery task to re-typeset the entire book.

        Args:
            image_uuid: The image UUID to lock.
            user_id: The user UUID for ownership validation.

        Returns:
            Dictionary with 'task_id' (str or None) and 'image_uuid', or None if not found.
        """
        logger.info(
            "IllustrationsService.lock_image: entry — image_uuid=%s, user_id=%s",
            image_uuid,
            user_id,
        )

        illustration = await self._get_by_image_uuid(image_uuid, user_id)
        if illustration is None:
            logger.error(
                "IllustrationsService.lock_image: not found — image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return None

        old_state = illustration.lock_state
        new_state = True

        logger.debug(
            "IllustrationsService.lock_image: old_state=%s, new_state=%s, image_uuid=%s",
            old_state,
            new_state,
            image_uuid,
        )

        # Set lock state
        illustration.lock_state = True
        await self.db.flush()
        logger.info(
            "IllustrationsService.lock_image: lock_state set to True for image_uuid=%s",
            image_uuid,
        )

        # Dispatch reflow only on unlocked→locked transition
        task_id = None
        if self.should_trigger_reflow(old_state, new_state):
            task_id = self._dispatch_reflow(
                project_id=illustration.project_id,
                user_id=user_id,
            )
            logger.info(
                "IllustrationsService.lock_image: reflow dispatched — task_id=%s, "
                "project_id=%s, image_uuid=%s",
                task_id,
                illustration.project_id,
                image_uuid,
            )
        else:
            logger.debug(
                "IllustrationsService.lock_image: no reflow needed — image was already "
                "locked, image_uuid=%s",
                image_uuid,
            )

        logger.info(
            "IllustrationsService.lock_image: exit — image_uuid=%s, task_id=%s",
            image_uuid,
            task_id,
        )
        return {"task_id": task_id, "image_uuid": str(image_uuid)}

    async def unlock_image(
        self, image_uuid: uuid.UUID, user_id: uuid.UUID
    ) -> dict | None:
        """Unlock an image and cascade unlock all images on later pages.

        When an image on page N is unlocked, all images on pages > N are also
        unlocked because their page numbers become unreliable after the earlier
        image's position changes.

        Args:
            image_uuid: The image UUID to unlock.
            user_id: The user UUID for ownership validation.

        Returns:
            Dictionary with 'unlocked_count' (int) and 'image_uuid', or None if not found.
        """
        logger.info(
            "IllustrationsService.unlock_image: entry — image_uuid=%s, user_id=%s",
            image_uuid,
            user_id,
        )

        illustration = await self._get_by_image_uuid(image_uuid, user_id)
        if illustration is None:
            logger.error(
                "IllustrationsService.unlock_image: not found — image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return None

        page_n = illustration.page_number
        project_id = illustration.project_id

        logger.debug(
            "IllustrationsService.unlock_image: unlocking image on page_number=%s, "
            "project_id=%s, image_uuid=%s",
            page_n,
            project_id,
            image_uuid,
        )

        # Unlock the target image itself
        illustration.lock_state = False
        unlocked_count = 1

        # Cascade: unlock all locked images on pages > N within the same project
        if page_n is not None and project_id is not None:
            cascade_query = select(Illustration).where(
                Illustration.project_id == project_id,
                Illustration.user_id == user_id,
                Illustration.pool == PoolType.IN_BOOK,
                Illustration.lock_state == True,  # noqa: E712
                Illustration.page_number > page_n,
            )
            cascade_result = await self.db.execute(cascade_query)
            cascade_images = cascade_result.scalars().all()

            for img in cascade_images:
                logger.debug(
                    "IllustrationsService.unlock_image: cascade unlocking image_uuid=%s "
                    "on page_number=%s",
                    img.image_uuid,
                    img.page_number,
                )
                img.lock_state = False
                unlocked_count += 1

            logger.info(
                "IllustrationsService.unlock_image: cascade unlocked %d additional "
                "images on pages > %d, project_id=%s",
                len(cascade_images),
                page_n,
                project_id,
            )
        else:
            logger.debug(
                "IllustrationsService.unlock_image: no cascade — page_number=%s, "
                "project_id=%s",
                page_n,
                project_id,
            )

        await self.db.flush()

        logger.info(
            "IllustrationsService.unlock_image: exit — image_uuid=%s, "
            "unlocked_count=%d (including target)",
            image_uuid,
            unlocked_count,
        )
        return {"unlocked_count": unlocked_count, "image_uuid": str(image_uuid)}

    async def lock_all(
        self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict:
        """Lock all unlocked placed images and dispatch a single reflow.

        Finds all images in the in_book pool that are currently unlocked,
        sets their lock_state to True, and dispatches a single full reflow
        task for the entire book.

        Args:
            project_id: The project UUID.
            user_id: The user UUID for ownership scoping.

        Returns:
            Dictionary with 'task_id' (str or None), 'locked_count' (int).
        """
        logger.info(
            "IllustrationsService.lock_all: ENTRY — project_id=%s, user_id=%s",
            project_id,
            user_id,
        )

        # First, let's see ALL illustrations for this project to understand the state
        all_query = select(Illustration).where(
            Illustration.project_id == project_id,
            Illustration.user_id == user_id,
        )
        all_result = await self.db.execute(all_query)
        all_images = all_result.scalars().all()
        
        logger.info(
            "IllustrationsService.lock_all: TOTAL illustrations for project=%d",
            len(all_images),
        )
        for img in all_images:
            logger.info(
                "IllustrationsService.lock_all: IMAGE — uuid=%s, pool=%s, lock_state=%s, "
                "placement_mode=%s, page_number=%s, label=%s",
                img.image_uuid,
                img.pool.value if img.pool else None,
                img.lock_state,
                img.placement_mode.value if img.placement_mode else None,
                img.page_number,
                img.label[:50] if img.label else None,
            )

        # Find all unlocked in_book images for this project
        query = select(Illustration).where(
            Illustration.project_id == project_id,
            Illustration.user_id == user_id,
            Illustration.pool == PoolType.IN_BOOK,
            Illustration.lock_state == False,  # noqa: E712
        )
        result = await self.db.execute(query)
        unlocked_images = result.scalars().all()
        locked_count = len(unlocked_images)

        logger.info(
            "IllustrationsService.lock_all: found %d unlocked IN_BOOK images, "
            "project_id=%s",
            locked_count,
            project_id,
        )
        
        for img in unlocked_images:
            logger.info(
                "IllustrationsService.lock_all: UNLOCKED IN_BOOK — uuid=%s, "
                "placement_mode=%s, page_number=%s, label=%s",
                img.image_uuid,
                img.placement_mode.value if img.placement_mode else None,
                img.page_number,
                img.label[:50] if img.label else None,
            )

        # Lock all of them
        for img in unlocked_images:
            logger.info(
                "IllustrationsService.lock_all: LOCKING image_uuid=%s, page_number=%s, "
                "old_lock_state=%s",
                img.image_uuid,
                img.page_number,
                img.lock_state,
            )
            img.lock_state = True
            logger.info(
                "IllustrationsService.lock_all: LOCKED image_uuid=%s, new_lock_state=%s",
                img.image_uuid,
                img.lock_state,
            )

        logger.info("IllustrationsService.lock_all: calling db.flush()...")
        await self.db.flush()
        logger.info("IllustrationsService.lock_all: db.flush() complete")

        # Verify the lock state after flush
        for img in unlocked_images:
            logger.info(
                "IllustrationsService.lock_all: POST-FLUSH VERIFY — uuid=%s, lock_state=%s",
                img.image_uuid,
                img.lock_state,
            )

        # Dispatch a single reflow if any images were actually locked
        task_id = None
        if locked_count > 0:
            logger.info(
                "IllustrationsService.lock_all: dispatching reflow for %d locked images",
                locked_count,
            )
            task_id = self._dispatch_reflow(
                project_id=project_id,
                user_id=user_id,
            )
            logger.info(
                "IllustrationsService.lock_all: reflow dispatched — task_id=%s, "
                "locked_count=%d, project_id=%s",
                task_id,
                locked_count,
                project_id,
            )
        else:
            logger.info(
                "IllustrationsService.lock_all: NO REFLOW NEEDED — no images were "
                "unlocked in IN_BOOK pool, project_id=%s",
                project_id,
            )

        logger.info(
            "IllustrationsService.lock_all: EXIT — project_id=%s, locked_count=%d, "
            "task_id=%s",
            project_id,
            locked_count,
            task_id,
        )
        return {"task_id": task_id, "locked_count": locked_count}

    @staticmethod
    def should_trigger_reflow(old_state: bool, new_state: bool) -> bool:
        """Determine if a reflow should be triggered based on lock state transition.

        A full reflow is only triggered when an image transitions from unlocked
        (False) to locked (True). Re-locking an already-locked image, unlocking,
        or any other state change does NOT trigger a reflow.

        Args:
            old_state: The previous lock_state value.
            new_state: The new lock_state value.

        Returns:
            True only when transitioning from unlocked (False) to locked (True).
        """
        should_reflow = (not old_state) and bool(new_state)
        logger.debug(
            "IllustrationsService.should_trigger_reflow: old_state=%s, new_state=%s, "
            "result=%s",
            old_state,
            new_state,
            should_reflow,
        )
        return should_reflow

    def _dispatch_reflow(
        self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> str:
        """Dispatch a full reflow Celery task for the given project.

        Imports and calls the illustrations full_reflow task asynchronously
        via Celery's .delay() method.

        Args:
            project_id: The project UUID to reflow.
            user_id: The user UUID who triggered the reflow.

        Returns:
            The Celery task_id string.
        """
        logger.info(
            "IllustrationsService._dispatch_reflow: entry — project_id=%s, user_id=%s",
            project_id,
            user_id,
        )

        from app.services.illustrations.tasks import full_reflow_task

        result = full_reflow_task.delay(str(project_id), str(user_id))
        task_id = result.id

        logger.info(
            "IllustrationsService._dispatch_reflow: exit — task_id=%s, project_id=%s",
            task_id,
            project_id,
        )
        return task_id

    # ─── Typeset Gate Validation ────────────────────────────────────────────────

    async def validate_typeset_gate(
        self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict:
        """Validate whether the project can proceed to the Typeset step.

        The typeset gate blocks navigation if any image in the in_book pool
        is non-compliant. An image is non-compliant if it lacks a configured
        placement (placement_mode is None) OR is not locked (lock_state is False).

        If the in_book pool is empty (no images placed), the gate allows
        navigation without restriction.

        Args:
            project_id: The project UUID to validate.
            user_id: The user UUID for ownership scoping.

        Returns:
            Dictionary with:
                - allowed (bool): True if typeset step is accessible.
                - blocking_count (int): Number of non-compliant images blocking the gate.
        """
        logger.info(
            "IllustrationsService.validate_typeset_gate: entry — project_id=%s, user_id=%s",
            project_id,
            user_id,
        )

        # Fetch all in_book images for this project and user
        query = select(Illustration).where(
            Illustration.project_id == project_id,
            Illustration.user_id == user_id,
            Illustration.pool == PoolType.IN_BOOK,
        )
        result = await self.db.execute(query)
        in_book_images = result.scalars().all()

        total_in_book = len(in_book_images)
        logger.debug(
            "IllustrationsService.validate_typeset_gate: found %d in_book images "
            "for project_id=%s, user_id=%s",
            total_in_book,
            project_id,
            user_id,
        )

        # If in_book pool is empty, gate allows navigation
        if total_in_book == 0:
            logger.info(
                "IllustrationsService.validate_typeset_gate: exit — in_book pool is empty, "
                "gate ALLOWED. project_id=%s, user_id=%s, allowed=True, blocking_count=0",
                project_id,
                user_id,
            )
            return {"allowed": True, "blocking_count": 0}

        # Count non-compliant images: lacks placement_mode OR not locked
        blocking_count = 0
        for img in in_book_images:
            has_placement = img.placement_mode is not None
            is_locked = img.lock_state is True

            if not has_placement or not is_locked:
                blocking_count += 1
                logger.debug(
                    "IllustrationsService.validate_typeset_gate: non-compliant image — "
                    "image_uuid=%s, placement_mode=%s, lock_state=%s",
                    img.image_uuid,
                    img.placement_mode.value if img.placement_mode else None,
                    img.lock_state,
                )

        allowed = blocking_count == 0

        logger.info(
            "IllustrationsService.validate_typeset_gate: exit — project_id=%s, "
            "user_id=%s, total_in_book=%d, blocking_count=%d, allowed=%s",
            project_id,
            user_id,
            total_in_book,
            blocking_count,
            allowed,
        )
        return {"allowed": allowed, "blocking_count": blocking_count}

    # ─── Pool Management ────────────────────────────────────────────────────────

    async def copy_to_available(
        self,
        image_uuid: uuid.UUID,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict | None:
        """Copy a shared image to a project's available pool.

        Creates a new DB row with a new image_uuid and copies the file from
        the shared storage location to the project's images directory.

        Args:
            image_uuid: The image_uuid of the shared image to copy.
            project_id: The target project UUID.
            user_id: The user UUID for ownership validation.

        Returns:
            New illustration DTO for the copied image, or None if source not found.
        """
        logger.info(
            "IllustrationsService.copy_to_available: entry — image_uuid=%s, "
            "project_id=%s, user_id=%s",
            image_uuid,
            project_id,
            user_id,
        )

        # Fetch the shared image
        source = await self._get_by_image_uuid(image_uuid, user_id)
        if source is None:
            logger.error(
                "IllustrationsService.copy_to_available: source image not found — "
                "image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return None

        if source.pool != PoolType.SHARED:
            logger.error(
                "IllustrationsService.copy_to_available: source image is not in shared pool — "
                "image_uuid=%s, pool=%s",
                image_uuid,
                source.pool.value,
            )
            return None

        before_pool = source.pool.value
        logger.debug(
            "IllustrationsService.copy_to_available: pool transition — "
            "before=%s, after=available (copy, original remains in shared)",
            before_pool,
        )

        # Generate a new UUID for the project copy
        new_image_uuid = uuid.uuid4()
        logger.debug(
            "IllustrationsService.copy_to_available: generated new image_uuid=%s for copy",
            new_image_uuid,
        )

        # Copy the file from shared to project storage
        shared_path = get_shared_image_path(
            settings.storage_path, user_id, source.image_uuid, source.file_ext
        )
        project_path = get_project_image_path(
            settings.storage_path, project_id, new_image_uuid, source.file_ext
        )
        copy_image_to_project(shared_path, project_path)

        # Create new DB record in the available pool
        new_illustration = Illustration(
            project_id=project_id,
            user_id=user_id,
            image_uuid=new_image_uuid,
            label=source.label,
            pool=PoolType.AVAILABLE,
            source=SourceTypeIll.UPLOADED,
            file_ext=source.file_ext,
            original_width_px=source.original_width_px,
            original_height_px=source.original_height_px,
            lock_state=False,
            sort_order=0,
        )
        self.db.add(new_illustration)
        await self.db.flush()

        result = self._to_dto(new_illustration)
        logger.info(
            "IllustrationsService.copy_to_available: exit — copied shared image_uuid=%s "
            "to new image_uuid=%s in project=%s available pool. "
            "Pool transition: shared (copy) -> available",
            image_uuid,
            new_image_uuid,
            project_id,
        )
        return result

    async def move_to_in_book(
        self,
        image_uuid: uuid.UUID,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict | None:
        """Transition an image from the available pool to the in_book pool.

        Updates the pool field from 'available' to 'in_book'. The image remains
        in the same project and retains its file on disk.

        Args:
            image_uuid: The image_uuid to transition.
            project_id: The project UUID for validation.
            user_id: The user UUID for ownership validation.

        Returns:
            Updated illustration DTO, or None if not found or not in available pool.
        """
        logger.info(
            "IllustrationsService.move_to_in_book: entry — image_uuid=%s, "
            "project_id=%s, user_id=%s",
            image_uuid,
            project_id,
            user_id,
        )

        illustration = await self._get_by_image_uuid(image_uuid, user_id)
        if illustration is None:
            logger.error(
                "IllustrationsService.move_to_in_book: image not found — "
                "image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return None

        if illustration.pool != PoolType.AVAILABLE:
            logger.error(
                "IllustrationsService.move_to_in_book: image not in available pool — "
                "image_uuid=%s, current_pool=%s",
                image_uuid,
                illustration.pool.value,
            )
            return None

        if illustration.project_id != project_id:
            logger.error(
                "IllustrationsService.move_to_in_book: project_id mismatch — "
                "image_uuid=%s, expected=%s, actual=%s",
                image_uuid,
                project_id,
                illustration.project_id,
            )
            return None

        before_pool = illustration.pool.value
        illustration.pool = PoolType.IN_BOOK
        after_pool = illustration.pool.value
        await self.db.flush()

        result = self._to_dto(illustration)
        logger.info(
            "IllustrationsService.move_to_in_book: exit — image_uuid=%s transitioned. "
            "Pool transition: %s -> %s",
            image_uuid,
            before_pool,
            after_pool,
        )
        return result

    async def return_to_available(
        self,
        image_uuid: uuid.UUID,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict | None:
        """Move an image from the in_book pool back to available, clearing placement.

        Resets all placement-related fields (placement_mode, page_number, position_x,
        position_y, height, layout, side, lock_state) and transitions the pool back
        to 'available'.

        Args:
            image_uuid: The image_uuid to return.
            project_id: The project UUID for validation.
            user_id: The user UUID for ownership validation.

        Returns:
            Updated illustration DTO, or None if not found or not in in_book pool.
        """
        logger.info(
            "IllustrationsService.return_to_available: entry — image_uuid=%s, "
            "project_id=%s, user_id=%s",
            image_uuid,
            project_id,
            user_id,
        )

        illustration = await self._get_by_image_uuid(image_uuid, user_id)
        if illustration is None:
            logger.error(
                "IllustrationsService.return_to_available: image not found — "
                "image_uuid=%s, user_id=%s",
                image_uuid,
                user_id,
            )
            return None

        if illustration.pool != PoolType.IN_BOOK:
            logger.error(
                "IllustrationsService.return_to_available: image not in in_book pool — "
                "image_uuid=%s, current_pool=%s",
                image_uuid,
                illustration.pool.value,
            )
            return None

        if illustration.project_id != project_id:
            logger.error(
                "IllustrationsService.return_to_available: project_id mismatch — "
                "image_uuid=%s, expected=%s, actual=%s",
                image_uuid,
                project_id,
                illustration.project_id,
            )
            return None

        before_pool = illustration.pool.value
        before_placement = {
            "placement_mode": illustration.placement_mode.value if illustration.placement_mode else None,
            "page_number": illustration.page_number,
            "position_x": illustration.position_x,
            "position_y": illustration.position_y,
            "height": illustration.height,
            "layout": illustration.layout.value if illustration.layout else None,
            "side": illustration.side.value if illustration.side else None,
            "lock_state": illustration.lock_state,
        }

        # Clear all placement fields
        illustration.pool = PoolType.AVAILABLE
        illustration.placement_mode = None
        illustration.page_number = None
        illustration.position_x = None
        illustration.position_y = None
        illustration.height = None
        illustration.layout = None
        illustration.side = None
        illustration.lock_state = False

        after_pool = illustration.pool.value
        await self.db.flush()

        result = self._to_dto(illustration)
        logger.info(
            "IllustrationsService.return_to_available: exit — image_uuid=%s transitioned. "
            "Pool transition: %s -> %s. Cleared placement: %s",
            image_uuid,
            before_pool,
            after_pool,
            before_placement,
        )
        return result

    async def auto_populate_available(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> list[dict]:
        """Scan project's images/ directory for extracted images not yet in DB.

        Looks at all image files in {storage_path}/{project_id}/images/ and creates
        DB records for any that are not already tracked. This handles images that
        were extracted during source import (EPUB/upload) before the illustrations
        feature existed.

        Args:
            project_id: The project UUID to scan.
            user_id: The user UUID who owns the project.

        Returns:
            List of newly created illustration DTOs.
        """
        logger.info(
            "IllustrationsService.auto_populate_available: entry — project_id=%s, user_id=%s",
            project_id,
            user_id,
        )

        images_dir = Path(settings.storage_path) / str(project_id) / "images"
        if not images_dir.exists():
            logger.info(
                "IllustrationsService.auto_populate_available: images directory does not exist — "
                "path=%s, returning empty list",
                images_dir,
            )
            return []

        # Get all image files in the directory
        image_extensions = {".png", ".jpg", ".jpeg", ".webp"}
        disk_files = [
            f for f in images_dir.iterdir()
            if f.is_file() and f.suffix.lower() in image_extensions
        ]
        logger.debug(
            "IllustrationsService.auto_populate_available: found %d image files on disk in %s",
            len(disk_files),
            images_dir,
        )

        if not disk_files:
            logger.info(
                "IllustrationsService.auto_populate_available: no image files found, "
                "returning empty list",
            )
            return []

        # Get all existing image_uuids and filenames for this project
        existing_query = select(Illustration).where(
            Illustration.project_id == project_id,
            Illustration.user_id == user_id,
        )
        existing_result = await self.db.execute(existing_query)
        existing_illustrations = existing_result.scalars().all()

        # Build a set of known image_uuids (as strings) for quick lookup
        known_uuids = {str(ill.image_uuid) for ill in existing_illustrations}
        logger.debug(
            "IllustrationsService.auto_populate_available: %d existing illustrations "
            "in DB for project_id=%s",
            len(known_uuids),
            project_id,
        )

        # For each file on disk, check if its stem (filename without extension)
        # matches a known image_uuid. If not, it's an extracted image that needs
        # a new record.
        new_illustrations = []
        for file_path in disk_files:
            file_stem = file_path.stem
            file_ext = file_path.suffix.lstrip(".").lower()

            # Check if this file is already tracked by UUID
            if file_stem in known_uuids:
                logger.debug(
                    "IllustrationsService.auto_populate_available: skipping already-tracked "
                    "file=%s (matches known uuid)",
                    file_path.name,
                )
                continue

            # This is an untracked file — likely extracted during import.
            # Read its dimensions and create a record.
            try:
                file_content = file_path.read_bytes()
                width_px, height_px = self._read_dimensions(file_content)
            except (ValueError, OSError) as e:
                logger.warning(
                    "IllustrationsService.auto_populate_available: could not read "
                    "dimensions for file=%s, error=%s — skipping",
                    file_path.name,
                    str(e),
                )
                continue

            # Generate a new UUID for this extracted image and rename the file
            new_image_uuid = uuid.uuid4()
            normalized_ext = "jpg" if file_ext == "jpeg" else file_ext
            new_file_path = images_dir / f"{new_image_uuid}.{normalized_ext}"

            # Rename the file to use UUID-based naming
            file_path.rename(new_file_path)
            logger.debug(
                "IllustrationsService.auto_populate_available: renamed %s -> %s",
                file_path.name,
                new_file_path.name,
            )

            # Generate a human-readable label from the original filename
            label = self._generate_label(file_path.name)

            illustration = Illustration(
                project_id=project_id,
                user_id=user_id,
                image_uuid=new_image_uuid,
                label=label,
                pool=PoolType.AVAILABLE,
                source=SourceTypeIll.EXTRACTED,
                file_ext=normalized_ext,
                original_width_px=width_px,
                original_height_px=height_px,
                lock_state=False,
                sort_order=len(new_illustrations),
            )
            self.db.add(illustration)
            new_illustrations.append(illustration)

        await self.db.flush()

        result = [self._to_dto(ill) for ill in new_illustrations]
        logger.info(
            "IllustrationsService.auto_populate_available: exit — created %d new "
            "illustration records for project_id=%s (scanned %d files, "
            "%d already tracked)",
            len(result),
            project_id,
            len(disk_files),
            len(known_uuids),
        )
        return result

    # ─── Private Helpers ─────────────────────────────────────────────────────────

    async def _get_by_image_uuid(
        self, image_uuid: uuid.UUID, user_id: uuid.UUID
    ) -> Illustration | None:
        """Fetch a single illustration by image_uuid scoped to user.

        Args:
            image_uuid: The image UUID to look up.
            user_id: The user UUID for ownership validation.

        Returns:
            Illustration instance or None if not found.
        """
        logger.debug(
            "IllustrationsService._get_by_image_uuid: image_uuid=%s, user_id=%s",
            image_uuid,
            user_id,
        )
        query = select(Illustration).where(
            Illustration.image_uuid == image_uuid,
            Illustration.user_id == user_id,
        )
        result = await self.db.execute(query)
        illustration = result.scalar_one_or_none()
        logger.debug(
            "IllustrationsService._get_by_image_uuid: found=%s",
            illustration is not None,
        )
        return illustration

    def _resolve_file_path(self, illustration: Illustration) -> Path | None:
        """Resolve the filesystem path for an illustration's image file.

        Args:
            illustration: The illustration model instance.

        Returns:
            Path to the image file, or None if path cannot be determined.
        """
        if illustration.pool == PoolType.SHARED or illustration.project_id is None:
            path = (
                Path(settings.storage_path)
                / "shared"
                / str(illustration.user_id)
                / "images"
                / f"{illustration.image_uuid}.{illustration.file_ext}"
            )
        else:
            path = (
                Path(settings.storage_path)
                / str(illustration.project_id)
                / "images"
                / f"{illustration.image_uuid}.{illustration.file_ext}"
            )
        logger.debug(
            "IllustrationsService._resolve_file_path: image_uuid=%s, path=%s",
            illustration.image_uuid,
            path,
        )
        return path

    @staticmethod
    def _extract_extension(filename: str) -> str:
        """Extract and normalize the file extension from a filename.

        Args:
            filename: Original filename string.

        Returns:
            Lowercase extension without the dot.
        """
        ext = Path(filename).suffix.lstrip(".").lower()
        logger.debug(
            "IllustrationsService._extract_extension: filename=%s, ext=%s",
            filename,
            ext,
        )
        return ext

    @staticmethod
    def _generate_label(filename: str) -> str:
        """Generate a user-facing label from the original filename.

        Strips the extension and replaces underscores/hyphens with spaces.

        Args:
            filename: Original filename string.

        Returns:
            Human-readable label string.
        """
        stem = Path(filename).stem
        label = stem.replace("_", " ").replace("-", " ")
        logger.debug(
            "IllustrationsService._generate_label: filename=%s, label=%s",
            filename,
            label,
        )
        return label

    @staticmethod
    def _read_dimensions(file_content: bytes) -> tuple[int, int]:
        """Read image width and height from file bytes.

        Uses minimal header parsing to avoid heavy dependencies.
        Supports PNG, JPEG, and WEBP formats.

        Args:
            file_content: Raw image bytes.

        Returns:
            Tuple of (width, height) in pixels.

        Raises:
            ValueError: If dimensions cannot be determined.
        """
        import struct

        logger.debug(
            "IllustrationsService._read_dimensions: parsing %d bytes", len(file_content)
        )

        # PNG: bytes 16-23 contain width and height as 4-byte big-endian ints
        if file_content[:8] == b"\x89PNG\r\n\x1a\n":
            if len(file_content) < 24:
                raise ValueError("PNG file too short to read dimensions")
            width = struct.unpack(">I", file_content[16:20])[0]
            height = struct.unpack(">I", file_content[20:24])[0]
            logger.debug(
                "IllustrationsService._read_dimensions: PNG detected — %dx%d",
                width,
                height,
            )
            return width, height

        # JPEG: scan for SOF0/SOF2 markers
        if file_content[:2] == b"\xff\xd8":
            offset = 2
            while offset < len(file_content) - 9:
                if file_content[offset] != 0xFF:
                    offset += 1
                    continue
                marker = file_content[offset + 1]
                # SOF0 (0xC0) or SOF2 (0xC2) — baseline or progressive
                if marker in (0xC0, 0xC2):
                    height = struct.unpack(">H", file_content[offset + 5 : offset + 7])[0]
                    width = struct.unpack(">H", file_content[offset + 7 : offset + 9])[0]
                    logger.debug(
                        "IllustrationsService._read_dimensions: JPEG detected — %dx%d",
                        width,
                        height,
                    )
                    return width, height
                # Skip to next marker
                if marker == 0xD9:  # EOI
                    break
                if marker in (0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0x01):
                    offset += 2
                    continue
                segment_length = struct.unpack(
                    ">H", file_content[offset + 2 : offset + 4]
                )[0]
                offset += 2 + segment_length
            raise ValueError("Could not find JPEG SOF marker to read dimensions")

        # WEBP: RIFF header, then VP8/VP8L/VP8X chunk
        if file_content[:4] == b"RIFF" and file_content[8:12] == b"WEBP":
            chunk_type = file_content[12:16]
            if chunk_type == b"VP8 ":
                # Lossy VP8: width/height at bytes 26-29
                if len(file_content) < 30:
                    raise ValueError("WEBP VP8 file too short to read dimensions")
                width = struct.unpack("<H", file_content[26:28])[0] & 0x3FFF
                height = struct.unpack("<H", file_content[28:30])[0] & 0x3FFF
                logger.debug(
                    "IllustrationsService._read_dimensions: WEBP VP8 detected — %dx%d",
                    width,
                    height,
                )
                return width, height
            elif chunk_type == b"VP8L":
                # Lossless VP8L: width/height encoded in first 4 bytes of data
                if len(file_content) < 25:
                    raise ValueError("WEBP VP8L file too short to read dimensions")
                # Skip signature byte (0x2F)
                bits = struct.unpack("<I", file_content[21:25])[0]
                width = (bits & 0x3FFF) + 1
                height = ((bits >> 14) & 0x3FFF) + 1
                logger.debug(
                    "IllustrationsService._read_dimensions: WEBP VP8L detected — %dx%d",
                    width,
                    height,
                )
                return width, height
            elif chunk_type == b"VP8X":
                # Extended VP8X: canvas size at bytes 24-29
                if len(file_content) < 30:
                    raise ValueError("WEBP VP8X file too short to read dimensions")
                width = (
                    struct.unpack("<I", file_content[24:27] + b"\x00")[0] & 0xFFFFFF
                ) + 1
                height = (
                    struct.unpack("<I", file_content[27:30] + b"\x00")[0] & 0xFFFFFF
                ) + 1
                logger.debug(
                    "IllustrationsService._read_dimensions: WEBP VP8X detected — %dx%d",
                    width,
                    height,
                )
                return width, height

        logger.error(
            "IllustrationsService._read_dimensions: could not determine format "
            "from header bytes: %s",
            file_content[:16].hex(),
        )
        raise ValueError("Could not read image dimensions — unsupported format")

    @staticmethod
    def _to_dto(illustration: Illustration) -> dict:
        """Convert an Illustration model instance to a DTO dictionary.

        Args:
            illustration: The Illustration model instance.

        Returns:
            Dictionary suitable for JSON serialization.
        """
        placement = None
        if illustration.placement_mode is not None:
            placement = {
                "mode": illustration.placement_mode.value
                if hasattr(illustration.placement_mode, "value")
                else illustration.placement_mode,
                "page_number": illustration.page_number,
                "position_x": illustration.position_x,
                "position_y": illustration.position_y,
                "height": illustration.height,
                "layout": illustration.layout.value
                if illustration.layout and hasattr(illustration.layout, "value")
                else illustration.layout,
                "side": illustration.side.value
                if illustration.side and hasattr(illustration.side, "value")
                else illustration.side,
            }

        return {
            "image_uuid": str(illustration.image_uuid),
            "label": illustration.label,
            "pool": illustration.pool.value
            if hasattr(illustration.pool, "value")
            else illustration.pool,
            "source": illustration.source.value
            if hasattr(illustration.source, "value")
            else illustration.source,
            "placement": placement,
            "lock_state": illustration.lock_state,
            "resolution_warning": False,  # Computed by DPI calculator (task 2.4)
            "file_ext": illustration.file_ext,
            "original_width_px": illustration.original_width_px,
            "original_height_px": illustration.original_height_px,
        }

    @staticmethod
    def _convert_enum_value(field: str, value: Any) -> Any:
        """Convert string values to proper enum types for enum fields.

        Args:
            field: The field name being updated.
            value: The raw value to convert.

        Returns:
            Converted enum value or the original value for non-enum fields.
        """
        if value is None:
            return None

        enum_map = {
            "pool": PoolType,
            "placement_mode": PlacementModeType,
            "layout": LayoutType,
            "side": SideType,
        }

        if field in enum_map and isinstance(value, str):
            enum_class = enum_map[field]
            converted = enum_class(value)
            logger.debug(
                "IllustrationsService._convert_enum_value: field=%s, "
                "value=%s -> %s",
                field,
                value,
                converted,
            )
            return converted

        return value

    @staticmethod
    def _parse_pool(value: str | None) -> PoolType:
        """Parse a pool string value to PoolType enum."""
        if value is None:
            return PoolType.AVAILABLE
        if isinstance(value, PoolType):
            return value
        return PoolType(value)

    @staticmethod
    def _parse_source(value: str | None) -> SourceTypeIll:
        """Parse a source string value to SourceTypeIll enum."""
        if value is None:
            return SourceTypeIll.UPLOADED
        if isinstance(value, SourceTypeIll):
            return value
        return SourceTypeIll(value)

    @staticmethod
    def _parse_placement_mode(value: str | None) -> PlacementModeType | None:
        """Parse a placement_mode string value to PlacementModeType enum."""
        if value is None:
            return None
        if isinstance(value, PlacementModeType):
            return value
        return PlacementModeType(value)

    @staticmethod
    def _parse_layout(value: str | None) -> LayoutType | None:
        """Parse a layout string value to LayoutType enum."""
        if value is None:
            return None
        if isinstance(value, LayoutType):
            return value
        return LayoutType(value)

    @staticmethod
    def _parse_side(value: str | None) -> SideType | None:
        """Parse a side string value to SideType enum."""
        if value is None:
            return None
        if isinstance(value, SideType):
            return value
        return SideType(value)
