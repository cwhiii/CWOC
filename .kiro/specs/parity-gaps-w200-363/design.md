# Design: Parity Gaps W200-W363

## Architecture Overview

All implementations follow the existing Android architecture:
- **ViewModel** — State management, business logic, API calls
- **Composable** — UI rendering from ViewModel state
- **Repository** — Data access (Room + API)
- **Domain** — Pure business logic utilities

No new Room entities are needed. Data flows through existing `SettingsEntity`, `ChitEntity`, and API calls.

---

## REQ-1: Default Notifications on Date Mode

### Location
- `ui/screens/editor/ChitEditorViewModel.kt` — Add `_defaultNotifsApplied` tracking
- `ui/screens/editor/zones/DateZone.kt` — Trigger on date mode change

### Design
- Add `defaultNotifsAppliedForStart` and `defaultNotifsAppliedForDue` booleans to ViewModel
- When `isNew == true` and date mode changes, check settings for `default_notifications`
- Parse the JSON array from settings, add to `formState.alerts` if currently empty
- Set the applied flag to prevent re-triggering
- Expand alerts zone by setting its `isExpanded` state to true

### Data Flow
```
DateZone date mode change → ViewModel.onDateModeChanged(mode) →
  if (isNew && !applied[mode] && alerts.isEmpty()) →
    read settings.default_notifications[mode] →
    update formState.alerts → set applied[mode] = true
```

---

## REQ-2: Omni View Filter Lock System

### Location
- `ui/viewmodel/FilterSortViewModel.kt` — Add locked filter state and persistence
- `ui/viewmodel/SidebarStateViewModel.kt` — Add Omni lock button visibility
- `ui/navigation/FilterSortPanel.kt` — Add Lock button UI
- `data/repository/SettingsRepository.kt` — Read/write `omni_locked_filters`

### Design
- Add `omniLockedFilters: StateFlow<OmniLockedFilters?>` to FilterSortViewModel
- `OmniLockedFilters` data class: statuses, tags, priorities, people, text
- On Omni tab entry: `applyOmniLockedFilters()` reads from settings, applies to filter state
- Lock button: gathers current filter state, serializes to JSON, saves via settings API
- Locked indicator: show 🔒 chip in filter panel header when locked filters are active
- On tab exit: hide lock button, clear indicator

### API
- Read: `settings.omni_locked_filters` (JSON string in settings entity)
- Write: POST /api/settings with `omni_locked_filters` field

---

## REQ-3: Email Add-to-Bundle

### Location
- `ui/screens/email/EmailListScreen.kt` or `ui/screens/editor/ChitEditorScreen.kt` — Action trigger
- `ui/components/AddToBundleSheet.kt` (new) — ModalBottomSheet UI
- `ui/screens/email/EmailViewModel.kt` — Business logic

### Design
- `AddToBundleSheet` composable: shows email info, radio group (sender/subject), bundle dropdown, Cancel/Add buttons
- Bundles loaded from `settings.bundles` (already cached in SettingsRepository)
- On confirm: POST `/api/bundles/{id}/add-rule` with `{ match_type, match_value }`
- On success: update chit tags (strip old `CWOC_System/Bundle/*`, add new one), persist via ChitRepository

### Data Classes
```kotlin
data class AddToBundleState(
    val matchType: MatchType = MatchType.SENDER,
    val selectedBundleId: String? = null,
    val bundles: List<Bundle> = emptyList()
)
enum class MatchType { SENDER, SUBJECT }
```

---

## REQ-4: Combine Alerts Toggle

### Location
- `ui/screens/settings/tabs/ViewsSettingsTab.kt` — Toggle UI
- `ui/screens/settings/SettingsViewModel.kt` — State management

### Design
- Add `combineAlerts` boolean to settings form state
- Render as a standard Switch in the alerts section of Views tab
- When toggled, show/hide the individual alert type rows vs combined row
- Persists via normal settings save flow

---

## REQ-5: Badge Custom Detector Modal

### Location
- `ui/screens/settings/tabs/BadgesSettingsTab.kt` — Existing badges tab
- `ui/screens/settings/components/CustomDetectorDialog.kt` (new) — Dialog UI

### Design
- `CustomDetectorDialog` composable with fields: name, category dropdown, keywords text field, regex text field, URL template text field, label dropdown
- Validation: name required, regex must be valid (try `Regex(pattern)`), URL must contain `{code}`
- Error messages shown below invalid fields
- On save: update `_badgesConfig.customDetectors` list, serialize to JSON, mark settings dirty
- Edit mode: pre-populate fields from existing detector

### Data Class
```kotlin
data class CustomDetector(
    val id: String,
    val name: String,
    val category: String,
    val keywords: List<String>,
    val regex: String,
    val url: String,
    val label: String,
    val icon: String = "/static/tracking/order.svg",
    val priority: Int = 50,
    val enabled: Boolean = true
)
```

---

## REQ-6: Custom Objects Zone Management

### Location
- `ui/screens/editor/zones/CustomZonesSection.kt` (new) — Zone rendering
- `ui/screens/editor/ChitEditorViewModel.kt` — Data loading and gathering
- `domain/customzones/CustomZoneEvaluator.kt` (new) — Conditional display logic

### Design
- On editor load, ViewModel fetches GET /api/custom-zones and GET /api/custom-objects/zone/{id} for each
- Evaluates `conditional_display` rules (reuse logic from HealthIndicatorsZone)
- Renders each zone as a collapsible `EditorZoneHeader` + content
- Fields grouped by `sub_type`, sorted alphabetically
- Field types: Checkbox (boolean), OutlinedTextField (string), OutlinedTextField with number keyboard (numeric)
- Range highlighting: tint field background red/blue when value exceeds range_min/range_max
- Values stored in `formState.healthData` map (UUID → value), merged on save

### Data Flow
```
Editor init → ViewModel.loadCustomZones() →
  GET /api/custom-zones → for each zone: GET /api/custom-objects/zone/{id} →
  filter by conditional_display → store in customZonesState →
  Compose renders CustomZonesSection from state
```

---

## REQ-7: Attachments Multi-Select & Bulk Delete

### Location
- `ui/screens/editor/zones/AttachmentsZone.kt` — Multi-select mode
- `ui/screens/editor/ChitEditorViewModel.kt` or dedicated ViewModel — Selection state

### Design
- Long-press on attachment card enters multi-select mode
- `isMultiSelectMode: MutableState<Boolean>` + `selectedIndices: MutableState<Set<Int>>`
- In multi-select mode: show checkboxes, top bar with count + delete button
- Tap toggles selection, no range-select needed on mobile (web Shift-click doesn't translate)
- Bulk delete: confirm via `CwocConfirmDialog`, call DELETE /api/attachments/bulk with items array
- Exit mode on back press or after successful delete

---

## REQ-8: Password Management

### Location
- `ui/screens/settings/tabs/AdminSettingsTab.kt` — User list with reset button
- `ui/screens/settings/SettingsViewModel.kt` — API call

### Design
- In admin tab user list, add "Reset Password" icon button per user row
- Shows `CwocPromptDialog` with title "Reset Password for {username}", password input
- On confirm: PUT `/api/users/{id}/reset-password` with `{ new_password }`
- Show success toast or error message
- Only visible when `isAdmin == true`

---

## REQ-9: Recent Tags

### Location
- `domain/tags/RecentTagsManager.kt` (new) — Tracking logic
- `ui/components/TagsPickerSheet.kt` — Recent tags UI
- `data/repository/SettingsRepository.kt` — Persistence

### Design
- `RecentTagsManager` singleton (or ViewModel-scoped): maintains MRU list of 5 tags
- Loads from `settings.recent_tags` on first access
- `trackTag(path)`: moves to front, caps at 5, debounced save (1s delay)
- `getRecentTags()`: returns current list
- Save: updates `recent_tags` field in settings via SettingsRepository
- UI: horizontal chip row labeled "Recent" above the tag tree in TagsPickerSheet
- Tapping a recent chip calls the existing `onTagSelected` callback

---

## REQ-10: RSVP Status Utilities

### Location
- `domain/sharing/RsvpUtils.kt` (new) — Pure utility functions
- `ui/screens/` various — Usage in views

### Design
```kotlin
object RsvpUtils {
    fun getUserRsvpStatus(chit: ChitEntity, currentUserId: String): String? {
        val shares = chit.parsedShares() // parse JSON shares array
        return shares.find { it.userId == currentUserId }?.rsvpStatus ?: "invited"
    }
    
    fun isDeclinedByCurrentUser(chit: ChitEntity, currentUserId: String): Boolean {
        if (chit.ownerId == currentUserId) return false
        return getUserRsvpStatus(chit, currentUserId) == "declined"
    }
}
```
- Views can use this to dim/filter declined chits
- ChitEntity needs `shares` field parsed (may already exist as JSON string)

---

## REQ-11: Project Quick Menu & Move Child

### Location
- `ui/screens/projects/ProjectsScreen.kt` — Context menu trigger
- `ui/screens/projects/ProjectContextMenu.kt` (new) — Menu composable
- `ui/screens/projects/ProjectsViewModel.kt` — Actions

### Design
- Long-press on project card → show `DropdownMenu` with actions
- Actions: Create New Child (prompt title → create chit → add to project), Open in Editor (navigate), Pin/Unpin (PATCH), Archive/Unarchive (PATCH), Snooze (show duration picker)
- Snooze durations: 1h, 1d, 1w, 2w, 1mo (same as web)
- Move child: on child card, add "Move to Project" menu item → shows project picker → calls ViewModel.moveChildToProject(childId, targetProjectId)
- ViewModel: removes from current project's child_chits, adds to target, saves both chits

---

## REQ-12: Week View Day Offset

### Location
- `ui/screens/calendar/CalendarViewModel.kt` — Offset state
- `ui/screens/calendar/CalendarTimeGrid.kt` — Prev/next buttons

### Design
- Add `weekViewDayOffset: MutableState<Int>` to CalendarViewModel
- Calculate `visibleDayCount` based on screen width (use `LocalConfiguration.current.screenWidthDp`)
- If `visibleDayCount < totalDays`: show prev/next buttons in header, slice days by offset
- Prev: `offset = max(0, offset - visibleDayCount)`
- Next: `offset = min(totalDays - visibleDayCount, offset + visibleDayCount)`
- Reset to 0 on: period change, view mode change, goToToday

---

## REQ-13: Checklist Clipboard Operations

### Location
- `ui/screens/editor/zones/ChecklistZoneV2.kt` — Toolbar buttons
- `ui/screens/editor/zones/ChecklistZoneViewModel.kt` — Logic
- `domain/checklist/ChecklistClipboard.kt` (new) — Parsing logic

### Design
- Add "📋 Paste" and "📋 Copy Incomplete" buttons to checklist zone toolbar
- **Paste logic** (`ChecklistClipboard.parseClipboardText(text)`):
  - Split by newline
  - Detect indent: tabs or 4-space blocks
  - Detect markdown checklist: `- [x]`, `- [ ]`, `* [x]`, `* [ ]`
  - Strip list markers (`-`, `*`, `•`, numbered)
  - Build items with id, text, level, checked
  - Assign parents based on indent levels
- **Copy logic**: filter unchecked items, format as `"  ".repeat(level) + "- [ ] " + text`, join with newlines
- Undo: snapshot items before paste, push to undo stack
- Use Android `ClipboardManager` for read/write

---

## REQ-14: Cron Expression Functions

### Location
- `domain/cron/CronUtils.kt` (new) — Pure utility functions

### Design
```kotlin
object CronUtils {
    fun describe(expr: String): String { /* pattern matching → human text */ }
    fun assemble(minute: String, hour: String, dom: String, month: String, dow: String): String
    fun validate(expr: String): Boolean { /* 5 fields, valid chars */ }
}
```
- `describe`: Match common patterns (every minute, step, daily at time, weekdays, weekends, first of month, specific day). 12-hour AM/PM formatting. Fallback: "Cron: {expr}"
- `validate`: 5 space-separated fields, each matching `[0-9*-/,A-Za-z]+`
- Used by rule editor screen (if exists) or future cron-based features

---

## REQ-15: Weather Functions

### Location
- `ui/screens/weather/WeatherScreen.kt` — Existing weather screen
- `ui/screens/weather/WeatherViewModel.kt` — Logic
- `ui/components/ReorderableList.kt` — Existing drag component

### Design
- **Extreme weather**: Add `isExtreme(highC)` check, apply visual indicator (red tint/border) on day blocks where `highC > 5`
- **Day block click**: On tap of a weather day cell, navigate to calendar with day view for that date. Use `navController.navigate(Screen.Calendar.createRoute(date, viewMode=DAY))`
- **Drag reorder**: Wrap location rows in existing `ReorderableList` pattern. On reorder complete, update the location order in settings and persist via SettingsRepository

---

## Shared Patterns

### Error Handling
All API calls use try/catch with:
- Toast on error: `UndoToast` or snackbar with error message
- Loading states where appropriate (skeleton/shimmer for custom zones)

### State Management
- All mutable state in ViewModels as `StateFlow` or `MutableState`
- Compose observes state reactively
- No direct DOM manipulation (Compose handles re-rendering)

### Navigation
- Use existing `navController.navigate()` patterns
- Deep links where applicable (weather → calendar day view)
