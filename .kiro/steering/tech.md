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

## Deployment

**Server-only changes** (backend Python code):
- Push code to server and restart: the configurinator or `systemctl restart cwoc` handles it.

**Android app changes** (Kotlin code under `android/`):
- Rebuild the APK in Android Studio and install on device.

**When a fix spans both** (e.g., server sends wrong data format that the app chokes on):
- Push the server fix first, then reinstall the app (reinstall wipes the local Room DB and SharedPreferences, forcing a fresh login + full sync from `since=0`).
- Always state clearly in the fix summary: "push server, reinstall app" when both sides are involved or when the local DB has stale/corrupt data from the bug.

**Android app install types:**
- **Update (clean build → install over top):** Use when code changes don't affect the Room DB schema version or SharedPreferences key structure. The existing DB and login state are preserved. This is the default for most code changes.
- **Uninstall + reinstall (clean build → uninstall → install):** Required when:
  - Room `@Database(version = N)` is incremented without a migration
  - SharedPreferences keys are renamed or restructured
  - The local DB has corrupt/stale data from a bug that a fresh sync would fix
  - You need to force a fresh `since=0` full sync
- **Always state which one** in the fix summary. Don't just say "reinstall" — say "clean build → update" or "clean build → uninstall + reinstall" explicitly.
- **EVERY mobile deploy requires a build.** A regular build (Run button) is sufficient for most changes. A **clean build** is only needed when adding/removing Hilt-annotated classes, changing Room DAO interfaces or entities, or when the build cache seems stale. Always say "build → ..." or "clean build → ..." before the install instruction.

**Fetching remote logs for debugging:**
- Run `bash fetch-logs.sh` from a terminal on this machine to pull `/api/client-log` and `/api/server-log` into `.kiro/client-log.json` and `.kiro/server-log.json` (readable by Kiro's file tools).
- The terminal sandbox cannot reach 192.168.1.111 directly (macOS firewall/sandbox restriction), so always use the fetch-logs script or ask the user to run it.

## Deployment Communication (MANDATORY)
**After EVERY code change, explicitly state what needs to be deployed:**
- "Server push only" — only backend Python changed
- "Mobile: clean build → update" — only Android code changed, no schema/prefs changes
- "Mobile: clean build → uninstall + reinstall" — Android code changed AND Room schema version bumped or local data is stale
- "Server push + mobile: clean build → update" — both changed, no local data issues
- "Server push + mobile: clean build → uninstall + reinstall" — both changed AND local DB has stale/corrupt data

**Never leave the user guessing.** Every fix summary ends with a clear deployment instruction.

### Deployment Quick-Reference Table

| Instruction | Server Push? | Android Studio Action | Phone Action |
|---|---|---|---|
| Server push only | Yes (`systemctl restart cwoc`) | Nothing | Nothing |
| Mobile: build → update | No | Build → Build Bundle(s) / APK(s) → Build APK(s) | Install APK over existing app |
| Mobile: clean build → update | No | Build → Clean Project, then Build → Build Bundle(s) / APK(s) → Build APK(s) | Install APK over existing app |
| Mobile: build → uninstall + reinstall | No | Build → Build Bundle(s) / APK(s) → Build APK(s) | Uninstall app first, then install APK |
| Mobile: clean build → uninstall + reinstall | No | Build → Clean Project, then Build → Build Bundle(s) / APK(s) → Build APK(s) | Uninstall app first, then install APK |
| Server push + mobile: clean build → update | Yes (`systemctl restart cwoc`) | Build → Clean Project, then Build → Build Bundle(s) / APK(s) → Build APK(s) | Install APK over existing app |
| Server push + mobile: clean build → uninstall + reinstall | Yes (`systemctl restart cwoc`) | Build → Clean Project, then Build → Build Bundle(s) / APK(s) → Build APK(s) | Uninstall app first, then install APK |

**MANDATORY:** After completing ANY task or set of changes, the LAST thing said MUST be one full row from the table above. No exceptions. Do not abbreviate. Do not paraphrase. Copy the exact row that applies.

## EncryptedSharedPreferences & Keystore
The app uses `EncryptedSharedPreferences` with Android Keystore for secure token storage. The Keystore key can become corrupted/invalidated after repeated uninstall/reinstall cycles. The `AppModule.provideEncryptedSharedPreferences()` has a try/catch that handles this by deleting the corrupted prefs file and recreating. If you ever see a crash with `KeyStoreException: Signature/MAC verification failed`, this is the cause — the recovery logic should handle it automatically. If it doesn't, a full uninstall clears the Keystore entry.
