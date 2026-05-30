"""Shipping addresses router: CRUD for saved shipping addresses."""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.shipping_address import ShippingAddress
from app.models.user import User
from app.services.print_service.address_utils import normalize_state_code

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Schemas ---


class ShippingAddressCreate(BaseModel):
    label: str = "Home"
    name: str
    street1: str
    street2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str = "US"
    phone_number: Optional[str] = None
    is_default: bool = False

    @field_validator("label")
    @classmethod
    def validate_label(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Label cannot be empty")
        if len(v) > 100:
            raise ValueError("Label must be 100 characters or fewer")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("street1")
    @classmethod
    def validate_street1(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Street address cannot be empty")
        return v

    @field_validator("city")
    @classmethod
    def validate_city(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("City cannot be empty")
        return v

    @field_validator("postal_code")
    @classmethod
    def validate_postal_code(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Postal code cannot be empty")
        return v

    @field_validator("country")
    @classmethod
    def validate_country(cls, v):
        v = v.strip().upper()
        if len(v) != 2:
            raise ValueError("Country must be a 2-letter ISO code")
        return v


class ShippingAddressUpdate(BaseModel):
    label: Optional[str] = None
    name: Optional[str] = None
    street1: Optional[str] = None
    street2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    phone_number: Optional[str] = None
    is_default: Optional[bool] = None


class ShippingAddressResponse(BaseModel):
    id: str
    label: str
    name: str
    street1: str
    street2: Optional[str]
    city: str
    state: Optional[str]
    postal_code: str
    country: str
    phone_number: Optional[str]
    is_default: bool


# --- Endpoints ---


@router.get("/shipping-addresses")
async def list_shipping_addresses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved shipping addresses for the authenticated user."""
    logger.info("list_shipping_addresses: user_id=%s", current_user.id)

    result = await db.execute(
        select(ShippingAddress)
        .where(ShippingAddress.user_id == current_user.id)
        .order_by(ShippingAddress.is_default.desc(), ShippingAddress.created_at.asc())
    )
    addresses = result.scalars().all()

    logger.info("list_shipping_addresses: returning %d addresses", len(addresses))
    return {
        "addresses": [
            ShippingAddressResponse(
                id=str(a.id),
                label=a.label,
                name=a.name,
                street1=a.street1,
                street2=a.street2,
                city=a.city,
                state=a.state,
                postal_code=a.postal_code,
                country=a.country,
                phone_number=a.phone_number,
                is_default=a.is_default,
            ).model_dump()
            for a in addresses
        ]
    }


@router.post("/shipping-addresses", status_code=201)
async def create_shipping_address(
    body: ShippingAddressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new saved shipping address."""
    logger.info(
        "create_shipping_address: user_id=%s, label=%s, is_default=%s",
        current_user.id, body.label, body.is_default,
    )

    # If this is marked as default, unset any existing default
    if body.is_default:
        logger.debug("create_shipping_address: unsetting existing defaults for user_id=%s", current_user.id)
        await db.execute(
            update(ShippingAddress)
            .where(ShippingAddress.user_id == current_user.id, ShippingAddress.is_default == True)
            .values(is_default=False)
        )

    # If this is the user's first address, make it default regardless
    result = await db.execute(
        select(ShippingAddress).where(ShippingAddress.user_id == current_user.id).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        logger.debug("create_shipping_address: first address for user, setting as default")
        body.is_default = True

    address = ShippingAddress(
        user_id=current_user.id,
        label=body.label,
        name=body.name,
        street1=body.street1,
        street2=body.street2,
        city=body.city,
        state=normalize_state_code(body.state),
        postal_code=body.postal_code,
        country=body.country,
        phone_number=body.phone_number,
        is_default=body.is_default,
    )
    db.add(address)
    await db.flush()

    logger.info("create_shipping_address: created id=%s", address.id)
    return ShippingAddressResponse(
        id=str(address.id),
        label=address.label,
        name=address.name,
        street1=address.street1,
        street2=address.street2,
        city=address.city,
        state=address.state,
        postal_code=address.postal_code,
        country=address.country,
        phone_number=address.phone_number,
        is_default=address.is_default,
    ).model_dump()


@router.patch("/shipping-addresses/{address_id}")
async def update_shipping_address(
    address_id: UUID,
    body: ShippingAddressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing shipping address."""
    logger.info(
        "update_shipping_address: address_id=%s, user_id=%s",
        address_id, current_user.id,
    )

    result = await db.execute(
        select(ShippingAddress).where(
            ShippingAddress.id == address_id,
            ShippingAddress.user_id == current_user.id,
        )
    )
    address = result.scalar_one_or_none()
    if address is None:
        logger.warning("update_shipping_address: not found address_id=%s", address_id)
        raise HTTPException(status_code=404, detail="Address not found")

    # If setting as default, unset others first
    if body.is_default is True:
        logger.debug("update_shipping_address: unsetting existing defaults for user_id=%s", current_user.id)
        await db.execute(
            update(ShippingAddress)
            .where(ShippingAddress.user_id == current_user.id, ShippingAddress.is_default == True)
            .values(is_default=False)
        )

    if body.label is not None:
        address.label = body.label.strip()
    if body.name is not None:
        address.name = body.name.strip()
    if body.street1 is not None:
        address.street1 = body.street1.strip()
    if body.street2 is not None:
        address.street2 = body.street2.strip() or None
    if body.city is not None:
        address.city = body.city.strip()
    if body.state is not None:
        address.state = normalize_state_code(body.state) or None
    if body.postal_code is not None:
        address.postal_code = body.postal_code.strip()
    if body.country is not None:
        address.country = body.country.strip().upper()
    if body.phone_number is not None:
        address.phone_number = body.phone_number.strip() or None
    if body.is_default is not None:
        address.is_default = body.is_default

    await db.flush()
    logger.info("update_shipping_address: updated address_id=%s", address_id)

    return ShippingAddressResponse(
        id=str(address.id),
        label=address.label,
        name=address.name,
        street1=address.street1,
        street2=address.street2,
        city=address.city,
        state=address.state,
        postal_code=address.postal_code,
        country=address.country,
        phone_number=address.phone_number,
        is_default=address.is_default,
    ).model_dump()


@router.delete("/shipping-addresses/{address_id}")
async def delete_shipping_address(
    address_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved shipping address."""
    logger.info(
        "delete_shipping_address: address_id=%s, user_id=%s",
        address_id, current_user.id,
    )

    result = await db.execute(
        select(ShippingAddress).where(
            ShippingAddress.id == address_id,
            ShippingAddress.user_id == current_user.id,
        )
    )
    address = result.scalar_one_or_none()
    if address is None:
        logger.warning("delete_shipping_address: not found address_id=%s", address_id)
        raise HTTPException(status_code=404, detail="Address not found")

    was_default = address.is_default
    await db.delete(address)
    await db.flush()

    # If we deleted the default, promote the oldest remaining address
    if was_default:
        result = await db.execute(
            select(ShippingAddress)
            .where(ShippingAddress.user_id == current_user.id)
            .order_by(ShippingAddress.created_at.asc())
            .limit(1)
        )
        next_addr = result.scalar_one_or_none()
        if next_addr:
            logger.debug("delete_shipping_address: promoting address_id=%s to default", next_addr.id)
            next_addr.is_default = True
            await db.flush()

    logger.info("delete_shipping_address: deleted address_id=%s", address_id)
    return {"status": "deleted"}


@router.post("/shipping-addresses/{address_id}/set-default")
async def set_default_address(
    address_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a shipping address as the default."""
    logger.info(
        "set_default_address: address_id=%s, user_id=%s",
        address_id, current_user.id,
    )

    result = await db.execute(
        select(ShippingAddress).where(
            ShippingAddress.id == address_id,
            ShippingAddress.user_id == current_user.id,
        )
    )
    address = result.scalar_one_or_none()
    if address is None:
        logger.warning("set_default_address: not found address_id=%s", address_id)
        raise HTTPException(status_code=404, detail="Address not found")

    # Unset all others
    await db.execute(
        update(ShippingAddress)
        .where(ShippingAddress.user_id == current_user.id, ShippingAddress.is_default == True)
        .values(is_default=False)
    )

    address.is_default = True
    await db.flush()

    logger.info("set_default_address: address_id=%s is now default", address_id)
    return {"status": "default_set", "id": str(address_id)}
