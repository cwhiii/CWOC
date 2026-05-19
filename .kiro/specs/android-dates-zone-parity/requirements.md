# Requirements Document

## Introduction

This document specifies every requirement for making the Android app's "Dates & Times" zone in the chit editor visually and functionally identical to the mobile browser version. The authoritative reference is `Tasks/mobile-browser-dates-zone-spec.md`. After implementation, a user must not be able to distinguish whether they are using the mobile browser or the Android app. Every layout, color, font, spacing, border, animation, interaction, state transition, and behavioral rule must match exactly. No detail is too small to omit.

## Glossary

- **Dates_Zone**: The "Dates & Times" section of the chit editor (`#datesSection`), containing the zone container, zone header (actions row only on mobile), zone body with date mode radio group, date/time inputs, timezone controls, and recurrence settings
- **Zone_Container**: The outer wrapper element with background `#fff8dc`, no border-radius, no left/right borders, full width, flex: 1, min-height: 0 in mobile zone mode
- **Zone_Header**: The header area that on mobile shows only the zone-actions row (All Day button); title and toggle icon are hidden
- **Zone_Body**: The content area with flex column layout, padding 8dp 1em, width 100%, box-sizing border-box
- **Zone_Actions_Row**: A flex container with flex-wrap wrap, gap 6dp, width 100%, justify-content flex-start, containing the All Day toggle button
- **Date_Mode_Radio_Group**: The set of mutually exclusive radio buttons (None, Start/End, Due, Point in Time, Perpetual) rendered as a flex column with gap 0, width 100%, padding 0, margin 0
- **Date_Mode_Row**: A single row in the radio group rendered as flex column, align-items stretch, padding 4dp 0, margin 0
- **Date_Mode_Label**: The label cell containing radio + text, rendered as flex, align-items flex-start, gap 0, white-space nowrap, padding 0, margin 0
- **Date_Mode_Fields**: The fields cell below the label, with margin-left 22dp, width calc(100% - 22dp), padding-left 0, flex-wrap wrap, gap 6dp, box-sizing border-box
- **All_Day_Toggle**: A styled zone-button in the zone actions row that toggles whether time inputs are shown or hidden; has inactive, active, and disabled states
- **Zone_Button**: A styled button with padding 5dp 10dp, font-size 12sp, background `#a0522d`, color `#fdf5e6`, border 1px outset `#8b4513`, white-space nowrap; hover background `#924525`
- **Flatpickr_Calendar**: A custom calendar date picker dropdown (not native Android DatePicker) that renders when a date input is tapped, using Flatpickr's default styling, always used instead of native mobile date picker
- **Date_Input**: A styled text input with border 1px solid `#8b4513`, border-radius 3dp, background `#fff8e1`, font-family Lora, flex 1, min-width 80dp, max-width 100%, min-height 38dp, padding 4dp 8dp, font-size 16sp
- **Time_Button**: A styled button element with width 80dp, font-size 0.85em, padding 3dp 6dp, font-family Lora, border 1px solid `#8b4513`, border-radius 3dp, background `#fff8e1`, margin-right 4dp, cursor pointer, text-align center, line-height 22dp, color `#1a1208`, min-height 34dp
- **Drum_Roller_Picker**: The iOS-style scroll-snap time picker modal with hour/minute/ampm columns, a highlight bar with editable inputs, Cancel/Now/Set buttons, slide-down animation, and full Lora font styling
- **Drum_Column**: A scrollable column within the Drum_Roller_Picker using scroll-snap-type y mandatory, hidden scrollbars, 2 invisible padding items at top/bottom, and fade masks
- **Highlight_Bar**: The selection indicator in the Drum_Roller_Picker positioned at vertical center with background rgba(139, 90, 43, 0.1), top/bottom borders 1.5px solid rgba(139, 90, 43, 0.3), border-radius 6dp, pointer-events none
- **Input_Overlay**: Editable input fields positioned over the Highlight_Bar with font-size 1.5em, font-weight 700, font-family Lora, transparent background, and focus state with border-bottom 2dp solid `#6b4e31`
- **Timezone_Abbreviation_Label**: A tappable inline span showing the timezone abbreviation (e.g., "MST") with font-family Lora, font-size 0.8em, cursor pointer, padding 2dp 6dp, border-radius 3dp, margin-left 6dp, min-width 28dp, min-height 24dp (32dp on mobile), transition on background-color and color 0.2s
- **Floating_State**: Timezone label state when no explicit timezone is set — color `#8b5a2b`, opacity 0.55, normal font-weight, tooltip includes "(assumed — click to set)"
- **Anchored_State**: Timezone label state when explicit timezone is set — color `#1a1208`, opacity 1, font-weight 500
- **Timezone_Picker_Modal**: A modal overlay with fixed positioning, background rgba(0, 0, 0, 0.5), z-index 9999, centered content with background `#fffaf0`, border 2dp solid `#6b4e31`, border-radius 8dp, padding 16dp on mobile, width 95%, font-family Lora, box-shadow 0 8dp 32dp rgba(0, 0, 0, 0.3)
- **Timezone_Suggestion_Prompt**: An inline prompt with background rgba(0, 128, 128, 0.06), border 1px solid rgba(0, 128, 128, 0.3), border-radius 4dp, padding 6dp 10dp, font-size 0.85em, font-family Lora, flex-direction column on mobile
- **Recurrence_Row**: The repeat/recurrence controls rendered as a date-mode-row with checkbox, frequency dropdown, custom recurrence builder, ends-never checkbox, and until-date input
- **Custom_Recurrence_Block**: The expanded custom recurrence options showing interval number input, unit dropdown, and by-day checkboxes (when unit is weeks)
- **Perpetual_Row**: The date mode option visible only when habit is active, showing description text "Starts now, continues forever"
- **Date_Mode_Separator**: A span with text "to" separating start and end fields in Start/End mode
- **Minute_Step**: The configurable snap interval for time picker minutes (default 5, from settings `calendar_snap`)
- **Parchment_Theme**: The CWOC visual theme using Lora serif font, brown tones, parchment backgrounds (`#fff8dc`, `#fff8e1`, `#fffaf0`), borders `#8b4513`, and 1940s aesthetic
- **Mobile_Zone_Mode**: The layout mode (viewport ≤768px) where zone titles/toggles are hidden, zones fill full width with no border-radius and no left/right borders, navigation handled by zone nav bar
- **Auto_Default_Flag**: The `_allDayAutoDefaulted` flag that prevents hiding time inputs when all-day is auto-checked on first date mode activation
- **Recurrence_Icon**: The icon shown in the editor title accessories area — 🔁 when repeat is enabled, 🎯 when habit is active, font-size 1.1em, opacity 0.7

## Requirements

### Requirement 1: Zone Container Structure

**User Story:** As a user, I want the Dates zone container on Android to have the exact same structure, background, borders, and layout as the mobile browser, so that the zone framing is indistinguishable.

#### Acceptance Criteria

1. THE Zone_Container SHALL render with background `#fff8dc`, no border-radius, no left border, no right border, full width, flex 1, and min-height 0
2. THE Zone_Container SHALL render with overflow visible
3. THE Zone_Header SHALL render as a flex row with no border, no background, padding 6dp 1em, margin 0, and min-height auto
4. THE Zone_Header SHALL hide the zone title text "🗓️ Dates & Times" and the zone toggle icon (🔼/🔽) in Mobile_Zone_Mode
5. THE Zone_Actions_Row SHALL render as a flex container with flex-wrap wrap, gap 6dp, width 100%, and justify-content flex-start
6. THE Zone_Actions_Row SHALL contain only the All_Day_Toggle button (plus hidden checkbox elements)
7. THE Zone_Body SHALL render with display flex, flex-direction column, padding 8dp 1em, width 100%, and box-sizing border-box
8. THE Zone_Container SHALL NOT support collapsed state in Mobile_Zone_Mode (no opacity changes, no height restriction)

### Requirement 2: Date Mode Radio Group Layout and Structure

**User Story:** As a user, I want the date mode radio group on Android to have the exact same flex-column layout, row structure, label positioning, and field indentation as the mobile browser.

#### Acceptance Criteria

1. THE Date_Mode_Radio_Group SHALL render as a flex column with gap 0, width 100%, padding 0, and margin 0
2. EACH Date_Mode_Row SHALL render as flex column with align-items stretch, padding 4dp 0, and margin 0
3. EACH Date_Mode_Label SHALL render as flex with align-items flex-start, gap 0, white-space nowrap, padding 0, margin 0, min-width 0, and width auto
4. EACH Date_Mode_Fields container SHALL render with margin-left 22dp, width calc(100% - 22dp), padding-left 0, flex-wrap wrap, gap 6dp, and box-sizing border-box
5. ALL radio buttons SHALL render at exactly 16×16dp with min-width 16dp, min-height 16dp, margin 2dp 6dp 0 0, padding 0, flex-shrink 0, and flex-grow 0
6. ALL checkbox inputs SHALL render at exactly 16×16dp with the same margin and sizing rules as radio buttons
7. THE Date_Mode_Radio_Group SHALL contain exactly five options: None, Start/End, Due, Point in Time, and Perpetual (Perpetual hidden by default)

### Requirement 3: All Day Toggle Button

**User Story:** As a user, I want the All Day toggle on Android to be a styled zone-button (not a Material Switch) with the exact same three visual states, auto-default behavior, and auto-deselect behavior as the mobile browser.

#### Acceptance Criteria

1. THE All_Day_Toggle SHALL render as a Zone_Button containing icon "🗓️" and text "All Day" (with `.hideWhenNarrow` label shown on mobile)
2. WHEN the All_Day_Toggle is inactive, THE All_Day_Toggle SHALL display with background `#a0522d`, color `#fdf5e6`, border 1px outset `#8b4513`, text "🗓️ All Day", and opacity 1
3. WHEN the All_Day_Toggle is active, THE All_Day_Toggle SHALL display with background `#008080`, color `#fff8e1`, border color `#006060`, text "🗓️ All Day ✓", and opacity 1
4. WHEN the All_Day_Toggle is disabled (habit active), THE All_Day_Toggle SHALL display with background `#008080`, color `#fff8e1`, border `#006060`, text "🗓️ All Day ✓", opacity 0.6, and pointer-events none
5. WHEN the All_Day_Toggle is tapped, THE All_Day_Toggle SHALL toggle the hidden all-day checkbox state and call the toggle-all-day logic to hide/show time inputs
6. WHEN the All_Day_Toggle is active (all-day checked), THE Dates_Zone SHALL hide all time buttons (start_time, end_time, due_time) while keeping date inputs and the "to" separator visible
7. WHEN the All_Day_Toggle is inactive (all-day unchecked), THE Dates_Zone SHALL show all time buttons
8. WHEN a date mode is first activated (user selects Start/End, Due, or Perpetual), THE All_Day_Toggle SHALL auto-default to checked BUT time inputs SHALL remain visible (Auto_Default_Flag prevents hiding)
9. WHEN the user explicitly taps the All_Day_Toggle, THE Auto_Default_Flag SHALL be cleared
10. WHEN the user picks a time via the Drum_Roller_Picker, THE All_Day_Toggle SHALL automatically deselect (uncheck)
11. THE All_Day_Toggle SHALL be hidden (display none) when date mode is "None" or "Point in Time"
12. THE All_Day_Toggle SHALL be visible when date mode is "Start/End", "Due", or "Perpetual"
13. THE All_Day_Toggle SHALL use Zone_Button base styling: padding 5dp 10dp, font-size 12sp, white-space nowrap
14. WHEN the All_Day_Toggle is hovered/pressed, THE All_Day_Toggle SHALL show background `#924525` (inactive state only)

### Requirement 4: Date Mode "None" Option

**User Story:** As a user, I want the "None" date mode on Android to behave exactly like the mobile browser — hiding all fields and controls when selected, and being hidden/disabled when habit is active.

#### Acceptance Criteria

1. THE "None" Date_Mode_Row SHALL contain a radio button with value "none" and label text "None"
2. THE "None" Date_Mode_Row SHALL have no Date_Mode_Fields content (empty)
3. WHEN "None" is selected, THE Dates_Zone SHALL hide all date fields, the All_Day_Toggle, the Recurrence_Row, and all Timezone_Abbreviation_Labels
4. THE "None" radio SHALL be checked by default when no date data exists on the chit
5. WHEN habit mode is active, THE "None" Date_Mode_Row SHALL be hidden (display none) and the radio SHALL be disabled with title "Habits require a date"

### Requirement 5: Date Mode "Start/End" Option

**User Story:** As a user, I want the Start/End date mode on Android to show the exact same field order, separator, and layout as the mobile browser.

#### Acceptance Criteria

1. THE "Start/End" Date_Mode_Row SHALL contain a radio button with value "startend" and label text "🗓️ Start/End"
2. WHEN "Start/End" is selected, THE Date_Mode_Fields SHALL show fields in this exact order: Start Date input → Start Time button → "to" separator → End Time button → End Date input → Timezone_Abbreviation_Label
3. THE Date_Mode_Separator "to" SHALL render as a span between start time and end time
4. WHEN "Start/End" is selected, THE All_Day_Toggle SHALL be visible and the Recurrence_Row SHALL be visible
5. THE start date input SHALL have placeholder "Start Date" and id-equivalent "start_datetime"
6. THE end date input SHALL have placeholder "End Date" and id-equivalent "end_datetime"
7. THE start time button SHALL have default text "HH:MM" and open the Drum_Roller_Picker on tap
8. THE end time button SHALL have default text "HH:MM" and open the Drum_Roller_Picker on tap

### Requirement 6: Date Mode "Due" Option

**User Story:** As a user, I want the Due date mode on Android to show the exact same fields including the due-complete checkbox with the same conditional visibility and sync behavior as the mobile browser.

#### Acceptance Criteria

1. THE "Due" Date_Mode_Row SHALL contain a radio button with value "due" and label text "⏳ Due"
2. WHEN "Due" is selected, THE Date_Mode_Fields SHALL show: Due Date input → Due Time button → Complete checkbox (conditional) → Timezone_Abbreviation_Label
3. THE due date input SHALL have placeholder "Due Date" and id-equivalent "due_datetime"
4. THE due time button SHALL have default text "HH:MM" and open the Drum_Roller_Picker on tap
5. THE Complete checkbox SHALL be hidden by default and shown only when a status is set on the chit
6. THE Complete checkbox SHALL render with margin-left 8dp, align-items center, gap 4dp, font-size 0.85em, cursor pointer, and title "Yes, this is the same as the 'Status' Complete."
7. WHEN the Complete checkbox is toggled, THE Dates_Zone SHALL sync with the Task zone's status dropdown
8. WHEN "Due" is selected, THE All_Day_Toggle SHALL be visible and the Recurrence_Row SHALL be visible

### Requirement 7: Date Mode "Point in Time" Option

**User Story:** As a user, I want the Point in Time date mode on Android to auto-populate with the current date/time on first selection and show a "Now" button, exactly like the mobile browser.

#### Acceptance Criteria

1. THE "Point in Time" Date_Mode_Row SHALL contain a radio button with value "pointintime" and label text "📌 Point in Time"
2. WHEN "Point in Time" is selected, THE Date_Mode_Fields SHALL show: Date input → Time button → "Now" Zone_Button → Timezone_Abbreviation_Label
3. WHEN "Point in Time" is first selected and the date is empty, THE Dates_Zone SHALL automatically call the set-now function to populate with current date and time
4. THE "Now" button SHALL be a Zone_Button with title "Set to current date and time" that sets both date and time to the current moment when tapped
5. WHEN "Point in Time" is selected, THE All_Day_Toggle SHALL be hidden
6. WHEN "Point in Time" is selected, THE Recurrence_Row SHALL be hidden
7. THE point-in-time date input SHALL have placeholder "Date"
8. THE point-in-time time button SHALL have default text "HH:MM" and open the Drum_Roller_Picker on tap

### Requirement 8: Date Mode "Perpetual" Option

**User Story:** As a user, I want the Perpetual date mode on Android to be visible only when habit is active, auto-set the start date, clear the end date, and show the same description text as the mobile browser.

#### Acceptance Criteria

1. THE "Perpetual" Date_Mode_Row SHALL contain a radio button with value "perpetual" and label text "♾️ Perpetual"
2. THE "Perpetual" Date_Mode_Row SHALL be hidden by default (display none) and only visible when habit mode is active
3. WHEN "Perpetual" is selected, THE Date_Mode_Fields SHALL show a description span with text "Starts now, continues forever" in color `#6b4e31` and class cwoc-inline-label-sm (font-size 0.85em)
4. WHEN "Perpetual" is selected and a start date exists, THE description SHALL append " (Started [date].)" (e.g., "Starts now, continues forever. (Started May 2, 2026.)")
5. WHEN "Perpetual" is selected, THE Dates_Zone SHALL set start date to today if empty
6. WHEN "Perpetual" is selected, THE Dates_Zone SHALL clear end date and end time
7. WHEN "Perpetual" is selected, THE All_Day_Toggle SHALL be visible and the Recurrence_Row SHALL be hidden (habit manages recurrence)

### Requirement 9: Date Input Fields (Flatpickr-Style Calendar)

**User Story:** As a user, I want date inputs on Android to use a Flatpickr-style custom calendar picker (never a native Android DatePickerDialog) with the exact same date format, styling, and callbacks as the mobile browser.

#### Acceptance Criteria

1. THE Dates_Zone SHALL render all date inputs as Date_Input elements: border 1px solid `#8b4513`, border-radius 3dp, background `#fff8e1`, font-family Lora, font-size 16sp, min-height 38dp, padding 4dp 8dp, flex 1, min-width 80dp, max-width 100%, box-sizing border-box
2. WHEN a date input is tapped, THE Dates_Zone SHALL open a Flatpickr-style calendar dropdown (NOT a native Android DatePickerDialog) — the `disableMobile: true` equivalent must be enforced
3. THE Flatpickr_Calendar SHALL use date format "Y-M-d" displaying dates as "YYYY-Mon-DD" (e.g., "2026-May-18")
4. THE Flatpickr_Calendar SHALL render as a dropdown below the input field on mobile
5. WHEN the start date is changed, THE Dates_Zone SHALL update recurrence labels and refresh weather data
6. WHEN the due date is changed, THE Dates_Zone SHALL update recurrence labels and refresh weather data
7. WHEN the point-in-time date is changed, THE Dates_Zone SHALL refresh weather data
8. THE Flatpickr_Calendar SHALL close when Escape is pressed (before any other ESC handler fires)
9. THE Dates_Zone SHALL convert dates to ISO format for API calls using month abbreviation to number mapping
10. THE date inputs SHALL have margin-right 4dp between adjacent elements

### Requirement 10: Time Button Styling and Value Storage

**User Story:** As a user, I want time buttons on Android to look exactly like the mobile browser's styled buttons with the same empty/filled states, the same value storage mechanism, and the same display formatting.

#### Acceptance Criteria

1. THE Dates_Zone SHALL render all time buttons as Time_Button elements: width 80dp, font-size 0.85em, padding 3dp 6dp, font-family Lora, border 1px solid `#8b4513`, border-radius 3dp, background `#fff8e1`, margin-right 4dp, cursor pointer, text-align center, display inline-block, line-height 22dp, color `#1a1208`, min-height 34dp
2. WHEN a time button has no value, THE time button SHALL display text "HH:MM" with color `#8b7355` (muted brown, empty state class)
3. WHEN a time button has a value in 24-hour mode, THE time button SHALL display zero-padded hours and minutes (e.g., "14:30")
4. WHEN a time button has a value in 12-hour mode, THE time button SHALL display hours without zero-pad plus AM/PM suffix (e.g., "2:30 PM")
5. THE time button SHALL store its value internally in 24-hour format (e.g., "14:30") regardless of display preference
6. WHEN a time button is tapped, THE Dates_Zone SHALL open the Drum_Roller_Picker
7. WHEN a time button is in active/pressed state, THE time button SHALL show background rgba(139, 90, 43, 0.15)
8. THE time button SHALL suppress default tap highlight and use tap-highlight-color rgba(139, 90, 43, 0.2)

### Requirement 11: Drum Roller Time Picker — Modal Structure and Animation

**User Story:** As a user, I want the time picker modal on Android to slide down from the top with the exact same overlay, modal styling, and animation as the mobile browser.

#### Acceptance Criteria

1. WHEN a time button is tapped, THE Drum_Roller_Picker SHALL display a fixed overlay covering the entire screen with background rgba(0, 0, 0, 0.5) and z-index 999999
2. THE overlay SHALL fade in from opacity 0 to opacity 1 over 0.2s with ease timing
3. THE Drum_Roller_Picker modal SHALL render with background `#fffaf0`, border-bottom 3dp solid `#6b4e31`, border-radius 0 0 16dp 16dp, width 100%, max-width 400dp, padding 16dp 12dp 24dp, box-shadow 0 4dp 20dp rgba(0, 0, 0, 0.2), and font-family Lora
4. THE Drum_Roller_Picker modal SHALL animate by sliding down from the top: translateY(-100%) to translateY(0) over 0.3s with cubic-bezier(0.32, 0.72, 0, 1) timing
5. THE Drum_Roller_Picker modal SHALL be positioned at the top of the viewport (align-items flex-start on the overlay, justify-content center)
6. THE Drum_Roller_Picker header SHALL display text "Select Time" with text-align center, font-size 1.1em, font-weight 600, color `#3a2a14`, and margin-bottom 12dp
7. WHEN the user taps outside the modal (on the overlay), THE Drum_Roller_Picker SHALL close without changing the time value (cancel behavior)

### Requirement 12: Drum Roller Time Picker — Drum Columns and Scroll Behavior

**User Story:** As a user, I want the drum roller columns on Android to scroll with snap behavior, show the same item styling, fade masks, and padding items as the mobile browser.

#### Acceptance Criteria

1. THE Drum_Roller_Picker drums container SHALL render with display flex, align-items center, justify-content center, gap 0, position relative, height 200dp, margin 0 auto, and max-width 300dp
2. WHEN the screen width is ≤380dp, THE drums container SHALL use height 180dp
3. WHEN in 24-hour mode, THE Drum_Roller_Picker SHALL show 2 Drum_Columns (hour, minute) separated by a colon separator
4. WHEN in 12-hour mode, THE Drum_Roller_Picker SHALL show 3 Drum_Columns (hour, minute, AM/PM) with a colon separator between hour and minute
5. THE hour Drum_Column in 24-hour mode SHALL contain items 00–23 (zero-padded)
6. THE hour Drum_Column in 12-hour mode SHALL contain items 1–12 (no zero-pad)
7. THE minute Drum_Column SHALL contain items from 0 to 55 in steps of the configured Minute_Step (default 5), zero-padded (00, 05, 10, 15, ...)
8. THE AM/PM Drum_Column (12-hour mode only) SHALL contain exactly two items: "AM" and "PM"
9. EACH drum item SHALL render with height 40dp, font-size 1.4em, color `#6b4e31`, opacity 0.4, and scroll-snap-align center
10. WHEN the screen width is ≤380dp, EACH drum item SHALL use height 36dp, font-size 1.2em
11. THE selected (centered) drum item SHALL render with opacity 1, font-size 1.6em, font-weight 700, color transparent (hidden behind input overlay), and transform scale(1.05)
12. WHEN the screen width is ≤380dp, THE selected item SHALL use font-size 1.4em
13. EACH Drum_Column SHALL use scroll-snap-type y mandatory with hidden scrollbars (scrollbar-width none, webkit-scrollbar display none)
14. EACH Drum_Column SHALL have 2 invisible padding items at top and 2 at bottom (opacity 0, pointer-events none) to allow first/last items to center
15. EACH Drum_Column SHALL render fade masks at top and bottom as gradients from `#fffaf0` to transparent, height 60dp, pointer-events none
16. WHEN a non-centered item is tapped, THE Drum_Column SHALL scroll that item to center with smooth behavior
17. THE colon separator between drums SHALL render with font-size 1.8em, font-weight bold, color `#3a2a14`, padding 0 2dp, user-select none, and line-height matching drum height (200dp or 180dp)
18. THE drum scroll position SHALL sync to the editable input fields (unless the user is actively typing in the input)

### Requirement 13: Drum Roller Time Picker — Highlight Bar and Editable Input Overlay

**User Story:** As a user, I want the highlight bar and editable inputs on Android to look and function exactly like the mobile browser, with the same positioning, styling, focus states, and overwrite-mode keyboard behavior.

#### Acceptance Criteria

1. THE Highlight_Bar SHALL render with position absolute, top 50%, left 8dp, right 8dp, height 40dp, transform translateY(-50%), background rgba(139, 90, 43, 0.1), border-top 1.5dp solid rgba(139, 90, 43, 0.3), border-bottom 1.5dp solid rgba(139, 90, 43, 0.3), border-radius 6dp, pointer-events none, and z-index 1
2. WHEN the screen width is ≤380dp, THE Highlight_Bar SHALL use height 36dp
3. THE Input_Overlay SHALL render with position absolute, top 50%, left 50%, transform translate(-50%, -50%), display flex, align-items center, justify-content center, gap 2dp, and z-index 10
4. THE hour input field SHALL render with width 2.2em, font-size 1.5em, font-weight 700, font-family Lora, text-align center, border none, border-bottom 2dp solid transparent, background transparent, color `#1a1208`, and caret-color `#6b4e31`
5. WHEN the hour input is focused, THE hour input SHALL show border-bottom-color `#6b4e31`, background rgba(255, 250, 240, 0.8), and border-radius 4dp 4dp 0 0
6. THE colon separator in the Input_Overlay SHALL render with font-size 1.5em, font-weight 700, and color `#1a1208`
7. THE minute input field SHALL have the same styling as the hour input field
8. THE AM/PM input field (12-hour mode only) SHALL render with width 2.4em, font-size 1.2em, and margin-left 4dp (plus same base styling as hour/minute inputs)
9. THE hour input SHALL use overwrite mode: first digit validates range (0–2 for 24h, 0–1 for 12h), second digit validates full number (0–23 or 1–12), then focus advances to minute field
10. THE minute input SHALL use overwrite mode: validates 0–59, after second digit focus advances to AM/PM field (if 12-hour) or stays
11. THE AM/PM input SHALL accept typing 'a'/'A' to set AM and 'p'/'P' to set PM
12. WHEN Enter is pressed in any input field, THE Drum_Roller_Picker SHALL confirm the selection and close
13. WHEN Escape is pressed, THE Drum_Roller_Picker SHALL cancel and close (captured in capture phase, stopping propagation to prevent other ESC handlers from firing)
14. THE editable inputs SHALL allow ANY minute value 0–59 regardless of Minute_Step — the drum SHALL scroll to the nearest snap value for visual feedback only

### Requirement 14: Drum Roller Time Picker — Buttons and Actions

**User Story:** As a user, I want the Cancel/Now/Set buttons on Android to have the exact same styling, layout, and behavior as the mobile browser time picker buttons.

#### Acceptance Criteria

1. THE Drum_Roller_Picker buttons row SHALL render with display flex, gap 10dp, margin-top 16dp, and padding 0 8dp
2. THE "Cancel" button SHALL render with flex 1, padding 10dp 12dp, border-radius 8dp, font-family Lora, font-size 0.95em, font-weight 600, text-align center, background `#f5e6cc`, color `#6b4e31`, and border 1.5dp solid `#6b4e31`
3. THE "Now" button SHALL render with flex 1, padding 10dp 12dp, border-radius 8dp, font-family Lora, font-size 0.95em, font-weight 600, text-align center, background `#e8dcc8`, color `#3a2a14`, and border 1.5dp solid `#6b4e31`
4. THE "Set" button SHALL render with flex 1, padding 10dp 12dp, border-radius 8dp, font-family Lora, font-size 0.95em, font-weight 600, text-align center, background `#6b4e31`, color `#fff8e1`, and border 1.5dp solid `#4a3520`
5. WHEN any button is in active/pressed state, THE button SHALL show transform scale(0.96)
6. WHEN "Cancel" is tapped, THE Drum_Roller_Picker SHALL close without changing the time value
7. WHEN "Now" is tapped, THE Drum_Roller_Picker SHALL set drums and inputs to the current time rounded to the nearest Minute_Step increment
8. WHEN "Set" is tapped, THE Drum_Roller_Picker SHALL read hour/minute/ampm from inputs, convert to 24-hour format, store in the triggering time button's value, update the button's display text, fire a change event, mark the editor as unsaved, and close the modal

### Requirement 15: Drum Roller Time Picker — Time Format Detection

**User Story:** As a user, I want the time picker on Android to respect the same time format settings (24-hour, 12-hour, 12-hour-analog) as the mobile browser, showing/hiding the AM/PM drum accordingly.

#### Acceptance Criteria

1. THE Drum_Roller_Picker SHALL read the time format from the app's settings (equivalent to `window._editorTimeFormat` or `window._globalTimeFormat`)
2. WHEN the time format is "24hour" (default), THE Drum_Roller_Picker SHALL show only hour and minute drums (no AM/PM)
3. WHEN the time format is "12hour" or "12houranalog", THE Drum_Roller_Picker SHALL show hour, minute, and AM/PM drums
4. THE Minute_Step SHALL be read from the app's settings (equivalent to `calendar_snap`, default 5)
5. THE Minute_Step SHALL determine which minute values appear in the minute drum (e.g., step=15 shows 00, 15, 30, 45)

### Requirement 16: Timezone Abbreviation Labels

**User Story:** As a user, I want timezone abbreviation labels on Android to show the exact same floating/anchored states, styling, tooltip content, hover effect, and tap behavior as the mobile browser.

#### Acceptance Criteria

1. THE Dates_Zone SHALL inject a Timezone_Abbreviation_Label as the last child element in each visible Date_Mode_Fields container (startEndFields, dueFields, pointInTimeFields)
2. THE Timezone_Abbreviation_Label SHALL render with display inline-flex, align-items center, font-family Lora, font-size 0.8em, cursor pointer, padding 2dp 6dp, border-radius 3dp, margin-left 6dp, white-space nowrap, min-width 28dp, min-height 24dp, justify-content center, and transition on background-color and color over 0.2s
3. WHEN on mobile (≤600dp), THE Timezone_Abbreviation_Label SHALL use min-height 32dp, min-width 36dp, padding 4dp 8dp, and font-size 0.85em
4. WHEN no explicit timezone is set (Floating_State), THE Timezone_Abbreviation_Label SHALL render with color `#8b5a2b`, opacity 0.55, and normal font-weight
5. WHEN an explicit timezone is set (Anchored_State), THE Timezone_Abbreviation_Label SHALL render with color `#1a1208`, opacity 1, and font-weight 500
6. THE Timezone_Abbreviation_Label SHALL display the short timezone abbreviation (e.g., "MST", "PST", "EDT") derived via platform timezone APIs (equivalent to Intl.DateTimeFormat with timeZoneName short)
7. IF the abbreviation is unavailable, THEN THE Timezone_Abbreviation_Label SHALL fall back to the full IANA timezone name
8. THE Timezone_Abbreviation_Label SHALL show a multi-line tooltip containing: Line 1 abbreviation, Line 2 long name (e.g., "Mountain Standard Time"), Line 3 IANA identifier (e.g., "America/Denver"), Line 4 (floating only) "(assumed — click to set)"
9. WHEN a Timezone_Abbreviation_Label is tapped, THE Dates_Zone SHALL open the Timezone_Picker_Modal
10. WHEN the Timezone_Abbreviation_Label is hovered/pressed, THE label SHALL show background rgba(139, 90, 43, 0.1)
11. WHEN the date mode is "None", THE Dates_Zone SHALL hide all Timezone_Abbreviation_Labels

### Requirement 17: Timezone Picker Modal — Structure and Styling

**User Story:** As a user, I want the timezone picker modal on Android to have the exact same overlay, modal content, title, search input, hint text, status display, and action buttons as the mobile browser.

#### Acceptance Criteria

1. THE Timezone_Picker_Modal overlay SHALL render with position fixed, top 0, left 0, width 100%, height 100%, background rgba(0, 0, 0, 0.5), z-index 9999, display flex, align-items center, and justify-content center
2. THE Timezone_Picker_Modal content SHALL render with background `#fffaf0`, border 2dp solid `#6b4e31`, border-radius 8dp, padding 16dp (mobile), min-width 0 (mobile), width 95% (mobile), font-family Lora, and box-shadow 0 8dp 32dp rgba(0, 0, 0, 0.3)
3. THE Timezone_Picker_Modal title SHALL render as "Set Timezone" with margin 0 0 16dp 0, color `#4a2c2a`, and font-size 1.1em
4. THE search input SHALL render with width 100%, padding 8dp 10dp, font-family Lora, font-size 16sp (mobile), color `#1a1208`, background `#fff8f0`, border 1dp solid `#a0522d`, border-radius 4dp, box-sizing border-box, min-height 38dp, placeholder "Search timezone or address…" in color `#c9b896` italic
5. WHEN the search input is focused, THE input SHALL show border-color teal and box-shadow 0 0 0 2dp rgba(0, 128, 128, 0.2)
6. THE hint text SHALL render as "(or enter address)" with margin 6dp 0 12dp 0, font-size 0.85em, color `#8b5a2b`, and font-style italic
7. THE status display SHALL render with display block, min-height 1.2em, margin-bottom 12dp, color `#2e7d32`, font-size 0.9em, and font-weight 500
8. THE status display SHALL show "✓ [timezone]" for valid selection, "🔍 Looking up…" during geocoding, and "⚠️ No results" on failure
9. THE action buttons container SHALL render with display flex, gap 8dp, justify-content flex-end; on mobile: flex-direction column with buttons at width 100% and min-height 38dp
10. THE "Clear (floating)" button SHALL be a Zone_Button that removes the timezone and reverts to Floating_State
11. THE "Cancel" button SHALL be a Zone_Button that closes the modal without changes

### Requirement 18: Timezone Picker Modal — Input Behavior and Datalist

**User Story:** As a user, I want the timezone picker search on Android to auto-validate against a datalist of timezones, support geocoding on Enter, and auto-close on valid selection — exactly like the mobile browser.

#### Acceptance Criteria

1. THE Timezone_Picker_Modal SHALL provide a searchable datalist populated with common timezone entries at the top (18 entries: US time zones, European, Asian, Australian, NZ) in format "MST - Mountain Time (America/Denver)"
2. THE datalist SHALL also contain all IANA timezones from the platform's supported timezone list
3. WHEN the user types a valid IANA timezone name that matches the datalist, THE Timezone_Picker_Modal SHALL auto-validate, show "✓ [timezone]" in the status display, and auto-close after 200ms delay applying the timezone
4. WHEN the user selects an entry from the datalist dropdown, THE Timezone_Picker_Modal SHALL treat it the same as typing a valid timezone — auto-validate and apply
5. WHEN the user types an address/place name and presses Enter (and it does not match a timezone), THE Timezone_Picker_Modal SHALL trigger geocoding via `/api/geocode?q=[query]`
6. WHEN geocoding succeeds, THE Timezone_Picker_Modal SHALL detect the timezone from coordinates, show "✓ [timezone] (from "[query]")" in the status display, auto-apply after 200ms, and populate the Location zone with the geocoded address
7. WHEN geocoding fails, THE Timezone_Picker_Modal SHALL show "⚠️ No results" in the status display
8. WHEN the user taps outside the modal, THE Timezone_Picker_Modal SHALL close without applying changes
9. WHEN Escape is pressed, THE Timezone_Picker_Modal SHALL close without applying changes (captured in capture phase, calling stopImmediatePropagation and preventDefault)
10. IF the chit already has an explicit timezone, THEN THE Timezone_Picker_Modal SHALL pre-fill the search input with the IANA name and show "✓ [timezone]" in the status display on open

### Requirement 19: Timezone Suggestion Prompt

**User Story:** As a user, I want the timezone suggestion prompt on Android to appear under the exact same conditions, with the exact same styling and button behavior, as the mobile browser.

#### Acceptance Criteria

1. WHEN a location is geocoded in the Location zone AND the detected timezone differs from the current timezone AND no explicit timezone is already set AND date mode is not "None", THE Dates_Zone SHALL display the Timezone_Suggestion_Prompt
2. THE Timezone_Suggestion_Prompt SHALL be injected into the first visible Date_Mode_Fields container (startEndFields, dueFields, or pointInTimeFields)
3. THE Timezone_Suggestion_Prompt SHALL render with display flex, align-items center, gap 8dp, padding 6dp 10dp, margin-top 6dp, background rgba(0, 128, 128, 0.06), border 1dp solid rgba(0, 128, 128, 0.3), border-radius 4dp, font-size 0.85em, color `#1a1208`, and font-family Lora
4. ON mobile (≤600dp), THE Timezone_Suggestion_Prompt SHALL use flex-direction column, align-items stretch, and gap 6dp
5. THE Timezone_Suggestion_Prompt text SHALL read "📍 Detected: [timezone IANA name]" with flex 1
6. THE "Use" button SHALL render with background teal (`#008080`), color `#fffaf0`, padding 3dp 10dp, font-size 0.85em, border-radius 4dp, border 1dp outset `#8b5a2b`; on mobile: text-align center, padding 8dp 12dp, min-height 38dp
7. THE "Dismiss" button SHALL render with background `#f5ebe0`, color `#1a1208`, same sizing as Use button; hover background `#e8d5c0`
8. WHEN "Use" is tapped, THE Dates_Zone SHALL set the chit timezone to the detected timezone, update all Timezone_Abbreviation_Labels to Anchored_State, mark the editor as unsaved, and remove the prompt
9. WHEN "Dismiss" is tapped, THE Dates_Zone SHALL remove the prompt element without changing the timezone
10. WHEN the "Use" button is hovered/pressed, THE button SHALL show background `#006666`

### Requirement 20: Repeat/Recurrence Row — Structure and Visibility

**User Story:** As a user, I want the repeat row on Android to have the exact same checkbox, inline options layout, and visibility rules as the mobile browser.

#### Acceptance Criteria

1. THE Recurrence_Row SHALL render as a Date_Mode_Row with a label containing a checkbox and text "🔁 Repeat"
2. THE Recurrence_Row SHALL be hidden by default (display none) and shown only when date mode is "Start/End" or "Due"
3. THE Recurrence_Row SHALL be hidden when date mode is "None", "Point in Time", or when habit mode is active
4. WHEN the repeat checkbox is checked, THE Recurrence_Row SHALL show inline options (frequency dropdown, ends-never checkbox, and conditionally the end-date input)
5. WHEN the repeat checkbox is unchecked, THE Recurrence_Row SHALL hide all inline options
6. THE Recurrence_Row SHALL get a greyed-out class (opacity 0.3, pointer-events none) when date mode is "None" or "Point in Time"

### Requirement 21: Repeat/Recurrence Row — Frequency Dropdown and Contextual Labels

**User Story:** As a user, I want the frequency dropdown on Android to show the same contextual labels that update based on the active date, exactly like the mobile browser.

#### Acceptance Criteria

1. THE frequency dropdown SHALL contain options: Daily, Weekly (contextual), Monthly (contextual), Yearly (contextual), and "Custom…"
2. WHEN a start or due date is set, THE "Weekly" option SHALL display as "Weekly on [day name]" (e.g., "Weekly on Saturday")
3. WHEN a start or due date is set, THE "Monthly" option SHALL display as "Monthly on the [date]th" (e.g., "Monthly on the 18th")
4. WHEN a start or due date is set, THE "Yearly" option SHALL display as "Yearly on [month] [date]th" (e.g., "Yearly on May 18th")
5. WHEN the active date changes, THE frequency dropdown labels SHALL update to reflect the new day/date context
6. WHEN habit mode is active, THE frequency dropdown labels SHALL simplify to just "Daily", "Weekly", "Monthly", "Yearly" without day/date context
7. THE frequency dropdown SHALL use font-family Lora and width auto styling

### Requirement 22: Repeat/Recurrence Row — Ends Never and Until Date

**User Story:** As a user, I want the ends-never checkbox and until-date input on Android to behave exactly like the mobile browser, with the same conditional visibility and Flatpickr picker.

#### Acceptance Criteria

1. THE "Ends never" checkbox SHALL render as an inline label with class cwoc-inline-label-sm (font-size 0.85em) and margin-left 8dp, checked by default
2. WHEN "Ends never" is checked, THE until-date input SHALL be hidden
3. WHEN "Ends never" is unchecked, THE until-date input SHALL be shown
4. THE until-date input SHALL be a Date_Input with placeholder "End date", width 90dp, and Flatpickr calendar picker with format "Y-M-d"
5. WHEN habit mode is active, THE "Ends never" checkbox SHALL be forced to checked

### Requirement 23: Repeat/Recurrence Row — Custom Recurrence Block

**User Story:** As a user, I want the custom recurrence builder on Android to show the exact same interval input, unit dropdown, and by-day checkboxes as the mobile browser.

#### Acceptance Criteria

1. WHEN "Custom…" is selected from the frequency dropdown, THE Custom_Recurrence_Block SHALL become visible
2. THE Custom_Recurrence_Block SHALL show text "Every", a number input (value 1, min 1, max 999, width 45dp), and a unit dropdown
3. THE unit dropdown SHALL contain options: minutes, hours, days, weeks (default), months, years
4. WHEN the custom frequency unit is "weeks", THE Custom_Recurrence_Block SHALL show 7 by-day checkboxes: Su, Mo, Tu, We, Th, Fr, Sa
5. WHEN the custom frequency unit is not "weeks", THE by-day checkboxes SHALL be hidden
6. EACH by-day checkbox SHALL render as a label with class cwoc-inline-label-sm (font-size 0.85em) containing a checkbox with the corresponding day value (SU, MO, TU, WE, TH, FR, SA)
7. THE by-day checkboxes container SHALL render with margin-top 4dp, gap 4dp, and flex-wrap wrap

### Requirement 24: Habit Mode Interactions — Forced States

**User Story:** As a user, I want habit mode on Android to force the exact same states in the Dates zone as the mobile browser — hiding None, locking All Day, auto-enabling repeat, showing Perpetual, and expanding the zone.

#### Acceptance Criteria

1. WHEN habit mode is activated, THE "None" Date_Mode_Row SHALL be hidden (display none) and the radio SHALL be disabled
2. WHEN habit mode is activated, THE All_Day_Toggle SHALL be forced to active state with opacity 0.6, pointer-events none, and title "Habits are always all-day"
3. WHEN habit mode is activated, THE Dates_Zone SHALL auto-enable repeat with Daily frequency if not already enabled
4. WHEN habit mode is activated, THE Recurrence_Row SHALL be hidden (habit controls subsume recurrence)
5. WHEN habit mode is activated, THE "Perpetual" Date_Mode_Row SHALL become visible
6. WHEN habit mode is activated, THE "Ends never" checkbox SHALL be forced to checked
7. WHEN habit mode is activated, THE Dates_Zone SHALL auto-expand if collapsed (desktop behavior, but ensure no collapsed state on mobile)
8. WHEN habit mode is activated, THE Recurrence_Icon SHALL change from 🔁 to 🎯 with title "Habit"

### Requirement 25: Habit Mode Interactions — Deactivation and Recurrence Sync

**User Story:** As a user, I want habit deactivation on Android to restore all Dates zone states exactly like the mobile browser, and I want the habit frequency to sync bidirectionally with the recurrence dropdown.

#### Acceptance Criteria

1. WHEN habit mode is deactivated, THE All_Day_Toggle SHALL be unlocked (opacity 1, pointer-events restored)
2. WHEN habit mode is deactivated, THE "None" Date_Mode_Row SHALL be restored (visible, enabled)
3. WHEN habit mode is deactivated, THE Recurrence_Row SHALL be shown again (but checkbox unchecked)
4. WHEN habit mode is deactivated, THE "Perpetual" Date_Mode_Row SHALL be hidden
5. WHEN habit mode is deactivated, THE Recurrence_Icon SHALL revert from 🎯 to 🔁 with title "Recurring chit"
6. THE habit frequency dropdown (in the Habits zone) SHALL sync bidirectionally with the hidden recurrence dropdown — changing habit frequency updates recurrence, and loading a recurring chit as habit syncs the other way
7. WHEN habit mode is active, THE recurrence labels SHALL simplify to "Daily", "Weekly", "Monthly", "Yearly" without contextual day/date information

### Requirement 26: Date Mode Change Side Effects

**User Story:** As a user, I want date mode changes on Android to trigger the exact same side effects as the mobile browser — updating timezone labels, recurrence labels, auto-populating notifications, and marking unsaved.

#### Acceptance Criteria

1. WHEN the date mode changes, THE Dates_Zone SHALL update field visibility according to the mode table: None hides all; Start/End shows startEndFields + All Day + Repeat; Due shows dueFields + All Day + Repeat; Perpetual shows perpetualFields + All Day; Point in Time shows pointInTimeFields only
2. WHEN the date mode changes, THE Dates_Zone SHALL inject/update Timezone_Abbreviation_Labels via timezone row visibility update
3. WHEN the date mode changes, THE Dates_Zone SHALL update recurrence labels to reflect the new date context
4. WHEN the date mode changes to a date-bearing mode on a new chit, THE Dates_Zone SHALL auto-populate default notifications
5. WHEN the date mode changes, THE Dates_Zone SHALL re-render the notifications container (direction options depend on date mode)
6. WHEN the date mode changes, THE Dates_Zone SHALL mark the save button as unsaved (unless suppressed during initial load)
7. WHEN the date mode changes to "None" or "Point in Time", THE recurrence fields SHALL get greyed-out styling (opacity 0.3, pointer-events none)
8. WHEN the date mode changes to Start/End, Due, or Perpetual, THE All_Day_Toggle SHALL auto-default to checked with the Auto_Default_Flag set (time inputs remain visible)
9. WHEN the date mode changes to "Point in Time" and the date is empty, THE Dates_Zone SHALL auto-populate with current date and time
10. WHEN the date mode changes to "Perpetual" and start date is empty, THE Dates_Zone SHALL auto-set start date to today

### Requirement 27: Visual Theme — Fonts

**User Story:** As a user, I want all text in the Android Dates zone to use the Lora serif font at the exact same weights and sizes as the mobile browser, so that typography is indistinguishable.

#### Acceptance Criteria

1. THE Dates_Zone SHALL use font-family 'Lora', Georgia, serif as the primary font for all text elements
2. THE Dates_Zone SHALL support Lora font weights 400 (normal), 500 (medium), 600 (semi-bold), and 700 (bold) via the self-hosted variable font
3. ALL inputs and selects in the Dates_Zone SHALL inherit the Lora font from their parent
4. THE Drum_Roller_Picker SHALL explicitly set font-family 'Lora', Georgia, serif
5. THE Timezone_Picker_Modal SHALL explicitly set font-family 'Lora', Georgia, serif
6. THE Timezone_Suggestion_Prompt SHALL explicitly set font-family 'Lora', Georgia, serif
7. ALL date inputs and time buttons on mobile SHALL use font-size 16sp to prevent zoom-on-focus behavior

### Requirement 28: Visual Theme — Color Palette

**User Story:** As a user, I want the Android Dates zone to use the exact same color values for every element as the mobile browser, so that no color difference is perceptible.

#### Acceptance Criteria

1. THE Zone_Container background SHALL be `#fff8dc` (cornsilk/parchment)
2. ALL input and button backgrounds SHALL be `#fff8e1` (parchment-light)
3. ALL borders on inputs, buttons, and containers SHALL be `#8b4513` (aged-brown-medium)
4. THE Zone_Button default background SHALL be `#a0522d` (aged-brown-light) with text color `#fdf5e6`
5. THE Zone_Button hover/pressed background SHALL be `#924525`
6. THE All_Day_Toggle active background SHALL be `#008080` (teal) with text `#fff8e1` and border `#006060`
7. THE dark text color SHALL be `#1a1208` for input text and anchored timezone labels
8. THE muted text color SHALL be `#8b7355` for empty time button placeholders
9. THE floating timezone label color SHALL be `#8b5a2b` at opacity 0.55
10. THE zone title text color (if ever shown) SHALL be `#4a2c2a` (aged-brown-dark)
11. THE Drum_Roller_Picker modal background SHALL be `#fffaf0`
12. THE Drum_Roller_Picker drum item color SHALL be `#6b4e31`
13. THE Drum_Roller_Picker header and separator text color SHALL be `#3a2a14`
14. THE Timezone_Picker_Modal content background SHALL be `#fffaf0`
15. THE Timezone_Picker_Modal border color SHALL be `#6b4e31`
16. THE Timezone_Picker_Modal status text color SHALL be `#2e7d32` (green)
17. THE Timezone_Suggestion_Prompt background SHALL be rgba(0, 128, 128, 0.06) with border rgba(0, 128, 128, 0.3)
18. THE "Use" button background SHALL be teal (`#008080`) with hover `#006666`
19. THE "Dismiss" button background SHALL be `#f5ebe0` with hover `#e8d5c0`
20. THE Highlight_Bar background SHALL be rgba(139, 90, 43, 0.1) with borders rgba(139, 90, 43, 0.3)
21. THE time button active/pressed background SHALL be rgba(139, 90, 43, 0.15)
22. THE time button tap-highlight-color SHALL be rgba(139, 90, 43, 0.2)

### Requirement 29: Visual Theme — Spacing and Sizing

**User Story:** As a user, I want all spacing, padding, margins, and element sizes on Android to exactly match the mobile browser's pixel values (converted to dp), so that layout is indistinguishable.

#### Acceptance Criteria

1. THE Zone_Body padding SHALL be 8dp top/bottom and 1em (16dp) left/right
2. EACH Date_Mode_Row padding SHALL be 4dp top/bottom
3. THE Date_Mode_Fields indent SHALL be 22dp left margin
4. THE Date_Mode_Fields gap SHALL be 6dp between child elements
5. THE Date_Input padding SHALL be 4dp top/bottom and 8dp left/right on mobile
6. THE Date_Input min-height SHALL be 38dp on mobile
7. THE Date_Input min-width SHALL be 80dp with flex 1
8. THE Time_Button width SHALL be 80dp with min-height 34dp
9. THE Time_Button padding SHALL be 3dp top/bottom and 6dp left/right
10. THE margin-right on date inputs and time buttons SHALL be 4dp
11. THE Zone_Button padding SHALL be 5dp top/bottom and 10dp left/right
12. THE Zone_Actions_Row gap SHALL be 6dp
13. THE Zone_Header padding SHALL be 6dp top/bottom and 1em (16dp) left/right
14. THE radio/checkbox size SHALL be exactly 16×16dp with margin 2dp top, 6dp right, 0 bottom, 0 left
15. THE Drum_Roller_Picker drums container height SHALL be 200dp (180dp on ≤380dp screens)
16. THE Drum_Roller_Picker item height SHALL be 40dp (36dp on ≤380dp screens)
17. THE Drum_Roller_Picker fade mask height SHALL be 60dp
18. THE Drum_Roller_Picker modal padding SHALL be 16dp top, 12dp left/right, 24dp bottom
19. THE Drum_Roller_Picker buttons row gap SHALL be 10dp with margin-top 16dp
20. THE Timezone_Abbreviation_Label margin-left SHALL be 6dp with padding 2dp top/bottom and 6dp left/right

### Requirement 30: Visual Theme — Borders and Border Radius

**User Story:** As a user, I want all borders and border radii on Android to exactly match the mobile browser's values, so that no visual difference in element edges is perceptible.

#### Acceptance Criteria

1. THE Zone_Container SHALL have no border-radius, no left border, and no right border in Mobile_Zone_Mode
2. ALL Date_Input elements SHALL have border 1dp solid `#8b4513` and border-radius 3dp
3. ALL Time_Button elements SHALL have border 1dp solid `#8b4513` and border-radius 3dp
4. THE Zone_Button border SHALL be 1dp outset `#8b4513`
5. THE All_Day_Toggle active border SHALL be 1dp outset `#006060`
6. THE Drum_Roller_Picker modal border-bottom SHALL be 3dp solid `#6b4e31` with border-radius 0 0 16dp 16dp
7. THE Drum_Roller_Picker button border-radius SHALL be 8dp
8. THE Highlight_Bar border-radius SHALL be 6dp
9. THE Timezone_Picker_Modal content border SHALL be 2dp solid `#6b4e31` with border-radius 8dp
10. THE Timezone_Picker_Modal search input border SHALL be 1dp solid `#a0522d` with border-radius 4dp
11. THE Timezone_Suggestion_Prompt border SHALL be 1dp solid rgba(0, 128, 128, 0.3) with border-radius 4dp
12. THE "Use" button border SHALL be 1dp outset `#8b5a2b` with border-radius 4dp
13. THE Timezone_Abbreviation_Label border-radius SHALL be 3dp

### Requirement 31: Recurrence Icon in Editor Title

**User Story:** As a user, I want the recurrence icon in the editor title area on Android to show the same icon, size, opacity, and habit-mode variant as the mobile browser.

#### Acceptance Criteria

1. THE Recurrence_Icon SHALL be displayed in the editor title accessories area
2. WHEN repeat is enabled (and habit is not active), THE Recurrence_Icon SHALL show 🔁 with font-size 1.1em and opacity 0.7
3. WHEN habit mode is active, THE Recurrence_Icon SHALL show 🎯 with font-size 1.1em and opacity 0.7
4. WHEN repeat is disabled (and habit is not active), THE Recurrence_Icon SHALL be hidden
5. THE Recurrence_Icon title SHALL be "Recurring chit" when showing 🔁 and "Habit" when showing 🎯

### Requirement 32: State Persistence and Save Payload

**User Story:** As a user, I want the Android Dates zone to contribute the exact same fields to the save payload and mark unsaved state in the exact same situations as the mobile browser.

#### Acceptance Criteria

1. WHEN any date/time value is modified by user interaction, THE Dates_Zone SHALL mark the editor save system as unsaved (dirty state)
2. THE Dates_Zone SHALL suppress unsaved marking during initial chit load (using a suppress flag equivalent to `_dateModeSuppressUnsaved`)
3. WHEN the user saves, THE Dates_Zone SHALL contribute these fields to the PUT request: start_datetime, end_datetime (Start/End mode), due_datetime (Due mode), point_in_time (Point in Time mode), all_day (boolean), timezone (IANA string or null for floating), recurrence_rule (object or null), perpetual (boolean)
4. THE recurrence_rule object SHALL be built with structure: { freq, interval, byDay, until } matching the web's `_buildRecurrenceRule()` output
5. WHEN "Perpetual" mode is selected, THE save payload SHALL clear end_datetime and set perpetual to true
6. WHEN "None" mode is selected, THE save payload SHALL clear all date/time fields

### Requirement 33: Load Behavior

**User Story:** As a user, I want the Android Dates zone to load existing chit data in the exact same sequence and with the same state restoration as the mobile browser, so that opening a chit looks identical.

#### Acceptance Criteria

1. WHEN opening an existing chit, THE Dates_Zone SHALL suppress unsaved marking before populating fields
2. THE Dates_Zone SHALL detect the date mode from chit data (equivalent to `_detectDateMode(chit)`)
3. THE Dates_Zone SHALL set the correct radio button and trigger date mode change logic
4. THE Dates_Zone SHALL populate all date/time values into their respective inputs
5. THE Dates_Zone SHALL load the recurrence rule from the chit data and populate frequency, interval, by-day, and until fields
6. THE Dates_Zone SHALL load the timezone value and set labels to Floating_State or Anchored_State accordingly
7. THE Dates_Zone SHALL restore the All Day state from the chit data
8. AFTER all fields are populated, THE Dates_Zone SHALL re-enable unsaved marking

### Requirement 34: Field Visibility Matrix

**User Story:** As a user, I want the exact same fields to be visible/hidden for each date mode on Android as on the mobile browser, with no exceptions.

#### Acceptance Criteria

1. WHEN date mode is "None", THE Dates_Zone SHALL hide: startEndFields, dueFields, perpetualFields, pointInTimeFields, All_Day_Toggle, and Recurrence_Row
2. WHEN date mode is "Start/End", THE Dates_Zone SHALL show: startEndFields and hide: dueFields, perpetualFields, pointInTimeFields; All_Day_Toggle visible; Recurrence_Row visible
3. WHEN date mode is "Due", THE Dates_Zone SHALL show: dueFields and hide: startEndFields, perpetualFields, pointInTimeFields; All_Day_Toggle visible; Recurrence_Row visible
4. WHEN date mode is "Perpetual", THE Dates_Zone SHALL show: perpetualFields and hide: startEndFields, dueFields, pointInTimeFields; All_Day_Toggle visible; Recurrence_Row hidden (habit manages)
5. WHEN date mode is "Point in Time", THE Dates_Zone SHALL show: pointInTimeFields and hide: startEndFields, dueFields, perpetualFields; All_Day_Toggle hidden; Recurrence_Row hidden

### Requirement 35: Interaction Parity Summary

**User Story:** As a user, I want every tap/interaction in the Android Dates zone to produce the exact same result as the mobile browser, with no missing or different interactions.

#### Acceptance Criteria

1. WHEN a date mode radio button is tapped, THE Dates_Zone SHALL switch visible fields, update All Day/Repeat visibility, and trigger all side effects
2. WHEN a date input is tapped, THE Dates_Zone SHALL open the Flatpickr_Calendar dropdown (not native picker)
3. WHEN a time button is tapped, THE Dates_Zone SHALL open the Drum_Roller_Picker modal (not native Android TimePickerDialog)
4. WHEN the All_Day_Toggle is tapped, THE Dates_Zone SHALL toggle all-day state and hide/show time buttons
5. WHEN the Repeat checkbox is tapped, THE Dates_Zone SHALL show/hide recurrence options inline
6. WHEN the frequency dropdown value changes, THE Dates_Zone SHALL update labels and show/hide the Custom_Recurrence_Block
7. WHEN a Timezone_Abbreviation_Label is tapped, THE Dates_Zone SHALL open the Timezone_Picker_Modal
8. WHEN the "Now" button (Point in Time) is tapped, THE Dates_Zone SHALL set date and time to the current moment
9. WHEN the "Use" button (timezone suggestion) is tapped, THE Dates_Zone SHALL apply the detected timezone
10. WHEN the "Dismiss" button (timezone suggestion) is tapped, THE Dates_Zone SHALL remove the suggestion prompt
11. WHEN text is typed in the timezone modal input, THE Timezone_Picker_Modal SHALL auto-validate against the datalist and auto-close on match
12. WHEN Enter is pressed in the timezone modal input (non-timezone text), THE Timezone_Picker_Modal SHALL trigger geocoding
13. WHEN "Clear" is tapped in the timezone modal, THE Timezone_Picker_Modal SHALL remove the timezone (floating) and close
14. WHEN "Cancel" is tapped in the timezone modal, THE Timezone_Picker_Modal SHALL close without changes
15. WHEN Escape is pressed while the timezone modal is open, THE Timezone_Picker_Modal SHALL close (capture phase, stops propagation)
16. WHEN Escape is pressed while the Drum_Roller_Picker is open, THE Drum_Roller_Picker SHALL close (capture phase, stops propagation)
17. WHEN Escape is pressed while the Flatpickr_Calendar is open, THE Flatpickr_Calendar SHALL close before any other ESC handler fires

### Requirement 36: Data Model Parity

**User Story:** As a user, I want the Android app to use the exact same data model fields, types, defaults, and format conventions as the mobile browser for all Dates zone data.

#### Acceptance Criteria

1. THE Dates_Zone SHALL use field `start_datetime` as Optional String, default null, storing ISO datetime
2. THE Dates_Zone SHALL use field `end_datetime` as Optional String, default null, storing ISO datetime
3. THE Dates_Zone SHALL use field `due_datetime` as Optional String, default null, storing ISO datetime
4. THE Dates_Zone SHALL use field `point_in_time` as Optional String, default null, storing reference timestamp
5. THE Dates_Zone SHALL use field `all_day` as Optional Boolean, default false
6. THE Dates_Zone SHALL use field `timezone` as Optional String, default null, storing IANA timezone name or null for floating
7. THE Dates_Zone SHALL use field `recurrence_rule` as Optional Object, default null, with structure { freq: String, interval: Int, byDay: List of Strings, until: String }
8. THE Dates_Zone SHALL use field `perpetual` as Optional Boolean, default false
9. THE Dates_Zone SHALL use field `habit` as Optional Boolean, default false
10. THE recurrence_rule freq values SHALL be: "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "MINUTELY", "HOURLY"
11. THE recurrence_rule byDay values SHALL use two-letter codes: "SU", "MO", "TU", "WE", "TH", "FR", "SA"
12. THE recurrence_rule until field SHALL store dates in "YYYY-Mon-DD" format (e.g., "2026-Dec-31")
13. THE Dates_Zone SHALL store Flatpickr dates as "YYYY-Mon-DD" and convert to ISO format for API calls
14. THE Dates_Zone SHALL store time values in 24-hour "HH:MM" format internally regardless of display preference

### Requirement 37: No Native Android Pickers

**User Story:** As a user, I want the Android app to NEVER use native Android date or time pickers in the Dates zone — only the custom Flatpickr-style calendar and the custom Drum Roller time picker, so that the experience is identical to the mobile browser.

#### Acceptance Criteria

1. THE Dates_Zone SHALL NOT use Android's native DatePickerDialog for any date input
2. THE Dates_Zone SHALL NOT use Android's native TimePickerDialog for any time input
3. THE Dates_Zone SHALL NOT use Material 3 DatePicker or TimePicker components
4. ALL date selection SHALL use a custom Flatpickr-style calendar dropdown rendered within the app
5. ALL time selection SHALL use the custom Drum_Roller_Picker modal with scroll-snap columns
6. THE custom pickers SHALL be implemented as Compose UI components matching the web's visual and behavioral specification exactly
