"""Typeset router: trigger PDF generation and download interior PDF."""

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.project import BookProject
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class TypesetRequest(BaseModel):
    provider: Literal["lulu", "bookvault", "kdp"] = "lulu"


@router.post("/{project_id}/typeset", status_code=202)
async def start_typeset(
    project_id: UUID,
    body: TypesetRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate interior PDF generation for a project."""
    logger.info("start_typeset called: project_id=%s, user_id=%s, provider=%s", project_id, current_user.id, body.provider)
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("start_typeset: project not found project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.original_text_path and not project.working_text_path:
        logger.warning("start_typeset: no text to typeset project_id=%s", project_id)
        raise HTTPException(status_code=400, detail="Project has no text to typeset")

    from app.services.typeset.pdf_generator import generate_pdf_task

    task = generate_pdf_task.delay(str(project_id), str(current_user.id), body.provider)
    logger.info("start_typeset: task dispatched task_id=%s, project_id=%s", task.id, project_id)

    return {"task_id": task.id, "status": "generating"}


# Stage metadata for progress reporting
TYPESET_STAGES = {
    "detecting_chapters": {"label": "Detecting chapters", "percent": 15},
    "generating_qr_codes": {"label": "Generating QR codes", "percent": 35},
    "rendering_template": {"label": "Rendering template", "percent": 60},
    "compiling_pdf": {"label": "Compiling PDF", "percent": 85},
}


@router.get("/{project_id}/typeset/status/{task_id}")
async def get_typeset_status(
    project_id: UUID,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the progress of a typeset task."""
    logger.debug("get_typeset_status called: project_id=%s, task_id=%s", project_id, task_id)

    # Verify project ownership
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        logger.warning("get_typeset_status: project not found project_id=%s", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    from app.worker import celery_app

    result = celery_app.AsyncResult(task_id)
    state = result.state
    logger.debug("get_typeset_status: task_id=%s, state=%s", task_id, state)

    if state == "PENDING":
        return {"status": "pending", "stage": "queued", "label": "Queued — waiting to start", "percent": 5}
    elif state == "STARTED":
        return {"status": "started", "stage": "starting", "label": "Starting PDF generation", "percent": 10}
    elif state == "PROGRESS":
        meta = result.info or {}
        stage = meta.get("stage", "unknown")
        stage_info = TYPESET_STAGES.get(stage, {"label": stage, "percent": 50})
        return {"status": "progress", "stage": stage, "label": stage_info["label"], "percent": stage_info["percent"]}
    elif state == "SUCCESS":
        task_result = result.result or {}
        if "error" in task_result:
            logger.error("get_typeset_status: task completed with error: %s", task_result["error"])
            return {"status": "failed", "stage": "error", "label": task_result["error"], "percent": 0}
        return {"status": "complete", "stage": "done", "label": "PDF generated successfully", "percent": 100, "result": task_result}
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("get_typeset_status: task failed task_id=%s, error=%s", task_id, error_msg)
        return {"status": "failed", "stage": "error", "label": error_msg, "percent": 0}
    else:
        return {"status": state.lower(), "stage": "unknown", "label": f"Status: {state}", "percent": 50}


@router.get("/{project_id}/interior-pdf")
async def download_interior_pdf(
    project_id: UUID,
    request: Request,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Download the generated interior PDF.

    Supports two auth modes:
    - Session cookie (normal user download)
    - Signed token query param (print provider download)
    """
    from app.middleware.auth import get_optional_user
    from app.utils.encryption import verify_download_token

    project = None

    # Try token-based auth first (for print providers)
    if token:
        result = verify_download_token(token)
        if result is None:
            raise HTTPException(status_code=403, detail="Invalid or expired download token")
        token_project_id, token_file_type = result
        if token_project_id != str(project_id) or token_file_type != "interior":
            raise HTTPException(status_code=403, detail="Token does not match requested file")
        # Token valid — load project without user ownership check
        proj_result = await db.execute(
            select(BookProject).where(BookProject.id == project_id)
        )
        project = proj_result.scalar_one_or_none()
    else:
        # Session-based auth
        user = await get_optional_user(request, db)
        if user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        proj_result = await db.execute(
            select(BookProject).where(
                BookProject.id == project_id,
                BookProject.user_id == user.id,
            )
        )
        project = proj_result.scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.interior_pdf_path:
        raise HTTPException(status_code=404, detail="Interior PDF not yet generated")

    pdf_path = Path(project.interior_pdf_path)
    if not pdf_path.exists():
        raise HTTPException(status_code=500, detail="Interior PDF file not found. Please regenerate.")

    filename = f"{project.title or 'book'}_interior.pdf"
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=filename,
    )
