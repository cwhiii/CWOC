# Codebase Cleanup — Progress Tracker

## Status: IN PROGRESS

## Completed ✅

### 1. Split `settings.js` (5,416 → 7 files)
| File | Lines | Purpose |
|------|-------|---------|
| `settings-email.js` | 526 | Email account management, signature editor, backfill |
| `settings-data.js` | 369 | Import/export (chits, userdata, ICS, all), login message save |
| `settings-sharing.js` | 704 | Tag sharing config, kiosk tag picker, default notifications |
| `settings-integrations.js` | 920 | Tailscale, Ntfy, Home Assistant, PWA install, SSL cert |
| `settings-version.js` | 304 | Version info, upgrade via SSE, release notes modal |
| `settings-views.js` | 408 | Arrange Views modal (drag-and-drop tab reordering) |
| `settings.js` | 1,593 | Core: locations, clocks, colors, tags, SettingsService, SettingsManager |

- `settings.html` updated with correct load order

### 2. Split `shared.js` (3,864 → 5 files)
| File | Lines | Purpose |
|------|-------|---------|
| `shared-mobile.js` | 483 | Mobile sidebar overlay, actions modal, long-press, views button |
| `shared-weather.js` | 147 | Saved locations, weather cache, Open-Meteo fetch |
| `shared-alarms.js` | 804 | Global alarm system, quick alert modal, global hotkeys |
| `shared-habits.js` | 683 | Habits period calc, success rate, streak, rollover, counter widget |
| `shared.js` | 1,794 | Core: quick-edit modal, recurrence actions, notes layout, sync, audio, delete undo |

- All 14 HTML pages updated with correct load order

### 3. Split `main-views.js` (5,137 → 7 files)
| File | Lines | Purpose |
|------|-------|---------|
| `main-views-tasks.js` | 289 | Tasks view, Assigned-to-Me view, tasks mode toggle |
| `main-views-habits.js` | 829 | Habits view, habit cards, progress tracking, optimistic UI |
| `main-views-notes.js` | 271 | Notes masonry view with inline editing |
| `main-views-projects.js` | 1,849 | Projects list + Kanban views, drag-drop, quick menu |
| `main-views-alarms.js` | 925 | Alarms view, independent alerts board, timer/stopwatch cards |
| `main-views-indicators.js` | 558 | Health indicators SVG charts, drag reorder |
| `main-views.js` | 690 | Shared helpers, chit header builder, filterChits, searchChits |

- `index.html` updated with correct load order

### 4. Split `routes/chits.py` (2,733 → 3 files)
| File | Lines | Purpose |
|------|-------|---------|
| `routes/chits.py` | 918 | CRUD (get_all, create, get_one, update, delete, patch endpoints) + helpers |
| `routes/chits_search.py` | 985 | Boolean search parser, search endpoint |
| `routes/chits_import.py` | 880 | Export/import chits, userdata, all-data bundles |

- `main.py` updated to register new routers
- `admin.py` import updated to use `chits_search`

---

## Next Up 🔜

### 5. Split `editor.css` (4,970 lines → ~4 files)
- **`editor-layout.css`** — Base layout, archived state, zone structure
- **`editor-zones.css`** — Zone-specific styles (checklist, people, location, alerts, etc.)
- **`editor-modals.css`** — Modal overlays within the editor
- **`editor-responsive.css`** — All `@media` rules for the editor

### 6. Backend: Extract shared row converters
- Create `src/backend/row_converters.py` with `deserialize_chit()`, `deserialize_contact()`, `deserialize_rule()`
- Remove duplicated inline deserialization from `routes/chits.py`, `routes/contacts.py`, `routes/sharing.py`

---

---

## Also Needed (Lower Priority)

### 7. Split `routes/email.py` (2,167 lines → 3 files)
- **`routes/email_imap.py`** — IMAP sync, backfill, folder listing
- **`routes/email_smtp.py`** — Send, reply, forward
- **`routes/email.py`** (remaining) — Account management, test connection, parser helpers

### 8. Split `editor.css` considerations
- Only worth doing if we're actively editing editor styles frequently
- The file is large (4,970 lines) but CSS is less error-prone than JS/Python splits
- Lower priority than the JS/Python splits

### 9. Frontend: Create `shared-api.js` utility
- Centralize fetch wrappers (`apiGet`, `apiPost`, `apiPut`, `apiDelete`)
- Currently duplicated across 10+ files with identical patterns
- Would reduce boilerplate and make error handling consistent
- Load before all other shared scripts (after `shared-utils.js`)

### 10. Backend: Consolidate JSON deserialization
- The inline chit deserialization in `get_all_chits()` (40+ lines of field mapping) is repeated in `routes/sharing.py` and partially in `routes/chits.py` update/create
- Extract to `db.py` as `deserialize_chit_row(row, cursor_description)` 
- Same pattern for contacts (`_row_to_contact`) and rules (`_row_to_dict`)

### 11. Dead code audit
- `src/frontend/js/shared/test_habits_*.js` (4 files) — verify if these are used anywhere or just dev artifacts
- `src/frontend/js/tests/test_touch_drag_bugs.js` — verify if active
- Deprecated functions in `shared.js`: `_quickAlertAddToChit`, `_quickAlertAddIndependent`, `_quickAlertAddIndependentDashboard` — marked deprecated, can be removed

---

## Final Steps (after all splits)
- [ ] Update `src/INDEX.md` with new file locations
- [ ] Update `src/VERSION` with current timestamp
- [ ] Write release notes to `documents/release_notes/`

---

## Notes for Resuming
- All JS is vanilla — no modules/imports. Functions are global. Load order matters.
- When splitting, new files load BEFORE the "coordinator" file they were extracted from.
- Always update the HTML file(s) that load the scripts.
- Run diagnostics after each split to catch missing references.
- Only update INDEX.md and VERSION once at the very end.
