# Implementation Plan: Version Management

## Overview

Add version tracking, a settings-page Version Info Box with an "Upgrade Omni Chits" button, real-time SSE update streaming via the Configurinator, and help page documentation. All changes go into existing files: `backend/main.py`, `frontend/settings.html`, `frontend/settings.js`, and `frontend/help.html`.

## Tasks

- [ ] 1. Implement backend version store helpers and startup seeding
  - [x] 1.1 Add `get_version_info()` and `update_version_info()` helper functions to `backend/main.py`
    - `get_version_info()` reads `version` and `installed_datetime` keys from `instance_meta`, returns `{"version": str, "installed_datetime": str|None}`, defaults to `"unknown"` / `null` on missing keys or errors
    - `update_version_info(version, installed_datetime)` upserts both keys into `instance_meta`
    - Follow the existing `sqlite3.connect(DB_PATH)` / `try/finally conn.close()` pattern used by `get_or_create_instance_id()`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Add `seed_version_info()` function and call it at startup alongside existing init calls
    - Check if `version` key exists in `instance_meta`; if not, read `/app/VERSION` (trimmed first line, default `"unknown"` if missing/empty), insert `version` and `installed_datetime` with current UTC ISO 8601 datetime
    - _Requirements: 1.1, 6.1, 6.2, 6.3_

  - [ ] 1.3 Write property test: Version store round-trip (Property 1)
    - **Property 1: Version store round-trip**
    - For any valid version string (non-empty, single-line, trimmed) and any valid ISO 8601 datetime string, `update_version_info` followed by `get_version_info` returns matching values
    - **Validates: Requirement 1.2**

  - [ ] 1.4 Write property test: Version string parsing from file content (Property 4)
    - **Property 4: Version string parsing from file content**
    - For any string content (including multi-line, whitespace), parsing as a VERSION file returns the trimmed first line, or `"unknown"` if empty/whitespace-only
    - **Validates: Requirements 6.3**

- [ ] 2. Implement `/api/version` endpoint
  - [x] 2.1 Add `GET /api/version` route to `backend/main.py`
    - Calls `get_version_info()` and returns `{"version": str, "installed_datetime": str|null}`
    - Returns `{"version": "unknown", "installed_datetime": null}` when no version is stored
    - _Requirements: 1.3, 1.4_

  - [ ] 2.2 Write unit tests for `/api/version` endpoint
    - Test response shape with populated and empty version store
    - Test fallback to `"unknown"` / `null` when keys don't exist
    - _Requirements: 1.3, 1.4_

- [ ] 3. Implement `/api/update/run` SSE endpoint
  - [x] 3.1 Add the SSE streaming endpoint to `backend/main.py`
    - Add `import asyncio` and `from fastapi.responses import StreamingResponse` if not already present
    - Create a module-level `asyncio.Lock` (`_update_lock`) to prevent concurrent runs
    - Implement `GET /api/update/run` as an async generator yielding `text/event-stream` SSE events
    - If lock is already held, yield `{"type":"error","message":"Update already in progress"}` and close
    - If configurinator script not found, yield `{"type":"error","message":"Configurinator script not found"}` and close
    - Spawn `asyncio.create_subprocess_exec("sudo", "/app/install/configurinator.sh", ...)` with stdout/stderr piped
    - Stream each line as `data: {"type":"log","line":"..."}\n\n`
    - On completion: if exit code 0, read `/app/VERSION` (trimmed first line), call `update_version_info()`, yield `{"type":"done","exit_code":0,"version":"..."}`; if non-zero, yield `{"type":"done","exit_code":N}` without updating version store
    - Handle `OSError`/`PermissionError` on subprocess spawn with SSE error event
    - Handle client disconnect via `asyncio.CancelledError` — terminate subprocess gracefully
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3_

  - [ ] 3.2 Write property test: SSE log event preserves line content (Property 2)
    - **Property 2: SSE log event preserves line content**
    - For any string representing a log line, formatting it as an SSE event produces valid JSON where `type` equals `"log"` and `line` equals the original string exactly
    - **Validates: Requirement 4.2**

  - [ ] 3.3 Write unit tests for `/api/update/run` edge cases
    - Test script-not-found error event
    - Test concurrent execution guard (lock already held)
    - Test that version store is NOT updated on non-zero exit code
    - _Requirements: 4.4, 4.5, 4.6_

- [ ] 4. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add Version Info Box and Update Modal HTML/CSS to settings page
  - [x] 5.1 Add the Version Info Box `setting-group` section to `frontend/settings.html`
    - Add a new `<div class="setting-group">` containing:
      - `<h3>🔄 Version & Updates</h3>` header
      - `<span id="version-display">` for version string
      - `<span id="version-date">` for formatted last-updated datetime
      - `<button id="upgrade-btn" class="standard-button">⬆️ Upgrade Omni Chits</button>`
    - Place it logically among the existing setting-groups (after Export/Import or near the bottom)
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 5.2 Add the Update Modal markup and CSS to `frontend/settings.html`
    - Add `<div id="update-modal" class="modal">` with:
      - `<div class="modal-content">` containing a terminal-styled `<pre id="update-log">` (dark background `#1e1e1e`, monospace font, scrollable, max-height)
      - `<button id="update-close-btn" class="standard-button" disabled>Close</button>`
    - Add CSS classes for color-coded log prefixes: `.log-ok` (green), `.log-warn` (yellow), `.log-error` (red), `.log-step` (blue)
    - Style the modal overlay and terminal area consistent with the parchment/1940s aesthetic for the outer chrome
    - _Requirements: 5.1, 5.7_

- [ ] 6. Implement settings.js version management functions
  - [x] 6.1 Add `loadVersionInfo()` function to `frontend/settings.js`
    - `GET /api/version` → populate `#version-display` with version string, `#version-date` with formatted datetime (using the user's configured time format)
    - If version is `"unknown"` or installed_datetime is null, show "No version info available" fallback
    - If fetch fails, show "Unable to load version info" with a retry option
    - Call `loadVersionInfo()` on page load (in the existing init flow)
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 6.2 Add `startUpgrade()`, `appendLogLine()`, and `onUpgradeComplete()` functions to `frontend/settings.js`
    - `startUpgrade()`: disable the upgrade button, open the update modal, clear previous log, connect `EventSource` to `/api/update/run`
    - `appendLogLine(line)`: parse prefix (`[OK]`, `[WARN]`, `[ERROR]`, `[STEP]`), create a `<span>` with the corresponding CSS class, append to `#update-log`, auto-scroll to bottom
    - `onUpgradeComplete(data)`: show success/failure summary line in the log, enable the Close button, call `loadVersionInfo()` to refresh the Version Info Box, re-enable the upgrade button
    - Handle SSE error events (connection lost, malformed JSON fallback to raw text)
    - Wire the upgrade button's `onclick` to `startUpgrade()`
    - Wire the close button to hide the modal
    - _Requirements: 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 6.3 Write property test: Log line rendering with correct color classification (Property 3)
    - **Property 3: Log line rendering with correct color classification**
    - For any log line string, `appendLogLine` adds exactly one child element containing the original text, with the correct CSS class for recognized prefixes (`[OK]`→`log-ok`, `[WARN]`→`log-warn`, `[ERROR]`→`log-error`, `[STEP]`→`log-step`) and no color class for unrecognized prefixes
    - **Validates: Requirements 5.2, 5.7**

- [ ] 7. Checkpoint — Ensure frontend functions work with backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update help page with Version Management documentation
  - [x] 8.1 Add Version Management section and TOC entry to `frontend/help.html`
    - Add `<li><a href="#version-management">Version Management</a></li>` to the table of contents `<ul>`
    - Add a new `<h3 id="version-management">Version Management</h3>` section in the help-content area (within the Settings documentation area, before the Contact Editor section)
    - Describe the Version Info Box: version number display, last updated date/time
    - Describe the "Upgrade Omni Chits" button and Update Modal behavior: real-time log streaming, color-coded output (`[OK]` green, `[WARN]` yellow, `[ERROR]` red, `[STEP]` blue), Close button enabled after completion
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All changes go into existing files — no new files are created (except test files)
- Backend uses Python (Hypothesis for property tests), frontend uses vanilla JS (fast-check for property tests)
