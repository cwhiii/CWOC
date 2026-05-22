# W9: _onHabitsWindowChange(newVal)

## What the web function does
1. Updates `window._cwocSettings.habits_success_window` in memory
2. POSTs the full settings object to `/api/settings` to persist server-side (so it syncs across devices)
3. Re-renders habits view if currently in habits mode

## What exists on Android
- `SidebarStateViewModel.setHabitsSuccessWindow(window)` (A#1964) — updates local state and saves to SharedPreferences
- `TasksViewModel.habitsSuccessWindow` StateFlow — reads initial value from SettingsEntity (server-synced)
- Compose reactively re-renders when the value changes

## What's missing
**The setting change is not persisted back to the server.** The Android app saves the habits success window to SharedPreferences only. The web POSTs it to `/api/settings` so it syncs across all devices. If the user changes this on Android, it won't be reflected on the web or other devices.

## Fix needed
When `setHabitsSuccessWindow` is called, also update the `SettingsEntity.habitsSuccessWindow` field in Room and mark settings as dirty for sync push. This ensures the preference syncs back to the server like the web does.
