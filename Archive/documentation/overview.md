# C.W.'s Omni Chits (CWOC) — Overview

**C.W.'s Omni Chits (CWOC)** is a personal task and note management web app. The central concept is a "chit" — a single flexible record that can be a task, note, calendar event, alarm, checklist, or project, all in one data model.

It organizes chits into six views called **C CAPTN**:

- **C**alendar — chits with dates/times (week, day, month, year, itinerary views)
- **C**hecklists — chits with checklist items (nested, drag-drop, undo)
- **A**larms — chits with alarm/notification flags
- **P**rojects — project master chits with child chits in a Kanban-style board
- **T**asks — chits with a status (ToDo / In Progress / Blocked / Complete)
- **N**otes — chits with markdown content and no dates

---

## Architecture

- **Backend:** FastAPI (Python 3) + Uvicorn + SQLite, running on port 3333
- **Frontend:** Pure vanilla JS, HTML, CSS — no framework, no build step
- **External:** Flatpickr (date picker), Font Awesome (icons), marked.js (markdown), OpenStreetMap (geocoding), Open-Meteo (weather)
- **Deployed** on a Proxmox LXC container at `http://192.168.1.111:3333`

```
┌─────────────────────────────────────────────────────┐
│  Browser (Vanilla JS / HTML / CSS)                  │
│  src/frontend/html/index.html  ← main dashboard     │
│  src/frontend/html/editor.html ← chit editor        │
│  src/frontend/html/settings.html ← settings panel   │
│  src/frontend/js/   ← JS organized by role          │
│  src/frontend/css/  ← CSS organized by role         │
└────────────────────┬────────────────────────────────┘
                     │ REST API (fetch)
┌────────────────────▼────────────────────────────────┐
│  FastAPI (Python 3) — src/backend/main.py           │
│  Routes in src/backend/routes/                      │
│  Uvicorn on port 3333                               │
│  SQLite — /app/data/app.db                          │
└─────────────────────────────────────────────────────┘
```

---

## Code Flow

The FastAPI backend serves the frontend files and exposes a REST API (`/api/chits`, `/api/settings`). The backend is modular: `src/backend/main.py` is the entry point, with routes split into `src/backend/routes/` (chits, trash, settings, contacts, audit, health), models in `models.py`, database helpers in `db.py`, and migrations in `migrations.py`. The main dashboard (`src/frontend/html/index.html` + `src/frontend/js/dashboard/main.js`) fetches all chits and renders them in the active tab view. Double-clicking a chit opens the editor (`src/frontend/html/editor.html` + `src/frontend/js/editor/editor.js`), which has collapsible zones for title, dates, location (with weather), tags, notes (markdown), checklists, alerts, color, and projects. Saving a chit POSTs or PUTs to the API, which auto-generates system tags (like "Calendar" if it has dates, "Tasks" if it has a status) and stores everything in SQLite.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn (Python 3) |
| Database | SQLite3 (stdlib) |
| Validation | Pydantic v1 |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Date picker | Flatpickr (CDN) |
| Icons | Font Awesome 6 (CDN) |
| Markdown | marked.js (CDN) |
| Geocoding | OpenStreetMap Nominatim |
| Weather | Open-Meteo API |

---

## Database Schema

### `chits` table

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID or custom generated ID |
| title | TEXT | |
| note | TEXT | Markdown supported |
| tags | TEXT | JSON array of strings |
| start_datetime | TEXT | ISO 8601 string |
| end_datetime | TEXT | ISO 8601 string |
| due_datetime | TEXT | ISO 8601 string |
| completed_datetime | TEXT | ISO 8601 string |
| status | TEXT | ToDo / In Progress / Blocked / Complete |
| priority | TEXT | High / Medium / Low |
| severity | TEXT | Critical / Major / Minor |
| checklist | TEXT | JSON array of `{id, text, level, checked, parent}` |
| alarm | BOOLEAN | |
| notification | BOOLEAN | |
| recurrence | TEXT | Field exists, logic not implemented |
| recurrence_id | TEXT | Field exists, logic not implemented |
| location | TEXT | Free-text address |
| color | TEXT | Hex color string |
| people | TEXT | JSON array of strings |
| pinned | BOOLEAN | |
| archived | BOOLEAN | |
| deleted | BOOLEAN | Soft delete — never hard-deleted |
| created_datetime | TEXT | ISO 8601, set on create |
| modified_datetime | TEXT | ISO 8601, updated on save |
| is_project_master | BOOLEAN | Marks chit as a project container |
| child_chits | TEXT | JSON array of child chit IDs |

### `settings` table

| Column | Type | Notes |
|---|---|---|
| user_id | TEXT PK | Always `"default_user"` currently |
| time_format | TEXT | 24hour / 12hour / metric / metricbar / 12houranalog |
| sex | TEXT | Used for health indicators |
| snooze_length | TEXT | |
| default_filters | TEXT | JSON array |
| alarm_orientation | TEXT | horizontal / vertical |
| tags | TEXT | JSON array of `{name, color}` |
| custom_colors | TEXT | JSON array of hex strings |
| visual_indicators | TEXT | JSON object |
| chit_options | TEXT | JSON object of booleans |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Serves `index.html` |
| GET | `/editor` | Serves `editor.html` (accepts `?id=` param) |
| GET | `/api/chits` | All non-deleted chits |
| GET | `/api/chit/{id}` | Single chit by ID |
| POST | `/api/chits` | Create new chit |
| PUT | `/api/chits/{id}` | Update chit (upserts if not found) |
| DELETE | `/api/chits/{id}` | Soft delete (sets `deleted=1`) |
| GET | `/api/settings/{user_id}` | Get settings |
| POST | `/api/settings` | Save settings (INSERT OR REPLACE) |
| GET | `/health` | Health check |
| Static | `/frontend/*` | Serves frontend files |
| Static | `/static/*` | Serves images/assets |

Auto-generated system tags (added by backend on create/update):
- `"Calendar"` — if has `due_datetime` or `start_datetime`
- `"Checklists"` — if has checklist items
- `"Alarms"` — if `alarm == true`
- `"Projects"` — if user tag `"Project"` is present
- `"Tasks"` — if status is a valid status value
- `"Notes"` — if no dates at all

---

## Frontend Components

### Main Dashboard (`src/frontend/js/dashboard/main.js` / `src/frontend/html/index.html`)

Tab-based view system with Calendar (week/day/month/year/itinerary), Checklists, Alarms, Projects, Tasks, and Notes views. Sidebar with date navigation, search, status filter, sort controls, and pinned/archived toggles. Calendar views use pixel-per-minute layout for timed events with overlap detection. Double-clicking any chit opens the editor.

### Chit Editor (`src/frontend/html/editor.html` / `src/frontend/js/editor/editor.js`)

Collapsible zones:
1. **Title** — text input + pinned/archived toggle buttons
2. **Weather** — compact weather strip (auto-loads for location)
3. **Dates & Times** — start, end, due dates with Flatpickr; all-day toggle
4. **Weight** — priority, severity, status dropdowns
5. **Location** — address input, map (OpenStreetMap iframe), directions button
6. **Tags** — checkbox list loaded from settings; user-defined tags with colors
7. **People** — comma-separated names
8. **Notes** — textarea with markdown render toggle; expandable modal
9. **Checklist** — full Checklist class with drag-drop, nesting, undo
10. **Alerts** — alarm/notification checkboxes (UI present, logic incomplete)
11. **Color** — swatch picker (default + custom colors from settings)
12. **Projects** — shown only for project master chits; renders child chits by status

### Checklist System (`src/frontend/js/editor/editor_checklists.js`)

Full `Checklist` class with nested items (up to 4 levels), drag-drop reordering, undo delete, checkbox toggling. Items stored as JSON array with `{id, text, level, checked, parent}` structure.

### Projects Zone (`src/frontend/js/editor/editor_projects.js`)

Kanban-style board for project master chits. Shows child chits in 4 status columns (ToDo, In Progress, Blocked, Complete) with drag-drop between columns. Can move chits between projects.

### Settings (`src/frontend/html/settings.html` / `src/frontend/js/pages/settings.js`)

Time format selector with drag-drop ordering, tag management with color picker, custom color management, visual indicators, chit options (fade past events, highlight overdue, delete past alarms), gender toggle, snooze length, default filters.

---

## Notable Features

- Soft delete (never hard-deleted)
- Drag-drop calendar rescheduling (15-min snap)
- Nested checklists with undo
- Weather integration via Open-Meteo
- Markdown notes with render toggle
- Color-coded chits with custom color palette
- Alarm/notification system with browser notifications
- Pinned/archived filtering
- Multi-view calendar (week, day, month, year, itinerary, 7-day)
- Responsive sidebar (toggle with logo click)
- Sort by title, start date, or due date

---

## Known Issues / In Progress

- Projects tab on main dashboard shows placeholder (not fully implemented)
- Alarms tab on main dashboard shows placeholder (not fully implemented)
- Recurrence field exists but logic not implemented
- Some UI regressions tracked in `AI Notes and Bugs.md`
