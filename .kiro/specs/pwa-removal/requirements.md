# Requirements Document

## Introduction

Complete removal of the Progressive Web App (PWA) wrapper from CWOC. The PWA provides no functional benefit because CWOC is served over HTTP on a LAN (192.168.1.111:3333) — the install prompt never fires (requires HTTPS), the service worker cache list is stale, and a native Android app handles mobile. This removal eliminates dead code and maintenance burden. Platform scope: web only (server + frontend). The Android app is unaffected.

## Glossary

- **CWOC_Server**: The FastAPI backend application serving the CWOC web interface
- **HTML_Pages**: All HTML files in `src/frontend/html/` that compose the web interface (index.html, editor.html, settings.html, people.html, contact-editor.html, weather.html, trash.html, contact-trash.html, audit-log.html, help.html, maps.html, kiosk.html, login.html, notifications.html, admin-chits.html, user-admin.html, rules-manager.html, rule-editor.html, attachments.html, custom-objects-editor.html, _template.html)
- **PWA_Directory**: The `src/pwa/` directory containing sw.js, manifest.json, pwa-register.js, offline.html, cwoc-icon-192.png, cwoc-icon-512.png
- **PWA_Meta_Tags**: The block of five HTML tags in each page's `<head>`: `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable">`, `<meta name="apple-mobile-web-app-status-bar-style">`
- **PWA_Script_Tag**: The `<script src="/pwa/pwa-register.js"></script>` tag present in every HTML page
- **Settings_Install_Section**: The "Install as App" setting group (`#pwa-cert-section`) in settings.html with its associated JS logic in settings-integrations.js
- **Push_Routes**: The backend route module at `src/backend/routes/push.py` providing VAPID key and push subscription endpoints
- **Browser_Notification_System**: The existing `Notification` API usage in `shared.js` (`_sharedBrowserNotif` function) and `main-alerts.js` that fires desktop notifications for alarms — independent of the service worker
- **Deep_Link_Map**: The `tabMap` and `headingMap` objects in `settings.js` that map URL hashes to settings tabs and sections

## Requirements

### Requirement 1: Delete PWA Directory

**User Story:** As a developer, I want the entire PWA directory removed, so that there is no dead service worker, manifest, or registration code in the codebase.

#### Acceptance Criteria

1. THE PWA_Directory (`src/pwa/`) SHALL be deleted in its entirety, including all 6 files: sw.js, manifest.json, pwa-register.js, offline.html, cwoc-icon-192.png, cwoc-icon-512.png
2. WHEN the removal is complete, THE CWOC_Server SHALL not contain any routes or static mounts that reference the `src/pwa/` directory, including the `/sw.js` route, the `/manifest.json` route, the `/static/cwoc-icon-192.png` route, the `/static/cwoc-icon-512.png` route, and the `/pwa/*` static mount
3. WHEN a client requests any former PWA path (`/sw.js`, `/manifest.json`, `/pwa/pwa-register.js`, `/pwa/offline.html`, `/static/cwoc-icon-192.png`, `/static/cwoc-icon-512.png`), THE CWOC_Server SHALL return HTTP 404
4. WHEN the CWOC_Server starts after the removal, THE CWOC_Server SHALL start without errors related to missing PWA directory or files

### Requirement 2: Remove PWA Meta Tags from All HTML Pages

**User Story:** As a developer, I want PWA-specific meta tags removed from every HTML page, so that browsers no longer attempt to associate CWOC with a web app manifest or apply PWA styling hints.

#### Acceptance Criteria

1. THE HTML_Pages SHALL contain no `<link rel="manifest">` tag in any `.html` file under `src/frontend/html/` (including `_template.html`) or `src/pwa/`
2. THE HTML_Pages SHALL contain no `<meta name="theme-color">` tag in any `.html` file under `src/frontend/html/` (including `_template.html`) or `src/pwa/`
3. THE HTML_Pages SHALL contain no `<link rel="apple-touch-icon">` tag in any `.html` file under `src/frontend/html/` (including `_template.html`) or `src/pwa/`
4. THE HTML_Pages SHALL contain no `<meta name="apple-mobile-web-app-capable">` tag in any `.html` file under `src/frontend/html/` (including `_template.html`) or `src/pwa/`
5. THE HTML_Pages SHALL contain no `<meta name="apple-mobile-web-app-status-bar-style">` tag in any `.html` file under `src/frontend/html/` (including `_template.html`) or `src/pwa/`
6. THE HTML_Pages SHALL contain no HTML comment line containing the text "PWA" that previously grouped these tags (including variants such as `<!-- PWA -->` and `<!-- PWA meta tags -->`)
7. WHEN a grep search for `rel="manifest"`, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`, or `apple-mobile-web-app-status-bar-style` is run against all `.html` files in the project, THE search SHALL return zero matches

### Requirement 3: Remove PWA Script Tags from All HTML Pages

**User Story:** As a developer, I want the pwa-register.js script tag removed from every HTML page, so that no page attempts to register a service worker or capture install prompts.

#### Acceptance Criteria

1. THE HTML_Pages SHALL contain no `<script src="/pwa/pwa-register.js"></script>` tag in any `.html` file under `src/frontend/html/`, including `_template.html`
2. THE HTML_Pages SHALL contain no PWA-related comment line (matching the pattern `<!-- ── PWA ──` or `<!-- PWA -->`) that immediately precedes the location where the script tag was removed
3. WHEN a new HTML page is created from `_template.html`, THE page SHALL not contain any reference to `pwa-register.js` or its associated PWA comment

### Requirement 4: Remove Backend PWA Routes

**User Story:** As a developer, I want the backend routes that serve PWA files removed, so that the server no longer exposes service worker, manifest, or PWA icon endpoints.

#### Acceptance Criteria

1. THE CWOC_Server SHALL not define a route for `GET /sw.js`
2. THE CWOC_Server SHALL not define a route for `GET /manifest.json`
3. THE CWOC_Server SHALL not define a route for `GET /static/cwoc-icon-192.png`
4. THE CWOC_Server SHALL not define a route for `GET /static/cwoc-icon-512.png`
5. THE CWOC_Server SHALL not mount a static files directory at `/pwa`
6. IF a client sends a GET request to `/sw.js`, `/manifest.json`, `/pwa/`, `/static/cwoc-icon-192.png`, or `/static/cwoc-icon-512.png`, THEN THE CWOC_Server SHALL respond with HTTP 404
7. THE CWOC_Server SHALL not contain the `_PWA_DIR` variable or the `# PWA File Serving` section (including the `serve_service_worker`, `serve_manifest`, `serve_icon_192`, `serve_icon_512` route handlers and the `/pwa` StaticFiles mount) in `src/backend/main.py`
8. THE CWOC_Server SHALL not contain PWA-related comments (references to `sw.js`, `manifest.json`, `pwa-register.js`, `offline.html`, or PWA icon paths) in the file header comment block of `src/backend/main.py`

### Requirement 5: Remove Backend Push Notification Routes

**User Story:** As a developer, I want the push notification backend removed, so that there is no dead VAPID key management or Web Push subscription code consuming maintenance attention.

#### Acceptance Criteria

1. THE CWOC_Server SHALL not define routes under `/api/push/`
2. THE CWOC_Server SHALL not import or register the `push_router` from `src/backend/routes/push.py` in `src/backend/main.py`
3. THE file `src/backend/routes/push.py` SHALL not exist in the repository
4. THE CWOC_Server SHALL not contain lazy imports of `send_push_to_user` in `src/backend/schedulers.py`, `src/backend/routes/chits.py`, or `src/backend/rules_engine.py`; the code blocks that attempted to send Web Push notifications SHALL be removed
5. THE file `src/backend/test_push.py` SHALL not exist in the repository
6. IF a client sends a request to any path under `/api/push/`, THEN THE CWOC_Server SHALL respond with HTTP 404

### Requirement 6: Remove Settings "Install as App" Section

**User Story:** As a developer, I want the "Install as App" section removed from the settings page, so that users are not presented with non-functional PWA install UI.

#### Acceptance Criteria

1. THE Settings_Install_Section HTML block (`#pwa-cert-section` containing the install button, install hint, Chrome redirect button, Chrome hint, manual install instructions, certificate download button, certificate instructions, notifications subheader, test notification button, and notification status element) SHALL be removed from settings.html
2. THE `_initPwaInstallSection` function, the `_openInChromeForInstall` function, the `_testNtfyFromInstallSection` function, and the associated DOMContentLoaded listener that calls `_initPwaInstallSection` SHALL be removed from settings-integrations.js
3. THE `handleInstallClick` global function reference SHALL be removed (it was defined in pwa-register.js, and the `onclick="handleInstallClick()"` attribute is removed with the HTML block in criterion 1)
4. THE Deep_Link_Map in settings.js SHALL not contain entries for `install-app` or `pwa` hashes in either the `tabMap` object or the `headingMap` object
5. THE `_downloadSslCert` function in settings-integrations.js SHALL be removed, IF the certificate download functionality is not referenced by any other section outside `#pwa-cert-section`; THEN IF it is referenced elsewhere, it SHALL be preserved but the call from the removed section SHALL no longer exist
6. WHEN the "Install as App" section is removed, THE help documentation (`src/help/install-app.md` and `src/help/index.md`) SHALL be updated to remove references to "Settings → 📱 Install as App" UI elements that no longer exist, and any cross-references in other help files (e.g., `src/help/dependent-apps.md`) SHALL be updated or removed

### Requirement 7: Remove Help Documentation for PWA Installation

**User Story:** As a developer, I want the PWA installation help file removed and all cross-references to it cleaned up, so that documentation does not reference a non-existent feature.

#### Acceptance Criteria

1. THE file `src/help/install-app.md` SHALL be deleted from the repository
2. THE help index file (`src/help/index.md`) SHALL not contain the "Install as App" entry line (currently `- [Install as App](/frontend/html/help.html#install-app) — PWA installation on all platforms`)
3. THE file `src/help/dependent-apps.md` SHALL not contain a link to `install-app` in its "See also" footer (the `· [Install as App](/frontend/html/help.html#install-app)` segment SHALL be removed while preserving the remaining "See also" links)
4. THE file `src/help/ntfy-notifications.md` SHALL not contain a link to `install-app` in its "See also" footer (the `· [Install as App](/frontend/html/help.html#install-app)` segment SHALL be removed while preserving the remaining "See also" links)
5. IF any other file in `src/help/` contains a link or reference to `install-app` or `#install-app`, THEN THE reference SHALL be removed

### Requirement 8: Unregister Existing Service Workers

**User Story:** As a developer, I want any previously-registered service worker to be unregistered on page load, so that returning users do not continue running stale cached code.

#### Acceptance Criteria

1. WHEN a page loads and `navigator.serviceWorker` is supported by the browser and a service worker registration exists for the CWOC origin, THE cleanup script SHALL call `unregister()` on every registration returned by `navigator.serviceWorker.getRegistrations()`
2. WHEN all service worker registrations are successfully unregistered, THE cleanup script SHALL delete all Cache Storage entries whose names match the pattern `cwoc-shell-*`
3. THE cleanup script SHALL be an inline `<script>` block embedded directly in the HTML page (not an external file) so it has no dependency on the deleted PWA directory
4. IF `navigator.serviceWorker` is not supported by the browser, or if no service worker registration exists, or if `unregister()` or cache deletion rejects, THEN THE cleanup script SHALL catch the error and produce no user-visible output (no alerts, no DOM changes; console warnings are acceptable)
5. IF service worker unregistration succeeds but cache deletion fails, THEN THE cleanup script SHALL treat the operation as successful (no retry, no user-visible error)

### Requirement 9: Preserve Browser Notification System

**User Story:** As a developer, I want the existing browser Notification API usage preserved intact, so that desktop alarm notifications continue working after PWA removal.

#### Acceptance Criteria

1. THE Browser_Notification_System SHALL request notification permission via `Notification.requestPermission()` during shared.js initialization when `Notification.permission` equals `'default'`
2. WHEN a chit alarm or independent alert fires, THE Browser_Notification_System SHALL display a desktop notification using the `new Notification()` constructor with the alarm title, time body text, app icon, and a click handler that navigates to the relevant chit or alerts view
3. THE Browser_Notification_System SHALL NOT contain any `navigator.serviceWorker` references, since no service worker will exist after PWA removal
4. IF the `new Notification()` constructor throws an error, THEN THE Browser_Notification_System SHALL catch the exception silently without attempting any fallback notification mechanism
5. WHEN a browser notification is displayed, THE Browser_Notification_System SHALL attach an `onclick` handler that focuses the window and navigates to `/frontend/html/editor.html?id={chitId}` for chit alarms or `/?tab=Alarms&view=independent` for independent alerts

### Requirement 10: Remove Existing PWA Spec

**User Story:** As a developer, I want the old pwa-wrapper spec removed, so that the specs directory does not contain documentation for a feature that no longer exists.

#### Acceptance Criteria

1. WHEN the cleanup task is executed, THE system SHALL delete the directory `.kiro/specs/pwa-wrapper/` and all of its contents such that the directory no longer exists on the filesystem.
2. WHEN the cleanup task is executed, THE system SHALL leave all other directories under `.kiro/specs/` unchanged.
3. IF the directory `.kiro/specs/pwa-wrapper/` does not exist at the time of execution, THEN THE system SHALL complete without error.

### Requirement 11: Clean Up Code Index

**User Story:** As a developer, I want the code index updated to reflect the removal, so that the index remains an accurate map of the codebase.

#### Acceptance Criteria

1. THE code index (`src/INDEX.md`) SHALL not contain references to `pwa-register.js`, `sw.js`, `manifest.json`, `offline.html`, or the push routes (`/api/push/*`)
2. THE code index SHALL not list the `src/pwa/` directory or any of its contents (including the `src/pwa/sw.js`, `src/pwa/pwa-register.js`, and `src/pwa/offline.html` sections)
3. THE code index SHALL not list `src/backend/routes/push.py` or any functions/symbols defined in that file (section 1.31 and its contents)
4. THE code index SHALL not reference `push_router` in the `main.py` route registration description, and SHALL not list the `serve_service_worker()`, `serve_manifest()`, `serve_icon_192()`, or `serve_icon_512()` entries in the `main.py` symbol table
5. THE code index Load Order sections SHALL not include `<script src="/pwa/pwa-register.js"></script>` entries or PWA meta tag references
6. THE code index SHALL preserve all migration references (`migrate_add_push_subscriptions`, `migrate_add_vapid_keys`) in the migrations section, since migrations are historical records that remain in the codebase regardless of feature removal
