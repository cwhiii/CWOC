"""Print orders router: pricing, order submission, order listing, credentials."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.order import OrderItem, OrderStatus, PrintOrder
from app.models.project import BookProject
from app.models.user import User
from app.services.print_service.base import ProviderError
from app.services.print_service.credential_service import CredentialService
from app.services.print_service.isbn import ISBNManager
from app.services.print_service.order_service import OrderService
from app.services.print_service.address_utils import normalize_state_code

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Schemas ---


class ShippingAddress(BaseModel):
    name: str = ""
    street1: str = ""
    street2: str | None = None
    city: str = ""
    state: str | None = None
    postal_code: str = ""
    country: str = "US"
    phone_number: str | None = None


class PricingRequest(BaseModel):
    project_id: UUID
    provider: str
    shipping_address: ShippingAddress

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v


class OrderCreateRequest(BaseModel):
    project_ids: list[UUID]
    provider: str
    shipping_address: str
    isbn_option: str | None = None  # "lulu_free", "user_provided", or None
    user_isbn: str | None = None
    quantity: int = 1

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v


class CredentialStoreRequest(BaseModel):
    provider: str
    credentials: dict

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v


# --- Pricing ---


class PageCountCheckRequest(BaseModel):
    project_id: UUID
    provider: str
    binding_type: str = "paperback"

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v

    @field_validator("binding_type")
    @classmethod
    def validate_binding(cls, v):
        if v not in ("paperback", "hardback", "micro"):
            raise ValueError("binding_type must be one of: paperback, hardback, micro")
        return v


@router.post("/validate-page-count")
async def validate_page_count_endpoint(
    body: PageCountCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a project's page count is within the provider's limits for the chosen binding.

    Returns:
        - allowed: bool
        - page_count: int
        - min_pages: int
        - max_pages: int
        - message: str (only if not allowed)
        - warning: str (if close to limit, within 90%)
    """
    from app.services.typeset.provider_specs import get_page_count_limits, validate_page_count

    logger.info(
        "validate_page_count: project_id=%s, provider=%s, binding=%s, user_id=%s",
        body.project_id, body.provider, body.binding_type, current_user.id,
    )

    result = await db.execute(
        select(BookProject).where(
            BookProject.id == body.project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    page_count = project.page_count or 0
    if page_count == 0:
        logger.warning("validate_page_count: project has no page_count yet")
        return {
            "allowed": True,
            "page_count": 0,
            "min_pages": 0,
            "max_pages": 0,
            "message": "Page count not yet determined — typeset the book first.",
        }

    min_pages, max_pages = get_page_count_limits(body.provider, body.binding_type)
    error = validate_page_count(page_count, body.provider, body.binding_type)

    if error:
        logger.warning(
            "validate_page_count: BLOCKED — %s", error["message"],
        )
        return {
            "allowed": False,
            "page_count": page_count,
            "min_pages": min_pages,
            "max_pages": max_pages,
            "message": error["message"],
        }

    # Check if close to limit (within 10% of max) — warn but allow
    threshold = int(max_pages * 0.9)
    response = {
        "allowed": True,
        "page_count": page_count,
        "min_pages": min_pages,
        "max_pages": max_pages,
    }
    if page_count >= threshold:
        response["warning"] = (
            f"This book has {page_count} pages — close to the {max_pages}-page maximum "
            f"for {body.provider.title()} {body.binding_type}. If you increase font size or "
            f"add content, it may exceed the limit."
        )
        logger.info("validate_page_count: WARNING — near limit: %s", response["warning"])

    logger.info("validate_page_count: allowed, page_count=%d, max=%d", page_count, max_pages)
    return response


@router.post("/pricing")
async def get_pricing(
    body: PricingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a pricing estimate from the specified provider."""
    logger.info(
        "get_pricing: project_id=%s, provider=%s, user_id=%s",
        body.project_id, body.provider, current_user.id,
    )

    order_service = OrderService(db, current_user.id)

    # Validate page count before calling provider
    from app.services.typeset.provider_specs import validate_page_count as _validate_pc
    result = await db.execute(
        select(BookProject).where(
            BookProject.id == body.project_id,
            BookProject.user_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    binding = project.binding_type or "paperback"
    page_count = project.page_count or 0
    if page_count > 0:
        pc_error = _validate_pc(page_count, body.provider, binding)
        if pc_error:
            logger.warning("get_pricing: page count validation failed: %s", pc_error["message"])
            raise HTTPException(status_code=422, detail=pc_error["message"])

    shipping_dict = {
        "name": body.shipping_address.name,
        "street1": body.shipping_address.street1,
        "street2": body.shipping_address.street2 or "",
        "city": body.shipping_address.city,
        "state": normalize_state_code(body.shipping_address.state),
        "postal_code": body.shipping_address.postal_code,
        "country": body.shipping_address.country,
        "phone_number": body.shipping_address.phone_number or "",
    }
    logger.debug(
        "get_pricing: normalized state '%s' → '%s'",
        body.shipping_address.state, shipping_dict["state"],
    )

    try:
        estimate = await order_service.get_pricing(
            body.project_id, body.provider, shipping_dict
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderError as e:
        logger.error("get_pricing: provider error: %s", e.message)
        raise HTTPException(status_code=502, detail=e.message)

    logger.info(
        "get_pricing: returning estimate total=%.2f %s",
        estimate.total_cost, estimate.currency,
    )
    return {
        "unit_cost": estimate.unit_cost,
        "shipping_cost": estimate.shipping_cost,
        "total_cost": estimate.total_cost,
        "currency": estimate.currency,
        "provider": estimate.provider,
    }


# --- Orders ---


@router.post("/orders", status_code=201)
async def create_order(
    body: OrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a print order."""
    logger.info(
        "create_order: projects=%d, provider=%s, user_id=%s",
        len(body.project_ids), body.provider, current_user.id,
    )

    # Validate ISBN if provided
    if body.isbn_option == "user_provided" and body.user_isbn:
        isbn_mgr = ISBNManager()
        is_valid, error = isbn_mgr.validate_isbn13(body.user_isbn)
        if not is_valid:
            raise HTTPException(status_code=422, detail=f"Invalid ISBN: {error}")

    order_service = OrderService(db, current_user.id)

    try:
        order = await order_service.submit_order(
            project_ids=body.project_ids,
            provider=body.provider,
            shipping_address=body.shipping_address,
            isbn_option=body.isbn_option,
            user_isbn=body.user_isbn,
            quantity=body.quantity,
            contact_email=current_user.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderError as e:
        logger.error("create_order: provider error: %s", e.message)
        raise HTTPException(status_code=502, detail=e.message)

    response = {
        "id": str(order.id),
        "provider": order.provider,
        "provider_order_id": order.provider_order_id,
        "status": order.status.value,
        "total_price": float(order.total_price) if order.total_price else None,
        "currency": order.currency or "USD",
    }

    if order.status == OrderStatus.FAILED:
        response["message"] = "Order submission failed. Please check your credentials and try again."

    if body.provider == "kdp":
        response["message"] = (
            "Files ready for manual upload to KDP. "
            "Download your interior and cover PDFs from the project page."
        )

    logger.info("create_order: result status=%s, order_id=%s", order.status.value, order.id)
    return response


@router.get("/orders")
async def list_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all orders for the authenticated user."""
    logger.info("list_orders: user_id=%s", current_user.id)

    result = await db.execute(
        select(PrintOrder)
        .where(PrintOrder.user_id == current_user.id)
        .order_by(PrintOrder.created_at.desc())
    )
    orders = result.scalars().all()

    # Fetch items for each order to include title/author snapshots
    order_list = []
    for o in orders:
        items_result = await db.execute(
            select(OrderItem).where(OrderItem.order_id == o.id)
        )
        items = items_result.scalars().all()

        order_list.append({
            "id": str(o.id),
            "provider": o.provider,
            "provider_order_id": o.provider_order_id,
            "status": o.status.value,
            "total_price": float(o.total_price) if o.total_price else None,
            "shipping_cost": float(o.shipping_cost) if o.shipping_cost else None,
            "currency": o.currency or "USD",
            "ordered_at": o.ordered_at.isoformat() if o.ordered_at else o.created_at.isoformat(),
            "shipping_address": o.shipping_address_json or o.shipping_address,
            "items": [
                {
                    "id": str(i.id),
                    "project_id": str(i.project_id),
                    "title": i.title,
                    "author": i.author,
                    "quantity": i.quantity,
                    "unit_price": float(i.unit_price) if i.unit_price else None,
                }
                for i in items
            ],
        })

    logger.info("list_orders: returning %d orders", len(order_list))
    return {"orders": order_list}


@router.get("/orders/{order_id}")
async def get_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific order."""
    logger.info("get_order: order_id=%s, user_id=%s", order_id, current_user.id)

    result = await db.execute(
        select(PrintOrder).where(
            PrintOrder.id == order_id,
            PrintOrder.user_id == current_user.id,
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get items
    result = await db.execute(
        select(OrderItem).where(OrderItem.order_id == order_id)
    )
    items = result.scalars().all()

    return {
        "id": str(order.id),
        "provider": order.provider,
        "provider_order_id": order.provider_order_id,
        "status": order.status.value,
        "total_price": float(order.total_price) if order.total_price else None,
        "shipping_cost": float(order.shipping_cost) if order.shipping_cost else None,
        "currency": order.currency or "USD",
        "ordered_at": order.ordered_at.isoformat() if order.ordered_at else order.created_at.isoformat(),
        "shipping_address": order.shipping_address_json or order.shipping_address,
        "shipping_address_text": order.shipping_address,
        "items": [
            {
                "id": str(i.id),
                "project_id": str(i.project_id),
                "title": i.title,
                "author": i.author,
                "quantity": i.quantity,
                "unit_price": float(i.unit_price) if i.unit_price else None,
            }
            for i in items
        ],
    }


# --- Credentials ---


@router.post("/credentials")
async def store_credentials(
    body: CredentialStoreRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store encrypted credentials for a print provider."""
    logger.info(
        "store_credentials: provider=%s, user_id=%s",
        body.provider, current_user.id,
    )

    # Validate credential fields based on provider
    if body.provider == "lulu":
        if "client_id" not in body.credentials or "client_secret" not in body.credentials:
            raise HTTPException(
                status_code=422,
                detail="Lulu credentials require 'client_id' and 'client_secret' fields.",
            )
    elif body.provider == "bookvault":
        if "api_key" not in body.credentials:
            raise HTTPException(
                status_code=422,
                detail="BookVault credentials require an 'api_key' field.",
            )
    # KDP doesn't need credentials

    cred_service = CredentialService(db, current_user.id)
    await cred_service.store_credentials(body.provider, body.credentials)

    return {"provider": body.provider, "status": "stored"}


@router.get("/credentials")
async def list_credentials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List which providers have stored credentials (does not return actual credentials)."""
    logger.info("list_credentials: user_id=%s", current_user.id)

    cred_service = CredentialService(db, current_user.id)
    configured = await cred_service.list_configured_providers()

    return {
        "providers": [
            {"provider": "lulu", "configured": "lulu" in configured},
            {"provider": "bookvault", "configured": "bookvault" in configured},
            {"provider": "kdp", "configured": True},  # KDP never needs credentials
        ]
    }


@router.delete("/credentials/{provider}")
async def delete_credentials(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete stored credentials for a provider."""
    logger.info(
        "delete_credentials: provider=%s, user_id=%s",
        provider, current_user.id,
    )

    if provider not in ("lulu", "bookvault", "kdp"):
        raise HTTPException(status_code=400, detail="Invalid provider")

    cred_service = CredentialService(db, current_user.id)
    await cred_service.delete_credentials(provider)

    return {"provider": provider, "status": "deleted"}
