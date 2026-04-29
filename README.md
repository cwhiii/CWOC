# ♾️📜♾️ C.W.'s Omni Chits (CWOC)

A personal task, note, and calendar management web app. The core concept is a **chit** — a single flexible record that can serve as a task, note, calendar event, alarm, checklist, or project, all using one unified data model.

Chits are organized into six views called **C CAPTN**:

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates/times — week, day, month, year, itinerary, work hours, and X-day views |
| **C**hecklists | Chits with checklist items — nested, drag-drop, undo |
| **A**lerts | Chits with alarms, notifications, timers, or stopwatches — plus an independent alerts board |
| **P**rojects | Project master chits with child chits in Kanban-style boards |
| **T**asks | Chits with a status — ToDo, In Progress, Blocked, Complete |
| **N**otes | Chits with markdown content |

A single chit can appear in multiple views depending on which fields are filled in. The backend auto-assigns system tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) based on chit properties.

---

## Setup & Running

### Prerequisites

- Python 3.8+
- No npm/node required — no build step

### Local Development

```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
```

Open `http://localhost:3333` in your browser.

### Production Deployment

The `install/configurinator.sh` script provisions a bare Debian/Ubuntu or Fedora/RHEL machine into a running CWOC server:

```bash
sudo bash install/configurinator.sh
```

This script:
1. Installs system packages (Python 3, SQLite, nginx, OpenSSL)
2. Downloads and extracts the latest CWOC release
3. Creates a Python virtual environment and installs dependencies
4. Configures a systemd service (`cwoc.service`) for auto-start
5. Sets up an nginx HTTPS reverse proxy with a self-signed certificate
6. Preserves the existing database across upgrades

### Service Management

```bash
systemctl restart cwoc       # Restart the app
systemctl status cwoc        # Check status
journalctl -u cwoc -f        # Follow logs
```

### Upgrading

Click **Upgrade Omni Chits** in Settings → Version & Updates. The upgrade streams real-time output in a terminal-style modal. Alternatively, re-run `configurinator.sh` on the server.

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
│  FastAPI (Python 3) — backend/main.py               │
│  Uvicorn on port 3333                               │
│  SQLite3 — data/app.db                              │
└─────────────────────────────────────────────────────┘
```

- **Backend:** FastAPI + Uvicorn (Python 3), single-file backend (`backend/main.py`)
- **Database:** SQLite3 via Python stdlib — single file, no ORM
- **Frontend:** Pure vanilla JS, HTML5, CSS3 — no framework, no build step
- **External CDN libs:** Flatpickr (date picker), Font Awesome 6 (icons), marked.js (markdown), qrcode-generator
- **External APIs:** OpenStreetMap Nominatim (geocoding), Open-Meteo (weather)
- **Deployment:** Proxmox LXC container with systemd + nginx HTTPS reverse proxy

---

## Features

### Dashboard
- Tab-based view system with Calendar, Checklists, Alerts, Projects, Tasks, Notes, and Global Search
- Collapsible sidebar with date navigation, sort controls, period selection, and multi-faceted filtering (text, status, priority, tags, people, show/hide options)
- Per-tab default filters configurable in Settings
- Keyboard shortcuts for nearly everything (press `R` for the reference overlay)

### Calendar
- Seven period views: Itinerary, Day, Week, Work Hours, X Days, Month, Year
- Drag-and-drop rescheduling with configurable snap intervals
- Drag bottom edge to resize events
- Shift+click for Quick Edit modal
- Double-click empty space to create a chit at that time
- Weather data displayed on calendar event cards
- Configurable work hours, work days, week start day, and scroll-to hour

### Chit Editor
- Collapsible zones: Title, Dates & Times, Task (status/priority/severity), Location (with map and weather), Tags, People, Notes (markdown with render toggle), Checklist, Alerts, Health Indicators, Color, Projects
- Save & Stay / Save & Exit workflow with unsaved-changes detection
- QR code generation (data QR and link QR)
- Audit log link per chit

### Recurrence
- Repeating patterns: Daily, Weekly, Monthly, Yearly, Custom
- Per-instance editing: edit series, edit single instance, or break off and edit
- Drag prompts for recurring events: this instance / all in series / all following
- Recurrence exceptions stored per-chit

### Checklists
- Nested items up to 4 levels deep
- Drag-and-drop reordering
- Undo delete
- Checkbox toggling from any view

### Alerts System
- Four alert types: Alarms, Notifications, Timers, Stopwatches
- Alarms trigger browser notifications with sound (macOS, Linux, Android)
- Notifications fire relative to a chit's start or due time (before/after)
- Independent Alerts board — quick alarms, timers, and stopwatches not tied to any chit
- Snooze and dismiss with configurable snooze length
- Optional "delete chit after dismissal"

### Projects
- Kanban-style board with four status columns (ToDo, In Progress, Blocked, Complete)
- Drag-and-drop between columns
- List and Kanban view modes
- Move chits between projects

### Notes
- Multi-column masonry layout with rendered markdown
- `[[chit title]]` auto-links to other chits
- Shift+click to edit in place

### Tags
- Hierarchical tags with `/` nesting (e.g., `Work/Projects/CWOC`)
- Color-coded with child tags inheriting parent color
- Favorites appear at top
- Tag editor in Settings with tree view

### People & Contacts
- Full contact editor: name fields (prefix, given, middle, surname, suffix, nickname), phone, email, address, social/web, security (Signal, PGP), context (organization, social context), notes (markdown), tags, color
- Profile image upload
- Favorite contacts
- Import/export contacts as .vcf or .csv
- QR code sharing (vCard format)
- People assigned to chits appear in the People filter

### Weather
- Dashboard weather modal (press `W`) with default location forecast
- Dedicated Weather page with 16-day forecast table for all saved locations
- Chit-level weather: auto-loads when a chit has both a location and a date
- Server-side automatic weather refresh (hourly for 7-day, daily for 8–16 day)
- City rows from chits — auto-adds forecast rows for cities with upcoming chits
- Drag-to-reorder location rows

### Clocks
- Four clock formats: 24-hour, 12-hour, 12-hour analog, and HST (Holeman Simplified Time)
- Drag clocks between Active and Inactive zones in Settings
- Horizontal or vertical layout

### Settings
- General: username, time format, sex toggle, snooze length, calendar snap
- Period Options: week start day, view hours, scroll-to hour, enabled periods with per-period options
- Tag Editor: tree view with create/edit/delete/favorite
- Saved Locations: add, label, set default for weather and editor
- Chit Options: fade past events, highlight overdue, delete past alarms, show tab counts, prefer Google Maps
- Custom Colors: color picker for chit colors
- Clocks: choose active clocks, drag to reorder, set orientation
- Default Filters: per-tab default search text
- Visual Indicators: per-indicator visibility (Always / Never / If Space), combine alerts toggle
- Version & Updates: current version, one-click upgrade with streaming log
- Data Management: JSON export/import for chit data and user data (add or replace modes)
- Audit Log: link to audit log page, pruning limits (max age, max size)

### Audit Log
- Tracks all changes: chits, contacts, independent alerts, settings, system upgrades
- Actor attribution (username from Settings, defaults to "Unknown Gremlin")
- Field-level diffs showing old → new values
- Filterable by entity type, actor, date range
- Sortable columns with drag-and-drop column reordering
- CSV export and configurable auto-pruning
- Per-chit and per-contact deep links

### Trash
- Soft delete throughout — chits are never hard-deleted
- Restore or permanently purge individual or bulk-selected chits

### Data Management
- Export/import chit data and user data as self-contained JSON files
- Add mode (merge) or Replace mode (overwrite)
- Files include metadata: CWOC version, export timestamp, instance ID

### Other
- Global Search across all chit fields with highlighted matches
- Visual indicators on chit cards (alarm, notification, timer, stopwatch, weather, people, health)
- Color-coded chits with custom color palette
- Pinned and archived chit filtering
- QR code generation for chits and contacts
- Real-time sync via WebSocket
- No-cache middleware for frontend assets during development
- ESC key layered modal handling

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
backend/
  main.py                  # FastAPI app — all routes, models, DB init, migrations

frontend/
  index.html               # Main dashboard (C CAPTN tab views)
  main.js                  # Dashboard rendering, tab logic, calendar views, sidebar
  styles.css               # Dashboard-specific styles
  editor.html              # Chit editor page
  editor.js                # Editor logic (zones, save, load)
  editor.css               # Editor-specific styles
  editor_checklists.js     # Checklist class (nested items, drag-drop, undo)
  editor_projects.js       # Projects zone (Kanban board for project master chits)
  settings.html            # Settings page
  settings.js              # Settings logic (tags, colors, indicators, options)
  people.html              # People / contacts list page
  people.js                # People list logic (search, import/export, QR)
  contact-editor.html      # Contact editor page
  contact-editor.js        # Contact editor logic
  contact-qr.js            # Contact QR code / vCard sharing
  weather.html             # Weather forecast page
  weather.js               # Weather page logic (forecast table, drag reorder)
  trash.html               # Trash view (soft-deleted chits)
  audit-log.html           # Audit log page (filterable, sortable, exportable)
  help.html                # Help / documentation page
  shared.js                # Shared utilities (checklist toggle, manual sort, calendar drag, recurrence)
  shared-page.js           # Shared page components (save system, auto header/footer injection)
  shared-page.css          # Shared styles for secondary pages (parchment theme)
  shared-editor.js         # Shared editor utilities (zone toggle, dirty tracking)
  shared-editor.css        # Shared editor styles (zones, fields, buttons)
  _template.html           # HTML template for new pages

static/                    # Images and assets (logos, icons, parchment background, audio)

data/                      # SQLite database files (app.db)

install/
  configurinator.sh        # Server provisioning script (full install or upgrade)

documentation/
  overview.md              # Project overview and architecture documentation

Tasks/                     # Task tracking (ToDo.md, done.md, parking_lot.md)
Notes/                     # Project notes and context
Prototypes/                # Historical prototypes and experiments (not production)
```

---

## API Overview

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

## Database

### `chits` table

Single table storing all chit data. JSON-serialized fields (`tags`, `checklist`, `alerts`, `recurrence_rule`, `recurrence_exceptions`, `people`, `child_chits`) are stored as TEXT and serialized/deserialized via helper functions.

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

Migrations run inline at startup in `backend/main.py` using `ALTER TABLE` statements. Each migration checks if the column already exists before adding it. No migration framework — just sequential function calls at module load time.

---

## Visual Theme

1940s parchment/magic aesthetic with brown tones, Courier New font, and parchment background textures. CSS variables are defined in `frontend/shared-page.css` for secondary pages and `frontend/styles.css` for the dashboard.

---

## Keyboard Shortcuts

Press **R** on the dashboard for the full reference overlay. Press **Shift+R** for the Help page.

| Key | Action |
|---|---|
| C / H / A / P / T / N | Switch tabs (Calendar, cHecklists, Alerts, Projects, Tasks, Notes) |
| G | Global Search |
| K | Create chit |
| W | Weather modal · Shift+W → Weather page |
| L | Clock modal |
| S | Settings |
| R | Reference overlay · Shift+R → Help page |
| V | Navigate menu |
| ESC | Close modal / exit (with save check) |
| Backspace | Clear filters |
| . | Period submenu |
| F | Filter submenu |
| O | Order submenu |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Created by C.W. Holeman III — [www.cwholemaniii.com](https://www.cwholemaniii.com/pages/home.shtml)
