# Technical Design: New Chit Zone Prefill

## Overview

This feature updates the "create new chit" flow so that the editor pre-opens specific zones based on which C CAPTN view the user was in when they tapped the FAB. It also adds auto-focus behavior for Notes, Checklists, and Tasks views. The changes span three platforms: web desktop, mobile web (zone-at-a-time mode), and Android app.

## Architecture

The feature touches three independent rendering paths that all need the same logical mapping:

1. **Web Desktop** — `editor-init.js` → `_collapseAllZonesForNewChit()` — all zones rendered, some collapsed
2. **Web Mobile** — `editor-mobile-zones.js` → zone-at-a-time navigation — one zone visible at a time, starting zone determined by source tab
3. **Android App** — `EditorZoneState` → zone-at-a-time Compose navigation — one zone visible at a time, starting zone determined by `sourceTab` nav arg

All three paths already have the concept of a "source tab → zone" mapping. The changes are:
- Update the mapping to match the new spec (Tasks gets Task + Dates, Projects gets Projects + Checklist)
- Add auto-focus/keyboard behavior for Notes and Checklists
- Add due-date pre-selection for Tasks
- Wire up `sourceTab` in Android (currently always `null`)

## Components and Interfaces

### Web Desktop Component: `_collapseAllZonesForNewChit()`

**File:** `src/frontend/js/editor/editor-init.js`

Updated `tabZoneMap` constant:

```javascript
const tabZoneMap = {
  'Calendar':   [['datesSection', 'datesContent']],
  'Checklists': [['checklistSection', 'checklistContent']],
  'Alarms':     [['alertsSection', 'alertsContent']],
  'Projects':   [['projectsSection', 'projectsContent'], ['checklistSection', 'checklistContent']],
  'Tasks':      [['taskSection', 'taskContent'], ['datesSection', 'datesContent']],
  'Notes':      [['notesSection', 'notesContent']],
  'Email':      [['emailSection', 'emailContent']],
  'Indicators': [['healthIndicatorsSection', 'healthIndicatorsContent']],
};
```

New auto-focus logic (appended after zone expansion):

```javascript
// After expanding zones, apply auto-focus based on source tab
setTimeout(function() {
  if (sourceTab === 'Notes') {
    var noteEl = document.getElementById('note');
    if (noteEl) { noteEl.focus(); }
  } else if (sourceTab === 'Checklists') {
    var clInput = document.querySelector('#checklistContent .checklist-new-item input, #checklistContent .cl-add-input');
    if (clInput) { clInput.focus(); }
  } else if (sourceTab === 'Tasks') {
    _dateModeSuppressUnsaved = true;
    _setDateMode('due');
    _dateModeSuppressUnsaved = false;
    var dueField = document.getElementById('due_datetime');
    if (dueField) {
      dueField.classList.add('cwoc-prefill-highlight');
      dueField.addEventListener('focus', function _removePrefill() {
        dueField.classList.remove('cwoc-prefill-highlight');
        dueField.removeEventListener('focus', _removePrefill);
      }, { once: true });
    }
  }
}, 200);
```

### Web Mobile Component: `_mobileTabZoneMap` and `_mobileShowZone()`

**File:** `src/frontend/js/editor/editor-mobile-zones.js`

Updated map:
```javascript
var _mobileTabZoneMap = {
  'Calendar':   'datesSection',
  'Checklists': 'checklistSection',
  'Alarms':     'alertsSection',
  'Projects':   'projectsSection',
  'Tasks':      'taskSection',
  'Notes':      'notesSection',
  'Email':      'emailSection',
  'Indicators': 'healthIndicatorsSection',
};
```

Auto-focus hook in `_mobileShowZone()` — fires once for new chits on initial zone display.

### Android Navigation Interface: `Screen.Editor`

**File:** `android/.../ui/navigation/Screen.kt`

```kotlin
data object Editor : Screen("editor/{chitId}?start={start}&end={end}&sourceTab={sourceTab}") {
    const val NEW_CHIT_ID = "new"
    fun createRoute(chitId: String, sourceTab: String? = null): String {
        val base = "editor/$chitId"
        return if (sourceTab != null) "$base?sourceTab=$sourceTab" else base
    }
    fun createRouteWithPrefill(start: String, end: String) = "editor/new?start=$start&end=$end"
}
```

### Android Editor Interface: `ChitEditorScreen`

**File:** `android/.../ui/screens/editor/ChitEditorScreen.kt`

New parameter:
```kotlin
fun ChitEditorScreen(
    chitId: String,
    sourceTab: String? = null,  // NEW
    onNavigateBack: () -> Unit,
    chitRepository: ChitRepository? = null
)
```

### Android Zone State Interface: `EditorZoneNav.kt`

New constant:
```kotlin
val ZONE_PREFILL_MAP = mapOf(
    "Calendar" to listOf("datesSection"),
    "Checklists" to listOf("checklistSection"),
    "Notes" to listOf("notesSection"),
    "Tasks" to listOf("taskSection", "datesSection"),
    "Projects" to listOf("projectsSection", "checklistSection"),
    "Alarms" to listOf("alertsSection"),
    "Indicators" to listOf("healthIndicatorsSection")
)
```

### CSS Interface: `.cwoc-prefill-highlight`

**File:** `src/frontend/css/shared/shared-editor.css`

```css
.cwoc-prefill-highlight {
  outline: 2px solid #8b5a2b;
  outline-offset: 2px;
  border-radius: 4px;
  animation: cwoc-prefill-pulse 1.5s ease-in-out 2;
}
@keyframes cwoc-prefill-pulse {
  0%, 100% { outline-color: #8b5a2b; }
  50% { outline-color: #d4a574; }
}
```

## Data Models

No new database columns, API endpoints, or persistent data structures are required. All state is transient:

- **Web:** `localStorage['cwoc_source_tab']` (already exists, string value like "Calendar", "Tasks", etc.)
- **Android:** Navigation argument `sourceTab` (nullable String, passed via URL query param in nav route)

### Zone Prefill Map (shared logical model across all platforms)

| Source View | Zones Opened | Auto-Focus Target |
|---|---|---|
| Calendar | datesSection | Title field |
| Checklists | checklistSection | First checklist input |
| Notes | notesSection | Notes textarea |
| Tasks | taskSection, datesSection | Title field (due date highlighted) |
| Projects | projectsSection, checklistSection | Title field |
| Alarms | alertsSection | Title field |
| Indicators | healthIndicatorsSection | Title field |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ WEB DESKTOP                                                      │
│                                                                   │
│ FAB click → storePreviousState() → localStorage['cwoc_source_tab']│
│          → navigate to editor.html                                │
│                                                                   │
│ Editor init → _collapseAllZonesForNewChit()                       │
│            → read localStorage['cwoc_source_tab']                 │
│            → expand zones per tabZoneMap                           │
│            → auto-focus per sourceTab                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ WEB MOBILE (zone-at-a-time)                                      │
│                                                                   │
│ FAB click → storePreviousState() → localStorage['cwoc_source_tab']│
│          → navigate to editor.html                                │
│                                                                   │
│ Editor init → _activateMobileZoneMode()                           │
│            → _getInitialZoneIndex() reads source tab              │
│            → _mobileShowZone(idx) shows starting zone             │
│            → auto-focus if Notes/Checklists                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ANDROID APP                                                       │
│                                                                   │
│ FAB tap → navigate("editor/new?sourceTab=Tasks")                  │
│                                                                   │
│ CwocNavGraph → extract sourceTab from args                        │
│             → ChitEditorScreen(sourceTab = "Tasks")               │
│             → rememberEditorZoneState(sourceTab = "Tasks")        │
│             → getStartingZoneIndex() → taskSection index          │
│             → LaunchedEffect auto-focus / highlight               │
│             → buildOverviewRows() includes prefill zones          │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling

- If `localStorage['cwoc_source_tab']` is unreadable (private browsing, storage full), fall back to "Calendar" mapping
- If the Android `sourceTab` nav arg is null, empty, or unrecognized, fall back to "Calendar" mapping (datesSection)
- If `document.getElementById('note')` or checklist input is null when auto-focus fires, silently skip (no error shown)
- If `FocusRequester.requestFocus()` throws on Android (component not yet composed), catch and ignore
- If `_setDateMode('due')` fails (function not loaded yet), the dates zone still opens but without the due mode pre-set

## Correctness Properties

### Property 1: New Chit Only
The zone prefill map is applied ONLY for new chits (`window.isNewChit === true` on web, `formState.isNew` on Android). Existing chits opened for editing are unaffected.
**Validates: Requirements 2, 3, 7**

### Property 2: Single Auto-Focus
Auto-focus fires exactly once per editor session (guarded by `_mobileAutoFocusDone` flag on mobile web, `LaunchedEffect` key on Android).
**Validates: Requirements 4, 5**

### Property 3: Highlight Cleanup
The `.cwoc-prefill-highlight` class is removed on first focus event, preventing it from persisting after user interaction.
**Validates: Requirements 6**

### Property 4: Manual Override Preserved
Zone collapse/expand behavior for non-prefill zones remains unchanged — users can still manually expand any collapsed zone.
**Validates: Requirements 3**

## Testing Strategy

Manual verification on all three platforms:
1. From each C CAPTN view, tap FAB → verify correct zones open
2. From Notes view → verify cursor is in notes field and keyboard opens (mobile/Android)
3. From Checklists view → verify cursor is in first checklist input and keyboard opens
4. From Tasks view → verify Task + Dates zones open, due date field highlighted, no value pre-filled
5. From Projects view → verify Projects + Checklist zones open
6. Open an existing chit → verify no prefill behavior occurs
7. From a non-C CAPTN view (Settings, People) → verify Calendar/Dates mapping is used as fallback

## Files Modified

| File | Change |
|------|--------|
| `src/frontend/js/editor/editor-init.js` | Update `tabZoneMap`, add auto-focus logic |
| `src/frontend/js/editor/editor-mobile-zones.js` | Update `_mobileTabZoneMap`, add auto-focus in `_mobileShowZone` |
| `src/frontend/css/shared/shared-editor.css` | Add `.cwoc-prefill-highlight` class |
| `android/.../ui/navigation/Screen.kt` | Add `sourceTab` param to Editor route |
| `android/.../ui/navigation/CwocNavGraph.kt` | Extract `sourceTab` arg, pass to editor |
| `android/.../MainActivity.kt` | Pass `selectedTab.label` to editor nav |
| `android/.../ui/screens/editor/ChitEditorScreen.kt` | Accept `sourceTab`, wire focus |
| `android/.../ui/screens/editor/EditorZoneState.kt` | Update `buildOverviewRows` for prefill |
| `android/.../ui/screens/editor/zones/EditorZoneNav.kt` | Update `SOURCE_TAB_ZONE_MAP`, add `ZONE_PREFILL_MAP` |
