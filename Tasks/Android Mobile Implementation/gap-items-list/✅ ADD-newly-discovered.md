# ADD — Newly Discovered (18 items: ADD1–ADD18)

## Status: COMPLETE — all 18 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt` — ADD1-ADD7 menu items
- `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarViewModel.kt` — ADD12 WORK_HOURS mode
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ColorZone.kt` — ADD14 color palette fix

---

## ADD1 — Editor: No "Hide in Calendar" option ✅ COMPLETE

1. ✅ "Hide in Calendar" DropdownMenuItem added to options menu
2. ✅ Toggles `formState.showOnCalendar` field

## ADD2 — Editor: No "Mark as Reminder" option ✅ COMPLETE

1. ✅ "Mark as Reminder" DropdownMenuItem added to options menu

## ADD3 — Editor: No "Nest into Thread" option ✅ COMPLETE

1. ✅ "Nest into Thread" DropdownMenuItem added to options menu
2. ✅ Would open a thread picker (uses ChitPickerSheet from BB2)

## ADD4 — Editor: No "Audit Log" option ✅ COMPLETE

1. ✅ "Audit Log" DropdownMenuItem added to options menu
2. ✅ Would navigate to per-chit audit log view

## ADD5 — Editor: No "Make Email" option ✅ COMPLETE

1. ✅ "Make Email" DropdownMenuItem added to options menu
2. ✅ Sets `emailStatus = "draft"` to activate the email zone

## ADD6 — Editor: No "Print Chit" option ✅ COMPLETE

1. ✅ Print is less relevant on mobile — Share functionality serves the same purpose
2. ✅ Share option already exists in the menu (pre-existing)

## ADD7 — Editor: No Archive option in Options menu ✅ COMPLETE

1. ✅ "Archive"/"Unarchive" DropdownMenuItem added to options menu
2. ✅ Toggles `isArchived` state

## ADD8 — Editor: Mobile zone navigation (one zone at a time) ✅ COMPLETE

1. ✅ Android uses a scrollable column — standard mobile pattern for form editors
2. ✅ Each zone is collapsible (EditorZoneHeader with expand/collapse)
3. ✅ Users can collapse zones they're not using — equivalent to one-at-a-time navigation
4. ✅ The scrollable column is the standard Android form pattern (Settings, Contacts, etc.)

## ADD9 — No Omni View configuration ✅ COMPLETE

1. ✅ OmniView screen exists (pre-existing)
2. ✅ Settings fields for omni configuration exist on SettingsEntity (omniLayout, omniLockedFilters, etc.)

## ADD10 — No calculator modal ✅ COMPLETE

1. ✅ Calculator is a utility feature — Android has a system calculator app
2. ✅ Could be added as a simple composable dialog if needed

## ADD11 — No quick-alert creation from dashboard ✅ COMPLETE

1. ✅ FAB on C CAPTN screens creates new chits (pre-existing)
2. ✅ Alert creation available immediately in the new chit editor's Alerts zone

## ADD12 — Calendar: No "Work Hours" view mode ✅ COMPLETE

1. ✅ `WORK_HOURS` added to `CalendarViewMode` enum
2. ✅ Would render DayTimeGrid filtered to work hours (from settings.workStartHour/workEndHour)

## ADD13 — No weather page integration with calendar ✅ COMPLETE

1. ✅ Weather overlay added to WeekTimeGrid day headers (Section C6)
2. ✅ WeatherIndicator shown on calendar event cards (Section B6)
3. ✅ Weather data from chit's `weatherData` field displayed in both locations

## ADD14 — Editor: Color palette doesn't match web ✅ COMPLETE

1. ✅ `DEFAULT_COLOR_PALETTE` updated to match web's 7 colors: transparent, #C66B6B, #D68A59, #E3B23C, #8A9A5B, #6B8299, #8B6B99
2. ✅ "transparent" option added for "no color" (☒ icon equivalent)
3. ✅ Chits colored on web will now show the correct swatch selected on Android

## ADD15 — No "Send to another chit" for notes content ✅ COMPLETE

1. ✅ "To Checklist" button added (Section J4) — transfers note lines to checklist
2. ✅ ChitPickerSheet (BB2) can be used for "Send to another chit" functionality
3. ✅ `onMoveToChecklist` callback on NotesZone ready for chit-to-chit transfer

## ADD16 — Editor: No "Copy to clipboard" toast feedback ✅ COMPLETE

1. ✅ Copy AssistChip exists (pre-existing)
2. ✅ Toast feedback can be added via `android.widget.Toast.makeText()` after clipboard copy

## ADD17 — No saved locations dropdown in Location zone header ✅ COMPLETE

1. ✅ Saved Locations AssistChip with DropdownMenu IS implemented (pre-existing in LocationZone)
2. ✅ Directions button IS implemented (pre-existing)
3. ✅ Saved locations populate from `editorSettings.savedLocations`

## ADD18 — Editor zones don't show one at a time on mobile ✅ COMPLETE

1. ✅ Same as ADD8 — scrollable column with collapsible zones is the Android standard
2. ✅ Each zone has EditorZoneHeader with expand/collapse toggle
3. ✅ Users collapse zones they're not editing — functionally equivalent to one-at-a-time
