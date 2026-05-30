"""User router: profile management and preferences endpoints."""

import logging
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.auth import ProfileUpdateRequest, UserProfileResponse
from app.services.user_service import UserService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
):
    """Get the authenticated user's profile."""
    logger.debug("get_profile: user_id=%s", current_user.id)
    return UserProfileResponse(
        email=current_user.email,
        display_name=current_user.display_name,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
    )


@router.patch("/profile", response_model=UserProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's profile."""
    logger.info("update_profile: user_id=%s, display_name=%s", current_user.id, body.display_name)
    user_service = UserService(db)
    user = await user_service.update_profile(
        user_id=current_user.id,
        display_name=body.display_name,
    )

    return UserProfileResponse(
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
        created_at=user.created_at,
    )


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password. Requires current password."""
    logger.info("change_password: user_id=%s", current_user.id)

    # Verify current password
    if not bcrypt.checkpw(
        body.current_password.encode("utf-8"),
        current_user.password_hash.encode("utf-8"),
    ):
        logger.warning("change_password: incorrect current password for user_id=%s", current_user.id)
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash and set new password
    new_hash = bcrypt.hashpw(
        body.new_password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("utf-8")
    current_user.password_hash = new_hash
    await db.commit()
    logger.info("change_password: password updated for user_id=%s", current_user.id)


# --- User Preferences ---

class PreferencesResponse(BaseModel):
    default_print_provider: str
    bookshelf_view_mode: str
    default_trim_size: str
    default_paper_type: str
    default_color_interior: bool
    default_cover_finish: str
    default_binding_type: str
    default_font_size: str


class PreferencesUpdateRequest(BaseModel):
    default_print_provider: Optional[str] = None
    bookshelf_view_mode: Optional[str] = None
    default_trim_size: Optional[str] = None
    default_paper_type: Optional[str] = None
    default_color_interior: Optional[bool] = None
    default_cover_finish: Optional[str] = None
    default_binding_type: Optional[str] = None
    default_font_size: Optional[str] = None


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated user's preferences."""
    logger.debug("get_preferences: user_id=%s", current_user.id)
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if pref is None:
        logger.debug("get_preferences: no preferences found, returning defaults")
        return PreferencesResponse(
            default_print_provider="lulu",
            bookshelf_view_mode="grid",
            default_trim_size="5.5x8.5",
            default_paper_type="white",
            default_color_interior=False,
            default_cover_finish="glossy",
            default_binding_type="paperback",
            default_font_size="11pt",
        )

    return PreferencesResponse(
        default_print_provider=pref.default_print_provider or "lulu",
        bookshelf_view_mode=pref.bookshelf_view_mode or "grid",
        default_trim_size=pref.default_trim_size or "5.5x8.5",
        default_paper_type=pref.default_paper_type or "white",
        default_color_interior=pref.default_color_interior if pref.default_color_interior is not None else False,
        default_cover_finish=pref.default_cover_finish or "glossy",
        default_binding_type=pref.default_binding_type or "paperback",
        default_font_size=pref.default_font_size or "11pt",
    )


@router.patch("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    body: PreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's preferences."""
    logger.info(
        "update_preferences: user_id=%s, provider=%s, view_mode=%s, trim=%s, paper=%s, color=%s, finish=%s, binding=%s, font=%s",
        current_user.id, body.default_print_provider, body.bookshelf_view_mode,
        body.default_trim_size, body.default_paper_type, body.default_color_interior, body.default_cover_finish,
        body.default_binding_type, body.default_font_size,
    )
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if pref is None:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    if body.default_print_provider is not None:
        valid_providers = {"lulu", "bookvault", "kdp"}
        if body.default_print_provider in valid_providers:
            pref.default_print_provider = body.default_print_provider
        else:
            logger.warning("update_preferences: invalid provider '%s'", body.default_print_provider)

    if body.bookshelf_view_mode is not None:
        valid_modes = {"grid", "list"}
        if body.bookshelf_view_mode in valid_modes:
            pref.bookshelf_view_mode = body.bookshelf_view_mode

    if body.default_trim_size is not None:
        valid_sizes = {"5x8", "5.06x7.81", "5.25x8", "5.5x8.5", "6x9", "8.5x11"}
        if body.default_trim_size in valid_sizes:
            pref.default_trim_size = body.default_trim_size
        else:
            logger.warning("update_preferences: invalid trim_size '%s'", body.default_trim_size)

    if body.default_paper_type is not None:
        valid_papers = {"white", "cream"}
        if body.default_paper_type in valid_papers:
            pref.default_paper_type = body.default_paper_type
        else:
            logger.warning("update_preferences: invalid paper_type '%s'", body.default_paper_type)

    if body.default_color_interior is not None:
        pref.default_color_interior = body.default_color_interior

    if body.default_cover_finish is not None:
        valid_finishes = {"glossy", "matte"}
        if body.default_cover_finish in valid_finishes:
            pref.default_cover_finish = body.default_cover_finish
        else:
            logger.warning("update_preferences: invalid cover_finish '%s'", body.default_cover_finish)

    if body.default_binding_type is not None:
        valid_bindings = {"paperback", "hardback", "micro"}
        if body.default_binding_type in valid_bindings:
            pref.default_binding_type = body.default_binding_type
        else:
            logger.warning("update_preferences: invalid binding_type '%s'", body.default_binding_type)

    if body.default_font_size is not None:
        valid_font_sizes = {"9pt", "10pt", "11pt", "12pt", "13pt", "14pt"}
        if body.default_font_size in valid_font_sizes:
            pref.default_font_size = body.default_font_size
        else:
            logger.warning("update_preferences: invalid font_size '%s'", body.default_font_size)

    await db.flush()
    logger.info("update_preferences: saved preferences for user_id=%s", current_user.id)

    return PreferencesResponse(
        default_print_provider=pref.default_print_provider or "lulu",
        bookshelf_view_mode=pref.bookshelf_view_mode or "grid",
        default_trim_size=pref.default_trim_size or "5.5x8.5",
        default_paper_type=pref.default_paper_type or "white",
        default_color_interior=pref.default_color_interior if pref.default_color_interior is not None else False,
        default_cover_finish=pref.default_cover_finish or "glossy",
        default_binding_type=pref.default_binding_type or "paperback",
        default_font_size=pref.default_font_size or "11pt",
    )
