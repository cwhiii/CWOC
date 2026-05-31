# Technical Design: Auto-Build (Cross Your Fingers Mode)

## Overview

The auto-build feature adds a backend Celery orchestrator task that sequentially executes all book production steps (print size → typo scan → typeset → cover prompts → cover image → cover build) using sensible defaults. The frontend provides a launch modal, a global progress banner, and a completion summary with per-step retry controls.

## Architecture

### System Diagram

## Components and Interfaces

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Vanilla JS + jQuery)                                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Auto-Build   │  │ Auto-Build       │  │ Auto-Build       │  │
│  │ Modal        │  │ Banner (global)  │  │ Summary          │  │
│  │ (project.js) │  │ (app.js)         │  │ (project.js)     │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────────────┘  │
│         │                    │                                    │
│         │  POST /auto-build  │  GET /auto-build/status           │
└─────────┼────────────────────┼───────────────────────────────────┘
          │                    │
┌─────────┼────────────────────┼───────────────────────────────────┐
│ Backend (FastAPI)            │                                    │
│         │                    │                                    │
│  ┌──────▼───────────────────▼──────────────────────────────────┐│
│  │ auto_build router (backend/app/routers/auto_build.py)       ││
│  │  POST /{project_id}/auto-build       → start                ││
│  │  GET  /{project_id}/auto-build/status → poll progress       ││
│  │  DELETE /{project_id}/auto-build      → cancel              ││
│  │  POST /{project_id}/auto-build/retry  → retry failed step   ││
│  │  GET  /auto-build/active              → check any active    ││
│  └──────┬──────────────────────────────────────────────────────┘│
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────────┐│
│  │ Celery Worker                                                ││
│  │  auto_build_orchestrator_task                                ││
│  │    ├── set_print_size (inline DB update)                     ││
│  │    ├── scan_typos_task (existing) + auto-accept + apply      ││
│  │    ├── generate_pdf_task (existing)                          ││
│  │    ├── generate_prompts_task (existing, lucky mode)          ││
│  │    ├── generate_image_task (existing)                        ││
│  │    └── assemble_cover (existing CoverAssembler, inline)      ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Database (PostgreSQL)                                         ││
│  │  auto_builds table                                            ││
│  └──────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

### API Endpoints

**`POST /api/projects/{project_id}/auto-build`** — Start an auto-build for a project.

Request Body:
```json
{"autofix_typos": false}
```

Response (202):
```json
{"auto_build_id": "uuid", "task_id": "celery-task-id", "status": "pending"}
```

Error (409):
```json
{"detail": "Auto-build already in progress for project 'The Great Gatsby'"}
```

**`GET /api/projects/{project_id}/auto-build/status`** — Poll current auto-build progress.

Response (200):
```json
{
    "status": "in_progress",
    "current_step": 3,
    "total_steps": 6,
    "current_step_label": "Typesetting",
    "overall_percent": 42,
    "step_results": [],
    "project_title": "The Great Gatsby",
    "project_id": "uuid",
    "started_at": "2026-05-29T10:00:00Z"
}
```

**`GET /api/auto-build/active`** — Check if the current user has any active auto-build (used by banner on all pages).

Response (200):
```json
{
    "active": true,
    "project_id": "uuid",
    "project_title": "The Great Gatsby",
    "current_step": 3,
    "total_steps": 6,
    "current_step_label": "Typesetting",
    "overall_percent": 42
}
```

**`DELETE /api/projects/{project_id}/auto-build`** — Cancel an in-progress auto-build.

**`POST /api/projects/{project_id}/auto-build/retry`** — Retry a failed step and its dependents.

Request Body:
```json
{"step_name": "typeset"}
```

### Orchestrator Task Interface

The orchestrator is a single Celery task that calls existing async implementation functions directly (not via `.delay()`). This avoids task-within-task complexity and provides a single progress stream.

Step definitions:
```python
STEPS = [
    {"name": "print_size", "label": "Setting print size", "depends_on": []},
    {"name": "typo_scan", "label": "Scanning for typos", "depends_on": [], "conditional": True},
    {"name": "typeset", "label": "Typesetting", "depends_on": ["typo_scan"]},
    {"name": "cover_prompts", "label": "Generating cover ideas", "depends_on": []},
    {"name": "cover_image", "label": "Generating cover art", "depends_on": ["cover_prompts"]},
    {"name": "cover_build", "label": "Building cover PDF", "depends_on": ["typeset", "cover_image"]},
]
```

### Frontend Components

- **auto-build-banner.js** — New module. Exports `initAutoBuildBanner()`, `checkAutoBuildStatus()`, `stopBannerPolling()`. Polls `/api/auto-build/active` every 2s, renders/removes banner DOM element.
- **project.js** — Modified. Adds 🤞 button, modal overlay, and summary panel rendering.
- **app.js** — Modified. Imports and initializes banner module after auth check.

## Data Models

### New Table: `auto_builds`

```sql
CREATE TABLE auto_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    autofix_typos BOOLEAN NOT NULL DEFAULT FALSE,
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 6,
    current_step_label VARCHAR(100),
    overall_percent INTEGER DEFAULT 0,
    step_results JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_progress_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_auto_builds_active_user ON auto_builds (user_id)
    WHERE status IN ('pending', 'in_progress');
```

### SQLAlchemy Model

```python
class AutoBuildStatus(str, PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class AutoBuild(Base, TimestampMixin):
    __tablename__ = "auto_builds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("book_projects.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[AutoBuildStatus] = mapped_column(Enum(AutoBuildStatus), default=AutoBuildStatus.PENDING)
    autofix_typos: Mapped[bool] = mapped_column(Boolean, default=False)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    total_steps: Mapped[int] = mapped_column(Integer, default=6)
    current_step_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    overall_percent: Mapped[int] = mapped_column(Integer, default=0)
    step_results: Mapped[list] = mapped_column(JSONB, default=list)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_progress_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### StepResult JSON Schema

Each element in the `step_results` JSONB array:

```json
{
    "step_name": "typeset",
    "step_index": 2,
    "status": "success",
    "error": null,
    "skip_reason": null,
    "started_at": "2026-05-29T10:00:00Z",
    "completed_at": "2026-05-29T10:00:45Z",
    "output": {"page_count": 247, "pdf_path": "/app/storage/{id}/interior.pdf"}
}
```

### Dependency Chain

```
typo_scan (if enabled) → typeset → cover_build
cover_prompts → cover_image → cover_build
print_size (independent)
```

## Error Handling

### Step-Level Failures

Each step is wrapped in try/except. On failure:
1. Record error message in StepResult
2. Check which downstream steps depend on this step
3. Mark those as "skipped" with a reason referencing the failed step
4. Continue to next independent step

### Dependency Cascade

- If `typo_scan` fails → skip `typeset` (needs corrected text) → skip `cover_build` (needs page count)
- If `typeset` fails → skip `cover_build` (needs page count for spine)
- If `cover_prompts` fails → skip `cover_image` (needs prompt) → skip `cover_build` (needs image)
- If `cover_image` fails → skip `cover_build` (needs image)
- `print_size` failure does not cascade (other steps use whatever trim_size is already set)

### Stale Task Detection

The status endpoint checks `last_progress_at`. If the auto-build is `in_progress` but `last_progress_at` is more than 90 seconds ago AND the Celery task state is not `PROGRESS`/`STARTED`, the endpoint marks it as failed with "Worker interrupted" message.

### Concurrency Conflicts

The unique partial index `idx_auto_builds_active_user` provides database-level enforcement. Attempting to insert a second active auto-build for the same user raises an IntegrityError, which the API catches and returns as a 409. The orchestrator also performs a double-check at task start time.

## Correctness Properties

### Property 1: Single Active Build Per User
At most one active auto-build per user — enforced by unique partial index at DB level. Any attempt to insert a second active record raises IntegrityError.
**Validates: Requirements 5.1, 5.6**

### Property 2: Immediate Step Persistence
Each StepResult is written to DB after step completion, before the next step starts. Worker crash preserves all previously completed step results.
**Validates: Requirements 6.2**

### Property 3: Status Advancement Only On Full Success
Project status is set to PRINT_READY only when ALL steps succeed. Partial completion leaves project status unchanged.
**Validates: Requirements 3.5**

### Property 4: No Auto-Ordering
The orchestrator never calls print/order APIs. The pipeline terminates at cover build.
**Validates: Requirements 7.1**

### Property 5: Retry Preserves Independent Results
Retry only re-runs the failed step and its dependents, keeping other step results intact.
**Validates: Requirements 3.7**

### Property 6: Real Progress
overall_percent = floor(completed_steps / total_steps × 100). No fake timers or estimated percentages.
**Validates: Requirements 4.4**

## Testing Strategy

1. **Unit tests for orchestrator logic** — mock the async step functions, verify correct ordering, dependency skipping, and StepResult persistence
2. **Unit tests for concurrency control** — verify IntegrityError handling, double-check logic
3. **Integration test for API endpoints** — test start, status polling, cancel, retry flows
4. **Frontend manual testing** — verify modal, banner rendering/removal, summary display, retry button behavior
5. **Stale detection test** — simulate worker crash, verify status endpoint marks as failed after 90s
