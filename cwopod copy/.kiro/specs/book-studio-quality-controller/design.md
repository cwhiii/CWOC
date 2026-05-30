# Design: Quality Controller Module

## Overview

The Quality Controller module provides optional LLM-based typo detection for book texts. It chunks the full text into manageable segments, sends each to the AI Engine with a strictly constrained system prompt, collects suspected typos, and presents them for user review. Users accept or reject individual corrections (or use bulk actions), then apply accepted corrections to a working copy while preserving the original text.

The module integrates with the existing Celery task infrastructure for background scanning and exposes REST API endpoints for triggering scans, reviewing corrections, and applying accepted changes.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (FastAPI)                    │
│  POST /scan-typos  GET /corrections  PATCH /corrections  │
│                  POST /corrections/apply                  │
└──────────┬──────────────────┬───────────────────┬────────┘
           │                  │                   │
           ▼                  ▼                   ▼
┌──────────────────┐ ┌────────────────┐ ┌─────────────────┐
│   TypoScanner    │ │CorrectionReview│ │CorrectionApplier│
│  (Celery Task)   │ │   (Service)    │ │    (Service)    │
│                  │ │                │ │                 │
│ - chunk_text()   │ │ - list()       │ │ - apply()       │
│ - scan_chunk()   │ │ - accept()     │ │ - validate()    │
│ - merge_results()│ │ - reject()     │ │ - write_copy()  │
└────────┬─────────┘ │ - bulk_accept()│ └─────────────────┘
         │           │ - bulk_reject()│
         ▼           └────────────────┘
┌──────────────────┐
│    AI Engine     │
│  (text generation│
│   with strict    │
│   system prompt) │
└──────────────────┘
```

The system uses a strict separation between scanning (background), reviewing (synchronous API), and applying (synchronous API with file I/O).

## Components and Interfaces

### TypoScanner

The TypoScanner is a Celery task that performs the actual typo detection by chunking text and sending it to the AI Engine.

```python
# app/services/quality_controller/scanner.py

from app.worker import celery_app
from app.services.ai_engine import AIRouter

CHUNK_SIZE = 2000  # words
CHUNK_OVERLAP = 100  # words overlap between chunks

@celery_app.task(bind=True, name="quality_controller.scan_typos")
def scan_typos_task(self, project_id: str, user_id: str) -> dict:
    """
    Background task that scans a project's text for typos.
    
    1. Load the project's original_text_path
    2. Chunk the text into ~2000-word segments with 100-word overlap
    3. Send each chunk to AI Engine with the typo detection system prompt
    4. Parse AI responses into Correction records
    5. Deduplicate corrections from overlapping regions
    6. Store all corrections in the database with status=PENDING
    7. Report progress via Celery task state
    
    Returns: {"corrections_found": int, "chunks_processed": int}
    """
    pass


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """
    Split text into word-based chunks with overlap.
    
    Returns list of:
        {"text": str, "start_position": int, "end_position": int, "word_offset": int}
    
    The overlap ensures typos at chunk boundaries are not missed.
    Position tracking uses character offsets into the original text.
    """
    pass


def build_system_prompt() -> str:
    """
    Returns the strictly constrained system prompt for typo detection.
    See TYPO_DETECTION_SYSTEM_PROMPT below.
    """
    pass


def parse_ai_response(response: str, chunk_start_position: int) -> list[dict]:
    """
    Parse the AI Engine's JSON response into correction candidates.
    
    Expected AI response format:
    [
        {
            "original": "teh",
            "suggested": "the",
            "context": "He walked to teh store.",
            "position_in_chunk": 142
        }
    ]
    
    Converts position_in_chunk to absolute position in full text.
    Returns empty list if response is empty or unparseable.
    """
    pass


def deduplicate_corrections(corrections: list[dict]) -> list[dict]:
    """
    Remove duplicate corrections from overlapping chunk regions.
    Two corrections are duplicates if they have the same original text
    and their positions are within CHUNK_OVERLAP words of each other.
    """
    pass
```

### Typo Detection System Prompt

```python
TYPO_DETECTION_SYSTEM_PROMPT = """You are a typo detection assistant. Your ONLY job is to find typographical errors in text.

## What IS a typo (report these):
- Misspelled words: "recieve" → "receive", "accomodate" → "accommodate"
- Transposed characters: "teh" → "the", "adn" → "and", "form" → "from" (when context shows it should be "from")
- Repeated words: "the the", "is is", "and and"
- Missing spaces between words: "ofthe" → "of the" (only when clearly two words run together)
- Extra spaces within words: "to gether" → "together"

## What is NOT a typo (DO NOT report these):
- Archaic spellings: "shew", "connexion", "phantasy", "to-day", "any one"
- Regional variants: "colour/color", "honour/honor", "realise/realize", "grey/gray"
- Intentional stylistic choices: unusual capitalization for emphasis, creative spelling in dialogue
- Dialect or vernacular: "'twas", "gonna", "ain't", "y'all"
- Grammar issues: subject-verb disagreement, comma splices, run-on sentences
- Style preferences: Oxford comma usage, semicolon vs. em-dash, sentence length
- Word choice: even if a different word might be "better", do not suggest it
- Punctuation style: do not change dashes, ellipses, or quotation mark styles
- Proper nouns or invented words: character names, place names, made-up terms

## Rules:
1. ONLY report items from the "What IS a typo" list above
2. NEVER suggest changes to grammar, style, meaning, or word choice
3. When in doubt, DO NOT report it — false negatives are acceptable, false positives are not
4. Return an empty list if no typos are found
5. For each typo found, provide the exact original text, your suggested correction, the full sentence containing the typo, and the character position within the provided chunk

## Response format (JSON array):
[
    {
        "original": "the misspelled word or phrase",
        "suggested": "the corrected version",
        "context": "The full sentence containing the typo.",
        "position_in_chunk": 142
    }
]

If no typos are found, respond with: []
"""
```

### CorrectionReview Service

```python
# app/services/quality_controller/review.py

from uuid import UUID
from app.models.correction import Correction, CorrectionStatus

class CorrectionReviewService:
    """Service for managing correction review operations."""
    
    async def list_corrections(
        self, project_id: UUID, user_id: UUID, status: CorrectionStatus | None = None
    ) -> list[Correction]:
        """
        List all corrections for a project, optionally filtered by status.
        Returns corrections ordered by position (ascending).
        Enforces user ownership via project.user_id check.
        """
        pass
    
    async def update_correction(
        self, correction_id: UUID, user_id: UUID, status: CorrectionStatus
    ) -> Correction:
        """
        Update a single correction's status (accepted/rejected).
        Validates that the correction belongs to the user's project.
        """
        pass
    
    async def bulk_update(
        self, project_id: UUID, user_id: UUID, status: CorrectionStatus
    ) -> int:
        """
        Bulk update all PENDING corrections for a project to the given status.
        Returns the number of corrections updated.
        """
        pass
```

### CorrectionApplier Service

```python
# app/services/quality_controller/applier.py

from uuid import UUID
from pathlib import Path

class CorrectionApplierService:
    """Service for applying accepted corrections to text."""
    
    async def apply_corrections(self, project_id: UUID, user_id: UUID) -> dict:
        """
        Apply all accepted corrections to the project text.
        
        1. Load original text from project.original_text_path
        2. Fetch all ACCEPTED corrections ordered by position DESC
        3. Apply each correction in reverse order (to preserve positions)
        4. Write result to project.working_text_path
        5. Return summary: {"applied": int, "skipped": int, "working_text_path": str}
        
        If no corrections are accepted, working_text_path is set to original_text_path.
        """
        pass
    
    def _apply_single_correction(
        self, text: str, original: str, position: int
    ) -> tuple[str, bool]:
        """
        Apply a single correction at the given position.
        
        Validates that text[position:position+len(original)] matches the original.
        Returns (modified_text, success_bool).
        If validation fails, returns (unmodified_text, False).
        """
        pass
```

### API Endpoints

```python
# app/routers/quality_controller.py

from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID

router = APIRouter(prefix="/api/projects/{project_id}", tags=["quality-controller"])

@router.post("/scan-typos", status_code=202)
async def start_typo_scan(project_id: UUID, user=Depends(get_current_user)):
    """
    Initiate a typo scan for the project.
    
    - Validates project exists and belongs to user
    - Checks project has original_text_path set
    - Clears any existing corrections for the project (allows re-scan)
    - Dispatches the scan_typos_task to Celery
    - Returns: {"task_id": str, "status": "scanning"}
    """
    pass


@router.get("/corrections")
async def list_corrections(
    project_id: UUID,
    status: CorrectionStatus | None = None,
    user=Depends(get_current_user)
):
    """
    List corrections for a project, optionally filtered by status.
    
    Returns: [{"id": UUID, "original_text": str, "suggested_text": str, 
               "context_sentence": str, "position": int, "status": str}]
    """
    pass


@router.patch("/corrections")
async def update_corrections(
    project_id: UUID,
    body: CorrectionUpdateRequest,
    user=Depends(get_current_user)
):
    """
    Update correction statuses. Supports both individual and bulk operations.
    
    Request body:
    - For individual: {"corrections": [{"id": UUID, "status": "accepted"|"rejected"}]}
    - For bulk: {"bulk_action": "accept_all"|"reject_all"}
    
    Returns: {"updated": int}
    """
    pass


@router.post("/corrections/apply")
async def apply_corrections(project_id: UUID, user=Depends(get_current_user)):
    """
    Apply all accepted corrections to the project text.
    
    - Creates working_text_path with corrections applied
    - Updates project.working_text_path
    - Returns: {"applied": int, "skipped": int, "working_text_path": str}
    """
    pass
```

### Request/Response Schemas

```python
# app/schemas/quality_controller.py

from pydantic import BaseModel
from uuid import UUID
from enum import Enum

class CorrectionOut(BaseModel):
    id: UUID
    original_text: str
    suggested_text: str
    context_sentence: str
    position: int
    status: str

class CorrectionStatusUpdate(BaseModel):
    id: UUID
    status: str  # "accepted" or "rejected"

class CorrectionUpdateRequest(BaseModel):
    corrections: list[CorrectionStatusUpdate] | None = None
    bulk_action: str | None = None  # "accept_all" or "reject_all"

class ScanResponse(BaseModel):
    task_id: str
    status: str = "scanning"

class ApplyResponse(BaseModel):
    applied: int
    skipped: int
    working_text_path: str
```

## Data Models

### Correction Table (existing)

The `corrections` table already exists in the database schema:

```python
class Correction(Base, TimestampMixin):
    __tablename__ = "corrections"

    id: UUID                    # Primary key
    project_id: UUID            # FK to book_projects.id (indexed)
    original_text: Text         # The word/phrase detected as a typo
    suggested_text: Text        # The suggested correction
    context_sentence: Text      # Surrounding sentence for context
    position: Integer           # Character offset in the full text
    status: CorrectionStatus    # PENDING | ACCEPTED | REJECTED
    created_at: DateTime        # When the correction was detected
    updated_at: DateTime        # When the status was last changed
```

### BookProject Fields Used

```python
class BookProject:
    # Relevant fields for Quality Controller:
    original_text_path: str     # Path to the original ingested text (never modified)
    working_text_path: str      # Path to the corrected working copy (set after apply)
    source_type: SourceType     # Used to determine skip-by-default behavior
```

### Scan Task State

The Celery task uses built-in state tracking:
- `PENDING` → task queued
- `STARTED` → task picked up by worker
- `PROGRESS` → custom state with `{"current_chunk": int, "total_chunks": int}`
- `SUCCESS` → scan complete with `{"corrections_found": int, "chunks_processed": int}`
- `FAILURE` → scan failed with error details

## Correctness Properties

### Property 1: Typo-Only Detection Constraint

The system must never produce corrections that alter grammar, style, word choice, or meaning. Every correction in the database must represent a genuine typographical error (misspelling, transposition, or repeated word).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 2: Original Text Immutability

The file at `original_text_path` must never be modified by any operation in this module. All corrections are applied to a separate working copy. Reading the original text at any point after scanning or applying must yield the same content as before.

**Validates: Requirements 4.1, 4.2**

### Property 3: Position-Based Correction Integrity

For any set of accepted corrections applied in reverse position order, the resulting text must differ from the original only at the exact positions specified by the corrections. No unintended text modifications may occur.

**Validates: Requirements 5.1, 5.3**

### Property 4: Correction Application Idempotency

Applying corrections multiple times to the same project (without re-scanning) must produce the same working_text_path content. The apply operation is idempotent — it always reads from original_text_path and applies the current set of accepted corrections.

**Validates: Requirements 5.1, 4.2**

### Property 5: Reverse-Order Application Preserves Positions

When corrections are applied in reverse position order (highest position first), each correction's position remains valid because only text after the current position has been modified. This ensures all corrections are applied at their correct locations.

**Validates: Requirements 5.3, 5.4**

### Property 6: Skip Default for High-Quality Sources

Projects with `source_type == "standard_ebooks"` must default to skipping the typo correction step. The scan endpoint must not be called automatically for these projects.

**Validates: Requirements 6.1, 6.2**

### Property 7: User Data Isolation

A user can only view, modify, or apply corrections for projects they own. All API endpoints must verify project ownership before performing any operation.

**Validates: Requirements 3.1 (implicitly via auth middleware)**

### Property 8: Chunk Overlap Deduplication

When text is chunked with overlap, typos detected in overlapping regions must be deduplicated. The final correction list must not contain duplicate entries for the same typo at the same position.

**Validates: Requirements 1.1, 1.3**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| AI Engine timeout during chunk scan | Log the failed chunk, retry up to 2 times, then mark task as failed with partial results noted |
| AI Engine returns unparseable response | Skip that chunk, log warning, continue with remaining chunks |
| Project has no original_text_path | Return 400 error: "Project has no text to scan" |
| Project not found or not owned by user | Return 404 error |
| Correction position mismatch during apply | Skip that correction, increment "skipped" count, log mismatch details, continue with remaining |
| Scan initiated while another scan is running | Return 409 error: "Scan already in progress" |
| Empty text file | Return 400 error: "Text file is empty" |
| Bulk action with no pending corrections | Return 200 with `{"updated": 0}` |
| File I/O error writing working copy | Return 500 error with details, original text remains unchanged |

## Testing Strategy

### Unit Tests

- **Chunking logic**: Verify text is split correctly at word boundaries with proper overlap and position tracking
- **System prompt**: Verify the prompt contains all required constraint language
- **Response parsing**: Test parsing of valid JSON, malformed JSON, empty responses, and edge cases
- **Deduplication**: Test that overlapping corrections are properly merged
- **Correction application**: Test reverse-order application, position validation, and skip-on-mismatch behavior
- **Skip logic**: Test that high-quality sources default to skipped

### Integration Tests

- **Full scan flow**: Ingest text → trigger scan → verify corrections created in database with correct fields
- **Review flow**: Create corrections → accept some, reject others → verify status persistence
- **Apply flow**: Accept corrections → apply → verify working_text_path contains expected modifications
- **Re-scan flow**: Scan → review → re-scan → verify old corrections cleared and new ones created
- **Error recovery**: Simulate AI Engine failure mid-scan → verify partial results handled gracefully

### Property-Based Tests

- **Chunking coverage**: For any input text, the union of all chunks (minus overlap) covers the entire text with no gaps
- **Position consistency**: For any correction at position P with original text T, `full_text[P:P+len(T)] == T`
- **Apply reversibility**: `apply(original, corrections)` followed by reading original_text_path still yields the unchanged original
- **Idempotent apply**: `apply(project)` called twice produces identical working_text_path content
