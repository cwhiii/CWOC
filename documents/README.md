# C.W.'s Omni Chits (CWOC)

A multi-user task, note, and calendar management web app with a built-in email client. The core concept is a **chit** — a single flexible record that can serve as a task, note, calendar event, alarm, checklist, project, or email, all using one unified data model.

A single chit can appear in multiple views depending on which fields are filled in. The backend auto-assigns system tags based on chit properties, so you never have to manually categorize anything — just fill in the fields that matter and CWOC figures out where it belongs. Multiple users get their own accounts with granular sharing — chit-level and tag-level sharing with viewer/manager roles, RSVP accept/decline, assignment, and stealth mode for private chits.

## Install

One command on a fresh Debian/Ubuntu or Fedora/RHEL machine:

```bash
curl -sSL https://your-release-url/configurinator.sh | sudo bash
```

That's it. Open `https://your-server-ip` in a browser. For technical details, local development setup, and service management, see [technical_details.md](technical_details.md).

## The C CAPTN E Views

Chits are organized into seven views called **C CAPTN E**:

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates/times — week, day, month, year, itinerary, work hours, and X-day views |
| **C**hecklists | Chits with checklist items — nested, drag-drop, undo |
| **A**lerts | Chits with alarms, notifications, timers, or stopwatches — plus an independent alerts board |
| **P**rojects | Project master chits with child chits in Kanban-style boards |
| **T**asks | Chits with a status — ToDo, In Progress, Blocked, Complete |
| **N**otes | Chits with markdown content |
| **E**mail | Emails synced via IMAP and treated as chits — inbox, sent, drafts with compose, reply, and forward |
| **I**ndicators | Health trend charts — heart rate, blood pressure, SpO2, temperature, weight, glucose, and more |

---

## Features

### Dashboard
- Tab-based view system with Calendar, Checklists, Alerts, Projects, Tasks, Notes, Email, and Global Search
- Collapsible sidebar with date navigation, sort controls, period selection, and multi-faceted filtering (text, status, priority, tags, people, show/hide options)
- Per-tab default filters configurable in Settings
- Full keyboard navigation with hotkeys for virtually every action — press `R` for the reference overlay

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

### Habits
- Any chit can become a habit — toggle with the 🎯 button in the Task zone
- Configurable goal per period (e.g., 3 times per day) with progress tracking (X / Y)
- Cycle frequencies: Daily, Weekly, Monthly, Yearly — auto-resets at the start of each period
- Dedicated Habits view in the Tasks tab with progress bars and completion status
- Per-period history log with inline editing of past entries
- Charts: completion bar chart, success rate trend, and streak timeline
- Notifications can fire relative to the end of the habit cycle ("before end of day/week/month") with a "disable if done" option
- Show/hide habits on the calendar independently of other recurring chits

### Email
- Built-in email client that treats emails as chits — every email is a first-class chit with email-specific fields
- Connects to Gmail via IMAP/SMTP using Python stdlib (`imaplib`, `smtplib`, `email`)
- Email account configuration in Settings: IMAP host/port, SMTP host/port, username, Gmail App Password
- Password encryption using `cryptography.fernet.Fernet` (base64 fallback on dev); encryption key stored at `data/email.key`
- Emails auto-tagged with `CWOC_System/Email` and folder sub-tags (`CWOC_System/Email/Inbox`, `/Sent`, `/Drafts`); the `CWOC_System/` tag prefix is reserved
- Email dashboard tab with inbox-style list view sorted by date descending
- Folder sidebar: Inbox, Sent, Drafts
- Check Mail button for manual IMAP sync; auto-check on configurable interval (manual, 5/15/30/60 min)
- Unread count badge on the Email tab
- Multi-select with bulk archive and bulk tag (shared tag picker)
- Shift+click to toggle read/unread on email cards; bulk Mark Read/Unread in the selection bar
- Email editor zone in the chit editor with To/CC/BCC fields, contact autocomplete, and email body textarea with expand modal
- CC/BCC hidden by default with toggle buttons
- Reply and Forward buttons create new draft chits with proper threading headers (In-Reply-To, References)
- Send button saves then sends via SMTP; Save as Draft / Save & Send replace normal save buttons for email chits
- HTML email rendering in a sandboxed iframe with DOMPurify sanitization; HTML/Text toggle for switching views
- Thread view below the email body showing related emails matched by headers and normalized subject line

### Attachments
- File attachments zone in the chit editor with drag-drop upload or file picker
- File list with filename, size, download link, and delete button
- Files stored on disk at `/app/data/attachments/{chit_id}/`; metadata stored as JSON in the chit's `attachments` column
- Configurable max file size (5/10/25/50 MB) in Settings

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
- Dashboard weather modal with default location forecast
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
- Email Account: IMAP/SMTP server configuration, username, encrypted app password, auto-check interval
- Attachments: configurable max file size (5/10/25/50 MB)
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
- Global Search across all chit fields with highlighted matches — powered by SQLite FTS5 full-text search with relevance ranking (falls back to LIKE queries if FTS5 unavailable)
- Visual indicators on chit cards (alarm, notification, timer, stopwatch, weather, people, health)
- Color-coded chits with custom color palette
- Pinned and archived chit filtering
- QR code generation for chits and contacts
- Real-time sync via WebSocket
- ESC key layered modal handling

---

## Optional Services

| Service | Purpose |
|---|---|
| **[Tailscale](https://tailscale.com/)** | Mesh VPN for secure remote access — reach CWOC from anywhere without port forwarding. Configured in Settings → Dependent Apps. |
| **[Ntfy](https://ntfy.sh/)** | Push notifications to your phone for alarms, timers, and reminders — even when the browser is closed. Each notification has Open, Snooze, and Dismiss buttons. Requires Tailscale or your own VPN/tunnel back to the server for remote delivery. |

Both are optional. CWOC works fully without them. The install script handles both automatically.

---

## Visual Theme

1940s parchment/magic aesthetic with brown tones, Lora serif font, and parchment background textures.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Created by C.W. Holeman III — [www.cwholemaniii.com](https://www.cwholemaniii.com/pages/home.shtml)

For technical details on architecture, database schema, API endpoints, and project structure, see [technical_details.md](technical_details.md).
