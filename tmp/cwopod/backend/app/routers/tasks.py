"""Tasks router: generic task status polling endpoint.

Provides GET /api/tasks/{task_id}/status for polling the progress of any
Celery background task (reflow, typeset, cover generation, etc.).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/tasks/{task_id}/status")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the progress of any Celery background task by task_id.

    Returns the current status, stage, label, and percent complete.
    Works for any task type: illustration reflow, typeset, cover generation, etc.

    Args:
        task_id: The Celery task ID returned when the task was dispatched.
        current_user: Authenticated user (ensures only logged-in users can poll).
        db: Database session (unused but available for future ownership checks).

    Returns:
        TaskStatusResponse with status, stage, label, percent, and optionally result.
    """
    logger.info(
        "get_task_status: entry — task_id=%s, user_id=%s",
        task_id,
        current_user.id,
    )

    from app.worker import celery_app

    async_result = celery_app.AsyncResult(task_id)
    state = async_result.state
    logger.debug(
        "get_task_status: task_id=%s, celery_state=%s",
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
            "label": "Starting task...",
            "percent": 10,
        }
    elif state == "PROGRESS":
        meta = async_result.info or {}
        response = {
            "status": "progress",
            "stage": meta.get("stage", "unknown"),
            "label": meta.get("label", "Processing..."),
            "percent": meta.get("percent", 50),
        }
    elif state == "SUCCESS":
        task_result = async_result.result or {}
        if isinstance(task_result, dict) and "error" in task_result:
            logger.error(
                "get_task_status: task completed with error — task_id=%s, error=%s",
                task_id,
                task_result["error"],
            )
            response = {
                "status": "failed",
                "stage": "error",
                "label": task_result["error"],
                "percent": 0,
            }
        else:
            response = {
                "status": "complete",
                "stage": "done",
                "label": "Task completed successfully",
                "percent": 100,
                "result": task_result,
            }
    elif state == "FAILURE":
        error_msg = str(async_result.info) if async_result.info else "Unknown error"
        logger.error(
            "get_task_status: task failed — task_id=%s, error=%s",
            task_id,
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
            "get_task_status: unexpected celery state — task_id=%s, state=%s",
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
        "get_task_status: exit — task_id=%s, status=%s, stage=%s, percent=%s",
        task_id,
        response["status"],
        response["stage"],
        response["percent"],
    )
    return response
