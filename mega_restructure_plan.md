# Mega Restructure Plan — CWOC Codebase

## Summary

Restructure the CWOC codebase from a flat directory layout with five monolithic files into a well-organized `src/` directory tree with focused, single-responsibility files. Executed in 12 sequential phases, each leaving the application fully functional. No new features, no new dependencies — purely mechanical restructuring.

## Progress Summary

| Phase | Name | Status | Completion Date |
|-------|------|--------|-----------------|
| 1 | Create directory structure | **Complete** | 2026-04-29 |
| 2 | Reorganize data directory (contact images) | **Complete** | 2026-04-29 |
| 3 | Split backend/main.py into Python modules | **Complete** | 2026-04-29 |
| 4 | Move backend to src/backend/ | Not Started | — |
| 5 | Split frontend/shared.js into focused sub-scripts | Not Started | — |
| 6 | Split frontend/main.js into focused sub-scripts | Not Started | — |
| 7 | Split frontend/editor.js into focused sub-scripts | Not Started | — |
| 8 | Split frontend/styles.css into focused sub-stylesheets | Not Started | — |
| 9 | Move frontend to src/frontend/ | Not Started | — |
| 10 | Move static assets to src/static/ | Not Started | — |
| 11 | Create INDEX.md and finalize documentation | Not Started | — |
| 12 | Cleanup and final verification | Not Started | — |

---

## Phase 1 — Create directory structure

**Description:** Create all new directories (`src/backend/`, `src/backend/routes/`, `src/frontend/html/`, `src/frontend/js/`, `src/frontend/css/`, `data/contacts/`, etc.) without moving or modifying any existing files.

**Files affected:** None modified. New empty directories and `__init__.py` files only.

**Tasks:**
- [x] Create `src/backend/` and `src/backend/routes/`
- [x] Create `src/backend/__init__.py` and `src/backend/routes/__init__.py`
- [x] Create `src/frontend/html/`
- [x] Create `src/frontend/js/shared/`, `src/frontend/js/dashboard/`, `src/frontend/js/editor/`, `src/frontend/js/pages/`
- [x] Create `src/frontend/css/shared/`, `src/frontend/css/dashboard/`, `src/frontend/css/editor/`
- [x] Create `src/static/`
- [x] Create `data/contacts/profile_pictures/`
- [x] Create `data/contacts/pgp_keys/`

**Verification:**
- [x] All directories listed above exist
- [x] `src/backend/__init__.py` and `src/backend/routes/__init__.py` are empty files
- [x] No existing files were moved or modified
- [ ] Application still starts and runs normally (`uvicorn backend.main:app`)

---

## Phase 2 — Reorganize data directory (contact images)

**Description:** Move contact profile images from `/app/static/contact_images/` to `data/contacts/profile_pictures/`, update backend paths and DB migration.

**Files affected:** `backend/main.py` (migration + constants + route handlers), frontend contact pages (verify image URLs).

**Tasks:**
- [x] Write migration function to copy files from old to new location
- [x] Write DB migration to update `image_url` values
- [x] Update `CONTACT_IMAGES_DIR` constant
- [x] Update `upload_contact_image` and `delete_contact_image` handlers
- [x] Add `StaticFiles` mount for `data/contacts/profile_pictures/`
- [x] Verify frontend contact pages display images at new URL

**Verification:**
- [x] Profile images accessible at new URL path
- [ ] Old path returns 404 (or is cleaned up)
- [x] DB migration applied — `image_url` values updated
- [x] Upload and delete still work with new paths

---

## Phase 3 — Split backend/main.py into Python modules

**Description:** Extract Python modules (`models.py`, `db.py`, `migrations.py`, `serializers.py`, `weather.py`, route files) from the monolithic `backend/main.py`.

**Files affected:** `backend/main.py` (reduced to entry point), new files: `backend/models.py`, `backend/db.py`, `backend/migrations.py`, `backend/serializers.py`, `backend/weather.py`, `backend/routes/chits.py`, `backend/routes/trash.py`, `backend/routes/settings.py`, `backend/routes/contacts.py`, `backend/routes/audit.py`, `backend/routes/health.py`.

**Tasks:**
- [x] Extract `models.py` — all Pydantic model classes
- [x] Extract `db.py` — DB init, helpers, shared state
- [x] Extract `migrations.py` — all migrate_* functions
- [x] Extract `serializers.py` — vCard/CSV functions
- [x] Extract `weather.py` — weather/geocoding functions
- [x] Extract `routes/chits.py` — chit CRUD endpoints
- [x] Extract `routes/trash.py` — trash endpoints
- [x] Extract `routes/settings.py` — settings endpoints
- [x] Extract `routes/contacts.py` — contact endpoints
- [x] Extract `routes/audit.py` — audit log endpoints
- [x] Extract `routes/health.py` — health, version, WebSocket, page serving
- [x] Refactor `main.py` into minimal entry point

**Verification:**
- [x] `uvicorn backend.main:app` starts without import errors
- [x] All 24+ API endpoints return correct responses
- [x] `backend/test_audit.py` and `backend/test_vcard.py` pass
- [x] Each module file under 500 lines (contacts.py up to 700)

---

## Phase 4 — Move backend to src/backend/

**Description:** Relocate the split backend files into `src/backend/`, update imports, DB_PATH, StaticFiles mounts, uvicorn startup, and deployment configs.

**Files affected:** All `backend/*.py` and `backend/routes/*.py` (moved), `start.sh`, `cwoc.service`, `install/configurinator.sh`.

**Tasks:**
- [ ] Move all backend Python files to `src/backend/` and `src/backend/routes/`
- [ ] Update all intra-backend Python imports
- [ ] Update `DB_PATH` to reference flattened `data/app.db`
- [ ] Update `StaticFiles` mounts
- [ ] Update `FileResponse` paths
- [ ] Update `start.sh` and `cwoc.service` with new uvicorn path
- [ ] Update `install/configurinator.sh`
- [ ] Move and update test files
- [ ] Remove old `backend/` directory

**Verification:**
- [ ] `uvicorn src.backend.main:app` starts without errors
- [ ] All API endpoints return correct responses
- [ ] Test files pass with updated imports

---

## Phase 5 — Split frontend/shared.js into focused sub-scripts

**Description:** Extract shared utility sub-scripts from the monolithic `frontend/shared.js`, update all HTML files with new script load order.

**Files affected:** `frontend/shared.js` (reduced to coordinator), new files: `frontend/shared-utils.js`, `frontend/shared-touch.js`, `frontend/shared-checklist.js`, `frontend/shared-sort.js`, `frontend/shared-indicators.js`, `frontend/shared-calendar.js`, `frontend/shared-tags.js`, `frontend/shared-recurrence.js`, `frontend/shared-geocoding.js`, `frontend/shared-qr.js`. All HTML files updated with new `<script>` tags.

**Tasks:**
- [ ] Extract 10 shared sub-scripts
- [ ] Reduce `shared.js` to minimal coordinator
- [ ] Update all HTML files with new script load order

**Verification:**
- [ ] All pages load without console errors
- [ ] All shared functions available globally
- [ ] Each sub-script under 600 lines

---

## Phase 6 — Split frontend/main.js into focused sub-scripts

**Description:** Extract dashboard sub-scripts from the monolithic `frontend/main.js`, update `index.html` with new script load order.

**Files affected:** `frontend/main.js` (reduced to coordinator), new files: `frontend/main-sidebar.js`, `frontend/main-hotkeys.js`, `frontend/main-calendar.js`, `frontend/main-views.js`, `frontend/main-alerts.js`, `frontend/main-search.js`, `frontend/main-modals.js`, `frontend/main-init.js`. `index.html` updated.

**Tasks:**
- [ ] Extract 8 dashboard sub-scripts
- [ ] Reduce `main.js` to minimal coordinator
- [ ] Update `index.html` with new script load order

**Verification:**
- [ ] All 6 C CAPTN tabs render correctly
- [ ] Calendar navigation works (all 7 period views)
- [ ] Sidebar, hotkeys, alerts, search, modals all work
- [ ] Each sub-script under 1,200 lines

---

## Phase 7 — Split frontend/editor.js into focused sub-scripts

**Description:** Extract editor zone sub-scripts from the monolithic `frontend/editor.js`, update `editor.html` with new script load order.

**Files affected:** `frontend/editor.js` (reduced to coordinator), new files: `frontend/editor-dates.js`, `frontend/editor-tags.js`, `frontend/editor-people.js`, `frontend/editor-location.js`, `frontend/editor-notes.js`, `frontend/editor-alerts.js`, `frontend/editor-color.js`, `frontend/editor-health.js`, `frontend/editor-save.js`, `frontend/editor-init.js`. `editor.html` updated.

**Tasks:**
- [ ] Extract 10 editor sub-scripts
- [ ] Reduce `editor.js` to minimal coordinator
- [ ] Update `editor.html` with new script load order

**Verification:**
- [ ] Editor loads, all zones expand/collapse
- [ ] Save/load works, all zone interactions work
- [ ] Each sub-script under 800 lines

---

## Phase 8 — Split frontend/styles.css into focused sub-stylesheets

**Description:** Extract dashboard sub-stylesheets from the monolithic `frontend/styles.css`, update `index.html` with new stylesheet load order.

**Files affected:** `frontend/styles.css` (reduced to coordinator), new files: `frontend/styles-variables.css`, `frontend/styles-layout.css`, `frontend/styles-sidebar.css`, `frontend/styles-tabs.css`, `frontend/styles-calendar.css`, `frontend/styles-cards.css`, `frontend/styles-hotkeys.css`, `frontend/styles-modals.css`, `frontend/styles-responsive.css`. `index.html` updated.

**Tasks:**
- [ ] Extract 9 dashboard sub-stylesheets
- [ ] Reduce `styles.css` to minimal coordinator
- [ ] Update `index.html` with new stylesheet load order

**Verification:**
- [ ] Dashboard renders identically — no visual changes
- [ ] All CSS variables resolve
- [ ] Responsive breakpoints trigger at correct widths
- [ ] Each sub-stylesheet under 500 lines

---

## Phase 9 — Move frontend to src/frontend/

**Description:** Relocate all frontend files into `src/frontend/html/`, `src/frontend/js/`, `src/frontend/css/`, update all path references.

**Files affected:** All `frontend/*.html`, `frontend/*.js`, `frontend/*.css` (moved). All HTML files (path updates). `src/backend/main.py` (StaticFiles mounts). `src/backend/routes/health.py` (FileResponse paths). JS files (window.location.href updates).

**Tasks:**
- [ ] Move HTML files to `src/frontend/html/`
- [ ] Move JS files to `src/frontend/js/shared/`, `dashboard/`, `editor/`, `pages/`
- [ ] Move CSS files to `src/frontend/css/shared/`, `dashboard/`, `editor/`
- [ ] Update all `<script src>` and `<link href>` paths
- [ ] Update `StaticFiles` mounts and `FileResponse` paths
- [ ] Update JS `window.location.href` references
- [ ] Remove old `frontend/` directory

**Verification:**
- [ ] All pages load from new paths
- [ ] No 404s in network tab
- [ ] No console errors on any page

---

## Phase 10 — Move static assets to src/static/

**Description:** Relocate static assets (images, audio) to `src/static/`, update StaticFiles mount.

**Files affected:** All files in `static/` (moved). `src/backend/main.py` (StaticFiles mount update).

**Tasks:**
- [ ] Move all static assets to `src/static/`
- [ ] Update `/static/` StaticFiles mount
- [ ] Remove old `static/` directory

**Verification:**
- [ ] All images and audio load correctly
- [ ] No 404s for static assets
- [ ] Profile pictures still load from `data/contacts/` (unchanged)

---

## Phase 11 — Create INDEX.md and finalize documentation

**Description:** Generate the function/file index, update all documentation, templates, and steering files.

**Files affected:** New: `src/INDEX.md`. Updated: `src/frontend/html/_template.html`, `README.md`, `documentation/overview.md`, `.kiro/steering/structure.md`, `.kiro/steering/tech.md`.

**Tasks:**
- [ ] Create `src/INDEX.md` with Backend, Frontend JS, Frontend CSS, Load Order, and Dependency Map sections
- [ ] Update `_template.html` with new script load order
- [ ] Update `README.md` and `documentation/overview.md`
- [ ] Update steering files

**Verification:**
- [ ] INDEX.md contains complete function/file listings
- [ ] Template has correct script tags
- [ ] Documentation reflects new structure

---

## Phase 12 — Cleanup and final verification

**Description:** Remove old empty directories, verify no broken references, full end-to-end verification.

**Files affected:** Old empty directories removed. No code changes.

**Tasks:**
- [ ] Remove remaining empty old directories
- [ ] Search for broken references (old import paths, old script/link paths)
- [ ] Full end-to-end verification of all pages and features
- [ ] Run existing test files
- [ ] Finalize this document

**Verification:**
- [ ] No old `backend/`, `frontend/`, `static/` directories remain
- [ ] No broken references found in any file
- [ ] All pages load and function correctly
- [ ] All tests pass
- [ ] This document shows all phases complete
