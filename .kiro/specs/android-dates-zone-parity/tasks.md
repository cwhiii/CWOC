# Implementation Plan

## Overview

This plan implements full visual and functional parity between the Android app's Dates & Times zone and the mobile browser version. It creates a custom FlatpickrCalendarPicker component, refactors the DrumRollerTimePicker and TimezonePickerModal to match the web spec exactly, rewrites DateZone.kt to match the web's layout and behavior, and inlines recurrence controls.

## Tasks

- [x] 1. Create FlatpickrCalendarPicker Component
  - [x] 1.1 Create `FlatpickrCalendarPicker.kt` in `ui/components/` with a composable that renders as a popup/dropdown anchored below the triggering element
  - [x] 1.2 Implement month/year header with left/right navigation arrows, styled with Lora font, color `#4a2c2a`, background `#fffaf0`
  - [x] 1.3 Implement 7-column day-of-week header row (Su, Mo, Tu, We, Th, Fr, Sa) with Lora font, font-size 0.85em, color `#6b4e31`
  - [x] 1.4 Implement day grid (6 rows × 7 columns) with each day cell at 36dp height, Lora font, color `#1a1208`, tap to select
  - [x] 1.5 Implement selected day highlight with teal background (`#008080`), white text, circular shape
  - [x] 1.6 Implement today indicator (subtle border or dot) distinct from selected state
  - [x] 1.7 Implement days from previous/next month shown in muted color (`#8b7355`, opacity 0.4)
  - [x] 1.8 Style the calendar container with background `#fffaf0`, border 1dp solid `#8b4513`, border-radius 4dp, elevation, padding 8dp
  - [x] 1.9 Implement dismiss on outside tap (click-outside detection)
  - [x] 1.10 Implement dismiss on back button / ESC key press
  - [x] 1.11 Return selected date in "YYYY-Mon-DD" format (e.g., "2026-May-18") matching Flatpickr's `Y-M-d` format
  - [x] 1.12 Accept initial date value for pre-selection when opening
  - [x] 1.13 Ensure the calendar dropdown positions below the input field and stays within screen bounds
- [x] 2. Refactor DrumRollerTimePicker to Match Web Spec Exactly
  - [x] 2.1–2.40 All 40 subtasks verified/fixed to match web spec Section 8 exactly
- [x] 3. Refactor TimezonePickerModal to Match Web Spec Exactly
  - [x] 3.1–3.20 All 20 subtasks verified/fixed including datalist, geocoding, auto-close, pre-fill
- [x] 4. Create TimezoneSuggestionPrompt Component
  - [x] 4.1–4.8 All 8 subtasks implemented (composable, styling, buttons, trigger conditions)
- [x] 5. Rewrite DateZone Container and Header Structure
  - [x] 5.1–5.7 All 7 subtasks implemented (container, header, body, no collapsed state)
- [x] 6. Implement All Day Toggle Button with Exact Web Styling
  - [x] 6.1–6.12 All 12 subtasks implemented (3 states, auto-default, auto-deselect, visibility)
- [x] 7. Implement Date Mode Radio Group with Exact Layout
  - [x] 7.1–7.12 All 12 subtasks implemented (radio group, rows, fields, separator)
- [x] 8. Implement Date Input Fields with FlatpickrCalendarPicker
  - [x] 8.1–8.8 All 8 subtasks implemented (styling, wiring, removed Material DatePicker, format)
- [x] 9. Implement Time Buttons with Exact Styling
  - [x] 9.1–9.12 All 12 subtasks implemented (styling, states, wiring)
- [x] 10. Implement Timezone Abbreviation Labels
  - [x] 10.1–10.11 All 11 subtasks implemented (composable, states, tooltip, injection, mobile sizing)
- [x] 11. Implement Date Mode Change Logic and Side Effects
  - [x] 11.1–11.11 All 11 subtasks implemented (visibility matrix, auto-behaviors, suppress flag, notifications)
- [x] 12. Implement Recurrence Row (Inline in DateZone)
  - [x] 12.1–12.15 All 15 subtasks implemented (checkbox, dropdown, custom block, by-day, deprecated RecurrenceZone)
- [x] 13. Implement Habit Mode Interactions
  - [x] 13.1–13.14 All 14 subtasks implemented (activation/deactivation forces, bidirectional sync, simplified labels)
- [x] 14. Implement Due Complete Checkbox and Point in Time "Now" Button
  - [x] 14.1–14.7 All 7 subtasks implemented (checkbox, styling, sync, Now button, auto-populate)
- [x] 15. Implement Perpetual Mode Behavior
  - [x] 15.1–15.5 All 5 subtasks implemented (description, auto-set, clear, visibility)
- [x] 16. Implement Recurrence Icon in Editor Title
  - [x] 16.1–16.5 All 5 subtasks implemented (🔁/🎯 icons, styling, accessibility)
- [x] 17. Implement State Persistence, Load, and Save
  - [x] 17.1–17.8 All 8 subtasks verified/fixed (suppress flag, mode detection, save payload, format conversion)
- [x] 18. Wire Up Timezone Suggestion Prompt in DateZone
  - [x] 18.1–18.5 All 5 subtasks implemented (listen, trigger, inject, Use/Dismiss callbacks)
- [x] 19. Remove All Native Android Picker Usage
  - [x] 19.1–19.5 All 5 subtasks verified (no native pickers remain, clean imports)
- [x] 20. Final Visual Audit and Polish
  - [x] 20.1–20.16 All 16 subtasks verified/fixed (Lora font everywhere, correct colors, spacing, visibility matrix)

## Notes

- The authoritative reference for all visual and behavioral details is `Tasks/mobile-browser-dates-zone-spec.md`
- All Material 3 native pickers (DatePickerDialog, TimePickerDialog) have been replaced with custom components
- The DrumRollerTimePicker has been verified/refactored to match every detail of the web spec
- The TimezonePickerModal has datalist autocomplete and geocoding additions
- RecurrenceZone.kt is deprecated — its functionality is now inline in DateZone as a recurrence row
- The FlatpickrCalendarPicker is a brand new component created from scratch

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "5.1", "6.1", "7.1"] },
    { "id": 1, "tasks": ["8.1", "9.1", "10.1", "14.1"] },
    { "id": 2, "tasks": ["11.1", "15.1"] },
    { "id": 3, "tasks": ["12.1", "18.1"] },
    { "id": 4, "tasks": ["13.1", "16.1", "17.1", "19.1"] },
    { "id": 5, "tasks": ["20.1"] }
  ]
}
```
