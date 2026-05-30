/**
 * Client-side SPA router using the History API.
 * Handles navigation between pages without full page reloads.
 */

let routes = [];
let currentPath = '';
let renderPage = null;

/**
 * Initialize the router with a route table and render function.
 * @param {Array} routeTable - Array of { pattern, handler } objects
 * @param {Function} renderFn - Function called with (handler, params) on navigation
 */
export function initRouter(routeTable, renderFn) {
    console.log('[Router] Initializing with', routeTable.length, 'routes');
    renderPage = renderFn;

    routes = routeTable.map(route => {
        const paramNames = [];
        const regexStr = route.pattern
            .replace(/:([^/]+)/g, (_, name) => {
                paramNames.push(name);
                return '([^/]+)';
            });
        return {
            pattern: route.pattern,
            regex: new RegExp(`^${regexStr}$`),
            paramNames,
            handler: route.handler
        };
    });

    // Listen for link clicks
    $(document).on('click', 'a[href]', function (e) {
        const href = $(this).attr('href');
        if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:')) {
            return; // External link or anchor, let browser handle
        }
        if ($(this).attr('target') === '_blank') return;
        if ($(this).attr('download') !== undefined) return;

        // Check if this matches one of our routes
        const matched = matchRoute(href);
        if (matched) {
            e.preventDefault();
            navigateTo(href, 'link-click');
        }
    });

    // Listen for popstate (back/forward)
    window.addEventListener('popstate', () => {
        console.log('[Router] popstate event, path:', window.location.pathname);
        handleNavigation(window.location.pathname, 'popstate');
    });

    // Initial render
    handleNavigation(window.location.pathname, 'initial-load');
}

/**
 * Programmatic navigation to a path.
 * @param {string} path - The path to navigate to
 */
export function navigate(path) {
    navigateTo(path, 'programmatic');
}

function navigateTo(path, trigger) {
    // Normalize before comparing
    let normalizedPath = path;
    if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath.slice(0, -1);
    }
    const queryIdx = normalizedPath.indexOf('?');
    if (queryIdx !== -1) {
        normalizedPath = normalizedPath.substring(0, queryIdx);
    }
    
    if (normalizedPath === currentPath && trigger !== 'initial-load') return;
    history.pushState({}, '', path);
    handleNavigation(path, trigger);
}

function handleNavigation(path, trigger) {
    const from = currentPath;
    // Normalize: strip trailing slash (except for root)
    if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    // Strip query string for route matching (but keep in URL)
    const cleanPath = path.indexOf('?') !== -1 ? path.substring(0, path.indexOf('?')) : path;
    currentPath = cleanPath;
    console.log(`[Router] ${trigger}: ${from || '(none)'} → ${cleanPath}${path !== cleanPath ? ' (query stripped from: ' + path + ')' : ''}`);

    // Clean up ALL delegated page event handlers before rendering new page
    // Each page uses namespaced events like 'submit.searchpage', 'change.bookshelffilter', etc.
    console.log('[Router] Cleaning up delegated event handlers from previous page...');
    $(document).off('.searchpage');
    $(document).off('.searchupload');
    $(document).off('.searcherrorlinks');
    $(document).off('.searchurlimport');
    $(document).off('.loginform');
    $(document).off('.logintoggle');
    $(document).off('.bookshelffilter');
    $(document).off('.bookshelftoggle');

    // Signal any in-flight search streams to abort (search page listens for this)
    window.dispatchEvent(new CustomEvent('search-page-cleanup'));

    const matched = matchRoute(cleanPath);
    if (matched) {
        renderPage(matched.handler, matched.params);
    } else {
        console.warn(`[Router] No route matched for: ${path}, falling back to /`);
        currentPath = '/';
        history.replaceState({}, '', '/');
        const homeMatch = matchRoute('/');
        if (homeMatch) {
            renderPage(homeMatch.handler, homeMatch.params);
        }
    }
}

function matchRoute(path) {
    // Normalize: strip trailing slash (except for root)
    if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    // Strip query string if present
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
        path = path.substring(0, queryIndex);
    }
    for (const route of routes) {
        const match = path.match(route.regex);
        if (match) {
            const params = {};
            route.paramNames.forEach((name, i) => {
                params[name] = match[i + 1];
            });
            return { handler: route.handler, params };
        }
    }
    return null;
}
