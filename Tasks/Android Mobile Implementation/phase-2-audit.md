# Phase 2 Audit: Chit Editor + Offline CRUD + Live Sync (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Rules applied:** META-SPEC with Zone/Page/View Completeness Rule. "Partial" is banned. Web = spec.
**Android files read:** ChitEditorScreen.kt, ChitEditorViewModel.kt, ChitMapper.kt, ChitEntity.kt, all 8 zone files, SyncPushEngine.kt, SyncEngine.kt, DirtyTracker.kt, ConnectivityMonitor.kt, WebSocketClient.kt
**Web files read:** editor.html, editor-save.js, editor-people.js, editor-location.js, editor-notes.js, editor-alerts.js, editor-color.js, editor-health.js, editor-dates.js, editor-tags.js, editor_checklists.js, editor_projects.js

---

## 2.1 Chit Editor — Zone-by-Zone Audit

### EDITOR-LEVEL VERDICT: 💀 BROKEN

Per the Zone Completeness Rule: the editor contains multiple broken zones, therefore the entire editor is 💀 BROKEN.

---

### Zone: Title Row

| Item | Web | Android | Status |
|---|---|---|---|
| Title text input | ✅ | ✅ OutlinedTextField | ✅ |
| Pin toggle button (in title row) | ✅ bookmark icon, toggles inline | TopAppBar icon (not in title row) | 💀 |
| Archive hidden input | ✅ | TopAppBar icon | ✅ |
| Recurrence icon 🔁 | ✅ shown when recurring | ✅ TitleMetadataRow | ✅ |
| Owner chip | ✅ shows owner name | ✅ TitleMetadataRow (if ownerDisplayName set) | ✅ |
| Nest thread label pill | ✅ clickable pill | ✅ TitleMetadataRow (static, not clickable) | 💀 |

**Zone verdict: 💀 BROKEN** (nest thread label not clickable, pin not in title row)

---

### Zone: Dates & Times

| Item | Web | Android | Status |
|---|---|---|---|
| Date mode radio: None | ✅ | ✅ | ✅ |
| Date mode radio: Start/End | ✅ | ✅ | ✅ |
| Date mode radio: Due | ✅ | ✅ | ✅ |
| Date mode radio: Point in Time | ✅ | ✅ | ✅ |
| Date mode radio: Perpetual | ✅ | ✅ | ✅ |
| Start date picker | ✅ Flatpickr | ✅ DatePickerDialog | ✅ |
| Start time picker | ✅ custom time picker | ✅ TimePickerDialog | ✅ |
| End date/time | ✅ | ✅ | ✅ |
| Due date/time | ✅ | ✅ | ✅ |
| Due "Complete" checkbox | ✅ inline checkbox that sets status=Complete | ❌ | ❌ MISSING |
| Point in Time "Now" button | ✅ sets to current datetime | ❌ | ❌ MISSING |
| All Day toggle button (in zone header) | ✅ button in zone header actions | ✅ Switch in zone body | 💀 |
| Timezone picker | ✅ searchable dropdown | ✅ searchable list | ✅ |
| Repeat/Recurrence checkbox (in zone header) | ✅ checkbox in dates zone header | Separate RecurrenceZone | 💀 |

**Zone verdict: 💀 BROKEN** (missing Due Complete checkbox, missing Now button, All Day not in header, Repeat not in dates zone header)

---

### Zone: Task (Status/Priority/Severity/Assignee)

| Item | Web | Android | Status |
|---|---|---|---|
| Status dropdown (None/ToDo/InProgress/Blocked/Complete/Rejected) | ✅ | ✅ DropdownField | ✅ |
| Priority dropdown (None/High/Medium/Low) | ✅ | ✅ DropdownField | ✅ |
| Severity dropdown (None/Critical/Major/Normal/Minor) | ✅ | ✅ DropdownField | ✅ |
| Assignee dropdown (from shared users) | ✅ populated from /api/auth/switchable-users | 💀 DropdownField with EMPTY list (sharedUsers never loaded from API) | 💀 |
| Prerequisites (add/remove chit IDs) | ✅ | ✅ PrerequisitesZone | ✅ |
| Auto-Complete Checklist toggle (in task zone header) | ✅ button in zone header | ✅ Switch in main body (not in a zone header) | 💀 |
| Habit toggle (in task zone header) | ✅ button in zone header | Separate HabitsZone with toggle | 💀 |

**Zone verdict: 💀 BROKEN** (Assignee dropdown empty, Auto-Complete and Habit not in zone header buttons)

---

### Zone: Habits

| Item | Web | Android | Status |
|---|---|---|---|
| Habit toggle | ✅ | ✅ Switch | ✅ |
| Goal input | ✅ | ✅ number field | ✅ |
| Success +/- buttons | ✅ | ✅ IconButtons | ✅ |
| Frequency selector (Daily/Weekly/Monthly/Yearly) | ✅ separate from reset period | 💀 FrequencyDropdown reads/writes same field as ResetPeriodDropdown — they conflict | 💀 |
| Reset period (checkbox + value + unit) | ✅ "Reset every N days/weeks/months" | 💀 ResetPeriodDropdown only has daily/weekly/monthly, no interval value | 💀 |
| Show on calendar checkbox | ✅ | ✅ Checkbox | ✅ |
| Show overall % checkbox | ✅ | ✅ (habitHideOverall) | ✅ |
| Completion chart (Canvas) | ✅ | ❌ only text stats | ❌ MISSING |
| Success rate chart (Canvas) | ✅ | ❌ only text stats | ❌ MISSING |
| Streak chart (Canvas) | ✅ | ❌ only text stats | ❌ MISSING |
| History (period-by-period list) | ✅ 2-column period list | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (frequency/reset conflict, no charts, no history)

---

### Zone: Location

| Item | Web | Android | Status |
|---|---|---|---|
| Saved locations dropdown | ✅ populated from settings | ✅ AssistChip + DropdownMenu (from editorSettings.savedLocations) | ✅ |
| Location text input | ✅ with geocoding on blur | ✅ OutlinedTextField (no geocoding) | 💀 |
| Map preview (embedded OSM) | ✅ | ❌ | ❌ MISSING |
| Search button (geocode) | ✅ | ❌ | ❌ MISSING |
| Map button (open in new tab) | ✅ | ✅ AssistChip → geo: intent | ✅ |
| Directions button | ✅ | ✅ AssistChip → navigation intent | ✅ |
| Context button (view in context) | ✅ | ❌ | ❌ MISSING |
| Weather display (fetched for location+date) | ✅ compact weather section | ❌ | ❌ MISSING |
| Timezone suggestion (from geocoded location) | ✅ | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (no geocoding, no map preview, no weather, no search button)

---

### Zone: Tags

| Item | Web | Android | Status |
|---|---|---|---|
| Tag tree picker (hierarchical) | ✅ | ✅ TagsPickerSheet | ✅ |
| Search/filter in picker | ✅ | ✅ | ✅ |
| Favorites row (quick-access) | ✅ | ✅ (in zone + in picker) | ✅ |
| Recent tags row | ✅ | ❌ (no recent tags loaded from settings.recentTags) | ❌ MISSING |
| Create new tag inline | ✅ | ✅ | ✅ |
| Expand/collapse all button | ✅ | ❌ | ❌ MISSING |
| Active tags display (chips with X) | ✅ | ✅ InputChips with X | ✅ |
| Tag color on chips | ✅ | ✅ | ✅ |

**Zone verdict: 💀 BROKEN** (missing recent tags row, missing expand/collapse all)

---

### Zone: Color

| Item | Web | Android | Status |
|---|---|---|---|
| Default swatches (7+ colors) | ✅ | ✅ 15 colors | ✅ |
| Transparent/clear option | ✅ | ✅ Clear chip | ✅ |
| Custom colors row (from settings) | ✅ | ✅ | ✅ |
| Color name display | ✅ | ✅ getColorName() in trailing | ✅ |
| Selected checkmark overlay | ✅ | ✅ | ✅ |

**Zone verdict: ✅ Complete**

---

### Zone: Notes

| Item | Web | Android | Status |
|---|---|---|---|
| Markdown textarea | ✅ auto-grow | ✅ OutlinedTextField (3-12 lines) | ✅ |
| Format toolbar (Bold/Italic/Strike/Link/H1-H3/Lists/Quote/Code/HR) | ✅ wraps selected text | 💀 appends to end, doesn't wrap selection | 💀 |
| Undo/Redo buttons | ✅ | ✅ (stack-based) | ✅ |
| Render toggle (preview) | ✅ | ✅ Edit/Preview toggle | ✅ |
| Full editor modal (expand to full screen) | ✅ | ✅ AlertDialog with large text field | ✅ |
| Live preview mode (side-by-side) | ✅ split pane | 💀 toggle only, not side-by-side | 💀 |
| Copy button | ✅ | ✅ ClipboardManager | ✅ |
| Download button | ✅ downloads .md file | ❌ | ❌ MISSING |
| Send button | ✅ | ✅ Share intent | ✅ |
| To-checklist (move lines to checklist) | ✅ | ❌ | ❌ MISSING |
| [[ ]] chit link autocomplete | ✅ inline dropdown | ❌ | ❌ MISSING |
| Enter key list continuation | ✅ auto-continues bullets/numbers | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (toolbar doesn't wrap selection, no side-by-side preview, no download, no to-checklist, no [[ ]], no list continuation)

---

### Zone: Checklist

| Item | Web | Android | Status |
|---|---|---|---|
| Nested items with indent/outdent | ✅ | ✅ | ✅ |
| Drag-drop reorder | ✅ touch drag | 💀 move up/down buttons only, no drag gesture | 💀 |
| Completed section separator | ✅ | ✅ | ✅ |
| Auto-save toggle (per-chit) | ✅ | ✅ Switch below zone | ✅ |
| Swipe-to-delete | N/A (web uses X button) | ✅ SwipeToDismissBox | ✅ |
| Undo | ✅ | ✅ | ✅ |
| Add item (Enter key in input) | ✅ | ✅ ImeAction.Done | ✅ |

**Zone verdict: 💀 BROKEN** (no drag-drop reorder — only move up/down buttons)

---

### Zone: Alerts

| Item | Web | Android | Status |
|---|---|---|---|
| Notifications (name + datetime + repeat) | ✅ | 💀 "reminder" type, no repeat field, no name field in add form | 💀 |
| Alarms (name + time + recurrence + days) | ✅ time + days of week | 💀 only offset or absolute time, no days-of-week selection | 💀 |
| Timers (name + duration HH:MM:SS + loop) | ✅ | 💀 no duration input, no loop toggle | 💀 |
| Stopwatches (name + running state) | ✅ | ❌ | ❌ MISSING |
| Alert type: 4 types (notification/alarm/timer/stopwatch) | ✅ | 💀 3 types (alarm/timer/reminder) with wrong names | 💀 |
| Default notifications auto-populate | ✅ from settings | ❌ | ❌ MISSING |
| Sound playback on alarm trigger | ✅ in-browser audio | System notification sound only | ✅ (platform-appropriate) |

**Zone verdict: 💀 BROKEN** (wrong type names, missing stopwatch, missing days-of-week, missing duration, missing loop, missing default auto-populate)

---

### Zone: Recurrence

| Item | Web | Android | Status |
|---|---|---|---|
| Preset selector (None/Daily/Weekly/Monthly/Yearly/Custom) | ✅ | ✅ FilterChips | ✅ |
| Custom: frequency dropdown | ✅ | ✅ | ✅ |
| Custom: interval input | ✅ | ✅ | ✅ |
| Custom: by-day checkboxes (Mon-Sun) | ✅ | ✅ FilterChips | ✅ |
| Custom: ends never/until date/after N | ✅ | ✅ until + count | ✅ |
| Human-readable summary | ✅ | ✅ RecurrenceEngine.formatRule | ✅ |
| Exceptions display | ✅ | ✅ read-only list | ✅ |
| Clear button | ✅ | ✅ TextButton | ✅ |

**Zone verdict: ✅ Complete**

---

### Zone: People

| Item | Web | Android | Status |
|---|---|---|---|
| Contact tree (grouped alphabetically) | ✅ full tree with letter groups | 💀 flat autocomplete suggestions only | 💀 |
| System users with role toggles (Viewer/Manager) | ✅ inline pill toggles | ❌ | ❌ MISSING |
| Search/filter in people tree | ✅ | 💀 autocomplete only (≥2 chars), not a browsable tree | 💀 |
| People chips (add/remove) | ✅ | ✅ InputChips with X | ✅ |
| Stealth toggle | ✅ | ✅ Switch | ✅ |
| Assigned-to dropdown (synced with Task zone) | ✅ | 💀 separate Assignee dropdown in Task section, not synced | 💀 |
| Add new contact inline | ✅ free-text entry | ✅ comma/Enter/+ button | ✅ |
| Contact images/colors on chips | ✅ | ❌ plain text chips only | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (no contact tree, no role toggles, no contact images, assignee not synced)

---

### Zone: Projects

| Item | Web | Android | Status |
|---|---|---|---|
| Project Master toggle | ✅ | ✅ Switch | ✅ |
| Add existing chit (picker) | ✅ search + select | 💀 text input for raw chit ID only | 💀 |
| Create new child chit | ✅ creates and adds | ❌ | ❌ MISSING |
| Move to Project dropdown | ✅ | ❌ | ❌ MISSING |
| Remove from project | ✅ | ✅ X on chip | ✅ |
| Kanban board display (status columns) | ✅ full drag-drop board | ❌ only shows chip IDs, no board | ❌ MISSING |
| Child chit cards (title + status + due) | ✅ | ❌ only truncated IDs | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (no chit picker, no create child, no move-to, no Kanban, no card display)

---

### Zone: Health Indicators

| Item | Web | Android | Status |
|---|---|---|---|
| Dynamic custom objects (from settings.visual_indicators) | ✅ structured form per indicator type | 💀 raw JSON text field | 💀 |
| Add/remove indicator entries | ✅ buttons per type | ❌ | ❌ MISSING |
| Indicator type labels from settings | ✅ | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (raw JSON instead of structured UI)

---

### Zone: Email

| Item | Web | Android | Status |
|---|---|---|---|
| From field (autocomplete from accounts) | ✅ | 💀 plain text, no autocomplete from email accounts | 💀 |
| To field (autocomplete from contacts) | ✅ | 💀 plain text, no autocomplete | 💀 |
| CC/BCC fields | ✅ | ✅ text fields | ✅ |
| Subject field | ✅ | ✅ | ✅ |
| Body (markdown with format toolbar) | ✅ | 💀 plain text, no format toolbar | 💀 |
| PGP encrypt toggle | ✅ OpenPGP | ❌ | ❌ MISSING |
| Send button | ✅ triggers server-side send | ❌ | ❌ MISSING |
| Send Later (schedule) | ✅ | ❌ | ❌ MISSING |
| Reply/Forward | ✅ | ❌ | ❌ MISSING |
| Read receipt checkbox | ✅ | ✅ Checkbox | ✅ |
| Email folder/status display | ✅ | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (no autocomplete, no format toolbar on body, no PGP, no send, no reply/forward)

---

### Zone: Attachments

| Item | Web | Android | Status |
|---|---|---|---|
| File list with names/sizes | ✅ | ❌ placeholder text only | ❌ MISSING |
| Upload button | ✅ | ❌ | ❌ MISSING |
| Drag & drop area | ✅ | ❌ (N/A on mobile) | ❌ MISSING |
| Download/open attachment | ✅ | ❌ | ❌ MISSING |
| Delete attachment | ✅ | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (placeholder only, no actual functionality)

---

### Zone: Series Log

| Item | Web | Android | Status |
|---|---|---|---|
| Recurrence instance audit log | ✅ list of dates with changes | 💀 static placeholder text | 💀 |
| Navigate to specific instance | ✅ | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (placeholder text, no actual data)

---

### Header Actions

| Item | Web | Android | Status |
|---|---|---|---|
| Save & Stay | ✅ | ✅ Save icon | ✅ |
| Save & Exit | ✅ | ✅ Check icon | ✅ |
| Exit | ✅ | ✅ Back arrow | ✅ |
| Options menu (Delete/Duplicate/QR/Share) | ✅ 4 actions | 💀 3 actions (no QR) | 💀 |
| Autosave indicator "✅ Saved" | ✅ | ✅ | ✅ |
| Unsaved changes dialog | ✅ Save/Discard/Cancel | ✅ AlertDialog | ✅ |
| Instance banner (editing recurrence instance) | ✅ | ❌ | ❌ MISSING |

**Zone verdict: 💀 BROKEN** (no QR code action, no instance banner)

---

## 2.2 Dirty Tracking

| Item | Web | Android | Status |
|---|---|---|---|
| isDirty computed from form vs saved | N/A (web saves directly) | ✅ combine(_formState, _savedState) | ✅ |
| detectChangedFields (all fields) | N/A | ✅ covers all ChitFormState fields | ✅ |
| markDirty on save | N/A | ✅ dirtyTracker.markDirty | ✅ |
| Set-union dirty fields (no duplicates) | N/A | ✅ | ✅ |

**Verdict: ✅ Complete**

---

## 2.3 Sync Push

| Item | Web | Android | Status |
|---|---|---|---|
| Push on save (if online) | N/A (web is always online) | ✅ syncPushEngine.pushSingle | ✅ |
| Batch push all dirty | N/A | ✅ pushAll() | ✅ |
| Handle accepted/created | N/A | ✅ clearDirty + updateSyncVersion | ✅ |
| Handle merged (conflict) | N/A | ✅ clearDirtyWithMerge + setConflictState | ✅ |
| Handle error (preserve dirty) | N/A | ✅ no clearDirty called | ✅ |
| All fields in push DTO | N/A | ✅ toPushDto() maps everything | ✅ |

**Verdict: ✅ Complete**

---

## 2.4 WebSocket Live Sync

| Item | Web | Android | Status |
|---|---|---|---|
| Connect to /ws/sync | ✅ | ✅ | ✅ |
| Auth header | Session cookie | Bearer token | ✅ |
| Reconnect with backoff | Browser handles | ✅ 2s→60s exponential | ✅ |
| Trigger pull on change | ✅ | ✅ performSync(since=hwm) | ✅ |
| Graceful disconnect | Page unload | ✅ close code 1000 | ✅ |

**Verdict: ✅ Complete**

---

## 2.5 Connectivity Management

| Item | Web | Android | Status |
|---|---|---|---|
| Network state monitoring | N/A | ✅ ConnectivityManager | ✅ |
| Auto-sync on reconnect | N/A | ✅ PushSyncWorker | ✅ |
| WebSocket lifecycle | N/A | ✅ connect/disconnect on Online/Offline | ✅ |
| UI sync indicator | N/A | ✅ SyncState (ONLINE_IDLE/SYNCING/OFFLINE) | ✅ |

**Verdict: ✅ Complete**

---

## Phase 2 Summary

| Section | Verdict |
|---|---|
| 2.1 Chit Editor (overall) | 💀 BROKEN |
| — Title Row | 💀 BROKEN |
| — Dates & Times | 💀 BROKEN |
| — Task (Status/Priority/Severity/Assignee) | 💀 BROKEN |
| — Habits | 💀 BROKEN |
| — Location | 💀 BROKEN |
| — Tags | 💀 BROKEN |
| — Color | ✅ Complete |
| — Notes | 💀 BROKEN |
| — Checklist | 💀 BROKEN |
| — Alerts | 💀 BROKEN |
| — Recurrence | ✅ Complete |
| — People | 💀 BROKEN |
| — Projects | 💀 BROKEN |
| — Health Indicators | 💀 BROKEN |
| — Email | 💀 BROKEN |
| — Attachments | 💀 BROKEN |
| — Series Log | 💀 BROKEN |
| — Header Actions | 💀 BROKEN |
| 2.2 Dirty Tracking | ✅ Complete |
| 2.3 Sync Push | ✅ Complete |
| 2.4 WebSocket | ✅ Complete |
| 2.5 Connectivity | ✅ Complete |

---

## Complete Gap List (Phase 2)

**Only 2 zones pass: Color and Recurrence. All others are 💀 BROKEN.**

1. Nest thread label not clickable (no navigation)
2. Pin toggle not in title row (in TopAppBar instead)
3. Due date "Complete" checkbox missing
4. Point in Time "Now" button missing
5. All Day toggle not in zone header (in body as Switch)
6. Repeat checkbox not in dates zone header (separate zone)
7. Assignee dropdown has EMPTY options list (sharedUsers never loaded)
8. Auto-Complete Checklist not in zone header button
9. Habit toggle not in zone header button
10. Habits: Frequency and Reset Period write to same field (conflict)
11. Habits: Reset period missing interval value input
12. Habits: No completion chart
13. Habits: No success rate chart
14. Habits: No streak chart
15. Habits: No period history list
16. Location: No geocoding (text input only)
17. Location: No map preview
18. Location: No search/geocode button
19. Location: No context button
20. Location: No weather display
21. Location: No timezone suggestion from geocoded location
22. Tags: No recent tags row (settings.recentTags not loaded)
23. Tags: No expand/collapse all button
24. Notes: Format toolbar appends to end instead of wrapping selection
25. Notes: No side-by-side live preview (toggle only)
26. Notes: No download button
27. Notes: No to-checklist action
28. Notes: No [[ ]] chit link autocomplete
29. Notes: No Enter key list continuation
30. Checklist: No drag-drop reorder (move up/down buttons only)
31. Alerts: Wrong type names (alarm/timer/reminder vs notification/alarm/timer/stopwatch)
32. Alerts: No stopwatch type
33. Alerts: No days-of-week selection for alarms
34. Alerts: No duration input for timers
35. Alerts: No loop toggle for timers
36. Alerts: No default notifications auto-populate from settings
37. People: No contact tree (flat autocomplete only)
38. People: No system user role toggles (Viewer/Manager)
39. People: No contact images/colors on chips
40. People: Assignee dropdown not synced with People zone
41. Projects: No chit picker (raw ID input only)
42. Projects: No "Create new child" button
43. Projects: No "Move to Project" dropdown
44. Projects: No Kanban board display
45. Projects: No child chit cards (only truncated IDs)
46. Health Indicators: Raw JSON text field instead of structured UI
47. Health Indicators: No add/remove buttons per indicator type
48. Health Indicators: No indicator type labels from settings
49. Email: No autocomplete on From/To fields
50. Email: No format toolbar on body
51. Email: No PGP encrypt
52. Email: No Send button/action
53. Email: No Send Later
54. Email: No Reply/Forward
55. Email: No folder/status display
56. Attachments: No file list display
57. Attachments: No upload button
58. Attachments: No download/open
59. Attachments: No delete
60. Series Log: Placeholder text, no actual data loaded
61. Series Log: No navigate to instance
62. Options menu: No QR code action
63. No instance banner for recurrence editing

**Total: 63 gaps (all 💀 BROKEN)**
**Infrastructure (dirty tracking, sync push, WebSocket, connectivity): ✅ Complete (0 gaps)**
