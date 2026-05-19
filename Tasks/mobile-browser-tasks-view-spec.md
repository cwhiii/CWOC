# Mobile Browser Tasks View — Complete Specification

> Pixel-perfect recreation spec for the Tasks zone ("T" in C CAPTN) as rendered in a mobile browser (≤480px viewport). Every visual, behavioral, and interactive detail is documented below.

---

## 1. Page Shell & Header (Mobile ≤480px)

### 1.1 Header Bar

- **Position:** `fixed` at top of viewport
- **Layout:** `flex-direction: row; flex-wrap: wrap; height: auto; padding: 4px 8px; gap: 4px; align-items: center`
- **Background:** Inherited from `.header` (parchment-themed, `var(--header-bg)` = `#e0d4b5`)

**Elements in order (left to right):**

1. **Hamburger button** (`.mobile-hamburger`)
   - Size: 32×32px
   - Background: `var(--btn-bg)` = `#8b5a2b`
   - Color: `#fff8e1`
   - Border: `1px solid var(--btn-border)` = `#5a3f2a`
   - Border-radius: 4px
   - Content: `☰` character, font-size 1.2em
   - Action: calls `toggleSidebar()`

2. **Logo** (`.logo`)
   - Size: 32×32px
   - Image: `/static/cwod_logo.png`
   - Action: calls `toggleSidebar()`

3. **Title** (`h1`)
   - Font-size: 1em
   - Padding: 2px 4px
   - Display: `inline-flex`
   - Contains: `<span id="omni-trigger" class="omni-header-btn">Omni</span>&nbsp;<span class="header-chits-label">Chits</span>`

4. **Profile menu** (`.cwoc-profile-menu`)
   - Order: 10 (CSS), `margin-left: auto` (pushes to right)
   - Contains profile image button (32×32px avatar)

5. **Views button** (`.mobile-views-btn`)
   - Order: 11 (CSS)
   - Display: `inline-flex` (visible only at ≤480px, hidden at desktop)
   - Padding: 6px 12px
   - Min-height: 36px
   - Background: `var(--btn-bg)` = `#8b5a2b`
   - Color: `#fff8e1`
   - Border: `1px solid var(--btn-border)` = `#5a3f2a`
   - Border-radius: 3px
   - Font: `'Lora', serif; font-weight: bold; font-size: 0.9em`
   - Content: `☰ Tasks` (dynamically shows current tab name)
   - Action: Opens the Views panel

### 1.2 Tab Bar

- **Completely hidden** on mobile via `display: none !important`
- Replaced by the Views button + slide-in panel (see §2)

### 1.3 Top Bar (date range display)

- **Hidden** on mobile via `display: none`

---

## 2. Views Panel (Tab Selector on Mobile)

### 2.1 Trigger

- The `.mobile-views-btn` in the header
- Also triggered by **swiping left from the right edge** (25px zone, 40px threshold)

### 2.2 Backdrop (`.mobile-views-backdrop`)

- Position: fixed, full viewport
- Background: `rgba(0, 0, 0, 0.4)`
- Z-index: 2000
- Hidden by default (`display: none`), shown when `.active` class added (`display: block`)
- Tapping backdrop closes the panel

### 2.3 Panel (`.mobile-views-panel`)

- Position: fixed, top: 0, right: -260px (off-screen), slides to `right: 0` when `.active`
- Width: 240px, height: 100%
- Background: `url("/static/parchment.jpg") center/cover`, fallback `var(--parchment-medium)` = `#faebd7`
- Border-left: `2px solid var(--aged-brown-medium)` = `#8b4513`
- Z-index: 2001
- Transition: `right 0.25s ease`
- Overflow-y: auto, overscroll-behavior: none
- Padding: 12px, box-sizing: border-box
- Box-shadow: `-4px 0 16px rgba(0, 0, 0, 0.2)`

### 2.4 Panel Header

- `<h3>` with text "Views"
- Margin: 0 0 10px 0
- Font-size: 1.1em
- Color: `var(--aged-brown-dark)` = `#4a2c2a`
- Text-align: center
- Border-bottom: `1px solid var(--aged-brown-light)` = `#a0522d`
- Padding-bottom: 6px

### 2.5 View Options (`.mobile-view-option`)

Each option is a clone of the desktop tab:

- Display: flex, align-items: center, gap: 8px
- Padding: 10px 12px
- Margin: 4px 0
- Border-radius: 4px
- Font: `'Lora', serif; font-weight: bold; font-size: 1em`
- Color: `var(--aged-brown-dark)` = `#4a2c2a`
- Background: `var(--parchment-light)` = `#fdf5e6`
- Border: `1px solid var(--aged-brown-light)` = `#a0522d`
- Min-height: 44px (touch target)
- Contains: tab icon image (height 1.8em) + tab label text
- Hover: `background: var(--button-hover)` = `#c4a484`
- Active (current tab): `background: ivory; border-color: var(--aged-brown-medium); border-width: 2px`

**Tab options listed:**
1. 📅 Calendar
2. ☑️ Checklists
3. 📋 Tasks ← active when on Tasks view
4. 📁 Projects
5. 📝 Notes
6. 📓 Notebook (hidden by default, display:none)
7. ✉️ Email
8. ❤️ Indicators
9. 🔔 Alerts
10. 🔍 Search (icon only)

### 2.6 Close Button (`.mobile-views-close`)

- Display: block, width: 100%
- Margin-top: 8px
- Padding: 8px
- Text-align: center, font-weight: bold
- Background: `var(--aged-brown-light)` = `#a0522d`
- Color: `#fff8e1`
- Border: `1px solid var(--aged-brown-dark)` = `#4a2c2a`
- Border-radius: 4px
- Min-height: 44px
- Font: `'Lora', serif`
- Content: `⇤ Hide Sidebar` (with large ⇤ character)

### 2.7 Swipe Gestures

- **Swipe left from right edge (25px zone):** Opens panel (only if sidebar is NOT open)
- **Swipe right while panel is open:** Closes panel
- Threshold: 40px horizontal, must exceed vertical distance

---

## 3. Sidebar (Mobile Overlay)

### 3.1 Container (`.sidebar`)

- Position: fixed
- Width: `100%` (overrides desktop 200px)
- Left: `-110%` (off-screen when closed), `0` when `.active`
- Top: 0, height: 100%
- Z-index: 1003
- Padding: 10px
- Box-sizing: border-box
- Background: `url("/static/parchment.jpg") center/cover`, fallback `var(--sidebar-bg)` = `#e0d4b5`
- Transition: `left 0.3s ease`
- Display: flex, flex-direction: column

### 3.2 Close Button (`.sidebar-close-btn`)

- Position: sticky, top: 0
- Width: 100%
- Padding: 10px
- Margin-bottom: 10px
- Background: `var(--aged-brown-medium)` = `#8b4513`
- Color: `#fff8e1`
- Border: `1px solid var(--btn-border)` = `#5a3f2a`
- Border-radius: 3px
- Font: `'Lora', Georgia, serif; font-weight: bold; font-size: 1em`
- Min-height: 44px
- Z-index: 10
- Content: `⇤ Hide Sidebar` (with large ⇤ character)

### 3.3 Sidebar Backdrop (`.sidebar-backdrop`)

- Position: fixed, full viewport
- Background: `rgba(0, 0, 0, 0.4)`
- Z-index: 1002 (below sidebar's 1003)
- Tapping closes sidebar

### 3.4 Swipe Gestures

- **Swipe right from left edge (30px zone):** Opens sidebar (only if Views panel is NOT open)
- **Swipe left while sidebar is open:** Closes sidebar
- Threshold: 50px horizontal, must exceed vertical distance

### 3.5 On Page Load (≤768px)

- Sidebar always starts **closed**
- `localStorage.setItem('sidebarState', 'closed')`

### 3.6 Sidebar Content (Tasks-Relevant Sections)

**Scrollable area** (`.sidebar-scroll`): flex: 1, overflow-y: auto, padding-top: 25px

Sections visible when Tasks tab is active:

1. **Create Chit button** — full-width action button
2. **Tasks Mode Toggle** (`#section-tasks-mode`):
   - Three buttons: `📋 Tasks` | `🎯 Habits` | `📌 Assigned`
   - Active button: `background: ivory; color: #3b1f0a`
   - Inactive: default button styling
   - Persists to `localStorage('cwoc_tasksViewMode')`
3. **Sort Controls** (`#section-order`):
   - Dropdown (`#sort-select`) with options: Title, Start Date, Due Date, Updated, Created, Status, Manual, Random, Upcoming
   - Direction button (`#sort-dir-btn`): ▲ or ▼, toggles asc/desc
   - Hidden when sort is Manual, Random, or Upcoming
4. **Filters Section** (`#section-filters`):
   - Collapsible, toggle button
   - Status multi-select checkboxes
   - Priority multi-select
   - Tag filter (chip-based with search, colored dots)
   - People filter (chip-based with profile images)
   - Project filter dropdown
   - Display toggles (Show Pinned, Archived, Snoozed, etc.)
   - Clear All Filters button
5. **Period selector** — HIDDEN for Tasks (only shown for Calendar)
6. **Date navigation** — HIDDEN for Tasks

**Bottom pinned section** (`.sidebar-bottom`):
- Settings button
- Help/Reference buttons
- Contacts button
- Clock, Weather, Calculator buttons

---

## 4. Main Content Area

### 4.1 Container (`.main-content`)

- Padding: 0
- Height: 100vh
- Min-height: 0
- Margin-left: `0 !important` (never shifted by sidebar on mobile)

### 4.2 Chit List Container (`.chit-list`)

- Margin-top: 50px (below fixed header)
- Height: `calc(100vh - 50px)`
- Contains the `.tasks-view` div

### 4.3 Tasks View Container (`.tasks-view`)

- Padding: `4px !important` (mobile override)
- Display: flex, flex-direction: column
- Gap: `6px !important` (mobile override)
- Overflow-y: auto, overflow-x: visible
- Flex: `1 1 auto`
- Min-height: 0
- Font-size: 1em
- Color: `#2b1e0f`
- Overscroll-behavior: contain

---

## 5. Task Card Structure

Each task card is a `div.chit-card` with the following properties:

### 5.1 Card Container

- **Element:** `div.chit-card[data-chit-id][draggable=true]`
- Width: `100% !important`
- Max-width: `100% !important`
- Margin: `4px 0 !important`
- Padding: `10px !important`
- Box-sizing: `border-box !important`
- Font-size: 0.9em
- Word-break: break-word
- Overflow-wrap: break-word
- Overflow: hidden
- Border: `2px solid #8b5a2b`
- Border-radius: 6px
- Font-family: `'Lora', Georgia, serif`
- Cursor: pointer (grab when draggable)
- Color: `#2b1e0f`
- Line-height: 1.5
- User-select: none
- Background: per-chit color via `applyChitColors()` (default `#fdf6e3`)

### 5.2 Card States

| State | CSS Class | Visual Effect |
|-------|-----------|---------------|
| Completed | `.completed-task` | `opacity: 0.5` |
| Rejected | `.completed-task` | `opacity: 0.5` |
| Archived | `.archived-chit` | `opacity: 0.45`, hover → `0.7` |
| Declined (RSVP) | `.declined-chit` | `opacity: 0.35`, hover → `0.7` |
| Hover | `:hover` | `border-color: #a0522d; box-shadow: 0 2px 8px rgba(107, 66, 38, 0.15)` |
| Being dragged (touch) | `.cwoc-touch-dragging` | `opacity: 0.7; transform: scale(1.04); box-shadow: 0 6px 24px rgba(107,66,38,0.45); outline: 2px dashed #a0522d; animation: cwoc-drag-pulse 1s infinite` |
| Being dragged (mouse) | `.cwoc-dragging` | `opacity: 0.4; outline: 2px dashed #a0522d; box-shadow: 0 4px 16px rgba(107,66,38,0.3)` |

### 5.3 Header Row (`.chit-header-row`)

On mobile (≤480px):
- Flex-direction: `column !important`
- Align-items: `flex-start !important`
- Gap: `4px !important`
- Flex-wrap: wrap
- Padding: 3px 0

Contains two child divs stacked vertically:

#### 5.3.1 Left Section (`.chit-header-left`)

- Display: flex, align-items: center, gap: 0.4em
- Width: 100% (mobile)
- Font-weight: bold, font-size: 1em
- Flex-shrink: 0

**Contents (in order, all optional except title):**

1. **Pinned icon** — `<i class="fas fa-bookmark">` (if `chit.pinned`)
   - Font-size: 0.85em, opacity: 0.7
2. **Archived icon** — `📦` span (if `chit.archived`)
3. **Snoozed icon** — `😴` span (if `chit.snoozed_until` is future)
4. **Timezone warning** — `⚠️` span with class `tz-warning-indicator` (if `chit._tzWarning`)
5. **Stealth icon** — `🥷` span with class `cwoc-stealth-indicator` (if `chit.stealth` and user is owner)
6. **Sub-chit icon** — `<i class="fas fa-project-diagram">` (if chit is child of a project)
   - Font-size: 0.75em, opacity: 0.6
7. **Visual indicators** — `<span class="alert-indicators">` containing emoji string from `_getAllIndicators()`
   - Possible icons: 🛎️ 🔔 📢 ⏱️ ⏲️ 👥 ❤️ 📊 🎯 🔁 📎
8. **Weather indicator** — `<span class="chit-weather-indicator">` (if chit has location)
   - Shows weather emoji + tooltip with high/low temps
9. **Map pin icon** — `<i class="fas fa-map-marker-alt chit-location-icon">` (SKIPPED in Tasks view — `skipMapIcon: true`)
10. **Title** — `<span class="chit-header-title"><a href="/editor?id=...">Title Text</a></span>`
    - On mobile: `white-space: normal; overflow: visible; word-break: break-word` (no truncation)
    - Link color: inherit, no decoration, underline on hover

#### 5.3.2 Right/Meta Section (`.chit-header-meta`)

On mobile (≤480px):
- Width: 100%
- Flex-wrap: `wrap !important`
- White-space: `normal !important`
- Overflow: `visible !important`
- Gap: `4px !important`
- Font-size: 0.78em (mobile), 0.85em (desktop)
- Color: inherit, opacity: 0.85

**Contents (in order, all optional):**

1. **Status** — HIDDEN in Tasks view (`hideStatus: true` passed to `_buildChitHeader`)
2. **Priority** — plain text span (e.g., "High", "Medium", "Low")
3. **Due date** — styled span:
   - If overdue (past date, status ≠ Complete/Rejected):
     - Text: `Past Due: YYYY-Mon-DD` (e.g., "Past Due: 2026-May-15")
     - Background: configurable `overdue_border_color` (default `#b22222`)
     - Color: auto-contrast via `contrastColorForBg()`
     - Font-weight: bold
     - Padding: 1px 6px, border-radius: 3px
   - If not overdue: `Due: <formatted date>`
   - Bold + sort indicator if sorted by due date
4. **Start date** — `Start: <formatted date>` (hidden for email chits)
5. **Point in time** — `📌 <formatted date>` (hidden for email chits)
6. **Updated date** — `Updated: <formatted date>` (hidden for email chits)
7. **Created date** — `Created: <formatted date>` (hidden for email chits)
8. **Tag chips** — colored inline spans for each non-system tag:
   - `display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.75em; margin-left: 4px`
   - Background: per-tag color from settings
   - Color: per-tag font color from settings (default `#2b1e0f`)
9. **RSVP indicators** — `<span class="cwoc-rsvp-indicators">` with per-user status dots:
   - Accepted: `✓` green circle
   - Declined: `✗` gray strikethrough
   - Invited: `⏳` faded
10. **RSVP action buttons** — Accept (✓) / Decline (✗) buttons (only for shared chits where user is not owner)
11. **Shared icon** — `🔗` with tooltip showing owner, shared users, roles
12. **Assignee badge** — `📌 <display_name>` (class `cwoc-assignee-badge`, green italic text)

### 5.4 Controls Row (Status + Note Preview)

- **Element:** `div` with inline style `margin-top:0.3em;display:flex;align-items:flex-start;gap:0.8em;`
- **Mobile override (≤480px):** `flex-direction: column !important; gap: 6px !important` (stacks vertically)
- Background: `rgba(0, 0, 0, 0.04)` (content zone distinction)
- Border-radius: 3px
- Padding: 0.3em 0.5em
- Margin-top: 0.3em

#### 5.4.1 Status Wrapper

- Display: flex, align-items: center, gap: 0.5em, flex-shrink: 0

**Contents:**

1. **Status icon** — `<span>` containing Font Awesome icon HTML from `_STATUS_ICONS`:
   - ToDo: `<i class="fas fa-circle" style="color:#8b5a2b;font-size:0.85em;"></i>` (brown filled circle)
   - In Progress: `<i class="fas fa-spinner" style="color:#d68a59;font-size:0.85em;"></i>` (orange spinner)
   - Blocked: `<i class="fas fa-ban" style="color:#b22222;font-size:0.85em;"></i>` (red ban)
   - Complete: `<i class="fas fa-check-circle" style="color:#5a8a5b;font-size:0.85em;"></i>` (green check)
   - Rejected: `<i class="fas fa-times-circle" style="color:#9E9E9E;font-size:0.85em;"></i>` (gray X)

2. **"Status:" label** — plain `<span>` with text "Status:"

3. **Status dropdown** — `<select>` element:
   - Font-family: inherit, font-size: inherit
   - Min-height: 36px (mobile touch target)
   - Font-size: 14px (mobile)
   - Options: ToDo, In Progress, Blocked, Complete, Rejected
   - If `_hasIncompletePrereqs`: Blocked option text becomes "Blocked ⛓️"
   - Disabled + title "Read-only — shared chit" for viewer-role chits
   - **Dynamic styling based on value:**
     - Blocked: `background: <blocked_border_color>` (default `#DAA520`), contrast text color, `2px solid` border, bold
     - Complete: `opacity: 0.6`
     - Rejected: `color: #9E9E9E; opacity: 0.6`
     - Others: default (no special styling)
   - On change: PUTs updated chit to `/api/chits/{id}`, then calls `fetchChits()` to refresh

#### 5.4.2 Note Preview (if `chit.note` exists and is non-empty)

**Wrapper div:**
- Flex: 1, min-width: 0

**Note preview div** (`.note-preview`):
- Flex: 1, min-width: 0
- Opacity: 0.75
- Overflow: hidden
- Overflow-wrap: break-word, word-break: break-word
- Max-height: 4.5em (about 3 lines at 1.4em line-height)
- Line-height: 1.4em
- Position: relative
- Cursor: default
- Content: rendered markdown via `marked.parse()` (first 500 chars), with chit links resolved

**Expanded state** (`.note-preview-expanded`):
- Max-height: none
- Overflow: visible

**Toggle button** (`.note-preview-toggle`):
- Display: `none` at desktop, `block` at ≤480px
- Font-size: 0.8em
- Color: `#8b5a2b`
- Cursor: pointer
- Padding: 2px 0
- Text-align: right
- Font-style: italic
- User-select: none
- Text: "show more…" (collapsed) / "show less" (expanded)
- Click handler: toggles `.note-preview-expanded` class, stops propagation

### 5.5 Map Thumbnail (if chit has non-default location)

- **Element:** `div.chit-map-thumbnail`
- Position: relative
- Width: 90px (mobile, 120px desktop)
- Height: 60px (mobile, 80px desktop)
- Border-radius: 4px
- Overflow: hidden
- Border: `1px solid rgba(139, 90, 43, 0.3)`
- Margin-top: 0.4em
- Margin-left: auto
- Flex-shrink: 0
- Background: `#f5ebe0`
- Cursor: pointer
- Contains: OSM tile image (`.chit-map-tile-img`) + pin overlay (`.chit-map-pin-overlay`)
- Double-click navigates to `/maps?focus=chit&address=<encoded location>`
- Only shown if `show_map_thumbnails` setting is not disabled

---

## 6. Touch Interactions

### 6.1 Unified Touch Gesture System

The Tasks view uses `enableTouchGesture()` from `shared-touch.js` via `enableDragToReorder()` in `shared-sort.js`. This provides a sequential gesture model:

| Time | Event | Result |
|------|-------|--------|
| 0ms | touchstart | Drag timer begins |
| 0–400ms | finger moves > 10px | Cancel everything → normal scroll |
| 400ms | finger still | **Drag activates** (30ms vibration via `_cwocVibrate(30)`) |
| 400ms+ | finger moves | Drag proceeds, long-press cancelled permanently |
| 1200ms | finger perfectly still since 400ms | **Long-press fires** (double vibration [30,50,30ms]), drag cancelled |

**Key guarantee:** Once the user moves after drag activates, long-press can NEVER fire.

### 6.2 Tap (< 400ms, no movement)

- Normal browser behavior
- Single tap on card: no action (links in title are clickable)
- Double-tap on card: navigates to `/editor?id=<chitId>` (via `dblclick` event)
- Double-tap on map thumbnail: navigates to `/maps?focus=chit&address=<location>`

### 6.3 Drag-to-Reorder (hold 400ms, then move)

**Activation:**
- 30ms haptic vibration
- Card gets `position: fixed` under finger
- Card styled: `opacity: 0.9; box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 10000; pointer-events: none`
- Placeholder div inserted: `height: <card height>px; border: 2px dashed #8b5a2b; border-radius: 6px; background: rgba(139,90,43,0.08)`
- `document.body.style.overscrollBehavior = 'contain'` (prevents pull-to-refresh)

**During drag:**
- Card follows finger (`position: fixed; left/top updated`)
- Placeholder moves to insertion point based on finger Y position relative to other cards
- Auto-scroll: when finger is within 50px of container top/bottom edge, scrolls 8px/frame

**On drop (touchend):**
- Card returns to normal flow (all inline styles removed)
- Placeholder removed
- New order read from DOM
- `saveManualOrder(tab, ids)` — saves to localStorage + backend API
- Sort auto-switches to "manual" (`currentSortField = 'manual'`)
- Sort dropdown updated, preference persisted
- View re-renders via `displayChits()`
- `_markDragJustEnded()` called — suppresses post-drag click for 300ms

### 6.4 Long-Press (hold 1200ms without moving)

- Double haptic vibration pattern: [30ms, 50ms pause, 30ms]
- Drag cancelled (card returns to normal position)
- Opens **Quick Edit Modal** via `showQuickEditModal(chit, callback)`
- Only available for non-viewer-role chits
- If chit is viewer-role, long-press map is empty for that card (no long-press action)

### 6.5 Post-Drag Click Suppression

- After any drag ends, `window._dragJustEnded = true` for 300ms
- Capture-phase listeners on `click` and `dblclick` swallow events on `.chit-card` elements during this window
- Prevents accidental navigation after dropping a card

---

## 7. Sorting

### 7.1 Default Sort (No Sort Selected)

When `currentSortField` is null/empty, tasks are sorted by **status order**:

| Status | Order |
|--------|-------|
| ToDo | 1 |
| In Progress | 2 |
| Blocked | 3 |
| (empty/no status) | 4 |
| Complete | 5 |
| Rejected | 6 |

### 7.2 Available Sort Fields

From the sidebar `#sort-select` dropdown:
- **Title** — alphabetical
- **Start Date** — `start_datetime`
- **Due Date** — `due_datetime`
- **Updated** — `modified_datetime`
- **Created** — `created_datetime`
- **Status** — status order (same as default)
- **Manual** — user-defined drag order
- **Random / Shuffle** — randomized each render
- **Upcoming** — due soon first

### 7.3 Sort Direction

- Toggle button (`#sort-dir-btn`): shows ▲ (ascending) or ▼ (descending)
- Hidden when sort is Manual, Random, or Upcoming
- Clicking toggles between asc/desc and re-renders

### 7.4 Sort Indicator in Cards

When a sort field is active, the corresponding meta value in the header gets:
- `font-weight: bold`
- Appended text: ` ▲` or ` ▼` depending on direction

### 7.5 Sort Persistence

- Saved per-tab to localStorage (`cwoc_sort_preferences`) and backend API (`/api/sort-preferences/<tab>`)
- Restored on tab switch via `getSortPreference(tab)`
- Backend is source of truth (loaded on page init via `_loadSortPreferencesFromServer()`)

---

## 8. Filtering

### 8.1 Which Chits Appear in Tasks View

A chit appears in the Tasks view if it has:
- A `status` field (any value: ToDo, In Progress, Blocked, Complete, Rejected), OR
- A `due_datetime` field

This is the filter: `chit.status || chit.due_datetime`

### 8.2 Filter Controls (in Sidebar)

All filters are applied before rendering. The sidebar contains:

1. **Status filter** — multi-select checkboxes for each status value
2. **Priority filter** — multi-select checkboxes
3. **Tag filter** — chip-based selection with:
   - Search input to filter tag list
   - Favorites shown first
   - Colored dots matching tag colors
   - "Any Tag" / "Tagless" virtual buttons
4. **People filter** — chip-based contact selection with profile images
5. **Project filter** — dropdown of project master chits
6. **Text search** (`#search`) — free-text filter across title, notes, tags
7. **Display toggles** (checkboxes):
   - Show Pinned
   - Show Archived
   - Show Snoozed
   - Show Unmarked
   - Show Past Due
   - Show Complete
   - Show Declined
   - Show Habits
   - Highlight Overdue
   - Highlight Blocked
   - Shared With Me / Shared By Me

### 8.3 Clear All Filters

- Button: `.clear-filters-btn`
- Background: `#a0522d`, color: `#fff8e1`, font-size: 0.85em, height: 32px
- Resets all filter controls to defaults and re-renders

---

## 9. Tasks View Sub-Modes

The Tasks tab has three sub-modes, toggled via buttons in the sidebar:

### 9.1 Tasks Mode (default)

- Variable: `_tasksViewMode = 'tasks'`
- Renders: `displayTasksView(chitsToDisplay)`
- Shows all chits with status or due_datetime

### 9.2 Habits Mode

- Variable: `_tasksViewMode = 'habits'`
- Renders: `displayHabitsView(chitsToDisplay)` (separate renderer)
- Shows habit-type chits with recurrence tracking

### 9.3 Assigned Mode

- Variable: `_tasksViewMode = 'assigned'`
- Renders: `displayAssignedToMeView(chitsToDisplay)`
- Shows only chits where `assigned_to === currentUser.user_id`
- Same card structure as Tasks mode
- Same default sort (by status order)
- Empty state: "No chits assigned to you."

### 9.4 Mode Persistence

- Stored in `localStorage('cwoc_tasksViewMode')`
- Restored on page load
- URL hash updated: `#tasks` (default), `#tasks/habits`, `#tasks/assigned`

---

## 10. Empty State

When no tasks match the current filters:

```html
<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;">
  <p style="font-size:1.1em;margin-bottom:0.8em;">No tasks found.</p>
  <button class="standard-button" onclick="storePreviousState(); window.location.href='/editor';" style="font-family:inherit;">+ Create Chit</button>
</div>
```

- Centered text, 0.7 opacity
- Message: "No tasks found." (or "No chits assigned to you." in Assigned mode)
- Button: "+ Create Chit" — navigates to editor

---

## 11. Visual Indicators System

### 11.1 Indicator Icons (from `_getAllIndicators()`)

Displayed in the `.alert-indicators` span within `.chit-header-left`:

| Condition | Icon | Display Mode Setting |
|-----------|------|---------------------|
| Has alerts (alarm/notification/timer/stopwatch) | 🛎️ (combined) or 🔔📢⏱️⏲️ (individual) | `visual_indicators.combine_alerts` |
| Has people assigned | 👥 | `visual_indicators.people` |
| Has health indicator data | ❤️ | `visual_indicators.indicators` |
| Has custom data | 📊 | `visual_indicators.custom_data` |
| Is a habit | 🎯 | Always shown |
| Has recurrence rule | 🔁 | Always shown |
| Has attachments | 📎 | Always shown |

### 11.2 Display Modes

Each indicator type has a display mode setting:
- **always** — show in all contexts (default)
- **never** — never show
- **space** — show in card and calendar-slot contexts, hide in calendar-month

For the Tasks view, context is always `'card'`, so "space" mode shows indicators.

### 11.3 Weather Indicator

- Shown if chit has a location and `visual_indicators.weather` mode allows it
- Displays weather emoji (from `weather_data.weather_code`) or `⏳` while loading
- Tooltip: `high°/low° · precipitation info`
- Stale indicator: `⏳` prefix if weather data is old

---

## 12. Color System

### 12.1 Card Background Colors

- Applied via `applyChitColors(element, color)` function
- Default color: `#fdf6e3` (warm parchment)
- User can set per-chit colors in the editor
- Function sets background color and adjusts text color for contrast

### 12.2 Theme Colors (CSS Variables)

```css
--parchment-light: #fdf5e6;
--parchment-medium: #faebd7;
--parchment-dark: #fff8dc;
--aged-brown-dark: #4a2c2a;
--aged-brown-medium: #8b4513;
--aged-brown-light: #a0522d;
--button-hover: #c4a484;
--header-bg: #e0d4b5;
--sidebar-bg: #e0d4b5;
--sidebar-border: #6b4e31;
--btn-bg: #8b5a2b;
--btn-border: #5a3f2a;
--btn-hover: #6b4e31;
--btn-hover-text: #d2b48c;
```

### 12.3 Status Colors

| Status | Dropdown Styling |
|--------|-----------------|
| ToDo | Default (no special styling) |
| In Progress | Default |
| Blocked | Background: `blocked_border_color` setting (default `#DAA520` gold), bold, contrast text |
| Complete | `opacity: 0.6` |
| Rejected | `color: #9E9E9E; opacity: 0.6` |

### 12.4 Overdue Styling

- Background: `overdue_border_color` setting (default `#b22222` firebrick)
- Text: auto-contrast via `contrastColorForBg()`
- Font-weight: bold
- Padding: 1px 6px, border-radius: 3px

---

## 13. Animations & Transitions

| Element | Property | Value |
|---------|----------|-------|
| Sidebar slide | `left` | `0.3s ease` |
| Views panel slide | `right` | `0.25s ease` |
| Touch drag card | `transform` | `scale(1.04)` with `0.15s ease` |
| Touch drag outline | `outline-color` | `cwoc-drag-pulse` keyframes: `#a0522d` ↔ `#d2691e` over 1s |
| Card hover | `border-color, box-shadow` | Implicit browser transition |
| Sidebar section collapse | `opacity, filter` | `0.2s ease` |

### 13.1 Drag Pulse Animation

```css
@keyframes cwoc-drag-pulse {
    0%, 100% { outline-color: #a0522d; }
    50% { outline-color: #d2691e; }
}
```

---

## 14. Fonts

- **Primary:** `'Lora', Georgia, serif` (self-hosted variable font)
  - Loaded from `/static/fonts/lora/Lora-VariableFont_wght.ttf`
  - Weight range: 400–700
  - Normal + Italic variants
  - `font-display: swap`
- **Fallback:** Georgia, serif
- **Note content in Notes view:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (not applicable to Tasks view)

---

## 15. Accessibility & Touch Targets

- All interactive elements: min-height 36px on mobile (selects, inputs, buttons)
- Sidebar buttons: min-height 44px
- View options: min-height 44px
- Close buttons: min-height 44px
- Status dropdown: min-height 36px, font-size 14px
- Drag handles: always visible on mobile (opacity 0.7)
- Touch slop threshold: 10px (movement before gesture cancels)

---

## 16. Data Flow

### 16.1 Initial Load

1. Page loads → `fetchChits()` fetches all chits from `/api/chits`
2. Settings loaded from `/api/settings/default_user`
3. Sort preferences loaded from `/api/sort-preferences`
4. Manual sort orders loaded from `/api/sort-orders`
5. `_computePrerequisiteFlags(allChits)` calculates `_hasIncompletePrereqs` for each chit
6. `filterChits('Tasks')` called → shows/hides sidebar sections, calls `displayChits()`
7. `displayChits()` → applies filters → applies sort → calls `displayTasksView(filteredChits)`

### 16.2 Status Change

1. User changes dropdown value
2. `_styleStatusDropdown()` updates dropdown visual
3. `fetch('/api/chits/{id}', { method: 'PUT', body: {...chit, status: newValue} })`
4. On success: `fetchChits()` → full re-render

### 16.3 Drag Reorder

1. Touch hold 400ms → drag activates
2. User moves card → placeholder shifts
3. Touch end → new order read from DOM
4. `saveManualOrder('Tasks', ids)` → localStorage + `PUT /api/sort-orders/Tasks`
5. Sort field set to 'manual'
6. `saveSortPreference('Tasks', 'manual', 'asc')` → localStorage + `PUT /api/sort-preferences/Tasks`
7. `displayChits()` re-renders with new order

---

## 17. Desktop Interactions (Not Available on Mobile Touch)

These interactions exist in the code but are desktop-only:

- **Shift+click:** Opens Quick Edit modal (mobile equivalent: long-press)
- **Right-click / context menu:** Opens chit context menu (mobile: no equivalent, use long-press → quick edit)
- **Double-click:** Opens editor (mobile: double-tap works but is less common; single tap on title link is primary)
- **HTML5 drag (mouse):** Uses `dragstart/dragover/drop` events (mobile: touch drag system replaces this)
- **Keyboard shortcuts:** Various hotkeys for tab switching, search, etc. (mobile: no keyboard)

---

## 18. URL Hash Routing

The Tasks view updates the URL hash to enable bookmarking:

- Tasks (default mode): `#tasks`
- Habits mode: `#tasks/habits`
- Assigned mode: `#tasks/assigned`

On page load, the hash is parsed to restore the correct tab + mode.

---

## 19. Favicon

When the Tasks tab is active, the browser favicon is set to `/static/tasks.png`.

---

## 20. Prerequisites Indicator

- Computed by `_computePrerequisiteFlags(allChits)` on every fetch
- A chit has `_hasIncompletePrereqs = true` if:
  - It has a `prerequisites` array (JSON field)
  - At least one prerequisite chit's status is NOT "Complete"
- Visual effect: The "Blocked" option in the status dropdown shows "Blocked ⛓️" (chain emoji)
- This is purely informational — it doesn't prevent status changes

---

## 21. Shared Chit Behavior

### 21.1 Viewer Role

- Status dropdown: `disabled = true`, title = "Read-only — shared chit"
- Long-press: no quick-edit callback (long-press does nothing)
- Context menu: not shown
- Shift+click: not triggered

### 21.2 Visual Indicators for Shared Chits

- Shared icon (🔗) in header meta with tooltip
- Role badge (class `cwoc-role-badge`)
- Owner badge (class `cwoc-owner-badge`)
- RSVP indicators and action buttons
- Declined chits: `opacity: 0.35`

---

## 22. Body & Page-Level Styles (Mobile)

```css
body {
    overflow: auto;
    overflow-x: hidden;
    word-break: break-word;
    overflow-wrap: break-word;
}
```

- Natural scrolling enabled (no `overflow: hidden` on body)
- Horizontal overflow prevented
- Word wrapping enforced globally

---

## 23. Complete Mobile Visual Summary

From top to bottom of the viewport when viewing Tasks:

1. **Fixed header** (≈50px): [☰ hamburger] [logo 32px] [h1 "Omni Chits"] ... [profile img] [☰ Tasks button]
2. **Chit list** (remaining viewport): Vertical stack of task cards, 6px gap, 4px padding
3. Each card: Title row (icons + title + meta wrapped below) → Status row (icon + label + dropdown, stacked above note preview on mobile) → Optional map thumbnail
4. **Footer** (below scroll): Copyright line (scrolls with content)

**What's NOT visible by default:**
- Tab bar (hidden, replaced by Views button)
- Sidebar (off-screen left)
- Views panel (off-screen right)
- Top bar / date range (hidden)
- Quick edit modal (triggered by long-press)
