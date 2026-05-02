# Implementation Plan: PWA Wrapper

## Overview

Wrap CWOC as a Progressive Web App by adding a manifest, service worker, offline fallback, install prompt, and Web Push notifications. All PWA source files go in `src/pwa/`. Backend push route at `src/backend/routes/push.py`. No installs, no build tools — vanilla JS and Python stdlib only.

## Tasks

- [x] 1. Create PWA static files and manifest
  - [x] 1.1 Create `src/pwa/manifest.json` with all required fields
    - name, short_name, display, start_url, scope, theme_color, background_color, orientation, icons array (192 + 512)
    - _Requirements: 1.1–1.11_
  - [x] 1.2 Create placeholder icon files `src/pwa/cwoc-icon-192.png` and `src/pwa/cwoc-icon-512.png`
    - Scale from existing `src/static/cwod_logo.png` or create placeholder PNGs at correct dimensions
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.3 Create `src/pwa/offline.html` offline fallback page
    - CWOC parchment theme, friendly "no network" message, retry suggestion
    - Use `shared-page.css` for consistent styling
    - _Requirements: 6.1, 6.3, 6.4_

- [x] 2. Create service worker
  - [x] 2.1 Create `src/pwa/sw.js` with install, activate, fetch, push, and notificationclick handlers
    - **install**: pre-cache app shell URLs + offline.html
    - **activate**: delete old versioned caches
    - **fetch**: stale-while-revalidate for app shell; network-only for `/api/*`; passthrough for external origins
    - **push**: display notification from push payload JSON
    - **notificationclick**: focus/open app window, navigate to chit URL from payload
    - Use versioned cache name `cwoc-shell-v1`
    - Do NOT cache CDN resources (Flatpickr, Font Awesome, marked.js)
    - _Requirements: 4.3, 5.1–5.6, 6.1, 6.2, 6.5, 10.4, 11.8, 11.9_

- [x] 3. Create PWA registration script
  - [x] 3.1 Create `src/pwa/pwa-register.js`
    - `registerServiceWorker()`: check `'serviceWorker' in navigator`, register `/sw.js`, log success/failure
    - `captureInstallPrompt()`: listen for `beforeinstallprompt`, defer event, show install button
    - `handleInstallClick()`: trigger deferred prompt, hide button on accept/dismiss
    - Detect standalone mode (`window.matchMedia('(display-mode: standalone)')`) and hide install button if already installed
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 8.1–8.5_
  - [x] 3.2 Add push subscription logic to `src/pwa/pwa-register.js`
    - `subscribeToPush()`: fetch VAPID public key from `/api/push/vapid-public-key`, subscribe via `pushManager.subscribe()`, POST subscription to `/api/push/subscribe`
    - Handle re-subscription on subscription change
    - Only subscribe after notification permission granted
    - _Requirements: 11.2, 11.3, 11.4, 11.11_

- [x] 4. Checkpoint — Review PWA frontend files
  - Ensure all files in `src/pwa/` are complete and consistent. Ask the user if questions arise.

- [x] 5. Add PWA meta tags to all HTML pages
  - [x] 5.1 Add PWA `<head>` tags to all 14 HTML pages (excluding `_template.html`)
    - Add to: `index.html`, `editor.html`, `settings.html`, `people.html`, `contact-editor.html`, `weather.html`, `trash.html`, `audit-log.html`, `help.html`, `kiosk.html`, `login.html`, `user-admin.html`
    - Tags: `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable">`, `<meta name="apple-mobile-web-app-status-bar-style">`
    - Add `<script src="/pwa/pwa-register.js"></script>` before closing `</body>`
    - _Requirements: 2.1–2.5, 4.1_
  - [x] 5.2 Update `src/frontend/html/_template.html` with PWA tags as reference for future pages
    - Add the same PWA head tags and pwa-register.js script tag
    - _Requirements: 2.1–2.5_

- [x] 6. Add install button to dashboard sidebar
  - [x] 6.1 Add install button HTML to `src/frontend/html/index.html` sidebar
    - Hidden by default, shown when `beforeinstallprompt` fires
    - _Requirements: 8.2_
  - [x] 6.2 Add install button click handler in `src/frontend/js/dashboard/main-init.js`
    - Wire button to `handleInstallClick()` from pwa-register.js
    - _Requirements: 8.3, 8.4, 8.5_

- [x] 7. Backend: serve SW and manifest, add push migrations
  - [x] 7.1 Add routes in `src/backend/main.py` to serve `/sw.js` and `/manifest.json` from `src/pwa/`
    - Serve with correct Content-Type headers and `Service-Worker-Allowed: /`
    - These routes must be publicly accessible (no auth required)
    - Mount `src/pwa/` static files for icon serving
    - _Requirements: 1.1, 1.11, 4.2, 9.1–9.4, 12.3, 12.4, 12.5_
  - [x] 7.2 Add migration functions in `src/backend/migrations.py`
    - `migrate_add_push_subscriptions()`: create `push_subscriptions` table (id, user_id, endpoint, p256dh, auth, device_label, created_datetime)
    - `migrate_add_vapid_keys()`: ensure `instance_meta` table exists (it should already) — VAPID keys stored as rows
    - _Requirements: 11.1, 11.5_
  - [x] 7.3 Register new migrations in `src/backend/main.py` startup sequence
    - Import and call `migrate_add_push_subscriptions()` and `migrate_add_vapid_keys()` after existing migrations
    - _Requirements: 11.1, 11.5_

- [x] 8. Backend: push notification routes
  - [x] 8.1 Create `src/backend/routes/push.py` with push API endpoints
    - `GET /api/push/vapid-public-key` — return VAPID public key (no auth required for key fetch)
    - `POST /api/push/subscribe` — store push subscription for authenticated user
    - `DELETE /api/push/subscribe` — remove a push subscription by endpoint
    - `POST /api/push/send` — internal endpoint to send push to a user's devices
    - Helper: `get_or_create_vapid_keys()` — generate VAPID keys on first call, retrieve from `instance_meta` thereafter
    - Helper: `send_push_to_user(user_id, payload)` — send to all subscriptions, clean up 410s
    - Helper: `ensure_pywebpush()` — check if pywebpush is importable; if not, attempt `subprocess.run([sys.executable, '-m', 'pip', 'install', 'pywebpush'])` using the running venv's Python; log result; set a module-level `_PUSH_AVAILABLE` flag
    - Call `ensure_pywebpush()` once at module import time — all push-sending functions check `_PUSH_AVAILABLE` before attempting to send
    - If pywebpush is unavailable, VAPID key and subscribe endpoints still work (they don't need the library), only send fails gracefully
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6, 11.7, 11.7a, 11.7b, 11.10_
  - [x] 8.2 Register push router in `src/backend/main.py`
    - Import and include `push_router` from `src.backend.routes.push`
    - _Requirements: 11.2_

- [x] 9. Checkpoint — Backend push routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Backend: wire push into alert scheduler
  - [x] 10.1 Add push notification trigger to `src/backend/weather.py` alert scheduler
    - When a chit's alarm/start/due time arrives, call `send_push_to_user()` for the chit owner
    - Send payload with chit title, time info, chit_id, and editor URL
    - Handle pywebpush not being installed gracefully (log and skip)
    - _Requirements: 11.7_

- [x] 11. Update configurator script (CONFIRM WITH USER BEFORE MODIFYING)
  - [x] 11.1 Update `install_python_deps()` in `install/configurinator.sh` to include `pywebpush` in the `required_pkgs` list
    - It already uses `/app/venv/bin/pip` — just add pywebpush to the existing package string
    - The existing `pip install $required_pkgs` call is already idempotent (pip skips already-installed packages)
    - This ensures pywebpush is present on fresh installs and upgrades
    - **Must confirm with user before making this change**
    - _Requirements: 11.6_

- [x] 12. Write backend tests for push routes
  - [x]* 12.1 Write unit tests in `src/backend/test_push.py`
    - Test VAPID key generation idempotence (Property 5)
    - Test subscription storage round-trip (Property 6)
    - Test subscription deletion on 410 (Property 8)
    - Test unauthenticated access to `/api/push/vapid-public-key` succeeds
    - Test authenticated subscribe/unsubscribe flow
    - Use Python stdlib only (unittest + sqlite3) — NO hypothesis, NO external libs
    - Inline minimal production logic to avoid FastAPI import (same pattern as `test_audit.py`)
    - _Requirements: 11.1, 11.5, 11.10_

- [ ]* 12.2 Write HTML tag validation script `src/backend/test_pwa_tags.py`
    - Parse all HTML files in `src/frontend/html/` (excluding `_template.html`)
    - Assert each contains all 5 required PWA head tags (Property 1)
    - Use Python stdlib only (unittest + html.parser or string matching)
    - _Requirements: 2.1–2.5_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Run `python -m pytest src/backend/test_push.py src/backend/test_pwa_tags.py -v` or `python -m unittest` to verify
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Update index, version, and release notes
  - [x] 14.1 Update `src/INDEX.md` with all new files, functions, and routes
    - _Requirements: 12.1–12.7_
  - [x] 14.2 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and use the returned value
  - [x] 14.3 Create release notes file in `documents/release_notes/`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- **pywebpush install strategy**: Two-layer approach. (1) The configurator script installs it via `/app/venv/bin/pip` on deploy. (2) The backend auto-detects at startup — if missing, it tries `subprocess.run([sys.executable, '-m', 'pip', 'install', 'pywebpush'])` using the venv Python. If both fail, push features are disabled but the app runs fine.
- Never use system-wide `pip install` — Ubuntu 24.10 blocks it (PEP 668). Always use the venv pip.
- All property-based tests use Python stdlib only (unittest + random) — no hypothesis
- Icon files (192/512 PNG) may need manual creation from the existing logo if automated scaling isn't feasible
- The service worker and manifest are served from `src/pwa/` but at root URL paths (`/sw.js`, `/manifest.json`)
