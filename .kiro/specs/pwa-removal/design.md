# Design Document: PWA Removal

## Overview

Remove all Progressive Web App (PWA) infrastructure from CWOC. The PWA provides no functional benefit — CWOC is served over HTTP on a LAN so the install prompt never fires, the service worker cache is stale, and a native Android app handles mobile. This removal eliminates dead code and ongoing maintenance burden.

## Architecture

### Before
```
Browser → /sw.js (service worker registration)
Browser → /manifest.json (PWA manifest)
Browser → /pwa/pwa-register.js (install prompt capture)
Browser → /static/cwoc-icon-192.png, /static/cwoc-icon-512.png (PWA icons)
Browser → /api/push/* (Web Push subscription/send)
Scheduler → send_push_to_user() → pywebpush → push service → device
```

### After
```
Browser → (no service worker, no manifest, no PWA registration)
Browser → (no /api/push/* endpoints)
Scheduler → _send_chit_ntfy() only (Ntfy remains as the push channel)
Browser Notification API → new Notification() directly (no SW fallback)
```

This is a deletion-focused change — no new features are introduced. The work spans the backend (Python/FastAPI), frontend (HTML/JS), help documentation, and project metadata.

## Components and Interfaces

### Files to Delete

| File | Reason |
|------|--------|
| `src/pwa/sw.js` | Service worker — no longer needed |
| `src/pwa/manifest.json` | Web app manifest |
| `src/pwa/pwa-register.js` | SW registration + install prompt capture |
| `src/pwa/offline.html` | Offline fallback page |
| `src/pwa/cwoc-icon-192.png` | PWA icon (192×192) |
| `src/pwa/cwoc-icon-512.png` | PWA icon (512×512) |
| `src/backend/routes/push.py` | Web Push routes + VAPID key management |
| `src/backend/test_push.py` | Push notification unit tests |
| `src/help/install-app.md` | PWA installation help documentation |
| `.kiro/specs/pwa-wrapper/` | Old PWA spec (entire directory) |

### Backend Modifications

**`src/backend/main.py`**
- Remove `_PWA_DIR` variable
- Remove `serve_service_worker()`, `serve_manifest()`, `serve_icon_192()`, `serve_icon_512()` route handlers
- Remove `app.mount("/pwa", ...)` static mount
- Remove `from src.backend.routes.push import push_router` import and `app.include_router(push_router)` registration
- Remove PWA-related comments from file header

**`src/backend/schedulers.py`**
- Remove `_send_chit_push()` function (imports `send_push_to_user` and sends alarm/due/start notifications)
- Remove all calls to `_send_chit_push()` from checker loops
- Keep `_send_chit_ntfy()` and all Ntfy notification logic intact

**`src/backend/routes/chits.py`**
- Remove the Web Push block inside the assignment notification function (lazy import of `send_push_to_user` and surrounding try/except)
- Keep the Ntfy notification block intact

### Frontend Modifications — HTML (21 files)

All files in `src/frontend/html/` (including `_template.html`):
- Remove the `<!-- PWA -->` comment block and its 5 meta/link tags
- Remove the `<script src="/pwa/pwa-register.js"></script>` tag and its associated comment

### Frontend Modifications — JavaScript

**`src/frontend/js/shared/shared-utils.js`**
- Add one-time service worker cleanup script (unregister + cache clear)

**`src/frontend/js/shared/shared.js`**, **`shared-alarms.js`**, **`main-alerts.js`**
- Remove `navigator.serviceWorker` fallback from `_sharedBrowserNotif()` catch blocks

**`src/frontend/js/pages/settings-integrations.js`**
- Remove `_testNtfyFromInstallSection()`, `_openInChromeForInstall()`, `_initPwaInstallSection()`, `_downloadSslCert()`, and DOMContentLoaded listener

**`src/frontend/js/pages/settings.js`**
- Remove `install-app` and `pwa` entries from `tabMap` and `headingMap`

**`src/frontend/js/pages/help.js`**
- Remove `install-app.md` from help topics array

### Service Worker Cleanup Script

For returning users who have the old service worker registered:

```javascript
// One-time cleanup: unregister old PWA service worker and clear its caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(reg) { reg.unregister(); });
  }).catch(function() {});
  if ('caches' in window) {
    caches.keys().then(function(names) {
      names.forEach(function(name) {
        if (name.indexOf('cwoc-shell') === 0) caches.delete(name);
      });
    }).catch(function() {});
  }
}
```

Placed in `shared-utils.js` (loaded on every page) to avoid duplicating in 21 HTML files. Can be removed in a future version once enough time has passed.

## Data Models

### Database Impact

- The `push_subscriptions` table and `instance_meta` VAPID key rows remain in the database (migrations are historical and idempotent)
- No new migrations needed — the table simply becomes unused
- No data deletion needed — harmless dead weight
- `src/backend/migrations.py` is NOT modified (historical record)

## Error Handling

- Service worker cleanup script wraps all operations in try/catch to fail silently
- Notification functions catch errors from `new Notification()` silently (no SW fallback attempted)
- Backend starts cleanly without push routes — no import errors since the file is deleted and all lazy imports are removed
- Help cross-references are cleaned up so no broken links remain

## Testing Strategy

- Verify server starts without errors after backend changes
- Grep all HTML files to confirm zero PWA references remain
- Verify browser notifications still fire (test an alarm trigger)
- Verify the SW cleanup script runs without errors on a page with no registered SW
- No new automated tests needed (this is a removal)

## What Is NOT Touched

- Browser Notification API (`Notification.requestPermission()`, `new Notification()`) — preserved
- Ntfy push notification system — preserved entirely
- All other settings sections — preserved
- Android app — completely unaffected
- Database schema — no changes
- `src/backend/migrations.py` — no changes (historical record)
