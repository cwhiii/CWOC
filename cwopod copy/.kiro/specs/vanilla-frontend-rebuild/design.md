# Design Document: Vanilla Frontend Rebuild

## Overview

This design replaces the SvelteKit/Vite/TypeScript frontend with a vanilla JavaScript (ES6+) + jQuery application served as static files by Caddy. The rebuild preserves all existing functionality across 7 pages while eliminating the Node.js build step entirely.

**Key Design Decisions:**
- **ES6 modules** for code organization (native browser `import`/`export`, no bundler)
- **jQuery 3.x** for DOM manipulation with CDN + local fallback
- **History API** for client-side routing (SPA behavior)
- **Single `index.html`** entry point with dynamic page rendering into a `<main>` container
- **Single-stage Dockerfile** (`caddy:2-alpine` + COPY) replacing the multi-stage Node build
- **Existing Caddyfile** unchanged — already handles SPA fallback via `try_files`

The architecture mirrors the existing Svelte app's behavior: a persistent header/nav shell with page content swapped dynamically based on URL, an API client wrapping fetch with verbose logging, and cookie-based session auth checked on load.

## Architecture

```mermaid
graph TD
    subgraph Browser
        HTML[index.html]
        CSS[css/styles.css]
        JQ[jQuery 3.x CDN + fallback]
        APP[js/app.js - entry point]
        API[js/api.js - fetch wrapper]
        RTR[js/router.js - History API router]
        AUTH[js/auth.js - auth state]
        DOM[js/dom.js - DOM helpers]
        PH[js/pages/home.js]
        PL[js/pages/login.js]
        PS[js/pages/search.js]
        PB[js/pages/bookshelf.js]
        PST[js/pages/settings.js]
        PP[js/pages/project.js]
        PC[js/pages/cover.js]
    end

    subgraph Docker
        CADDY[Caddy 2 Alpine]
        SRV[/srv - static files]
    end

    subgraph Backend
        FASTAPI[FastAPI app:8000]
    end

    HTML --> JQ
    HTML --> APP
    APP --> RTR
    APP --> AUTH
    RTR --> PH & PL & PS & PB & PST & PP & PC
    PH & PL & PS & PB & PST & PP & PC --> API
    PH & PL & PS & PB & PST & PP & PC --> DOM
    CADDY --> SRV
    CADDY -->|/api/*| FASTAPI
```

**Request Flow:**
1. Browser requests any path → Caddy serves `index.html` (SPA fallback via `try_files`)
2. `index.html` loads jQuery, then `js/app.js` as ES6 module
3. `app.js` initializes auth check, renders shell, starts router
4. Router matches URL → loads page module → page renders into `<main id="app">`
5. Page modules use `api.js` for all backend communication at `/api/*`

## Components and Interfaces

### 1. API Client (`js/api.js`)

Vanilla ES6 module replicating the existing TypeScript API client behavior exactly.

```javascript
// Exported interface
export const api = {
  get(path)           → Promise<object|undefined>
  post(path, body?)   → Promise<object|undefined>
  patch(path, body?)  → Promise<object|undefined>
  delete(path)        → Promise<object|undefined>
}
```

**Behavior:**
- Prepends `/api` to all paths
- Sets `credentials: 'include'` on every request
- Sets `Content-Type: application/json` when body is present
- Generates a 6-char random request ID per call for log correlation
- Logs: request start (method, URL, body), response (status, elapsed ms), errors (full detail + traceback)
- 2xx (non-204): parses JSON, returns parsed object
- 204: returns `undefined`
- Non-2xx: parses error JSON, logs detail/traceback/path, throws Error with detail message
- Network error: logs, re-throws
- JSON parse failure: logs raw text + parse error, throws

### 2. Router (`js/router.js`)

Client-side SPA router using History API.

```javascript
// Exported interface
export function initRouter(routes, renderFn)  // registers routes, starts listening
export function navigate(path)                 // programmatic navigation
```

**Route Table:**
| Pattern | Page Module |
|---------|-------------|
| `/` | `home.js` |
| `/login` | `login.js` |
| `/search` | `search.js` |
| `/bookshelf` | `bookshelf.js` |
| `/settings` | `settings.js` |
| `/projects/:id` | `project.js` |
| `/projects/:id/cover` | `cover.js` |

**Matching Algorithm:**
- Routes stored as array of `{ pattern, regex, paramNames, handler }`
- `:id` segments converted to named capture groups: `/projects/:id` → `/^\/projects\/([^/]+)$/`
- On navigation: iterate routes, first regex match wins, extract params
- No match → render home page, `history.replaceState` to `/`

**Event Handling:**
- `click` listener on `document` intercepts `<a>` clicks with internal `href` (same origin, matches route)
- `popstate` listener handles back/forward
- All navigations logged: `[Router] {trigger} {from} → {to}`

### 3. Auth State (`js/auth.js`)

```javascript
export let currentUser = null;  // { email, display_name } or null
export async function checkAuth()   → Promise<boolean>
export async function logout()      → void
export function isAuthenticated()   → boolean
export function onAuthChange(cb)    // register callback for auth state changes
```

**Behavior:**
- `checkAuth()` calls `GET /api/user/profile`
  - Success: sets `currentUser`, returns `true`
  - Failure (any non-2xx or network error): sets `currentUser = null`, returns `false`
- `logout()` calls `POST /api/auth/logout`, sets `currentUser = null`, triggers full page reload to `/login`
- `onAuthChange` callbacks fire when `currentUser` changes (used by shell to update nav)

### 4. DOM Helpers (`js/dom.js`)

Utility functions wrapping common jQuery patterns for consistency.

```javascript
export function $(selector)              // jQuery selector shorthand (already global, but re-export for modules)
export function showError(container, msg)
export function showSuccess(container, msg)
export function clearMessages(container)
export function setLoading(button, isLoading, loadingText)
export function renderStatusBadge(status)  → HTML string
```

### 5. Application Shell (`js/app.js`)

Entry point module. Orchestrates initialization:

1. Verify `window.jQuery` exists, log version
2. Call `checkAuth()` 
3. Render header/nav based on auth state
4. Initialize router with route table
5. Register `onAuthChange` to re-render nav

### 6. Page Modules (`js/pages/*.js`)

Each page module exports a single `render(container, params)` function:

```javascript
// js/pages/home.js
export async function render(container, params) { ... }
```

- `container`: the `<main id="app">` jQuery element
- `params`: object with extracted route params (e.g., `{ id: "abc123" }`)
- Each page is responsible for its own API calls, event binding, and DOM rendering
- Pages use jQuery for all DOM manipulation: `$(container).html(...)`, event delegation, class toggling

**Page-specific behaviors preserved from existing Svelte implementation:**
- **Home**: Fetch first 5 projects, show auth prompt if unauthenticated
- **Login**: Toggle login/register mode, client-side password length validation (≥8 for register), full page reload on success
- **Search**: Min 2-char validation, provider summary display, file upload (multipart), connectivity check on load
- **Bookshelf**: Pagination, status filter, drag-and-drop reorder (HTML5 Drag API + jQuery), batch order with estimate flow
- **Settings**: Parallel API fetches, independent section rendering, credential CRUD
- **Project Wizard**: 5-step progress indicator, polling for typo scan (2s interval, 60s timeout) and typeset (3s interval, 120s timeout)
- **Cover Builder**: 3-step flow, prompt grid, image generation, live preview with real-time text/font updates, template application, blurb generation, PDF assembly

### 7. Static File Structure

```
frontend/
├── index.html              # SPA entry point
├── Caddyfile               # Reverse proxy + SPA fallback config
├── Dockerfile              # Single-stage: caddy:2-alpine + COPY
├── css/
│   └── styles.css          # All styles (single file, no preprocessor)
├── js/
│   ├── app.js              # Entry point (type="module")
│   ├── api.js              # API client
│   ├── router.js           # Client-side router
│   ├── auth.js             # Auth state management
│   ├── dom.js              # DOM helper utilities
│   └── pages/
│       ├── home.js
│       ├── login.js
│       ├── search.js
│       ├── bookshelf.js
│       ├── settings.js
│       ├── project.js
│       └── cover.js
├── lib/
│   └── jquery-3.7.1.min.js # Local jQuery fallback
└── assets/
    └── (images, fonts if any)
```

### 8. Dockerfile

```dockerfile
FROM caddy:2-alpine
COPY index.html /srv/index.html
COPY css/ /srv/css/
COPY js/ /srv/js/
COPY lib/ /srv/lib/
COPY assets/ /srv/assets/
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
```

No RUN instructions. No package managers. No build tools. Single stage.

### 9. Caddyfile (Unchanged)

```
:80 {
    handle /api/* {
        reverse_proxy app:8000
    }

    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

The existing Caddyfile already provides:
- API proxying to backend
- Static file serving
- SPA fallback (try_files → index.html)

No changes needed.

### 10. index.html Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>C.W.'s O-POD</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
</head>
<body>
    <div class="app">
        <header id="app-header">
            <!-- Rendered by app.js based on auth state -->
        </header>
        <main id="app">
            <!-- Page content rendered here by router -->
        </main>
    </div>

    <!-- jQuery: CDN with local fallback -->
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
    <script>
        if (!window.jQuery) {
            console.warn('[App] jQuery CDN failed, loading local fallback');
            document.write('<script src="/lib/jquery-3.7.1.min.js"><\/script>');
        }
    </script>

    <!-- Application entry point -->
    <script type="module" src="/js/app.js"></script>
</body>
</html>
```

## Data Models

No persistent client-side data models beyond what the API returns. State is held in module-level variables within each page module and the auth module.

**Auth State:**
```javascript
// js/auth.js
let currentUser = null;  // null | { email: string, display_name: string|null }
```

**Router State:**
```javascript
// js/router.js
let routes = [];         // Array<{ pattern, regex, paramNames, handler }>
let currentPath = '';    // Current URL path
```

**Page State (per-page module variables):**
- Each page module manages its own state as module-scoped `let` variables
- State is reset when the page's `render()` function is called (navigating away and back resets state)
- No global state store — each page is self-contained

**API Response Shapes (consumed, not defined by frontend):**
- Projects: `{ projects: [{ id, title, author, status, source_type }] }`
- Bookshelf: `{ items: [...], total_count, page, per_page, total_pages }`
- Profile: `{ email, display_name, created_at }`
- Search: `{ results: [...], total_count, provider_details: [...], providers_failed: [...] }`
- AI Config: `{ text_provider, text_model, text_api_key_set, image_provider, image_model, image_api_key_set }`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Client Request Configuration

*For any* HTTP method (get, post, patch, delete) and *for any* path string, the API client SHALL call fetch with a URL starting with `/api` followed by the path, and with `credentials: 'include'` in the request config. Additionally, *for any* post or patch call that includes a body object, the request SHALL include a `Content-Type: application/json` header.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 2: API Client Request ID Uniqueness

*For any* sequence of N API requests (where N ≥ 2), each request SHALL be assigned a distinct request ID, and no two request IDs in the sequence SHALL be equal.

**Validates: Requirements 4.5**

### Property 3: API Client JSON Response Round-Trip

*For any* JSON-serializable JavaScript object returned as the body of a 200 response, the API client SHALL return a value that is deeply equal to the original object.

**Validates: Requirements 4.7**

### Property 4: API Client Error Propagation

*For any* HTTP response with a non-2xx status code and a JSON body containing a `detail` field, the API client SHALL throw an Error whose message contains the value of the `detail` field.

**Validates: Requirements 4.8**

### Property 5: Router Parameter Extraction

*For any* non-empty string used as a project ID in a URL matching `/projects/:id` or `/projects/:id/cover`, the router SHALL extract that exact string as the `id` parameter and pass it to the page render function.

**Validates: Requirements 5.5**

## Error Handling

### API Client Errors

| Scenario | Behavior |
|----------|----------|
| Network failure (fetch rejects) | Log `[API][{id}] NETWORK ERROR after {ms}ms: {message}`, re-throw original error |
| HTTP 4xx/5xx | Parse JSON body, log status + elapsed + detail/traceback/path fields, throw Error with `detail` message |
| JSON parse failure on response | Log raw response text (first 500 chars) + parse error message, throw parse error |
| HTTP 204 | Log status + elapsed, return `undefined` (no parse attempt) |

### Router Errors

| Scenario | Behavior |
|----------|----------|
| Unknown route | Log warning, render home page, `history.replaceState({}, '', '/')` |
| Page render throws | Catch in router, display error message in `<main>`, log full error |

### Page-Level Errors

- All API call failures display user-facing error messages within the page container
- Error messages use the `.error` CSS class (red text, light red background, red border)
- Full error details (including backend tracebacks) logged to browser console
- Loading states disable submit buttons to prevent duplicate requests
- Polling operations (typo scan, typeset) have hard timeouts with user-facing timeout messages

### Auth Errors

- `GET /api/user/profile` failure → treat as unauthenticated (show login link, hide nav)
- `POST /api/auth/logout` failure → still redirect to `/login` (best-effort logout)
- Any API call returning 401 during page operation → page shows error, user can navigate to login

## Testing Strategy

### Approach

This feature is primarily a UI rebuild (DOM manipulation, page rendering, event handling) with two modules that have clear input/output behavior suitable for property-based testing: the **API client** and the **router**.

**Property-Based Testing** (fast-check library):
- API client: request configuration, ID uniqueness, JSON round-trip, error propagation
- Router: parameter extraction from URL patterns
- Minimum 100 iterations per property test
- Tag format: `Feature: vanilla-frontend-rebuild, Property N: {title}`

**Unit Tests** (example-based, using vitest + jsdom):
- Router: route matching for all 7 routes, popstate handling, unknown route fallback
- Auth module: checkAuth success/failure, logout behavior
- API client: 204 handling, network error re-throw, JSON parse error
- DOM helpers: showError/showSuccess rendering

**Smoke Tests** (file structure validation):
- No framework files exist (package.json, .svelte, .ts, etc.)
- Dockerfile is single-stage with no RUN instructions
- All required static files exist in correct locations
- index.html has jQuery before app.js in script order
- No framework imports in any .js file

**Integration Tests** (manual or Docker-based):
- Full page load renders correctly
- Navigation between pages works without reload
- API calls reach backend through Caddy proxy
- SPA fallback serves index.html for unknown paths
- Auth flow: login → navigate → logout → redirect

### Test File Structure

```
frontend/
├── tests/
│   ├── api.property.test.js      # Property tests for API client
│   ├── router.property.test.js   # Property tests for router
│   ├── api.test.js               # Unit tests for API client
│   ├── router.test.js            # Unit tests for router
│   ├── auth.test.js              # Unit tests for auth module
│   └── smoke.test.js             # File structure validation
```

### Test Configuration

- **Library**: vitest (already available in dev context) + fast-check for property tests
- **Environment**: jsdom (for DOM APIs, fetch mocking)
- **Property test iterations**: 100 minimum per property
- **Mocking**: `global.fetch` mocked for API client tests, `window.history` for router tests
