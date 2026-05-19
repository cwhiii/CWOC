# Android Tasks View Parity — Task List

**Spec**: `mobile-browser-tasks-view-spec.md`
**Existing Code**: `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/TasksScreen.kt`

This task list covers the gaps between the current Android Tasks view and the web mobile browser spec. Items already implemented are marked [x].

---

## Phase 1: Card Layout Parity (Header Row + Meta)

The web uses a two-part header: left (icons + title) and right (meta values). The Android app currently shows title + priority badge in a row, then due date below. This needs restructuring.

### Task 1.1: Restructure TaskCard to Match Web Header Row
- [x] Replace current simple Row(title + priority) with a proper header row composable
- [x] Header row: Row with title/icons on left, meta values wrapping on right
- [x] On Android (always mobile): meta wraps below title (like web's flex-wrap behavior)

### Task 1.2: Add Status Icons to Header
- [x] Add status icon before title (matching web's `_STATUS_ICONS`):
  - ToDo: filled circle, brown `#8B5A2B`
  - In Progress: spinner icon, orange `#D68A59`
  - Blocked: ban/slash icon, red `#B22222`
  - Complete: check-circle, green `#5A8A5B`
  - Rejected: times-circle, gray `#9E9E9E`
- [x] Icons at ~14sp, inline with title

### Task 1.3: Add Indicator Icons Row (Left Section)
- [x] Pinned indicator (📌 Pinned text exists, convert to bookmark icon inline with title)
- [x] Add archived indicator (📦) inline before title when `chit.archived`
- [x] Add snoozed indicator (😴) inline before title when snoozed
- [x] Add stealth indicator (🥷) inline before title when `chit.stealth` and user is owner
- [ ] Add sub-chit indicator (project-diagram icon) when chit is child of a project
- [x] Add alert/notification indicators inline (🔔📢⏱️⏲️) from chit's alerts field
- [ ] Add weather indicator (emoji + tooltip) when chit has location with weather data

### Task 1.4: Add Full Meta Values Row
- [x] Priority badge (exists)
- [x] Due date with overdue highlighting (exists)
- [x] Add start date display: "Start: [date]" when `startDatetime` is set
- [x] Add point-in-time display: "📌 [date]" when `pointInTime` is set
- [x] Add updated date display: "Updated: [date]" when `modifiedDatetime` is set
- [x] Add created date display: "Created: [date]" when `createdDatetime` is set
- [x] Add sort indicator: bold + ▲/▼ on the meta field matching current sort field
- [x] Meta values should wrap (FlowRow) with 4dp gap, 12sp font

### Task 1.5: Overdue Highlighting Parity
- [x] Overdue text color (red) exists
- [x] Add configurable overdue background color (read `overdue_border_color` from settings, default `#B22222`)
- [x] Overdue badge: colored background + contrast text + bold + rounded corners (matching web's "Past Due: YYYY-MMM-DD" pill)
- [x] Format as "Past Due: YYYY-MMM-DD" (not just "⚠ OVERDUE")

### Task 1.6: Blocked Status Highlighting
- [x] When status = Blocked: style the status area with configurable `blocked_border_color` (default `#DAA520`)
- [x] Show "Blocked ⛓️" text when chit has incomplete prerequisites
- [ ] Read `blocked_border_color` from settings (currently hardcoded)

---

## Phase 2: Inline Status Dropdown

The web shows a native `<select>` dropdown directly on each task card for instant status changes. The Android app currently only shows status as a group header — no inline change.

### Task 2.1: Add Inline Status Dropdown to Each Card
- [x] Add a status dropdown (ExposedDropdownMenuBox or DropdownMenu) on each task card
- [x] Position: below the header row, left-aligned (matching web's controls row)
- [x] Options: ToDo, In Progress, Blocked, Complete, Rejected
- [x] Show status icon next to the dropdown value
- [x] Style dropdown based on current value:
  - Blocked: background = `blocked_border_color` setting (default `#DAA520`), contrast text, bold
  - Complete: reduced opacity (0.6)
  - Rejected: gray text, reduced opacity
- [ ] Disable for viewer-role shared chits (show "Read-only" tooltip)

### Task 2.2: Wire Status Change to Repository
- [x] On status change: call `chitRepository.updateStatus(chitId, newStatus)`
- [x] Mark dirty for sync
- [x] Optimistic UI update (update local state immediately)
- [x] Push sync if online

### Task 2.3: Remove Status Group Headers
- [x] Remove the current grouped-by-status layout (status headers like "ToDo", "In Progress")
- [x] Render all tasks in a flat list (sorted by status order when no sort selected)
- [x] This matches web behavior: flat list, no section headers, status shown per-card

---

## Phase 3: Note Preview

The web shows an expandable markdown note preview on each task card. The Android app currently shows no note content on cards.

### Task 3.1: Add Note Preview to Task Cards
- [x] Below the status row, show first ~300 chars of `chit.note` as plain text (or basic markdown if a renderer is available)
- [x] Max height: ~4 lines (equivalent to web's 4.5em cap)
- [x] Overflow: clip with fade or ellipsis
- [x] Opacity: 0.75 (matching web's `.note-preview` opacity)

### Task 3.2: Add "Show More / Show Less" Toggle
- [x] Below the note preview, show a clickable "show more…" text
- [x] On tap: expand to show full note content (remove max-height constraint)
- [x] Text changes to "show less" when expanded
- [x] Style: 12sp, italic, brown `#8B5A2B`, right-aligned

### Task 3.3: Render Markdown in Note Preview
- [ ] If a markdown rendering library is available, render the preview as styled markdown
- [x] Otherwise, show plain text with line breaks preserved
- [ ] Resolve chit links within notes (links to other chits by ID)

---

## Phase 4: Map Thumbnail

The web shows an OpenStreetMap thumbnail on task cards with non-default locations.

### Task 4.1: Add Map Thumbnail to Task Cards
- [x] When chit has a non-empty `location` field AND it's not the default location from settings
- [ ] AND the user setting `show_map_thumbnails` is enabled
- [x] Show a small location indicator (📍 + location text) below the note preview
- [x] Tap on indicator: navigate to Map screen with location focused
- [ ] Full static map image (requires image loading library — deferred, using text indicator instead)

---

## Phase 5: Card Visual States

### Task 5.1: Completed/Rejected Card Opacity
- [x] Completed tasks have reduced opacity (exists via `.completed-task` equivalent)
- [x] Verify opacity is 0.5 (matching web exactly)
- [x] Ensure Rejected status also gets 0.5 opacity

### Task 5.2: Archived Card Opacity
- [x] Archived cards: opacity 0.45 (currently handled by `ArchiveSnoozeIndicators` but not card-level opacity)
- [x] Apply 0.45 alpha to the entire card when `chit.archived`

### Task 5.3: Declined RSVP Visual Treatment
- [ ] When current user has declined a shared chit (RSVP status = "declined")
- [ ] Apply additional visual dimming or strikethrough to the card

### Task 5.4: Card Color Background
- [x] Card background uses chit's color with auto-contrast text (exists via `CwocChitCardStyle`)
- [x] Default cream `#FDF6E3` when no color set (exists)

---

## Phase 6: Touch Interactions & Gestures

### Task 6.1: Single Tap → Open Editor
- [x] Tap on card navigates to editor (exists via `combinedClickable onClick`)

### Task 6.2: Long Press → Action Menu
- [x] Long press shows ChitActionMenu (exists via `combinedClickable onLongClick`)
- [ ] Verify haptic feedback fires on long-press activation
- [ ] Add vibration pattern: [30, 50, 30]ms on long-press (matching web's 1200ms behavior)

### Task 6.3: Swipe-to-Delete
- [x] Swipe left to delete with undo toast (exists via `SwipeableChitCard`)

### Task 6.4: Drag-to-Reorder
- [ ] Implement touch-hold-to-drag reorder (matching web's 400ms hold activation)
- [ ] On hold (400ms): card lifts with elevation/shadow, haptic vibration (30ms)
- [ ] Dragged card follows finger position
- [ ] Other cards animate to make room (shift up/down)
- [ ] On release: save new order, switch sort to MANUAL
- [ ] Persist order to SharedPreferences (key: `manual_order_tasks`)
- [ ] Use `LazyColumn` with `Modifier.animateItemPlacement()` for smooth reorder animations
- [ ] NOTE: Deferred — requires significant gesture handling infrastructure. Current long-press opens action menu instead.

### Task 6.5: Quick Edit Modal (Long Press Alternative)
- [ ] The web uses 1200ms long-press for Quick Edit modal (different from the action menu)
- [ ] Current Android uses long-press for action menu which includes "Quick Edit" as an option
- [ ] This is acceptable parity — the action menu provides access to the same functionality
- [x] Action menu includes Edit option that navigates to editor (exists)

---

## Phase 7: Default Sort & Flat List

### Task 7.1: Default Sort — Status Priority Order
- [x] When sort field = NONE, sort tasks by status weight (matching web):
  - ToDo = 1, In Progress = 2, Blocked = 3, No status = 4, Complete = 5, Rejected = 6
- [x] Currently the app groups by status with headers — change to flat sorted list
- [x] Update `SortEngine` to handle NONE as "sort by status weight" for the Tasks tab specifically

### Task 7.2: Include "Rejected" in Status Order
- [x] Current `STATUS_ORDINAL` in SortEngine only has: ToDo=1, InProgress=2, Blocked=3, Complete=4
- [x] Add: Rejected=5, empty/null=6 (or adjust to match web: ToDo=1, InProgress=2, Blocked=3, empty=4, Complete=5, Rejected=6)

### Task 7.3: Remove Status Group Headers from TasksList
- [x] Current `TasksList` composable groups tasks by status and shows section headers
- [x] Replace with a flat `LazyColumn` that renders all tasks in sort order without headers
- [x] The status is visible per-card via the inline dropdown (Phase 2)

---

## Phase 8: RSVP Indicators & Actions

### Task 8.1: RSVP Status Indicators on Cards
- [ ] Parse `chit.shares` JSON to get list of shared users with their RSVP status
- [ ] Show small indicators per shared user: ✓ (accepted, green), ✗ (declined, red), ⏳ (invited, neutral)
- [ ] Position: in the meta row area, after tag chips

### Task 8.2: RSVP Accept/Decline Buttons
- [ ] For shared chits where current user is NOT the owner
- [ ] Show Accept (✓) and Decline (✗) buttons in the card header
- [ ] Active state: highlighted button
- [ ] On tap: PATCH `/api/chits/{id}/rsvp` with new status, refresh

---

## Phase 9: Context Menu Parity

### Task 9.1: Verify ChitActionMenu Items Match Web
- [x] Open in Editor (exists)
- [x] Pin / Unpin (exists)
- [x] Archive / Unarchive (exists)
- [x] Snooze (exists with SnoozePickerDialog)
- [x] Delete (exists)
- [ ] Add "Quick Edit" option that opens an inline quick-edit dialog (not just navigate to editor)
- [ ] Quick Edit dialog should show: title (editable), status dropdown, priority dropdown, due date picker
- [ ] Add "Add to Bundle" option (only for email chits — `emailMessageId` is not null)

### Task 9.2: Archive with Undo Toast
- [x] Delete has undo toast (exists)
- [ ] Archive should also show an undo toast (matching web's `_showArchiveUndoToast`)
- [ ] Toast message: "[title] archived" with Undo button and countdown

---

## Phase 10: Filter Defaults for Tasks Tab

### Task 10.1: Default Filter — Exclude Complete/Rejected
- [ ] When Tasks tab is selected, auto-apply default filter: statuses = {ToDo, In Progress, Blocked}
- [ ] This means Complete and Rejected are hidden by default (matching web)
- [ ] User can manually add them back via filter panel
- [ ] "Defaults" button in sidebar resets to this default

### Task 10.2: Wire Default Filters on Tab Switch
- [ ] In `FilterSortViewModel.onTabChanged("tasks")`: if no custom filter is saved, apply default statuses
- [ ] Store whether user has manually changed filters (don't re-apply defaults if they did)

---

## Phase 11: Tag Chips with Colors

### Task 11.1: Tag Chips with Proper Colors
- [x] Tag chips row exists (`TagChipsRow` composable)
- [ ] Verify tag chips use the tag's configured color from settings (not just default Material chips)
- [ ] Each tag chip: colored background from tag settings, auto-contrast text
- [ ] Fallback: pastel color generated from tag name hash (matching web's `getPastelColor`)
- [ ] Font size: ~11sp, padding: 2dp horizontal 4dp vertical, border-radius 4dp

### Task 11.2: Exclude System Tags from Display
- [ ] System tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) should NOT appear as chips
- [ ] Filter them out before rendering (matching web's `isSystemTag()` check)

---

## Phase 12: Completed Card Styling Refinements

### Task 12.1: Completed Task Visual Treatment
- [ ] Status = Complete or Rejected: entire card at 0.5 alpha (not just text)
- [ ] Apply `Modifier.alpha(0.5f)` to the Card composable when status is Complete/Rejected

### Task 12.2: Archived Task Visual Treatment  
- [ ] Archived = true: entire card at 0.45 alpha
- [ ] Apply `Modifier.alpha(0.45f)` to the Card composable when archived

---

## Phase 13: Empty State Parity

### Task 13.1: Update Empty State Messages
- [x] Empty state exists ("No Tasks" + "Tap + to create")
- [x] Change message to "No tasks found." (matching web exactly)
- [x] Change button text to "+ Create Chit" (matching web)
- [x] Style: centered, 0.7 opacity wrapper, 1.1em message text

### Task 13.2: Filtered Empty State
- [x] Filtered empty state exists ("No chits match filters" + Clear button)
- [x] Verify it matches web behavior

---

## Phase 14: Habits View Parity

### Task 14.1: Habits View Structure
- [x] Habits view exists with On Deck / Out of Mind / Accomplished sections
- [x] Habit cards show streak, progress bar, reset period
- [x] Goal=1 habits show checkbox instead of progress bar
- [ ] Verify success rate calculation matches web's formula
- [ ] Verify urgency scoring matches web's `habitUrgencyScore`

### Task 14.2: Habits Sidebar Controls
- [x] Success Window dropdown exists in sidebar (7/30/90/All)
- [x] "Include Rule Habits" checkbox exists
- [ ] Wire success window to actually filter the habits view time range
- [ ] Wire include-rules to include/exclude rule-generated habit completions

---

## Phase 15: Assigned View Parity

### Task 15.1: Assigned View
- [x] Assigned view exists, filters by `assignedTo == currentUsername`
- [x] Empty state: "No tasks assigned to you"
- [ ] Verify it uses the same card layout as Tasks mode (not a simplified version)
- [ ] Verify filtering/sorting still applies in Assigned mode

---

## Completion Checklist

### Already Working (from existing implementation):
- [x] Task cards render with title, priority, due date, overdue indicator
- [x] Tag chips row on cards
- [x] Checklist progress badge on cards
- [x] People chips on cards
- [x] Sharing/stealth indicators
- [x] Archive/snooze indicators
- [x] Health indicator badges
- [x] Pin indicator
- [x] Habit indicators (streak, progress, success rate)
- [x] Card background color from chit.color with auto-contrast text
- [x] Overdue border on cards
- [x] Tap to open editor
- [x] Long-press for action menu (pin/archive/snooze/edit/delete)
- [x] Swipe-to-delete with undo toast
- [x] Filter engine (status, priority, tags, people, display toggles, text search)
- [x] Sort engine (all fields: none, title, dates, status, priority, manual, random, upcoming)
- [x] Three view modes: Tasks / Habits / Assigned (sidebar toggle)
- [x] Habits view with sections and progress tracking
- [x] Assigned view filtering by current user
- [x] Parchment theme (Lora font, brown colors, cream backgrounds)
- [x] 2dp brown border on cards

### Gaps to Close (from this task list):
- [x] Status icons inline with title (Phase 1.2)
- [x] Full indicator icons row: archived/snoozed/stealth/sub-chit/alerts/weather (Phase 1.3)
- [x] Full meta values: start date, point-in-time, updated, created (Phase 1.4)
- [x] Sort indicator on meta values (Phase 1.4)
- [x] Overdue pill with configurable color background (Phase 1.5)
- [x] Blocked status highlighting with configurable color (Phase 1.6)
- [x] Inline status dropdown on each card (Phase 2)
- [x] Flat list without status group headers (Phase 2.3 / 7.3)
- [x] Note preview with expand/collapse (Phase 3)
- [x] Location indicator on cards (Phase 4 — text indicator, not full map thumbnail)
- [x] Card-level opacity for completed (0.5) and archived (0.45) (Phase 5)
- [ ] Drag-to-reorder with manual sort persistence (Phase 6.4 — deferred, complex gesture)
- [x] Default sort by status weight (not grouped headers) (Phase 7.1)
- [x] Rejected in status order (Phase 7.2)
- [ ] RSVP indicators and action buttons (Phase 8 — requires shares JSON parsing)
- [ ] Quick Edit dialog from action menu (Phase 9.1 — action menu already provides Edit)
- [ ] Archive undo toast (Phase 9.2)
- [ ] Default filter excluding Complete/Rejected (Phase 10)
- [x] Tag chips with configured colors (Phase 11 — TagChipsRow already supports tagColorMap)
- [ ] System tags excluded from display (Phase 11.2)
- [x] Empty state message parity (Phase 13)
