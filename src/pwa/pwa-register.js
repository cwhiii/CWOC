/*
 * CWOC PWA Registration — pwa-register.js
 *
 * Loaded via <script> on every page. Handles:
 *   - Service worker registration
 *   - Install prompt capture and handling
 *   - Standalone mode detection
 *   - Push notification subscription
 *
 * All functions are globally accessible (no modules).
 */

// ─── State ──────────────────────────────────────────────────────────────────

/** Deferred beforeinstallprompt event, captured for later use */
var _pwaInstallPrompt = null;

// ─── Service Worker Registration (Req 4.1, 4.2, 4.4, 4.5) ─────────────────

/**
 * Register the service worker at /sw.js with root scope.
 * Checks for browser support first — fails silently if unsupported.
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service workers not supported in this browser');
        return;
    }

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function(registration) {
            console.log('[PWA] Service worker registered, scope:', registration.scope);
        })
        .catch(function(error) {
            console.error('[PWA] Service worker registration failed:', error);
        });
}

// ─── Install Prompt Handling (Req 8.1–8.5) ─────────────────────────────────

/**
 * Listen for the beforeinstallprompt event, defer it, and show the
 * install button on the Settings page (Install as App section).
 */
function captureInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function(event) {
        // Prevent the default mini-infobar on mobile
        event.preventDefault();

        // Stash the event for triggering later
        _pwaInstallPrompt = event;

        // Show the install button and hint (if they exist on this page)
        var btn = document.getElementById('pwa-install-btn');
        if (btn) {
            btn.style.display = '';
        }
        var hint = document.getElementById('pwa-install-hint');
        if (hint) {
            hint.style.display = '';
        }

        console.log('[PWA] Install prompt captured and deferred');
    });

    // Also listen for appinstalled to clean up
    window.addEventListener('appinstalled', function() {
        _pwaInstallPrompt = null;
        var btn = document.getElementById('pwa-install-btn');
        if (btn) {
            btn.style.display = 'none';
        }
        var hint = document.getElementById('pwa-install-hint');
        if (hint) {
            hint.style.display = 'none';
        }
        console.log('[PWA] App was installed');
    });
}

/**
 * Trigger the deferred install prompt. Called when the user clicks
 * the install button. Hides the button on accept or dismiss.
 */
function handleInstallClick() {
    if (!_pwaInstallPrompt) {
        console.log('[PWA] No install prompt available');
        return;
    }

    _pwaInstallPrompt.prompt();

    _pwaInstallPrompt.userChoice.then(function(choiceResult) {
        console.log('[PWA] User ' + choiceResult.outcome + ' the install prompt');

        // Hide the button regardless of accept or dismiss
        var btn = document.getElementById('pwa-install-btn');
        if (btn) {
            btn.style.display = 'none';
        }

        // Clear the deferred prompt — it can only be used once
        _pwaInstallPrompt = null;
    });
}

/**
 * Detect if the app is already running in standalone mode (installed).
 * If so, hide the install button since the user already has it installed.
 */
function _detectStandaloneMode() {
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

    if (isStandalone) {
        var btn = document.getElementById('pwa-install-btn');
        if (btn) {
            btn.style.display = 'none';
        }
        console.log('[PWA] Running in standalone mode — install button hidden');
    }

    return isStandalone;
}

// ─── Push Subscription (Req 11.2, 11.3, 11.4, 11.11) ──────────────────────

/**
 * Convert a base64url-encoded string to a Uint8Array.
 * Needed for applicationServerKey in pushManager.subscribe().
 */
function _urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Subscribe the browser to push notifications via the Push API.
 *
 * Flow:
 *   1. Fetch the VAPID public key from the backend
 *   2. Subscribe via pushManager.subscribe() with the VAPID key
 *   3. POST the resulting subscription to the backend for storage
 *
 * Only call this after the user has granted notification permission.
 * This function is globally accessible so other scripts can call it
 * (e.g., after the user grants permission in settings or alerts).
 */
async function subscribeToPush() {
    var result = { step: '', error: null, subscription: null };

    // Guard: notification permission must already be granted
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        console.log('[PWA] Push subscription skipped — notification permission not granted');
        result.step = 'permission'; result.error = 'Notification permission not granted';
        return result;
    }

    // Guard: service worker and push must be supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('[PWA] Push notifications not supported in this browser');
        result.step = 'support'; result.error = 'PushManager not supported';
        return result;
    }

    try {
        // Wait for service worker with a timeout
        result.step = 'sw-ready';
        var registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise(function(_, reject) {
                setTimeout(function() {
                    reject(new Error('Service worker not ready after 10s. Try reloading.'));
                }, 10000);
            })
        ]);
        console.log('[PWA] Service worker ready');

        // 1. Fetch the VAPID public key from the backend
        result.step = 'vapid-fetch';
        var keyResponse = await fetch('/api/push/vapid-public-key');
        if (!keyResponse.ok) {
            result.error = 'VAPID key fetch failed: HTTP ' + keyResponse.status;
            console.error('[PWA]', result.error);
            return result;
        }
        var keyData = await keyResponse.json();
        var vapidPublicKey = keyData.public_key || keyData.vapid_public_key;
        if (!vapidPublicKey) {
            result.error = 'VAPID public key missing from response';
            console.error('[PWA]', result.error);
            return result;
        }
        console.log('[PWA] VAPID key fetched');

        var applicationServerKey = _urlBase64ToUint8Array(vapidPublicKey);

        // 2. Subscribe via pushManager
        result.step = 'push-subscribe';
        var subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });
        console.log('[PWA] Push subscription created:', subscription.endpoint.substring(0, 60));

        // 3. POST the subscription to the backend
        result.step = 'server-store';
        var subscribeResponse = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: _arrayBufferToBase64(subscription.getKey('p256dh')),
                    auth: _arrayBufferToBase64(subscription.getKey('auth'))
                }
            })
        });

        if (!subscribeResponse.ok) {
            var errText = '';
            try { errText = await subscribeResponse.text(); } catch(e) {}
            result.error = 'Server store failed: HTTP ' + subscribeResponse.status + ' ' + errText;
            console.error('[PWA]', result.error);
            result.subscription = subscription;
            return result;
        }

        console.log('[PWA] Push subscription stored on server');
        result.step = 'done';
        result.subscription = subscription;
        return result;

    } catch (error) {
        console.error('[PWA] Push subscription failed at step "' + result.step + '":', error);
        result.error = error.message || String(error);
        return result;
    }
}

/**
 * Convert an ArrayBuffer to a base64 string.
 * Used to serialize push subscription keys for the backend.
 */
function _arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Handle push subscription changes. If the browser invalidates the
 * existing subscription (e.g., after clearing data), re-subscribe
 * and update the server.
 */
function _handleSubscriptionChange() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }

    navigator.serviceWorker.ready.then(function(registration) {
        registration.pushManager.getSubscription().then(function(subscription) {
            if (!subscription && Notification.permission === 'granted') {
                // Subscription was lost but permission is still granted — re-subscribe
                console.log('[PWA] Push subscription lost, re-subscribing...');
                subscribeToPush();
            }
        });
    });
}

// ─── Initialization ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    registerServiceWorker();
    captureInstallPrompt();
    _detectStandaloneMode();
    _handleSubscriptionChange();
});
