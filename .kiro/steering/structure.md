---
inclusion: always
---

# Project Structure

```
backend/
  main.py              # FastAPI app — all routes, models, DB init, migrations

frontend/
  index.html           # Main dashboard (C CAPTN tab views)
  main.js              # Dashboard rendering, tab logic, calendar views, sidebar
  styles.css           # Dashboard-specific styles
  editor.html          # Chit editor page
  editor.js            # Editor logic (zones, save, load)
  editor.css           # Editor-specific styles
  editor_checklists.js # Checklist class (nested items, drag-drop, undo)
  editor_projects.js   # Projects zone (Kanban board for project master chits)
  settings.html        # Settings page
  settings.js          # Settings logic (tags, colors, indicators, options)
  help.html            # Help/about page
  trash.html           # Trash view (soft-deleted chits)
  shared.js            # Shared utilities across dashboard & editor (checklist toggle, manual sort, calendar drag, recurrence helpers)
  shared-page.js       # Shared page components for secondary pages (save system, auto header/footer injection)
  shared-page.css      # Shared styles for secondary pages (parchment theme)
  _template.html       # HTML template for new pages

static/               # Images and assets (logos, icons, parchment background)

data/                 # SQLite database files

Prototypes/           # Historical prototypes and experiments (not production code)
TMP/                  # Temporary/staging files from earlier development
Notes/                # Project notes and context docs
Tasks/                # Task tracking markdown files (Tasks.md, done.md)
documentation/        # Project documentation (overview.md)
```

## Key Conventions
- Frontend pages that aren't the main dashboard use `shared-page.css` and `shared-page.js` for consistent styling and header/footer injection (triggered by `data-page-title` on `<body>`)
- `shared.js` is loaded before both `main.js` and `editor.js` — put reusable logic there
- The dashboard (`index.html` + `main.js` + `styles.css`) has its own independent styling
- All JS is vanilla — no modules, no imports, just `<script>` tags in HTML load order
- Backend is a single `main.py` file — routes, models, migrations, and DB helpers all in one place
