# Indicators (All 3 Sub-Modes: Charts, Calendar, Log)

**Category:** Dashboard Views
**Item #:** 14
**Code Verified:** ✅
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-views-indicators.js` — Health Indicators (charts, calendar, log)
- `src/frontend/js/dashboard/main-views.js` — `filterChits` (sidebar visibility for Indicators tab)

---

## Mode Toggle (3-Value Pill)

- [ ] `_indViewMode` — state variable: `'charts'` (default), `'calendar'`, `'log'`
- [ ] Persisted to `localStorage('cwoc_ind_view_mode')` via `_IND_VIEW_MODE_KEY`
- [ ] `_indInitViewMode()` — initializes from localStorage on first call
- [ ] `_indBuildModeToggleHtml(activeMode)` — renders 3-value pill toggle HTML
  - [ ] Calendar | Log | Charts spans
  - [ ] Hidden input with current value
  - [ ] ⚙️ Objects link to `/frontend/html/custom-objects-editor.html`
- [ ] `_indAttachModeToggleListener()` — wires click handler on pill
  - [ ] Updates hidden input and active class
  - [ ] Persists to localStorage
  - [ ] Calls `displayIndicatorsView()` to re-render

---

## Entry Point — `displayIndicatorsView()`

- [ ] Initializes view mode from localStorage
- [ ] Routes to Calendar, Log, or Charts based on mode
- [ ] For Calendar/Log: fetches year's health data, then renders
- [ ] For Charts: renders sidebar controls + chart area

---

## Sub-Mode 1: Charts

### Layout
- [ ] Mode toggle pill at top
- [ ] `#indicators-latest` — latest values header cards
- [ ] `#indicators-charts` — chart grid

### Sidebar Controls (in `#section-indicators`)
- [ ] Time range buttons: Day, Week, Month, Year, All
  - [ ] `_indicatorsSetRange(range)` — sets date inputs and reloads
  - [ ] `_indicatorsHighlightBtn(range)` — highlights active button (ivory bg)
- [ ] Custom date range inputs (`#ind-start`, `#ind-end`)
  - [ ] `_indicatorsLoadCustomRange()` — loads with custom dates
- [ ] Graph filter checkboxes (`#ind-select`)
  - [ ] Populated from graphs zone objects
  - [ ] One-off graphs from localStorage
  - [ ] `_indSaveSelection()` — persists checked UUIDs to localStorage
  - [ ] `_indRestoreSelection()` — restores from localStorage
- [ ] "Add Graph" collapsible section
  - [ ] `_indToggleAddGraphSection()` — toggles visibility
  - [ ] `_indPopulateAddGraphSection()` — fetches all custom objects, groups by category
  - [ ] `_indRenderAddGraphSection()` — renders grouped items with collapsible categories
  - [ ] `_indAddOneOffGraph(obj)` — adds checkbox, checks it, saves, reloads

### Graph Filter Population — `_indPopulateGraphFilter()`
- [ ] Fetches objects from `GET /api/custom-objects/zone/graphs`
- [ ] Caches in `window._graphZoneObjects`
- [ ] Builds checkboxes with `data-ind` attribute (UUID)
- [ ] Restores one-off graphs via `_indRestoreOneOffGraphs()`
- [ ] Restores saved selections
- [ ] If nothing selected: selects all by default

### One-Off Graphs — `_indRestoreOneOffGraphs()`
- [ ] Finds UUIDs in selection that aren't in graph zone
- [ ] Looks up names from `window._allCustomObjects`
- [ ] Adds checkbox with "(one-off)" label

### Data Loading — `_indicatorsLoad()`
- [ ] Reads date range from `#ind-start` / `#ind-end`
- [ ] Fetches `GET /api/health-data?since=...&until=...`
- [ ] Gets unit system from settings (metric/imperial)
- [ ] Builds charts array from graph zone objects (UUID-based)
- [ ] Includes one-off graphs from localStorage
- [ ] Falls back to legacy hardcoded charts if no graph zone objects
- [ ] Gets selected indicators from sidebar checkboxes

### Latest Values Header
- [ ] One card per chart (fills row evenly)
- [ ] Shows: label, latest value (rounded), unit
- [ ] Background: `#fff8e1`, border: `1px solid #8b5a2b`
- [ ] Clickable: navigates to chit editor if `chit_id` available
- [ ] Tooltip: chit title + date

### SVG Line Charts (per selected indicator)
- [ ] Chart container: `#fff8e1` background, `1px solid #8b5a2b` border
- [ ] `dataset.indKey` for drag-to-reorder

#### Chart Header
- [ ] Bold label with unit (and paired label if applicable)
- [ ] Expand/collapse button (`fas fa-expand` / `fas fa-compress`)
  - [ ] `_indToggleExpand(key)` — toggles single chart to fill view

#### Chart SVG
- [ ] ViewBox: `0 0 500 180`, responsive width
- [ ] Y-axis: 4 gridlines with value labels
- [ ] X-axis: up to 6 date labels (smart format based on date span)
  - [ ] ≤2 days: time (HH:MM)
  - [ ] ≤14 days: day of month
  - [ ] ≤90 days: M/D
  - [ ] >90 days: M/D/YY
- [ ] Paired data: dashed line (stroke-dasharray 3,2), 0.6 opacity
- [ ] Primary data: solid line, stroke-width 2
- [ ] Data points: circles (r=3.5), clickable → navigates to chit editor
  - [ ] Tooltip: date, value, unit, chit title
- [ ] Empty state: "No data" centered text

### Expand/Collapse — `_indToggleExpand(key)`
- [ ] Expand: hides all other charts, makes selected fill available height
  - [ ] Calculates available height from viewport
  - [ ] Sets `min-height: 300px`, dynamic `max-height`
  - [ ] Changes icon to `fa-compress`
- [ ] Collapse: shows all charts, resets to normal size
  - [ ] Resets aspect ratio to `500/180`
  - [ ] Changes icon to `fa-expand`
- [ ] Window resize handler: recalculates expanded chart height

### Drag-to-Reorder (Charts)

#### HTML5 Desktop — `_enableIndicatorsDragReorder(container)`
- [ ] Each chart: `draggable = true`, `cursor: grab`
- [ ] `dragstart`: opacity 0.4, sets data transfer
- [ ] `dragover`: shows border indicator (top/bottom)
- [ ] `drop`: reorders in DOM, saves to `localStorage('cwoc_indicators_chart_order')`
- [ ] `dragend`: resets opacity

#### Touch Mobile
- [ ] `enableTouchGesture` on each chart element
- [ ] `onDragStart`: adds `cwoc-dragging` class
- [ ] `onDragMove`: shows border indicators via `elementFromPoint`
- [ ] `onDragEnd`: reorders in DOM, saves to localStorage
- [ ] `onLongPress`: opens quick-edit modal for most recent chit with that indicator

#### Order Restoration — `_restoreIndicatorsOrder(container)`
- [ ] Reads from `localStorage('cwoc_indicators_chart_order')`
- [ ] Reorders DOM children to match saved order

---

## Sub-Mode 2: Calendar — `_indicatorsRenderCalendar(data, objects)`

### Data Processing
- [ ] Fetches year's health data: `GET /api/health-data?since=YYYY-01-01&until=YYYY-12-31T23:59:59`
- [ ] Fetches indicator objects: `GET /api/custom-objects/zone/indicators_zone`
- [ ] Builds `dayMap`: dateStr → [{objectId, value}, ...]
- [ ] Builds `chitMap`: dateStr → [chit_id, ...]
- [ ] Matches UUID keys against objects
- [ ] Falls back to legacy key matching via `_findObjectByLegacyKey()`

### Calendar Grid Layout
- [ ] Container: class `ind-cal-container`
- [ ] Header: current year
- [ ] Grid: 12 rows (months) × up to 31 columns (days)
- [ ] Each row: month label (3-letter) + day cells

### Day Cell Rendering
- [ ] Class: `ind-cal-cell ind-cal-{color}`
- [ ] Colors via `_classifyDayColor(dayReadings, objects)`:
  - [ ] `green` — all readings in range
  - [ ] `amber` — any reading out of range (above range_max or below range_min)
  - [ ] `none` — no data for that day
- [ ] `ind-cal-clickable` class when day has data
- [ ] `ind-cal-today` class for current day
- [ ] `data-date` and `data-chits` attributes
- [ ] Tooltip: date + chit count

### Day Cell Click Handler
- [ ] Single chit: navigates directly to editor
- [ ] Multiple chits: navigates to first chit

### Legend
- [ ] Green swatch: "All in range"
- [ ] Amber swatch: "Out of range"
- [ ] None swatch: "No data"

### Helper — `_classifyDayColor(dayReadings, objects)`
- [ ] Returns 'none' if no readings
- [ ] Skips boolean/string value types
- [ ] Skips objects without range_min/range_max
- [ ] Returns 'amber' if any value exceeds range
- [ ] Returns 'green' otherwise

### Helper — `_findObjectByLegacyKey(legacyKey, objects)`
- [ ] Maps legacy keys to expected object names:
  - [ ] heart_rate → "Heart Rate"
  - [ ] bp_systolic → "Blood Pressure Systolic"
  - [ ] bp_diastolic → "Blood Pressure Diastolic"
  - [ ] spo2 → "Oxygen Saturation"
  - [ ] temperature → "Temperature"
  - [ ] weight → "Weight"
  - [ ] height → "Height"
  - [ ] glucose → "Glucose"
  - [ ] distance → "Distance"
  - [ ] period_active → "Period Active"

---

## Sub-Mode 3: Log — `_indicatorsRenderLog(data, objects)`

### Data Processing
- [ ] Same fetch as Calendar mode (year's health data + indicator objects)
- [ ] Sorted reverse-chronological (most recent first)

### Log Layout
- [ ] Container: class `ind-log-container`
- [ ] Header: "Health Log"
- [ ] List: class `ind-log-list`
- [ ] Empty state: "No health data recorded yet."

### Log Entry Rendering
- [ ] Class: `ind-log-entry`, `data-chit-id`
- [ ] Date column: formatted as MM/DD/YYYY
- [ ] Body:
  - [ ] Title: chit title (escaped)
  - [ ] Summary: human-readable readings via `_buildLogSummary()`

### Log Entry Click Handler
- [ ] Navigates to chit editor: `/editor?id=${chitId}`

### Summary Builder — `_buildLogSummary(healthData, objects)`
- [ ] Skips metadata keys (date, datetime, chit_id, chit_title)
- [ ] Resolves UUID keys to Custom Object display names
- [ ] Falls back to legacy key name mapping
- [ ] Avoids duplicates (skips legacy key if UUID entry exists)
- [ ] Formats booleans as ✓/✗
- [ ] Returns comma-separated "Name: value" pairs

---

## Sidebar Visibility (from `filterChits`)

- [ ] `#section-indicators` shown only when `tab === 'Indicators'`
- [ ] `#section-filters` hidden when `tab === 'Indicators'`
- [ ] `#section-order` hidden when `tab === 'Indicators'`

---

## Helpers

- [ ] `_indFmtDate(d)` — formats Date to `YYYY-MM-DD` string
- [ ] `_escHtml(text)` — HTML-escapes text (from shared-utils.js)
