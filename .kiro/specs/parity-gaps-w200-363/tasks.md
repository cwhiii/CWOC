# Implementation Plan: Parity Gaps W200-W363

## Overview
Resolve all Android parity gaps in the W200-W363 range. Covers 15 feature areas: default notifications, Omni filter lock, email add-to-bundle, combine alerts toggle, badge custom detectors, custom objects zones, attachments multi-select, password management, recent tags, RSVP status, project quick menu, week view paging, checklist clipboard, cron utilities, and weather functions.

## Tasks

- [x] 1. Implement default notifications on date mode (W202) — In ChitEditorViewModel, add tracking flags and onDateModeChanged() that reads settings.default_notifications and auto-populates alerts on new chits when date mode is set. Wire DateZone to trigger this. Expand alerts zone after adding.
  - [x] 1.1. Add defaultNotifsAppliedStart and defaultNotifsAppliedDue flags to ChitEditorViewModel
  - [x] 1.2. Implement onDateModeChanged(mode) that reads settings.default_notifications[mode] and populates alerts if isNew, not applied, and alerts empty
  - [x] 1.3. Wire DateZone date mode changes to call onDateModeChanged
  - [x] 1.4. Set alerts zone isExpanded=true after adding default notifications
- [x] 2. Implement Omni View filter lock system (W203-207) — Add locked filter state to FilterSortViewModel, implement apply/lock/indicator logic, add Lock button visible only in Omni tab.
  - [x] 2.1. Create OmniLockedFilters data class and add omniLockedFilters StateFlow to FilterSortViewModel
  - [x] 2.2. Implement applyOmniLockedFilters() — reads omni_locked_filters from settings, parses JSON, applies to filter state
  - [x] 2.3. Implement lockOmniFilters() — gathers current filter state, serializes, saves to settings via API
  - [x] 2.4. Call applyOmniLockedFilters() when Omni tab is selected
  - [x] 2.5. Add Lock button in FilterSortPanel (visible only in Omni) and locked indicator chip
  - [x] 2.6. Hide lock button and indicator when leaving Omni tab
- [x] 3. Implement email add-to-bundle (W208-209) — Create AddToBundleSheet composable with match type selection and bundle picker. Add API call and tag update logic.
  - [x] 3.1. Create AddToBundleSheet.kt ModalBottomSheet with email info, match type radio (Sender/Subject), bundle dropdown, Cancel/Add buttons
  - [x] 3.2. Add addToBundle() function to EmailViewModel — POST /api/bundles/{id}/add-rule, then update chit tags
  - [x] 3.3. Load bundles from settings, filter out Everything Else, sort by display_order
  - [x] 3.4. Wire Add to Bundle action in email list context menu or editor email zone
- [x] 4. Implement combine alerts toggle (W218) — Add combineAlerts field to settings form state and Switch in ViewsSettingsTab that toggles combined vs individual alert rows.
  - [x] 4.1. Add combineAlerts field to SettingsViewModel form state
  - [x] 4.2. Add Switch in ViewsSettingsTab alerts section
  - [x] 4.3. Ensure toggle persists via normal settings save flow
- [x] 5. Implement badge custom detector modal (W221-222) — Create CustomDetectorDialog with validation, wire into BadgesSettingsTab for add/edit.
  - [x] 5.1. Create CustomDetectorDialog.kt with fields: name, category, keywords, regex, URL template, label
  - [x] 5.2. Implement validation: name required, regex valid, URL must contain {code}
  - [x] 5.3. Wire save: build detector object, add/update in config, serialize, mark dirty
  - [x] 5.4. Add Add Custom Detector button and edit icons in BadgesSettingsTab
- [x] 6. Implement custom objects zone management (W223-227) — Fetch custom zones and objects from API, render as collapsible editor zones with typed fields, save values to health_data.
  - [x] 6.1. Add loadCustomZones() to ChitEditorViewModel — fetches zones and objects from API
  - [x] 6.2. Create CustomZonesSection.kt composable rendering collapsible zone panels grouped by sub_type
  - [x] 6.3. Implement field rendering: Checkbox (boolean), OutlinedTextField (string), number TextField (numeric) with range highlighting
  - [x] 6.4. Implement conditional display evaluation (reuse HealthIndicatorsZone logic)
  - [x] 6.5. Wire gatherCustomZoneData() into save flow to merge values into healthData
- [x] 7. Implement attachments multi-select and bulk delete (W228-229) — Add long-press multi-select mode with checkboxes and bulk delete action.
  - [x] 7.1. Add isMultiSelectMode and selectedIndices state to AttachmentsZone
  - [x] 7.2. Implement long-press to enter multi-select, show checkboxes and selection count bar
  - [x] 7.3. Implement tap-to-toggle selection
  - [x] 7.4. Implement bulk delete: confirm dialog, DELETE /api/attachments/bulk, toast, exit mode
- [x] 8. Implement password management (W230-232) — Add Reset Password button in admin user list with dialog and API call.
  - [x] 8.1. Add Reset Password button per user row in AdminSettingsTab (admin-only)
  - [x] 8.2. Show CwocPromptDialog with password input
  - [x] 8.3. Implement resetPassword() — validate, PUT /api/users/{id}/reset-password, show toast
- [x] 9. Implement recent tags (W233-235) — Track last 5 used tags, persist to settings, show Recent chip row in tag picker.
  - [x] 9.1. Create RecentTagsManager with recentTags StateFlow, trackTag(), getRecentTags(), debounced save
  - [x] 9.2. Load from settings.recent_tags via SettingsRepository on first access
  - [x] 9.3. Add Recent horizontal chip row above tag tree in TagsPickerSheet
  - [x] 9.4. Call trackTag() when a tag is selected in editor tags zone
- [x] 10. Implement RSVP status utilities (W240-241) — Create RsvpUtils with status checking functions, use in views to handle declined chits.
  - [x] 10.1. Create domain/sharing/RsvpUtils.kt with getUserRsvpStatus() and isDeclinedByCurrentUser()
  - [x] 10.2. Parse chit shares JSON field to extract user RSVP statuses
  - [x] 10.3. Use isDeclinedByCurrentUser in view screens to dim or filter declined shared chits
- [x] 11. Implement project quick menu and move child (W242-243) — Add long-press context menu on project cards and move-to-project on child cards.
  - [x] 11.1. Add long-press DropdownMenu on project cards in ProjectsScreen
  - [x] 11.2. Implement menu actions: Create New Child, Open in Editor, Pin/Unpin, Archive/Unarchive
  - [x] 11.3. Implement Snooze action with duration picker (1h, 1d, 1w, 2w, 1mo)
  - [x] 11.4. Add Move to Project option on child cards with project picker dialog
  - [x] 11.5. Implement moveChildToProject in ProjectsViewModel — remove from current, add to target, save both
- [x] 12. Implement week view day offset / responsive paging (W245) — Add day paging for narrow screens in calendar week view.
  - [x] 12.1. Add weekViewDayOffset state to CalendarViewModel, reset on period/view changes
  - [x] 12.2. Calculate visibleDayCount based on screen width in CalendarTimeGrid
  - [x] 12.3. Show prev/next buttons when visibleDayCount < totalDays, slice days by offset
  - [x] 12.4. Implement prev/next handlers adjusting offset by visibleDayCount, clamped to valid range
- [x] 13. Implement checklist clipboard operations (W247-248) — Add paste-from-clipboard and copy-incomplete actions to checklist zone.
  - [x] 13.1. Create domain/checklist/ChecklistClipboard.kt with parseClipboardText() — indent detection, markdown format, parent assignment
  - [x] 13.2. Implement copyIncompleteToClipboard() — filter unchecked, format as markdown checklist
  - [x] 13.3. Add Paste and Copy Incomplete buttons to ChecklistZoneV2 toolbar
  - [x] 13.4. Wire paste: read ClipboardManager, parse, snapshot for undo, append, show toast
  - [x] 13.5. Wire copy: filter, format, write to ClipboardManager, show toast
- [x] 14. Implement cron expression functions (W250-252) — Create CronUtils with describe, assemble, and validate functions.
  - [x] 14.1. Create domain/cron/CronUtils.kt with describe(), assemble(), validate()
  - [x] 14.2. Implement describe() pattern matching for common cron patterns with 12h AM/PM format
  - [x] 14.3. Implement validate() — 5 fields, valid cron characters
- [x] 15. Implement weather functions (W253-255) — Add extreme weather indicator, day tap navigation, and location row drag reorder.
  - [x] 15.1. Add isExtreme() utility and apply red border/tint on extreme day cells
  - [x] 15.2. Implement day block tap → navigate to calendar DAY view for that date
  - [x] 15.3. Implement drag-to-reorder for location rows using ReorderableList, persist order to settings

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "3.1", "3.2", "3.3", "3.4", "4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4", "6.1", "6.2", "6.3", "6.4", "6.5", "7.1", "7.2", "7.3", "7.4", "8.1", "8.2", "8.3", "9.1", "9.2", "9.3", "9.4", "10.1", "10.2", "10.3", "11.1", "11.2", "11.3", "11.4", "11.5", "12.1", "12.2", "12.3", "12.4", "13.1", "13.2", "13.3", "13.4", "13.5", "14.1", "14.2", "14.3", "15.1", "15.2", "15.3"] }
  ]
}
```

## Notes
- All tasks are independent and can be executed in any order or in parallel
- No new Room entities needed — data flows through existing settings/chit entities
- No software installation required — pure Kotlin/Compose implementation
- No tests required per project rules
