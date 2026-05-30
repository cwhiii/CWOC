"""Quality controller router: typo scanning, review, and correction application."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.correction import Correction, CorrectionStatus
from app.models.project import BookProject, SourceType
from app.models.user import User
from app.services.quality_controller.applier import CorrectionApplierService

router = APIRouter()


class CorrectionOut(BaseModel):
    id: str
    original_text: str
    suggested_text: str
    context_sentence: str
    position: int
    status: str


class CorrectionStatusUpdate(BaseModel):
    id: str
    status: str  # "accepted" or "rejected"


class CorrectionUpdateRequest(BaseModel):
    corrections: list[CorrectionStatusUpdate] | None = None
    bulk_action: str | None = None  # "accept_all" or "reject_all"


class ApplyResponse(BaseModel):
    applied: int
    skipped: int
    working_text_path: str


@router.post("/{project_id}/scan-typos", status_code=202)
async def start_typo_scan(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a typo scan for the project. Dispatches to Celery."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("start_typo_scan called: project_id=%s, user_id=%s", project_id, current_user.id)

    # Validate project
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("start_typo_scan: project not found project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.original_text_path:
        logger.warning("start_typo_scan: no text to scan project_id=%s", project_id)
        raise HTTPException(status_code=400, detail="Project has no text to scan")

    # Determine skip recommendation
    skip_recommended = project.source_type == SourceType.STANDARD_EBOOKS

    # Dispatch Celery task
    from app.services.quality_controller.tasks import scan_typos_task

    task = scan_typos_task.delay(str(project_id), str(current_user.id))
    logger.info("start_typo_scan: task dispatched task_id=%s, project_id=%s", task.id, project_id)

    return {
        "task_id": task.id,
        "status": "scanning",
        "skip_recommended": skip_recommended,
    }


@router.get("/{project_id}/scan-typos/status/{task_id}")
async def get_typo_scan_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the progress of a typo scan task."""
    import logging
    logger = logging.getLogger(__name__)
    logger.debug("get_typo_scan_status called: project_id=%s, task_id=%s", project_id, task_id)

    # Verify project ownership
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        logger.warning("get_typo_scan_status: project not found project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    from app.worker import celery_app

    result = celery_app.AsyncResult(task_id)
    state = result.state
    logger.debug("get_typo_scan_status: task_id=%s, state=%s", task_id, state)

    if state == "PENDING":
        return {"status": "pending", "label": "Queued — waiting to start", "percent": None, "current_chunk": 0, "total_chunks": 0}
    elif state == "STARTED":
        return {"status": "started", "label": "Starting typo scan", "percent": None, "current_chunk": 0, "total_chunks": 0}
    elif state == "PROGRESS":
        meta = result.info or {}
        current_chunk = meta.get("current_chunk", 0)
        total_chunks = meta.get("total_chunks", 1)
        chapter_title = meta.get("chapter_title", "")
        chapter_number = meta.get("chapter_number", 0)
        tokens_generated = meta.get("tokens_generated", 0)
        inference_active = meta.get("inference_active", False)
        # Percent is based on completed chunks from the task meta
        completed_chunks = meta.get("chunks_completed", 0)
        percent = int((completed_chunks / max(total_chunks, 1)) * 100)
        label = f"Scanning chapter {chapter_number}" + (f": {chapter_title}" if chapter_title else "") + f" ({current_chunk}/{total_chunks})"
        return {
            "status": "progress",
            "label": label,
            "percent": percent,
            "current_chunk": current_chunk,
            "total_chunks": total_chunks,
            "chunks_completed": completed_chunks,
            "corrections_so_far": meta.get("corrections_so_far", 0),
            "recent_corrections": meta.get("recent_corrections", []),
            "tokens_generated": tokens_generated,
            "inference_active": inference_active,
        }
    elif state == "SUCCESS":
        task_result = result.result or {}
        if "error" in task_result:
            logger.error("get_typo_scan_status: task completed with error: %s", task_result["error"])
            return {"status": "failed", "label": task_result["error"], "percent": 0, "current_chunk": 0, "total_chunks": 0}
        return {"status": "complete", "label": "Scan complete", "percent": 100, "result": task_result, "current_chunk": task_result.get("total_chunks", 0), "total_chunks": task_result.get("total_chunks", 0)}
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("get_typo_scan_status: task failed task_id=%s, error=%s", task_id, error_msg)
        return {"status": "failed", "label": error_msg, "percent": 0, "current_chunk": 0, "total_chunks": 0}
    else:
        return {"status": state.lower(), "label": f"Status: {state}", "percent": 50, "current_chunk": 0, "total_chunks": 0}


@router.get("/{project_id}/corrections")
async def list_corrections(
    project_id: UUID,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List corrections for a project, optionally filtered by status."""
    # Verify project ownership
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(Correction).where(Correction.project_id == project_id)
    if status:
        query = query.where(Correction.status == CorrectionStatus(status))
    query = query.order_by(Correction.position)

    result = await db.execute(query)
    corrections = result.scalars().all()

    return [
        CorrectionOut(
            id=str(c.id),
            original_text=c.original_text,
            suggested_text=c.suggested_text,
            context_sentence=c.context_sentence,
            position=c.position,
            status=c.status.value,
        )
        for c in corrections
    ]


@router.patch("/{project_id}/corrections")
async def update_corrections(
    project_id: UUID,
    body: CorrectionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update correction statuses (individual or bulk)."""
    # Verify project ownership
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    updated = 0

    if body.bulk_action:
        if body.bulk_action == "accept_all":
            new_status = CorrectionStatus.ACCEPTED
        elif body.bulk_action == "reject_all":
            new_status = CorrectionStatus.REJECTED
        else:
            raise HTTPException(status_code=400, detail="Invalid bulk_action")

        result = await db.execute(
            update(Correction)
            .where(
                Correction.project_id == project_id,
                Correction.status == CorrectionStatus.PENDING,
            )
            .values(status=new_status)
        )
        updated = result.rowcount

    elif body.corrections:
        for item in body.corrections:
            new_status = CorrectionStatus(item.status)
            result = await db.execute(
                update(Correction)
                .where(
                    Correction.id == UUID(item.id),
                    Correction.project_id == project_id,
                )
                .values(status=new_status)
            )
            updated += result.rowcount

    return {"updated": updated}


@router.post("/{project_id}/corrections/apply")
async def apply_corrections(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply all accepted corrections to the project text."""
    service = CorrectionApplierService(db, current_user.id)

    try:
        result = await service.apply_corrections(project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ApplyResponse(**result)
