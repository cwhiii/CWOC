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

## Static Assets (`src/static/`)
- **`images/`** — all active images (logos, tab icons, parchment background, SVGs). New images go here.
- **`sounds/`** — audio files (alarm.mp3, timer.mp3). New audio goes here.
- **`archive/`** — unused images kept for reference (not served in production UI).
- **`fonts/`** — self-hosted Lora variable font.
- **`tracking/`** — smart-link provider SVG icons.
- **`vendor/`** — vendored JS/CSS libraries (Flatpickr, Font Awesome, Leaflet, etc.).
- URL pattern: `/static/images/filename.png`, `/static/sounds/filename.mp3`

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

### Android Room Migrations
- Room migrations live in `android/app/src/main/java/com/cwoc/app/data/local/migration/`.
- **ABSOLUTE RULE: Every schema change MUST have a corresponding Room migration.** The app must update in place like any normal app from the Play Store. Users must NEVER be asked to uninstall and reinstall just because the schema changed. Write the migration. No exceptions.
- **A deployed migration is burned.** Once a migration runs on a device, it never runs again. Never modify an already-deployed migration file — always create a new version (e.g., `MIGRATION_3_4`) to fix schema issues.
- **Every entity field must have a corresponding column in the migration SQL.** When adding fields to an entity, the migration that creates or alters that table MUST include those columns. If multiple subagents touch the same entity and migration, verify consistency before building.
- Register all migrations in `AppModule.provideCwocDatabase()` via `.addMigrations(...)`.
- Use `try/catch` around `ALTER TABLE ADD COLUMN` statements for idempotent migrations (safe to re-run if column already exists).
- **Never increment `@Database(version = N)` without a migration.** If you bump the version, you MUST provide a `Migration(oldVersion, newVersion)` that transforms the schema. Bumping without a migration = crash on update = unacceptable.
- **Corrupt/stale local data from bugs** must be fixed with a data-repair migration or a targeted re-sync mechanism (e.g., reset `since` to 0 for specific entity types), NOT by telling the user to wipe the app. Write code that fixes the data in place.

### Migration Cleanup (MANDATORY — Daily)
This is a single-user app. Once the user updates past a migration, it will never run again. Old migrations are dead code and must be cleaned up aggressively.

**Every time you touch the migration chain (add a new migration):**
1. Move ALL previous migration files to `android/app/src/main/java/com/cwoc/app/data/local/migration/archive/`. They have already run and will never run again — but keep them around for reference.
2. Rewrite the remaining migration as a single **baseline migration** that creates the current schema from scratch (full CREATE TABLE statements with all current columns, indexes, etc.).
3. Update `AppModule.provideCwocDatabase()` to reference only the current baseline migration.
4. The `@Database(version = N)` keeps incrementing as normal — the baseline migration just handles `Migration(N-1, N)` with the full current schema as ALTER TABLE ADD COLUMN statements for any new columns added in this version.

**Migration file naming:** Prefix every migration file with the date it was created in `YYYY-MM-DD_` format, followed by the migration description. Examples:
- `2026-05-24_Migration_14_15.kt`
- `2026-05-24_BaselineMigration_15_16.kt`

This applies to both active migrations and archived ones — the date stays in the filename forever so you can see when each was written.

**Result:** At any given time, there should be at most ONE or TWO migration files in the active migration directory — the current baseline and optionally the latest incremental change before it gets folded in. Never a long chain of historical migrations. Old ones live in `archive/` for reference only.

**Why this is safe:** There is exactly one device running this app. Once it updates, the old migration code is permanently dead. The archive is just in case you need to reference the history later.

### Subagent Verification (MANDATORY)
After dispatching multiple subagents that touch related files (e.g., entities + migrations + DAOs), **always verify consistency before declaring the work complete**:
1. Compare every entity's fields against the migration SQL that creates its table — every field must have a matching column with correct type, nullability, and default.
2. Check that all DAOs reference only columns that exist in the migration.
3. Check that all Hilt bindings exist for new interfaces/implementations.
4. If any mismatch is found, fix it immediately — do not leave it for the user to discover at runtime.

## API Pattern
REST endpoints under `/api/` — JSON in, JSON out. Fields like `tags`, `checklist`, `people`, `child_chits`, `alerts`, `recurrence_rule`, `recurrence_exceptions` are stored as JSON strings in SQLite and serialized/deserialized via helper functions.

## Deployment

**CORE PRINCIPLE: The app updates in place. Always.** Like any normal app from the Play Store, CWOC must never require the user to uninstall and reinstall. Every change — schema migrations, data fixes, sync resets — must be handled gracefully so the user just installs the update over the existing app and everything works.

**Server-only changes** (backend Python code):
- Push code to server and restart: the configurinator or `systemctl restart cwoc` handles it.

**Android app changes** (Kotlin code under `android/`):
- Rebuild the APK in Android Studio and install over the existing app (update in place).

**When a fix spans both** (e.g., server sends wrong data format that the app chokes on):
- Push the server fix first, then update the app (install over top). If the local DB has stale/corrupt data from the bug, the app code must include a data-repair migration or targeted re-sync that runs automatically on update — NOT a manual uninstall.

**Android app install types:**
- **Update (build → install over top):** The DEFAULT and ONLY normal deployment method. The existing DB, login state, and preferences are preserved. Migrations handle schema changes. Data-repair code handles corrupt data.
- **Uninstall + reinstall:** An ABSOLUTE LAST RESORT. The only legitimate reasons:
  - EncryptedSharedPreferences Keystore corruption that the existing try/catch recovery cannot handle
  - A catastrophic, unrecoverable situation where no migration or repair code can fix the state
  - **This should essentially never happen in practice.** If you find yourself recommending it, STOP and write proper migration/repair code instead.
- **Always state which one** in the fix summary. Don't just say "reinstall" — say "clean build → update" or "build → update" explicitly.
- **EVERY mobile deploy requires a build.** A regular build (Run button) is sufficient for most changes. A **clean build** is only needed when adding/removing Hilt-annotated classes, changing Room DAO interfaces or entities, or when the build cache seems stale. Always say "build → ..." or "clean build → ..." before the install instruction.

**Handling scenarios that previously required reinstall:**
- **Schema change** → Write a Room migration. Always. No exceptions.
- **Corrupt local data from a sync bug** → Write a one-time data-repair migration that detects and fixes the bad data, OR add a mechanism to reset the sync cursor for affected entity types so they re-sync cleanly.
- **SharedPreferences key rename** → Write migration code in `Application.onCreate()` that reads the old key, writes to the new key, and deletes the old one.
- **Need a fresh full sync** → Reset the `since` value to 0 programmatically (in a migration or version-check block), triggering a full re-sync on next sync cycle without losing local state.

**Fetching remote logs for debugging:**
- Run `bash fetch-logs.sh` from a terminal on this machine to pull `/api/client-log` and `/api/server-log` into `.kiro/client-log.json` and `.kiro/server-log.json` (readable by Kiro's file tools).
- The terminal sandbox cannot reach 192.168.1.111 directly (macOS firewall/sandbox restriction), so always use the fetch-logs script or ask the user to run it.

## Deployment Communication (MANDATORY)
**After EVERY code change, explicitly state what needs to be deployed:**
- "Server push only" — only backend Python changed
- "Mobile: build → update" — only Android code changed, regular build sufficient
- "Mobile: clean build → update" — Android code changed, clean build needed (Hilt/Room/DAO changes)
- "Server push + mobile: build → update" — both changed, regular build sufficient
- "Server push + mobile: clean build → update" — both changed, clean build needed

**"Uninstall + reinstall" is NOT a valid deployment instruction** except in catastrophic Keystore corruption scenarios. If you think data needs to be repaired, write repair code — don't tell the user to wipe the app.

**Never leave the user guessing.** Every fix summary ends with a clear deployment instruction.

### Deployment Quick-Reference Table

| Instruction | Server Push? | Android Studio Action | Phone Action |
|---|---|---|---|
| Server push only | Yes (`systemctl restart cwoc`) | Nothing | Nothing |
| Mobile: build → update | No | Build | Update |
| Mobile: clean build → update | No | Clean Build | Update |
| Server push + mobile: build → update | Yes (`systemctl restart cwoc`) | Build | Update |
| Server push + mobile: clean build → update | Yes (`systemctl restart cwoc`) | Clean Build | Update |

**MANDATORY:** After completing ANY task or set of changes, the LAST thing said MUST be one full row from the table above, followed by the version number(s) that were set. No exceptions. Do not abbreviate. Do not paraphrase. Copy the exact row that applies, then on the next line state the version (e.g., `Version: cwoc_server-20260523_1237`).

## EncryptedSharedPreferences & Keystore
The app uses `EncryptedSharedPreferences` with Android Keystore for secure token storage. The Keystore key can become corrupted/invalidated after repeated uninstall/reinstall cycles. The `AppModule.provideEncryptedSharedPreferences()` has a try/catch that handles this by deleting the corrupted prefs file and recreating. If you ever see a crash with `KeyStoreException: Signature/MAC verification failed`, this is the cause — the recovery logic should handle it automatically. If it doesn't, a full uninstall clears the Keystore entry.
