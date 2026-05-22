# W113-W119: Quick Alert Modal

## What the web feature does
A modal (triggered by `!` hotkey) that lets users quickly create alarms, timers, stopwatches, or reminders without opening the full chit editor:
- W113: `_openQuickAlertModal()` — opens the modal with type selection
- W114: `_closeQuickAlertModal()` — closes it
- W115: `_quickAlertShowEditor(type)` — shows the editor for the selected alert type
- W116: `_quickAlertSave(type, data, andView, autoStart)` — saves the alert (creates independent alert or chit)
- W117: `_quickReminderSave(data, andView)` — creates a chit with a notification alert
- W118: `_quickAlertJumpToIndependent()` — switches to Alarms tab independent mode
- W119: `_showQuickAlertToast(type)` — shows confirmation toast

## What exists on Android
Nothing. No quick-create alert modal. Users must navigate to the Alerts screen or create a chit in the editor to add alerts.

## What's missing
The entire Quick Alert modal. On mobile this could be a FAB action or a bottom sheet accessible from any screen.

## Fix needed
Implement a Quick Alert bottom sheet accessible from the main FAB or a dedicated button. Should support creating alarms, timers, stopwatches, and reminders with minimal input.
