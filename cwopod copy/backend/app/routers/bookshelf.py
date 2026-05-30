"""Bookshelf router: paginated listing, sort order, batch ordering."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.project import BookProject, ProjectStatus
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


class SortOrderRequest(BaseModel):
    project_ids: list[UUID] = Field(min_length=1, max_length=50)


class BatchOrderRequest(BaseModel):
    project_ids: list[UUID] = Field(min_length=2, max_length=20)
    provider: str
    shipping_address: str = ""
    action: str = "submit"  # "estimate", "submit", or "retry"


@router.get("")
async def list_bookshelf(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=50),
    status: list[str] | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List bookshelf with pagination and optional status filter."""
    logger.info(
        "list_bookshelf: page=%d, per_page=%d, status=%s, user_id=%s",
        page, per_page, status, current_user.id,
    )
    query = select(BookProject).where(BookProject.user_id == current_user.id)

    # Apply status filter
    if status:
        status_enums = []
        for s in status:
            try:
                status_enums.append(ProjectStatus(s))
            except ValueError:
                logger.warning("list_bookshelf: invalid status filter value '%s', skipping", s)
        if status_enums:
            query = query.where(BookProject.status.in_(status_enums))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_count = (await db.execute(count_query)).scalar() or 0

    # Apply ordering and pagination
    query = query.order_by(BookProject.sort_order, BookProject.created_at.desc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    projects = result.scalars().all()

    total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 0

    return {
        "items": [
            {
                "id": str(p.id),
                "title": p.title,
                "author": p.author,
                "status": p.status.value,
                "sort_order": p.sort_order,
                "source_type": p.source_type.value if p.source_type else None,
                "source_url": p.source_url,
                "has_original_text": bool(p.original_text_path),
                "has_interior_pdf": bool(p.interior_pdf_path),
                "has_cover_pdf": bool(p.cover_pdf_path),
            }
            for p in projects
        ],
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.patch("/order")
async def update_sort_order(
    body: SortOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist drag-and-drop sort order."""
    # Validate all IDs belong to user
    for i, pid in enumerate(body.project_ids):
        result = await db.execute(
            select(BookProject.id).where(
                BookProject.id == pid,
                BookProject.user_id == current_user.id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="One or more projects not found")

        # Update sort order
        await db.execute(
            update(BookProject)
            .where(BookProject.id == pid)
            .values(sort_order=i)
        )

    return {"success": True}


@router.post("/batch-order", status_code=201)
async def batch_order(
    body: BatchOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a batch order for multiple books.

    Supports three actions:
    - "estimate": Return pricing estimate without placing an order
    - "submit": Place the order
    - "retry": Retry previously failed orders

    Routes through the OrderService which handles:
    - Lulu: single multi-title order
    - BookVault: individual orders per title (provider limitation)
    - KDP: file packaging for manual upload
    """
    logger.info(
        "batch_order: action=%s, %d books, provider=%s, user_id=%s",
        body.action, len(body.project_ids), body.provider, current_user.id,
    )

    # Multi-title support detection
    MULTI_TITLE_PROVIDERS = {"lulu"}
    is_multi_title = body.provider in MULTI_TITLE_PROVIDERS

    # Validate all projects are print-ready and belong to user
    projects = []
    for pid in body.project_ids:
        result = await db.execute(
            select(BookProject).where(
                BookProject.id == pid,
                BookProject.user_id == current_user.id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project {pid} not found")
        if project.status != ProjectStatus.PRINT_READY:
            raise HTTPException(
                status_code=400,
                detail=f"Project '{project.title}' is not print-ready (status: {project.status.value})",
            )
        projects.append(project)

    # Validate page counts against provider + binding limits
    from app.services.typeset.provider_specs import validate_page_count
    for p in projects:
        binding = p.binding_type or "paperback"
        page_count = p.page_count or 0
        if page_count > 0:
            pc_error = validate_page_count(page_count, body.provider, binding)
            if pc_error:
                logger.warning("batch_order: page count validation failed for '%s': %s", p.title, pc_error["message"])
                raise HTTPException(status_code=422, detail=pc_error["message"])

    # --- ESTIMATE action ---
    if body.action == "estimate":
        logger.info("batch_order: returning pricing estimate")
        # Calculate per-title pricing estimate
        title_pricing = []
        for p in projects:
            page_count = p.page_count or 200
            # Base cost estimate: $0.012/page + $1.80 fixed
            unit_cost = round((page_count * 0.012) + 1.80, 2)
            title_pricing.append({
                "project_id": str(p.id),
                "title": p.title,
                "page_count": page_count,
                "unit_cost": unit_cost,
            })

        subtotal = sum(t["unit_cost"] for t in title_pricing)
        shipping = 3.99 if is_multi_title else 3.99 * len(title_pricing)
        total = round(subtotal + shipping, 2)

        response = {
            "action": "estimate",
            "provider": body.provider,
            "is_multi_title": is_multi_title,
            "title_pricing": title_pricing,
            "subtotal": subtotal,
            "shipping": shipping,
            "total": total,
            "currency": "USD",
        }

        if not is_multi_title:
            response["warning"] = (
                "This provider does not support multi-title shipments. "
                "Each book will be ordered separately and may ship individually."
            )

        return response

    # --- SUBMIT and RETRY actions ---
    if body.action in ("submit", "retry"):
        if not body.shipping_address.strip():
            raise HTTPException(status_code=400, detail="Shipping address is required for order submission")

        from app.services.print_service.order_service import OrderService
        from app.services.print_service.base import ProviderError

        order_service = OrderService(db, current_user.id)

        try:
            order = await order_service.submit_order(
                project_ids=body.project_ids,
                provider=body.provider,
                shipping_address=body.shipping_address,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except ProviderError as e:
            logger.error("batch_order: provider error: %s", e.message)
            raise HTTPException(status_code=502, detail=e.message)

        # Update project statuses
        from app.models.order import OrderStatus as OS
        if order.status == OS.SUBMITTED:
            for pid in body.project_ids:
                await db.execute(
                    update(BookProject)
                    .where(BookProject.id == pid)
                    .values(status=ProjectStatus.ORDERED)
                )
            await db.flush()

        # Determine if individual orders were placed
        individual_orders = not is_multi_title and len(body.project_ids) > 1
        message = None
        if individual_orders:
            message = (
                f"{body.provider.title()} does not support multi-title shipments. "
                f"{len(body.project_ids)} individual orders were placed."
            )

        response = {
            "action": body.action,
            "order_id": str(order.id),
            "provider": body.provider,
            "book_count": len(body.project_ids),
            "status": order.status.value,
            "is_multi_title": is_multi_title,
        }
        if message:
            response["message"] = message

        logger.info("batch_order: result status=%s, order_id=%s", order.status.value, order.id)
        return response

    raise HTTPException(status_code=400, detail=f"Invalid action: {body.action}. Must be 'estimate', 'submit', or 'retry'.")
