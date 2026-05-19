# Android App — Dates & Times Zone: Parity Spec

This document specifies exactly what the Android app's "Dates & Times" zone must look and behave like to be indistinguishable from the mobile browser version. The reference is `mobile-browser-dates-zone-spec.md`. Every gap identified here must be closed.

---

## 1. Current State Summary

The Android app (`DateZone.kt` + `RecurrenceZone.kt`) already implements:
- ✅ Date mode radio buttons (Start/End, Due Only, Perpetual, Point in Time, None)
- ✅ Material 3 DatePickerDialog and TimePickerDialog
- ✅ All-Day toggle (Switch in header + body)
- ✅ Timezone selector (searchable dropdown with 72 IANA timezones)
- ✅ Timezone abbreviation display next to field labels
- ✅ Suggested timezone from geocoded location
- ✅ Due Complete checkbox
- ✅ Point in Time "Now" button
- ✅ Repeat toggle linking to RecurrenceZone
- ✅ Time snap to `calendarSnap` interval
- ✅ RecurrenceZone: presets, custom builder, by-day, until/count, exceptions display

---

## 2. Visual Parity Gaps

The Android app uses Material 3 default styling. To be indistinguishable from the mobile browser, it must adopt the CWOC parchment theme.

### 2.1 Zone Container

**Web behavior:** The zone body has no border-radius, no left/right borders, full width, background `#fff8dc`, padding 8px horizontal (1em).

**Android must match:**
- Background: `#fff8dc` (cornsilk/parchment)
- No visible zone header (title/toggle hidden in mobile zone mode — navigation handled by zone nav bar)
- Only the zone-actions row is visible in the header area (the All Day toggle button)
- Zone body: full width, padding 8dp horizontal, flex column layout

### 2.2 Zone Header (Actions Row Only)
**Web behavior:** On mobile, the zone header shows ONLY the actions row (All Day toggle button). The zone title "🗓️ Dates & Times" and the collapse toggle icon are hidden.

**Android gap:** The Android `EditorZoneHeader` shows a title + expand/collapse toggle. This should be removed for the dates zone when in zone-at-a-time navigation mode (which is always on mobile). Only the All Day button should appear at the top.

**Required change:**
- Remove the `EditorZoneHeader` wrapper from `DateZone` when in zone-nav mode
- Show only the All Day toggle button at the top of the zone content, styled as a `zone-button` (see Section 2.8)

### 2.3 Date Mode Radio Group Layout
**Web behavior (mobile):**
- Vertical stack (`flex-direction: column`)
- Each row: radio button + label text on one line, then fields indented 22px below
- Radio/checkbox: 16×16px fixed, `margin: 2px 6px 0 0`
- Label: bold, 0.9em, no wrapping
- Fields: 22px left margin, full width minus 22px, flex-wrap, gap 6px

**Android gap:** Currently uses Material 3 `RadioButton` + `Text` in a `Row` with `selectable` modifier. The fields appear below each radio option but without the 22px indent or the compact sizing.

**Required changes:**
- Radio buttons: 16dp diameter (not Material 3 default 20dp)
- Label text: Bold, ~14sp (0.9em equivalent), Lora font
- Fields below each radio: 22dp start padding, full width
- Vertical spacing between rows: 4dp padding
- Remove the `selectableGroup` column wrapper's extra padding

### 2.4 Date Input Fields
**Web behavior:**
- Flatpickr-styled text inputs: `border: 1px solid #8b4513`, `border-radius: 3px`, `background: #fff8e1`, `font-family: Lora`, `font-size: 16px` (mobile), `min-height: 38px`, `padding: 4px 8px`
- Tapping opens Flatpickr calendar (custom calendar, not native)
- Display format: "YYYY-Mon-DD" (e.g., "2026-May-18")

**Android gap:** Uses Material 3 `OutlinedTextField` with default styling (rounded corners, Material colors). Opens Material 3 `DatePickerDialog`.

**Required changes:**
- Replace `OutlinedTextField` with a custom styled field:
  - Border: 1dp solid `#8b4513`
  - Border-radius: 3dp
  - Background: `#fff8e1`
  - Font: Lora serif, 16sp
  - Min-height: 38dp
  - Padding: 4dp vertical, 8dp horizontal
- Display format: "YYYY-Mon-DD" (e.g., "2026-May-18") — match the web exactly
- The DatePickerDialog can remain Material 3 (the web uses Flatpickr which is also a custom calendar overlay — the key is that it's NOT the native date picker)

### 2.5 Time Input Buttons (Drum Roller Picker)
**Web behavior:**
- Time is shown in a BUTTON (not a text field): `border: 1px solid #8b4513`, `border-radius: 3px`, `background: #fff8e1`, `font-family: Lora`, `width: 80px`, `text-align: center`, `min-height: 34px`
- Empty state: "HH:MM" in muted brown (`#8b7355`)
- Set state: Formatted time (e.g., "2:30 PM" or "14:30")
- Tapping opens a **drum roller time picker** (NOT the Material 3 clock face)

**Android gap:** Uses Material 3 `TimePicker` (clock face) inside an `AlertDialog`. This is visually very different from the web's drum roller.

**Required changes — BUILD A DRUM ROLLER TIME PICKER:**

The drum roller is the single biggest visual difference. It must be implemented as a custom Compose component matching the web spec exactly:

#### Drum Roller Spec (from web Section 8):
- **Modal overlay:** Full-screen semi-transparent (`rgba(0,0,0,0.5)`), centered content
- **Modal container:** Background `#fffaf0`, border-bottom 3dp solid `#6b4e31`, border-radius 0 0 16dp 16dp, full width, max-width 400dp, slides down from top (animation: translateY from -100% to 0, 300ms cubic-bezier)
- **Header:** "Select Time", centered, 1.1em/~18sp, bold 600, color `#3a2a14`, margin-bottom 12dp
- **Drum container:** Height 200dp, flex row centered, max-width 300dp
- **Drums:** 2 columns for 24h mode (hour + minute), 3 for 12h mode (hour + minute + AM/PM)
  - Each drum: vertical scroll with snap (`scroll-snap-type: y mandatory`)
  - Items: 40dp height, 1.4em/~22sp font, color `#6b4e31`, opacity 0.4
  - Selected item: opacity 1, 1.6em/~26sp, bold 700, scale 1.05
  - 2 invisible padding items at top/bottom for centering
  - Fade masks at top/bottom (gradient from `#fffaf0` to transparent, 60dp height)
  - Hour drum: 00–23 (24h) or 1–12 (12h)
  - Minute drum: 0 to 55 in steps of `calendarSnap` (default 5), zero-padded
  - AM/PM drum: "AM", "PM"
- **Highlight bar:** Centered vertically, left 8dp, right 8dp, height 40dp, background `rgba(139, 90, 43, 0.1)`, border-top/bottom 1.5dp solid `rgba(139, 90, 43, 0.3)`, border-radius 6dp
- **Editable input overlay:** Positioned over highlight bar, shows editable hour:minute text inputs (font 1.5em/24sp, bold 700, Lora, color `#1a1208`, transparent background, bottom border on focus: `#6b4e31`)
- **Colon separator:** Between drums, 1.8em/~29sp, bold, color `#3a2a14`
- **Buttons row:** Three buttons in a flex row, gap 10dp, margin-top 16dp:
  - Cancel: background `#f5e6cc`, color `#6b4e31`, border 1.5dp solid `#6b4e31`
  - Now: background `#e8dcc8`, color `#3a2a14`, border 1.5dp solid `#6b4e31`
  - Set: background `#6b4e31`, color `#fff8e1`, border 1.5dp solid `#4a3520`
  - All: flex 1, padding 10dp 12dp, border-radius 8dp, Lora font, 0.95em/~15sp, bold 600

#### Drum Roller Behavior:
- Scrolling a drum snaps to the nearest item
- Tapping an item scrolls it to center
- The editable input overlay allows direct keyboard entry (overwrite mode)
- "Now" button: sets to current time rounded to nearest snap
- "Set" button: confirms and closes
- "Cancel" button: closes without change
- Scroll position syncs bidirectionally with the editable input fields

### 2.6 "to" Separator (Start/End Mode)
**Web behavior:** Between start time and end time, a `<span>` with text "to" is shown.

**Android gap:** No separator text between start and end fields.

**Required change:** Add a `Text("to")` composable between the start time button and end time button, styled in Lora font, normal weight, matching the field text color.

### 2.7 Field Order in Start/End Mode
**Web behavior:** Start Date → Start Time → "to" → End Time → End Date

**Android gap:** Currently shows Start (date+time) then End (date+time) as separate rows.

**Required change:** Match the web's field order exactly. On mobile this wraps naturally, but the logical order must be: start date, start time, "to" text, end time, end date — all in a single wrapping row (FlowRow).

### 2.8 All Day Toggle Button
**Web behavior:** A styled BUTTON (not a Switch):
- Inactive: background `#a0522d`, color `#fdf5e6`, border `1px outset #8b4513`, text "🗓️ All Day"
- Active: background `#008080` (teal), color `#fff8e1`, border `#006060`, text "🗓️ All Day ✓"
- Disabled (habit): same as active but opacity 0.6, pointer-events none
- Size: padding 5px 10px, font-size 12px, white-space nowrap

**Android gap:** Uses a Material 3 `Switch` toggle. Visually very different.

**Required change:** Replace the Switch with a styled button that matches the web:
- Use a `Button` composable with conditional background/text colors
- Inactive state: brown button with "🗓️ All Day"
- Active state: teal button with "🗓️ All Day ✓"
- Disabled state: teal with 0.6 alpha

### 2.9 Repeat Row
**Web behavior:**
- A checkbox + "🔁 Repeat" label on one line
- When checked: inline frequency dropdown + "Ends never" checkbox + end date input
- Dropdown options: Daily, "Weekly on [day]", "Monthly on the [date]", "Yearly on [month date]", "Custom…"
- Labels are CONTEXTUAL — they include the current date context (e.g., "Weekly on Monday")
- Hidden when date mode is None or Point in Time
- Hidden when habit is active

**Android gap:** Uses a Switch toggle at the bottom of DateZone that just shows the raw recurrence rule JSON text. The RecurrenceZone is a separate expandable section below with FilterChips for presets.

**Required changes:**
- Replace the Switch with a checkbox + label row matching the web
- Show inline recurrence options (frequency dropdown + ends never + until date) directly in the dates zone body — NOT as a separate collapsible zone
- Frequency dropdown labels must be contextual (include day/date from the active date field)
- "Custom…" option expands the full custom builder (interval, by-day, until/count) inline
- Remove the separate `RecurrenceZone` composable — merge its functionality into the dates zone inline

### 2.10 Timezone Abbreviation Labels
**Web behavior:**
- Small inline label appended after the date/time fields in each mode
- Two states:
  - **Floating** (no explicit tz): color `#8b5a2b`, opacity 0.55, normal weight — shows local TZ abbreviation
  - **Anchored** (explicit tz set): color `#1a1208`, opacity 1, weight 500
- Tapping opens the Timezone Picker Modal
- Tooltip shows abbreviation + long name + IANA ID

**Android gap:** Shows timezone abbreviation as a small `Text` next to the field label (above the field, not after it). No floating/anchored visual distinction. No tap-to-open behavior on the abbreviation itself.

**Required changes:**
- Move the timezone abbreviation to appear AFTER the date/time fields (inline, at the end of the fields row)
- Apply floating vs anchored styling (opacity, color, weight)
- Make it tappable — opens the timezone picker
- Add a long-press tooltip showing all timezone forms

### 2.11 Timezone Picker Modal
**Web behavior:**
- Full modal overlay with:
  - Title: "Set Timezone"
  - Search input with datalist (autocomplete from common + all IANA timezones)
  - Hint: "(or enter address)"
  - Status display: "✓ America/Denver" (green, on valid selection)
  - Buttons: "Clear (floating)" and "Cancel"
- Auto-validates as user types — closes automatically on valid match
- Supports geocoding: typing an address + Enter looks up timezone from coordinates
- Styled with parchment theme (background `#fffaf0`, border `#6b4e31`, Lora font)

**Android gap:** Uses a simple `OutlinedTextField` + `LazyColumn` filter list inline in the zone body. No modal, no geocoding, no auto-close on match, no "Clear" button to revert to floating.

**Required changes:**
- Replace inline timezone selector with a MODAL that opens on tap of the tz abbreviation label
- Modal must match web styling:
  - Background: `#fffaf0`
  - Border: 2dp solid `#6b4e31`
  - Border-radius: 8dp
  - Padding: 16dp
  - Width: 95% of screen
  - Font: Lora serif
- Include: title, search input, hint text, status display, Clear + Cancel buttons
- Auto-validate against timezone list as user types
- Auto-close on valid match (200ms delay)
- Support geocoding via address entry (call `/api/geocode?q=[query]`)
- "Clear" button removes timezone (reverts to floating state)

### 2.12 Timezone Suggestion Prompt
**Web behavior:**
- When location is geocoded and detected timezone differs from current:
  - Shows a teal-tinted prompt: "📍 Detected: America/Denver" with "Use" and "Dismiss" buttons
  - Styled: background `rgba(0, 128, 128, 0.06)`, border `1px solid rgba(0, 128, 128, 0.3)`, border-radius 4dp
  - On mobile: buttons stack vertically

**Android gap:** Shows a simple `TextButton` with "📍 Use [tz] (from location)". No dismiss option, no styled container.

**Required changes:**
- Replace the TextButton with a styled container matching the web:
  - Teal-tinted background and border
  - "📍 Detected: [timezone]" text
  - Two buttons: "Use" (teal background, cream text) and "Dismiss" (cream background, dark text)
  - On tap "Use": applies timezone, removes prompt
  - On tap "Dismiss": removes prompt without changing timezone

---

## 3. Behavioral Parity Gaps

### 3.1 Auto-Default All Day on First Activation
**Web behavior:** When a date mode is first activated on a new chit (user clicks Start/End, Due, or Perpetual), all-day is automatically checked BUT time inputs remain visible. The `_allDayAutoDefaulted` flag prevents hiding time inputs. This auto-default is cleared if the user explicitly toggles the button.

**Android gap:** No auto-default behavior. All-day starts as false and stays false until explicitly toggled.

**Required change:** When switching from "None" to any date mode (Start/End, Due, Perpetual) on a new chit:
1. Set `allDay = true` automatically
2. BUT keep time picker buttons visible (don't hide them)
3. Track an `allDayAutoDefaulted` flag
4. If user explicitly taps the All Day button, clear the flag and apply normal show/hide behavior
5. If user picks a time via the time picker, auto-uncheck all-day

### 3.2 Auto-Uncheck All Day on Time Selection
**Web behavior:** When the user picks a time via the time picker, all-day is automatically unchecked.

**Android gap:** Not implemented. User must manually toggle all-day off before setting a time.

**Required change:** After confirming a time in the drum roller picker, if all-day is currently checked, automatically uncheck it.

### 3.3 Point in Time Auto-Populate
**Web behavior:** When Point in Time mode is first selected and the date is empty, `setPointInTimeNow()` is called automatically to populate with current date/time.

**Android gap:** Shows empty fields. User must tap "Now" manually.

**Required change:** When switching to Point in Time mode and `pointInTime` is null/empty, automatically set it to the current date/time.

### 3.4 Perpetual Mode Auto-Set Start Date
**Web behavior:** When Perpetual mode is selected and start date is empty, it auto-sets to today. Also shows description text: "Starts now, continues forever. (Started May 2, 2026.)"

**Android gap:** Sets `perpetual = true` but doesn't auto-set start date. No description text shown.

**Required changes:**
- When switching to Perpetual mode: if `startDatetime` is null, set it to today
- Clear `endDatetime` and end time
- Show description text: "Starts now, continues forever." (or with start date if set: "Starts now, continues forever. (Started [date].)")

### 3.5 "None" Mode Hidden When Habit Active
**Web behavior:** When habit toggle is on:
- "None" radio option is hidden and disabled
- All Day is forced ON and locked (disabled, opacity 0.6, title "Habits are always all-day")
- Repeat is auto-enabled with Daily frequency
- Repeat row is hidden (habit controls subsume it)
- Perpetual row becomes visible (only available for habits)
- Dates zone auto-expands if collapsed

**Android gap:** The habit toggle is in the Task zone. When enabled, it doesn't modify the DateZone behavior at all.

**Required changes:**
- When `formState.habit == true`:
  - Hide the "None" radio option
  - Force `allDay = true` and disable the All Day button (show as locked)
  - Auto-enable recurrence with Daily if not already set
  - Hide the repeat row (habit frequency is managed in the Habits zone)
  - Show the Perpetual option
  - If current mode is "None", auto-switch to Start/End or Perpetual

### 3.6 Contextual Recurrence Labels
**Web behavior:** Recurrence dropdown labels include date context:
- "Weekly on Saturday" (based on the start/due date's day of week)
- "Monthly on the 18th" (based on the start/due date's day of month)
- "Yearly on May 18th" (based on the start/due date's month and day)
- When habit is active: simplified labels without context ("Daily", "Weekly", "Monthly", "Yearly")

**Android gap:** Uses static labels: "Daily", "Weekly", "Monthly", "Yearly", "Custom".

**Required change:** Compute contextual labels from the active date field:
- Read the start date (or due date if in Due mode)
- Format: "Weekly on [DayName]", "Monthly on the [DayOfMonth]th", "Yearly on [MonthName] [DayOfMonth]"
- When habit is active: use simple labels

### 3.7 Recurrence "Ends Never" Default
**Web behavior:** "Ends never" checkbox is checked by default. Unchecking it reveals the until-date input.

**Android gap:** Shows both "Until" and "After" options simultaneously with no default state.

**Required change:**
- Default to "Ends never" (no until date, no count)
- Show a checkbox "Ends never" (checked by default)
- Only show the until-date picker when "Ends never" is unchecked
- Match the web's inline layout: checkbox on same line as "Ends never" text

### 3.8 Date Format Display
**Web behavior:** Dates display as "YYYY-Mon-DD" (e.g., "2026-May-18") in the input fields.

**Android gap:** Displays as "MMM d, yyyy" (e.g., "May 18, 2026") or ISO format.

**Required change:** Format dates as "YYYY-Mon-DD" in the date input fields to match the web exactly. This is the Flatpickr format used throughout CWOC.

### 3.9 Time Format Display
**Web behavior:**
- 24-hour mode: "14:30" (zero-padded hours and minutes)
- 12-hour mode: "2:30 PM" (no zero-pad on hours, AM/PM suffix)
- Empty state: "HH:MM" in muted color

**Android gap:** Uses Material 3 time formatting which may differ slightly.

**Required change:** Match the web's exact formatting:
- 24h: `String.format("%02d:%02d", hour, minute)`
- 12h: `String.format("%d:%02d %s", hour12, minute, ampm)` (no leading zero on hour)
- Empty: "HH:MM" text in color `#8b7355`

---

## 4. Interaction Parity Gaps

### 4.1 Tap Date Input → Opens Calendar
**Web:** Tapping the date input opens Flatpickr's custom calendar dropdown below the input.
**Android:** Tapping the calendar icon opens a full-screen DatePickerDialog.

**Acceptable difference:** The Material 3 DatePickerDialog is acceptable as a platform-appropriate equivalent. Both are custom calendars (not native date pickers). No change needed here.

### 4.2 Tap Time Button → Opens Drum Roller
**Web:** Tapping the time button opens the drum roller modal (slides down from top on mobile).
**Android:** Tapping the clock icon opens a Material 3 TimePicker (clock face) in an AlertDialog.

**Required change:** Replace with the custom drum roller picker (see Section 2.5). This is the most significant implementation task.

### 4.3 Tap Timezone Label → Opens Timezone Modal
**Web:** Tapping the timezone abbreviation label opens the timezone picker modal.
**Android:** The timezone is edited inline (no modal, no tap on abbreviation).

**Required change:** See Section 2.11. The abbreviation label must be tappable and open a modal.

### 4.4 ESC Key Behavior
**Web:** ESC closes the innermost open modal (time picker → timezone picker → Flatpickr) before reaching the page-level ESC handler.

**Android equivalent:** Back button/gesture should close the innermost open dialog/modal before navigating back. This is standard Android behavior and should already work with `AlertDialog`'s `onDismissRequest`. Verify that the drum roller modal and timezone modal both dismiss on back press.

### 4.5 Keyboard Input in Time Picker
**Web:** The drum roller has editable input fields overlaid on the highlight bar. Users can type hours/minutes directly (overwrite mode with validation).

**Android required:** The drum roller must support direct text input:
- Tapping the hour/minute display should make it editable
- First digit validates range (0-2 for 24h hours, 0-5 for minutes)
- After second digit, focus advances to next field
- Enter confirms, back/escape cancels

---

## 5. Theme & Typography Requirements

### 5.1 Font
All text in the Dates zone must use Lora serif (the app's custom font). This includes:
- Radio button labels
- Date input text
- Time button text
- Timezone labels
- Recurrence labels
- All modal text (drum roller, timezone picker)
- Button labels

### 5.2 Color Palette

| Element | Color |
|---------|-------|
| Zone body background | `#fff8dc` |
| Input/button background | `#fff8e1` |
| Input/button border | `#8b4513` (1dp solid) |
| Input border-radius | 3dp |
| Label text (bold) | `#4a2c2a` |
| Field text | `#1a1208` |
| Muted/placeholder text | `#8b7355` |
| All Day button (inactive) | bg `#a0522d`, text `#fdf5e6` |
| All Day button (active) | bg `#008080`, text `#fff8e1` |
| Teal accent (tz suggestion) | `#008080` |
| Zone button default | bg `#a0522d`, text `#fdf5e6`, border `#8b4513` |
| Separator text ("to") | `#4a2c2a` |
| Floating tz label | `#8b5a2b` at 55% opacity |
| Anchored tz label | `#1a1208` at 100% opacity, weight 500 |

### 5.3 Sizing

| Element | Size |
|---------|------|
| Radio buttons | 16dp diameter |
| Date input min-height | 38dp |
| Time button min-height | 34dp |
| Time button width | 80dp |
| Date input font | 16sp |
| Label font | 14sp bold |
| Zone button font | 12sp |
| Inline label (`.cwoc-inline-label-sm`) | ~13sp |
| Field gap (between inputs) | 6dp |
| Fields indent below radio | 22dp start padding |
| Row vertical spacing | 4dp |

---

## 6. Implementation Priority

### P0 — Critical (visually jarring differences)
1. **Drum roller time picker** — The clock face vs drum roller is the most obvious difference between app and browser
2. **All Day as button (not Switch)** — Switches don't exist in the web version
3. **Parchment-themed input fields** — Material 3 outlined fields look nothing like the web's brown-bordered parchment inputs
4. **Date format "YYYY-Mon-DD"** — Different format is immediately noticeable

### P1 — Important (functional differences)
5. **Timezone picker as modal** — Inline editing vs modal is a different interaction pattern
6. **Recurrence inline in dates zone** — Separate collapsible zone vs inline is structurally different
7. **Contextual recurrence labels** — "Weekly" vs "Weekly on Monday" is a noticeable content difference
8. **Field order in Start/End mode** — Start Date → Start Time → "to" → End Time → End Date

### P2 — Polish (subtle behavioral differences)
9. **Auto-default all-day on first activation**
10. **Auto-uncheck all-day on time selection**
11. **Point in Time auto-populate**
12. **Perpetual auto-set start date + description text**
13. **Habit mode interactions** (force all-day, hide None, etc.)
14. **Timezone floating vs anchored visual states**
15. **Timezone suggestion styled prompt**
16. **"Ends never" default for recurrence**

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `zones/DateZone.kt` | Major rewrite: remove EditorZoneHeader, restyle all fields, change layout, add auto-behaviors, merge recurrence inline |
| `zones/RecurrenceZone.kt` | Merge into DateZone as inline content (remove as separate zone) |
| NEW: `components/DrumRollerTimePicker.kt` | Custom drum roller time picker composable |
| NEW: `components/TimezonePickerModal.kt` | Custom timezone picker modal composable |
| `zones/EditorZoneNav.kt` | Remove "Recurrence" from zone list (merged into Dates) |
| `ChitEditorScreen.kt` | Remove separate RecurrenceZone rendering, pass habit state to DateZone |
| `ui/theme/` | Add parchment-themed input field styles, zone-button styles |

---

## 8. Acceptance Criteria

The implementation is complete when:
1. A user cannot tell whether they are looking at the mobile browser or the Android app when viewing the Dates & Times zone
2. All date modes (None, Start/End, Due, Point in Time, Perpetual) show identical fields in identical order with identical styling
3. The time picker is a drum roller (not a clock face)
4. The timezone picker is a modal (not inline)
5. The All Day control is a styled button (not a switch)
6. Recurrence options appear inline in the dates zone (not as a separate section)
7. All auto-behaviors fire correctly (auto-default all-day, auto-populate point-in-time, auto-set perpetual start date, auto-uncheck all-day on time pick)
8. Habit mode correctly locks/hides/forces date zone controls
9. All text uses Lora font with the parchment color palette
10. Date format displays as "YYYY-Mon-DD" and time as "HH:MM" or "H:MM AM/PM"
