# Omni View — Requirements

## Overview
The Omni View is a command-center dashboard that fuses the itinerary view, pinned chits, and unread email into a single actionable view. It is triggered by clicking "Omni" in the header or pressing the `O` hotkey. It acts as a tab-like view alongside C CAPTN.

## Requirement 1: Trigger & Navigation

### Requirement 1.1
The word "Omni" in the `<h1>Omni Chits</h1>` header shall be a clickable button that activates the Omni View.

**Acceptance Criteria:**
- "Omni" has a subtle hover state (underline or color shift) indicating it's clickable
- Clicking "Omni" switches the main content area to the Omni View (same behavior as switching tabs)
- No C CAPTN tab appears active when Omni View is shown
- Clicking any C CAPTN tab exits the Omni View and shows that tab

### Requirement 1.2
The `O` hotkey shall activate the Omni View from the dashboard.

**Acceptance Criteria:**
- Pressing `O` (not in an input/textarea) switches to Omni View
- The reference overlay (R) shows `O` → Omni View in the hotkey list

### Requirement 1.3
The `S` hotkey shall replace `O` for Sort/Order.

**Acceptance Criteria:**
- Pressing `S` opens the sort/order submenu (previously `O`)
- The reference overlay shows `S` → Sort

### Requirement 1.4
The `F9` hotkey shall open Settings (replacing `S`).

**Acceptance Criteria:**
- Pressing `F9` navigates to the Settings page (previously `S`)
- The reference overlay shows `F9` → Settings
- `F10` remains Rules (unchanged)

---

## Requirement 2: Layout & Sections

### Requirement 2.1
The Omni View shall display up to 8 configurable areas in a two-column layout.

**Areas:**
1. HST Bar (Horizontal Strip Timeline)
2. Weather Bar
3. ⏰ Chrono Anchored (timed events today)
4. 🔜 On Deck (all-day today, untimed tasks due today, habits due today)
5. 🗓️ Soon (due this week, not today)
6. 📧 Unread Email (from Omni-enabled bundles)
7. 📝 Pinned Notes (pinned chits that are notes)
8. ☑️ Pinned Checklists (pinned chits with checklist items)

**Acceptance Criteria:**
- Each area can be configured as half-width (one column) or full-width (spans both columns)
- Each area can be positioned in any order via drag-and-drop in Settings
- Each area can be hidden/shown via toggle in Settings
- Default layout: HST + Weather full-width at top; Chrono Anchored, On Deck, Soon, Email in left column; Pinned Notes, Pinned Checklists in right column
- On mobile: single-column stack in configured order

### Requirement 2.2
Empty sections shall not render.

**Acceptance Criteria:**
- If a section has zero items, its header and container are not added to the DOM
- The layout adjusts naturally (no empty gaps)

### Requirement 2.3
Section headers shall use the same style as the itinerary view headers.

**Acceptance Criteria:**
- Same font size, weight, color, icon placement, and border styling as `displayItineraryView()` section headers

---

## Requirement 3: HST Bar

### Requirement 3.1
The HST Bar shall display a horizontal strip timeline of today using the same fill-up-to-now visual as the existing HST clock.

**Acceptance Criteria:**
- Uses the same gradient fill (`linear-gradient(90deg, #d4af37 0%, #c8965a 60%, #8b4513 100%)`) filling from left to the current time position
- Background is `#f5e6cc` with `2px solid #8b4513` border
- Updates in real-time (1-second interval)

### Requirement 3.2
Chrono Anchored events shall appear on the HST Bar as their type icons at their scheduled time position.

**Acceptance Criteria:**
- Calendar events show 🗓️, tasks show ☑️ (same icons as itinerary view)
- Icons are positioned horizontally at their start time's percentage of the day
- Hovering an icon shows a tooltip with the full chit title
- Clicking an icon opens quick-edit for that chit

### Requirement 3.3
Weather forecast icons shall appear on the HST Bar at their predicted times.

**Acceptance Criteria:**
- Weather icons (🌧️, ☀️, ⛈️, etc.) from the hourly forecast are placed at their hour position
- Uses the existing `_weatherIcons` map and `_getWeatherIcon()` function
- Clicking any weather icon opens the quick weather modal (`_openWeatherModal`)
- On mobile, long-pressing a weather icon opens the quick weather modal

### Requirement 3.4
When the HST Bar becomes too crowded, chit icons shall collapse to thin vertical lines.

**Acceptance Criteria:**
- If icons would overlap (less than ~20px apart), replace chit icons with 2px-wide vertical lines at their time positions
- Weather icons remain as icons (they take priority for visibility)
- Hovering a vertical line still shows the full title tooltip

---

## Requirement 4: Itinerary Sections (Chrono Anchored, On Deck, Soon)

### Requirement 4.1
The Chrono Anchored, On Deck, and Soon sections shall render identically to the itinerary view.

**Acceptance Criteria:**
- Reuses `_buildItineraryEvent()` and `_buildItineraryHabitCard()` directly
- Same categorization logic as `displayItineraryView()`: On Deck = all-day today + untimed tasks due today + habits due today; Chrono Anchored = timed events today; Soon = due this week (not today)
- Past events are auto-hidden (same as itinerary)
- Status dropdowns, click-to-edit, and all other interactions work identically

### Requirement 4.2
Chrono Anchored items shall display time-until badges.

**Acceptance Criteria:**
- Each item shows a badge like "in 45 min", "in 2h", "in 15 min" alongside its absolute time
- Badge updates periodically (every 60 seconds)
- Past items don't show time-until badges (they're hidden anyway)

### Requirement 4.3
Habit items shall display streak counters.

**Acceptance Criteria:**
- Habits in On Deck show a 🔥 icon with the current streak count (consecutive successful periods)
- Streak is calculated from `habit_success` and `habit_last_action_date` history

---

## Requirement 5: Pinned Sections

### Requirement 5.1
Pinned Notes shall show all pinned chits that qualify as notes (have markdown content, no dates, no checklist).

**Acceptance Criteria:**
- Rendered as compact actionable cards (same as Notes view cards)
- All interactions available (click to edit, shift-click for quick-edit, unpin via context)

### Requirement 5.2
Pinned Checklists shall show all pinned chits that have checklist items.

**Acceptance Criteria:**
- Rendered as compact checklist cards (same as Checklists view cards)
- Inline checklist toggle (check/uncheck items) works directly in the Omni View
- All other interactions available

---

## Requirement 6: Deduplication

### Requirement 6.1
Each chit shall appear in exactly one section of the Omni View.

**Acceptance Criteria:**
- Priority order for placement: if a chit has a time → Chrono Anchored; if due today (no time) → On Deck; if due this week → Soon; if pinned note → Pinned Notes; if pinned checklist → Pinned Checklists
- A pinned chit that is ALSO on today's itinerary appears in its time-based section only (not in Pinned Notes/Checklists)
- Email chits only appear in the Email section (never in itinerary sections even if they have dates)

---

## Requirement 7: Email Section

### Requirement 7.1
The email section shall show unread emails from Omni-enabled bundles only.

**Acceptance Criteria:**
- Only emails where `email_read` is false are shown
- Only emails from bundles that have "Include in Omni View" enabled are shown
- If multiple bundles are Omni-enabled, emails from all of them are shown (merged, sorted by date descending)

### Requirement 7.2
The email section shall show 3 emails at a time with pagination.

**Acceptance Criteria:**
- Shows the 3 most recent unread emails initially
- "Next 3" button replaces the current 3 with the next 3 older unread emails
- "Previous 3" button replaces the current 3 with the 3 newer unread emails
- When at the most recent page, "Previous 3" is hidden/disabled
- When no more older emails exist, "Next 3" is hidden/disabled

### Requirement 7.3
Email cards shall render exactly as they do in the Email tab.

**Acceptance Criteria:**
- Reuses `_buildEmailCard()` function directly
- Swipe-to-archive (right) and swipe-to-delete (left) work identically
- Mark read, reply, pin, and all hover actions work
- After marking an email as read, it disappears from the Omni View email section (since only unread are shown)

### Requirement 7.4
The email section refreshes to the latest 3 unread when entering the Omni View.

**Acceptance Criteria:**
- Every time the user switches to Omni View, pagination resets to page 1 (most recent 3 unread)

---

## Requirement 8: Bundle "Include in Omni View" Flag

### Requirement 8.1
Each bundle shall have an "Include in Omni View" boolean field.

**Acceptance Criteria:**
- New column `omni_view` (boolean, default false) on the `bundles` table
- Exposed in `GET /api/bundles` response
- Settable via `PUT /api/bundles/{id}` with `omni_view: true/false`

### Requirement 8.2
The bundle editor modal shall include an "Include in Omni View" checkbox.

**Acceptance Criteria:**
- Checkbox appears in the bundle create/edit modal (alongside name and description)
- Toggling it and saving persists the value

### Requirement 8.3
The Settings page Omni View config section shall also show bundle Omni View toggles.

**Acceptance Criteria:**
- Lists all bundles with checkboxes for "Include in Omni View"
- Changes here update the same backend field as the bundle editor
- Changes are saved when the Settings page is saved

---

## Requirement 9: Filtering

### Requirement 9.1
The Omni View shall start with a hard auto-filter showing only "right now" relevant items.

**Acceptance Criteria:**
- Base filter is always active: today's itinerary + pinned + unread email from Omni-enabled bundles
- This base filter cannot be removed by the user

### Requirement 9.2
Sidebar filters shall be applicable on top of the base filter.

**Acceptance Criteria:**
- All standard filter options work: status, tags, priority, people, text search
- Filters narrow the results further (intersection with base filter)
- Filters are NOT retained across sessions (reset when leaving and returning to Omni View)

### Requirement 9.3
A "Lock Filters" button shall save current filters as Omni View defaults.

**Acceptance Criteria:**
- 🔒 icon button appears in the filter section when Omni View is active
- Clicking it saves the current filter state to the Settings page as "Omni View default filters"
- Shows a brief confirmation ("Filters saved as Omni defaults")
- Next time Omni View is opened, these locked defaults are pre-applied
- Clearing the defaults is done from the Settings page Omni View config section

---

## Requirement 10: Settings Page — Omni View Configuration

### Requirement 10.1
The Settings page shall have an "Omni View" configuration section.

**Acceptance Criteria:**
- New setting group with header "🔮 Omni View" (or similar icon)
- Located logically among other view/display settings

### Requirement 10.2
The config section shall include a drag-and-drop layout configurator.

**Acceptance Criteria:**
- Visual representation of the 8 areas as draggable cards
- Each card has a half-width / full-width toggle
- Each card has a visible/hidden toggle
- Drag to reorder within the layout
- Reuses existing drag-and-drop infrastructure from Settings (same pattern as clock format grid: `setupDragListeners`, active/inactive zones)
- Changes persist to backend settings

### Requirement 10.3
The config section shall show bundle Omni View toggles.

**Acceptance Criteria:**
- Lists all bundles with "Include in Omni View" checkboxes
- Same backend field as Req 8.1

### Requirement 10.4
The config section shall show locked filter defaults.

**Acceptance Criteria:**
- Displays the currently locked filters (if any)
- "Clear Defaults" button to remove all locked filters
- Shows which filters are active as readable labels (e.g., "Status: ToDo, In Progress; Priority: High")

---

## Requirement 11: Hotkey Reshuffle

### Requirement 11.1
The hotkey map shall be updated as follows:

| Key | New Function | Previous Function |
|-----|-------------|-------------------|
| O | Omni View | Sort/Order |
| S | Sort/Order | Settings |
| F9 | Settings | (unused) |
| F10 | Rules | Rules (unchanged) |

**Acceptance Criteria:**
- `_cwocHotkeyTabMap` and `_cwocHandleActionHotkey` updated accordingly
- Reference overlay updated to show new mappings
- All pages that reference the old hotkeys are updated

---

## Requirement 12: Mobile Support

### Requirement 12.1
The Omni View shall be fully responsive on mobile.

**Acceptance Criteria:**
- Single-column layout on screens below 768px
- All sections stack vertically in configured order
- Touch interactions (swipe email, tap to edit, long-press weather for modal) all work
- "Omni" in header remains clickable on mobile
- HST Bar scales to full width and remains usable

---

## Requirement 13: Code Reuse

### Requirement 13.1
The implementation shall maximize reuse of existing code.

**Reuse targets:**
- `_buildItineraryEvent()` / `_buildItineraryHabitCard()` — itinerary card rendering
- `_buildEmailCard()` — email card rendering with swipe/actions
- `_renderHSTClock()` — HST bar fill visual pattern
- `_openWeatherModal()` — weather modal trigger
- `_weatherIcons` / `_getWeatherIcon()` — weather icon mapping
- `enableDragToReorder()` / `enableTouchDrag()` — drag-and-drop infrastructure
- `shared-touch.js` — touch event handling
- `_applyMultiSelectFilters()` — filter application
- Settings page drag-and-drop pattern (`setupDragListeners`, active/inactive zones)
- `_emailQuickArchive` / `_emailQuickDelete` / `_toggleEmailReadStatus` — email actions

**Acceptance Criteria:**
- No duplication of existing rendering, interaction, or infrastructure code
- New code only for Omni-specific orchestration, layout, and the HST event/weather overlay
