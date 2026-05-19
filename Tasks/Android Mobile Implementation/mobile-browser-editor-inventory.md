# Mobile Browser Chit Editor — Complete Inventory

This document is an exhaustive inventory of every control, gesture, input, div, and behavior in the CWOC Chit Editor as rendered in a mobile browser (≤768px viewport). It describes exactly how the editor transforms from a two-column desktop layout into a single-zone-at-a-time mobile experience.

---

## 1. Overall Architecture & Layout

### Desktop (>768px)
- Two-column grid layout (`.main-zones-grid` with `grid-template-columns: 1fr 1fr`)
- All zones visible simultaneously, collapsible via zone headers
- Header row with logo, title "Chit Editor", and button groups visible at top
- Footer with copyright visible at bottom

### Mobile (≤768px) — "Mobile Zone Mode"
- **Single-zone-at-a-time view** — only one zone is visible at any moment
- Body gets class `mobile-zone-mode`
- Header row (`.header-row`) is **completely hidden** (`display: none`)
- Footer (`.author-info`) is **completely hidden**
- Title/weather container (`#titleWeatherContainer`) is hidden (replaced by Overview zone)
- The `.editor` container fills the remaining viewport height, no border/shadow/border-radius
- The `.main-zones-grid` becomes `display: block` (no grid)
- Column wrappers (`.column-one`, `.column-two`) become `display: block`, full width
- Zone containers lose border-radius, left/right borders, and fill 100% width
- All inputs get `min-height: 38px` and `font-size: 16px` (prevents iOS zoom on focus)
- Checkboxes/radios stay at 16×16px (not oversized)

### Activation
- Triggered at `window.innerWidth <= 768` on page load (with 200ms delay for other init)
- Resize listener toggles between mobile/desktop mode when crossing 768px boundary
- Function: `initMobileZoneNav()` → `_activateMobileZoneMode()` / `_deactivateMobileZoneMode()`

---

## 2. Sticky Navigation Header

### Element
- `div.mobile-zone-nav-header` — inserted before `#mainEditor` in the DOM
- `position: sticky; top: 0; z-index: 100`
- Background: parchment texture image + `#f5e6d3` fallback
- Border-bottom: `2px solid #c4a882`
- Box-shadow: `0 2px 6px rgba(0,0,0,0.1)`
- Font: Lora, Georgia, serif
- Padding: `8px 12px`
- Flexbox: `align-items: center; justify-content: space-between; gap: 8px`

### Contents (left to right)
1. **Left hamburger button** (`.mobile-zone-nav-prev`): Text "☰", opens Actions Sidebar
   - Brown background (`#8b5a2b`), cream text (`#fff8e1`), border `1px solid #5a3f2a`
   - Min-size: 36×36px
   - Has a **pulsing gold dot** (`.mobile-unsaved-dot`) when unsaved changes exist
     - 8×8px gold circle (`#d4af37`), positioned absolute top-right of button
     - Pulses opacity 1→0.4→1 over 2s infinite animation
2. **Title area** (`.mobile-zone-nav-title`): Shows chit title (truncated, 0.7 opacity) 
   - Flex: 1, overflow hidden, ellipsis
   - Chit title in `.mobile-zone-nav-chit-title` (0.9em, normal weight, 0.7 opacity)
3. **Counter** (`.mobile-zone-nav-counter`): Shows "3/15" (current zone / total zones)
   - 0.75em, color `#8b5a2b`, 0.7 opacity
4. **Right hamburger button** (`.mobile-zone-nav-next`): Text "☰ [Zone Name]", opens Zone List
   - Same styling as left button
   - Shows current zone name (e.g., "☰ Dates & Times")
   - 0.82em font-size, no min-width constraint

### Color Behavior
- When the chit has a color set (not transparent), the nav bar background changes to that color
- Text and buttons get contrast colors via `contrastColorForBg()`
- Buttons invert: button background = text color, button text = chit color
- When no color: reverts to default parchment theme

---

## 3. Zone Navigation

### Zone Order (fixed)
| # | ID | Label | Icon |
|---|---|---|---|
| 0 | titleZone | Overview | 📋 |
| 1 | datesSection | Dates & Times | 🗓️ |
| 2 | taskSection | Task | 📋 |
| 3 | notesSection | Notes | 📝 |
| 4 | checklistSection | Checklist | ☑️ |
| 5 | tagsSection | Tags | 🏷️ |
| 6 | peopleSection | People | 👥 |
| 7 | locationSection | Location | 📍 |
| 8 | alertsSection | Alerts | 🔔 |
| 9 | projectsSection | Projects | 📂 |
| 10 | colorSection | Color | 🎨 |
| 11 | healthIndicatorsSection | Indicators | ❤️ |
| 12 | attachmentsSection | Attachments | 📎 |
| 13 | emailSection | Email | ✉️ |
| 14 | habitLogSection | Habits | 🎯 |

### Visibility Rules
- Zones hidden by app logic (e.g., `emailSection` when not an email chit, `habitLogSection` when habit not enabled) are excluded from the visible zone list
- The system checks `style.display === 'none'` without the `data-mobile-zone-hidden` attribute to determine app-hidden zones
- Custom zones (from Custom Objects) are dynamically added to the list

### Starting Zone
- Determined by the source tab stored in `localStorage('cwoc_source_tab')`:
  - Calendar → datesSection
  - Checklists → checklistSection
  - Alarms → alertsSection
  - Projects → checklistSection
  - Tasks → taskSection
  - Notes → notesSection
  - Email → emailSection (polls until available, max 5s)
  - Indicators → healthIndicatorsSection + datesSection
- If URL has `?start=` or `?end=` params → forces Calendar (datesSection)
- For existing chits: restores last-viewed zone from `sessionStorage('cwoc_mobile_zone_' + chitId)`

### Zone Switching Behavior
- When switching zones:
  1. All zone containers get `display: none` + `data-mobile-zone-hidden` attribute
  2. The active zone gets `display: ''`, attribute removed, class `collapsed` removed
  3. Zone toggle icon set to '🔼' (expanded)
  4. Zone action buttons made visible
  5. Parent column shown, other column hidden
  6. Sticky header updated with new zone info
  7. Zone list active state updated
  8. Editor scrolled to top
- Zones wrap around: going past the last zone returns to first, and vice versa

---

## 4. Gestures

### Swipe on Navigation Header
- **Swipe left** → Navigate to next zone
- **Swipe right** → Navigate to previous zone
- Threshold: 50px horizontal, must be more horizontal than vertical
- Max time: 500ms

### Swipe on Zone Body (document-level)
- **Swipe left** → Open Zone List (from right)
- **Swipe right** → Open Actions Sidebar (from left)
- Same threshold (50px) and max time (500ms)
- Does NOT trigger if:
  - Mobile zone mode is not active
  - A drag operation is in progress (`window._touchDragActive`)
  - Zone List or Actions Sidebar is already open
  - Touch started on the nav header (handled separately)
- If swipe started from an input/textarea/select, blurs the active element (dismisses keyboard)

### Swipe on Zone List Panel (when open)
- **Swipe right** → Close Zone List

### Swipe on Actions Sidebar (when open)
- **Swipe left** → Close Actions Sidebar

### Long Press (on chit cards in Projects zone)
- Hold 800ms without moving >10px
- Triggers quick-edit modal (same as shift-click on desktop)
- Haptic feedback via `navigator.vibrate(200)` or `_cwocVibrate(200)`

---

## 5. Zone List Panel (Right Sidebar)

### Trigger
- Tap right hamburger button ("☰ [Zone Name]")
- Swipe left on zone body

### Appearance
- Slides in from right edge
- Fixed position, `width: 240px`, full height
- Background: parchment texture + `#faebd7`
- Border-left: `2px solid #8b4513`
- Box-shadow: `-4px 0 16px rgba(0,0,0,0.2)`
- Transition: `right 0.25s ease`
- z-index: 2001
- Overflow-y: auto with `overscroll-behavior: none`

### Backdrop
- Fixed full-screen overlay, `background: rgba(0,0,0,0.4)`, z-index: 2000
- Tap backdrop → closes panel

### Contents
- Title: "Zones" (h3, centered, border-bottom)
- List of zone items (`.mobile-zone-list-items`):
  - Each item: icon + label, flex row, `min-height: 38px`
  - Active zone: ivory background, thicker border (`2px solid #8b4513`)
  - Empty zones: `opacity: 0.4`, italic, normal weight
  - Non-empty zones: bold, `#4a2c2a` color
  - Tap any item → closes panel, navigates to that zone
  - `:active` state: `background: #c4a484`
- Close button at bottom: "⇤ Hide Sidebar"
  - Full width, brown background (`#a0522d`), cream text, `min-height: 44px`

### Empty Zone Detection
Each zone type has specific logic to determine if it's "empty":
- Title: no title text
- Dates: "None" radio selected
- Task: no status selected
- Notes: textarea empty
- Checklist: no `.checklist-item` elements
- Tags: `_currentTagSelection` array empty
- People: no chips and hidden field empty
- Location: location input empty
- Alerts: all alert arrays empty
- Projects: no child chits loaded
- Color: value is "transparent" or empty
- Health: no `.entry` elements
- Attachments: count shows "0"
- Email: emailTo field empty
- Habits: habitEnabled checkbox unchecked

---

## 6. Actions Sidebar (Left Sidebar)

### Trigger
- Tap left hamburger button ("☰")
- Swipe right on zone body

### Appearance
- Slides in from left edge
- Fixed position, `width: 280px`, full height
- Background: parchment texture + `#faebd7`
- Border-right: `2px solid #8b4513`
- Box-shadow: `4px 0 16px rgba(0,0,0,0.2)`
- Transition: `left 0.25s ease`
- z-index: 2001
- Overflow-y: auto with `overscroll-behavior: none`

### Backdrop
- Same as Zone List: full-screen `rgba(0,0,0,0.4)`, z-index: 999
- Tap → closes sidebar

### Contents (top to bottom)
1. **Close button**: "⇤ Hide Sidebar" (same style as zone list close)
2. **Spacer** (border-top divider)
3. **Action buttons** (`.mobile-actions-sidebar-items`):

**When unsaved changes exist (shown first, highlighted):**
- 📌 **Save & Stay** — calls `saveChitAndStay()`
  - Special styling: brown background (`#8b5a2b`), cream text, bold
- 🚪 **Save & Exit** — calls `saveChit()`
  - Same highlighted styling

**Always shown:**
- **Hide in Calendar** / **Show in Calendar** — toggles `showOnCalendar` checkbox
  - Icon: `fa-calendar-xmark` / `fa-calendar-check`
- 🧮 **Calculator** — opens the shared calculator overlay
- 😴 **Snooze** / **Snoozed** — opens snooze modal
- **Options** (`fa-ellipsis-vertical`) — opens the Options dropdown menu
- **Exit** (`fa-times`) — calls `cancelOrExit()`

### Button Styling
- Each button: flex row, `min-height: 38px`, full width
- Background: `#fdf5e6`, border: `1px solid #a0522d`, border-radius: 4px
- Font: Lora, bold, 0.9em, color `#4a2c2a`
- `:active` state: `background: #c4a484`

---

## 7. Overview Zone (Zone Index 0)

### Purpose
Read-only summary of all populated fields. Tapping any row navigates to the corresponding zone for editing.

### Rendering
- Replaces the normal title/weather container content
- Container gets class `mobile-zone-active`
- Original title field and weather section are hidden
- A `.mobile-overview-panel` div is created with rows

### Row Structure
Each row (`.mobile-overview-row`):
- Flex row, `min-height: 44px`, padding `12px 14px`
- Border-bottom: `1px solid #e0d4c0`
- Cursor: pointer
- `:active` background: `#ede0cc`
- Contents: icon (24px wide) + text (flex:1, ellipsis) + arrow "›" (1.3em, `#a0845a`)

### Rows Shown (in order, only if populated)

1. **Title** (always shown if has text)
   - Icon: ✏️
   - Text: chit title (bold, 1.15em, `#2b1e0f`)
   - Tap → shows title input field and focuses it for inline editing
   - If no title: title input field shown directly (not as a row)

2. **Weather** (only if real weather data loaded, not placeholder)
   - Icon: 🌤️
   - Text: weather icon + description + temperature range
   - Tap → navigates to Dates zone

3. **Dates/Times** (if any date mode is active)
   - Icon: 🗓️
   - Text: compact date summary (e.g., "2026-May-18 09:00 → 17:00" or "Due: 2026-May-20")
   - Tap → navigates to Dates zone

4. **Notes** (if note textarea has content)
   - Icon: 📝
   - Text: first 3 lines (max 60 chars each), with "…N more lines" if truncated
   - Multi-line row (white-space: normal)
   - Tap → navigates to Notes zone

5. **Checklist** (if checklist items exist)
   - Icon: ☑️
   - Text: up to 4 incomplete items as "☐ item text", plus completed count
   - If all complete: "✓ All N items complete"
   - Multi-line row
   - Tap → navigates to Checklist zone

6. **Location** (if location field has text)
   - Icon: 📍
   - Text: location value
   - Tap → navigates to Location zone

7. **Indicators** (if any indicator fields have values)
   - Icon: ❤️
   - Text: "N indicator(s) recorded"
   - Tap → navigates to Indicators zone

8. **Custom Zones** (for each custom zone with populated fields)
   - Icon: 📦
   - Text: zone name (bold) + up to 4 field label:value pairs
   - Multi-line row
   - Tap → navigates to that custom zone

9. **Empty state** (if nothing populated)
   - Centered italic text: "New chit — swipe or tap a zone to start editing"
   - Color: `#8b7355`, padding: `24px 16px`

### Title Zone Controls
Below the overview rows, action buttons are injected (`.mobile-title-zone-controls`):
- Only **QR** and **Log** buttons from the header are shown here
- **Nest** button shown if visible
- Buttons styled as `.mobile-title-zone-btn`: 50% width grid, `min-height: 44px`
- Save/Exit/Delete/Archive/Snooze are NOT here (they're in the Actions Sidebar only)

---

## 8. Zone-Specific Mobile Layouts

### 8.1 Dates & Times Zone
- Date mode radio buttons stack vertically (`.date-mode-group` → column flex)
- Radio/checkbox inputs: 16×16px, fixed width column for alignment
- Date mode fields indent 22px left (under the radio)
- Text inputs: `flex: 1`, `min-width: 80px`, `min-height: 34px`
- Timezone picker: full-width input, `min-height: 38px`, `font-size: 16px`
- All Day button visible in zone header actions
- Zone header actions: flex-wrap, full width, left-justified

### 8.2 Task Zone
- Priority/Status/Severity: each field is `flex-direction: row`, label 70px min-width right-aligned
- Select elements: `flex: 1`, `min-height: 44px`
- Prerequisites: add button + list, no left margin on mobile

### 8.3 Notes Zone
- Textarea fills all available space: `flex: 1`, `min-height: calc(100vh - 180px)`
- No resize handle
- Format toolbar always visible inline (flex-wrap)
- Fullscreen notes modal is **blocked** (`display: none !important`)
- Markdown rendered output available via toggle button
- Keyboard shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+K (link), etc.
- Enter key auto-continues lists (bullets, numbers, checkboxes, blockquotes)

### 8.4 Checklist Zone
- Container fills space: `flex: 1`, overflow-y auto
- Each checklist item: text input with `flex: 1`, `min-width: 0`
- Items have padding-right: 4px
- Drag-and-drop reordering via touch (shared-touch.js)
- Nested items supported (indent levels)

### 8.5 Tags Zone
- Search input: full width, `min-height: 40px`
- Tag tree container: `flex: 1`, overflow-y auto, full width
- Tag checkboxes: 16×16px (not oversized)
- Tag rows: full width, overflow hidden, text-overflow ellipsis
- Favorites/Recent row: flex-wrap
- Active tags list: full width

### 8.6 People Zone
- Search input: full width, `min-height: 40px`
- People tree: same layout as tags
- People chips: `max-width: calc(100% - 8px)`
- Expand/Collapse button in zone header
- "Add" button creates new contact
- Stealth toggle in zone header
- Fullscreen people modal is **blocked** on mobile

### 8.7 Location Zone
- All inputs and selects: full width, `min-height: 44px`
- Fields stack vertically (flex-direction: column)
- Saved locations dropdown: full width
- Map container renders inline
- Zone header buttons: Search, Map, Directions, Context, Add/Clear

### 8.8 Alerts Zone
- All buttons: `min-height: 44px`
- Fields stack vertically with 8px gap
- Zone header has 4 add buttons: Notification, Alarm, Timer, Stopwatch
- Each alert type renders in its own container

### 8.9 Projects Zone
- Content fills space: `flex: 1`
- Status items container: `flex: 1`, overflow-y auto
- Zone header: Add Chit, Create New, Project Master toggle, Add to Project dropdown, Remove button
- Kanban-style board with status columns

### 8.10 Color Zone
- Color grid: CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))`
- Full width, 6px gap
- Each swatch is a tappable div with background color
- Selected swatch gets outline
- Custom colors section below default colors

### 8.11 Health Indicators Zone
- Each entry: flex-direction column, full width
- Labels: white-space normal, word-wrap break-word
- Inputs: full width, `min-height: 38px`
- Blood pressure inputs: flex-wrap, 50% width each
- Dynamically rendered from Custom Objects API

### 8.12 Attachments Zone
- Fills space: `flex: 1`
- File input hidden, triggered by "Add Files" button
- Drag & drop area with hint text
- Attachment list renders above upload area

### 8.13 Email Zone
- Fields stack with 2px gap
- Each email field: flex row, label 36px min-width
- Autocomplete inputs: `flex: 1`
- Email body textarea: `flex: 1`, `min-height: calc(100vh - 260px)`, no resize
- Format toolbar always visible inline
- HTML/Text toggle row shown on mobile
- CC/BCC toggle buttons
- Fullscreen email modal is **blocked** on mobile
- Zone header: Expand, PGP, Send, Send Later, Discard, Reply, Forward, Render, Undo, Redo, Email activate

### 8.14 Habits Zone
- Only visible when habit is enabled on the chit
- Settings section (collapsible): goal, frequency, reset period, calendar toggle, overall % toggle
- Charts section (collapsible): completion, success rate, streak canvases
- History section (collapsible): 2-column period list

---

## 9. Dropdown Menus on Mobile

### Zone "More" Menus
- On mobile, dropdown menus (`.zone-more-menu`) become **bottom sheets**:
  - `position: fixed; bottom: 0; left: 0; right: 0; width: 100%`
  - `border-radius: 12px 12px 0 0`
  - `box-shadow: 0 -4px 16px rgba(0,0,0,0.25)`
  - z-index: 2000
  - Buttons inside: `padding: 12px 16px`, `min-height: 44px`, `font-size: 1em`

### Menu Backdrop
- A `.mobile-menu-backdrop` element blocks all interaction behind open menus
- `background: rgba(0,0,0,0.3)`, z-index: 1999
- Tap backdrop → closes all open menus
- MutationObserver watches for `style` attribute changes on menu elements to auto-show/hide backdrop

### Notes Toolbar Dropdown
- Also becomes fixed bottom sheet on mobile:
  - `position: fixed; bottom: 60px; left: 8px; right: 8px`
  - `border-radius: 8px`
  - `box-shadow: 0 -2px 12px rgba(0,0,0,0.2)`

---

## 10. Save State & Unsaved Changes

### Indicators
- **Pulsing gold dot** on left hamburger button when unsaved changes exist
- Actions Sidebar shows Save & Stay / Save & Exit buttons (highlighted brown) only when unsaved
- Auto-save indicator (if enabled): shows in zone header area

### Save Triggers
- Save & Stay: saves without leaving editor
- Save & Exit: saves and navigates back to dashboard
- Auto-save (if enabled): debounced save after changes

### Dirty Tracking
- `window._cwocSave.hasChanges()` checks if there are unsaved modifications
- `setSaveButtonUnsaved()` marks the editor as dirty
- `setSaveButtonSaved()` marks as clean
- `_updateMobileUnsavedIndicator(hasUnsaved)` updates the visual dot

---

## 11. Zone Header Actions (Per-Zone)

On mobile, zone headers are visible but simplified:
- Zone title and toggle icon are **hidden** (nav bar handles that)
- Only the `.zone-actions` row is shown (flex-wrap, full width)
- Action buttons get `display: inline-flex !important`
- `.hideWhenNarrow` labels are shown (not hidden like on narrow desktop)
- "Expand to fullscreen" buttons are hidden (notes, email, people expand buttons)

---

## 12. Keyboard & Input Behavior

### iOS Zoom Prevention
- All text inputs, number inputs, date inputs, selects, and textareas get `font-size: 16px`
- This prevents iOS Safari from zooming in when focusing an input

### Keyboard Dismissal
- Swiping while an input is focused blurs the active element (dismisses keyboard)

### Escape Key
- Not applicable on mobile (no physical ESC key)
- Modals close via backdrop tap or close buttons

---

## 13. Persistence & State Recovery

### Zone Position
- Current zone ID saved to `sessionStorage('cwoc_mobile_zone_' + chitId)` on every zone switch
- On page refresh with same chit ID, restores to the last-viewed zone

### Source Tab
- `localStorage('cwoc_source_tab')` determines initial zone for new chits
- Set by the dashboard before navigating to editor

---

## 14. CSS Breakpoints Summary

| Breakpoint | What Changes |
|---|---|
| ≤768px | Mobile zone mode activates, single-zone view, nav header shown, header/footer hidden, grid → block |
| ≤600px | Prerequisites list loses left margin |
| ≤480px | Autosave indicator shrinks (0.7em, 3px 6px padding) |

---

## 15. Elements Hidden on Mobile

- `.header-row` (entire header bar with logo, title, buttons)
- `.author-info` (footer)
- `#titleWeatherContainer` (replaced by Overview zone)
- `#open-notes-modal-button` (fullscreen notes)
- `#emailExpandBtn` (fullscreen email)
- `#open-people-modal-button` (fullscreen people)
- `#notesModal` (fullscreen notes modal)
- `#emailExpandModal` (fullscreen email modal)
- `#peopleExpandModal` (fullscreen people modal)
- `#nestButton` and `#nestButtonLabel` in title zone
- `#emailQuickActivateBtn` in title zone
- Zone title text (`.zone-title`) — nav bar shows it instead
- Zone toggle icon (`.zone-toggle-icon`) — zones don't collapse on mobile

---

## 16. Elements Shown Only on Mobile

- `.mobile-zone-nav-header` (sticky nav bar)
- `.mobile-zone-list-panel` + backdrop (zone list)
- `.mobile-actions-sidebar` + backdrop (actions sidebar)
- `.mobile-overview-panel` (overview zone content)
- `.mobile-title-zone-controls` (QR/Log/Nest buttons in overview)
- `.mobile-unsaved-dot` (pulsing indicator)
- `.mobile-menu-backdrop` (for dropdown menus)
- `#emailHtmlToggleRow` (HTML/Text toggle for email)
- `#notesFormatToolbar` forced visible (always shown inline)
- `#emailInlineFormatToolbar` forced visible (always shown inline)

---

## 17. Touch Target Sizes

All interactive elements on mobile meet minimum touch target requirements:
- Buttons: `min-height: 36px` (zone body) to `44px` (sidebar, alerts, location inputs)
- Nav header buttons: `min-width: 36px`, `min-height: 36px`
- Sidebar items: `min-height: 38px`
- Zone list items: `min-height: 38px`
- Form inputs: `min-height: 38px`
- Select elements in Task zone: `min-height: 44px`

---

## 18. Animations & Transitions

- Zone List panel: `right 0.25s ease` (slide in/out)
- Actions Sidebar: `left 0.25s ease` (slide in/out)
- Unsaved dot: `opacity` pulse animation, 2s infinite
- Zone-more-menu backdrop: instant show/hide (no transition)
- Nav bar color: instant (no transition)
- Sidebar buttons `:active`: instant background change

---

## 19. Accessibility

- Nav buttons have `aria-label` attributes ("Actions menu", "Zones menu")
- Zone list items are tappable divs (not buttons) — no ARIA roles
- Backdrop elements close panels on tap (expected mobile pattern)
- High contrast text on parchment backgrounds
- Font sizes never below 14px for user-facing text
