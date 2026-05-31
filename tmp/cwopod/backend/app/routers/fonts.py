"""Fonts router: manage fonts, uploads, downloads, favorites, and recent selections."""

import logging
import os
import uuid
from pathlib import Path
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.font import FontSource, UserFont, UserFontFavorite, UserFontRecent
from app.models.project import BookProject
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# Print fonts directory (bundled fonts)
PRINT_FONTS_DIR = Path(__file__).parent.parent.parent / "fonts" / "print"
# Google Fonts catalog path
GOOGLE_FONTS_CATALOG_PATH = Path(__file__).parent.parent.parent / "fonts" / "google_fonts_catalog.json"
# Font storage directory (Docker volume mount)
FONT_STORAGE_DIR = Path(settings.storage_path) / "fonts"


class FontInfo(BaseModel):
    """Information about an available font."""

    font_id: str
    family_name: str
    category: str | None
    source: Literal["print", "google", "user"]
    availability: Literal["available", "needs-download"]


class FontListResponse(BaseModel):
    """Response for font listing."""

    fonts: list[FontInfo]


class FontUploadResponse(BaseModel):
    """Response for font upload."""

    font_id: str
    family_name: str
    category: str | None
    source: Literal["user"]
    availability: Literal["available"]


class FontDownloadRequest(BaseModel):
    """Request for font download."""

    family_name: str


class FontDownloadResponse(BaseModel):
    """Response for font download."""

    font_id: str
    family_name: str
    category: str | None
    source: Literal["google"]
    availability: Literal["available"]


class FavoritesRequest(BaseModel):
    """Request to toggle favorite status."""

    font_identifier: str


class FavoritesResponse(BaseModel):
    """Response for favorite toggle."""

    font_identifier: str
    is_favorite: bool


class RecentResponse(BaseModel):
    """Response for recently used fonts."""

    fonts: list[dict]


@router.get("/", response_model=FontListResponse)
async def list_fonts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all available fonts for the authenticated user."""
    logger.info("list_fonts: user_id=%s", current_user.id)

    fonts: list[FontInfo] = []

    # 1. Print fonts (shared, all users)
    if PRINT_FONTS_DIR.exists():
        for font_file in PRINT_FONTS_DIR.glob("*.ttf"):
            family_name = _extract_font_family(font_file)
            if family_name:
                fonts.append(FontInfo(
                    font_id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"print:{family_name}")),
                    family_name=family_name,
                    category=None,  # Will be populated from catalog
                    source="print",
                    availability="available",
                ))
        logger.info("list_fonts: found %d print fonts", len([f for f in fonts if f.source == "print"]))

    # 2. Downloaded Google fonts (shared, all users)
    google_fonts_dir = FONT_STORAGE_DIR / "google_fonts"
    if google_fonts_dir.exists():
        for font_file in google_fonts_dir.glob("*.ttf"):
            family_name = _extract_font_family(font_file)
            if family_name:
                fonts.append(FontInfo(
                    font_id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"google:{family_name}")),
                    family_name=family_name,
                    category=None,  # Will be populated from catalog
                    source="google",
                    availability="available",
                ))
        logger.info("list_fonts: found %d downloaded Google fonts", len([f for f in fonts if f.source == "google"]))

    # 3. User uploaded fonts
    user_fonts_dir = FONT_STORAGE_DIR / "user_uploads" / str(current_user.id)
    if user_fonts_dir.exists():
        result = await db.execute(
            select(UserFont).where(UserFont.user_id == current_user.id)
        )
        user_fonts = result.scalars().all()
        for uf in user_fonts:
            fonts.append(FontInfo(
                font_id=str(uf.id),
                family_name=uf.font_family,
                category=uf.category,
                source="user",
                availability="available",
            ))
        logger.info("list_fonts: found %d user uploaded fonts", len([f for f in fonts if f.source == "user"]))

    # Sort alphabetically by family name
    fonts.sort(key=lambda f: f.family_name.lower())

    logger.info("list_fonts: returning %d total fonts", len(fonts))
    return {"fonts": fonts}


@router.post("/upload", response_model=FontUploadResponse)
async def upload_font(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a font file (.ttf or .otf)."""
    logger.info("upload_font: user_id=%s, filename=%s", current_user.id, file.filename)

    # Validate file extension
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in [".ttf", ".otf"]:
            raise HTTPException(status_code=422, detail="Invalid file extension. Only .ttf and .otf files are allowed.")
    else:
        raise HTTPException(status_code=422, detail="No file provided.")

    # Validate file size (max 10 MB)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="File size exceeds 10 MB limit.")

    # Extract font family name
    family_name = _extract_font_family_from_content(content)
    if not family_name:
        raise HTTPException(status_code=422, detail="Could not extract font family name from file.")

    # Check user's font limit (max 50 fonts)
    result = await db.execute(
        select(UserFont).where(UserFont.user_id == current_user.id)
    )
    user_fonts = result.scalars().all()
    if len(user_fonts) >= 50:
        raise HTTPException(status_code=422, detail="Maximum number of uploaded fonts (50) has been reached.")

    # Create user_fonts directory if needed
    user_fonts_dir = FONT_STORAGE_DIR / "user_uploads" / str(current_user.id)
    user_fonts_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    font_id = uuid.uuid4()
    ext = Path(file.filename).suffix.lower() if file.filename else ".ttf"
    font_filename = f"{font_id}{ext}"
    font_path = user_fonts_dir / font_filename

    # Save the file
    try:
        with open(font_path, "wb") as f:
            f.write(content)
        logger.info("upload_font: saved font to %s", font_path)
    except Exception as e:
        logger.error("upload_font: failed to save font: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save font file.")

    # Check if font with same family already exists for this user
    existing_font = None
    for uf in user_fonts:
        if uf.font_family.lower() == family_name.lower():
            existing_font = uf
            break

    if existing_font:
        # Replace existing font file
        old_font_path = Path(existing_font.file_path)
        if old_font_path.exists():
            old_font_path.unlink()
            logger.info("upload_font: replaced existing font file: %s", old_font_path)

        # Update existing record
        existing_font.file_path = str(font_path)
        existing_font.source = FontSource.UPLOAD
        await db.flush()
        logger.info("upload_font: updated existing font record: %s", existing_font.id)
    else:
        # Create new record
        new_font = UserFont(
            id=font_id,
            user_id=current_user.id,
            font_family=family_name,
            file_path=str(font_path),
            source=FontSource.UPLOAD,
            category=None,  # Will be populated later if needed
        )
        db.add(new_font)
        await db.flush()
        logger.info("upload_font: created new font record: %s", new_font.id)

    await db.commit()

    logger.info("upload_font: upload complete, font_id=%s, family_name=%s", font_id, family_name)
    return FontUploadResponse(
        font_id=str(font_id),
        family_name=family_name,
        category=None,
        source="user",
        availability="available",
    )


@router.post("/download", response_model=FontDownloadResponse)
async def download_font(
    body: FontDownloadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a Google Font by family name."""
    logger.info("download_font: user_id=%s, family_name=%s", current_user.id, body.family_name)

    # Load Google Fonts catalog
    if not GOOGLE_FONTS_CATALOG_PATH.exists():
        logger.error("download_font: Google Fonts catalog not found at %s", GOOGLE_FONTS_CATALOG_PATH)
        raise HTTPException(status_code=500, detail="Google Fonts catalog not available.")

    import json
    with open(GOOGLE_FONTS_CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    # Find font in catalog
    font_info = None
    for family in catalog.get("families", []):
        if family.get("family") == body.family_name:
            font_info = family
            break

    if not font_info:
        logger.warning("download_font: font not found in catalog: %s", body.family_name)
        raise HTTPException(status_code=404, detail=f"Font '{body.family_name}' not found in Google Fonts catalog.")

    # Check if font is already downloaded
    google_fonts_dir = FONT_STORAGE_DIR / "google_fonts"
    google_fonts_dir.mkdir(parents=True, exist_ok=True)

    # Look for existing font file
    existing_font = None
    for font_file in google_fonts_dir.glob("*.ttf"):
        if _extract_font_family(font_file) == body.family_name:
            existing_font = font_file
            break

    if existing_font:
        logger.info("download_font: font already downloaded: %s", existing_font.name)
        font_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"google:{body.family_name}"))
        return FontDownloadResponse(
            font_id=font_id,
            family_name=body.family_name,
            category=font_info.get("category"),
            source="google",
            availability="available",
        )

    # Download font from Google Fonts
    download_url = font_info.get("download_url")
    if not download_url:
        logger.error("download_font: no download URL for font: %s", body.family_name)
        raise HTTPException(status_code=500, detail="No download URL available for this font.")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.get(download_url)
            response.raise_for_status()
            font_data = response.content
            logger.info("download_font: downloaded %d bytes for %s", len(font_data), body.family_name)
    except httpx.HTTPError as e:
        logger.error("download_font: download failed for %s: %s", body.family_name, e)
        raise HTTPException(status_code=502, detail=f"Failed to download font: {e}")

    # Save font file
    font_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"google:{body.family_name}")
    font_filename = f"{font_id}.ttf"
    font_path = google_fonts_dir / font_filename

    try:
        with open(font_path, "wb") as f:
            f.write(font_data)
        logger.info("download_font: saved font to %s", font_path)
    except Exception as e:
        logger.error("download_font: failed to save font: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save font file.")

    logger.info("download_font: download complete, font_id=%s, family_name=%s", font_id, body.family_name)
    return FontDownloadResponse(
        font_id=str(font_id),
        family_name=body.family_name,
        category=font_info.get("category"),
        source="google",
        availability="available",
    )


@router.get("/file/{font_id}")
async def serve_font_file(
    font_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve a font file for @font-face injection."""
    logger.info("serve_font_file: user_id=%s, font_id=%s", current_user.id, font_id)

    # Determine font source and path
    # 1. Print fonts
    if font_id.startswith("print:"):
        # Extract family name from font_id
        family_name = font_id.replace("print:", "")
        for font_file in PRINT_FONTS_DIR.glob("*.ttf"):
            if _extract_font_family(font_file) == family_name:
                return _serve_font_file_response(font_file)

    # 2. Google fonts
    if font_id.startswith("google:"):
        family_name = font_id.replace("google:", "")
        google_fonts_dir = FONT_STORAGE_DIR / "google_fonts"
        for font_file in google_fonts_dir.glob("*.ttf"):
            if _extract_font_family(font_file) == family_name:
                return _serve_font_file_response(font_file)

    # 3. User fonts
    result = await db.execute(
        select(UserFont).where(UserFont.id == uuid.UUID(font_id), UserFont.user_id == current_user.id)
    )
    user_font = result.scalar_one_or_none()

    if user_font:
        font_path = Path(user_font.file_path)
        if font_path.exists():
            return _serve_font_file_response(font_path)
        else:
            logger.warning("serve_font_file: font file not found: %s", user_font.file_path)
            raise HTTPException(status_code=404, detail="Font file not found.")

    logger.warning("serve_font_file: font not found: %s", font_id)
    raise HTTPException(status_code=404, detail="Font not found.")


@router.post("/favorites", response_model=FavoritesResponse)
async def toggle_favorite(
    body: FavoritesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle favorite status for a font."""
    logger.info("toggle_favorite: user_id=%s, font_identifier=%s", current_user.id, body.font_identifier)

    # Check if already favorited
    result = await db.execute(
        select(UserFontFavorite).where(
            UserFontFavorite.user_id == current_user.id,
            UserFontFavorite.font_identifier == body.font_identifier,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Remove favorite
        await db.delete(existing)
        await db.flush()
        await db.commit()
        logger.info("toggle_favorite: removed favorite: %s", body.font_identifier)
        return FavoritesResponse(
            font_identifier=body.font_identifier,
            is_favorite=False,
        )
    else:
        # Add favorite
        favorite = UserFontFavorite(
            user_id=current_user.id,
            font_identifier=body.font_identifier,
        )
        db.add(favorite)
        await db.flush()
        await db.commit()
        logger.info("toggle_favorite: added favorite: %s", body.font_identifier)
        return FavoritesResponse(
            font_identifier=body.font_identifier,
            is_favorite=True,
        )


@router.get("/recent", response_model=RecentResponse)
async def get_recent_fonts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recently used fonts for the authenticated user."""
    logger.info("get_recent_fonts: user_id=%s", current_user.id)

    # Get recent fonts ordered by most recent first, limit 20
    result = await db.execute(
        select(UserFontRecent)
        .where(UserFontRecent.user_id == current_user.id)
        .order_by(UserFontRecent.selected_at.desc())
        .limit(20)
    )
    recent_fonts = result.scalars().all()

    fonts = [
        {
            "font_identifier": rf.font_identifier,
            "selected_at": rf.selected_at.isoformat() if rf.selected_at else None,
        }
        for rf in recent_fonts
    ]

    logger.info("get_recent_fonts: returning %d recent fonts", len(fonts))
    return {"fonts": fonts}


def _serve_font_file_response(font_path: Path):
    """Create a FileResponse for a font file with appropriate Content-Type."""
    ext = font_path.suffix.lower()
    if ext == ".ttf":
        content_type = "font/ttf"
    elif ext == ".otf":
        content_type = "font/otf"
    else:
        content_type = "application/octet-stream"

    return FileResponse(
        path=str(font_path),
        media_type=content_type,
        filename=font_path.name,
    )


def _extract_font_family(font_path: Path) -> str | None:
    """Extract font family name from a font file using fonttools."""
    try:
        from fontTools.ttLib import TTFont
        with TTFont(font_path) as font:
            name_table = font["name"]
            for record in name_table.names:
                if record.nameID == 1 and record.platformID == 3 and record.platEncID == 1:
                    # Windows Unicode
                    return record.toUnicode()
    except ImportError:
        logger.debug("_extract_font_family: fontTools not available, cannot extract family name")
    except Exception as e:
        logger.warning("_extract_font_family: failed to extract family name from %s: %s", font_path, e)
    return None


def _extract_font_family_from_content(content: bytes) -> str | None:
    """Extract font family name from font file content using fonttools."""
    try:
        from fontTools.ttLib import TTFont
        from io import BytesIO
        with TTFont(BytesIO(content)) as font:
            name_table = font["name"]
            for record in name_table.names:
                if record.nameID == 1 and record.platformID == 3 and record.platEncID == 1:
                    # Windows Unicode
                    return record.toUnicode()
    except ImportError:
        logger.debug("_extract_font_family_from_content: fontTools not available")
    except Exception as e:
        logger.warning("_extract_font_family_from_content: failed to extract family name: %s", e)
    return None
