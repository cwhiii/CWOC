---
inclusion: always
---

# Tech Stack

## Backend
- **Framework**: FastAPI (Python 3) with Uvicorn
- **Database**: SQLite3 (Python stdlib) — single file at `/app/data/app.db`
- **Validation**: Pydantic v1 models
- **Port**: 3333

## Frontend
- **No framework** — vanilla JavaScript, HTML5, CSS3
- **No build step** — files served directly by FastAPI's StaticFiles
- **External CDN libs**: Flatpickr (date picker), Font Awesome 6 (icons), marked.js (markdown)
- **External APIs**: OpenStreetMap Nominatim (geocoding), Open-Meteo (weather)

## Visual Theme
- 1940s parchment/magic aesthetic with brown tones, Lora serif font (self-hosted variable font in `static/fonts/lora/`), parchment background textures
- CSS variables defined in `frontend/css/shared/shared-page.css` for secondary pages, `frontend/css/dashboard/styles-variables.css` for the dashboard

## Key Dependencies
- `fastapi`, `uvicorn`, `pydantic` (Python)
- No npm/node — no package.json, no bundler

## Common Commands

**Run the server locally:**
```bash
uvicorn src.backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
```

**Systemd service (production):**
```bash
systemctl restart cwoc
systemctl status cwoc
journalctl -u cwoc -f
```

## Database Migrations
Migrations are run inline at startup in `src/backend/main.py` (calling functions from `src/backend/migrations.py`) using `ALTER TABLE` statements. Each migration checks if the column already exists before adding it. There is no migration framework — just sequential function calls at module load time.

## API Pattern
REST endpoints under `/api/` — JSON in, JSON out. Fields like `tags`, `checklist`, `people`, `child_chits`, `alerts`, `recurrence_rule`, `recurrence_exceptions` are stored as JSON strings in SQLite and serialized/deserialized via helper functions.
