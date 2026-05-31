# Design: Typeset Service Module

## Overview

The Typeset Service module transforms book text into print-ready interior PDFs by detecting chapter structure, rendering parameterized Typst templates, and compiling the result via the Typst CLI. The module handles the complete typesetting pipeline: chapter detection (regex patterns + EPUB nav parsing), QR code generation for Info_Page and Attribution_Page, Typst source assembly from templates, and PDF compilation as a Celery background task.

The architecture separates concerns into four components: ChapterDetector (structure analysis), QRGenerator (image assets), TemplateRenderer (Typst source assembly), and PDFGenerator (compilation orchestration). Provider-specific formatting (trim sizes, margins, gutters, bleed) is driven by a configuration dictionary keyed by provider name.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       API Layer (FastAPI)                          │
│   POST /api/projects/{id}/typeset    GET /api/projects/{id}/interior-pdf │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PDFGenerator (Celery Task)                      │
│                                                                    │
│  1. Load project text (working_text_path or original_text_path)   │
│  2. Detect chapters via ChapterDetector                           │
│  3. Generate QR codes via QRGenerator                             │
│  4. Render Typst source via TemplateRenderer                      │
│  5. Compile Typst → PDF via typst CLI                             │
│  6. Store PDF and update project record                           │
└──────┬──────────────┬──────────────────┬─────────────────────────┘
       │              │                  │
       ▼              ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ChapterDetector│ │ QRGenerator  │ │ TemplateRenderer  │
│              │ │              │ │                    │
│- regex match │ │- info_page() │ │- render_front()    │
│- epub_nav()  │ │- attribution()│ │- render_body()    │
│- extract()   │ │              │ │- render_back()     │
└──────────────┘ └──────────────┘ │- render_full()     │
                                   └──────────────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  Provider Specs   │
                                   │  (config dict)    │
                                   │                   │
                                   │ - trim_width      │
                                   │ - trim_height     │
                                   │ - margin_top      │
                                   │ - margin_bottom   │
                                   │ - margin_outer    │
                                   │ - gutter          │
                                   │ - bleed           │
                                   └──────────────────┘
```

## Components and Interfaces

### ChapterDetector

Identifies chapter boundaries in source text using regex pattern matching and EPUB navigation metadata.

```python
# app/services/typeset/chapter_detector.py

import re
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Chapter:
    number: int           # Sequential chapter number (1-based)
    title: str            # Extracted chapter title (e.g., "The Beginning")
    heading: str          # Full original heading text (e.g., "CHAPTER I — The Beginning")
    content: str          # Full text content of the chapter
    start_position: int   # Character offset in original text

# Patterns ordered by specificity (most specific first)
CHAPTER_PATTERNS = [
    # "CHAPTER I — Title" or "CHAPTER 1 — Title" (with separator)
    re.compile(
        r'^(?:CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*[—\-:\.]\s*(.+)$',
        re.MULTILINE
    ),
    # "CHAPTER I" or "CHAPTER 1" (no title)
    re.compile(
        r'^(?:CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*$',
        re.MULTILINE
    ),
    # "Chapter One" or "CHAPTER ONE" (word numbers)
    re.compile(
        r'^(?:CHAPTER|Chapter)\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|'
        r'Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|'
        r'Twenty|Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety|'
        r'TWENTY|THIRTY|FORTY|FIFTY|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|'
        r'ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN'
        r'(?:[\s-](?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|'
        r'ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?)\s*[—\-:\.]\s*(.+)?$',
        re.MULTILINE
    ),
    # Standalone roman numerals on a line: "I.", "II.", "III."
    re.compile(r'^([IVXLCDM]+)\.\s*$', re.MULTILINE),
    # Standalone arabic numerals on a line: "1.", "2.", "3."
    re.compile(r'^(\d+)\.\s*$', re.MULTILINE),
]


class ChapterDetector:
    """Detects chapter boundaries in book text."""

    def detect(self, text: str, epub_nav: list[dict] | None = None) -> list[Chapter]:
        """
        Detect chapters in the given text.

        If epub_nav is provided (from EPUB toc/nav), use it as the primary
        source of chapter boundaries. Otherwise, fall back to regex pattern
        matching.

        Args:
            text: The full book text content
            epub_nav: Optional EPUB navigation entries, each with:
                      {"title": str, "href": str, "position": int}

        Returns:
            List of Chapter objects in document order.
            If no chapters detected, returns a single Chapter containing all text.
        """
        pass

    def _detect_from_epub_nav(self, text: str, nav_entries: list[dict]) -> list[Chapter]:
        """
        Use EPUB navigation/TOC entries to split text into chapters.
        Each nav entry provides a position and title.
        """
        pass

    def _detect_from_patterns(self, text: str) -> list[Chapter]:
        """
        Use regex patterns to detect chapter headings in plain text.
        Tries patterns in order of specificity.
        Uses the first pattern that produces at least 2 matches
        (to avoid false positives from single matches).
        Falls back to treating entire text as one chapter if no pattern matches.
        """
        pass

    def _extract_title(self, match: re.Match, pattern_index: int) -> str:
        """
        Extract a clean chapter title from a regex match.
        Handles cases with and without explicit titles after the number.
        """
        pass

    def _roman_to_int(self, roman: str) -> int:
        """Convert roman numeral string to integer."""
        pass
```

### QRGenerator

Creates QR code images for embedding in the Info_Page and Attribution_Page.

```python
# app/services/typeset/qr_generator.py

from pathlib import Path
import qrcode
from qrcode.image.pil import PilImage
from PIL import Image

# Minimum QR code size: 2cm × 2cm at 300 DPI = ~236 × 236 pixels
MIN_QR_SIZE_PX = 236


class QRGenerator:
    """Generates QR code images for book pages."""

    def generate_info_page_qr(self, app_url: str, output_dir: Path) -> Path:
        """
        Generate a QR code for the Info_Page linking to the C.W.'s O-POD app.

        Args:
            app_url: The URL to the C.W.'s O-POD application
            output_dir: Directory to save the QR code image

        Returns:
            Path to the generated QR code PNG image (minimum 236×236 px)
        """
        pass

    def generate_attribution_qr(self, source_url: str, output_dir: Path) -> Path:
        """
        Generate a QR code for the Attribution_Page linking to the source.

        Args:
            source_url: The URL to the original source text
            output_dir: Directory to save the QR code image

        Returns:
            Path to the generated QR code PNG image (minimum 236×236 px)
        """
        pass

    def _generate_qr(self, url: str, output_path: Path) -> Path:
        """
        Generate a QR code image encoding the given URL.

        - Uses error correction level H (30% recovery)
        - Output size: minimum 236×236 pixels (2cm at 300 DPI)
        - Format: PNG with white background
        - Box size and border tuned for print legibility
        """
        pass
```

### TemplateRenderer

Assembles complete Typst source from parameterized templates, chapter data, and provider specifications.

```python
# app/services/typeset/template_renderer.py

from dataclasses import dataclass
from pathlib import Path
from .chapter_detector import Chapter
from .provider_specs import ProviderSpec


@dataclass
class BookMetadata:
    title: str
    author: str
    source_name: str | None = None
    source_url: str | None = None
    original_publisher: str | None = None
    publication_year: str | None = None
    edition: str | None = None
    license_text: str | None = None
    app_url: str = ""


@dataclass
class TypesetAssets:
    info_qr_path: Path          # Path to Info_Page QR code image
    attribution_qr_path: Path   # Path to Attribution_Page QR code image
    image_paths: list[Path]     # Paths to any book illustrations


class TemplateRenderer:
    """Renders parameterized Typst source for book interior."""

    def render_full(
        self,
        chapters: list[Chapter],
        metadata: BookMetadata,
        provider_spec: ProviderSpec,
        assets: TypesetAssets,
    ) -> str:
        """
        Render the complete Typst source for the book interior.

        Assembles: document setup + front matter + body + back matter.
        Returns the full Typst source as a string.
        """
        pass

    def _render_document_setup(self, provider_spec: ProviderSpec) -> str:
        """
        Render the Typst document preamble with page dimensions,
        margins, fonts, and base styling.

        Sets:
        - Page width/height from provider_spec trim size
        - Margins (top, bottom, outer, gutter) from provider_spec
        - Base font (serif, 11pt for body)
        - Page numbering configuration
        """
        pass

    def _render_front_matter(self, metadata: BookMetadata, assets: TypesetAssets) -> str:
        """
        Render front matter pages in order:
        1. Half-title page (title only, centered)
        2. Blank verso
        3. Title page (title + author, centered)
        4. Copyright page (verso)
        5. Info_Page (recto) with app URL + QR code

        All pages numbered in roman numerals.
        Running headers suppressed.
        """
        pass

    def _render_body(self, chapters: list[Chapter], metadata: BookMetadata) -> str:
        """
        Render body text with:
        - Page counter reset to arabic 1
        - Each chapter starting on recto page (pagebreak to odd)
        - Chapter heading formatting (large, bold, centered)
        - Running headers: book title on verso, chapter title on recto
        - Running headers suppressed on chapter opening pages
        - Page numbers in footer
        - Images placed at or near original positions
        """
        pass

    def _render_back_matter(self, metadata: BookMetadata, assets: TypesetAssets) -> str:
        """
        Render back matter pages:
        1. Attribution_Page with source metadata + QR code
        2. License page (if license_text is present)

        Attribution_Page includes:
        - Source name, source URL
        - QR code encoding source URL
        - Original publisher, publication year, edition
        - Only displays fields that are available (non-None)
        """
        pass

    def _escape_typst(self, text: str) -> str:
        """Escape special Typst characters in text content."""
        pass

    def _render_image(self, image_path: Path, caption: str | None = None) -> str:
        """Render a Typst image inclusion with optional caption."""
        pass
```

### Typst Template Structure

The rendered Typst source follows this structure:

```typst
// === Document Setup ===
#set page(
  width: 5.5in,
  height: 8.5in,
  margin: (
    top: 0.75in,
    bottom: 0.75in,
    outside: 0.75in,
    inside: 0.875in,  // gutter
  ),
)
#set text(font: "Libertinus Serif", size: 11pt)
#set par(justify: true, leading: 0.65em)

// === Front Matter ===
#set page(numbering: "i")
// Half-title page
#page[
  #v(1fr)
  #align(center, text(size: 24pt, weight: "bold")[Book Title])
  #v(1fr)
]
// ... title page, copyright page, info page ...

// === Body ===
#set page(numbering: "1")
#counter(page).update(1)
#set page(
  header: context {
    let page-num = counter(page).get().first()
    if calc.odd(page-num) {
      align(right)[_Chapter Title_]
    } else {
      align(left)[_Book Title_]
    }
  },
  footer: context {
    align(center)[#counter(page).display()]
  },
)

// Chapter 1
#pagebreak(to: "odd")
#heading(level: 1)[Chapter Title]
// ... chapter content ...

// === Back Matter ===
// Attribution page
#pagebreak(to: "odd")
#heading(level: 1, outlined: false)[Attribution]
// ... source metadata, QR code, license ...
```

### PDFGenerator (Celery Task)

Orchestrates the full typesetting pipeline as a background task.

```python
# app/services/typeset/pdf_generator.py

import subprocess
from pathlib import Path
from uuid import UUID

from app.worker import celery_app
from app.config import settings
from .chapter_detector import ChapterDetector
from .qr_generator import QRGenerator
from .template_renderer import TemplateRenderer, BookMetadata, TypesetAssets
from .provider_specs import PROVIDER_SPECS


@celery_app.task(bind=True, name="typeset.generate_pdf")
def generate_pdf_task(
    self,
    project_id: str,
    user_id: str,
    provider: str = "lulu",
) -> dict:
    """
    Background task that generates a print-ready interior PDF.

    Pipeline:
    1. Load project data (text path, metadata, provider selection)
    2. Read text from working_text_path (or original_text_path if no working copy)
    3. Detect chapters using ChapterDetector
    4. Generate QR code images using QRGenerator
    5. Render Typst source using TemplateRenderer
    6. Write Typst source to temp file
    7. Compile Typst source to PDF using typst CLI
    8. Store PDF and update project.interior_pdf_path
    9. Return {"pdf_path": str, "page_count": int, "chapters_detected": int}

    Reports progress via self.update_state(state='PROGRESS', meta={...})
    Stages: DETECTING_CHAPTERS → RENDERING_TEMPLATE → COMPILING_PDF → COMPLETE

    Raises:
        TypesetError: If compilation fails (includes typst stderr)
    """
    pass


def compile_typst(source_path: Path, output_path: Path, font_paths: list[Path] | None = None) -> int:
    """
    Compile a Typst source file to PDF using the typst CLI.

    Args:
        source_path: Path to the .typ source file
        output_path: Path for the output .pdf file
        font_paths: Optional additional font directories

    Returns:
        Page count of the generated PDF

    Raises:
        TypesetCompilationError: If typst returns non-zero exit code,
                                 includes stderr output for debugging
    """
    pass


class TypesetCompilationError(Exception):
    """Raised when Typst compilation fails."""

    def __init__(self, message: str, stderr: str):
        self.message = message
        self.stderr = stderr
        super().__init__(f"{message}\n\nTypst output:\n{stderr}")
```

### Provider Specs Configuration

```python
# app/services/typeset/provider_specs.py

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderSpec:
    """Print provider page specifications."""
    name: str
    trim_width: float       # inches
    trim_height: float      # inches
    margin_top: float       # inches
    margin_bottom: float    # inches
    margin_outer: float     # inches
    gutter: float           # inches (inner margin for binding)
    bleed: float            # inches (extend beyond trim on all edges)
    min_page_count: int     # Minimum pages required by provider
    max_page_count: int     # Maximum pages allowed by provider


PROVIDER_SPECS: dict[str, ProviderSpec] = {
    "lulu": ProviderSpec(
        name="Lulu xPress",
        trim_width=5.5,
        trim_height=8.5,
        margin_top=0.75,
        margin_bottom=0.75,
        margin_outer=0.75,
        gutter=0.875,
        bleed=0.125,
        min_page_count=32,
        max_page_count=800,
    ),
    "bookvault": ProviderSpec(
        name="BookVault",
        trim_width=5.06,
        trim_height=7.81,
        margin_top=0.7,
        margin_bottom=0.7,
        margin_outer=0.7,
        gutter=0.8,
        bleed=0.118,  # 3mm
        min_page_count=24,
        max_page_count=600,
    ),
    "kdp": ProviderSpec(
        name="KDP Print",
        trim_width=5.5,
        trim_height=8.5,
        margin_top=0.75,
        margin_bottom=0.75,
        margin_outer=0.75,
        gutter=0.875,
        bleed=0.125,
        min_page_count=24,
        max_page_count=828,
    ),
}


def get_provider_spec(provider: str) -> ProviderSpec:
    """
    Get the ProviderSpec for the given provider key.

    Args:
        provider: Provider key ("lulu", "bookvault", "kdp")

    Returns:
        ProviderSpec for the provider

    Raises:
        ValueError: If provider key is not recognized
    """
    if provider not in PROVIDER_SPECS:
        raise ValueError(
            f"Unknown provider '{provider}'. "
            f"Supported providers: {', '.join(PROVIDER_SPECS.keys())}"
        )
    return PROVIDER_SPECS[provider]
```

### API Endpoints

```python
# app/routers/typeset.py

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from uuid import UUID

router = APIRouter(prefix="/api/projects/{project_id}", tags=["typeset"])


@router.post("/typeset", status_code=202)
async def start_typeset(
    project_id: UUID,
    body: TypesetRequest,
    user=Depends(get_current_user),
):
    """
    Initiate interior PDF generation for a project.

    Request body:
        {"provider": "lulu" | "bookvault" | "kdp"}

    - Validates project exists and belongs to user
    - Validates project has text (working_text_path or original_text_path)
    - Checks no typeset task is already running for this project
    - Dispatches generate_pdf_task to Celery
    - Returns: {"task_id": str, "status": "generating"}
    """
    pass


@router.get("/typeset/status")
async def get_typeset_status(
    project_id: UUID,
    user=Depends(get_current_user),
):
    """
    Get the current typeset task status for a project.

    Returns:
        {"status": "idle" | "generating" | "complete" | "failed",
         "progress": {"stage": str, "detail": str} | None,
         "error": str | None,
         "pdf_path": str | None,
         "page_count": int | None}
    """
    pass


@router.get("/interior-pdf")
async def download_interior_pdf(
    project_id: UUID,
    user=Depends(get_current_user),
):
    """
    Download the generated interior PDF for a project.

    - Validates project exists and belongs to user
    - Validates interior_pdf_path is set and file exists
    - Returns the PDF file as a download response
    - Returns 404 if PDF has not been generated yet
    """
    pass
```

### Request/Response Schemas

```python
# app/schemas/typeset.py

from pydantic import BaseModel
from typing import Literal


class TypesetRequest(BaseModel):
    provider: Literal["lulu", "bookvault", "kdp"] = "lulu"


class TypesetResponse(BaseModel):
    task_id: str
    status: str = "generating"


class TypesetStatusResponse(BaseModel):
    status: Literal["idle", "generating", "complete", "failed"]
    progress: dict | None = None
    error: str | None = None
    pdf_path: str | None = None
    page_count: int | None = None
```

## Data Models

### BookProject Fields Used

```python
class BookProject:
    # Fields relevant to Typeset Service:
    id: UUID
    user_id: UUID
    title: str
    author: str
    original_text_path: str       # Path to original ingested text
    working_text_path: str | None # Path to corrected text (from Quality Controller)
    interior_pdf_path: str | None # Path to generated interior PDF (set by this module)
    page_count: int | None        # Page count of generated PDF (set by this module)
    provider: str                 # Selected print provider key
    source_type: str              # Source type (gutenberg, standard_ebooks, upload)
    source_url: str | None        # URL to original source
    source_name: str | None       # Name of the source
    original_publisher: str | None
    publication_year: str | None
    edition: str | None
    license_text: str | None      # Source-provided license text
    epub_nav: list[dict] | None   # EPUB navigation entries (if source was EPUB)
```

### Typeset Task State

The Celery task uses built-in state tracking:
- `PENDING` → task queued
- `STARTED` → task picked up by worker
- `PROGRESS` → custom state with `{"stage": str, "detail": str}`
  - Stages: `"detecting_chapters"`, `"generating_qr_codes"`, `"rendering_template"`, `"compiling_pdf"`
- `SUCCESS` → generation complete with `{"pdf_path": str, "page_count": int, "chapters_detected": int}`
- `FAILURE` → generation failed with error details (includes Typst stderr if compilation error)

## Correctness Properties

### Property 1: Font Embedding Completeness

Every generated PDF must have all fonts fully embedded. No font references in the PDF may rely on system fonts or external font files at render time.

**Validates: Requirements 1.1**

### Property 2: Page Dimension Conformance

For any generated PDF, every page must have dimensions matching the selected provider's trim size (width × height) within a tolerance of 0.01 inches. Margins must match the provider spec.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Chapter Recto Start

For any book with multiple chapters, every chapter's first page must be an odd-numbered page (recto). If the preceding content ends on an odd page, a blank even page must be inserted before the next chapter.

**Validates: Requirements 4.1**

### Property 4: Page Numbering Scheme

Front matter pages must be numbered in roman numerals. The first page of the first chapter must be arabic numeral 1. Page numbers must be sequential within each numbering scheme with no gaps or duplicates.

**Validates: Requirements 5.2, 5.5**

### Property 5: Running Header Correctness

For any page in the body: verso pages must display the book title in the header, recto pages must display the current chapter title in the header. Chapter opening pages and front matter pages must have no running header.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 6: Source Text Immutability

The file at the project's text path (original_text_path or working_text_path) must never be modified by any operation in this module. Reading the source text before and after PDF generation must yield identical content.

**Validates: Requirements 9.2**

### Property 7: QR Code Minimum Size

All QR codes in the generated PDF (Info_Page and Attribution_Page) must be at least 2 cm × 2 cm (approximately 0.79 inches × 0.79 inches) when rendered at the page's actual dimensions.

**Validates: Requirements 5.4, 7.5**

### Property 8: Attribution Completeness

For any project with source metadata, the Attribution_Page must include all non-None metadata fields. No available metadata field may be silently omitted. Fields that are None must not appear as empty placeholders.

**Validates: Requirements 7.2, 7.3**

### Property 9: Image Resolution Floor

All images included in the PDF output must be at minimum 300 DPI relative to their rendered size on the page. Images below 300 DPI in the source must still be included (not omitted) with a logged warning.

**Validates: Requirements 1.2, 8.2, 8.3**

### Property 10: Concurrent Task Prevention

For any given project, at most one typeset task may be in a non-terminal state (PENDING, STARTED, or PROGRESS) at any time. Attempts to start a second concurrent task must be rejected.

**Validates: Requirements 10.5**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Project has no text path set | Return 400: "Project has no text to typeset" |
| Project not found or not owned by user | Return 404 |
| Unknown provider key | Return 400: "Unknown provider. Supported: lulu, bookvault, kdp" |
| Typeset task already running for project | Return 409: "Typeset already in progress" |
| Text file not found at path | Task fails with: "Source text file not found at {path}" |
| Typst compilation error | Task fails with: "Typst compilation failed: {stderr}" |
| Typst CLI not installed | Task fails with: "Typst compiler not found. Ensure typst is installed." |
| QR code generation fails | Task fails with: "Failed to generate QR code: {error}" |
| Interior PDF requested but not generated | Return 404: "Interior PDF not yet generated" |
| Interior PDF file missing from disk | Return 500: "Interior PDF file not found. Please regenerate." |
| Image below 300 DPI in source | Log warning, include image at original resolution, continue |
| No chapters detected | Treat entire text as single chapter, log info, continue |
| Empty text file | Task fails with: "Source text is empty" |
| File I/O error writing Typst source | Task fails with I/O error details |
| Typst output exceeds provider max page count | Task succeeds but returns warning in result |

## Testing Strategy

### Unit Tests

- **ChapterDetector patterns**: Test each regex pattern against known chapter heading formats (roman numerals, arabic, word numbers, with/without titles, with various separators)
- **ChapterDetector EPUB nav**: Test chapter splitting from EPUB navigation entries
- **ChapterDetector fallback**: Test that undetectable text returns single chapter
- **QRGenerator**: Verify generated QR images are valid PNGs at minimum 236×236 px, and encode the correct URL
- **TemplateRenderer**: Verify rendered Typst source contains correct page setup, front matter structure, chapter breaks, running headers, and back matter
- **Provider specs**: Verify all provider specs have valid positive dimensions and page count ranges
- **Typst escaping**: Test that special characters in text are properly escaped

### Integration Tests

- **Full pipeline**: Ingest text → detect chapters → render template → compile PDF → verify PDF exists and has expected page count
- **Provider switching**: Generate PDF for one provider, switch provider, regenerate → verify dimensions change
- **Re-generation**: Generate PDF → update text → regenerate → verify new PDF reflects changes
- **Error recovery**: Simulate Typst failure → verify error reported → fix issue → retry succeeds
- **API flow**: POST /typeset → poll status → GET /interior-pdf → verify PDF download

### Property-Based Tests

- **Chapter detection coverage**: For any text with N inserted chapter headings, the detector finds exactly N chapters
- **Recto start**: For any generated PDF with multiple chapters, verify all chapter starts are on odd pages
- **Source immutability**: For any typeset operation, verify source text file is byte-identical before and after
- **Provider dimension conformance**: For any provider, verify generated PDF page dimensions match spec within tolerance
- **QR size minimum**: For any generated QR code image, verify dimensions ≥ 236×236 pixels
