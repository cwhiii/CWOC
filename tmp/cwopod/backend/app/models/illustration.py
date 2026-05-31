import logging
import uuid
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, Float, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UserScopedMixin

logger = logging.getLogger(__name__)


class PoolType(str, PyEnum):
    SHARED = "shared"
    AVAILABLE = "available"
    IN_BOOK = "in_book"


class SourceTypeIll(str, PyEnum):
    EXTRACTED = "extracted"
    UPLOADED = "uploaded"


class PlacementModeType(str, PyEnum):
    FULL_PAGE = "full_page"
    PLATE = "plate"
    INLINE = "inline"


class LayoutType(str, PyEnum):
    MARGINS = "margins"
    EDGES = "edges"


class SideType(str, PyEnum):
    LEFT = "left"
    RIGHT = "right"


class Illustration(Base, TimestampMixin, UserScopedMixin):
    """Model for persisting illustration placement data.

    Tracks images across three pools (shared, available, in_book) with
    placement configuration, lock state, and display metadata.
    """

    __tablename__ = "illustrations"

    __table_args__ = (
        Index("ix_illustrations_project_pool", "project_id", "pool"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    image_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    pool: Mapped[PoolType] = mapped_column(
        Enum(PoolType, values_callable=lambda e: [x.value for x in e], name="pool_type"),
        nullable=False,
    )
    source: Mapped[SourceTypeIll] = mapped_column(
        Enum(SourceTypeIll, values_callable=lambda e: [x.value for x in e], name="source_type_ill"),
        nullable=False,
    )
    file_ext: Mapped[str] = mapped_column(String(10), nullable=False)
    original_width_px: Mapped[int] = mapped_column(Integer, nullable=False)
    original_height_px: Mapped[int] = mapped_column(Integer, nullable=False)
    placement_mode: Mapped[PlacementModeType | None] = mapped_column(
        Enum(PlacementModeType, values_callable=lambda e: [x.value for x in e], name="placement_mode_type"),
        nullable=True,
    )
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    layout: Mapped[LayoutType | None] = mapped_column(
        Enum(LayoutType, values_callable=lambda e: [x.value for x in e], name="layout_type"),
        nullable=True,
    )
    side: Mapped[SideType | None] = mapped_column(
        Enum(SideType, values_callable=lambda e: [x.value for x in e], name="side_type"),
        nullable=True,
    )
    lock_state: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __init__(self, **kwargs):
        logger.debug(
            "Illustration.__init__ called with params: "
            "project_id=%s, user_id=%s, image_uuid=%s, label=%s, pool=%s, "
            "source=%s, file_ext=%s, original_width_px=%s, original_height_px=%s, "
            "placement_mode=%s, page_number=%s, position_x=%s, position_y=%s, "
            "height=%s, layout=%s, side=%s, lock_state=%s, sort_order=%s",
            kwargs.get("project_id"),
            kwargs.get("user_id"),
            kwargs.get("image_uuid"),
            kwargs.get("label"),
            kwargs.get("pool"),
            kwargs.get("source"),
            kwargs.get("file_ext"),
            kwargs.get("original_width_px"),
            kwargs.get("original_height_px"),
            kwargs.get("placement_mode"),
            kwargs.get("page_number"),
            kwargs.get("position_x"),
            kwargs.get("position_y"),
            kwargs.get("height"),
            kwargs.get("layout"),
            kwargs.get("side"),
            kwargs.get("lock_state"),
            kwargs.get("sort_order"),
        )
        super().__init__(**kwargs)
        logger.debug(
            "Illustration instance created: id=%s, image_uuid=%s, pool=%s",
            self.id,
            self.image_uuid,
            self.pool,
        )
