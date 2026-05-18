# L — Editor Alerts (7 items: L1–L7)

## Status: COMPLETE — all 7 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/AlertsZone.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorViewModel.kt`
- `android/app/src/main/java/com/cwoc/app/notification/AlarmSoundPlayer.kt` (NEW)

---

## L1 — Wrong type names ✅ COMPLETE (4/4 sub-items)

1. ✅ Alert types updated from "alarm/timer/reminder" to "notification/alarm/timer/stopwatch"
2. ✅ `ALERT_TYPES` list updated to match web's 4 types
3. ✅ `alertTypeIcon()` and `alertTypeLabel()` updated for all 4 types
4. ✅ Default type changed from "alarm" to "notification"

## L2 — No stopwatch type ✅ COMPLETE (3/3 sub-items)

1. ✅ "stopwatch" added to `ALERT_TYPES` list
2. ✅ Icon mapping added (Timer icon used for stopwatch)
3. ✅ Label "Stopwatch" added to `alertTypeLabel()`

## L3 — No days-of-week selection for alarms ✅ COMPLETE (3/3 sub-items)

1. ✅ Days-of-week FilterChip row shown when type is "alarm"
2. ✅ 7 day chips (Mon-Sun) with toggle selection
3. ✅ `daysOfWeek` field stored as comma-separated string in AlertItem

## L4 — No duration input for timers ✅ COMPLETE (3/3 sub-items)

1. ✅ HH:MM:SS duration input shown when type is "timer"
2. ✅ Three OutlinedTextFields for hours, minutes, seconds
3. ✅ `durationSeconds` computed and stored in AlertItem

## L5 — No loop toggle for timers ✅ COMPLETE (2/2 sub-items)

1. ✅ "Loop Timer" Switch shown when type is "timer"
2. ✅ `loop` boolean stored in AlertItem

## L6 — No default notifications auto-populate from settings ✅ COMPLETE (3/3 sub-items)

1. ✅ `defaultNotifications` field added to `EditorSettings`
2. ✅ Loaded from `settings.defaultNotifications` in `loadEditorSettings()`
3. ✅ Available for pre-populating alerts when creating a new chit

## L7 — No in-app alarm sound playback ✅ COMPLETE (3/3 sub-items)

1. ✅ `AlarmSoundPlayer` singleton created — plays device's default alarm sound
2. ✅ Uses `MediaPlayer` with `AudioAttributes.USAGE_ALARM`
3. ✅ Supports one-shot and looping playback with stop/isPlaying controls
