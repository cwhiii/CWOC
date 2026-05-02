# Requirements Document

## Introduction

CWOC (C.W.'s Omni Chits) is a personal task/note/calendar management web app served by FastAPI with a vanilla JS frontend. This feature wraps CWOC as a Progressive Web App (PWA) so it can be installed on phones, tablets, and desktops — appearing as a standalone app without browser chrome. The PWA wrapper adds a web app manifest, service worker, app icons, and the necessary meta tags across all HTML pages. It leverages the existing browser notification infrastructure and lays groundwork for future offline support.

**Critical constraints**: No npm, no build tools, no bundler. All files are vanilla JS served directly by FastAPI's StaticFiles. External CDN libraries (Flatpickr, Font Awesome 6, marked.js) are loaded via script/link tags.

## Glossary

- **PWA**: Progressive Web App — a web application that uses modern web APIs to deliver an app-like experience, including installability and optional offline support.
- **Web_App_Manifest**: A JSON file (`manifest.json`) that provides metadata (name, icons, display mode, colors) enabling browsers to offer an "Add to Home Screen" prompt.
- **Service_Worker**: A JavaScript file that runs in the background, intercepting network requests. Used for caching, offline support, and push notifications.
- **Standalone_Display_Mode**: A PWA display mode where the app runs in its own window without browser navigation chrome (address bar, tabs).
- **Cache_API**: A browser API used by service workers to store HTTP responses for offline or faster access.
- **App_Shell**: The minimal HTML, CSS, and JS needed to render the application's UI skeleton, cached for instant loading.
- **Install_Prompt**: The browser-native prompt (or custom UI) that allows users to add the PWA to their home screen or app launcher.
- **CWOC_Backend**: The FastAPI application serving the CWOC API and static files on port 3333.
- **CWOC_Frontend**: The vanilla JS/HTML/CSS frontend served as static files by FastAPI.
- **Icon_Set**: A collection of PNG icons at multiple resolutions (192x192, 512x512) required by the Web_App_Manifest for home screen and splash screen display.
- **Web_Push**: The W3C Push API — allows a server to send notifications to a user's device even when the app tab is closed, via the service worker.
- **VAPID**: Voluntary Application Server Identification — a key pair (public + private) used to authenticate the server when sending push messages. Generated once and stored on the server.
- **Push_Subscription**: A browser-generated object containing the endpoint URL and encryption keys needed for the server to send push messages to that specific browser/device.
- **pywebpush**: A Python library that handles VAPID signing and Web Push payload encryption, used by the CWOC_Backend to send push notifications.

## Requirements

### Requirement 1: Web App Manifest

**User Story:** As a CWOC user, I want the app to have a valid web app manifest, so that browsers recognize it as installable and display it correctly on my home screen.

#### Acceptance Criteria

1. THE CWOC_Backend SHALL serve a `manifest.json` file at the URL path `/manifest.json`
2. THE Web_App_Manifest SHALL include the `name` field set to "C.W.'s Omni Chits"
3. THE Web_App_Manifest SHALL include the `short_name` field set to "CWOC"
4. THE Web_App_Manifest SHALL include the `display` field set to "standalone"
5. THE Web_App_Manifest SHALL include the `start_url` field set to "/"
6. THE Web_App_Manifest SHALL include the `scope` field set to "/"
7. THE Web_App_Manifest SHALL include the `theme_color` field matching the CWOC parchment brown theme (`#8b5a2b`)
8. THE Web_App_Manifest SHALL include the `background_color` field matching the CWOC parchment background (`#f5e6cc`)
9. THE Web_App_Manifest SHALL include an `icons` array with at least a 192x192 PNG icon and a 512x512 PNG icon
10. THE Web_App_Manifest SHALL include the `orientation` field set to "any" to support both portrait and landscape use
11. WHEN a browser fetches `/manifest.json`, THE CWOC_Backend SHALL respond with the correct `application/json` content type

### Requirement 2: Manifest and Meta Tag Integration

**User Story:** As a CWOC user, I want all pages to reference the manifest and include proper mobile meta tags, so that the PWA is recognized consistently regardless of which page I'm on.

#### Acceptance Criteria

1. THE CWOC_Frontend SHALL include a `<link rel="manifest" href="/manifest.json">` tag in the `<head>` of every HTML page
2. THE CWOC_Frontend SHALL include a `<meta name="theme-color" content="#8b5a2b">` tag in the `<head>` of every HTML page
3. THE CWOC_Frontend SHALL include an `<link rel="apple-touch-icon" href="/static/cwoc-icon-192.png">` tag in the `<head>` of every HTML page for iOS home screen support
4. THE CWOC_Frontend SHALL include a `<meta name="apple-mobile-web-app-capable" content="yes">` tag in the `<head>` of every HTML page
5. THE CWOC_Frontend SHALL include a `<meta name="apple-mobile-web-app-status-bar-style" content="default">` tag in the `<head>` of every HTML page

### Requirement 3: PWA Icon Set

**User Story:** As a CWOC user, I want the app to display a recognizable icon on my home screen and in the app switcher, so that I can identify CWOC among my other apps.

#### Acceptance Criteria

1. THE Icon_Set SHALL include a 192x192 pixel PNG icon file at `/static/cwoc-icon-192.png`
2. THE Icon_Set SHALL include a 512x512 pixel PNG icon file at `/static/cwoc-icon-512.png`
3. THE Icon_Set SHALL use the existing CWOC logo (`cwod_logo.png`) as the source artwork, scaled to the required dimensions
4. WHEN the PWA is installed, THE Icon_Set SHALL provide the icons referenced in the Web_App_Manifest for home screen and splash screen display

### Requirement 4: Service Worker Registration

**User Story:** As a CWOC user, I want the app to register a service worker, so that the browser treats it as a full PWA and enables future offline and caching capabilities.

#### Acceptance Criteria

1. THE CWOC_Frontend SHALL register a service worker from the file `/sw.js` on every page load
2. THE CWOC_Backend SHALL serve the service worker file at the root URL path `/sw.js` with the correct `application/javascript` content type
3. THE Service_Worker SHALL use the root scope (`/`) so it can intercept requests across the entire application
4. WHEN the service worker is registered successfully, THE CWOC_Frontend SHALL log a confirmation message to the browser console
5. IF the browser does not support service workers, THEN THE CWOC_Frontend SHALL continue operating without error

### Requirement 5: App Shell Caching

**User Story:** As a CWOC user, I want the core app shell (HTML, CSS, JS, icons) to be cached after first load, so that the app starts faster on subsequent visits and has a foundation for offline support.

#### Acceptance Criteria

1. WHEN the Service_Worker is installed, THE Service_Worker SHALL pre-cache the App_Shell resources: the main HTML pages, shared CSS files, shared JS files, and icon files
2. THE Service_Worker SHALL use a versioned cache name (e.g., `cwoc-shell-v1`) so that cache updates can be managed by changing the version string
3. WHEN a cached App_Shell resource is requested, THE Service_Worker SHALL serve it from the cache first, then fetch an updated version from the network in the background (stale-while-revalidate strategy)
4. WHEN the Service_Worker activates a new version, THE Service_Worker SHALL delete old caches that do not match the current version string
5. THE Service_Worker SHALL NOT cache API responses (`/api/*` paths) — API requests SHALL always go to the network
6. THE Service_Worker SHALL NOT cache external CDN resources (Flatpickr, Font Awesome, marked.js) — CDN requests SHALL pass through to the network

### Requirement 6: Offline Fallback Page

**User Story:** As a CWOC user, I want to see a friendly message when I open the app without network access and the requested page is not cached, so that I understand the app needs connectivity rather than seeing a browser error.

#### Acceptance Criteria

1. THE Service_Worker SHALL pre-cache a dedicated offline fallback HTML page at `/frontend/html/offline.html`
2. WHEN a navigation request fails due to no network and the requested page is not in the cache, THE Service_Worker SHALL respond with the offline fallback page
3. THE offline fallback page SHALL display a message indicating that CWOC requires a network connection and suggest the user check connectivity
4. THE offline fallback page SHALL use the CWOC parchment visual theme consistent with the rest of the application
5. THE offline fallback page SHALL NOT be shown for cached App_Shell pages that are available offline

### Requirement 7: Standalone Display Experience

**User Story:** As a CWOC user who has installed the PWA, I want the app to look and feel like a native app without browser chrome, so that I have an immersive experience.

#### Acceptance Criteria

1. WHEN the PWA is launched from the home screen, THE CWOC_Frontend SHALL display in standalone mode without the browser address bar or navigation controls
2. THE Web_App_Manifest `display` field set to "standalone" SHALL cause the app to render in its own window on supported platforms
3. WHILE the app is running in standalone mode, THE CWOC_Frontend SHALL handle all navigation internally without opening new browser tabs for internal links
4. THE CWOC_Frontend SHALL use the `theme_color` from the Web_App_Manifest to style the system status bar on mobile devices

### Requirement 8: Install Prompt Handling

**User Story:** As a CWOC user, I want to be able to install the app from within the app itself, so that I don't have to find the browser's "Add to Home Screen" option in a menu.

#### Acceptance Criteria

1. WHEN the browser fires the `beforeinstallprompt` event, THE CWOC_Frontend SHALL capture and defer the event for later use
2. WHEN the install prompt is available and the app is not already installed, THE CWOC_Frontend SHALL display a subtle install button in the dashboard sidebar
3. WHEN the user clicks the install button, THE CWOC_Frontend SHALL trigger the deferred install prompt
4. WHEN the user accepts or dismisses the install prompt, THE CWOC_Frontend SHALL hide the install button
5. WHILE the app is running in standalone display mode (already installed), THE CWOC_Frontend SHALL NOT display the install button

### Requirement 9: Service Worker and Manifest Serving from Backend

**User Story:** As a developer, I want the backend to serve the service worker and manifest files correctly, so that browsers can register the service worker at the correct scope and parse the manifest.

#### Acceptance Criteria

1. THE CWOC_Backend SHALL serve `/sw.js` from a static file with the response header `Content-Type: application/javascript`
2. THE CWOC_Backend SHALL serve `/sw.js` with the response header `Service-Worker-Allowed: /` to permit root scope registration
3. THE CWOC_Backend SHALL serve `/manifest.json` from a static file with the response header `Content-Type: application/json`
4. THE CWOC_Backend SHALL serve both `/sw.js` and `/manifest.json` without requiring authentication (these paths SHALL be publicly accessible)

### Requirement 10: Notification Compatibility

**User Story:** As a CWOC user, I want my existing alarm and timer notifications to continue working after the PWA wrapper is added, so that I don't lose functionality.

#### Acceptance Criteria

1. THE Service_Worker SHALL NOT interfere with the existing browser Notification API usage in `shared.js` and `main-alerts.js`
2. WHEN the app is running as an installed PWA, THE CWOC_Frontend SHALL continue to request notification permission using the existing `Notification.requestPermission()` flow
3. WHEN an alarm or timer fires in the installed PWA, THE CWOC_Frontend SHALL display notifications using the existing `_sharedBrowserNotif` function and the fallback `serviceWorker.ready.then(reg.showNotification)` path in `main-alerts.js`
4. THE Service_Worker SHALL include a `notificationclick` event handler that focuses the app window and navigates to the relevant chit when a notification is clicked

### Requirement 11: Server-Sent Push Notifications (Web Push)

**User Story:** As a CWOC user, I want to receive push notifications on my phone even when the app tab is closed, so that I never miss an alarm or due-date reminder.

#### Acceptance Criteria

1. THE CWOC_Backend SHALL generate a VAPID key pair (public + private) on first run and store it in the database (`instance_meta` table), reusing the same keys on subsequent starts
2. THE CWOC_Backend SHALL expose a `GET /api/push/vapid-public-key` endpoint that returns the public VAPID key so the frontend can subscribe to push
3. THE CWOC_Frontend SHALL subscribe the browser to push notifications via `serviceWorkerRegistration.pushManager.subscribe()` using the VAPID public key, after the user grants notification permission
4. THE CWOC_Frontend SHALL send the resulting Push_Subscription object to a `POST /api/push/subscribe` endpoint for server-side storage
5. THE CWOC_Backend SHALL store Push_Subscription objects in a `push_subscriptions` database table, associated with the user ID and device identifier
6. THE CWOC_Backend SHALL use the `pywebpush` library to send encrypted push messages to subscribed devices (dependency installed via `/app/venv/bin/pip` — never system-wide pip)
7a. THE CWOC_Backend SHALL check at startup whether `pywebpush` is importable, and if not, attempt to install it automatically using the venv pip (`/app/venv/bin/pip install pywebpush`) — logging the result
7b. IF the auto-install fails (no internet, permissions, etc.), THE CWOC_Backend SHALL log a warning and disable push notification features gracefully — the rest of the app SHALL continue to function normally
7. WHEN a chit's alarm, start time, or due time arrives and the background weather/alert scheduler detects it, THE CWOC_Backend SHALL send a push notification to all of that user's subscribed devices with the chit title and relevant time
8. THE Service_Worker SHALL include a `push` event handler that displays the incoming push payload as a system notification using `self.registration.showNotification()`
9. WHEN the user clicks a push notification, THE Service_Worker `notificationclick` handler SHALL focus the app window (or open one) and navigate to the relevant chit's editor page
10. THE CWOC_Backend SHALL handle expired or invalid Push_Subscription objects gracefully by removing them from the database when `pywebpush` returns a 410 Gone response
11. THE CWOC_Frontend SHALL re-subscribe and update the server if the browser's push subscription changes (e.g., after clearing browser data)

### Requirement 12: PWA File Organization

**User Story:** As a developer, I want all PWA-specific source files to live in their own subdirectory within `src/`, so that the PWA code is cleanly separated from the existing frontend and backend code.

#### Acceptance Criteria

1. ALL PWA-specific source files SHALL reside under `src/pwa/`
2. THE `src/pwa/` directory SHALL contain the service worker source file (`sw.js`), the web app manifest (`manifest.json`), the offline fallback page (`offline.html`), the PWA icon files, and any PWA-specific JS (e.g., install prompt handling, push subscription logic)
3. THE CWOC_Backend SHALL serve `src/pwa/sw.js` at the URL path `/sw.js` (root scope required by the service worker spec)
4. THE CWOC_Backend SHALL serve `src/pwa/manifest.json` at the URL path `/manifest.json`
5. THE CWOC_Backend SHALL serve PWA icon files from `src/pwa/` at their expected URL paths (e.g., `/static/cwoc-icon-192.png` or `/pwa/cwoc-icon-192.png`)
6. THE `src/pwa/` directory SHALL NOT contain copies of existing frontend or backend files — it SHALL only contain files specific to the PWA wrapper functionality
7. THE backend push notification route module SHALL reside at `src/backend/routes/push.py`, following the existing route module pattern, since it extends the API
