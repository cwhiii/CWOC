/**
 * Application entry point.
 * Initializes auth, renders shell, starts router.
 */

import { checkAuth, isAuthenticated, getUser, logout, onAuthChange, isAdmin } from './auth.js';
import { initRouter, navigate } from './router.js';

// Page modules (lazy-loaded via dynamic import for code splitting)
const pages = {
    home: () => import('./pages/home.js'),
    login: () => import('./pages/login.js'),
    search: () => import('./pages/search.js'),
    bookshelf: () => import('./pages/bookshelf.js'),
    settings: () => import('./pages/settings.js'),
    admin: () => import('./pages/admin.js'),
    project: () => import('./pages/project.js'),
    cover: () => import('./pages/cover.js'),
    orders: () => import('./pages/orders.js'),
    about: () => import('./pages/about.js'),
};

// --- Initialization ---
console.log('[App] Initializing CWOPOD frontend...');

// GLOBAL: Prevent ALL form submissions from causing page reloads.
// In this SPA, forms are always handled by JavaScript.
document.addEventListener('submit', function(e) {
    console.log('[App] GLOBAL form submit intercepted on:', e.target.id || e.target.tagName);
    e.preventDefault();
}, true); // Use capture phase to fire BEFORE any other handlers

// Verify jQuery
if (window.jQuery) {
    console.log('[App] jQuery loaded, version:', $.fn.jquery);
} else {
    console.error('[App] jQuery NOT loaded! Application may not function correctly.');
}

// Check auth and start app
(async function init() {
    console.log('[App] Starting initialization...');
    await checkAuth();
    renderHeader();
    onAuthChange(() => renderHeader());
    startRouter();
    console.log('[App] Initialization complete');
})();

// --- Header Rendering ---
function renderHeader() {
    console.log('[App] Rendering header, authenticated:', isAuthenticated());
    const user = getUser();
    const $header = $('#app-header');

    let navHtml = '';
    if (isAuthenticated()) {
        const adminLink = isAdmin() ? '<a href="/admin">Admin</a>' : '';
        navHtml = `
            <a href="/search">Search</a>
            <a href="/bookshelf">Bookshelf</a>
            <a href="/orders">Orders</a>
            <a href="/settings">Settings</a>
            ${adminLink}
            <a href="/about">About</a>
            <div class="ai-dropdown" id="ai-dropdown">
                <button class="ai-dropdown-btn" id="ai-dropdown-btn" title="AI Models">
                    <span class="ai-dot" id="ai-dot-summary"></span>
                    <span class="ai-label">AI</span>
                    <span class="ai-caret">&#9662;</span>
                </button>
                <div class="ai-dropdown-menu" id="ai-dropdown-menu">
                    <div class="ai-dropdown-item" id="ai-text-item" title="Click to toggle text model">
                        <span class="ai-dot" id="ai-dot-text"></span>
                        <span class="ai-item-label" id="ai-label-text">Text AI</span>
                    </div>
                    <div class="ai-dropdown-item" id="ai-image-item" title="Click to toggle image model">
                        <span class="ai-dot" id="ai-dot-image"></span>
                        <span class="ai-item-label" id="ai-label-image">Image AI</span>
                    </div>
                </div>
            </div>
            <span class="header-user">${escapeHtml(user.email)}</span>
            <button class="btn btn-sm secondary" id="logout-btn">Logout</button>
        `;
    } else {
        navHtml = `
            <a href="/login">Login</a>
            <a href="/about">About</a>
        `;
    }

    $header.html(`
        <a href="/" class="header-logo"><img src="/assets/logo-cwopod.png" alt="C.W.'s O-POD" class="header-logo-img" /> C.W.'s O-POD</a>
        <nav class="header-nav">${navHtml}</nav>
    `);

    // Bind logout
    $('#logout-btn').on('click', (e) => {
        e.preventDefault();
        console.log('[App] Logout button clicked');
        logout();
    });

    // AI dropdown — check statuses and bind events
    if (isAuthenticated()) {
        checkAllAIStatus();
        $('#ai-dropdown-btn').on('click', toggleAIDropdown);
        $('#ai-text-item').on('click', toggleTextModel);
        $('#ai-image-item').on('click', toggleImageModel);
        // Close dropdown when clicking outside
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#ai-dropdown').length) {
                $('#ai-dropdown-menu').removeClass('open');
            }
        });
    }
}

// --- Router Setup ---
function startRouter() {
    console.log('[App] Starting router...');

    const routeTable = [
        { pattern: '/', handler: 'home' },
        { pattern: '/login', handler: 'login' },
        { pattern: '/search', handler: 'search' },
        { pattern: '/bookshelf', handler: 'bookshelf' },
        { pattern: '/orders', handler: 'orders' },
        { pattern: '/settings', handler: 'settings' },
        { pattern: '/admin', handler: 'admin' },
        { pattern: '/about', handler: 'about' },
        { pattern: '/projects/:id/cover', handler: 'cover' },
        { pattern: '/projects/:id', handler: 'project' },
    ];

    const publicPages = ['home', 'login', 'about'];

    initRouter(routeTable, async (handlerName, params) => {
        console.log(`[App] Rendering page: ${handlerName}, params:`, params);

        // Redirect to login if page requires auth
        if (!publicPages.includes(handlerName) && !isAuthenticated()) {
            console.log(`[App] Page "${handlerName}" requires auth, redirecting to /login`);
            navigate('/login');
            return;
        }

        const $main = $('#app');
        console.log('[App] $main element found:', $main.length, 'elements');
        $main.html('<p class="loading">Loading...</p>');

        try {
            console.log(`[App] Loading module for: ${handlerName}...`);
            const module = await pages[handlerName]();
            console.log(`[App] Module loaded for: ${handlerName}, has render:`, typeof module.render);
            $main.empty();
            console.log(`[App] $main emptied, calling module.render()...`);
            await module.render($main, params);
            console.log(`[App] module.render() completed for: ${handlerName}`);
            console.log(`[App] $main innerHTML length after render:`, $main.html().length);
            console.log(`[App] $main children count:`, $main.children().length);
        } catch (err) {
            console.error(`[App] Page render error for ${handlerName}:`, err);
            console.error(`[App] Error stack:`, err.stack);
            $main.html(`<div class="panel"><p class="error">Failed to load page: ${escapeHtml(err.message)}</p></div>`);
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// --- AI Model Status (Dropdown) ---
let textModelState = { reachable: false, loaded: false, busy: false };
let imageModelState = { reachable: false, loaded: false, busy: false };

function toggleAIDropdown(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[App] AI dropdown toggled');
    $('#ai-dropdown-menu').toggleClass('open');
}

async function checkAllAIStatus() {
    console.log('[App] Checking all AI model statuses...');
    await Promise.all([checkTextAIStatus(), checkImageAIStatus()]);
    updateSummaryDot();
}

async function checkTextAIStatus() {
    console.log('[App] Checking text AI (Ollama) status...');
    try {
        const resp = await fetch('/api/ollama/status', { credentials: 'include' });
        const data = await resp.json();
        console.log('[App] Text AI status:', data);
        textModelState.reachable = data.reachable;
        textModelState.loaded = data.loaded;
        updateTextIndicator();
    } catch (err) {
        console.warn('[App] Text AI status check failed:', err.message);
        textModelState.reachable = false;
        textModelState.loaded = false;
        updateTextIndicator();
    }
}

async function checkImageAIStatus() {
    console.log('[App] Checking image AI (ComfyUI) status...');
    try {
        const resp = await fetch('/api/comfyui/status', { credentials: 'include' });
        const data = await resp.json();
        console.log('[App] Image AI status:', data);
        imageModelState.reachable = data.reachable;
        imageModelState.loaded = data.reachable && data.checkpoints && data.checkpoints.length > 0;
        updateImageIndicator();
    } catch (err) {
        console.warn('[App] Image AI status check failed:', err.message);
        imageModelState.reachable = false;
        imageModelState.loaded = false;
        updateImageIndicator();
    }
}

function updateTextIndicator() {
    const $dot = $('#ai-dot-text');
    const $label = $('#ai-label-text');
    const $item = $('#ai-text-item');

    if (!textModelState.reachable) {
        $dot.css('background', '#999');
        $label.text('Text AI offline');
        $item.attr('title', 'Ollama is not reachable');
    } else if (textModelState.loaded) {
        $dot.css('background', '#27ae60');
        $label.text('Text AI ready');
        $item.attr('title', 'Text model loaded — click to unload');
    } else {
        $dot.css('background', '#e74c3c');
        $label.text('Text AI unloaded');
        $item.attr('title', 'Text model not in memory — click to load');
    }
    updateSummaryDot();
}

function updateImageIndicator() {
    const $dot = $('#ai-dot-image');
    const $label = $('#ai-label-image');
    const $item = $('#ai-image-item');

    if (!imageModelState.reachable) {
        $dot.css('background', '#999');
        $label.text('Image AI offline');
        $item.attr('title', 'ComfyUI is not reachable');
    } else if (imageModelState.loaded) {
        $dot.css('background', '#27ae60');
        $label.text('Image AI ready');
        $item.attr('title', 'Image model available');
    } else {
        $dot.css('background', '#e74c3c');
        $label.text('Image AI no model');
        $item.attr('title', 'No image model checkpoint installed');
    }
    updateSummaryDot();
}

function updateSummaryDot() {
    const $dot = $('#ai-dot-summary');
    const bothReachable = textModelState.reachable && imageModelState.reachable;
    const bothLoaded = textModelState.loaded && imageModelState.loaded;
    const anyLoaded = textModelState.loaded || imageModelState.loaded;
    const neitherReachable = !textModelState.reachable && !imageModelState.reachable;

    if (neitherReachable) {
        $dot.css('background', '#999');
    } else if (bothLoaded) {
        $dot.css('background', '#27ae60');
    } else if (anyLoaded) {
        $dot.css('background', '#f39c12');
    } else {
        $dot.css('background', '#e74c3c');
    }
}

async function toggleTextModel(e) {
    e.preventDefault();
    e.stopPropagation();
    if (textModelState.busy) return;
    textModelState.busy = true;

    const $dot = $('#ai-dot-text');
    const $label = $('#ai-label-text');

    if (textModelState.loaded) {
        console.log('[App] Unloading text AI model...');
        $label.text('Unloading...');
        $dot.css('background', '#f39c12');
        try {
            const resp = await fetch('/api/ollama/unload', { method: 'POST', credentials: 'include' });
            const data = await resp.json();
            console.log('[App] Text AI unload result:', data);
            if (data.status === 'unloaded') {
                textModelState.loaded = false;
            }
        } catch (err) {
            console.error('[App] Text AI unload failed:', err.message);
        }
    } else {
        console.log('[App] Loading text AI model...');
        $label.text('Loading...');
        $dot.css('background', '#f39c12');
        try {
            const resp = await fetch('/api/ollama/load', { method: 'POST', credentials: 'include' });
            const data = await resp.json();
            console.log('[App] Text AI load result:', data);
            if (data.status === 'loaded') {
                textModelState.loaded = true;
            }
        } catch (err) {
            console.error('[App] Text AI load failed:', err.message);
        }
    }
    textModelState.busy = false;
    updateTextIndicator();
}

async function toggleImageModel(e) {
    e.preventDefault();
    e.stopPropagation();
    if (imageModelState.busy) return;

    // ComfyUI doesn't have a simple load/unload toggle like Ollama.
    // Just refresh the status to show current state.
    console.log('[App] Refreshing image AI status...');
    imageModelState.busy = true;
    await checkImageAIStatus();
    imageModelState.busy = false;
}

