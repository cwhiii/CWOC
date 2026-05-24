# Implementation Plan: PWA Removal

## Overview

Remove all Progressive Web App infrastructure from CWOC — service worker, manifest, push notification backend, install UI, help docs, and all references. Platform: web only. The Android app is unaffected.

## Tasks

- [ ] 1. Delete `src/pwa/` directory (sw.js, manifest.json, pwa-register.js, offline.html, cwoc-icon-192.png, cwoc-icon-512.png), `src/backend/routes/push.py`, and `src/backend/test_push.py`
- [ ] 2. In `src/backend/main.py`: remove `_PWA_DIR` variable, `serve_service_worker()` / `serve_manifest()` / `serve_icon_192()` / `serve_icon_512()` route handlers, `app.mount("/pwa", ...)` static mount, `push_router` import and registration, and PWA-related comments from file header
- [ ] 3. In `src/backend/schedulers.py`: remove `_send_chit_push()` function and all calls to it (keep `_send_chit_ntfy()` intact). In `src/backend/routes/chits.py`: remove the Web Push block from the assignment notification function (keep Ntfy block intact)
- [ ] 4. Strip PWA meta tags (`<!-- PWA -->` comment + 5 link/meta tags) and `<script src="/pwa/pwa-register.js"></script>` tag from all 21 HTML files in `src/frontend/html/`. Verify with grep that no HTML file contains `rel="manifest"`, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, or `pwa-register.js`
- [ ] 5. Add one-time service worker cleanup script to `src/frontend/js/shared/shared-utils.js`: unregister all SWs via `getRegistrations()`, delete caches matching `cwoc-shell*`, wrapped in try/catch to fail silently
- [ ] 6. In `src/frontend/js/shared/shared.js`, `src/frontend/js/shared/shared-alarms.js`, and `src/frontend/js/dashboard/main-alerts.js`: remove the `navigator.serviceWorker.ready.then(reg.showNotification)` fallback from notification catch blocks, replacing with silent catch
- [ ] 7. In `src/frontend/html/settings.html`: remove entire `<div id="pwa-cert-section">` block. In `src/frontend/js/pages/settings-integrations.js`: remove `_testNtfyFromInstallSection()`, `_openInChromeForInstall()`, `_initPwaInstallSection()`, `_downloadSslCert()`, and DOMContentLoaded listener; update file header. In `src/frontend/js/pages/settings.js`: remove `install-app` and `pwa` entries from `tabMap` and `headingMap`
- [ ] 8. Delete `src/help/install-app.md`. Remove its entry from `src/help/index.md`. Remove `· [Install as App](/frontend/html/help.html#install-app)` from "See also" in `src/help/dependent-apps.md` and `src/help/ntfy-notifications.md`. Remove `{ file: 'install-app.md', title: 'Install as App' }` from `src/frontend/js/pages/help.js`. Grep `src/help/` for any remaining `install-app` references
- [ ] 9. Update `src/INDEX.md`: remove PWA file serving section, `routes/push.py` section, `test_push.py` section, `pwa-register.js` section, PWA script/meta references from Load Order sections, `push_router` from main.py description. Keep migration references intact
- [ ] 10. Delete `.kiro/specs/pwa-wrapper/` directory. Update `src/VERSION` with current timestamp

## Task Dependency Graph

```json
{
  "waves": [
    [1],
    [2, 3],
    [4, 5, 6, 7, 8],
    [9],
    [10]
  ]
}
```

Wave 1 deletes source files. Wave 2 cleans backend references (depends on files being gone). Wave 3 handles all frontend/docs cleanup (independent of each other, depends on backend being clean). Wave 4 updates the index after all code changes. Wave 5 bumps the version last.

## Notes

- The `push_subscriptions` table and VAPID keys in `instance_meta` remain in the database — migrations are historical records and the dead table is harmless
- The service worker cleanup script in task 5 is temporary — can be removed in a future version once all browsers have cleared the old SW
- Ntfy notifications are completely unaffected — they remain the sole push channel
- Browser `Notification` API usage is preserved; only the SW fallback path is removed
