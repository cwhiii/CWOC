---
inclusion: always
---

# Project Structure

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
      people.html          # People / contacts list
      contact-editor.html  # Contact editor
      weather.html         # Weather forecast page
      trash.html           # Trash view
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
        styles-variables.css  # Dashboard CSS custom properties (loads first)
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

data/                      # SQLite database files

install/
  configurinator.sh        # Server provisioning script

documentation/
  overview.md              # Project overview and architecture documentation

Tasks/                     # Task tracking markdown files
Notes/                     # Project notes and context docs
Prototypes/                # Historical prototypes and experiments (not production code)
```

## Key Conventions
- Frontend pages that aren't the main dashboard use `shared-page.css` and `shared-page.js` for consistent styling and header/footer injection (triggered by `data-page-title` on `<body>`)
- `shared.js` is loaded before both `main.js` and `editor.js` — put reusable logic there
- `shared-utils.js` must load first among all shared sub-scripts
- The dashboard (`index.html` + `main.js` + dashboard CSS) has its own independent styling
- All JS is vanilla — no modules, no imports, just `<script>` tags in HTML load order
- Backend is modular: `main.py` (entry point) + `routes/` (6 route modules) + `db.py` + `models.py` + `migrations.py` + `weather.py` + `serializers.py`
- See `src/INDEX.md` for the complete code index with every function, class, and route
