# Technical Design Document

## Overview

The Cover Service module provides AI-powered cover art generation, an interactive cover builder interface, and back cover copy generation for C.W.'s O-POD. It integrates with the AI Engine module for text analysis and image generation, uses PyCairo for print-ready PDF assembly (CMYK color space with bleed), and provides a Fabric.js-based frontend canvas editor with a template system for drag-and-drop cover composition.

The module is split into backend services (PromptGenerator, ImageGenerator, BlurbGenerator, CoverAssembler) and a frontend component (CoverBuilder). The backend handles AI interactions and PDF production, while the frontend provides the interactive editing experience.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   CoverBuilder (Fabric.js)                 │  │
│  │  - Canvas editor with drag-and-drop                       │  │
│  │  - Template selector and text overlay controls            │  │
│  │  - Real-time preview (front, spine, back)                 │  │
│  │  - Image placement and positioning                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │PromptGenerator│  │ImageGenerator│  │   BlurbGenerator     │  │
│  │- Text analysis│  │- AI image gen│  │- Synopsis generation │  │
│  │- 10 prompts  │  │- 1600×2400px │  │- 100-250 words       │  │
│  │- Spoiler-free│  │- Regeneration│  │- Spoiler-free        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                      │              │
│         ▼                  ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    AI Engine (AIRouter)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   CoverAssembler (PyCairo)               │    │
│  │  - CMYK PDF generation with 3mm bleed                   │    │
│  │  - Spine width calculation                               │    │
│  │  - Front + spine + back cover spread                    │    │
│  │  - QR code rendering (python-qrcode)                    │    │
│  │  - 300 DPI minimum output                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### PromptGenerator

Analyzes book text using the AI Engine's text generation capability to produce spoiler-free image prompts suitable for cover art.

```python
class PromptGenerator:
    """Generates spoiler-free cover art prompts from book text analysis."""

    def __init__(self, ai_router: AIRouter):
        self.ai_router = ai_router

    async def generate_prompts(self, book_text: str, title: str, author: str) -> list[str]:
        """Analyze book text and produce 10 spoiler-free image prompts.

        Args:
            book_text: The full text of the book (or representative excerpt).
            title: Book title for context.
            author: Book author for context.

        Returns:
            List of 10 image prompt strings.

        Raises:
            CoverServiceError: On AI failure or timeout (120s).
        """
        ...

    def _build_system_prompt(self) -> str:
        """Build the system prompt enforcing spoiler-free, visual-only descriptions."""
        return """You are a book cover art director. Analyze the provided text and generate
        exactly 10 image prompts for potential book cover art. Each prompt must:
        - Describe a visual scene, mood, or symbolic imagery (NOT literal plot events)
        - Be completely spoiler-free (no plot twists, endings, character deaths, revelations)
        - Be suitable for AI image generation (descriptive, atmospheric, artistic)
        - Focus on themes, settings, emotions, or symbolic elements from the text
        Return exactly 10 prompts, one per line, numbered 1-10."""

    def _parse_prompts(self, raw_response: str) -> list[str]:
        """Parse numbered prompts from AI response."""
        ...
```

- Uses a carefully crafted system prompt to enforce spoiler-free constraints
- Sends a representative excerpt of the book text (first 10,000 tokens) to stay within context limits
- Parses the AI response to extract exactly 10 numbered prompts
- Timeout: 120 seconds (enforced by AI Engine)

### ImageGenerator

Uses the AI Engine's image generation capability to produce candidate cover images from prompts.

```python
class ImageGenerator:
    """Generates cover images from prompts via the AI Engine."""

    def __init__(self, ai_router: AIRouter, storage_path: str):
        self.ai_router = ai_router
        self.storage_path = storage_path

    async def generate_images(self, prompts: list[str], project_id: UUID) -> list[GeneratedImage]:
        """Generate one image per prompt at 1600×2400px minimum.

        Args:
            prompts: List of image prompts.
            project_id: The book project ID for storage association.

        Returns:
            List of GeneratedImage results (path + metadata).
        """
        ...

    async def regenerate_image(
        self, prompt_id: UUID, new_prompt_text: str, session: CoverSession
    ) -> GeneratedImage:
        """Regenerate a single image with an edited prompt.

        Args:
            prompt_id: The CoverPrompt ID to regenerate.
            new_prompt_text: The user-edited prompt text.
            session: Current cover session (tracks regeneration count).

        Returns:
            New GeneratedImage result.

        Raises:
            RegenerationLimitError: If 20 regenerations already used in session.
            CoverServiceError: On AI failure.
        """
        ...

    async def validate_upload(self, file_data: bytes, filename: str) -> UploadValidation:
        """Validate an uploaded cover image meets requirements.

        Checks: format (PNG/JPEG), size (≤25MB), resolution (≥1600×2400px).
        """
        ...
```

- Generates images at 1600×2400px (portrait book cover ratio)
- Stores generated images to the configured storage path
- Tracks regeneration count per session (max 20)
- Validates uploaded images against format, size, and resolution requirements

### BlurbGenerator

Generates spoiler-free back cover synopses using the AI Engine's text generation capability.

```python
class BlurbGenerator:
    """Generates spoiler-free back cover synopses."""

    def __init__(self, ai_router: AIRouter):
        self.ai_router = ai_router

    async def generate_blurb(self, book_text: str, title: str, author: str) -> str:
        """Generate a spoiler-free synopsis of 100-250 words.

        Args:
            book_text: The full text of the book (or representative excerpt).
            title: Book title for context.
            author: Book author for context.

        Returns:
            Synopsis text (100-250 words).

        Raises:
            CoverServiceError: On AI failure or timeout (30s).
        """
        ...

    def _build_system_prompt(self) -> str:
        """Build system prompt for synopsis generation."""
        return """You are a professional book copywriter. Write a compelling back cover
        synopsis for the provided book. The synopsis must:
        - Be between 100 and 250 words
        - Be completely spoiler-free (no plot twists, endings, or major revelations)
        - Hook the reader and create intrigue without giving away the story
        - Be written in third person present tense
        - Focus on the premise, main character's situation, and central conflict
        Return ONLY the synopsis text, no additional commentary."""

    def validate_blurb_length(self, text: str) -> bool:
        """Validate blurb is within 500-word maximum for user-edited content."""
        word_count = len(text.split())
        return word_count <= 500
```

- Uses a 30-second timeout (text generation timeout from AI Engine)
- System prompt enforces spoiler-free constraints and word count range
- User-edited content allows up to 500 words (relaxed from the 250-word AI generation limit)

### CoverAssembler (Backend)

Assembles the final print-ready PDF cover using PyCairo, producing a CMYK PDF with proper bleed margins and spine calculation.

```python
class CoverAssembler:
    """Assembles print-ready cover PDFs using PyCairo."""

    # Paper stock thickness constants (mm per sheet, both sides)
    PAPER_THICKNESS = {
        "standard_white": 0.1,      # 80gsm white offset
        "cream": 0.11,              # 80gsm cream/natural
        "premium_white": 0.12,      # 100gsm premium white
        "heavy": 0.14,              # 120gsm heavy stock
    }
    COVER_BOARD_THICKNESS = 0.6  # mm, standard paperback cover board (both sides)
    BLEED_MM = 3.0               # 3mm bleed on all edges
    MIN_DPI = 300

    def __init__(self, storage_path: str):
        self.storage_path = storage_path

    def calculate_spine_width(self, page_count: int, paper_stock: str = "standard_white") -> float:
        """Calculate spine width in mm.

        Formula: spine_width = (page_count × paper_thickness) + cover_board_thickness

        Args:
            page_count: Total number of interior pages.
            paper_stock: Paper stock identifier.

        Returns:
            Spine width in millimeters.
        """
        paper_thickness = self.PAPER_THICKNESS.get(paper_stock, 0.1)
        return (page_count * paper_thickness) + self.COVER_BOARD_THICKNESS

    async def assemble_cover(self, layout: CoverLayout, project: BookProject) -> bytes:
        """Assemble the final print-ready cover PDF.

        Args:
            layout: The CoverLayout with all element positions and content.
            project: The book project (for page count, paper stock).

        Returns:
            PDF bytes of the assembled cover.

        Raises:
            CoverValidationError: If required elements are missing.
            CoverAssemblyError: On rendering failure.
        """
        ...

    def _validate_layout(self, layout: CoverLayout) -> list[str]:
        """Validate all required elements are present.

        Required: front cover image, title text, author text.
        Returns list of missing element names (empty if valid).
        """
        ...

    def _validate_image_resolution(self, image_path: str) -> bool:
        """Check image meets 300 DPI minimum at the target print size."""
        ...

    def _render_front_cover(self, ctx: cairo.Context, layout: CoverLayout) -> None:
        """Render front cover panel with image and text overlays."""
        ...

    def _render_spine(self, ctx: cairo.Context, layout: CoverLayout, spine_width: float) -> None:
        """Render spine panel with title and author text."""
        ...

    def _render_back_cover(self, ctx: cairo.Context, layout: CoverLayout) -> None:
        """Render back cover with synopsis, QR code, and link."""
        ...

    def _generate_qr_code(self, url: str, size_cm: float = 2.0) -> bytes:
        """Generate QR code image at specified size (min 2cm×2cm)."""
        ...
```

- Uses PyCairo's PDF surface for vector-quality output
- Converts RGB images to CMYK color space using ICC profiles
- Applies 3mm bleed on all edges of the full spread
- Spine width calculated from page count × paper thickness + cover board
- QR code generated using python-qrcode library at minimum 2cm×2cm
- Back cover layout: synopsis (top) → QR code (middle) → link (bottom)

### CoverBuilder (Frontend)

Fabric.js-based canvas editor providing drag-and-drop cover composition with templates and real-time preview.

```typescript
// CoverBuilder.svelte - Main component structure

interface CoverBuilderState {
  canvas: fabric.Canvas;
  selectedTemplate: CoverTemplate;
  frontCoverImage: fabric.Image | null;
  titleText: fabric.IText;
  authorText: fabric.IText;
  spineWidth: number;  // calculated from page count
  previewMode: 'edit' | 'preview';
  regenerationCount: number;
  maxRegenerations: number;  // 20
}

interface TextOverlayConfig {
  content: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;       // 8-200pt
  color: string;          // hex color
  shadow: ShadowConfig | null;
  outline: OutlineConfig | null;
  opacity: number;        // 0-1
}

interface ShadowConfig {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
}

interface OutlineConfig {
  color: string;
  width: number;
}
```

**Key behaviors:**
- Canvas renders at print dimensions (scaled for screen display)
- Template selection applies default positions for title/author text
- Text elements are draggable and editable directly on canvas
- Real-time preview shows front, spine, and back cover panels
- Spine width updates dynamically when page count changes
- Character limits enforced: title ≤ 100 chars, author ≤ 60 chars
- Image resolution validated on placement (warns if < 300 DPI at print size)

### CoverTemplate

Pre-built layout configurations for cover text positioning and styling.

```typescript
interface CoverTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  titlePosition: { x: number; y: number; anchor: 'top' | 'center' | 'bottom' };
  titleStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    effects: TextEffects;
  };
  authorPosition: { x: number; y: number; anchor: 'top' | 'center' | 'bottom' };
  authorStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    effects: TextEffects;
  };
  spineStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
  };
}

interface TextEffects {
  shadow: ShadowConfig | null;
  outline: OutlineConfig | null;
  opacity: number;
}
```

**Default templates (5 minimum):**
1. **Classic** - Centered title top, author bottom, serif font, no effects
2. **Modern** - Left-aligned title center, author bottom-left, sans-serif, subtle shadow
3. **Bold** - Large centered title with outline, author small at bottom
4. **Elegant** - Right-aligned title upper-third, author lower-third, italic serif, opacity overlay
5. **Minimal** - Small title bottom-left, author below title, clean sans-serif, high contrast

### API Endpoints

#### POST /api/projects/{project_id}/cover/generate-prompts

Initiates AI analysis of book text and generates 10 spoiler-free image prompts.

**Request:** No body (uses project's stored book text)

**Response (200):**
```json
{
  "prompts": [
    {"id": "uuid", "prompt_text": "A misty Victorian garden at dawn...", "index": 1},
    ...
  ],
  "count": 10
}
```

**Error (500):** `{"error": "AI generation failed", "reason": "timeout", "can_retry": true}`

#### POST /api/projects/{project_id}/cover/generate-images

Generates candidate cover images from stored prompts.

**Request:**
```json
{
  "prompt_ids": ["uuid1", "uuid2", ...]
}
```

**Response (200):**
```json
{
  "images": [
    {"prompt_id": "uuid", "image_url": "/storage/covers/...", "width": 1600, "height": 2400},
    ...
  ]
}
```

#### POST /api/projects/{project_id}/cover/regenerate-image

Regenerates a single image with an edited prompt.

**Request:**
```json
{
  "prompt_id": "uuid",
  "new_prompt_text": "A dark forest with golden light filtering through..."
}
```

**Response (200):**
```json
{
  "prompt_id": "uuid",
  "image_url": "/storage/covers/...",
  "regenerations_used": 5,
  "regenerations_remaining": 15
}
```

**Error (429):** `{"error": "Regeneration limit reached", "max": 20}`

#### POST /api/projects/{project_id}/cover/generate-blurb

Generates a spoiler-free back cover synopsis.

**Request:** No body (uses project's stored book text)

**Response (200):**
```json
{
  "blurb": "In the heart of Victorian London, a young woman discovers...",
  "word_count": 187
}
```

#### POST /api/projects/{project_id}/cover/upload-image

Uploads a user-provided cover image.

**Request:** Multipart form data with image file

**Response (200):**
```json
{
  "image_url": "/storage/covers/...",
  "width": 2000,
  "height": 3000,
  "format": "png",
  "size_bytes": 5242880
}
```

**Error (422):**
```json
{
  "error": "Image validation failed",
  "details": ["Resolution below minimum (1600×2400px)", "Current: 800×1200px"]
}
```

#### POST /api/projects/{project_id}/cover/assemble

Assembles the final print-ready cover PDF from the current layout.

**Request:**
```json
{
  "layout_id": "uuid",
  "paper_stock": "standard_white"
}
```

**Response (200):**
```json
{
  "pdf_url": "/storage/covers/project_id/final_cover.pdf",
  "dimensions": {
    "width_mm": 326.6,
    "height_mm": 234,
    "spine_width_mm": 12.6,
    "bleed_mm": 3
  }
}
```

**Error (422):**
```json
{
  "error": "Missing required elements",
  "missing": ["front_cover_image", "title_text"]
}
```

#### GET /api/projects/{project_id}/cover/pdf

Downloads the assembled cover PDF.

**Response:** Binary PDF file with `Content-Type: application/pdf`

## Data Models

### CoverPrompt (existing - backend/app/models/cover.py)

```python
class CoverPrompt(Base, TimestampMixin):
    __tablename__ = "cover_prompts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected: Mapped[bool] = mapped_column(Boolean, default=False)
```

### CoverLayout (existing - backend/app/models/cover.py)

```python
class CoverLayout(Base, TimestampMixin):
    __tablename__ = "cover_layouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    template_id: Mapped[str] = mapped_column(Text, nullable=False)
    layout_json: Mapped[dict] = mapped_column(JSONB, default=dict)
```

### CoverSession (new - to be added)

```python
class CoverSession(Base, TimestampMixin):
    __tablename__ = "cover_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    regeneration_count: Mapped[int] = mapped_column(Integer, default=0)
    max_regenerations: Mapped[int] = mapped_column(Integer, default=20)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

### CoverTemplate (stored as JSON configuration)

```python
# backend/app/services/cover/templates.py
COVER_TEMPLATES = [
    {
        "id": "classic",
        "name": "Classic",
        "description": "Centered title top, author bottom, serif font",
        "title_position": {"x": 0.5, "y": 0.15, "anchor": "center"},
        "title_style": {"font_family": "Garamond", "font_size": 72, "color": "#FFFFFF",
                        "effects": {"shadow": {"color": "#000000", "offset_x": 2, "offset_y": 2, "blur": 4},
                                    "outline": None, "opacity": 1.0}},
        "author_position": {"x": 0.5, "y": 0.85, "anchor": "center"},
        "author_style": {"font_family": "Garamond", "font_size": 36, "color": "#FFFFFF",
                         "effects": {"shadow": {"color": "#000000", "offset_x": 1, "offset_y": 1, "blur": 2},
                                     "outline": None, "opacity": 1.0}},
        "spine_style": {"font_family": "Garamond", "font_size": 12, "color": "#FFFFFF"},
    },
    # ... 4 more templates (Modern, Bold, Elegant, Minimal)
]
```

### layout_json Schema

The `layout_json` field in CoverLayout stores the complete cover state:

```json
{
  "front_cover": {
    "image_path": "/storage/covers/.../selected.png",
    "image_scale": 1.0,
    "image_offset": {"x": 0, "y": 0}
  },
  "title": {
    "text": "The Great Adventure",
    "x": 0.5, "y": 0.15,
    "font_family": "Garamond",
    "font_size": 72,
    "color": "#FFFFFF",
    "effects": {"shadow": {...}, "outline": null, "opacity": 1.0}
  },
  "author": {
    "text": "Jane Smith",
    "x": 0.5, "y": 0.85,
    "font_family": "Garamond",
    "font_size": 36,
    "color": "#FFFFFF",
    "effects": {"shadow": {...}, "outline": null, "opacity": 1.0}
  },
  "back_cover": {
    "blurb": "In the heart of...",
    "qr_url": "https://cwopod.app",
    "link_text": "Made with C.W.'s O-POD"
  },
  "spine": {
    "title": "The Great Adventure",
    "author": "Jane Smith"
  }
}
```

## Correctness Properties

### Property 1: Spoiler-Free Prompt Generation

All generated image prompts must describe visual scenes, moods, or symbolic imagery without revealing plot twists, endings, character deaths, or major story revelations. The system prompt must explicitly constrain the AI to produce only spoiler-free, visually descriptive prompts.

**Validates: Requirements 1.2, 1.3**

### Property 2: Prompt Count and Timing

The PromptGenerator must produce exactly 10 prompts per generation request and complete within 120 seconds. If fewer than 10 are returned, the system must still present available prompts rather than failing silently.

**Validates: Requirements 1.1, 1.5**

### Property 3: Image Resolution Minimum

Every generated or uploaded cover image must meet the minimum resolution of 1600×2400 pixels. Images below this threshold must be rejected with a clear error message. The CoverAssembler must additionally validate 300 DPI at the target print size.

**Validates: Requirements 2.1, 3.4, 3.7, 5.7**

### Property 4: Regeneration Limit Enforcement

The system must track regeneration count per cover session and enforce a hard maximum of 20 regenerations. Once the limit is reached, all further regeneration requests must be rejected. The count must persist across page reloads within the same session.

**Validates: Requirements 2.4, 2.5**

### Property 5: Upload Validation Completeness

Every uploaded image must be validated against all three criteria (format: PNG/JPEG only, size: ≤25MB, resolution: ≥1600×2400px) before acceptance. Failure on any criterion must result in rejection with a specific error message identifying the failed criterion.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

### Property 6: Print-Ready PDF Specifications

The assembled cover PDF must always have: 3mm bleed on all edges, CMYK color space, minimum 300 DPI resolution, and correct spine width calculated from page count and paper stock. The PDF must contain front cover, spine, and back cover as a continuous spread.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 7: Required Elements Validation

PDF generation must be blocked when any required element (front cover image, title text, author text) is missing. The system must identify all missing elements in the error response, not just the first one found.

**Validates: Requirements 5.6**

### Property 8: Spine Width Calculation Accuracy

Spine width must be calculated using the formula: spine_width = (page_count × paper_thickness) + cover_board_thickness. The calculation must use the correct paper thickness constant for the selected paper stock and must produce consistent results for the same inputs.

**Validates: Requirements 5.4, 6.2**

### Property 9: Back Cover Synopsis Constraints

Generated synopses must be between 100 and 250 words and spoiler-free. User-edited back cover copy must not exceed 500 words. The system must validate word count before accepting edits.

**Validates: Requirements 7.1, 7.2, 7.4**

### Property 10: Back Cover Layout Order

The back cover must always render elements in top-to-bottom order: synopsis text area (top), QR code (middle), application link (bottom). The QR code must be at least 2cm×2cm. This layout order must be maintained regardless of content length.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 11: Character Limit Enforcement

Title text must never exceed 100 characters and author text must never exceed 60 characters in the final assembled cover. Both frontend (input prevention) and backend (validation before PDF generation) must enforce these limits.

**Validates: Requirements 4.6, 4.7, 4.8**

## Error Handling

### AI Generation Failures

- **Prompt generation timeout (>120s):** Return error with `can_retry: true`, display message to user indicating AI service was slow
- **Image generation failure:** Report per-prompt failure, allow retry or prompt editing for the specific failed image; other successful images remain available
- **Blurb generation timeout (>30s):** Return error with `can_retry: true`, offer manual entry as alternative
- **AI Engine unavailable:** Surface the AI Engine's error message (provider unreachable, invalid key, etc.) and suggest checking AI configuration

### Upload Validation Errors

- **Wrong format:** "Unsupported image format. Please upload PNG or JPEG files."
- **File too large:** "Image exceeds 25 MB maximum. Current size: {size}MB."
- **Resolution too low:** "Image resolution ({width}×{height}px) is below the minimum 1600×2400px required for cover art."
- All validation errors are returned immediately before any processing occurs

### Cover Assembly Errors

- **Missing required elements:** Return list of all missing elements (not just first), prevent PDF generation
- **Low-resolution image warning:** Warn but allow user to proceed with confirmation
- **PyCairo rendering failure:** Log detailed error, return generic "Cover assembly failed" message with retry option
- **Invalid layout JSON:** Validate layout structure before assembly, return specific field errors

### Session and Limit Errors

- **Regeneration limit reached:** Return 429 with clear message: "Maximum 20 regenerations per session reached. Start a new cover generation session to get additional regenerations."
- **Session expired:** If cover session is no longer active, prompt user to start a new session

## Testing Strategy

### Unit Tests

- **PromptGenerator tests:**
  - Verify system prompt includes spoiler-free constraints
  - Verify prompt parsing extracts exactly 10 prompts from well-formed AI response
  - Verify handling of malformed AI responses (fewer than 10 prompts, empty response)
  - Verify 120-second timeout is enforced

- **ImageGenerator tests:**
  - Verify images are requested at 1600×2400px minimum
  - Verify regeneration counter increments correctly
  - Verify regeneration is blocked at count 20
  - Verify upload validation rejects wrong format, oversized, and low-res images
  - Verify upload validation accepts valid PNG and JPEG at correct resolution

- **BlurbGenerator tests:**
  - Verify system prompt includes spoiler-free and word count constraints
  - Verify generated blurb word count is validated (100-250 words)
  - Verify user-edited blurb rejects content over 500 words
  - Verify 30-second timeout is enforced

- **CoverAssembler tests:**
  - Verify spine width calculation: `pages * thickness + board` for each paper stock
  - Verify spine width for known values (e.g., 200 pages × 0.1mm + 0.6mm = 20.6mm)
  - Verify PDF dimensions include 3mm bleed on all edges
  - Verify required element validation catches missing title, author, image
  - Verify QR code is generated at minimum 2cm×2cm
  - Verify back cover layout order (synopsis → QR → link)

- **Template tests:**
  - Verify all 5 default templates load correctly
  - Verify template positions are within valid bounds (0-1 normalized)
  - Verify template font sizes are within 8-200pt range

### Integration Tests

- **Full cover generation flow:**
  - Generate prompts → generate images → select image → apply template → customize text → assemble PDF
  - Verify PDF output has correct dimensions, CMYK color space, and 300 DPI

- **Upload flow:**
  - Upload valid image → place on canvas → assemble PDF
  - Upload invalid image → verify rejection with correct error

- **Regeneration flow:**
  - Regenerate images up to limit → verify 21st attempt is rejected
  - Edit prompt text → regenerate → verify new image uses edited prompt

- **Back cover flow:**
  - Generate blurb → edit text → verify in assembled PDF
  - Verify QR code is scannable in output PDF

### Frontend Tests

- **CoverBuilder component tests (Vitest + Testing Library):**
  - Template selection applies correct default positions
  - Character limits enforced on title (100) and author (60) inputs
  - Drag-and-drop repositions text elements correctly
  - Preview updates when layout changes
  - Regeneration counter displays correctly and disables button at limit

### Test Configuration

- AI Engine calls mocked using `MockTextProvider` and `MockImageProvider` from AI Engine module
- PyCairo tests use small canvas sizes for speed, verify structure not visual output
- Image validation tests use pre-prepared test images at various resolutions
- Frontend tests mock API calls and verify component behavior
