# CWOC — How It Works

*Reference documentation for C.W.'s Omni Chits. Last updated: 2026-04-24.*

---

## 1. What Is This Project?

**C.W.'s Omni Chits (CWOC)** is a personal task/note management web app with a built-in email client. The core concept is a "chit" — a flexible record that can be a task, note, calendar event, alarm, checklist, project, or email, all in one data model. The app organizes chits into seven functional views called **C CAPTN E**:

- **C**alendar — chits with dates/times
- **A**larms — chits with alarm flags
- **P**rojects — chits that are "project masters" with child chits (Kanban-style)
- **T**asks — chits with a status (ToDo / In Progress / Blocked / Complete)
- **N**otes — chits with note content and no dates
- **E**mail — emails synced via IMAP and treated as chits

Deployed on a **Proxmox LXC container** (ID 111, host: Zamonia) at `http://192.168.1.111:3333`.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Browser (Vanilla JS / HTML / CSS)                  │
│  frontend/index.html  ← main dashboard              │
│  frontend/editor.html ← chit editor                 │
│  frontend/settings.html ← settings panel            │
│  frontend/main.js     ← view rendering & tabs       │
│  frontend/editor.js   ← editor logic                │
│  frontend/editor_checklists.js ← Checklist class    │
│  frontend/editor_projects.js   ← Projects Zone      │
│  frontend/editor-email.js      ← Email Zone         │
│  frontend/editor-attachments.js ← Attachments Zone  │
│  frontend/main-email.js        ← Email tab          │
│  frontend/settings.js ← settings logic              │
│  frontend/styles.css / editor.css                   │
└────────────────────┬────────────────────────────────┘
                     │ REST API (fetch)
┌────────────────────▼────────────────────────────────┐
│  FastAPI (Python 3) — backend/main.py               │
│  Uvicorn on port 3333                               │
│  SQLite — /app/data/app.db                          │
│  Email — IMAP/SMTP via Python stdlib                │
└─────────────────────────────────────────────────────┘
```

**No frontend framework** — pure vanilla JS. No build step, no bundler.

**External dependencies (CDN):**
- Flatpickr (date/time picker)
- Font Awesome 6 (icons)
- marked.js (markdown rendering in notes)
- DOMPurify 3.0.6 (HTML email sanitization)

**Server-only dependencies:**
- cryptography (Fernet encryption for email passwords; base64 fallback on dev)

**External APIs:**
- OpenStreetMap Nominatim — geocoding (address → lat/lon)
- Open-Meteo — weather forecast (free, no API key)
- Gmail IMAP/SMTP — email sync and send (configured per-user in Settings)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn (Python 3) |
| Database | SQLite3 (stdlib) |
| Full-Text Search | SQLite FTS5 (virtual table with sync triggers) |
| Validation | Pydantic v1 |
| Email | Python stdlib (imaplib, smtplib, email) |
| Encryption | cryptography.fernet.Fernet (server-only) |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Date picker | Flatpickr (CDN) |
| Icons | Font Awesome 6 (CDN) |
| Markdown | marked.js (CDN) |
| HTML Sanitization | DOMPurify 3.0.6 (CDN) |
| Geocoding | OpenStreetMap Nominatim |
| Weather | Open-Meteo API |

---

## 4. Database Schema

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
| email_message_id | TEXT | RFC 2822 Message-ID |
| email_from | TEXT | Sender address |
| email_to | TEXT | JSON array of recipient addresses |
| email_cc | TEXT | JSON array of CC addresses |
| email_bcc | TEXT | JSON array of BCC addresses |
| email_subject | TEXT | Subject line (also mapped to chit title) |
| email_body_text | TEXT | Plain-text body content |
| email_body_html | TEXT | HTML body content for rich rendering |
| email_date | TEXT | ISO 8601 date from email Date header |
| email_folder | TEXT | inbox / sent / drafts |
| email_status | TEXT | draft / sent / received |
| email_read | BOOLEAN | Read/unread state |
| email_in_reply_to | TEXT | In-Reply-To Message-ID |
| email_references | TEXT | References header (space-separated Message-IDs) |
| attachments | TEXT | JSON array of `{id, filename, size, mime_type, uploaded_at}` |

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
| email_account | TEXT | JSON: IMAP/SMTP host, port, username, encrypted password |
| attachment_max_size_mb | TEXT | Max attachment file size in MB (default 10) |

---

## 5. API Endpoints

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

**Auto-generated system tags** (added by backend on create/update):
- `"Calendar"` — if has `due_datetime` or `start_datetime`
- `"Checklists"` — if has checklist items
- `"Alarms"` — if `alarm == true`
- `"Projects"` — if user tag `"Project"` is present
- `"Tasks"` — if status is a valid status value
- `"Notes"` — if no dates at all

---

## 6. Frontend — Main Dashboard (`main.js` / `index.html`)

### Tab System
Sidebar tab buttons for Calendar, Checklists, Alarms, Projects, Tasks, Notes. `currentTab` tracks the active tab. `displayChits()` dispatches to the appropriate render function.

### Calendar Views
- **Week** — 7-column grid, hour rows (1px = 1 minute), timed events positioned with `top`/`height` in px. All-day events in a separate strip.
- **Day** — Single column, same pixel-per-minute layout. Handles overlapping events.
- **Month** — CSS grid, 7 columns. Events shown as colored chips.
- **Year** — 12 mini-month grids. Days colored by chit density.
- **Itinerary** — Chronological list of future events grouped by day.
- **7-Day** — 7-day grid always starting from today.

### Filtering & Sorting
- Text search on title/description
- Status dropdown filter
- Sort by title, start date, or due date (▲/▼)
- Archive/pinned cycle filter (All → Pinned → Archived → Normal)

### Navigation
- `previousPeriod()` / `nextPeriod()` shift the current date range.
- Sidebar state persisted in `localStorage`.
- Keyboard shortcuts: 1–6 for tabs, I/D/W/M/Y/S for calendar views.

### Chit Interaction
- **Double-click** opens the editor: `window.location.href = /editor?id=${chit.id}`
- Now-bar (red line at current time, updates every minute)
- Auto-scroll to 6am on time-based views

---

## 7. Frontend — Chit Editor (`editor.js` / `editor.html`)

### Zones (Collapsible Sections)
1. **Title** — text input + pinned/archived toggle buttons
2. **Weather** — compact weather strip (loads when location + date present)
3. **Dates & Times** — start, end, due dates with Flatpickr; all-day toggle
4. **Weight** — priority, severity, status dropdowns
5. **Location** — address input, map (OpenStreetMap iframe), directions button
6. **Tags** — clickable badges in tree, active tags panel with remove buttons
7. **People** — comma-separated names
8. **Notes** — textarea with markdown render toggle; expandable modal; copy/download
9. **Checklist** — full `Checklist` class with drag-drop, nesting, undo
10. **Alerts** — inline widgets for alarms, timers, stopwatches, notifications
11. **Color** — swatch picker (default + custom colors from settings)
12. **Projects** — shown only for project master chits; Kanban child chits by status

### Save Flow
1. `buildChitObject()` collects all form values
2. `chitExists(id)` determines POST vs PUT
3. Sends to `/api/chits` or `/api/chits/{id}`
4. If project master, also calls `saveProjectChanges()`
5. Save & Stay updates URL without navigating; Save & Exit redirects to `/`

### Load Flow
1. `DOMContentLoaded` → `initializeChitId()` reads `?id=` from URL
2. If ID present → `loadChitData(id)` fetches and populates all fields
3. If project master → also calls `initializeProjectZone(id)`
4. `applyZoneStates(chit)` collapses empty zones, expands populated ones

### Date Handling
- Dates stored as ISO 8601 UTC strings in DB
- Display format: `YYYY-Mon-DD` (e.g. `2025-May-16`)
- All-day events: start `T00:00:00`, end `T23:59:59`; `all_day` flag persisted

### Color System
- 7 default named colors + custom colors from settings
- Selected color applied to editor background only (not header row)

---

## 8. Frontend — Checklist (`editor_checklists.js`)

Full `Checklist` class:
- Nested items up to 4 levels deep (`MAX_INDENT_LEVEL = 4`)
- Drag-and-drop reordering (moves entire subtrees)
- Tab/Shift+Tab indent/unindent
- Undo delete (stack-based)
- Items: `{id, text, level, checked, parent}`
- ESC on input calls `cancelOrExit()`

---

## 9. Frontend — Projects Zone (`editor_projects.js`)

For chits with `is_project_master = true`:
- `projectState` holds: current project chit, child chits map, all project masters
- `initializeProjectZone(id)` — fetches project + children, renders Kanban columns
- `renderChildChitsByStatus()` — 4 status columns with drag-drop
- `saveProjectChanges()` — saves child chit statuses/due dates via PUT
- Child chits can be moved between projects
- All changes mark editor as unsaved

---

## 10. Frontend — Settings (`settings.js` / `settings.html`)

- Time format selector with drag-drop ordering (5 clock types)
- Tag management: add/remove tags with color picker
- Custom color management
- Visual indicators configuration
- Chit options (fade past events, highlight overdue, delete past alarms)
- Gender toggle, snooze length, default filters
- ESC key triggers confirm-if-unsaved logic
- All saved to `/api/settings` as `default_user`

---

## 11. Prototype Files

| Prototype | Status |
|---|---|
| CWOC Alarms | Not integrated — has alarm.mp3, timer.mp3, full alarm UI |
| CWOC Checklists | Integrated (became `editor_checklists.js`) |
| CWOC Indicators | Not integrated — visual health/status indicators |
| CWOC Location | Partially integrated (location + map in editor) |
| CWOC Markdown Notes | Partially integrated (notes zone in editor) |
| CWOC Weather | Integrated (compact weather strip in editor) |
| CWOC UI | General UI experiments |
| _ DEMO | Multi-version editor experiments |
| _CWOC Frontend Merge | Snapshot before current state |
| _Post Merge/CWOC Settings | Settings UI iterations |
| _Waiting for Home Base/CWOC Email | Full Python email client — NOT integrated |

---

## 12. Design Intent (from Design Doc)

### Aesthetic
- **1940s + magic** — parchment and ivory. Courier New typewriter font.
- Header row does NOT change color when a chit color is picked.

### Chit "Types" — Key Criteria
| Type | Criteria |
|---|---|
| Reminder | Title + notification enabled |
| Event (Calendar) | Start & end dates |
| Task | Due date OR status set |
| Note | Has note content |
| Project | `is_project_master` checkbox enabled |
| Checklist | Has checklist items |

### Tab Definitions
- **Calendar** — any chit with a start date or due date
- **Checklists** — any chit with checklist items
- **Alarms** — any chit with `alarm == true`. Includes clock, stopwatch, timers
- **Projects** — Kanban boards for `is_project_master` chits
- **Tasks** — any chit with a non-null status OR a due date
- **Notes** — chits with note content and no date/project associations

### Full Intended Chit Properties

| Property | Implemented? | Notes |
|---|---|---|
| ID | ✅ | |
| Title | ✅ | |
| Note / Description | ✅ | |
| Due Date/Time | ✅ | |
| Start/End Date/Time | ✅ | |
| Recurrence | ⚠️ Field only | No logic |
| Priority | ✅ | |
| Status | ✅ | Missing null/"-" option |
| Tags/Labels | ✅ | |
| Children Chit IDs | ✅ | |
| Linked Chits | ❌ | |
| Group IDs | ❌ | |
| Attachments | ❌ | |
| Alarm Settings | ⚠️ | Boolean only |
| Color | ✅ | |
| Created/Modified DateTime | ✅ | |
| Location | ✅ | |
| Sequence / Manual Order | ❌ | |
| Duration | ❌ | |
| Visibility | ❌ | |
| Pinned | ✅ | |
| Archived | ✅ | |
| Completion Date/Time | ✅ | |
| Custom Fields | ❌ | |
| Sync Status | ❌ | |
| Home Assistant ID | ❌ | |
| Progress (%) | ❌ | |
| Dependencies | ❌ | |
| Time Estimate | ❌ | |
| Checklist | ✅ | |
| People | ⚠️ | Basic; no roles/modal |
| Severity | ✅ | |
| Busy/Free status | ❌ | |

---

## 13. Deployment / Ops

- Server: Proxmox LXC, Ubuntu 24.10, 2 cores, 1GB RAM, 16GB storage, IP `192.168.1.111`
- Upload: `rsync -av --exclude="*.rsls" -e "ssh -o PubkeyAuthentication=no" ./ root@192.168.1.111:/app/`
- Restart: `pkill -f 'uvicorn' && cd /app && source /app/venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug`
- DB path: `/app/data/app.db`
- Venv: `/app/venv/`

---

## 14. Security Observations

- **No authentication** — all endpoints open on the network
- **No CORS configuration** — FastAPI default allows all origins
- **No input sanitization** — markdown rendered via `marked.js` without sanitization
- **Hardcoded DB path** — should be an env var
- **Single user** — settings always use `"default_user"`

---

## 15. Performance Notes

- **No pagination** — `GET /api/chits` returns all chits every time
- **No caching** — every tab switch re-fetches all chits
- **Weather API** — no caching; Nominatim has rate limits
- **Calendar rendering** — all views re-render from scratch; no virtual DOM

---

## 16. File Map

```
/
├── backend/
│   └── main.py              ← FastAPI app, all endpoints, DB init
├── frontend/
│   ├── index.html           ← Main dashboard shell
│   ├── main.js              ← Tab/view rendering, calendar, filtering
│   ├── styles.css           ← Dashboard styles (parchment theme)
│   ├── editor.html          ← Chit editor form
│   ├── editor.js            ← Editor logic
│   ├── editor.css           ← Editor styles
│   ├── editor_checklists.js ← Checklist class
│   ├── editor_projects.js   ← Projects Zone (Kanban)
│   ├── settings.html        ← Settings form
│   └── settings.js          ← Settings logic
├── static/                  ← App icons and images
├── data/                    ← SQLite DB (created at runtime)
├── Prototypes/              ← Experimental/archived UI work
├── Tasks/
│   ├── Notes.md             ← This file
│   ├── Tasks.md             ← Open bugs & planned features
│   └── done.md              ← Completed items
├── documentation/
│   └── overview.md          ← Project overview
├── requirements.txt
├── start.sh
└── README.md
```
