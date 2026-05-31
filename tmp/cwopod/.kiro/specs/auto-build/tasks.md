# Implementation Plan: Auto-Build (Cross Your Fingers Mode)

## Overview

This plan implements the auto-build feature in 7 tasks, progressing from backend data model through API layer, orchestrator logic, and frontend UI components. Tasks are ordered so each builds on the previous — the model comes first, then the API that uses it, then the orchestrator that powers it, and finally the frontend that presents it.

## Tasks

- [ ] 1. Create AutoBuild database model and migration
  - Create `backend/app/models/auto_build.py` with `AutoBuild` model and `AutoBuildStatus` enum (PENDING, IN_PROGRESS, COMPLETED, FAILED)
  - Add fields: id (UUID PK), project_id (FK to book_projects), user_id (FK to users), task_id (VARCHAR), status, autofix_typos (BOOLEAN), current_step (INTEGER), total_steps (INTEGER), current_step_label (VARCHAR), overall_percent (INTEGER), step_results (JSONB default []), started_at, completed_at, last_progress_at, created_at, updated_at
  - Add unique partial index on (user_id) WHERE status IN ('pending', 'in_progress') for concurrency control
  - Create Alembic migration file with `alembic revision --autogenerate -m "add_auto_builds_table"`
  - Requirements: R5-AC1, R5-AC6, R6-AC2

- [ ] 2. Create auto-build API router with all endpoints
  - Create `backend/app/routers/auto_build.py` with FastAPI router
  - Implement `POST /{project_id}/auto-build` — validates project ownership and DRAFT status, catches IntegrityError from unique index (returns 409 with project title), creates AutoBuild record, dispatches orchestrator task via .delay(), returns 202 with auto_build_id and task_id
  - Implement `GET /{project_id}/auto-build/status` — returns current progress from DB (not Celery directly), includes stale detection: if last_progress_at > 90s ago and Celery state not PROGRESS/STARTED, mark as failed
  - Implement `GET /auto-build/active` — queries for user's active auto-build (status IN pending/in_progress), returns project_id, title, step info, or {active: false}
  - Implement `DELETE /{project_id}/auto-build` — revokes Celery task, marks AutoBuild as FAILED, returns confirmation
  - Implement `POST /{project_id}/auto-build/retry` — accepts step_name in body, creates new AutoBuild record with retry context, dispatches orchestrator with retry_from parameter
  - Register router in `backend/app/main.py`: project-scoped endpoints under `/api/projects` prefix, user-scoped `/auto-build/active` under `/api`
  - Requirements: R1-AC3, R1-AC5, R1-AC6, R3-AC7, R4-AC4, R4-AC5, R5-AC2, R5-AC5, R6-AC3

- [ ] 3. Create orchestrator Celery task with step execution logic
  - Create `backend/app/services/auto_build/__init__.py` (empty)
  - Create `backend/app/services/auto_build/orchestrator.py` with `auto_build_orchestrator_task` (bind=True, name="auto_build.orchestrate", soft_time_limit=7200, time_limit=7500)
  - Define STEPS list with name, label, depends_on, and conditional flag
  - Implement concurrency double-check at task start: query DB for active builds for same user, abort if conflict found
  - Implement main loop: for each step, check if dependencies all succeeded → execute or skip → persist StepResult to DB → update Celery state via self.update_state() → update auto_build.last_progress_at
  - Implement `_execute_print_size`: read user's default trim_size from settings, update project.trim_size (fallback 5.5x8.5)
  - Implement `_execute_typo_scan`: call `_scan_typos_async()` directly, then bulk UPDATE corrections to accepted, then call CorrectionApplierService.apply_corrections()
  - Implement `_execute_typeset`: call `_generate_pdf_async()` directly, extract page_count from result
  - Implement `_execute_cover_prompts`: call `_generate_prompts_async()` with mode="lucky", num_prompts=1, extract first prompt text and id
  - Implement `_execute_cover_image`: call `_generate_image_async()` with prompt_id and prompt_text, extract image_path
  - Implement `_execute_cover_build`: construct classic template layout dict (title centered at 0.5/0.15, author at 0.5/0.85, Garamond font, white text), call CoverAssembler.assemble_cover() with page_count and standard_white paper
  - On completion: if all steps succeeded set project.status = PRINT_READY, set auto_build.status = COMPLETED (or FAILED if any failed/skipped), set completed_at, clear active lock
  - Implement retry_from logic: when set, load previous step_results, skip steps before retry_from, re-use their stored outputs
  - Add `"app.services.auto_build.orchestrator"` to worker.py includes list
  - Requirements: R2-AC1 through R2-AC10, R3-AC1 through R3-AC4, R5-AC3, R5-AC4, R6-AC1, R6-AC2, R7-AC1

- [ ] 4. Frontend — Auto-Build launch button and modal
  - In `frontend/js/pages/project.js` `renderSourceStep()`: add "🤞 Cross Your Fingers" button (visible when project.status === 'draft' and project.original_text_path exists)
  - On page load, check `GET /api/auto-build/active` — if active for this project, disable button and show "Auto-build in progress" message; if active for another project, disable with "One at a time" message
  - Implement modal overlay HTML: title "🤞 Cross Your Fingers", description text, checkbox "AI Autofix typos" (unchecked default), Start button, Cancel button
  - On Start click: POST `/api/projects/{id}/auto-build` with {autofix_typos: checked}, on 202 close modal + trigger banner init, on 409 show conflict message, on error show error + re-enable
  - On Cancel click: close modal, no action
  - Requirements: R1-AC1, R1-AC2, R1-AC3, R1-AC4, R1-AC6

- [ ] 5. Frontend — Global auto-build banner
  - Create `frontend/js/auto-build-banner.js` module
  - Export `initAutoBuildBanner()`: calls checkAutoBuildStatus(), starts 2s setInterval for polling
  - Export `checkAutoBuildStatus()`: GET `/api/auto-build/active`, if active render banner, if not active remove banner and stop polling
  - Banner HTML: div#auto-build-banner with 🤞 emoji, "Auto-build in progress:", project title (truncated 40 chars with ellipsis), "Step X/Y: label (percent%)", "Watch →" link to /projects/{id}
  - Insert banner between #app-header and #app (or as first child of .app container)
  - When status returns active:false or completed/failed: remove banner div, clearInterval
  - In `frontend/js/app.js`: import `initAutoBuildBanner` from './auto-build-banner.js', call it inside the init() function after checkAuth() and renderHeader() (only if authenticated)
  - Add top padding/margin to #app when banner is visible so content doesn't overlap
  - Requirements: R4-AC1, R4-AC2, R4-AC3, R4-AC5, R4-AC6, R4-AC7

- [ ] 6. Frontend — Auto-Build summary panel
  - In `frontend/js/pages/project.js`: on project load, check if project has a completed/failed auto-build via GET `/api/projects/{id}/auto-build/status`
  - If auto-build exists and status is completed/failed, render summary panel at top of project page (before wizard steps)
  - Summary shows each step as a card: ✅ for success (with detail like "247 pages"), ❌ for failed (with error message), ⏭️ for skipped (with reason)
  - Failed steps show a "Retry" button; skipped steps show retry only on root-cause failed step
  - Retry button: POST `/api/projects/{id}/auto-build/retry` with {step_name}, on success trigger banner polling
  - If project.status === 'print_ready': show cover image thumbnail (max 400×400), interior PDF download link, "Proceed to Print →" button (navigates to print step)
  - If project.status !== 'print_ready': hide "Proceed to Print" button
  - Requirements: R3-AC5, R3-AC6, R3-AC7, R4-AC6, R7-AC2, R7-AC3, R7-AC4

- [ ] 7. CSS styling and polish
  - Add `.auto-build-banner` styles: warm background (#fef3cd), border-bottom, padding 0.5rem 1rem, flex row, align-items center, gap 0.75rem, font-size 0.85rem
  - Add `.auto-build-modal` styles: overlay (fixed, full screen, semi-transparent bg), centered card (max-width 400px, padding, border-radius), checkbox label styling
  - Add `.auto-build-summary` styles: panel with step cards, status icons (colored), retry buttons (small, secondary style)
  - Add `.auto-build-btn` (🤞 button): distinctive styling, slightly larger, warm color scheme
  - Ensure banner adds body/app offset so page content isn't hidden behind it
  - Test responsive: banner stacks vertically on narrow screens, modal is full-width on mobile
  - Requirements: R1-AC1, R4-AC1, R4-AC2

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4, 7]},
    {"tasks": [5]},
    {"tasks": [6]}
  ]
}
```

## Notes

- The orchestrator calls existing async task implementations directly (e.g., `_scan_typos_async`, `_generate_pdf_async`) rather than dispatching sub-tasks via `.delay()`. This keeps everything in one Celery task with one progress stream and avoids task-within-task complexity.
- The unique partial index on `auto_builds(user_id) WHERE status IN ('pending', 'in_progress')` provides atomic concurrency control at the database level — no application-level locking needed.
- Cover build uses the "classic" template layout hardcoded in the orchestrator (Garamond, white, centered). This matches the existing `TEMPLATE_CLASSIC` in `backend/app/services/cover/templates.py`.
- Lucky mode for cover prompts generates from 1 random section — much faster than standard mode which reads all chapters.
