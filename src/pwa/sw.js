/*
 * CWOC Service Worker — sw.js
 *
 * Handles: app-shell caching, offline fallback, push notifications,
 *          and notification click navigation.
 *
 * Cache strategy:
 *   /api/*           → network only (never cache)
 *   External origins → passthrough (no cache)
 *   App-shell URLs   → stale-while-revalidate
 *   Navigation miss  → offline.html fallback
 *   Everything else  → network fetch (no cache)
 */

const CACHE_NAME = 'cwoc-shell-v1';

const APP_SHELL_URLS = [
    // ── HTML pages ──
    '/',
    '/frontend/html/editor.html',
    '/frontend/html/settings.html',
    '/frontend/html/people.html',
    '/frontend/html/contact-editor.html',
    '/frontend/html/weather.html',
    '/frontend/html/trash.html',
    '/frontend/html/audit-log.html',
    '/frontend/html/help.html',
    '/frontend/html/offline.html',

    // ── Shared CSS ──
    '/frontend/css/shared/shared-page.css',
    '/frontend/css/shared/shared-editor.css',

    // ── Dashboard CSS ──
    '/frontend/css/dashboard/styles-variables.css',
    '/frontend/css/dashboard/styles-layout.css',
    '/frontend/css/dashboard/styles-sidebar.css',
    '/frontend/css/dashboard/styles-tabs.css',
    '/frontend/css/dashboard/styles-calendar.css',
    '/frontend/css/dashboard/styles-cards.css',
    '/frontend/css/dashboard/styles-hotkeys.css',
    '/frontend/css/dashboard/styles-modals.css',
    '/frontend/css/dashboard/styles-responsive.css',
    '/frontend/css/dashboard/styles.css',

    // ── Editor CSS ──
    '/frontend/css/editor/editor.css',

    // ── Shared JS ──
    '/frontend/js/shared/shared-utils.js',
    '/frontend/js/shared/shared-touch.js',
    '/frontend/js/shared/shared-checklist.js',
    '/frontend/js/shared/shared-sort.js',
    '/frontend/js/shared/shared-indicators.js',
    '/frontend/js/shared/shared-calendar.js',
    '/frontend/js/shared/shared-tags.js',
    '/frontend/js/shared/shared-recurrence.js',
    '/frontend/js/shared/shared-geocoding.js',
    '/frontend/js/shared/shared-qr.js',
    '/frontend/js/shared/shared-auth.js',
    '/frontend/js/shared/shared.js',

    // ── Dashboard JS ──
    '/frontend/js/dashboard/main-sidebar.js',
    '/frontend/js/dashboard/main-hotkeys.js',
    '/frontend/js/dashboard/main-calendar.js',
    '/frontend/js/dashboard/main-views.js',
    '/frontend/js/dashboard/main-alerts.js',
    '/frontend/js/dashboard/main-search.js',
    '/frontend/js/dashboard/main-modals.js',
    '/frontend/js/dashboard/main-init.js',
    '/frontend/js/dashboard/main.js',

    // ── Pages JS ──
    '/frontend/js/pages/shared-page.js',
    '/frontend/js/pages/shared-editor.js',
    '/frontend/js/pages/settings.js',
    '/frontend/js/pages/people.js',
    '/frontend/js/pages/contact-editor.js',
    '/frontend/js/pages/contact-qr.js',
    '/frontend/js/pages/weather.js',

    // ── Editor JS ──
    '/frontend/js/editor/editor.js',
    '/frontend/js/editor/editor-dates.js',
    '/frontend/js/editor/editor-tags.js',
    '/frontend/js/editor/editor-people.js',
    '/frontend/js/editor/editor-location.js',
    '/frontend/js/editor/editor-notes.js',
    '/frontend/js/editor/editor-alerts.js',
    '/frontend/js/editor/editor-color.js',
    '/frontend/js/editor/editor-health.js',
    '/frontend/js/editor/editor-habits.js',
    '/frontend/js/editor/editor-sharing.js',
    '/frontend/js/editor/editor-save.js',
    '/frontend/js/editor/editor-init.js',
    '/frontend/js/editor/editor_checklists.js',
    '/frontend/js/editor/editor_projects.js',

    // ── Icons & static assets ──
    '/static/cwoc-icon-192.png',
    '/static/cwoc-icon-512.png',
    '/static/cwod_logo.png',
    '/static/cwod_logo-favicon.png',
    '/static/cwod_logo-large.png',
    '/static/parchment.jpg',

    // ── Self-hosted fonts ──
    '/static/fonts/lora/Lora-VariableFont_wght.ttf',
    '/static/fonts/lora/Lora-Italic-VariableFont_wght.ttf'
];

// ─── Install: pre-cache app shell ───────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_URLS))
            .then(() => self.skipWaiting())
    );
});

// ─── Activate: delete old versioned caches ──────────────────────────────────

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// ─── Fetch: routing strategy ────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API requests → network only, never cache
    if (url.pathname.startsWith('/api/')) {
        return; // let the browser handle it normally
    }

    // 2. External origins (CDN: Flatpickr, Font Awesome, marked.js, etc.) → passthrough
    if (url.origin !== self.location.origin) {
        return; // no caching, no interception
    }

    // 3. App-shell URL → stale-while-revalidate
    //    Return cached version immediately, fetch fresh copy in background
    const shellPath = url.pathname === '/' ? '/' : url.pathname;
    if (APP_SHELL_URLS.includes(shellPath)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) =>
                cache.match(event.request).then((cached) => {
                    const networkFetch = fetch(event.request).then((response) => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        // Network failed — cached copy (if any) was already returned
                        return cached;
                    });

                    // Return cached immediately; update in background
                    return cached || networkFetch;
                })
            )
        );
        return;
    }

    // 4. Navigation requests for uncached pages → try network, fall back to offline.html
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() =>
                caches.match('/frontend/html/offline.html')
            )
        );
        return;
    }

    // 5. Everything else → normal network fetch (no cache)
});

// ─── Push: display notification from push payload ───────────────────────────

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        // If payload isn't valid JSON, use it as plain text body
        data = { title: 'CWOC', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'C.W.\'s Omni Chits';
    const options = {
        body: data.body || '',
        icon: data.icon || '/static/cwoc-icon-192.png',
        badge: data.badge || '/static/cwoc-icon-192.png',
        data: data.data || {}
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ─── Notification click: focus/open app, navigate to chit ───────────────────

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notifData = event.notification.data || {};
    const targetUrl = notifData.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Try to find an existing CWOC window and focus it
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin)) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // No existing window — open a new one
                return self.clients.openWindow(targetUrl);
            })
    );
});
