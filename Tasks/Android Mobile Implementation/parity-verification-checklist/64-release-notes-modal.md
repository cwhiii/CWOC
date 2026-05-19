# Release Notes Modal

**Category:** Modals & Overlays
**Item #:** 64
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (settings-version.js)
- [ ] showReleaseNotes — Opens the release notes modal; fetches notes from /api/release-notes; renders the first (newest) entry
- [ ] _renderCurrentReleaseNote — Renders the current note's content (markdown via marked.js) and date header; resets scroll to top
- [ ] _updateReleaseNotesNav — Updates prev/next button disabled state and counter text
- [ ] releaseNotesPrev — Navigates to the older (next index) release note
- [ ] releaseNotesNext — Navigates to the newer (previous index) release note
- [ ] closeReleaseNotesModal — Hides the modal (display: none)
- [ ] _formatReleaseDate(dateStr) — Formats YYYYMMDD string to "Month Day, Year" (e.g., "May 14, 2026")

### Display Elements
- [ ] Modal container (#release-notes-modal) — Full-screen flex overlay
- [ ] Date header (#release-notes-date) — Shows formatted date of current note
- [ ] Content area (#release-notes-content) — Renders markdown content via marked.js (with breaks: true)
- [ ] Navigation counter (#release-notes-counter) — Shows "X / Y" (current position / total notes)

### Controls & Buttons
- [ ] "◀ Older" button (#release-notes-prev) — Navigates to older notes (higher index); disabled at end of list (opacity 0.4)
- [ ] "Newer ▶" button (#release-notes-next) — Navigates to newer notes (lower index); disabled at start (opacity 0.4)
- [ ] Close button / ESC — Closes the modal (handled by settings.js ESC handler)

### Data Flow
- [ ] GET /api/release-notes — Returns {notes: [{date, content}, ...]} sorted newest-first
- [ ] Each note has: date (YYYYMMDD string) and content (markdown string)
- [ ] Content rendered as HTML via marked.parse() with breaks: true

### Loading States
- [ ] "Loading..." — Shown while fetching from API
- [ ] "No release notes available." — When API returns empty array (opacity 0.6)
- [ ] "Failed to load release notes." — On fetch error (color: #b22222)

### State Variables
- [ ] _releaseNotes — Array of all fetched release note objects
- [ ] _releaseNotesIndex — Current index into the _releaseNotes array (0 = newest)

### ESC Handling (in settings.js)
- [ ] Checks if release-notes-modal is visible (display === "flex")
- [ ] Calls closeReleaseNotesModal() and stops propagation
