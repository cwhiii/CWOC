# Mobile Browser — Chit Editor "Dates & Times" Zone: Complete Specification

This document describes every visual element, interaction, and behavior of the "Dates & Times" zone in the chit editor as rendered on a mobile browser (viewport ≤ 768px, "mobile zone mode"). It is intended as a pixel-accurate reference for replicating this zone identically on another platform.

---

## 1. Zone Container Structure

### 1.1 Zone Container
- **Element:** `<div id="datesSection" class="zone-container">`
- **CSS (desktop):** `border: 1px solid var(--border-color)` (`#8b4513`), `border-radius: 4px`, `margin-bottom: 20px`, `background: var(--zone-body-bg)` (`#fff8dc`), `overflow: visible`
- **CSS (mobile zone mode):** `border-radius: 0`, `margin: 0`, `border-left: none`, `border-right: none`, `width: 100%`, `flex: 1`, `min-height: 0`

### 1.2 Zone Header
- **Element:** `<div class="zone-header">`
- **Desktop CSS:** `display: flex`, `justify-content: space-between`, `align-items: center`, `padding: 10px`, `background-color: var(--zone-header-bg)` (`#d2b48c`), `border-bottom: 1px solid var(--border-color)`, `border-top-left-radius: 4px`, `border-top-right-radius: 4px`
- **Mobile zone mode CSS:** `display: flex`, `border: none`, `background: none`, `padding: 6px 1em`, `margin: 0`, `min-height: auto`
- **Click behavior (desktop):** Clicking the header toggles zone collapse/expand via `toggleZone(event, 'datesSection', 'datesContent')`
- **Mobile zone mode:** Zone title and toggle icon are hidden (navigation handled by zone nav bar). Only the zone-actions row is visible.

#### 1.2.1 Zone Title (hidden on mobile)
- **Element:** `<h2 class="zone-title">🗓️ Dates & Times</h2>`
- **CSS:** `margin: 0`, `color: var(--aged-brown-dark)` (`#4a2c2a`), `font-size: 1.1em`, `flex-grow: 1`
- **Mobile zone mode:** `display: none`

#### 1.2.2 Zone Actions Row
- **Element:** `<div class="zone-actions">`
- **CSS:** `display: flex`, `gap: 8px`, `align-items: center`
- **Mobile zone mode:** `display: flex`, `flex-wrap: wrap`, `gap: 6px`, `width: 100%`, `justify-content: flex-start`

**Contents:**
1. **Spacer** — `<span class="location-actions-spacer">` (empty, for layout)
2. **All Day Toggle Button** — `<button type="button" id="allDayToggleBtn" class="zone-button">` (see Section 3)
3. **Hidden checkboxes** — `<input type="checkbox" id="allDay" style="display:none">` and `<input type="checkbox" id="habitEnabled" style="display:none">`

#### 1.2.3 Zone Toggle Icon (hidden on mobile)
- **Element:** `<span class="zone-toggle-icon">🔼</span>`
- **CSS:** `font-size: 1.2em`, `margin-left: 10px`, `cursor: pointer`, `color: var(--aged-brown-dark)`
- Shows 🔼 when expanded, 🔽 when collapsed
- **Mobile zone mode:** `display: none`

### 1.3 Zone Body
- **Element:** `<div id="datesContent" class="zone-body">`
- **Desktop CSS:** `padding: 10px`, `background-color: var(--zone-body-bg)` (`#fff8dc`)
- **Mobile zone mode CSS:** `display: flex !important`, `flex-direction: column`, `padding: 8px 1em !important`, `width: 100%`, `box-sizing: border-box`

### 1.4 Collapsed State (desktop only)
- **Class:** `.zone-container.collapsed`
- **CSS:** `overflow: hidden`, `height: 48px`, `opacity: 0.55`
- **Hover:** `opacity: 0.85`
- Zone title and toggle icon get inverse opacity to remain readable

---

## 2. Date Mode Radio Group

### 2.1 Container
- **Element:** `<div class="date-mode-group">`
- **Desktop CSS:** `display: table`, `width: 100%`, `border-spacing: 0 6px`
- **Mobile zone mode CSS:** `display: flex !important`, `flex-direction: column`, `gap: 0`, `width: 100%`, `padding: 0`, `margin: 0`

### 2.2 Date Mode Row Pattern
Each date mode option follows this structure:
- **Element:** `<div class="date-mode-row">`
- **Desktop CSS:** `display: table-row`
- **Mobile zone mode CSS:** `display: flex`, `flex-direction: column`, `align-items: stretch`, `padding: 4px 0`, `margin: 0`

Each row contains:
1. **Label cell** — `<label class="date-mode-label">`
   - Desktop CSS: `display: table-cell`, `vertical-align: middle`, `font-weight: bold`, `font-size: 0.9em`, `white-space: nowrap`, `width: 90px`, `padding-right: 8px`, `cursor: pointer`
   - Mobile CSS: `display: flex`, `align-items: flex-start`, `gap: 0`, `white-space: nowrap`, `padding: 0`, `margin: 0`, `min-width: 0`, `width: auto`
2. **Fields cell** — `<div class="date-mode-fields">`
   - Desktop CSS: `display: table-cell`, `vertical-align: middle`
   - Mobile CSS: `margin-left: 22px`, `width: calc(100% - 22px)`, `padding-left: 0`, `flex-wrap: wrap`, `gap: 6px`, `box-sizing: border-box`

### 2.3 Radio/Checkbox Sizing (Mobile)
- `width: 16px !important`, `height: 16px !important`, `min-width: 16px !important`, `min-height: 16px !important`
- `margin: 2px 6px 0 0 !important`, `padding: 0 !important`, `flex-shrink: 0`, `flex-grow: 0`

---

## 3. All Day Toggle Button

### 3.1 Element
- `<button type="button" id="allDayToggleBtn" class="zone-button" onclick="_toggleAllDayBtn()">`
- Contains: `<i class="far fa-clock"></i> <span class="hideWhenNarrow">All Day</span>`

### 3.2 Visibility
- **Hidden** when date mode is "None" or "Point in Time" (`display: none`)
- **Visible** when date mode is "Start/End", "Due", or "Perpetual"
- On mobile zone mode: `.hideWhenNarrow` labels are shown (`display: inline !important`)

### 3.3 States

| State | Background | Color | Border | Text | Opacity |
|-------|-----------|-------|--------|------|---------|
| Inactive | default (zone-button: `#a0522d`) | `#fdf5e6` | `1px outset #8b4513` | "🗓️ All Day" | 1 |
| Active | `#008080` (teal) | `#fff8e1` | `#006060` | "🗓️ All Day ✓" | 1 |
| Disabled (habit active) | `#008080` | `#fff8e1` | `#006060` | "🗓️ All Day ✓" | 0.6, `pointer-events: none` |

### 3.4 Behavior
- **Tap:** Toggles the hidden `#allDay` checkbox, then calls `toggleAllDay()` which hides/shows time inputs
- **When active (all-day checked):** All time buttons (`start_time`, `end_time`, `due_time`) are hidden (`display: none`). Date inputs remain visible. The "to" separator between start/end dates remains visible.
- **When inactive:** All time buttons are shown
- **Auto-default:** When a date mode is first activated (user clicks Start/End, Due, or Perpetual), all-day is automatically checked BUT time inputs remain visible (the `_allDayAutoDefaulted` flag prevents hiding them). This auto-default is cleared if the user explicitly toggles the button.
- **Auto-deselect:** When the user picks a time via the time picker, all-day is automatically unchecked

### 3.5 Zone Button Base Styling
- `padding: 5px 10px`, `font-size: 12px`, `background-color: var(--aged-brown-light)` (`#a0522d`), `color: var(--parchment-light)` (`#fdf5e6`), `border: 1px outset var(--aged-brown-medium)` (`#8b4513`), `white-space: nowrap`
- Hover: `background-color: #924525`

---

## 4. Date Mode Options (Radio Buttons)

### 4.1 None (Default)
- **Element:** `<div class="date-mode-row" id="dateModeNoneRow">`
- **Radio:** `<input type="radio" name="dateMode" value="none" id="dateModeNone" checked>`
- **Label text:** "None"
- **Fields:** None (no date-mode-fields content)
- **Behavior when selected:**
  - All date fields hidden
  - All Day button hidden
  - Repeat row hidden
  - Timezone abbreviation labels hidden
- **Hidden when habit is active** (`display: none`)
- **Disabled when habit is active** (`disabled = true`, `title = "Habits require a date"`)

### 4.2 Start/End
- **Element:** `<div class="date-mode-row" id="startEndRow">`
- **Radio:** `<input type="radio" name="dateMode" value="startend" id="dateModeStartEnd">`
- **Label text:** "🗓️ Start/End"
- **Fields container:** `<div class="date-mode-fields" id="startEndFields">`

**Fields (left to right on desktop, wrapping on mobile):**

1. **Start Date** — `<input type="text" id="start_datetime" class="date-time date-input" placeholder="Start Date">`
2. **Start Time** — `<button type="button" id="start_time" class="date-time time-input cwoc-time-btn" onclick="cwocTimePicker.open(this)">HH:MM</button>`
3. **Separator** — `<span class="date-mode-separator">to</span>`
4. **End Time** — `<button type="button" id="end_time" class="date-time time-input cwoc-time-btn" onclick="cwocTimePicker.open(this)">HH:MM</button>`
5. **End Date** — `<input type="text" id="end_datetime" class="date-time date-input" placeholder="End Date">`
6. **Timezone abbreviation label** — Injected by JS (see Section 7)

**Note on field order:** Start Date → Start Time → "to" → End Time → End Date. The end time comes BEFORE the end date (reading as "May 18 at 9:00 to 17:00 on May 18").

### 4.3 Due
- **Element:** `<div class="date-mode-row" id="dueRow">`
- **Radio:** `<input type="radio" name="dateMode" value="due" id="dateModeDue">`
- **Label text:** "⏳ Due"
- **Fields container:** `<div class="date-mode-fields" id="dueFields">`

**Fields:**
1. **Due Date** — `<input type="text" id="due_datetime" class="date-time date-input" placeholder="Due Date">`
2. **Due Time** — `<button type="button" id="due_time" class="date-time time-input cwoc-time-btn" onclick="cwocTimePicker.open(this)">HH:MM</button>`
3. **Complete checkbox** — `<label class="complete-inline" id="dueCompleteLabel">` containing `<input type="checkbox" id="dueComplete">` + "Complete" text
   - Style: `margin-left: 8px`, `display: none` (shown only when status is set), `align-items: center`, `gap: 4px`, `font-size: 0.85em`, `cursor: pointer`
   - Title: "Yes, this is the same as the 'Status' Complete."
   - Behavior: Toggling this syncs with the Task zone's status dropdown
4. **Timezone abbreviation label** — Injected by JS

### 4.4 Point in Time
- **Element:** `<div class="date-mode-row" id="pointInTimeRow">`
- **Radio:** `<input type="radio" name="dateMode" value="pointintime" id="dateModePointInTime">`
- **Label text:** "📌 Point in Time"
- **Fields container:** `<div class="date-mode-fields" id="pointInTimeFields">`

**Fields:**
1. **Date** — `<input type="text" id="point_in_time_date" class="date-time date-input" placeholder="Date">`
2. **Time** — `<button type="button" id="point_in_time_time" class="date-time time-input cwoc-time-btn" onclick="cwocTimePicker.open(this)">HH:MM</button>`
3. **Now button** — `<button type="button" class="zone-button" onclick="setPointInTimeNow()" title="Set to current date and time">Now</button>`
4. **Timezone abbreviation label** — Injected by JS

**Behavior:**
- When this mode is first selected and the date is empty, `setPointInTimeNow()` is called automatically to populate with current date/time
- "Now" button sets both date and time to the current moment
- All Day button is hidden in this mode
- Repeat row is hidden in this mode

### 4.5 Perpetual (Habit-Only)
- **Element:** `<div class="date-mode-row" id="perpetualRow" style="display:none">`
- **Radio:** `<input type="radio" name="dateMode" value="perpetual" id="dateModePerpetual">`
- **Label text:** "♾️ Perpetual"
- **Fields container:** `<div class="date-mode-fields" id="perpetualFields">`
- **Only visible when habit is active**

**Fields:**
1. **Description** — `<span id="perpetualDescription" class="cwoc-inline-label-sm" style="color:#6b4e31;">Starts now, continues forever</span>`
   - When a start date exists: "Starts now, continues forever. (Started May 2, 2026.)"

**Behavior:**
- Sets start date to today if empty
- Clears end date and end time
- End date input is effectively disabled (cleared)

---

## 5. Date Input Fields (Flatpickr)

### 5.1 Styling
- **Class:** `.date-time.date-input`
- **CSS:** `width: 100px`, `font-size: 0.85em`, `padding: 4px 6px`, `font-family: 'Lora', Georgia, serif`, `border: 1px solid var(--border-color)` (`#8b4513`), `border-radius: 3px`, `background: var(--parchment-light)` (`#fff8e1`), `margin-right: 4px`
- **Mobile zone mode:** `flex: 1`, `min-width: 80px`, `max-width: 100%`, `min-height: 34px`, `padding: 4px 8px`
- **General mobile inputs:** `min-height: 38px`, `font-size: 16px` (prevents iOS zoom on focus), `box-sizing: border-box`, `max-width: 100%`

### 5.2 Flatpickr Configuration
- **Date format:** `"Y-M-d"` (e.g., "2026-May-18")
- **Mobile mode:** Disabled (`disableMobile: true`) — always uses Flatpickr's custom calendar, never native date picker
- **onChange callbacks:**
  - `#start_datetime`: Calls `_updateRecurrenceLabels()` and `_refreshWeatherOnDateChange()`
  - `#due_datetime`: Calls `_updateRecurrenceLabels()` and `_refreshWeatherOnDateChange()`
  - `#point_in_time_date`: Calls `_refreshWeatherOnDateChange()`
  - `#end_datetime`: No callback
  - `#recurrenceUntil`: No callback

### 5.3 Flatpickr Calendar Appearance
- Flatpickr renders its own calendar dropdown when the input is tapped
- The calendar uses Flatpickr's default styling (loaded via CDN CSS)
- On mobile: calendar appears as a dropdown below the input field
- ESC key closes the Flatpickr calendar before any other ESC handler fires

### 5.4 Date Format
- Stored as `"YYYY-Mon-DD"` (e.g., "2026-May-18")
- Converted to ISO format for API calls via `convertMonthFormat()` which maps month abbreviations to numbers

---

## 6. Time Input Buttons (Drum Roller Picker)

### 6.1 Button Styling
- **Class:** `.date-time.time-input.cwoc-time-btn`
- **CSS:** `width: 80px`, `font-size: 0.85em`, `padding: 3px 6px`, `font-family: 'Lora', Georgia, serif`, `border: 1px solid var(--border-color)` (`#8b4513`), `border-radius: 3px`, `background: var(--parchment-light)` (`#fff8e1`), `margin-right: 4px`, `cursor: pointer`, `text-align: center`, `display: inline-block`, `line-height: 22px`, `color: var(--text-dark)` (`#1a1208`), `-webkit-appearance: none`, `-webkit-tap-highlight-color: rgba(139, 90, 43, 0.2)`
- **Active state:** `background: rgba(139, 90, 43, 0.15)`
- **Empty state (`.cwoc-time-btn-empty`):** `color: #8b7355` (muted brown)
- **Mobile zone mode:** `min-height: 34px` (from `.date-mode-fields select` rule)

### 6.2 Button Text
- **When empty:** "HH:MM" (placeholder text, muted color)
- **When set (24-hour mode):** "14:30" (zero-padded hours and minutes)
- **When set (12-hour mode):** "2:30 PM" (no zero-pad on hours, AM/PM suffix)

### 6.3 Value Storage
- Time buttons are `<button>` elements with a custom `.value` property defined via `Object.defineProperty`
- **Get:** Returns `el.dataset.time` (24-hour format string like "14:30")
- **Set:** Sets `el.dataset.time`, updates `el.textContent` to formatted display, toggles `.cwoc-time-btn-empty` class
- The `dataset.time` always stores 24-hour format regardless of display preference

### 6.4 Tap Behavior
- Tapping calls `cwocTimePicker.open(this)` which opens the drum roller time picker modal (see Section 8)

---

## 7. Timezone Abbreviation Labels

### 7.1 Injection
- Labels are dynamically injected by `_injectTzAbbrevLabels()` into each date-mode-fields container: `#startEndFields`, `#dueFields`, `#pointInTimeFields`
- Each label is a `<span class="tz-abbrev-label">` appended as the last child of the fields container

### 7.2 Styling
- **CSS:** `display: inline-flex`, `align-items: center`, `font-family: 'Lora', Georgia, serif`, `font-size: 0.8em`, `cursor: pointer`, `padding: 2px 6px`, `border-radius: 3px`, `margin-left: 6px`, `white-space: nowrap`, `min-width: 28px`, `min-height: 24px`, `justify-content: center`, `transition: background-color 0.2s, color 0.2s`
- **Hover:** `background: rgba(139, 90, 43, 0.1)`
- **Mobile (≤600px):** `min-height: 32px`, `min-width: 36px`, `padding: 4px 8px`, `font-size: 0.85em`

### 7.3 States

| State | Class | Color | Opacity | Font-weight | Meaning |
|-------|-------|-------|---------|-------------|---------|
| Floating | `.tz-abbrev-floating` | `#8b5a2b` | 0.55 | normal | No explicit timezone set; showing user's local TZ (assumed) |
| Anchored | `.tz-abbrev-anchored` | `#1a1208` | 1 | 500 | Explicit timezone set on the chit |

### 7.4 Text Content
- Shows the short timezone abbreviation (e.g., "MST", "PST", "EDT")
- Derived via `Intl.DateTimeFormat` with `timeZoneName: 'short'`
- Falls back to the full IANA name if abbreviation unavailable

### 7.5 Tooltip (title attribute)
- Multi-line tooltip showing all forms:
  - Line 1: Abbreviation (e.g., "MST")
  - Line 2: Long name (e.g., "Mountain Standard Time")
  - Line 3: IANA identifier (e.g., "America/Denver")
  - Line 4 (floating only): "(assumed — click to set)"

### 7.6 Tap Behavior
- Tapping any timezone abbreviation label opens the Timezone Picker Modal (Section 9)

---

## 8. Time Picker (Drum Roller Modal)

### 8.1 Trigger
- Tapping any time button (`.cwoc-time-btn`) calls `cwocTimePicker.open(element)`

### 8.2 Overlay
- **Element:** Dynamically created `<div class="cwoc-tp-overlay">`
- **CSS:** `position: fixed`, `inset: 0`, `background: rgba(0, 0, 0, 0.5)`, `z-index: 999999`, `display: flex`, `align-items: flex-start`, `justify-content: center`
- **Animation:** Fades in via `opacity: 0` → `opacity: 1` (0.2s ease)
- **Tap outside:** Closes the picker (cancel behavior)

### 8.3 Modal
- **Element:** `<div class="cwoc-tp-modal">`
- **Mobile CSS:** `background: #fffaf0`, `border-bottom: 3px solid #6b4e31`, `border-radius: 0 0 16px 16px`, `width: 100%`, `max-width: 400px`, `padding: 16px 12px 24px`, `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2)`, `font-family: 'Lora', Georgia, serif`
- **Animation:** Slides down from top: `transform: translateY(-100%)` → `translateY(0)` (0.3s cubic-bezier(0.32, 0.72, 0, 1))
- **Desktop (≥600px):** Centered vertically, `border-radius: 12px`, `border: 2px solid #6b4e31`, `max-width: 340px`, scale animation instead of slide

### 8.4 Header
- **Element:** `<div class="cwoc-tp-header">`
- **Text:** "Select Time"
- **CSS:** `text-align: center`, `font-size: 1.1em`, `font-weight: 600`, `color: #3a2a14`, `margin-bottom: 12px`

### 8.5 Drum Container
- **Element:** `<div class="cwoc-tp-drums">`
- **CSS:** `display: flex`, `align-items: center`, `justify-content: center`, `gap: 0`, `position: relative`, `height: 200px`, `margin: 0 auto`, `max-width: 300px`
- **Small screens (≤380px):** `height: 180px`

### 8.6 Drum Columns

**Layout:** 2 drums (24-hour mode) or 3 drums (12-hour mode), separated by a colon separator.

#### Hour Drum
- **24-hour mode:** Items 00–23 (zero-padded)
- **12-hour mode:** Items 1–12 (no zero-pad)
- Each item: `height: 40px` (36px on ≤380px), `font-size: 1.4em`, `color: #6b4e31`, `opacity: 0.4`, `scroll-snap-align: center`
- Selected item: `opacity: 1`, `font-size: 1.6em`, `font-weight: 700`, `color: transparent` (hidden behind input overlay), `transform: scale(1.05)`

#### Minute Drum
- Items: 0 to 55 in steps of `_minuteStep` (default 5, configurable via settings `calendar_snap`)
- Zero-padded display (00, 05, 10, 15, ...)
- Same item styling as hour drum

#### AM/PM Drum (12-hour mode only)
- Two items: "AM" and "PM"
- Same styling as other drums

#### Separator
- **Element:** `<div class="cwoc-tp-separator">`
- **CSS:** `font-size: 1.8em`, `font-weight: bold`, `color: #3a2a14`, `padding: 0 2px`, `user-select: none`, `line-height: 200px` (180px on ≤380px)

### 8.7 Highlight Bar
- **Element:** `<div class="cwoc-tp-highlight">`
- **CSS:** `position: absolute`, `top: 50%`, `left: 8px`, `right: 8px`, `height: 40px` (36px on ≤380px), `transform: translateY(-50%)`, `background: rgba(139, 90, 43, 0.1)`, `border-top: 1.5px solid rgba(139, 90, 43, 0.3)`, `border-bottom: 1.5px solid rgba(139, 90, 43, 0.3)`, `border-radius: 6px`, `pointer-events: none`, `z-index: 1`

### 8.8 Editable Input Overlay
- **Element:** `<div class="cwoc-tp-input-overlay">` positioned over the highlight bar
- **CSS:** `position: absolute`, `top: 50%`, `left: 50%`, `transform: translate(-50%, -50%)`, `display: flex`, `align-items: center`, `justify-content: center`, `gap: 2px`, `z-index: 10`

**Hour input:** `<input class="cwoc-tp-num-input">` — `width: 2.2em`, `font-size: 1.5em`, `font-weight: 700`, `font-family: 'Lora'`, `text-align: center`, `border: none`, `border-bottom: 2px solid transparent`, `background: transparent`, `color: #1a1208`, `caret-color: #6b4e31`
- Focus: `border-bottom-color: #6b4e31`, `background: rgba(255, 250, 240, 0.8)`, `border-radius: 4px 4px 0 0`

**Colon separator:** `<span class="cwoc-tp-input-sep">` — `font-size: 1.5em`, `font-weight: 700`, `color: #1a1208`

**Minute input:** Same as hour input

**AM/PM input (12-hour only):** `<input class="cwoc-tp-num-input cwoc-tp-ampm-input">` — `width: 2.4em`, `font-size: 1.2em`, `margin-left: 4px`

### 8.9 Scroll Behavior
- Each drum uses `scroll-snap-type: y mandatory` with `-webkit-overflow-scrolling: touch`
- Scrollbar hidden (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`)
- 2 padding items at top and bottom (invisible, `opacity: 0`, `pointer-events: none`) to allow first/last items to center
- Fade masks: `::before` (top) and `::after` (bottom) gradients from `#fffaf0` to transparent, `height: 60px`, `pointer-events: none`
- Tapping an item scrolls it to center (`behavior: 'smooth'`)
- Scroll position syncs to the editable input fields (unless user is typing)

### 8.10 Keyboard Input
- **Hour field:** Overwrite mode. First digit validates (0–2 for 24h, 0–1 for 12h). Second digit validates full number (0–23 or 1–12). After second digit, focus moves to minute field.
- **Minute field:** Overwrite mode. Validates 0–59. After second digit, focus moves to AM/PM field (if 12-hour) or stays.
- **AM/PM field:** Typing 'a'/'A' sets AM, 'p'/'P' sets PM.
- **Enter key:** Confirms and closes (from any field)
- **Escape key:** Cancels and closes (captured in capture phase, stops propagation)

### 8.11 Buttons Row
- **Element:** `<div class="cwoc-tp-buttons">`
- **CSS:** `display: flex`, `gap: 10px`, `margin-top: 16px`, `padding: 0 8px`

| Button | Class | Background | Color | Border | Text |
|--------|-------|-----------|-------|--------|------|
| Cancel | `.cwoc-tp-btn-cancel` | `#f5e6cc` | `#6b4e31` | `1.5px solid #6b4e31` | "Cancel" |
| Now | `.cwoc-tp-btn-now` | `#e8dcc8` | `#3a2a14` | `1.5px solid #6b4e31` | "Now" |
| Set | `.cwoc-tp-btn-confirm` | `#6b4e31` | `#fff8e1` | `1.5px solid #4a3520` | "Set" |

- All buttons: `flex: 1`, `padding: 10px 12px`, `border-radius: 8px`, `font-family: 'Lora'`, `font-size: 0.95em`, `font-weight: 600`, `text-align: center`
- Active state: `transform: scale(0.96)`

### 8.12 Button Behaviors
- **Cancel:** Closes modal without changing the time value
- **Now:** Sets drums and inputs to current time (rounded to nearest snap increment)
- **Set:** Reads hour/minute/ampm from inputs, converts to 24-hour format, stores in the triggering element's `dataset.time`, updates display text, fires `change` event, calls `setSaveButtonUnsaved()`, closes modal

### 8.13 Time Format Detection
- Reads from `window._editorTimeFormat` or `window._globalTimeFormat`
- Values: `'24hour'` (default), `'12hour'`, `'12houranalog'`
- 12-hour modes show the AM/PM drum; 24-hour mode shows only hour and minute drums

### 8.14 Minute Step
- Default: 5 minutes
- Configurable via settings `calendar_snap` (loaded at editor init)
- Affects which minute values appear in the drum (e.g., step=15 shows 00, 15, 30, 45)
- The editable input allows ANY minute value (0–59) regardless of step — the drum scrolls to the nearest snap value for visual feedback

---

## 9. Timezone Picker Modal

### 9.1 Trigger
- Tapping any timezone abbreviation label (Section 7)
- Programmatically via `_openTzPickerModal()`

### 9.2 Overlay
- **Element:** `<div id="tzPickerModal" class="cwoc-overlay" style="display:none">`
- **CSS:** `position: fixed`, `top: 0`, `left: 0`, `width: 100%`, `height: 100%`, `background: rgba(0, 0, 0, 0.5)`, `z-index: 9999`, `display: flex`, `align-items: center`, `justify-content: center`
- **Tap outside:** Closes modal (cancel behavior)

### 9.3 Modal Content
- **Element:** `<div class="tz-picker-modal">`
- **CSS:** `background: #fffaf0`, `border: 2px solid #6b4e31`, `border-radius: 8px`, `padding: 24px`, `min-width: 300px`, `max-width: 400px`, `width: 90%`, `font-family: 'Lora', Georgia, serif`, `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3)`
- **Mobile (≤600px):** `min-width: 0`, `width: 95%`, `padding: 16px`

### 9.4 Modal Elements (top to bottom)

1. **Title** — `<h3>Set Timezone</h3>`
   - CSS: `margin: 0 0 16px 0`, `color: #4a2c2a`, `font-size: 1.1em`

2. **Search Input** — `<input type="text" id="chit-timezone" list="tz-list-editor" placeholder="Search timezone or address…" autocomplete="off">`
   - CSS: `width: 100%`, `padding: 8px 10px`, `font-family: 'Lora'`, `font-size: 1em`, `color: #1a1208`, `background: #fff8f0`, `border: 1px solid #a0522d`, `border-radius: 4px`, `box-sizing: border-box`
   - Placeholder: `color: #c9b896`, `font-style: italic`
   - Focus: `border-color: teal`, `box-shadow: 0 0 0 2px rgba(0, 128, 128, 0.2)`
   - Mobile: `min-height: 38px`, `font-size: 16px` (prevents iOS zoom)

3. **Datalist** — `<datalist id="tz-list-editor">` populated with:
   - Common timezone entries at top (18 entries: US time zones, European, Asian, Australian, NZ)
   - Format: "MST - Mountain Time (America/Denver)"
   - All IANA timezones from `Intl.supportedValuesOf('timeZone')`

4. **Hint text** — `<p class="tz-picker-hint">(or enter address)</p>`
   - CSS: `margin: 6px 0 12px 0`, `font-size: 0.85em`, `color: #8b5a2b`, `font-style: italic`

5. **Status display** — `<span id="timezoneDisplay">`
   - CSS: `display: block`, `min-height: 1.2em`, `margin-bottom: 12px`, `color: #2e7d32`, `font-size: 0.9em`, `font-weight: 500`
   - Shows: "✓ America/Denver" (valid selection), "🔍 Looking up…" (geocoding), "⚠️ No results" (failed)

6. **Action buttons** — `<div class="tz-picker-modal-actions">`
   - CSS: `display: flex`, `gap: 8px`, `justify-content: flex-end`
   - Mobile: `flex-direction: column`, buttons get `width: 100%`, `min-height: 38px`
   - **Clear button:** `<button class="zone-button" id="tzModalClearBtn">Clear (floating)</button>` — removes timezone, reverts to floating
   - **Cancel button:** `<button class="zone-button" id="tzModalCancelBtn">Cancel</button>` — closes without changes

### 9.5 Input Behavior
- **Typing a valid IANA timezone:** Auto-validates against datalist. On match: shows "✓ [timezone]" in display, auto-closes after 200ms delay, applies the timezone.
- **Typing an address/place name + Enter:** Triggers geocoding via `/api/geocode?q=[query]`. On success: detects timezone from coordinates, shows "✓ [timezone] (from "[query]")", auto-applies after 200ms. Also populates the Location zone with the geocoded address.
- **Selecting from datalist dropdown:** Same as typing a valid timezone — auto-validates and applies.

### 9.6 ESC Key
- Captured in capture phase (`addEventListener('keydown', handler, true)`)
- Calls `stopImmediatePropagation()` and `preventDefault()`
- Closes modal without applying changes

### 9.7 Pre-fill Behavior
- If chit already has an explicit timezone: input pre-filled with IANA name, display shows "✓ [timezone]"
- If no timezone set: input empty, display empty

---

## 10. Timezone Suggestion Prompt

### 10.1 Trigger
- When the user geocodes a location in the Location zone and the detected timezone differs from the current timezone
- Only shown if: no explicit timezone is already set AND date mode is not "none"

### 10.2 Appearance
- **Element:** `<div class="tz-suggestion" id="tzSuggestionPrompt">`
- **Injected into:** The first visible date-mode-fields container (`#startEndFields`, `#dueFields`, or `#pointInTimeFields`)
- **CSS:** `display: flex`, `align-items: center`, `gap: 8px`, `padding: 6px 10px`, `margin-top: 6px`, `background: rgba(0, 128, 128, 0.06)`, `border: 1px solid rgba(0, 128, 128, 0.3)`, `border-radius: 4px`, `font-size: 0.85em`, `color: #1a1208`, `font-family: 'Lora'`
- **Mobile (≤600px):** `flex-direction: column`, `align-items: stretch`, `gap: 6px`

### 10.3 Contents
1. **Text:** `<span class="tz-suggestion-text">📍 Detected: America/Denver</span>` — `flex: 1`
2. **Use button:** `<button class="tz-suggestion-btn tz-suggestion-accept">Use</button>`
   - CSS: `background: teal`, `color: #fffaf0`, `padding: 3px 10px`, `font-size: 0.85em`, `border-radius: 4px`, `border: 1px outset #8b5a2b`
   - Mobile: `text-align: center`, `padding: 8px 12px`, `min-height: 38px`
   - Hover: `background: #006666`
3. **Dismiss button:** `<button class="tz-suggestion-btn tz-suggestion-dismiss">Dismiss</button>`
   - CSS: `background: #f5ebe0`, `color: #1a1208`, same sizing as Use button
   - Hover: `background: #e8d5c0`

### 10.4 Behavior
- **Use:** Sets `window._chitTimezone` to the detected timezone, updates all abbreviation labels, marks unsaved, removes prompt
- **Dismiss:** Simply removes the prompt element, leaves timezone unchanged

---

## 11. Repeat (Recurrence) Row

### 11.1 Container
- **Element:** `<div class="date-mode-row" id="repeatCheckboxRow" style="display:none">`
- **Visibility:** Shown when date mode is Start/End or Due (not None, not Point in Time, not when habit is active)

### 11.2 Label
- **Element:** `<label class="date-mode-label" style="cursor:pointer">`
- **Contents:** `<input type="checkbox" id="repeatEnabled" onchange="onRepeatToggle()"> 🔁 Repeat`

### 11.3 Inline Options (shown when checkbox is checked)
- **Element:** `<span id="repeatOptionsInline" style="display:none">`
- **Shown:** When `#repeatEnabled` is checked

**Contents:**
1. **Frequency dropdown** — `<select id="recurrence" class="date-time" style="width:auto">`
   - Options: Daily, Weekly (contextual: "Weekly on Saturday"), Monthly (contextual: "Monthly on the 18th"), Yearly (contextual: "Yearly on May 18th"), Custom…
   - Labels update dynamically based on the active date via `_updateRecurrenceLabels()`
   - When habit is active: simplified labels without day/date context (just "Daily", "Weekly", "Monthly", "Yearly")

2. **Ends Never checkbox** — `<label class="cwoc-inline-check cwoc-inline-label-sm"><input type="checkbox" id="recurrenceEndsNever" checked> Ends never</label>`
   - `margin-left: 8px`

3. **End date input** (shown when "Ends never" is unchecked) — `<input type="text" id="recurrenceUntil" class="date-time date-input" placeholder="End date" style="width:90px">`
   - Uses Flatpickr with format "Y-M-d"

### 11.4 Custom Recurrence Block
- **Element:** `<div id="repeatOptionsBlock" style="display:none" class="repeat-options-group">`
- **Shown:** When frequency dropdown is set to "Custom…"
- **CSS class:** `.repeat-options-group` — `display: table-row-group`

**Contents:**
1. **Interval row:** "Every [number] [unit]"
   - Number input: `<input type="number" id="recurrenceInterval" value="1" min="1" max="999" style="width:45px">`
   - Unit dropdown: `<select id="recurrenceFreq">` with options: minutes, hours, days, weeks (default), months, years

2. **By-day checkboxes** (shown only when custom freq = WEEKLY):
   - `<div id="recurrenceByDay" style="display:none;margin-top:4px;gap:4px;flex-wrap:wrap">`
   - 7 checkboxes: Su, Mo, Tu, We, Th, Fr, Sa
   - Each: `<label class="cwoc-inline-label-sm"><input type="checkbox" value="SU"> Su</label>`
   - `.cwoc-inline-label-sm`: `font-size: 0.85em`

### 11.5 Recurrence Icon
- **Element:** `<span id="recurrenceIcon">` in the editor title accessories area
- Shows 🔁 when repeat is enabled (or 🎯 when habit is active)
- `font-size: 1.1em`, `opacity: 0.7`
- Hidden when repeat is disabled

---

## 12. Habit Mode Interactions with Dates Zone

When the Habit toggle is activated (from the Task zone header), the Dates zone undergoes significant changes:

### 12.1 Forced States
- **Date mode "None" is hidden and disabled** — habits require a date
- **All Day is forced ON and locked** — button shows disabled state (opacity 0.6, pointer-events none, title "Habits are always all-day")
- **Repeat is auto-enabled** with Daily frequency (if not already on)
- **Repeat row is hidden** — habit controls subsume it (frequency is set in the Habits zone)
- **Perpetual row becomes visible** — only available for habits
- **Dates zone auto-expands** if collapsed

### 12.2 Recurrence Sync
- The habit frequency dropdown (`#habitFrequency` in the Habits zone) syncs bidirectionally with the hidden recurrence dropdown (`#recurrence`)
- Changing habit frequency updates recurrence; loading a recurring chit as habit syncs the other way
- "Ends never" is forced checked for habits

### 12.3 Recurrence Labels (Habit Mode)
- When habit is active, recurrence labels are simplified:
  - "Daily" (not "Daily")
  - "Weekly" (not "Weekly on Saturday")
  - "Monthly" (not "Monthly on the 18th")
  - "Yearly" (not "Yearly on May 18th")

### 12.4 Recurrence Icon
- Changes from 🔁 to 🎯 when habit is active
- Title changes from "Recurring chit" to "Habit"

### 12.5 On Habit Deactivation
- All Day unlocked
- "None" date mode row restored
- Repeat row shown again (but unchecked)
- Perpetual row hidden
- Recurrence icon reverts to 🔁

---

## 13. Date Mode Change Behavior (onDateModeChange)

When the user selects a different date mode radio button:

### 13.1 Field Visibility
| Mode | startEndFields | dueFields | perpetualFields | pointInTimeFields | All Day btn | Repeat row |
|------|---------------|-----------|-----------------|-------------------|-------------|------------|
| none | hidden | hidden | hidden | hidden | hidden | hidden |
| startend | visible | hidden | hidden | hidden | visible | visible |
| due | hidden | visible | hidden | hidden | visible | visible |
| perpetual | hidden | hidden | visible | hidden | visible | hidden (habit manages) |
| pointintime | hidden | hidden | hidden | visible | hidden | hidden |

### 13.2 Side Effects
- **Recurrence fields** get `.greyed-out` class (opacity 0.3, pointer-events none) when mode is "none" or "pointintime"
- **Timezone abbreviation labels** are injected/updated via `_updateTimezoneRowVisibility()`
- **Recurrence labels** update to reflect the new date context
- **Default notifications** are auto-populated for new chits when a date mode is first activated
- **Notifications container** re-renders (direction options depend on date mode)
- **Save button** marked unsaved (unless suppressed during init)

### 13.3 Auto-Defaults on First Activation
- All Day is auto-checked (but time inputs remain visible due to `_allDayAutoDefaulted` flag)
- Point in Time auto-populates with current date/time if empty
- Perpetual auto-sets start date to today if empty

---

## 14. Data Model (Backend Fields)

### 14.1 Chit Fields Used by Dates Zone

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `start_datetime` | Optional[str] | None | ISO datetime string (stored as "YYYY-Mon-DD" in Flatpickr) |
| `end_datetime` | Optional[str] | None | ISO datetime string |
| `due_datetime` | Optional[str] | None | ISO datetime string |
| `point_in_time` | Optional[str] | None | Reference timestamp (not a deadline) |
| `all_day` | Optional[bool] | False | Whether the event spans full days |
| `timezone` | Optional[str] | None | IANA timezone (e.g., "America/Denver") or null for floating |
| `recurrence_rule` | Optional[Dict] | None | `{ freq, interval, byDay, until }` |
| `perpetual` | Optional[bool] | False | Starts now, continues forever |
| `habit` | Optional[bool] | False | Explicit habit opt-in flag |

### 14.2 Recurrence Rule Structure
```json
{
  "freq": "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "MINUTELY" | "HOURLY",
  "interval": 1,
  "byDay": ["MO", "WE", "FR"],
  "until": "2026-Dec-31"
}
```

### 14.3 Date Format Convention
- Flatpickr stores dates as `"YYYY-Mon-DD"` (e.g., "2026-May-18")
- Time buttons store as `"HH:MM"` in 24-hour format (e.g., "14:30")
- API sends/receives ISO format; `convertMonthFormat()` handles conversion

---

## 15. Visual Theme & Typography

### 15.1 Fonts
- **Primary:** `'Lora', Georgia, serif` (self-hosted variable font, weights 400–700)
- **Inputs/selects:** Inherit Lora from parent
- **Time picker:** Explicitly sets `font-family: 'Lora', Georgia, serif`

### 15.2 Color Palette (Dates Zone)

| Token | Value | Usage |
|-------|-------|-------|
| `--parchment-light` | `#fdf5e6` | Input backgrounds, button text |
| `--parchment-dark` / `--zone-body-bg` | `#fff8dc` | Zone body background |
| `--aged-brown-dark` | `#4a2c2a` | Zone title text, dark text |
| `--aged-brown-medium` / `--border-color` | `#8b4513` | Borders, input borders |
| `--aged-brown-light` | `#a0522d` | Zone button background |
| `--accent-teal` | `#008080` | Active All Day button, checkbox accent, focus rings |
| `--text-color` | `#4a2c2a` | General text |
| Muted text | `#8b7355` | Empty time button placeholder |
| Muted text (tz floating) | `#8b5a2b` at 0.55 opacity | Floating timezone label |
| Suggestion bg | `rgba(0, 128, 128, 0.06)` | Timezone suggestion prompt |
| Suggestion border | `rgba(0, 128, 128, 0.3)` | Timezone suggestion prompt |

### 15.3 Sizing

| Element | Desktop | Mobile |
|---------|---------|--------|
| Date input width | 100px | flex: 1, min-width 80px |
| Time button width | 80px | min-height 34px |
| Radio/checkbox | browser default | 16×16px fixed |
| Zone button font | 12px | 12px |
| Date input font | 0.85em | 16px (iOS zoom prevention) |
| Time button font | 0.85em | 16px |
| Label font | 0.9em bold | 0.9em bold |
| Inline label (`.cwoc-inline-label-sm`) | 0.85em | 0.85em |

### 15.4 Spacing

| Context | Value |
|---------|-------|
| Zone body padding | 10px (desktop), 8px 1em (mobile) |
| Date mode row spacing | 6px (table border-spacing, desktop), 4px padding (mobile) |
| Fields indent (mobile) | 22px left margin |
| Field gap (mobile) | 6px |
| Input padding | 4px 6px (desktop), 4px 8px (mobile) |
| Time button padding | 3px 6px |
| Margin between inputs | 4px (margin-right on date/time inputs) |

---

## 16. Responsive Breakpoints

### 16.1 Mobile Zone Mode (≤768px)
- Body gets class `mobile-zone-mode`
- Zone navigation handled by a sticky header bar with prev/next zone buttons
- Zone containers fill full width, no border-radius, no left/right borders
- Zone headers show only actions (title/icon hidden)
- Zone body uses flex column layout
- All inputs get `min-height: 38px`, `font-size: 16px`
- Checkboxes/radios: `16×16px`, `min-height: unset`
- Date mode group switches from table to flex-column layout
- Fields get 22px left indent to align under radio labels

### 16.2 Timezone Picker Mobile (≤600px)
- Modal: `width: 95%`, `padding: 16px`, `min-width: 0`
- Input: `min-height: 38px`, `font-size: 16px`
- Action buttons: `flex-direction: column`, each `width: 100%`, `min-height: 38px`
- Suggestion prompt: `flex-direction: column`, buttons get `min-height: 38px`

### 16.3 Time Picker Small Screen (≤380px)
- Drum height: 180px (from 200px)
- Item height: 36px (from 40px)
- Item font: 1.2em (from 1.4em)
- Selected item font: 1.4em (from 1.6em)
- Highlight bar height: 36px
- Separator line-height: 180px

---

## 17. Interaction Summary

| Action | Element | Result |
|--------|---------|--------|
| Tap radio button | Date mode radio | Switches visible fields, updates All Day/Repeat visibility |
| Tap date input | Flatpickr input | Opens Flatpickr calendar dropdown |
| Tap time button | `.cwoc-time-btn` | Opens drum roller time picker modal |
| Tap All Day button | `#allDayToggleBtn` | Toggles all-day state, hides/shows time buttons |
| Tap Repeat checkbox | `#repeatEnabled` | Shows/hides recurrence options inline |
| Change frequency dropdown | `#recurrence` | Updates labels, shows/hides custom block |
| Tap timezone label | `.tz-abbrev-label` | Opens timezone picker modal |
| Tap "Now" (Point in Time) | Zone button | Sets date and time to current moment |
| Tap "Use" (tz suggestion) | `.tz-suggestion-accept` | Applies detected timezone |
| Tap "Dismiss" (tz suggestion) | `.tz-suggestion-dismiss` | Removes suggestion prompt |
| Type in tz modal input | `#chit-timezone` | Auto-validates against datalist, auto-closes on match |
| Press Enter in tz modal | `#chit-timezone` | Triggers geocoding if not a valid timezone |
| Tap "Clear" in tz modal | `#tzModalClearBtn` | Removes timezone (floating), closes |
| Tap "Cancel" in tz modal | `#tzModalCancelBtn` | Closes without changes |
| ESC key (tz modal open) | keyboard | Closes tz modal (capture phase, stops propagation) |
| ESC key (time picker open) | keyboard | Closes time picker (capture phase, stops propagation) |
| ESC key (Flatpickr open) | keyboard | Closes Flatpickr calendar |

---

## 18. State Persistence & Save

### 18.1 Unsaved Changes
- Any interaction that modifies a date/time value calls `setSaveButtonUnsaved()`
- This marks the editor's save system as dirty (shows unsaved indicator)
- The `_dateModeSuppressUnsaved` flag prevents marking unsaved during initial load

### 18.2 Save Payload
When the user saves, the dates zone contributes these fields to the PUT request:
- `start_datetime`: From `#start_datetime` input value (if Start/End or Perpetual mode)
- `end_datetime`: From `#end_datetime` input value (if Start/End mode, cleared for Perpetual)
- `due_datetime`: From `#due_datetime` input value (if Due mode)
- `point_in_time`: From `#point_in_time_date` + `#point_in_time_time` (if Point in Time mode)
- `all_day`: Boolean from `#allDay` checkbox
- `timezone`: From `window._chitTimezone` (null for floating)
- `recurrence_rule`: Built by `_buildRecurrenceRule()` from repeat controls
- `perpetual`: Boolean (true if Perpetual mode selected)

### 18.3 Load Behavior
When opening an existing chit:
1. `_dateModeSuppressUnsaved = true` (prevent false dirty state)
2. Date mode detected from chit data via `_detectDateMode(chit)`
3. Radio button set and `onDateModeChange()` called
4. Date/time values populated into inputs
5. Recurrence rule loaded via `_loadRecurrenceRule(rule)`
6. Timezone loaded via `_loadTimezoneValue(tz)`
7. All Day state restored
8. `_dateModeSuppressUnsaved = false`

---

## 19. What Is NOT in the Dates Zone

- **Habit controls** (goal, frequency, reset, calendar, charts) — These live in the separate "🎯 Habits" zone (`#habitLogSection`), which only appears when habit is active
- **Alerts/notifications** — Separate "🔔 Alerts" zone
- **Weather data** — Shown in the compact weather section above the zones grid
- **Time estimate** — Shown in the Task zone
- **Completed datetime** — Set automatically by status changes, not user-editable in dates zone
