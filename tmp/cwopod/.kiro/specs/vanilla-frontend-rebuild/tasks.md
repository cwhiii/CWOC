# Implementation Plan: Vanilla Frontend Rebuild

## Overview

Remove all SvelteKit/Vite/TypeScript framework files and rebuild the frontend as static vanilla JavaScript (ES6+) + jQuery + HTML/CSS served directly by Caddy. The implementation proceeds in layers: infrastructure first, then core modules, then CSS, then page modules, then tests.

## Tasks

- [x] 1. Remove framework files and create new infrastructure
  - [x] 1.1 Delete all framework source files and configuration
    - Delete `frontend/src/` directory (all Svelte/TypeScript source)
    - Delete `frontend/package.json`, `frontend/tsconfig.json`, `frontend/svelte.config.js`, `frontend/vite.config.ts`
    - Keep `frontend/Caddyfile` (unchanged), `frontend/static/` assets
    - Verify no `.svelte`, `.ts`, `.tsx`, `.jsx` files remain
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Create new Dockerfile (single-stage, no build step)
    - Replace `frontend/Dockerfile` with single-stage `FROM caddy:2-alpine`
    - COPY `index.html`, `css/`, `js/`, `lib/`, `assets/`, `Caddyfile` into appropriate locations
    - No RUN instructions, no package managers
    - EXPOSE 80
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 Create `frontend/index.html` (SPA entry point)
    - HTML5 doctype, charset UTF-8, viewport meta
    - Link to `/css/styles.css` and Google Fonts (Lora)
    - App shell: `<header id="app-header">` and `<main id="app">`
    - jQuery CDN script with local fallback (`/lib/jquery-3.7.1.min.js`)
    - `<script type="module" src="/js/app.js">` after jQuery
    - _Requirements: 15.1, 15.3, 15.4, 16.1, 16.5_

  - [x] 1.4 Create `frontend/lib/jquery-3.7.1.min.js` placeholder and move static assets
    - Create `frontend/lib/` directory with jQuery 3.7.1 minified file
    - Move `frontend/static/favicon.png` and `frontend/static/parchment.jpg` to `frontend/assets/`
    - Remove `frontend/static/` directory
    - _Requirements: 15.1, 15.4_

- [x] 2. Implement core JavaScript modules
  - [x] 2.1 Create `frontend/js/api.js` (API client module)
    - Export `api` object with `get`, `post`, `patch`, `delete` methods
    - Prepend `/api` to all paths, set `credentials: 'include'`
    - Set `Content-Type: application/json` for post/patch with body
    - Generate 6-char random request ID per call
    - Log request start (method, URL, body), response (status, elapsed ms)
    - Handle 2xx (parse JSON, return), 204 (return undefined), non-2xx (parse error, log detail/traceback/path, throw), network error (log, re-throw), JSON parse error (log raw text, throw)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [ ]* 2.2 Write property tests for API client
    - **Property 1: API Client Request Configuration** — For any method and path, fetch is called with URL starting with `/api` + path, credentials include, and Content-Type header for post/patch with body
    - **Property 2: API Client Request ID Uniqueness** — For any sequence of N requests (N≥2), all request IDs are distinct
    - **Property 3: API Client JSON Response Round-Trip** — For any JSON-serializable object as 200 response body, api returns deeply equal object
    - **Property 4: API Client Error Propagation** — For any non-2xx response with JSON body containing `detail`, thrown error message contains the detail value
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.7, 4.8**
    - Create `frontend/tests/api.property.test.js` using fast-check with minimum 100 iterations per property

  - [x] 2.3 Create `frontend/js/router.js` (History API router)
    - Export `initRouter(routes, renderFn)` and `navigate(path)`
    - Route table: `/`, `/login`, `/search`, `/bookshelf`, `/settings`, `/projects/:id`, `/projects/:id/cover`
    - Convert `:id` segments to regex capture groups
    - Intercept `<a>` clicks on internal links via document-level click listener
    - Handle `popstate` for back/forward navigation
    - On initial load, render page matching current URL
    - Unknown routes → render home, `history.replaceState` to `/`
    - Log all navigations: trigger type, source path, destination path
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 2.4 Write property tests for router
    - **Property 5: Router Parameter Extraction** — For any non-empty string as project ID in `/projects/:id` or `/projects/:id/cover`, router extracts that exact string as the `id` parameter
    - **Validates: Requirements 5.5**
    - Create `frontend/tests/router.property.test.js` using fast-check with minimum 100 iterations

  - [x] 2.5 Create `frontend/js/auth.js` (authentication state)
    - Export `currentUser`, `checkAuth()`, `logout()`, `isAuthenticated()`, `onAuthChange(cb)`
    - `checkAuth()` calls `GET /api/user/profile` — success sets user, failure sets null
    - `logout()` calls `POST /api/auth/logout`, clears user, full page reload to `/login`
    - `onAuthChange` fires callbacks when currentUser changes
    - Log auth check result (authenticated + email, or error details)
    - _Requirements: 6.4, 6.5, 6.6, 6.7_

  - [x] 2.6 Create `frontend/js/dom.js` (DOM helper utilities)
    - Export `showError(container, msg)`, `showSuccess(container, msg)`, `clearMessages(container)`, `setLoading(button, isLoading, loadingText)`, `renderStatusBadge(status)`
    - Use jQuery for DOM manipulation
    - Error messages use `.error` class, success messages use `.success` class
    - Loading state disables button and shows loading text
    - Status badge maps status to appropriate color class
    - _Requirements: 14.9, 16.3_

  - [x] 2.7 Create `frontend/js/app.js` (application entry point)
    - Verify `window.jQuery` exists, log version
    - Call `checkAuth()` on load
    - Render header/nav: logo linking to `/`, nav links based on auth state
    - Authenticated: Search, Bookshelf, Settings links + email + Logout button
    - Unauthenticated: Login link only
    - Initialize router with route table mapping to page modules
    - Register `onAuthChange` to re-render nav on auth state change
    - _Requirements: 6.1, 6.2, 6.3, 15.5, 16.2_

- [x] 3. Checkpoint - Core modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create CSS design system
  - [x] 4.1 Create `frontend/css/styles.css` (complete design system)
    - Font: `'Lora', Georgia, serif`, base 16px, line-height 1.6
    - Color palette: dark brown #4a2c2a, medium brown #8b5a2b, saddle brown #8b4513, cream #fdf5e6, warm white #fff8dc, parchment gradient #fff8e1→#f5e6cc, teal #008080, gold #d4af37, tan #d2b48c, error red #b22222
    - Body: parchment background #faebd7
    - Primary buttons: bg #8b5a2b, text #fdf5e6, hover #6b4e31
    - Secondary buttons: gradient #d4a373→#c8965a, dark text
    - Form inputs: border #8b5a2b, bg #fdf5e6, teal focus ring rgba(0,128,128,0.25)
    - Content panels: gradient #fff8e1→#f5e6cc, 2px solid #8b4513, 10px radius, box-shadow
    - Header: bg #e0d4b5, 2px solid #8b4513 bottom border, sticky
    - Status badges: 4px radius, 0.75rem font, color-mapped (teal=complete, gold=in-progress, tan=pending, red=failed)
    - Responsive layout, form styles, error/success message styles, loading states
    - Page-specific styles: login form, search results, bookshelf grid, settings sections, project wizard steps, cover builder layout
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

- [x] 5. Implement page modules (part 1)
  - [x] 5.1 Create `frontend/js/pages/home.js`
    - Export `render(container, params)` function
    - Authenticated: fetch `GET /api/projects/`, display first 5 projects (title, author or "Unknown Author", status badge)
    - Click project → navigate to `/projects/{id}`
    - Zero projects: message + link to Search page
    - Fetch failure: error message + console log
    - Unauthenticated: sign-in prompt with link to login
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.2 Create `frontend/js/pages/login.js`
    - Export `render(container, params)` function
    - Form: email (max 254), password (max 128), submit button
    - Toggle between login/register modes (login default)
    - Login: `POST /api/auth/login`, Register: `POST /api/auth/register`
    - Success: full page reload to home
    - Failure: show error below form, keep email value
    - Register mode: client-side validation for password ≥ 8 chars
    - Disable submit while request in progress
    - Log auth attempts (mode, email, success/failure)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 5.3 Create `frontend/js/pages/search.js`
    - Export `render(container, params)` function
    - Search input + submit, min 2-char validation
    - Call `GET /api/search/?q={query}`, display results (title, author, provider badge, quality badge)
    - Provider summary from `provider_details` and `providers_failed`
    - Zero results message
    - "Start Project" button → `POST /api/projects/import`, success message + redirect after 1s
    - File upload section: EPUB, DOCX, TXT, PDF up to 200MB
    - Client-side validation for extension and size
    - Upload via multipart POST to `/api/projects/upload`
    - On load: `GET /api/health/connectivity` diagnostics
    - Log all queries, results, imports, uploads, errors
    - _Requirements: 9.1–9.16_

  - [x] 5.4 Create `frontend/js/pages/bookshelf.js`
    - Export `render(container, params)` function
    - Fetch `GET /api/bookshelf?page=1&per_page=50`, display project list (title, author, status badge)
    - Status filter dropdown (draft, typeset, cover_ready, print_ready, ordered, shipped, All)
    - Pagination controls (Previous/Next + page indicator)
    - Drag-and-drop reorder using HTML5 Drag API + jQuery, persist via `PATCH /api/bookshelf/order`
    - Batch Order toggle → multi-select checkboxes
    - Batch form: provider dropdown, shipping address, "Get Pricing Estimate" button
    - Estimate: `POST /api/bookshelf/batch-order` action=estimate, display pricing breakdown
    - Submit: `POST /api/bookshelf/batch-order` action=submit
    - Error handling for all operations, success message for batch order
    - Log all fetches, filters, drag-drop, selections, orders
    - _Requirements: 10.1–10.13_

- [x] 6. Implement page modules (part 2)
  - [x] 6.1 Create `frontend/js/pages/settings.js`
    - Export `render(container, params)` function
    - Parallel fetch: `GET /api/user/ai-config`, `GET /api/user/profile`, `GET /api/print/credentials`, `GET /api/user/preferences`, `GET /api/search/credentials`
    - Render sections independently as data arrives
    - AI Config: text/image provider dropdowns, conditional model name + API key fields, save via `PATCH /api/user/ai-config`
    - Book Sources: Standard Ebooks status, Project Gutenberg (no creds)
    - Default Print Provider: dropdown (Lulu/BookVault/KDP), save on change via `PATCH /api/user/preferences`
    - Print Credentials: Lulu (client_id, client_secret), BookVault (api_key), save via `POST /api/print/credentials`, remove via `DELETE /api/print/credentials/{provider}`
    - Account: email (read-only), display name (max 100), save via `PATCH /api/user/profile`, logout button
    - Success indicators visible ≥ 3 seconds
    - Section-level error handling for failed fetches
    - Log all API calls
    - _Requirements: 11.1–11.14_

  - [x] 6.2 Create `frontend/js/pages/project.js`
    - Export `render(container, params)` function
    - Fetch `GET /api/projects/{id}`, map status to wizard step
    - 5-step progress indicator (Source, Typo Check, Typeset, Cover, Print) with done/active/disabled states
    - Click completed/active steps to switch panels; disabled steps non-interactive
    - Typo Check: "Scan for Typos" → `POST /api/projects/{id}/scan-typos`, poll corrections at 2s intervals (60s timeout)
    - Display corrections (original, suggested, context) with accept/reject + bulk actions
    - "Apply Accepted & Continue" → `POST /api/projects/{id}/corrections/apply`, advance step
    - Typeset: "Generate Interior PDF" → `POST /api/projects/{id}/typeset`, poll status at 3s intervals (120s timeout)
    - Print: provider dropdown, shipping address fields, pricing estimate + submit order
    - Timeout error messages for polling operations
    - Log all step transitions, API calls, polling attempts, user actions
    - _Requirements: 12.1–12.13_

  - [x] 6.3 Create `frontend/js/pages/cover.js`
    - Export `render(container, params)` function
    - Fetch templates `GET /api/projects/templates` and project `GET /api/projects/{id}`
    - Step 1: "Generate Cover Prompts" button + image upload (PNG/JPEG, max 25MB)
    - Step 2: Prompt grid with "Generate Image" buttons → `POST /api/projects/{id}/cover/generate-image`
    - HTTP 429 handling: disable all generate buttons, show limit message
    - Select generated image or upload custom image
    - Step 3: Two-column layout — live preview + controls
    - Live preview: back cover (blurb + QR), spine (title, width ∝ page count), front cover (image + title + author overlays)
    - Template selection buttons applying predefined font/size/color/position
    - Title input (max 100) + author input (max 60) with font family, size, color controls
    - Real-time preview updates on any control change
    - "Generate Synopsis" → `POST /api/projects/{id}/cover/generate-blurb`, editable textarea (max 3000) + word count
    - "Generate Print-Ready Cover PDF" → `POST /api/projects/{id}/cover/assemble` with full layout object
    - HTTP 422 handling: display missing elements list
    - Success: message with spine width, redirect to project page after 2s
    - Log all operations with full request/response details
    - _Requirements: 13.1–13.16_

- [x] 7. Checkpoint - All pages complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Testing and validation
  - [ ]* 8.1 Write unit tests for API client
    - Create `frontend/tests/api.test.js`
    - Test 204 handling returns undefined
    - Test network error re-throw
    - Test JSON parse error logging and throw
    - Test request logging format
    - _Requirements: 4.7, 4.9, 4.10, 4.11_

  - [ ]* 8.2 Write unit tests for router
    - Create `frontend/tests/router.test.js`
    - Test all 7 routes match correctly
    - Test popstate handling
    - Test unknown route fallback to home
    - Test parameter extraction for project routes
    - _Requirements: 5.1, 5.3, 5.5, 5.7_

  - [ ]* 8.3 Write unit tests for auth module
    - Create `frontend/tests/auth.test.js`
    - Test checkAuth success sets currentUser
    - Test checkAuth failure sets null
    - Test logout calls API and triggers reload
    - Test onAuthChange callbacks fire
    - _Requirements: 6.4, 6.5, 6.6_

  - [ ]* 8.4 Write smoke tests for file structure validation
    - Create `frontend/tests/smoke.test.js`
    - Verify no framework files exist (package.json, .svelte, .ts, etc.)
    - Verify Dockerfile is single-stage with no RUN instructions
    - Verify all required static files exist in correct locations
    - Verify index.html has jQuery before app.js in script order
    - Verify no framework imports in any .js file
    - _Requirements: 1.1–1.5, 2.1–2.5, 16.1_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Caddyfile is unchanged — it already handles SPA fallback and API proxying
- The `docker-compose.yml` frontend service needs no changes (same build context, same Dockerfile path)
- jQuery 3.7.1 minified file must be obtained separately (not installed via npm per workspace rules)
- All JavaScript uses ES6 module syntax (`import`/`export`) with `<script type="module">`
- Every function must include verbose console logging per workspace steering rules

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.3", "2.5", "2.6", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.7"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4"] }
  ]
}
```
