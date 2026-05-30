"""Cover templates: 5 pre-built templates with distinct positioning and style combinations.

Templates are stored as Python data structures (not database records) since they
are system-defined and rarely change.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class TextEffects:
    """Visual effects applied to text overlays."""
    shadow_color: str = "rgba(0,0,0,0.5)"
    shadow_offset_x: float = 2.0
    shadow_offset_y: float = 2.0
    shadow_blur: float = 4.0
    outline_color: Optional[str] = None
    outline_width: float = 0.0
    opacity: float = 1.0


@dataclass
class TextStyle:
    """Style configuration for a text element."""
    font_family: str = "serif"
    font_size: float = 48.0
    font_weight: str = "bold"
    font_style: str = "normal"
    color: str = "#FFFFFF"
    effects: TextEffects = field(default_factory=TextEffects)


@dataclass
class TextPosition:
    """Position of a text element as proportional coordinates (0-1)."""
    x_pct: float = 0.5
    y_pct: float = 0.5
    anchor: str = "center"  # "center", "left", "right"


@dataclass
class CoverTemplate:
    """A pre-built cover template with positioning and style presets."""
    id: str
    name: str
    description: str
    title_position: TextPosition
    title_style: TextStyle
    author_position: TextPosition
    author_style: TextStyle
    spine_font: str = "serif"
    spine_color: str = "#FFFFFF"
    thumbnail: str = ""  # Path to preview image


# --- 5 Default Templates ---

TEMPLATE_CLASSIC = CoverTemplate(
    id="classic",
    name="Classic",
    description="Centered title at top, author at bottom. Garamond serif, white text with shadow.",
    title_position=TextPosition(x_pct=0.5, y_pct=0.15, anchor="center"),
    title_style=TextStyle(
        font_family="Garamond",
        font_size=48.0,
        font_weight="bold",
        color="#FFFFFF",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.7)",
            shadow_offset_x=2.0,
            shadow_offset_y=2.0,
            shadow_blur=4.0,
        ),
    ),
    author_position=TextPosition(x_pct=0.5, y_pct=0.85, anchor="center"),
    author_style=TextStyle(
        font_family="Garamond",
        font_size=24.0,
        font_weight="normal",
        color="#FFFFFF",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.5)",
            shadow_offset_x=1.0,
            shadow_offset_y=1.0,
            shadow_blur=3.0,
        ),
    ),
    spine_font="Garamond",
    spine_color="#FFFFFF",
)

TEMPLATE_MODERN = CoverTemplate(
    id="modern",
    name="Modern",
    description="Left-aligned title at center, author bottom-left. Helvetica sans-serif, subtle shadow.",
    title_position=TextPosition(x_pct=0.15, y_pct=0.5, anchor="left"),
    title_style=TextStyle(
        font_family="Helvetica",
        font_size=42.0,
        font_weight="bold",
        color="#FFFFFF",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.4)",
            shadow_offset_x=1.0,
            shadow_offset_y=1.0,
            shadow_blur=2.0,
        ),
    ),
    author_position=TextPosition(x_pct=0.15, y_pct=0.88, anchor="left"),
    author_style=TextStyle(
        font_family="Helvetica",
        font_size=20.0,
        font_weight="normal",
        color="#E0E0E0",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.3)",
            shadow_offset_x=1.0,
            shadow_offset_y=1.0,
            shadow_blur=2.0,
        ),
    ),
    spine_font="Helvetica",
    spine_color="#FFFFFF",
)

TEMPLATE_BOLD = CoverTemplate(
    id="bold",
    name="Bold",
    description="Large centered title with black outline, author small at bottom.",
    title_position=TextPosition(x_pct=0.5, y_pct=0.4, anchor="center"),
    title_style=TextStyle(
        font_family="Impact",
        font_size=72.0,
        font_weight="bold",
        color="#FFFFFF",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.0)",
            shadow_offset_x=0.0,
            shadow_offset_y=0.0,
            shadow_blur=0.0,
            outline_color="#000000",
            outline_width=3.0,
        ),
    ),
    author_position=TextPosition(x_pct=0.5, y_pct=0.92, anchor="center"),
    author_style=TextStyle(
        font_family="Impact",
        font_size=18.0,
        font_weight="normal",
        color="#FFFFFF",
        effects=TextEffects(
            outline_color="#000000",
            outline_width=1.5,
        ),
    ),
    spine_font="Impact",
    spine_color="#FFFFFF",
)

TEMPLATE_ELEGANT = CoverTemplate(
    id="elegant",
    name="Elegant",
    description="Right-aligned title upper-third, author lower-third. Italic Palatino serif, opacity overlay.",
    title_position=TextPosition(x_pct=0.85, y_pct=0.3, anchor="right"),
    title_style=TextStyle(
        font_family="Palatino",
        font_size=40.0,
        font_weight="bold",
        font_style="italic",
        color="#FFFFFF",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.6)",
            shadow_offset_x=1.5,
            shadow_offset_y=1.5,
            shadow_blur=3.0,
            opacity=0.95,
        ),
    ),
    author_position=TextPosition(x_pct=0.85, y_pct=0.7, anchor="right"),
    author_style=TextStyle(
        font_family="Palatino",
        font_size=22.0,
        font_weight="normal",
        font_style="italic",
        color="#F0F0F0",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.4)",
            shadow_offset_x=1.0,
            shadow_offset_y=1.0,
            shadow_blur=2.0,
            opacity=0.9,
        ),
    ),
    spine_font="Palatino",
    spine_color="#F0F0F0",
)

TEMPLATE_MINIMAL = CoverTemplate(
    id="minimal",
    name="Minimal",
    description="Small title bottom-left, author below title. Clean Inter sans-serif, high contrast.",
    title_position=TextPosition(x_pct=0.1, y_pct=0.82, anchor="left"),
    title_style=TextStyle(
        font_family="Inter",
        font_size=28.0,
        font_weight="bold",
        color="#FFFFFF",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.0)",
            shadow_offset_x=0.0,
            shadow_offset_y=0.0,
            shadow_blur=0.0,
            opacity=1.0,
        ),
    ),
    author_position=TextPosition(x_pct=0.1, y_pct=0.89, anchor="left"),
    author_style=TextStyle(
        font_family="Inter",
        font_size=16.0,
        font_weight="normal",
        color="#CCCCCC",
        effects=TextEffects(
            shadow_color="rgba(0,0,0,0.0)",
            shadow_offset_x=0.0,
            shadow_offset_y=0.0,
            shadow_blur=0.0,
            opacity=0.9,
        ),
    ),
    spine_font="Inter",
    spine_color="#FFFFFF",
)


# Template registry
TEMPLATES: dict[str, CoverTemplate] = {
    "classic": TEMPLATE_CLASSIC,
    "modern": TEMPLATE_MODERN,
    "bold": TEMPLATE_BOLD,
    "elegant": TEMPLATE_ELEGANT,
    "minimal": TEMPLATE_MINIMAL,
}

DEFAULT_TEMPLATE_ID = "classic"


def get_template(template_id: str) -> CoverTemplate:
    """Get a template by ID. Falls back to classic if not found."""
    logger.debug("get_template: id=%s", template_id)
    template = TEMPLATES.get(template_id, TEMPLATES[DEFAULT_TEMPLATE_ID])
    logger.debug("get_template: returning '%s'", template.name)
    return template


def list_templates() -> list[dict]:
    """Return all templates as serializable dicts for the API."""
    logger.debug("list_templates: returning %d templates", len(TEMPLATES))
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "title_position": {"x": t.title_position.x_pct, "y": t.title_position.y_pct, "anchor": t.title_position.anchor},
            "title_style": {
                "font_family": t.title_style.font_family,
                "font_size": t.title_style.font_size,
                "font_weight": t.title_style.font_weight,
                "font_style": t.title_style.font_style,
                "color": t.title_style.color,
            },
            "author_position": {"x": t.author_position.x_pct, "y": t.author_position.y_pct, "anchor": t.author_position.anchor},
            "author_style": {
                "font_family": t.author_style.font_family,
                "font_size": t.author_style.font_size,
                "font_weight": t.author_style.font_weight,
                "font_style": t.author_style.font_style,
                "color": t.author_style.color,
            },
        }
        for t in TEMPLATES.values()
    ]
