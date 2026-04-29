# CWOC — Technical Details

Deep technical reference for C.W.'s Omni Chits. For an overview of what CWOC is, its features, and how to set it up, see [README.md](README.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (Vanilla JS / HTML / CSS)                  │
│  index.html  ← main dashboard (C CAPTN tabs)       │
│  editor.html ← chit editor (collapsible zones)     │
│  settings.html ← settings panel                    │
│  + people, contacts, weather, trash, audit log...   │
└────────────────────┬────────────────────────────────┘
                     │ REST API (JSON) + WebSocket
┌────────────────────▼────────────────────────────────┐
│  FastAPI (Python 3) — src/backend/main.py           │
│  Uvicorn on port 3333                               │
│  SQLite3 — data/app.db                              │
└─────────────────────────────────────────────────────┘
```

- **Backend:** FastAPI + Uvicorn (Python 3), modular under `src/backend/` — main.py (entry point), routes/ (6 route modules), models.py, db.py, migrations.py, weather.py, serializers.py
- **Database:** SQLite3 via Python stdlib — single file, no ORM
- **Frontend:** Pure vanilla JS, HTML5, CSS3 — no framework, no build step. All JS loaded via `<script>` tags in HTML (load order matters)
- **External CDN libs:** Flatpickr (date picker), Font Awesome 6 (icons), marked.js (markdown), qrcode-generator
- **External APIs:** OpenStreetMap Nominatim (geocoding), Open-Meteo (weather)
- **Deployment:** Proxmox LXC container with systemd + nginx HTTPS reverse proxy

### Code Flow

The FastAPI backend serves frontend files and exposes a REST API under `/api/`. The main dashboard (`index.html` + `main.js`) fetches all chits and renders them in the active tab view. Double-clicking a chit opens the editor (`editor.html` + `editor.js`), which has collapsible zones for each chit property. Saving a chit POSTs or PUTs to the API, which auto-generates system tags (e.g., "Calendar" if it has dates, "Tasks" if it has a status) and stores everything in SQLite.

Real-time sync between browser tabs uses WebSocket (`/ws/sync`) with a polling fallback (`/api/sync/poll`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn (Python 3) |
| Database | SQLite3 (Python stdlib) |
| Validation | Pydantic v1 |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Date Picker | Flatpickr (CDN) |
| Icons | Font Awesome 6 (CDN) |
| Markdown | marked.js (CDN) |
| QR Codes | qrcode-generator (CDN) |
| Geocoding | OpenStreetMap Nominatim |
| Weather | Open-Meteo API |
| Reverse Proxy | nginx with self-signed SSL |
| Process Manager | systemd |

---

## Project Structure

```
src/
  INDEX.md                 # Complete code index — every function, class, route, CSS section

  backend/
    __init__.py            # Package marker
    main.py                # FastAPI app — startup, middleware, route registration
    db.py                  # Database helpers, shared state, JSON serialization
    models.py              # Pydantic models (Chit, Settings, Contact, etc.)
    migrations.py          # Inline DB migrations (ALTER TABLE with existence checks)
    weather.py             # Weather API integration & background schedulers
    serializers.py         # vCard & CSV import/export
    test_audit.py          # Audit diff property tests
    test_vcard.py          # vCard unit tests
    routes/
      __init__.py          # Package marker
      chits.py             # Chit CRUD, import/export
      trash.py             # Trash (soft-delete restore/purge)
      settings.py          # Settings & standalone alerts
      contacts.py          # Contact CRUD, image upload, vCard/CSV
      audit.py             # Audit log queries, export, pruning
      health.py            # Health check, version, sync, geocode, pages

  frontend/
    html/
      index.html           # Main dashboard (C CAPTN tab views)
      editor.html          # Chit editor page
      settings.html        # Settings page
      people.html          # People / contacts list page
      contact-editor.html  # Contact editor page
      weather.html         # Weather forecast page
      trash.html           # Trash view (soft-deleted chits)
      audit-log.html       # Audit log page
      help.html            # Help / documentation page
      _template.html       # HTML template for new pages

    js/
      shared/              # Shared utilities (loaded by all pages)
        shared-utils.js    # Core utilities (settings cache, confirm, date formatting)
        shared-touch.js    # Touch event adapter for drag interactions
        shared-checklist.js # Inline checklist toggle, move, drag-and-drop
        shared-sort.js     # Manual sort order persistence and drag-to-reorder
        shared-indicators.js # Visual indicator helpers for chit cards
        shared-calendar.js # Calendar display, drag, multi-day, pinch zoom
        shared-tags.js     # Tag tree, filtering, inline creation
        shared-recurrence.js # Recurrence expansion and formatting
        shared-geocoding.js # Geocoding with progressive fallback
        shared-qr.js       # QR code display modal
        shared.js          # Coordinator — quick-edit, notes layout, mobile, weather, alarms, sync

      dashboard/           # Dashboard-specific scripts
        main-sidebar.js    # Sidebar controls, filters, sort
        main-hotkeys.js    # Keyboard shortcuts and hotkey panels
        main-calendar.js   # Calendar view rendering
        main-views.js      # Tab view rendering (tasks, notes, checklists, projects)
        main-alerts.js     # Alerts tab and independent alerts board
        main-search.js     # Global search
        main-modals.js     # Dashboard modals (delete, clock, weather, quick-edit)
        main-init.js       # Dashboard initialization
        main.js            # Dashboard entry point

      editor/              # Chit editor scripts
        editor.js          # Core editor globals and helpers
        editor-dates.js    # Dates & Times zone
        editor-tags.js     # Tags zone
        editor-people.js   # People zone
        editor-location.js # Location zone
        editor-notes.js    # Notes zone
        editor-alerts.js   # Alerts zone
        editor-color.js    # Color zone
        editor-health.js   # Health indicators zone
        editor-save.js     # Save/exit logic
        editor-init.js     # Editor initialization
        editor_checklists.js # Checklist class (nested items, drag-drop, undo)
        editor_projects.js # Projects zone (Kanban board)

      pages/               # Secondary page scripts
        shared-page.js     # Shared page components (save system, header/footer injection)
        shared-editor.js   # Shared editor utilities (zone toggle, dirty tracking)
        settings.js        # Settings page logic
        people.js          # People list logic
        contact-editor.js  # Contact editor logic
        contact-qr.js      # Contact QR code / vCard sharing
        weather.js         # Weather page logic

    css/
      shared/
        shared-page.css    # Shared styles for secondary pages (parchment theme, variables)
        shared-editor.css  # Shared editor styles (zones, fields, buttons)
      dashboard/
        styles-variables.css  # Dashboard CSS custom properties
        styles-layout.css     # Body, header, top bar, forms
        styles-sidebar.css    # Sidebar, filters, multi-select
        styles-tabs.css       # Tab bar, active/hover states
        styles-calendar.css   # Calendar views, events, drag handles
        styles-cards.css      # Chit cards, notes masonry, markdown
        styles-hotkeys.css    # Hotkey overlay, reference overlay
        styles-modals.css     # Delete/clock/weather/quick-edit modals
        styles-responsive.css # All @media breakpoint rules
        styles.css            # Coordinator (loads last, overrides)
      editor/
        editor.css         # Chit-specific editor styles

  static/                  # Images and assets (logos, icons, parchment background, audio)

data/                      # SQLite database files (app.db)

install/
  configurinator.sh        # Server provisioning script (full install or upgrade)

documentation/
  overview.md              # Project overview and architecture documentation

Tasks/                     # Task tracking (ToDo.md, done.md, parking_lot.md)
Notes/                     # Project notes and context
Prototypes/                # Historical prototypes and experiments (not production)
```

### Key Conventions

- Frontend pages that aren't the main dashboard use `shared-page.css` and `shared-page.js` for consistent styling and header/footer injection (triggered by `data-page-title` on `<body>`)
- `shared.js` is loaded before both `main.js` and `editor.js` — put reusable logic there
- `shared-utils.js` must load first among all shared sub-scripts
- The dashboard (`index.html` + `main.js` + dashboard CSS) has its own independent styling
- All JS is vanilla — no modules, no imports, just `<script>` tags in HTML load order
- Backend is modular: `main.py` (entry point) + `routes/` (6 route modules) + `db.py` + `models.py` + `migrations.py` + `weather.py` + `serializers.py`
- See `src/INDEX.md` for the complete code index with every function, class, and route

---

## Database

### `chits` table

Single table storing all chit data. JSON-serialized fields (`tags`, `checklist`, `alerts`, `recurrence_rule`, `recurrence_exceptions`, `people`, `child_chits`) are stored as TEXT and serialized/deserialized via `serialize_json_field` / `deserialize_json_field` helpers in `db.py`.

Key columns: `id` (UUID), `title`, `note` (markdown), `tags` (JSON array), `start_datetime`, `end_datetime`, `due_datetime`, `completed_datetime`, `status`, `priority`, `severity`, `checklist` (JSON), `location`, `color`, `people` (JSON), `pinned`, `archived`, `deleted` (soft delete), `is_project_master`, `child_chits` (JSON), `recurrence_rule` (JSON), `recurrence_exceptions` (JSON), `alerts` (JSON), `weather_data` (JSON), timestamps.

### `settings` table

Per-user settings (currently single user: `default_user`). Stores time format, tags, custom colors, visual indicators, chit options, saved locations, clock preferences, calendar configuration, audit log limits, and more.

### `contacts` table

Contact records with structured name fields, multi-value phone/email/address/social entries (JSON), security fields, notes, tags, color, and profile image path.

### `standalone_alerts` table

Independent alarms, timers, and stopwatches not tied to any chit.

### `alert_states` table

Dismiss and snooze state tracking for alerts.

### `audit_log` table

Change history for all entities with actor, action, timestamp, entity reference, and field-level diffs.

### Migrations

Migrations run inline at startup in `backend/main.py` (calling functions from `backend/migrations.py`) using `ALTER TABLE` statements. Each migration checks if the column already exists before adding it. No migration framework — just sequential function calls at module load time.

### Auto-Generated System Tags

The backend auto-assigns system tags on create/update:
- `"Calendar"` — if the chit has `due_datetime` or `start_datetime`
- `"Checklists"` — if the chit has checklist items
- `"Alarms"` — if the chit has any alerts
- `"Projects"` — if `is_project_master` is true
- `"Tasks"` — if status is a valid status value
- `"Notes"` — if the chit has no dates

---

## API Reference

All endpoints are under `/api/` and follow REST conventions — JSON in, JSON out.

### Chits

| Method | Path | Description |
|---|---|---|
| GET | `/api/chits` | All non-deleted chits |
| GET | `/api/chit/{id}` | Single chit by ID |
| POST | `/api/chits` | Create new chit |
| PUT | `/api/chits/{id}` | Update chit (upserts if not found) |
| DELETE | `/api/chits/{id}` | Soft delete |
| PATCH | `/api/chits/{id}/recurrence-exceptions` | Add/update recurrence exception |
| GET | `/api/chits/search?q=` | Global search across all fields |

### Trash

| Method | Path | Description |
|---|---|---|
| GET | `/api/trash` | All soft-deleted chits |
| POST | `/api/trash/{id}/restore` | Restore a deleted chit |
| DELETE | `/api/trash/{id}/purge` | Permanently delete |

### Settings

| Method | Path | Description |
|---|---|---|
| GET | `/api/settings/{user_id}` | Get settings |
| POST | `/api/settings` | Save settings |

### Contacts

| Method | Path | Description |
|---|---|---|
| GET | `/api/contacts` | List contacts (optional `?q=` search) |
| GET | `/api/contacts/{id}` | Single contact |
| POST | `/api/contacts` | Create contact |
| PUT | `/api/contacts/{id}` | Update contact |
| DELETE | `/api/contacts/{id}` | Delete contact |
| POST | `/api/contacts/{id}/image` | Upload profile image |
| DELETE | `/api/contacts/{id}/image` | Remove profile image |
| PATCH | `/api/contacts/{id}/favorite` | Toggle favorite |
| POST | `/api/contacts/import` | Import .vcf or .csv |
| GET | `/api/contacts/export?format=` | Export all as .vcf or .csv |
| GET | `/api/contacts/{id}/export?format=` | Export single contact |

### Standalone Alerts

| Method | Path | Description |
|---|---|---|
| GET | `/api/standalone-alerts` | List independent alerts |
| POST | `/api/standalone-alerts` | Create alert |
| PUT | `/api/standalone-alerts/{id}` | Update alert |
| DELETE | `/api/standalone-alerts/{id}` | Delete alert |

### Alert State

| Method | Path | Description |
|---|---|---|
| GET | `/api/alert-state` | Get dismiss/snooze states |
| POST | `/api/alert-state` | Set dismiss/snooze state |
| DELETE | `/api/alert-state/cleanup` | Remove expired states |

### Audit Log

| Method | Path | Description |
|---|---|---|
| GET | `/api/audit-log` | Query audit entries (filterable, sortable, paginated) |
| GET | `/api/audit-log/export` | Export as CSV |
| DELETE | `/api/audit-log/trim` | Prune entries older than a timeframe |
| DELETE | `/api/audit-log` | Clear all entries |
| POST | `/api/audit-log/auto-prune` | Run auto-prune based on settings |

### Data Import/Export

| Method | Path | Description |
|---|---|---|
| GET | `/api/export/chits` | Export all chits as JSON |
| GET | `/api/export/userdata` | Export settings + contacts as JSON |
| POST | `/api/import/chits` | Import chits from JSON |
| POST | `/api/import/userdata` | Import user data from JSON |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/api/version` | Current version info |
| GET | `/api/instance-id` | Instance identifier |
| GET | `/api/geocode?q=` | Geocoding proxy (OpenStreetMap) |
| POST | `/api/weather/update` | Trigger weather refresh |
| GET | `/api/update/run` | Run upgrade (SSE stream) |
| GET | `/api/update/log` | Get last update log |
| POST | `/api/sync/send` | Post a sync message |
| GET | `/api/sync/poll?after=` | Poll for sync messages |
| WS | `/ws/sync` | WebSocket for real-time sync |
| GET | `/health` | Health check |

---

## Frontend Components

### Main Dashboard (`index.html` + `main.js` + dashboard CSS)

Tab-based view system with Calendar, Checklists, Alerts, Projects, Tasks, Notes, and Global Search. Sidebar with date navigation, search, status/priority/tag/people filters, sort controls, and pinned/archived toggles. Calendar views use pixel-per-minute layout for timed events with overlap detection.

The dashboard has its own independent CSS stack (`styles-variables.css` → `styles-layout.css` → ... → `styles.css`), separate from the shared page styles used by all other pages.

### Chit Editor (`editor.html` + `editor.js` + editor sub-scripts)

Collapsible zones:
1. **Title** — text input + pinned/archived toggle buttons
2. **Dates & Times** — start, end, due dates with Flatpickr; all-day toggle
3. **Task** — priority, severity, status dropdowns
4. **Location** — address input, map (OpenStreetMap iframe), directions, weather strip
5. **Tags** — checkbox list loaded from settings; user-defined tags with colors
6. **People** — contact picker
7. **Notes** — textarea with markdown render toggle; expandable modal
8. **Checklist** — full Checklist class with drag-drop, nesting, undo
9. **Alerts** — alarm, notification, timer, stopwatch configuration
10. **Health Indicators** — health tracking fields
11. **Color** — swatch picker (default + custom colors from settings)
12. **Projects** — shown only for project master chits; Kanban board of child chits

### Checklist System (`editor_checklists.js`)

Full `Checklist` class with nested items (up to 4 levels), drag-drop reordering, undo delete, checkbox toggling. Items stored as JSON array with `{id, text, level, checked, parent}` structure.

### Projects Zone (`editor_projects.js`)

Kanban-style board for project master chits. Shows child chits in 4 status columns (ToDo, In Progress, Blocked, Complete) with drag-drop between columns. Can move chits between projects.

### Shared Page System (`shared-page.js` + `shared-page.css`)

All secondary pages (settings, people, contacts, weather, trash, audit log, help) use the shared page system. `shared-page.js` injects a consistent header and footer when the `<body>` has a `data-page-title` attribute. `CwocSaveSystem` provides the standard save/cancel button pattern for pages with editable state.

### Settings (`settings.html` + `settings.js`)

Time format, tag management with color picker and tree view, custom colors, visual indicators, chit options, saved locations, clock preferences, calendar configuration, default filters, audit log limits, data import/export, and version/upgrade controls.

---

## Visual Theme

1940s parchment/magic aesthetic with brown tones, Courier New font, and parchment background textures. CSS variables are defined in:
- `frontend/css/shared/shared-page.css` — for secondary pages
- `frontend/css/dashboard/styles-variables.css` — for the dashboard
