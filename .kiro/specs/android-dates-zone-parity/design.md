# Design Document

## Overview

This design specifies how to make the Android app's Dates & Times zone in the chit editor visually and functionally identical to the mobile browser version. The implementation replaces all Material 3 native pickers with custom Compose components that replicate the web's Flatpickr calendar and drum roller time picker. The existing `DateZone.kt`, `DrumRollerTimePicker.kt`, and `TimezonePickerModal.kt` are refactored to match every visual and behavioral detail from the reference spec.

## Architecture

### Component Structure

```
ui/components/
├── FlatpickrCalendarPicker.kt    (NEW — custom calendar dropdown)
├── DrumRollerTimePicker.kt       (REFACTOR — match web spec exactly)
├── TimezonePickerModal.kt        (REFACTOR — match web spec exactly)
├── TimezoneSuggestionPrompt.kt   (NEW — inline suggestion prompt)
├── ZoneButton.kt                 (VERIFY — matches web zone-button styling)
└── CwocTextField.kt              (EXISTING — reuse for date inputs)

ui/screens/editor/zones/
├── DateZone.kt                   (MAJOR REFACTOR — full parity rewrite)
└── RecurrenceZone.kt             (REFACTOR — inline into DateZone as recurrence row)
```

### Key Design Decisions

1. **No native pickers**: All Material 3 DatePickerDialog and TimePickerDialog usage is removed. Replaced with custom `FlatpickrCalendarPicker` and `DrumRollerTimePicker` Compose components.

2. **Recurrence inlined**: The separate `RecurrenceZone` is replaced by an inline recurrence row within `DateZone`, matching the web's single-zone layout.

3. **Compose scroll-snap**: The drum roller uses `LazyColumn` with `SnapFlingBehavior` (or manual `scrollTo` with snap) to replicate CSS scroll-snap behavior.

4. **Lora font throughout**: All text in the zone uses the existing Lora font family already loaded in the app's theme.

5. **State management**: Date zone state is managed via the existing editor ViewModel pattern, with a suppress-unsaved flag during load.

## Components and Interfaces

### New Components
- `FlatpickrCalendarPicker.kt` — Custom calendar dropdown composable (replaces DatePickerDialog)
- `TimezoneSuggestionPrompt.kt` — Inline timezone suggestion composable

### Refactored Components
- `DrumRollerTimePicker.kt` — Verify/fix all styling and behavior to match web spec exactly
- `TimezonePickerModal.kt` — Add datalist autocomplete, geocoding, auto-close behavior
- `DateZone.kt` — Major rewrite: new layout, inline recurrence, remove native pickers
- `ZoneButton.kt` — Verify matches web zone-button styling

### Deprecated Components
- `RecurrenceZone.kt` — Functionality moved inline into DateZone

### Interfaces
- `FlatpickrCalendarPicker(isOpen, initialDate, onDateSelected, onDismiss)` — Calendar picker API
- `DrumRollerTimePicker(isOpen, initialTime, timeFormat, minuteStep, onTimeSet, onCancel)` — Time picker API
- `TimezonePickerModal(isOpen, currentTimezone, onTimezoneSelected, onClear, onCancel)` — Timezone picker API
- `TimezoneSuggestionPrompt(detectedTimezone, onUse, onDismiss)` — Suggestion prompt API

## Data Models

### DateZoneState
```kotlin
data class DateZoneState(
    val dateMode: DateMode,          // NONE, START_END, DUE, POINT_IN_TIME, PERPETUAL
    val startDate: String?,          // "YYYY-Mon-DD" format
    val endDate: String?,            // "YYYY-Mon-DD" format
    val dueDate: String?,            // "YYYY-Mon-DD" format
    val pointInTimeDate: String?,    // "YYYY-Mon-DD" format
    val startTime: String?,          // "HH:MM" 24-hour format
    val endTime: String?,            // "HH:MM" 24-hour format
    val dueTime: String?,            // "HH:MM" 24-hour format
    val pointInTimeTime: String?,    // "HH:MM" 24-hour format
    val allDay: Boolean,             // default false
    val allDayAutoDefaulted: Boolean,// flag to prevent hiding time inputs
    val timezone: String?,           // IANA timezone or null (floating)
    val perpetual: Boolean,          // default false
    val habitActive: Boolean,        // from Task zone
    val repeatEnabled: Boolean,      // default false
    val recurrenceRule: RecurrenceRule?,
    val suppressUnsaved: Boolean     // true during load
)

data class RecurrenceRule(
    val freq: String,       // DAILY, WEEKLY, MONTHLY, YEARLY, MINUTELY, HOURLY
    val interval: Int,      // default 1
    val byDay: List<String>?, // SU, MO, TU, WE, TH, FR, SA
    val until: String?      // "YYYY-Mon-DD" or null (ends never)
)

enum class DateMode {
    NONE, START_END, DUE, POINT_IN_TIME, PERPETUAL
}
```

## Component Specifications

### FlatpickrCalendarPicker (NEW)

A custom calendar dropdown that renders below the triggering input field, styled to match Flatpickr's appearance:
- Month/year header with navigation arrows
- 7-column day grid (Su–Sa)
- Selected day highlighted
- Today indicator
- Parchment theme colors (background `#fffaf0`, borders `#8b4513`, selected day teal)
- Dismisses on outside tap or ESC
- Returns date in "YYYY-Mon-DD" format
- Renders as a popup/dropdown anchored to the input field

### DrumRollerTimePicker (REFACTOR)

Must match web spec Section 8 exactly:
- Slide-down-from-top animation (translateY -100% to 0, 0.3s cubic-bezier)
- Overlay fade-in (0.2s)
- Scroll-snap columns with 40dp item height
- Highlight bar with editable input overlay
- Overwrite-mode keyboard input
- Cancel/Now/Set buttons with exact colors
- 12/24 hour mode support
- Minute step from settings
- Small screen (≤380dp) variant

### TimezonePickerModal (REFACTOR)

Must match web spec Section 9 exactly:
- Centered overlay modal
- Search input with datalist-style autocomplete
- 18 common timezones at top of suggestions
- All IANA timezones available
- Auto-close on valid selection (200ms delay)
- Geocoding on Enter for non-timezone text
- Clear/Cancel buttons
- Pre-fill when timezone already set
- ESC to close

### TimezoneSuggestionPrompt (NEW)

Inline composable matching web spec Section 10:
- Teal-tinted background with border
- "📍 Detected: [timezone]" text
- Use/Dismiss buttons
- Column layout on mobile
- Injected into the active date-mode-fields area

## State Flow

```
User taps date mode radio → onDateModeChange() →
  - Update field visibility
  - Update All Day visibility
  - Update Recurrence Row visibility
  - Inject/update timezone labels
  - Update recurrence labels
  - Auto-default All Day (with flag)
  - Auto-populate Point in Time / Perpetual
  - Mark unsaved (unless suppressed)

User taps time button → open DrumRollerTimePicker →
  - On Set: store 24h value, update display, auto-deselect All Day, mark unsaved
  - On Cancel/outside tap: close without changes
  - On Now: set to current time rounded to snap

User taps date input → open FlatpickrCalendarPicker →
  - On select: store YYYY-Mon-DD, update recurrence labels, refresh weather, mark unsaved
  - On dismiss: close without changes

User taps timezone label → open TimezonePickerModal →
  - On valid selection: apply timezone, update all labels to anchored, mark unsaved, close
  - On geocode: detect tz from coords, apply, populate location zone
  - On Clear: remove timezone, revert to floating
  - On Cancel/ESC/outside: close without changes
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `DateZone.kt` | Major refactor | Full rewrite to match web layout, remove Material pickers, inline recurrence |
| `DrumRollerTimePicker.kt` | Refactor | Ensure exact match to web spec (animations, styling, keyboard input) |
| `TimezonePickerModal.kt` | Refactor | Add datalist autocomplete, geocoding, auto-close, exact styling |
| `FlatpickrCalendarPicker.kt` | New file | Custom calendar dropdown component |
| `TimezoneSuggestionPrompt.kt` | New file | Inline timezone suggestion composable |
| `RecurrenceZone.kt` | Deprecate/remove | Functionality moved inline into DateZone |
