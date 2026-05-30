# C.W.'s Omni Chits (CWOC)

A self-hosted, multi-user task, note, calendar, and email management system. The core concept is a **chit** — a single flexible record that can serve as a task, note, calendar event, alarm, checklist, project, email, or habit, all using one unified data model.

A single chit can appear in multiple views depending on which fields are filled in. The backend auto-assigns system tags based on chit properties, so you never have to manually categorize anything — just fill in the fields that matter and CWOC figures out where it belongs. Multiple users get their own accounts with granular sharing — chit-level and tag-level sharing with viewer/manager roles, RSVP accept/decline, assignment, and stealth mode for private chits.

Available as a **web app** (desktop + mobile browser) and a **native Android app** (Kotlin/Compose with offline support). Learn more at [cwholemaniii.com/cwoc](https://www.cwholemaniii.com/cwoc).

## Install

One command on a fresh Debian/Ubuntu or Fedora/RHEL machine:

```bash
curl -sSL https://your-release-url/configurinator.sh | sudo bash
```

That's it. Open `https://your-server-ip` in a browser. For technical details, local development setup, and service management, see [technical_details.md](technical_details.md).

### Android App

A native Android app is included at `install/cwoc_android_app.apk`. This is a full Kotlin/Compose client with offline Room caching, bidirectional sync, push notifications, and Tailscale network fallback — not a browser wrapper. To install, download the APK to your phone from your CWOC server and sideload it. The app connects to your server URL on first launch.

---

## The C CAPTN E Views

Chits are organized into views called **C CAPTN E**:

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates/times — week, day, month, year, itinerary, work hours, and X-day views |
| **C**hecklists | Chits with checklist items — nested, drag-drop, multi-select, undo |
| **A**lerts | Chits with alarms, notifications, timers, or stopwatches — plus an independent alerts board and notifications inbox |
| **P**rojects | Project master chits with child chits in Kanban-style boards |
| **T**asks | Chits with a status — ToDo, In Progress, Blocked, Complete — plus Habits and Timeline views |
| **N**otes | Chits with markdown content (also Notebook view combining Notes + Checklists) |
| **E**mail | Emails synced via IMAP and treated as chits — inbox, sent, drafts, scheduled, archive with compose, reply, forward, and bundles |
| **I**ndicators | Health trend charts — heart rate, blood pressure, SpO2, temperature, weight, glucose, and more |

Additional views accessible from the sidebar and navigation:
- **Omni View** — configurable multi-section dashboard (Reminders, Email, Habits, Chrono, On Deck, Soon, Pinned, Events & Weather)
- **Maps** — all chits and contacts with locations plotted on an interactive map
- **Badges** — smart link detection command center (packages, flights, hotels, rentals, events, restaurants, transit, orders)
- **Global Search** — full-text search across all chit fields with FTS5 relevance ranking

---

## Features

### Dashboard
- Tab-based view system with Calendar, Checklists, Alerts, Projects, Tasks, Notes, Email, Indicators, and Global Search
- Collapsible sidebar with date navigation, sort controls, period selection, and multi-faceted filtering (text, status, priority, tags, people, show/hide options)
- Per-tab default filters configurable in Settings
- Full keyboard navigation with hotkeys for virtually every action — press `R` for the reference overlay
- Omni View: configurable multi-section dashboard with drag-to-reorder sections, color modes, and hide-when-empty toggles
- Cross-tab sync via BroadcastChannel with leader election for alarm coordination

### Multi-User System
- Login page with username/password authentication
- Multiple user accounts with independent settings, tags, and data
- User switching from the profile dropdown (password-protected)
- User administration page (admin-only) for creating/managing accounts
- Profile page with display name, avatar, and account settings
- Device token management for push notifications
- Session management with secure token storage

### Sharing
- Chit-level sharing: share individual chits with other users as viewer or manager
- Tag-level sharing: share entire tag trees — all chits with that tag become visible to the recipient
- Roles: Viewer (read-only) and Manager (can edit)
- RSVP: accept/decline shared chits (calendar events)
- Assignment: assign chits to other users
- Stealth mode: hide shared chits from specific users without revoking access

### Calendar
- Seven period views: Itinerary, Day, Week, Work Hours, X Days, Month, Year
- Drag-and-drop rescheduling with configurable snap intervals
- Drag bottom edge to resize events
- Shift+click for Quick Edit modal
- Double-click empty space to create a chit at that time
- Weather data displayed on calendar event cards
- Configurable work hours, work days, week start day, and scroll-to hour
- Swipe navigation on mobile
- ICS calendar file import

### Chit Editor
- Collapsible zones: Title, Email, Attachments, Dates & Times, Task (status/priority/severity), Location (with map and weather), Tags, People, Notes (markdown with render toggle), Checklist, Alerts, Health Indicators, Color, Projects, Prerequisites, Nest/Thread, Custom Zones
- Save & Stay / Save & Exit workflow with unsaved-changes detection and auto-save
- QR code generation (data QR and link QR)
- Audit log link per chit
- Print functionality

### Recurrence
- Repeating patterns: Daily, Weekly, Monthly, Yearly, Custom
- Per-instance editing: edit series, edit single instance, or break off and edit
- Drag prompts for recurring events: this instance / all in series / all following
- Recurrence exceptions stored per-chit

### Checklists
- Nested items up to 4 levels deep
- Drag-and-drop reordering
- Multi-select with Ctrl+click and Shift+click range selection
- Batch toolbar: indent, outdent, delete, copy selected
- Copy button per item (clipboard)
- Undo delete
- Checkbox toggling from any view
- File upload as checklist items

### Alerts System
- Four alert types: Alarms, Notifications, Timers, Stopwatches
- Alarms trigger browser notifications with sound (macOS, Linux, Android)
- Notifications fire relative to a chit's start or due time (before/after)
- Independent Alerts board — quick alarms, timers, and stopwatches not tied to any chit
- Notifications inbox with pending/dismissed/snoozed states
- Snooze and dismiss with configurable snooze length
- Optional "delete chit after dismissal"
- Cross-tab alarm coordination (only one tab fires the alarm)
- Push notifications via Ntfy (phone notifications even when browser is closed)

### Habits
- Any chit can become a habit — toggle with the 🎯 button in the Task zone
- Configurable goal per period (e.g., 3 times per day) with progress tracking (X / Y)
- Cycle frequencies: Daily, Weekly, Monthly, Yearly — auto-resets at the start of each period
- Weekly day-of-week selection for specific days
- Dedicated Habits view in the Tasks tab with progress bars and completion status
- Per-period history log with inline editing of past entries
- Charts: completion bar chart, success rate trend, and streak timeline
- Notifications can fire relative to the end of the habit cycle ("before end of day/week/month") with a "disable if done" option
- Show/hide habits on the calendar independently of other recurring chits

### Timeline View
- Dependency graph visualization for tasks
- Drag to create dependency links between chits
- Critical path highlighting
- Zoom controls (0.25x–3.0x) with recenter
- Layout modes: by date and by dependency

### Email
- Built-in email client that treats emails as chits — every email is a first-class chit with email-specific fields
- Connects to Gmail via IMAP/SMTP using Python stdlib (`imaplib`, `smtplib`, `email`)
- Email account configuration in Settings: IMAP host/port, SMTP host/port, username, Gmail App Password
- Password encryption using `cryptography.fernet.Fernet`
- Folder sidebar: Inbox, Sent, Drafts, Scheduled, Archive, Trash
- Check Mail button for manual IMAP sync; auto-check on configurable interval
- Unread count badge on the Email tab
- Email Bundles: auto-categorization with drag-drop reordering, rule-based classification, Unify button to show all in one flat list
- Multi-select with bulk archive, bulk tag, bulk read/unread toggle
- Email editor zone with To/CC/BCC fields, contact autocomplete, and email body textarea
- Reply and Forward buttons create new draft chits with proper threading headers
- HTML email rendering in a sandboxed iframe with DOMPurify sanitization; HTML/Text toggle
- Thread view showing related emails matched by headers and normalized subject line
- Print email from context menu

### Badges (Smart Link Detection)
- Dedicated command-center page consolidating all active and recently-completed smart link detections
- Categories: packages, flights, hotels, rentals, events, restaurants, transit, orders
- Auto-detected from email content using a Python detector registry
- Staleness indicators, dismiss, refresh controls
- Badge persistence with deduplication and auto-completion (email-based and date-based)

### Rules Engine
- Rules Manager page listing all rules with enable/disable toggles
- Rule Editor with condition trees and OR groups
- Conditions: field matches, date ranges, tag presence, status, priority, people, location
- Actions: auto-tag, set status, set priority, move to project, send notification, email bundle assignment
- "Create a Rule" from chit context menu (pre-fills conditions from the chit)
- Weather-based notification rules (e.g., "notify if rain tomorrow")

### Custom Objects
- Custom data zones in the chit editor
- Custom objects editor page for defining object schemas
- Configurable fields with types (text, number, date, select, etc.)
- Integration with the Indicators view for charting custom data

### Maps View
- Interactive map (Leaflet + OpenStreetMap) showing chits and contacts with locations
- Filter by date, tags, people
- Home/Reset View button (animates to default location)
- My Location button
- Saved locations from Settings
- Directions links (Google Maps or OpenStreetMap)

### Attachments
- File attachments zone in the chit editor with drag-drop upload or file picker
- File list with filename, size, download link, and delete button
- Files stored on disk at `/app/data/attachments/{chit_id}/`
- Configurable max file size (5/10/25/50 MB) in Settings
- Dedicated attachments page for browsing all attachments across chits
- File upload as note content or checklist items

### Projects
- Kanban-style board with four status columns (ToDo, In Progress, Blocked, Complete)
- Drag-and-drop between columns
- List and Kanban view modes
- Move chits between projects
- Prerequisites/dependencies between chits with auto-block/unblock

### Notes & Notebook
- Multi-column masonry layout with rendered markdown
- `[[chit title]]` auto-links to other chits
- Shift+click to edit in place
- Notebook view: combined Notes + Checklists in a single masonry layout
- File upload as note content
- Mobile markdown toolbar with heading buttons and block formats

### Tags
- UUID-based tag identification with rename atomicity
- Hierarchical tags with `/` nesting (e.g., `Work/Projects/CWOC`)
- Color-coded with child tags inheriting parent color
- Favorites appear at top
- Tag editor in Settings with tree view, bulk select, bulk share, bulk delete
- Tag-level sharing with other users

### People & Contacts
- Full contact editor: name fields (prefix, given, middle, surname, suffix, nickname), phone, email, address, social/web, security (Signal, PGP), context (organization, social context), notes (markdown), tags, color
- Profile image upload
- Favorite contacts
- Import/export contacts as .vcf or .csv
- QR code sharing (vCard format)
- People assigned to chits appear in the People filter
- Contact trash (separate from chit trash)

### Weather
- Dashboard weather modal with default location forecast
- Dedicated Weather page with 16-day forecast table for all saved locations
- Chit-level weather: auto-loads when a chit has both a location and a date
- Server-side automatic weather refresh (hourly for 7-day, daily for 8–16 day)
- City rows from chits — auto-adds forecast rows for cities with upcoming chits
- Drag-to-reorder location rows
- HST Weather Strip with temperature bars on the dashboard

### Kiosk Mode
- Dedicated kiosk page for always-on display
- Configurable tags and users to show
- Auto-refresh on configurable interval
- Designed for wall-mounted tablets or spare screens

### Clocks
- Four clock formats: 24-hour, 12-hour, 12-hour analog, and HST (Holeman Simplified Time)
- Drag clocks between Active and Inactive zones in Settings
- Horizontal or vertical layout

### Calculator
- Built-in calculator accessible from the editor and other pages
- Standard arithmetic operations
- Keyboard-accessible

### Cron Triggers & Automation
- Scheduled triggers that fire at configurable intervals
- Habit rules: auto-create recurring chits based on schedules
- Integration with the Rules Engine for automated actions

### Settings (5 tabs)
- **General:** Username, time format, sex toggle, snooze length, calendar snap, timezone, default view, view order, sort order, chit options, visual indicators, custom filters, install as app (PWA), unit system, clocks
- **Views:** Time periods (calendar configuration), Omni View layout, map settings, habits, default notifications
- **Collections:** Tags (tree editor with bulk actions), custom colors (unified 27-color palette + user custom), saved locations
- **Email:** IMAP/SMTP account configuration, badges settings, email bundles
- **Administration:** Data management (import/export), dependent apps (Ntfy, Tailscale), Home Assistant, kiosk, version & updates (one-click upgrade), Restic backup, network access, log limits

### Restic Backup
- Local and remote backup targets (SFTP, S3, B2, Azure, GCS, REST, rclone)
- Scheduled automatic backups
- Restore from snapshots with snapshot browser
- Manual prune, download, and remove operations
- Disk usage breakdown (App vs Backups) in Settings
- Orphaned repository detection

### Audit Log
- Tracks all changes: chits, contacts, independent alerts, settings, system upgrades
- Actor attribution (username, defaults to "Unknown Gremlin")
- Field-level diffs showing old → new values
- Filterable by entity type, actor, date range
- Sortable columns with drag-and-drop column reordering
- CSV export and configurable auto-pruning
- Per-chit and per-contact deep links

### Trash
- Soft delete throughout — chits are never hard-deleted
- Restore or permanently purge individual or bulk-selected chits
- Separate contact trash for deleted contacts

### Data Management
- Export/import chit data and user data as self-contained JSON files
- Add mode (merge) or Replace mode (overwrite)
- Files include metadata: CWOC version, export timestamp, instance ID

### About & Support
- About page with app overview, creator info, philosophy, tech stack
- About modal accessible from every page footer (shrink-animates to sidebar on first login)
- Buy Me a Coffee / PayPal support link
- Help page with searchable documentation (45 topics)

### Other
- Global Search across all chit fields with highlighted matches — powered by SQLite FTS5 full-text search with relevance ranking
- Visual indicators on chit cards (alarm, notification, timer, stopwatch, weather, people, health)
- Unified color picker: 27-color default palette + user custom colors across all platforms
- Pinned and archived chit filtering
- QR code generation for chits and contacts
- Real-time sync via WebSocket with HTTP polling fallback
- Cross-tab sync via BroadcastChannel with leader election
- ESC key layered modal handling
- Print functionality (checklists, emails)
- Smart links: auto-detection of package tracking, flights, hotels from email content

---

## Android App (32 Screens)

The native Android app is a full-featured Kotlin/Compose client — not a WebView wrapper:

- **Offline support:** Room database caching for all entities (chits, contacts, settings, weather, badges)
- **Bidirectional sync:** SyncEngine with delta sync, conflict resolution, and full re-sync capability
- **Push notifications:** Firebase-free push via Ntfy with action buttons (Open, Snooze, Dismiss)
- **Tailscale fallback:** Auto-switches to Tailscale IP when primary server is unreachable, with banner indicator and periodic primary reconnect
- **All views:** Calendar, Checklists, Alerts, Projects, Tasks, Notes, Email, Indicators, Omni, Maps, Badges, Search, Notebook
- **Full editor:** All zones from the web editor
- **Settings:** All settings tabs with native UI
- **Backup:** Restic backup management from the app
- **ICS import:** "Open with" handler for .ics calendar files
- **Custom objects, Rules, Kiosk, Help, About** — full parity with web

---

## Optional Services

| Service | Purpose |
|---|---|
| **[Tailscale](https://tailscale.com/)** | Mesh VPN for secure remote access — reach CWOC from anywhere without port forwarding. Android app auto-falls back to Tailscale IP when primary is unreachable. Configured in Settings → Dependent Apps. |
| **[Ntfy](https://ntfy.sh/)** | Push notifications to your phone for alarms, timers, and reminders — even when the browser is closed. Each notification has Open, Snooze, and Dismiss buttons. Requires Tailscale or your own VPN/tunnel back to the server for remote delivery. |
| **[Home Assistant](https://www.home-assistant.io/)** | Smart home integration via HACS custom component. Exposes chit data as sensors and provides services for creating/updating chits from HA automations. |
| **[Restic](https://restic.net/)** | Encrypted, deduplicated backups to local or remote storage (SFTP, S3, B2, Azure, GCS, REST, rclone). Managed from Settings → Administration. |

All are optional. CWOC works fully without them. The install script handles Tailscale and Ntfy automatically.

---

## Visual Theme

1940s parchment/magic aesthetic with brown tones, Lora serif font (self-hosted variable font), and parchment background textures.

---

## License

All rights reserved. Built with care, shared with friends.

Created by C.W. Holeman III — [www.cwholemaniii.com](https://www.cwholemaniii.com/pages/home.shtml) · [Support](https://www.paypal.com/paypalme/cwhiii)

For technical details on architecture, database schema, API endpoints, and project structure, see [technical_details.md](technical_details.md).
