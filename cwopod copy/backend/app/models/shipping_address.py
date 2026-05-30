"""Shipping address model for storing multiple addresses per user."""

import uuid
from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ShippingAddress(Base, TimestampMixin):
    """Stores per-user shipping addresses with one marked as default."""

    __tablename__ = "shipping_addresses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Home"
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    street1: Mapped[str] = mapped_column(String(300), nullable=False)
    street2: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="US")
    phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
