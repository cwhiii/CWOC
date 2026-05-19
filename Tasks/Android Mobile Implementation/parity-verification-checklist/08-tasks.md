# Tasks (all 3 sub-modes: Tasks, Habits, Assigned)

**Category:** Dashboard Views
**Item #:** 8
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

---

### Tab-Level Entry Point

- [ ] Tasks tab button (index.html) — `<div class="tab" onclick="filterChits('Tasks')">` with tasks.png icon
- [ ] filterChits('Tasks') — sets currentTab, updates favicon, restores sort prefs, shows section-tasks-mode, applies custom view filters, calls displayChits()
- [ ] displayChits() — applies all filters (search, multi-select, archive, snooze, past-due, complete, declined, habits, email), applies sort, pins to top, then dispatches to displayTasksView()
- [ ] _updateFavicon('Tasks') — sets favicon to /static/tasks.png
- [ ] _updateUrlHash() — updates URL hash to #tasks, #tasks/habits, or #tasks/assigned
- [ ] _parseUrlHash() — parses URL hash on load to restore tab + mode
- [ ] _restoreViewModeButtons() — restores active styling on tasks-mode-tasks/habits/assigned buttons
- [ ] Hotkey 'T' (in Tasks tab mode panel) — calls _setTasksMode('tasks')
- [ ] Hotkey 'H' (in Tasks tab mode panel) — calls _setTasksMode('habits')
- [ ] Hotkey 'A' (in Tasks tab mode panel) — calls _setTasksMode('assigned')

---

### Sub-Mode Toggle (Tasks / Habits / Assigned)

- [ ] _setTasksMode(mode) — switches between 'tasks', 'habits', and 'assigned' sub-modes
- [ ] Tasks mode button (id="tasks-mode-tasks") — "📋 Tasks", calls _setTasksMode('tasks')
- [ ] Habits mode button (id="tasks-mode-habits") — "🎯 Habits", calls _setTasksMode('habits')
- [ ] Assigned mode button (id="tasks-mode-assigned") — "📌 Assigned", calls _setTasksMode('assigned')
- [ ] Active button styling — background:ivory, color:#3b1f0a on selected mode
- [ ] Mode persisted to localStorage key 'cwoc_tasksViewMode'
- [ ] Mode restored from localStorage on page load (default: 'tasks')
- [ ] URL hash updates on mode change (#tasks/habits, #tasks/assigned)
- [ ] Habits window wrap (id="habits-window-wrap") shown/hidden based on mode
- [ ] Section container (id="section-tasks-mode") — shown only when Tasks tab active

---

### Sidebar Controls (Tasks-Specific)

#### Habits Success Window (visible only in Habits mode)
- [ ] Container div (id="habits-window-wrap") — display:none by default, shown in habits mode
- [ ] Success Window dropdown (id="habits-success-window-sidebar") — options: 7, 30, 90, all
- [ ] onchange handler calls _onHabitsWindowChange(this.value)
- [ ] _onHabitsWindowChange(newVal) — updates settings cache, persists to backend via POST /api/settings, re-renders
- [ ] _initHabitsWindowDropdown() — initializes dropdown value from cached settings on load

#### Rule Habits Checkbox
- [ ] Checkbox (id="habits-include-rules-cb") — "Include in success rate"
- [ ] onchange handler calls _onHabitsIncludeRulesChange(this.checked)
- [ ] _onHabitsIncludeRulesChange(checked) — stores in localStorage 'cwoc_habits_include_rules', re-renders

#### Sort Controls (shared across all views)
- [ ] Sort dropdown (id="sort-select") — None, Title, Start Date, Due Date, Updated, Created, Status, Manual, Random/Shuffle, Upcoming
- [ ] Sort direction button (id="sort-dir-btn") — toggles ▲/▼ (asc/desc)
- [ ] onSortSelectChange() — sets currentSortField, resets dir to asc, calls displayChits()
- [ ] toggleSortDir() — flips currentSortDir, calls displayChits()
- [ ] _updateSortUI() — shows/hides direction button, updates arrow text
- [ ] _pickSort(field) — sets sort field directly (from hotkey)
- [ ] saveSortPreference(tab, field, dir) — persists sort per tab
- [ ] getSortPreference(tab) — retrieves saved sort for tab

#### Filter Controls (shared across all views, apply to Tasks)
- [ ] Search input (id="search") — text filter, onkeyup calls searchChits()
- [ ] searchChits() — calls displayChits() to re-filter
- [ ] Status multi-select (id="status-multi") — Any, ToDo, In Progress, Blocked, Complete, Rejected
- [ ] Priority multi-select (id="priority-multi") — Any, Low, Medium, High
- [ ] Tag/Label filter panel (id="label-multi") — tag tree with search, favorites first
- [ ] People filter panel (id="people-multi") — chip-based contact/user filter
- [ ] Project filter dropdown (id="project-filter-select") — filter by parent project
- [ ] Display toggles:
  - [ ] Show Pinned (id="show-pinned") — checked by default
  - [ ] Show Archived (id="show-archived") — unchecked by default
  - [ ] Show Snoozed (id="show-snoozed") — unchecked by default
  - [ ] Show Unmarked (id="show-unmarked") — checked by default
  - [ ] Show Past-Due (id="show-past-due") — checked by default
  - [ ] Show Complete (id="show-complete") — checked by default
  - [ ] Show Declined (id="show-declined") — checked by default
  - [ ] Show Habits (id="show-habits") — checked by default
- [ ] Sharing filters:
  - [ ] Shared with me (id="filter-shared-with-me")
  - [ ] Shared by me (id="filter-shared-by-me")
- [ ] Highlight toggles:
  - [ ] Highlight overdue (id="highlight-overdue") — checked by default
  - [ ] Highlight blocked (id="highlight-blocked") — checked by default
- [ ] onFilterChange() — calls displayChits() and _updateClearFiltersButton()
- [ ] onFilterAnyToggle(anyCb) — unchecks specific options when "Any" checked
- [ ] onFilterSpecificToggle(filterType) — unchecks "Any" when specific option checked
- [ ] clearFilterGroup(containerId) — clears all checkboxes in a filter group
- [ ] _clearAllFilters() — resets all filters to defaults or custom view defaults
- [ ] _applySystemDefaults() — resets all sidebar filters to hardcoded baseline
- [ ] _applyFilterStateToSidebar(state) — applies saved filter state object
- [ ] _applyCustomViewFilters(tab) — applies custom view filters on tab entry
- [ ] _resetDefaultFilters() — resets to default filter for current tab
- [ ] _updateClearFiltersButton() — shows/hides "Reset Defaults" button
- [ ] _filterTagCheckboxes() — filters tag list by search query
- [ ] _buildTagFilterPanel() — builds tag filter with search, favorites, colors
- [ ] _syncSidebarTagCheckboxes() — syncs hidden checkboxes with tag selection
- [ ] _buildPeopleFilterPanel() — fetches contacts/users, renders chip filter
- [ ] _renderPeopleFilterPanel(contacts) — renders people chips into sidebar
- [ ] clearPeopleFilter() — clears people filter selection
- [ ] _populateProjectFilter() — populates project dropdown from chits
- [ ] _onProjectFilterChange() — triggers filter change on project selection
- [ ] _clearProjectFilter(silent) — clears project filter
- [ ] _getSelectedStatuses() — returns checked status values
- [ ] _getSelectedLabels() — returns selected tag names
- [ ] _getSelectedPriorities() — returns checked priority values

---

### Tasks Sub-Mode — displayTasksView(chitsToDisplay)

#### Filtering & Sorting
- [ ] Filter chits to those with status OR due_datetime
- [ ] Default sort by status order: ToDo(1) → In Progress(2) → Blocked(3) → empty(4) → Complete(5) → Rejected(6)
- [ ] Respects currentSortField when set (overrides default)
- [ ] Pinned chits float to top (applied in displayChits before dispatch)

#### Empty State
- [ ] "No tasks found." message with cwoc-empty class
- [ ] "+ Create Chit" button navigating to /editor

#### Task Card Rendering (per chit)
- [ ] Card container: div.chit-card with data-chit-id, draggable=true
- [ ] applyChitColors(chitElement, chitColor(chit)) — applies custom card color
- [ ] chitColor(chit) — returns chit.color or default '#fdf6e3'
- [ ] archived-chit class added when chit.archived
- [ ] completed-task class added when status is Complete or Rejected
- [ ] declined-chit class added when _isDeclinedByCurrentUser(chit) is true

#### Card Header (_buildChitHeader)
- [ ] _buildChitHeader(chit, titleHtml, viSettings, opts) — builds full header row
- [ ] Header left side (chit-header-left):
  - [ ] Pinned bookmark icon (fas fa-bookmark) when chit.pinned
  - [ ] Archived icon (📦) when chit.archived
  - [ ] Snoozed icon (😴) with tooltip when snoozed_until > now
  - [ ] Timezone warning (⚠️) when chit._tzWarning
  - [ ] Stealth indicator (🥷) visible only to owner when chit.stealth
  - [ ] Sub-chit indicator (fas fa-project-diagram) when chit is child of a project
  - [ ] Visual indicators via _getAllIndicators(chit, settings, 'card')
  - [ ] Weather indicator (chit-weather-indicator) with icon + tooltip (high/low/precip)
  - [ ] Map location icon (fas fa-map-marker-alt) for non-default locations (unless skipMapIcon)
  - [ ] Title span (chit-header-title) with link to editor
  - [ ] Checklist count (checklist-progress-count) — not shown in Tasks (checklistCount: false)
- [ ] Header right side (chit-header-meta):
  - [ ] Status text (hidden in Tasks via hideStatus: true — shown in meta row of other views)
  - [ ] Priority text
  - [ ] Due date — "Past Due: YYYY-Mon-DD" with overdue color background, or "Due: [date]"
  - [ ] Start date — "Start: [date]"
  - [ ] Point-in-time — "📌 [date]"
  - [ ] Modified date — "Updated: [date]"
  - [ ] Created date — "Created: [date]"
  - [ ] Tag color chips (inline-block, colored background, rounded)
  - [ ] RSVP indicators (cwoc-rsvp-indicators) — ✓/✗/⏳ per shared user
  - [ ] RSVP action buttons (cwoc-rsvp-actions) — accept(✓)/decline(✗) for non-owner shared users
  - [ ] RSVP accept click → PATCH /api/chits/:id/rsvp {rsvp_status:'accepted'}, then fetchChits()
  - [ ] RSVP decline click → PATCH /api/chits/:id/rsvp {rsvp_status:'declined'}, then fetchChits()
  - [ ] Shared icon (🔗 cwoc-shared-icon) with tooltip: owner, shared users + roles, your role
  - [ ] Assignee badge (📌 cwoc-assignee-badge) showing assigned_to_display_name

#### Status Controls Row
- [ ] Controls div with flex layout (status + note preview side by side)
- [ ] Status icon span — renders _STATUS_ICONS[chit.status] (circle/spinner/ban/check/times)
- [ ] "Status:" label text
- [ ] Status dropdown (select element) — options: ToDo, In Progress, Blocked, Complete, Rejected
- [ ] _styleStatusDropdown() — styles dropdown based on value:
  - [ ] Blocked: configurable background color (blocked_border_color setting), bold, contrast text
  - [ ] Complete: opacity 0.6
  - [ ] Rejected: color #9E9E9E, opacity 0.6
  - [ ] Others: default styling
- [ ] Blocked option text shows "Blocked ⛓️" when chit._hasIncompletePrereqs
- [ ] Dropdown disabled for viewer-role shared chits (title: "Read-only — shared chit")
- [ ] Status change event handler → PUT /api/chits/:id with updated status, then fetchChits()

#### Note Preview
- [ ] _buildNotePreview(chit) — renders markdown note preview (max 500 chars)
- [ ] Markdown rendering via marked.parse() with breaks:true
- [ ] resolveChitLinks() — resolves internal chit links in markdown
- [ ] Expandable on mobile: "show more…" / "show less" toggle (note-preview-toggle)
- [ ] note-preview-expanded class toggles full content visibility
- [ ] Click on toggle stops propagation (doesn't trigger card click)

#### Map Thumbnail
- [ ] _buildMapThumbnail(chit) — renders OSM map tile for non-default locations
- [ ] _hasNonDefaultLocation(chit) — checks if location differs from user's default
- [ ] Respects show_map_thumbnails user setting
- [ ] _renderMapTile(container, lat, lon) — renders OSM tile image with pin overlay
- [ ] Geocode lookup via getGeocodeCached() or async _geocodeAddress()
- [ ] Placeholder icon while geocoding

#### Event Handlers (per card)
- [ ] dblclick → storePreviousState() then navigate to /editor?id=:id
- [ ] dblclick on .chit-map-thumbnail → navigate to /maps?focus=chit&address=:location
- [ ] click with shiftKey → showQuickEditModal(chit, callback) (if not viewer role)
- [ ] contextmenu (right-click) → _showChitContextMenu(e, chit, callback) (if not viewer role)
- [ ] Long-press on mobile → showQuickEditModal (via enableDragToReorder longPressMap)

#### Drag-to-Reorder
- [ ] enableDragToReorder(tasksContainer, 'Tasks', callback, longPressMap)
- [ ] Builds _tkLongPressMap: chitId → quick-edit callback (skips viewer-role chits)
- [ ] Persists manual sort order to localStorage/backend

---

### Habits Sub-Mode — displayHabitsView(chitsToDisplay)

#### Filtering
- [ ] Filter chits by chit.habit === true (explicit flag, not recurrence_rule presence)
- [ ] Empty state: "No habits yet. Mark a recurring chit as a habit in the editor to start tracking."

#### Rollover Evaluation
- [ ] _evaluateHabitRollover(chit) — checks if period has advanced, snapshots progress, resets
- [ ] getCurrentPeriodDate(chit) — calculates current period date based on recurrence freq/interval
- [ ] _getPreviousPeriodDate(chit, currentPeriod) — calculates previous period date
- [ ] _persistHabitRollover(chit) — PATCH /api/chits/:id/fields with rollover data (async, non-blocking)
- [ ] Rollover snapshots habit_success/habit_goal into recurrence_exceptions array
- [ ] Resets habit_success to 0 and clears Complete status after rollover

#### Habit Data Computation (per habit chit)
- [ ] goal = chit.habit_goal || 1
- [ ] success = chit.habit_success || 0
- [ ] isCompleted = success >= goal
- [ ] Success rate calculation from recurrence_exceptions snapshots + current period
- [ ] Window filter applied (habits_success_window setting: 7, 30, 90, or 'all')
- [ ] metCount = periods where habit_success >= habit_goal
- [ ] successRate = round((metCount / windowEntries.length) * 100)
- [ ] Streak = consecutive met periods walking backward from most recent

#### Section Organization
- [ ] _renderHabitCards(container, habitData, windowDays) — renders all habit cards
- [ ] Three sections: On Deck, Out of Mind, Accomplished
- [ ] On Deck: incomplete habits not in reset cooldown
- [ ] Out of Mind: habits with active reset period (acted within cooldown, not yet complete)
- [ ] Accomplished: habits where success >= goal (isCompleted)
- [ ] On Deck sorted by _habitUrgencyScore (lower = more urgent, needs action sooner)
- [ ] _habitUrgencyScore(h) — calculates days until next action needed
- [ ] Section headers with icons: "🔜 On Deck", "😌 Out of Mind", "✅ Accomplished"

#### Reset Period Logic
- [ ] _isResetPeriodActive(chit) — checks if user acted within the reset cooldown period
- [ ] Parses "N:UNIT" format (e.g., "3:DAILY") or legacy "DAILY"
- [ ] Calculates reset end date: lastAction + N units
- [ ] _getResetEndDate(chit) — returns formatted date when reset expires (e.g., "Apr 28")
- [ ] _getTodayISO() — returns today as YYYY-MM-DD string

#### Habit Card Rendering (per habit)
- [ ] Card container: div.habit-card with data-chit-id
- [ ] habit-done class when completed
- [ ] habit-resting class when in Out of Mind
- [ ] applyChitColors applied to card

#### Card Header (habit-header)
- [ ] Checkbox (input type="checkbox") for goal=1 habits
  - [ ] Checked state reflects isCompleted
  - [ ] Disabled during active reset period (opacity 0.4, tooltip: "Reset period active")
  - [ ] change handler: sets habit_success to 1 or 0, updates status, sets habit_last_action_date
  - [ ] Calls _optimisticHabitCardUpdate then _persistHabitUpdate
- [ ] Title link (a href="/editor?id=:id") — click navigates to editor with storePreviousState
- [ ] Period label via _formatCurrentPeriodLabel(chit) — e.g., "Week of Apr 28", "May 2026"
- [ ] Separator dot (habit-separator: " · ")
- [ ] Frequency span (habit-frequency)
- [ ] Complete line (habit-complete-line): "✅ Complete for this cycle. (Next cycle starts [date].)"
- [ ] Resting line (habit-resting-line): "☐ Too soon to complete again. Resets on [date]."

#### Counter Buttons (goal > 1 habits)
- [ ] Minus button (habit-counter-btn "−") — decrements habit_success
  - [ ] Click handler: stops propagation, decrements, updates status if needed
  - [ ] Calls _optimisticHabitCardUpdate then _persistHabitUpdate
- [ ] Progress span (habit-progress) — "X / Y each [Day/Week/Month/Year]"
- [ ] Plus button (habit-counter-btn "+") — increments habit_success
  - [ ] Disabled during active reset period (opacity 0.4, cursor: not-allowed)
  - [ ] Click handler: stops propagation, increments, sets Complete if goal met
  - [ ] Sets habit_last_action_date to today
  - [ ] Calls _optimisticHabitCardUpdate then _persistHabitUpdate
  - [ ] Capped at goal (won't exceed)

#### Metrics Row (habit-metrics)
- [ ] Progress box (habit-metric-box):
  - [ ] Label: "📊 Progress"
  - [ ] Value: "X / Y each [freq]" with counter buttons (if goal > 1)
- [ ] Cycle box (habit-metric-box):
  - [ ] Label: "🎯 Cycle"
  - [ ] Value: percentage badge (habit-cycle-badge) — round((success/goal)*100) + "%"
- [ ] Overall box (habit-metric-box) — hidden if chit.habit_hide_overall:
  - [ ] Label: "📈 Overall"
  - [ ] Value: success rate badge (habit-success-badge) — successRate + "%"
  - [ ] Title tooltip: "Completed X of Y cycles successfully"
- [ ] Streak box (habit-metric-box) — only shown if streak > 0:
  - [ ] Label: "🔥 Streak"
  - [ ] Value: streak count number

#### Note Preview (two-column layout)
- [ ] habit-card-grid layout when chit has a note
- [ ] Left column (habit-card-left): header + metrics
- [ ] Right column (habit-note-preview): simplified markdown rendering
  - [ ] Headers → bold, bold/italic markers, links, bullets, numbered lists
  - [ ] Newlines collapsed to spaces

#### Optimistic UI Updates
- [ ] _optimisticHabitCardUpdate(card, chit, newSuccess, goal) — instant visual feedback
- [ ] Updates progress span text and title
- [ ] Updates cycle badge percentage
- [ ] Updates checkbox checked state (goal=1)
- [ ] Detects completion status change (wasCompleted vs isNowCompleted)
- [ ] Phase 1: 400ms fade-out (opacity → 0)
- [ ] Moves card to correct section (On Deck / Out of Mind / Accomplished)
- [ ] Creates section headers if they don't exist
- [ ] Removes empty On Deck header if no incomplete cards remain
- [ ] Phase 2: 400ms fade-in (opacity → 1 or 0.6 for completed)
- [ ] _updateStatusBadge(card, status) — adds/removes habit-complete-line span

#### Persistence
- [ ] _persistHabitUpdate(chit) — debounced 1-second save via PUT /api/chits/:id
- [ ] _habitUpdateTimers object — stores per-chit timeout IDs
- [ ] _habitPendingChits object — stores latest chit state per ID
- [ ] Clears/resets timer on each click (accumulates rapid clicks)
- [ ] On success: calls fetchChits() to refresh (unless Itinerary view)

#### Event Handlers (per habit card)
- [ ] dblclick → navigate to editor (skips if target is button or checkbox)
- [ ] click with shiftKey → showQuickEditModal(chit, callback)
- [ ] contextmenu (right-click) → _showChitContextMenu(e, chit, callback)
- [ ] enableTouchGesture(card, {onLongPress}) — long-press opens Quick Edit modal

#### Rule Habits Integration
- [ ] _fetchAndRenderRuleHabits(container) — async, fetches rule habits from API
- [ ] fetchHabitRules() — GET /api/rules?habit=true, returns array of rule objects
- [ ] Removes empty message if rule habits exist
- [ ] Creates sub-container (tasks-view class) for rule habit cards
- [ ] _renderHabitRuleCards(container, habitRules) — renders rule habit cards
- [ ] Rule habit section header: "🤖 Rule Habits"
- [ ] Rule habit card (habit-card with data-ruleId):
  - [ ] Robot badge (🤖 habit-rule-badge)
  - [ ] Rule name as link to /frontend/html/rule-editor.html?id=:id
  - [ ] Period label (Daily/Weekly/Monthly/Yearly)
  - [ ] Status badge: "✅ Achieved this period" when achieved
  - [ ] Metrics: Status box (📋 ✅/❌/⏳), Overall box (📈 %), Streak box (🔥)
  - [ ] Click navigates to rule editor
- [ ] _renderAggregateSuccessRate(container, ruleHabits) — combined success rate bar
  - [ ] habits-aggregate-bar at top of container
  - [ ] Combines chit habit rates + rule habit rates
  - [ ] Shows "📊 Combined Success Rate" with percentage

---

### Assigned-to-Me Sub-Mode — displayAssignedToMeView(chitsToDisplay)

#### Filtering
- [ ] Gets current user via getCurrentUser()
- [ ] Filters chits where chit.assigned_to === currentUserId
- [ ] Empty state: "No chits assigned to you." (if no user: "Unable to determine current user.")

#### Sorting
- [ ] Default sort by status order: ToDo(1) → In Progress(2) → Blocked(3) → empty(4) → Complete(5) → Rejected(6)
- [ ] Respects currentSortField when set

#### Card Rendering (same structure as Tasks)
- [ ] Card container: div.chit-card with data-chit-id, draggable=true
- [ ] applyChitColors applied
- [ ] archived-chit, completed-task, declined-chit classes
- [ ] _buildChitHeader with hideStatus:true, skipMapIcon:true
- [ ] Status icon + "Status:" label + dropdown (same as Tasks)
- [ ] Status dropdown options: ToDo, In Progress, Blocked, Complete, Rejected
- [ ] Dropdown disabled for viewer-role shared chits
- [ ] Status change → PUT /api/chits/:id, then fetchChits()
- [ ] Blocked ⛓️ indicator for incomplete prerequisites
- [ ] Note preview (markdown, expandable on mobile)
- [ ] Map thumbnail for non-default locations

#### Event Handlers (per card)
- [ ] dblclick → navigate to editor (or maps if on map thumbnail)
- [ ] click with shiftKey → showQuickEditModal (if not viewer role)
- [ ] contextmenu → _showChitContextMenu (if not viewer role)
- [ ] Long-press on mobile → showQuickEditModal (via enableDragToReorder longPressMap)

#### Drag-to-Reorder
- [ ] enableDragToReorder(container, 'AssignedToMe', callback, longPressMap)
- [ ] Builds _amLongPressMap: chitId → quick-edit callback (skips viewer-role)

---

### Shared Helper Functions (used by all 3 sub-modes)

- [ ] _isViewerRole(chit) — returns true if chit is shared with viewer-only access
- [ ] _isSharedChit(chit) — returns true if chit has effective_role (is shared)
- [ ] _isDeclinedByCurrentUser(chit) — returns true if current user declined this shared chit
- [ ] _getUserRsvpStatus(chit) — returns current user's RSVP status from shares array
- [ ] _emptyState(message) — builds styled empty-state div with "+ Create Chit" button
- [ ] _getTagColor(tagName) — gets tag color from cached settings, fallback to pastel
- [ ] _getTagFontColor(tagName) — gets tag font color from cached settings, fallback to dark brown
- [ ] _buildNotePreview(chit, extraStyle) — builds expandable markdown note preview
- [ ] _buildChitHeader(chit, titleHtml, settings, opts) — builds full header row with all indicators
- [ ] _buildMapThumbnail(chit) — builds OSM map tile thumbnail
- [ ] _buildMapIcon(chit) — builds simple map pin icon for compact views
- [ ] _hasNonDefaultLocation(chit) — checks if location differs from default
- [ ] _renderMapTile(container, lat, lon) — renders OSM tile with pin overlay
- [ ] _renderChitMeta(chit, mode) — legacy meta builder (kept for compatibility)
- [ ] chitColor(chit) — returns chit display color or default cream
- [ ] applyChitColors(element, color) — applies color to card element (shared.js)
- [ ] contrastColorForBg(color) — returns contrasting text color (shared.js)
- [ ] isSystemTag(tag) — checks if tag is a system tag (shared.js)
- [ ] getPastelColor(name) — generates pastel color from string (shared.js)
- [ ] formatDate(date) — formats date for display (shared.js)
- [ ] formatTime(date) — formats time for display (shared.js)
- [ ] resolveChitLinks(html, chits) — resolves internal chit links (shared.js)
- [ ] showQuickEditModal(chit, onRefresh) — opens quick-edit modal (shared.js)
- [ ] _showChitContextMenu(e, chit, onRefresh) — opens right-click context menu (shared.js)
- [ ] enableDragToReorder(container, tab, onReorder, longPressMap) — drag reorder (shared-sort.js)
- [ ] enableTouchGesture(element, callbacks, options) — touch gesture handler (shared-touch.js)
- [ ] storePreviousState() — saves current tab/view for back-navigation (main-init.js)
- [ ] fetchChits() — fetches all chits from API and triggers displayChits() (main-init.js)
- [ ] getCurrentUser() — returns current user object with user_id
- [ ] _STATUS_ICONS — map of status → icon HTML (shared-indicators.js)
- [ ] _getAllIndicators(chit, settings, context) — returns indicator string (shared-indicators.js)
- [ ] _shouldShow(mode, context) — checks if indicator should show in context (shared-indicators.js)

---

### Shared Habits Calculation Functions (shared-habits.js)

- [ ] getCurrentPeriodDate(chit) — returns YYYY-MM-DD of current recurrence period
- [ ] getHabitSuccessRate(chit, windowDays) — calculates success rate (0-100) over window
- [ ] getHabitStreak(chit) — calculates consecutive met periods walking backward
- [ ] _evaluateHabitRollover(chit) — evaluates and performs period rollover (modifies chit in-place)
- [ ] _getPreviousPeriodDate(chit, currentPeriod) — calculates previous period date
- [ ] _persistHabitRollover(chit) — PATCH /api/chits/:id/fields with rollover data
- [ ] _buildHabitCounter(opts) — builds shared counter widget (−/progress/+)
- [ ] _updateCounterDisplay(wrap, success, goal, freqLabel) — updates counter text
- [ ] fetchHabitRules() — GET /api/rules?habit=true
- [ ] _renderHabitRuleCards(container, habitRules) — renders rule-based habit cards
- [ ] _formatCurrentPeriodLabel(chit) — formats period label (editor-habits.js, shared)

---

### Global Variables (Tasks-Related State)

- [ ] _tasksViewMode — current sub-mode: 'tasks' | 'habits' | 'assigned'
- [ ] _habitUpdateTimers — debounce timer map (chitId → timeoutId)
- [ ] _habitPendingChits — pending chit state map (chitId → chit object)
- [ ] currentSortField — active sort field (null for default)
- [ ] currentSortDir — sort direction ('asc' or 'desc')
- [ ] currentTab — active tab name ('Tasks')
- [ ] chits — global array of all fetched chits
- [ ] _cachedTagObjects — cached tag settings for color/font lookups
- [ ] _cwocSettings — cached user settings object
- [ ] _STATUS_ICONS — status → icon HTML mapping
