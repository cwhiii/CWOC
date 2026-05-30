# Requirements Document

## Introduction

This feature removes all frontend framework dependencies (SvelteKit, Vite, TypeScript, Svelte, adapter-static, vite-plugin-svelte, svelte-check, and Fabric.js) and rebuilds the entire frontend using vanilla JavaScript (ES6+), jQuery for DOM manipulation, and plain HTML/CSS. The rebuilt frontend preserves all existing functionality across 7 pages, maintains the warm book/leather visual aesthetic, and eliminates the Node.js build step from the Docker pipeline. Static files are served directly by Caddy.

## Glossary

- **Frontend**: The client-side web application served as static HTML, CSS, and JavaScript files by Caddy
- **API_Client**: The JavaScript module that wraps fetch calls to the backend API at `/api/*`, providing verbose console logging, JSON parsing, error extraction, and credential handling
- **Caddy**: The reverse proxy and static file server that serves the frontend and proxies `/api/*` requests to the backend
- **Page_Router**: The client-side JavaScript module that handles URL-based navigation between pages without full page reloads, using the History API
- **Cover_Builder**: The page at `/projects/{id}/cover` providing a 3-step workflow for generating cover art prompts, generating/selecting images, and assembling a print-ready cover PDF
- **Project_Wizard**: The page at `/projects/{id}` providing a 5-step workflow (Source → Typo Check → Typeset → Cover → Print) for processing a book project
- **Bookshelf_Page**: The page at `/bookshelf` displaying a paginated, filterable list of user projects with drag-and-drop reordering and batch ordering capabilities
- **Settings_Page**: The page at `/settings` managing AI provider configuration, print credentials, source credentials, user profile, and default print provider
- **Search_Page**: The page at `/search` providing multi-provider book search and file upload functionality
- **Build_Pipeline**: The Docker build process for the frontend container image
- **SPA_Fallback**: The Caddy configuration that routes all non-file, non-API requests to `index.html` for client-side routing

## Requirements

### Requirement 1: Remove All Framework Dependencies

**User Story:** As a developer, I want all frontend framework packages removed from the project, so that the frontend has zero Node.js dependencies and no build step.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL NOT require Node.js, npm, or any package manager to produce the frontend artifacts
2. THE Frontend SHALL NOT contain any package.json, package-lock.json, yarn.lock, pnpm-lock.yaml, node_modules, tsconfig.json, svelte.config.js, vite.config.ts, .babelrc, postcss.config.js, or any other framework or bundler configuration files
3. THE Frontend SHALL NOT contain any TypeScript (.ts, .tsx), Svelte (.svelte), or JSX (.jsx) source files
4. THE Frontend SHALL consist exclusively of plain HTML (.html), CSS (.css), JavaScript (.js) files, and static assets (images, fonts, and SVG files) that require no compilation or transpilation
5. THE Frontend SHALL NOT contain any JavaScript import statements referencing framework packages (such as `svelte`, `@sveltejs/*`, `vite`, or `typescript`)

### Requirement 2: Simplified Docker Build

**User Story:** As a developer, I want the frontend Dockerfile to simply copy static files into the Caddy image, so that builds are fast and require no Node.js runtime.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL use a single-stage Dockerfile based on the `caddy:2-alpine` image
2. THE Build_Pipeline SHALL copy the static frontend files from the build context into `/srv` without any build or compilation step
3. THE Build_Pipeline SHALL copy the Caddyfile into `/etc/caddy/Caddyfile`
4. THE Build_Pipeline SHALL expose port 80
5. THE Build_Pipeline SHALL NOT contain any RUN instructions that invoke a package manager, compiler, or build tool

### Requirement 3: Caddy Configuration Preserved

**User Story:** As a developer, I want the Caddy reverse proxy and SPA fallback configuration to remain unchanged, so that API proxying and client-side routing continue to work.

#### Acceptance Criteria

1. THE Caddy SHALL listen on port 80 and reverse proxy all requests matching `/api/*` to the backend service at `app:8000`
2. THE Caddy SHALL serve static files from the `/srv` directory for all requests not matching `/api/*`
3. WHEN a requested file path does not exist on disk and the request does not match `/api/*`, THE Caddy SHALL serve `index.html` from the `/srv` directory (SPA_Fallback)
4. IF the backend service at `app:8000` is unreachable when proxying an `/api/*` request, THEN THE Caddy SHALL return an HTTP 502 response to the client

### Requirement 4: API Client Module

**User Story:** As a developer, I want a vanilla JavaScript API client that replicates the existing fetch wrapper, so that all pages can communicate with the backend using the same verbose logging pattern.

#### Acceptance Criteria

1. THE API_Client SHALL provide `get`, `post`, `patch`, and `delete` methods that each accept a path parameter and an optional request body parameter, where `post` and `patch` send the body as JSON and `get` and `delete` ignore the body parameter
2. THE API_Client SHALL prepend `/api` to all request paths
3. THE API_Client SHALL include `credentials: 'include'` on all fetch requests
4. THE API_Client SHALL set the `Content-Type` header to `application/json` on requests that include a request body (`post` and `patch`)
5. THE API_Client SHALL generate a unique request ID for each request and include it in all log messages for that request
6. WHEN a request is initiated, THE API_Client SHALL log the HTTP method, full URL, and request body to the browser console
7. WHEN a response with a 2xx status code (other than 204) is received, THE API_Client SHALL log the response status code and elapsed time in milliseconds, parse the response body as JSON, and return the parsed object
8. WHEN a response has a non-2xx status code, THE API_Client SHALL parse the response body as JSON, log the response status code, elapsed time, and the full error detail including any `detail`, `traceback`, and `path` fields, and then throw an error containing the parsed error body
9. WHEN a response has status 204, THE API_Client SHALL log the status code and elapsed time, and return undefined without attempting to parse a body
10. WHEN a network error occurs (fetch rejects), THE API_Client SHALL log the error message and indicate the request never received a response, and then re-throw the error
11. IF a JSON parse error occurs on the response body, THEN THE API_Client SHALL log the raw response text and the parse error message before throwing the parse error

### Requirement 5: Client-Side Page Routing

**User Story:** As a developer, I want client-side routing using the History API, so that navigation between pages does not trigger full page reloads and the URL structure matches the existing routes.

#### Acceptance Criteria

1. THE Page_Router SHALL support the following routes: `/`, `/login`, `/search`, `/bookshelf`, `/settings`, `/projects/:id`, `/projects/:id/cover`
2. WHEN an internal anchor element with an `href` matching a defined route is clicked, THE Page_Router SHALL intercept the click event, update the browser URL using `history.pushState`, and render the target page without a full page reload
3. WHEN the browser back/forward buttons are used, THE Page_Router SHALL handle the `popstate` event and render the page matching the URL in `window.location.pathname`
4. WHEN the application loads for the first time, THE Page_Router SHALL render the page matching the current URL path
5. THE Page_Router SHALL extract route parameters (project ID) from URL paths matching `/projects/:id` and `/projects/:id/cover` and pass them to the target page's render function
6. THE Page_Router SHALL log each navigation event to the browser console including the source path, destination path, and trigger type (link-click, popstate, or initial-load)
7. IF the current URL path does not match any defined route, THEN THE Page_Router SHALL render the home page (`/`) and update the browser URL to `/` using `history.replaceState`

### Requirement 6: Application Shell and Navigation

**User Story:** As a user, I want a persistent header with navigation links that updates based on my authentication state, so that I can navigate the application consistently.

#### Acceptance Criteria

1. THE Frontend SHALL render a sticky header containing the application logo linking to `/` and a navigation area
2. IF the user is authenticated, THEN THE Frontend SHALL display navigation links to Search (`/search`), Bookshelf (`/bookshelf`), and Settings (`/settings`), the user email, and a Logout button in the header
3. IF the user is not authenticated, THEN THE Frontend SHALL display only a Login link in the header
4. WHEN the page loads, THE Frontend SHALL check authentication status by calling `GET /api/user/profile`
5. IF the authentication check API call fails due to a network error or non-2xx response, THEN THE Frontend SHALL treat the user as not authenticated and display the unauthenticated header state
6. WHEN the Logout button is clicked, THE Frontend SHALL call `POST /api/auth/logout` and redirect to the login page
7. THE Frontend SHALL log the authentication check result including whether the user is authenticated and their email, or log the error details if the check failed

### Requirement 7: Home Page

**User Story:** As a user, I want to see my recent projects on the home page, so that I can quickly access my latest work.

#### Acceptance Criteria

1. WHEN the home page loads and the user is authenticated, THE Frontend SHALL fetch projects from `GET /api/projects/` and display the first 5 projects as returned by the API (ordered by sort order then creation date descending)
2. WHEN the home page loads and the user is not authenticated, THE Frontend SHALL display a sign-in prompt with a link to the login page
3. THE Frontend SHALL display each project with its title, author (or "Unknown Author" if the author field is absent), and a status badge showing the project status value
4. WHEN a project item is clicked, THE Page_Router SHALL navigate to `/projects/{id}`
5. IF the authenticated user has zero projects, THEN THE Frontend SHALL display a message indicating no projects exist and a link to the Search page to start one
6. IF the `GET /api/projects/` request fails, THEN THE Frontend SHALL display an error message indicating that projects could not be loaded and log the full error detail to the browser console

### Requirement 8: Login Page

**User Story:** As a user, I want to sign in or create an account, so that I can access my projects.

#### Acceptance Criteria

1. THE Frontend SHALL display a form with an email input field (max length 254 characters), a password input field (max length 128 characters), and a submit button
2. THE Frontend SHALL provide a toggle to switch between login and registration modes, with login mode displayed by default
3. WHEN the form is submitted in login mode, THE Frontend SHALL call `POST /api/auth/login` with the email and password
4. WHEN the form is submitted in registration mode, THE Frontend SHALL call `POST /api/auth/register` with the email and password
5. WHEN authentication succeeds, THE Frontend SHALL redirect to the home page using a full page reload
6. IF authentication fails, THEN THE Frontend SHALL display the error message from the API response below the form and keep the email field value intact
7. THE Frontend SHALL log the authentication attempt including mode and email, and log success or failure
8. WHILE an authentication request is in progress, THE Frontend SHALL disable the submit button to prevent duplicate submissions
9. IF the form is submitted in registration mode with a password shorter than 8 characters, THEN THE Frontend SHALL display an error message indicating the minimum password length without calling the API

### Requirement 9: Search Page

**User Story:** As a user, I want to search for public domain books and upload my own files, so that I can start new projects.

#### Acceptance Criteria

1. THE Search_Page SHALL display a search input field and a submit button
2. WHEN a search is submitted with at least 2 characters, THE Search_Page SHALL call `GET /api/search/?q={query}` and display the results as a list
3. IF a search is submitted with fewer than 2 characters, THEN THE Search_Page SHALL display a validation message indicating the minimum query length and SHALL NOT call the API
4. THE Search_Page SHALL display each result with title, author, provider name badge, and quality label badge
5. THE Search_Page SHALL display a provider summary showing result counts or error messages per provider, derived from the `provider_details` and `providers_failed` arrays in the API response
6. IF a search returns zero results, THEN THE Search_Page SHALL display a message indicating no books were found for the query
7. WHEN the "Start Project" button is clicked on a result, THE Search_Page SHALL call `POST /api/projects/import` with the provider_id and source_id
8. WHEN an import succeeds, THE Search_Page SHALL display a success message and redirect to the project page after 1 second
9. IF an import request fails, THEN THE Search_Page SHALL display an error message indicating the failure reason from the API response and remain on the search page
10. THE Search_Page SHALL display a file upload section accepting EPUB, DOCX, TXT, and PDF files up to 200 MB
11. IF a user selects a file with an unsupported extension or a file exceeding 200 MB, THEN THE Search_Page SHALL display a validation error message and SHALL NOT submit the upload
12. WHEN a file is uploaded, THE Search_Page SHALL send it as a multipart form POST to `/api/projects/upload`
13. WHEN a file upload succeeds, THE Search_Page SHALL display a success message and redirect to the project page after 1 second
14. IF a file upload request fails, THEN THE Search_Page SHALL display an error message indicating the failure reason from the API response and remain on the search page
15. WHEN the page loads, THE Search_Page SHALL call `GET /api/health/connectivity` for diagnostics and log the result
16. THE Search_Page SHALL log all search queries, result counts, provider details, import attempts, upload attempts, and all error responses including full API error bodies

### Requirement 10: Bookshelf Page

**User Story:** As a user, I want to view, filter, reorder, and batch-order my book projects, so that I can manage my collection efficiently.

#### Acceptance Criteria

1. WHEN the page loads, THE Bookshelf_Page SHALL fetch projects from `GET /api/bookshelf?page=1&per_page=50` and display them as a list
2. THE Bookshelf_Page SHALL display each project with its title, author, and status badge
3. THE Bookshelf_Page SHALL provide a status filter dropdown containing the values "draft", "typeset", "cover_ready", "print_ready", "ordered", and "shipped" that re-fetches the list with the selected status parameter, and an "All" option that fetches without a status filter
4. WHEN there are multiple pages, THE Bookshelf_Page SHALL display pagination controls (Previous/Next buttons and a page indicator showing current page and total pages)
5. THE Bookshelf_Page SHALL support drag-and-drop reordering of projects and persist the new order via `PATCH /api/bookshelf/order` with the ordered array of project IDs
6. THE Bookshelf_Page SHALL provide a "Batch Order" toggle that enables multi-select checkboxes on each project
7. WHEN batch mode is active and at least 2 projects are selected, THE Bookshelf_Page SHALL display a batch order form with provider selection (Lulu, BookVault, KDP), a shipping address input, and a "Get Pricing Estimate" button
8. WHEN a pricing estimate is requested, THE Bookshelf_Page SHALL call `POST /api/bookshelf/batch-order` with action "estimate" and display the pricing breakdown including per-title cost, subtotal, shipping, total, and currency
9. WHEN a batch order is submitted, THE Bookshelf_Page SHALL call `POST /api/bookshelf/batch-order` with action "submit", the selected project IDs, provider, and shipping address
10. IF a batch order submission or pricing estimate fails, THEN THE Bookshelf_Page SHALL display the error message from the API response and retain the user's current selections
11. IF the bookshelf fetch or drag-and-drop reorder request fails, THEN THE Bookshelf_Page SHALL display an error message indicating the failure reason
12. WHEN a batch order is successfully submitted, THE Bookshelf_Page SHALL display a success message including the number of books ordered and disable the batch form
13. THE Bookshelf_Page SHALL log all data fetches, filter changes, drag-and-drop operations, selection changes, and order submissions

### Requirement 11: Settings Page

**User Story:** As a user, I want to configure AI providers, print credentials, source credentials, my profile, and default print provider, so that the application works with my preferred services.

#### Acceptance Criteria

1. WHEN the page loads, THE Settings_Page SHALL fetch configuration from `GET /api/user/ai-config`, `GET /api/user/profile`, `GET /api/print/credentials`, `GET /api/user/preferences`, and `GET /api/search/credentials` in parallel, rendering each section independently as its data arrives
2. IF any of the configuration fetches fails, THEN THE Settings_Page SHALL display an inline error message within the affected section indicating the load failure, while still rendering all other sections that loaded successfully
3. THE Settings_Page SHALL display an AI Configuration section with dropdowns for text provider (Local/OpenAI/Anthropic) and image provider (Local/OpenAI DALL-E/Replicate)
4. WHEN a non-local provider is selected, THE Settings_Page SHALL display a model name text input (maximum 100 characters) and an API key password-masked input field for that provider
5. WHEN AI settings are saved, THE Settings_Page SHALL call `PATCH /api/user/ai-config` with the configured values
6. THE Settings_Page SHALL display a Book Sources section showing Standard Ebooks credential status (configured or not configured) and a Project Gutenberg entry (no credentials needed)
7. THE Settings_Page SHALL display a Default Print Provider section with a dropdown (Lulu/BookVault/KDP) that saves via `PATCH /api/user/preferences` when the dropdown selection changes
8. THE Settings_Page SHALL display a Print Provider Credentials section showing Lulu (client_id and client_secret fields) and BookVault (api_key field) credential forms when not configured, or a "configured" status indicator with a remove button when credentials exist
9. WHEN print credentials are saved, THE Settings_Page SHALL call `POST /api/print/credentials` with the provider and credentials
10. WHEN a credential remove button is clicked, THE Settings_Page SHALL call `DELETE /api/print/credentials/{provider}` or `DELETE /api/search/credentials/{provider}` for the corresponding provider and update the section to show the unconfigured state
11. THE Settings_Page SHALL display an Account section with email (read-only), display name text input (maximum 100 characters), profile save button, and logout button
12. WHEN the profile is saved, THE Settings_Page SHALL call `PATCH /api/user/profile` with the display name
13. WHEN a save or delete operation succeeds, THE Settings_Page SHALL display a visible success indicator within the affected section for at least 3 seconds
14. THE Settings_Page SHALL log all API calls for loading and saving settings, including success and failure states

### Requirement 12: Project Wizard Page

**User Story:** As a user, I want a 5-step workflow wizard for each project, so that I can process my book from source through to print ordering.

#### Acceptance Criteria

1. WHEN the page loads, THE Project_Wizard SHALL fetch the project from `GET /api/projects/{id}`, map the project status to the current wizard step (draft → Source, draft with text → Typo Check, typeset → Typeset, cover_ready → Cover, print_ready → Print), and render that step's content
2. IF the project fetch returns a non-2xx response, THEN THE Project_Wizard SHALL display an error message indicating the project could not be loaded and log the full error response
3. THE Project_Wizard SHALL display a step progress indicator showing all 5 steps (Source, Typo Check, Typeset, Cover, Print) where each step shows one of three visual states: done (completed steps), active (current step), or disabled (future steps)
4. WHEN a completed or active step indicator is clicked, THE Project_Wizard SHALL render that step's content panel without a page reload; disabled step indicators SHALL NOT respond to clicks
5. WHEN the Typo Check step is active and "Scan for Typos" is clicked, THE Project_Wizard SHALL call `POST /api/projects/{id}/scan-typos` and poll `GET /api/projects/{id}/corrections` at 2-second intervals for a maximum of 60 seconds until corrections are returned or the timeout is reached
6. IF polling for corrections exceeds 60 seconds without a response, THEN THE Project_Wizard SHALL stop polling and display an error message indicating the scan timed out
7. WHEN corrections are loaded, THE Project_Wizard SHALL display each correction with original text, suggested text, context sentence, and accept/reject buttons
8. THE Project_Wizard SHALL provide "Accept All" and "Reject All" bulk action buttons for corrections via `PATCH /api/projects/{id}/corrections`
9. WHEN "Apply Accepted & Continue" is clicked, THE Project_Wizard SHALL call `POST /api/projects/{id}/corrections/apply` and advance to the Typeset step upon a successful response
10. WHEN the Typeset step is active and "Generate Interior PDF" is clicked, THE Project_Wizard SHALL call `POST /api/projects/{id}/typeset` and poll the project status via `GET /api/projects/{id}` at 3-second intervals for a maximum of 120 seconds until the status changes to `typeset` or the timeout is reached
11. IF polling for typeset completion exceeds 120 seconds, THEN THE Project_Wizard SHALL stop polling and display an error message indicating PDF generation timed out
12. WHEN the Print step is active, THE Project_Wizard SHALL display a provider selection dropdown (Lulu/BookVault/KDP), shipping address input fields (name, street, city, state, postal code, country), a "Get Pricing Estimate" button that calls `POST /api/print/pricing`, and a "Submit Order" button that calls `POST /api/print/orders`
13. THE Project_Wizard SHALL log all step transitions, API calls with method and URL, polling attempts with attempt count, and user actions including button clicks and step navigation

### Requirement 13: Cover Builder Page

**User Story:** As a user, I want a 3-step cover design studio, so that I can generate AI cover art, customize text and layout, and produce a print-ready cover PDF.

#### Acceptance Criteria

1. WHEN the page loads, THE Cover_Builder SHALL fetch templates from `GET /api/projects/templates` and project data from `GET /api/projects/{id}`
2. THE Cover_Builder SHALL display Step 1 with a "Generate Cover Prompts" button and an image upload option accepting PNG and JPEG files up to 25 MB
3. WHEN prompts are generated via `POST /api/projects/{id}/cover/generate-prompts`, THE Cover_Builder SHALL advance to Step 2 showing a grid of prompt cards with index number and prompt text
4. WHEN "Generate Image" is clicked on a prompt card, THE Cover_Builder SHALL call `POST /api/projects/{id}/cover/generate-image` and display the resulting image within the card
5. IF image generation returns HTTP 429, THEN THE Cover_Builder SHALL display a message indicating the maximum regeneration limit has been reached and disable all "Generate Image" buttons
6. THE Cover_Builder SHALL allow selecting a generated image or uploading a custom image (PNG/JPEG, max 25 MB) to use as the cover
7. WHEN an image is selected and the user continues to Step 3, THE Cover_Builder SHALL display a live preview panel and a controls panel in a two-column layout
8. THE Cover_Builder SHALL display a live preview showing back cover (with blurb text and QR placeholder), spine (with title text, width proportional to page count), and front cover (with selected image, title overlay, and author overlay)
9. THE Cover_Builder SHALL provide template selection buttons that apply predefined font family, font size, color, and text position settings for both title and author
10. THE Cover_Builder SHALL provide title text input (max 100 characters) and author text input (max 60 characters) each with font family dropdown (serif, sans-serif, Palatino, Impact, Inter), font size number input (8-200), and color picker
11. THE Cover_Builder SHALL update the live preview in real-time as the user modifies title text, author text, font settings, or color values
12. THE Cover_Builder SHALL provide a "Generate Synopsis" button that calls `POST /api/projects/{id}/cover/generate-blurb` and displays the result in an editable textarea (max 3000 characters) with a word count indicator
13. WHEN "Generate Print-Ready Cover PDF" is clicked, THE Cover_Builder SHALL call `POST /api/projects/{id}/cover/assemble` with the layout object containing front_image, title (text, font_size, font_family, color, x, y, anchor), author (text, font_size, font_family, color, x, y, anchor), blurb text, and paper_stock
14. IF assembly returns HTTP 422 with missing elements, THEN THE Cover_Builder SHALL display the list of missing required elements from the error response
15. WHEN assembly succeeds, THE Cover_Builder SHALL display a success message including the spine width and redirect to the project page after 2 seconds
16. THE Cover_Builder SHALL log all prompt generation, image generation (including regeneration count), template application, blurb generation, image uploads, and assembly attempts with full request/response details

### Requirement 14: Visual Design Preservation

**User Story:** As a user, I want the rebuilt frontend to look identical to the current design, so that the migration is visually seamless.

#### Acceptance Criteria

1. THE Frontend SHALL use the font family `'Lora', Georgia, serif` for all body text, headings, buttons, and form inputs, with a base font size of `16px` and line height of `1.6`
2. THE Frontend SHALL use the color palette: dark brown `#4a2c2a`, medium brown `#8b5a2b`, saddle brown `#8b4513`, cream `#fdf5e6`, warm white `#fff8dc`, parchment gradient `#fff8e1` to `#f5e6cc`, teal accent `#008080`, gold accent `#d4af37`, tan `#d2b48c`, and error red `#b22222`
3. THE Frontend SHALL apply a parchment background color (`#faebd7`) to the body element
4. THE Frontend SHALL style primary buttons with background `#8b5a2b`, text color `#fdf5e6`, and a hover state of `#6b4e31`
5. THE Frontend SHALL style secondary buttons with a gradient from `#d4a373` to `#c8965a` and dark text
6. THE Frontend SHALL style form inputs with border `#8b5a2b`, background `#fdf5e6`, and a teal focus ring (`rgba(0, 128, 128, 0.25)`)
7. THE Frontend SHALL style content panels with a linear gradient background from `#fff8e1` to `#f5e6cc`, `2px solid #8b4513` border, `10px` border radius, and box shadow of `0 2px 8px rgba(0, 0, 0, 0.1)`
8. THE Frontend SHALL style the header with background `#e0d4b5`, a `2px solid #8b4513` bottom border, and sticky positioning
9. THE Frontend SHALL style status badges with a `4px` border radius, `0.75rem` font size, and background colors mapped to status: teal `#008080` for complete/done states, gold `#d4af37` for in-progress states, tan `#d2b48c` for pending states, and error red `#b22222` for failed states

### Requirement 15: jQuery Integration

**User Story:** As a developer, I want jQuery loaded for DOM manipulation, so that interactive UI updates are concise and consistent across the application.

#### Acceptance Criteria

1. THE Frontend SHALL load jQuery version 3.x from a CDN via a `<script>` tag in `index.html`, placed before any application JavaScript `<script>` tags
2. THE Frontend SHALL use jQuery for DOM element selection, event binding, class toggling, and dynamic content insertion
3. THE Frontend SHALL place all application `<script>` tags after the jQuery `<script>` tag in document order so that the `jQuery` and `$` globals are available when page-specific JavaScript executes
4. IF the jQuery CDN script fails to load, THEN THE Frontend SHALL load a local fallback copy of jQuery from the static file directory and log a warning to the browser console indicating CDN failure
5. WHEN the application shell initializes, THE Frontend SHALL verify that `window.jQuery` is defined and log the detected jQuery version to the browser console

### Requirement 16: Static File Structure

**User Story:** As a developer, I want a clear, organized file structure for the static frontend, so that the codebase is maintainable without a framework.

#### Acceptance Criteria

1. THE Frontend SHALL organize files with an `index.html` entry point at the root, a `css/` directory for stylesheets, a `js/` directory for JavaScript modules, and a `js/pages/` directory for page-specific logic
2. THE Frontend SHALL use ES6 module syntax (`import`/`export`) for JavaScript file organization
3. THE Frontend SHALL include the API client, router, authentication state manager, and DOM helper utilities as separate JavaScript modules within the `js/` directory
4. WHEN a new page is added, THE Frontend SHALL require only creating a new module file in `js/pages/` and adding a route entry in the Page_Router's route table, without modifying the API client, authentication, or utility modules
5. THE Frontend SHALL load the application entry point JavaScript file in `index.html` using a `<script type="module">` tag to enable ES6 module resolution
