# Phase 2: Tab Sub-Modes

## Problem
Several tabs are missing their sub-mode toggles that exist on the web. Users can't switch between different views within a tab.

## Tasks

### 2.1 Tasks Tab — Add Habits Sub-Mode
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/TasksScreen.kt`

The web Tasks tab has a 3-way toggle: Tasks | Habits | Assigned.

**Add a FilterChip row** at the top of TasksScreen (same pattern as AlertsScreen's list/independent toggle):
- **Tasks** (default): Current behavior — grouped by status (ToDo, In Progress, Blocked, Complete)
- **Habits**: Shows only chits where `habit = true`, rendered as habit cards with:
  - Habit name (title)
  - Progress bar (habitSuccess / habitGoal)
  - Streak count (calculated from habitLastActionDate + habitResetPeriod)
  - Reset period display
  - Grouped into: "On Deck" (reset period expired, ready to act), "Out of Mind" (reset period active), "Accomplished" (goal met)
- **Assigned**: Shows only chits where `assignedTo` matches the current user's username

**Web reference:** `src/frontend/js/dashboard/main-views-tasks.js` (`_setTasksMode`), `src/frontend/js/dashboard/main-views-habits.js` (`displayHabitsView`)

### 2.2 Alarms Tab — Add Notifications & Reminders Sub-Modes
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/alerts/AlertsScreen.kt`

Currently has List | Independent. Web has 4 modes: List | Independent | Notifications | Reminders.

**Add two more FilterChips:**
- **Notifications**: Shows chits that have alerts with `type = "notification"` — these are push-notification-style alerts
- **Reminders**: Shows chits that have alerts with `type = "reminder"` — these are reminder-style alerts (gentler, recurring)

**Web reference:** `src/frontend/js/dashboard/main-views-alarms.js` (`_setAlarmsMode`)

### 2.3 Projects Tab — Add List/Tree View Toggle
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/projects/ProjectsScreen.kt`

Currently only shows Kanban. Web has Kanban | List toggle (though Kanban is the default and list is "permanently hidden but code preserved" per the web code comment).

**Add a FilterChip toggle:** Kanban | List
- **Kanban** (default): Current behavior — expandable project cards with Kanban columns
- **List**: Tree view showing project masters with their children as indented sub-items, no Kanban columns, just a flat hierarchical list with status indicators

**Web reference:** `src/frontend/js/dashboard/main-views-projects.js` (`_setProjectsMode`, `displayProjectsView`)

### 2.4 Indicators — Add Calendar & Log Sub-Modes
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/indicators/IndicatorsScreen.kt`

Currently only shows Charts. Web has Charts | Calendar | Log.

**Add a 3-way pill toggle** (same pattern as web's `cwoc-2val-toggle` but with 3 values):
- **Charts** (default): Current behavior — SVG line charts per indicator
- **Calendar**: Year-view grid (12 months × ~31 days) where each day cell is color-coded based on indicator values for that day. Colors classify days as good/neutral/bad based on thresholds.
- **Log**: Reverse-chronological list of all indicator entries showing: date, indicator type, value, and any notes

**Web reference:** `src/frontend/js/dashboard/main-views-indicators.js` (`_indBuildModeToggleHtml`, `_indicatorsRenderCalendar`, `_indicatorsRenderLog`)

### 2.5 Month View — Add Compress/Scroll Toggle
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarMonthView.kt`

The web month view has a Compress | Scroll toggle:
- **Compress** (default): All events fit into fixed-height day cells (overflow is hidden/truncated)
- **Scroll**: Day cells expand to show all events, the entire month scrolls vertically

**Add a small toggle** (FilterChip or pill) above the month grid when in Month view mode.

**Web reference:** `src/frontend/js/dashboard/main-calendar.js` (`_monthViewMode`, `_initMonthModePill`)

## Verification
After this phase:
- [ ] Tasks tab shows Tasks | Habits | Assigned toggle chips
- [ ] Habits mode shows habit cards grouped into On Deck / Out of Mind / Accomplished
- [ ] Assigned mode shows only chits assigned to current user
- [ ] Alarms tab shows List | Independent | Notifications | Reminders toggle chips
- [ ] Projects tab shows Kanban | List toggle
- [ ] List mode shows hierarchical tree of projects + children
- [ ] Indicators shows Charts | Calendar | Log toggle
- [ ] Calendar mode shows year grid with colored days
- [ ] Log mode shows reverse-chronological entry list
- [ ] Month view shows Compress | Scroll toggle when active
