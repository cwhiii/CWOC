# ♾️📜♾️ C.W.'s Omni Chits (CWOC)

A personal task, note, and calendar management web app. The core concept is a **chit** — a single flexible record that can serve as a task, note, calendar event, alarm, checklist, or project, all using one unified data model.

A single chit can appear in multiple views depending on which fields are filled in. The backend auto-assigns system tags based on chit properties, so you never have to manually categorize anything — just fill in the fields that matter and CWOC figures out where it belongs.

## The C CAPTN Views

Chits are organized into six views called **C CAPTN**:

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates/times — week, day, month, year, itinerary, work hours, and X-day views |
| **C**hecklists | Chits with checklist items — nested, drag-drop, undo |
| **A**lerts | Chits with alarms, notifications, timers, or stopwatches — plus an independent alerts board |
| **P**rojects | Project master chits with child chits in Kanban-style boards |
| **T**asks | Chits with a status — ToDo, In Progress, Blocked, Complete |
| **N**otes | Chits with markdown content |

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
uvicorn src.backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
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
- ESC key layered modal handling

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

## Visual Theme

1940s parchment/magic aesthetic with brown tones, Courier New font, and parchment background textures.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Created by C.W. Holeman III — [www.cwholemaniii.com](https://www.cwholemaniii.com/pages/home.shtml)

For deep technical details on architecture, database schema, API endpoints, and project structure, see [technical_details.md](technical_details.md).
