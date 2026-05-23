# Indicators View — Web Implementation Spec (for Android Parity)

This document describes exactly how the web Indicators view works, so the Android app can be brought to parity.

---

## Overview

The Indicators view is a C CAPTN dashboard tab with **3 sub-modes**: Charts, Calendar, Log. It displays health data recorded on chits via the `health_data` JSON field. The view relies on **Custom Objects** (a CWOC feature) to define what indicators exist, their names, units, ranges, and which ones appear as charts.

---

## API Endpoints

### 1. `GET /api/health-data?since=&until=`

Returns an array of health data entries extracted from chits.

**Query params:**
- `since` — ISO date string (e.g., `2025-01-01`). Filters chits with start/due/created >= this.
- `until` — ISO datetime string (e.g., `2025-12-31T23:59:59`). Filters chits with start/due/created <= this.

**Response format:** Array of objects, each representing one chit's health readings:
```json
[
  {
    "date": "2025-03-15",
    "datetime": "2025-03-15T08:30:00",
    "chit_id": "uuid-of-chit",
    "chit_title": "Morning vitals",
    "uuid-of-heart-rate-object": 72,
    "uuid-of-weight-object": 175.5,
    "heart_rate": 72
  }
]
```

Key points:
- Readings are keyed by **Custom Object UUID** (primary) or **legacy keys** (fallback: `heart_rate`, `bp_systolic`, `bp_diastolic`, `spo2`, `temperature`, `weight`, `height`, `glucose`, `distance`, `period_active`)
- Date is derived from `COALESCE(start_datetime, due_datetime, created_datetime)`
- Results sorted ascending by date
- Chits with `deleted=1` or empty/null `health_data` are excluded

### 2. `GET /api/custom-objects/zone/indicators_zone`

Returns Custom Objects assigned to the "indicators_zone" zone. Used for:
- Calendar mode: range classification (green/amber based on `range_min`/`range_max`)
- Log mode: UUID-to-display-name resolution

**Response format:** Array of Custom Object records:
```json
[
  {
    "id": "uuid",
    "name": "Heart Rate",
    "value_type": "number",
    "units": "bpm",
    "metric_units": "bpm",
    "range_min": 60,
    "range_max": 100,
    "zone_config": null,
    "zone_sort_order": 0
  }
]
```

### 3. `GET /api/custom-objects/zone/graphs`

Returns Custom Objects assigned to the "graphs" zone. These determine which charts appear in the sidebar's "Show Graphs" filter checkboxes.

Same response format as above.

### 4. `GET /api/custom-objects`

Returns ALL Custom Objects (used by the "Add Graph" picker to let users add one-off graphs for objects not in the graphs zone).

---

## Charts Mode (Default)

### Data Flow
1. Fetch objects from `/api/custom-objects/zone/graphs` → populate sidebar checkboxes
2. Restore checkbox selection from localStorage (`cwoc_ind_selection`)
3. If nothing selected, select all by default
4. Fetch health data from `/api/health-data?since=X&until=Y` (range determined by sidebar buttons)
5. Build chart array from graph zone objects (UUID-based, with colors assigned round-robin)
6. Also include "one-off" graphs from localStorage that aren't in the zone
7. **Legacy fallback:** If no graph zone objects exist at all, use hardcoded charts (heart_rate, bp, spo2, temperature, weight, height, glucose, distance)
8. Filter charts to only those whose key is in the selected checkboxes
9. Render "Latest Values" cards + SVG line charts

### Latest Values Cards
- Displayed above the charts in a flex grid (`#indicators-latest`)
- One card per chart type showing: label, latest numeric value (most recent entry), unit
- Clicking a card navigates to the chit editor for that reading's chit

### SVG Line Charts
- Rendered in a **2-column CSS grid** (`#indicators-charts { display: grid; grid-template-columns: repeat(2, 1fr); }`)
- Each chart is a `<div>` with:
  - Header: label + unit + expand/collapse button (⤢/⤡)
  - SVG with `viewBox="0 0 500 180"`, `preserveAspectRatio="xMidYMid meet"`
  - Horizontal gridlines (4 lines) with Y-axis value labels
  - X-axis date labels (up to 6, format adapts to date span: time for <2 days, day for <14 days, M/D for <90 days, M/D/YY otherwise)
  - Line path connecting data points
  - Optional paired line (e.g., diastolic BP) as dashed line
  - Clickable circle markers at each data point (click → navigate to chit editor)
  - Tooltip on hover showing value + date + chit title

### Chart Interactions
- **Expand/collapse:** Click expand button → chart fills viewport (single column, height calculated from available space). Other charts hidden. Click again to restore grid.
- **Drag-to-reorder:** HTML5 drag on desktop, touch gesture on mobile. Order saved to localStorage (`cwoc_indicators_chart_order`).
- **Long-press (mobile):** Opens quick-edit modal for the most recent chit with that indicator.

### Time Range (Sidebar)
- Buttons: Day (1 day back), Week (7 days), Month (1 month), Year (1 year), All (from 2020-01-01)
- Custom Range: Two date inputs + "Go" button
- Changing range updates hidden `#ind-start` and `#ind-end` inputs, then calls `_indicatorsLoad()`

### Graph Filter (Sidebar)
- "Show Graphs" section: checkboxes dynamically populated from `/api/custom-objects/zone/graphs`
- Selection persisted as array of UUIDs in localStorage (`cwoc_ind_selection`)
- Unchecking a graph hides its chart but keeps the "Latest Value" card visible
- "+ Add Graph" collapsible section: shows all other Custom Objects (grouped by category/sub_type), clicking one adds it as a "one-off" graph with "(one-off)" label

---

## Calendar Mode

### Data Flow
1. Fetch health data for the **entire current year** (`since=YYYY-01-01`, `until=YYYY-12-31T23:59:59`)
2. Fetch indicator objects from `/api/custom-objects/zone/indicators_zone`
3. Build a day map: `"YYYY-MM-DD" → [{objectId, value}, ...]`
4. Render year-view grid

### Year-View Grid Layout
- Header: current year (e.g., "2025")
- 12 rows, one per month
- Each row: 3-letter month label (Jan, Feb, ...) + up to 31 day cells
- Day cells are tiny colored squares (10×10px desktop, 8×8 tablet, 6×6 mobile)

### Color Classification (`_classifyDayColor`)
For each day with readings:
1. For each reading, find the matching Custom Object by UUID
2. Skip boolean/string type objects (can't range-check those)
3. Skip objects with no `range_min` AND no `range_max` defined
4. Parse value as float; skip if NaN
5. If value > `range_max` OR value < `range_min` → **amber** (out of range)
6. If ALL readings are in range → **green**
7. If no readings at all → **none** (gray/empty)

### Cell Colors
- Green: `#4caf50` — all readings in range
- Amber: `#ff9800` — at least one reading out of range
- None: `#e0d4b5` — no data recorded

### Interactions
- Today's cell has a dark outline (`outline: 2px solid #2b1e0f`)
- Cells with data are clickable → navigate to the chit editor for that day's chit
- Hover on clickable cells: scale(1.5) + box-shadow

### Legend
Shown below the grid: green swatch "All in range", amber swatch "Out of range", gray swatch "No data"

---

## Log Mode

### Data Flow
1. Fetch health data for the **entire current year** (same as Calendar)
2. Fetch indicator objects from `/api/custom-objects/zone/indicators_zone`
3. Sort entries reverse-chronologically (most recent first)
4. Render list

### Entry Format
Each entry shows:
- **Date** (formatted as MM/DD/YYYY)
- **Chit title** (bold, truncated with ellipsis)
- **Summary** — human-readable list of readings (e.g., "Heart Rate: 72, Weight: 175, BP: 120/80")

### Summary Building (`_buildLogSummary`)
1. Skip metadata keys: `date`, `datetime`, `chit_id`, `chit_title`
2. For each remaining key:
   - Try UUID match against indicator objects → use object's `name`
   - Try legacy key match (e.g., `heart_rate` → "Heart Rate")
   - If legacy key has a UUID equivalent already present, skip to avoid duplicates
3. Format: `"Name: value"` joined by commas
4. Boolean values shown as ✓/✗

### Interactions
- Clicking an entry navigates to the chit editor for that chit
- Hover: background lightens, border darkens

---

## Key Implementation Details for Android

### What the Android app needs to do differently

1. **Fetch real data from the API.** The current Android `IndicatorsViewModel` appears to load health data from the local Room database by parsing `health_data` JSON from `ChitEntity`. It needs to either:
   - Parse `health_data` from local chits (same logic as backend), OR
   - Call `/api/health-data` and `/api/custom-objects/zone/indicators_zone` and `/api/custom-objects/zone/graphs` directly

2. **Custom Objects are the source of truth for chart definitions.** The web doesn't hardcode "Mood/Energy/Sleep/Exercise/Productivity" — it dynamically loads whatever objects are in the "graphs" zone. The Android sidebar had hardcoded checkboxes that don't match real data.

3. **UUID-based keying.** Health data readings are keyed by Custom Object UUIDs, not human-readable names. The Android code needs to resolve UUIDs to display names using the indicator objects.

4. **Range classification for Calendar.** Each Custom Object can have `range_min` and `range_max`. The calendar color is determined by checking readings against these ranges.

5. **Time ranges for Charts mode:**
   - Day = 1 day back from now
   - Week = 7 days back
   - Month = 1 month back (default)
   - Year = 1 year back
   - All = from 2020-01-01

6. **Calendar and Log always fetch the full current year** regardless of the sidebar time range setting.

### Data model on chits

The `health_data` field on a chit is a JSON object like:
```json
{
  "550e8400-e29b-41d4-a716-446655440000": 72,
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8": 175.5,
  "heart_rate": 72
}
```

Keys are either UUIDs (Custom Object IDs) or legacy string keys. Values are numbers, booleans, or strings.

### What "Custom Objects" are

Custom Objects are user-defined data types in CWOC. They have:
- `id` (UUID)
- `name` (display name, e.g., "Heart Rate")
- `value_type` ("number", "boolean", "string")
- `units` (e.g., "bpm", "lbs")
- `metric_units` (e.g., "bpm", "kg")
- `range_min`, `range_max` (for range classification)
- `sub_type` / `type` (category grouping)

They can be assigned to **zones** (like "indicators_zone" or "graphs") via a `zone_assignments` table.

---

## CSS/Visual Notes

- Charts grid: 2 columns on desktop, responsive
- Parchment theme: `#fff8e1` backgrounds, `#8b5a2b` borders, `#6b4e31` text, `#2b1e0f` headings
- Chart colors cycle through: `#b22222`, `#4682b4`, `#d4a017`, `#6b8e23`, `#8b5a2b`, `#d2691e`, `#2e8b57`, `#c44`, `#9370db`, `#20b2aa`
- Calendar cells: 10px squares, 1px gap, responsive down to 6px on mobile
- Log entries: flex row with date + body, stacks vertically on mobile


---

## App Build As-Is — Differential Analysis

### The Root Cause: Data Format Mismatch (CRITICAL)

The **single biggest problem** is that the Android parser expects a completely different JSON format than what's actually stored in the database.

**What the server sends (and Room stores) as `healthData`:**
```json
{"550e8400-e29b-41d4-a716-446655440000": 72, "6ba7b810-9dad-11d1-80b4-00c04fd430c8": 175.5}
```
This is a **flat dict** mapping Custom Object UUIDs (or legacy keys) to numeric values. There is NO date, NO type name — just UUID→value pairs. The date comes from the chit's own `start_datetime`/`due_datetime`/`created_datetime`.

**What `ChartDataTransformer.parseHealthData()` expects:**
```json
[{"type": "weight", "value": 185.5, "date": "2025-01-15"}, ...]
```
This is an **array of objects** with explicit `type`, `value`, and `date` fields.

**Result:** `parseHealthData()` always returns an empty list because `Gson.fromJson(json, List<Map<String, Any>>)` throws an exception (or returns null) when given a dict instead of an array. Every chart, calendar cell, and log entry is empty. The entire view shows "No health data yet" even when chits have health data.

---

### Detailed Differential: Charts Mode

| Aspect | Web | App (Current) | Gap |
|--------|-----|---------------|-----|
| **Data source** | `GET /api/health-data?since=&until=` (server aggregates from all chits) | Room DB via `chitDao.getIndicatorChits()` (local query) | App approach is fine (data is synced locally), but parsing is broken |
| **Chart definitions** | Dynamic from `GET /api/custom-objects/zone/graphs` | None — relies on `label` field from parsed data (which is always empty) | App has no concept of "graphs zone" objects |
| **Chart selection** | Sidebar checkboxes populated from graphs zone objects, persisted in localStorage | No selection mechanism (old hardcoded checkboxes were removed) | Need to fetch graphs zone objects and let user select |
| **Parsing health_data** | Server-side: iterates chits, parses dict, flattens into `{date, chit_id, chit_title, ...readings}` | Client-side: `parseHealthData()` expects array format, gets dict, returns empty | **BROKEN** — parser doesn't match actual data format |
| **UUID resolution** | Resolves UUID keys to display names via indicator objects | Never gets to this step (parsing fails first) | Need UUID→name resolution after fixing parser |
| **Time range** | Day=1d, Week=7d, Month=1mo, Year=1yr, All=from 2020 | Day/Week→7d, Month→30d, Year→90d, All=no limit | Close enough, but "Day" should be 1 day, not 7 |
| **Latest values cards** | Row of cards above charts showing most recent reading per type | Not implemented | Missing feature |
| **SVG vs Canvas** | SVG with viewBox, gridlines, axis labels, date labels, clickable circles | Compose Canvas with line + dots only (no gridlines, no axis labels, no date labels) | Charts are bare-bones even if data worked |
| **Expand/collapse** | Single chart fills viewport, others hidden | Collapse hides chart body (card stays visible) | Different UX but acceptable |
| **Drag-to-reorder** | HTML5 drag + touch gesture, order persisted | Not implemented | Missing feature |
| **Click data point** | Navigates to chit editor | Shows tooltip text below chart | Different but acceptable |
| **Paired lines** | BP systolic + diastolic as solid + dashed | Not implemented | Missing (minor) |
| **"+ Add Graph" picker** | Collapsible section showing all Custom Objects grouped by category | Not implemented | Missing feature |
| **One-off graphs** | Objects not in graphs zone can be temporarily added | Not implemented | Missing feature |
| **Legacy fallback** | If no graph zone objects, uses hardcoded charts (heart_rate, bp, etc.) | No fallback (parser fails regardless) | N/A until parser is fixed |

---

### Detailed Differential: Calendar Mode

| Aspect | Web | App (Current) | Gap |
|--------|-----|---------------|-----|
| **Data source** | `GET /api/health-data` for full year | Same `healthEntries` from Room (but empty due to parsing bug) | Data is empty |
| **Grid layout** | 12 rows × 31 cols, tiny cells (10px), horizontal scroll on mobile | 12 Cards in LazyColumn, each with horizontal scroll Row of 14dp boxes | Layout is reasonable but data is empty |
| **Color classification** | `_classifyDayColor()` checks UUID-keyed readings against object's `range_min`/`range_max` | `classifyDay()` checks by `indicatorType.lowercase()` name match against `rangeMap` | Logic is correct in principle, but `indicatorType` is always "unknown" because parsing fails |
| **Range map source** | Custom Objects from `/api/custom-objects/zone/indicators_zone` (matched by UUID) | Same API call, but maps by `obj.name.lowercase()` | Should match by UUID/objectId, not name |
| **Click interaction** | Click cell → navigate to chit editor | No click handler | Missing |
| **Today highlight** | Dark outline on today's cell | Overlay with "•" dot | Acceptable alternative |
| **Legend** | Below grid: green/amber/gray swatches with labels | Same pattern | ✅ Matches |

---

### Detailed Differential: Log Mode

| Aspect | Web | App (Current) | Gap |
|--------|-----|---------------|-----|
| **Data source** | `GET /api/health-data` for full year | Same `healthEntries` from Room (empty) | Data is empty |
| **Entry format** | Date + chit title + summary (all readings comma-separated) | Date header → entries showing `indicatorType: value` | Structure is fine but data is empty |
| **UUID resolution** | `_buildLogSummary()` resolves UUIDs to display names | Shows raw `indicatorType` (which would be "unknown") | Need UUID→name resolution |
| **Click interaction** | Click entry → navigate to chit editor | No click handler | Missing |
| **Grouping** | Flat list sorted by date (one entry per chit) | Grouped by date (multiple entries per date) | App groups better actually |

---

### Detailed Differential: Sidebar Controls

| Aspect | Web | App (Current) | Gap |
|--------|-----|---------------|-----|
| **Mode toggle** | 3-value pill in main view (Calendar/Log/Charts) | Moved to sidebar (Charts/Calendar/Log) | ✅ Fixed in recent change |
| **Time Range** | Day/Week/Month/Year/All buttons | Same buttons in sidebar | ✅ Matches |
| **Custom Range** | Two date inputs + "Go" button | Removed (was non-functional) | Web has it, app doesn't — low priority |
| **Show Graphs** | Dynamic checkboxes from graphs zone objects | Removed (was hardcoded non-functional) | Need to rebuild with real data |
| **+ Add Graph** | Collapsible picker for one-off graphs | Not implemented | Missing |

---

### Summary: What Needs to Happen (Priority Order)

1. **FIX THE PARSER** — `ChartDataTransformer.parseHealthData()` must handle the actual dict format: `{"uuid": value, ...}`. It needs the chit's date (from `startDatetime`/`dueDatetime`/`createdDatetime`) passed in separately since the dict doesn't contain dates.

2. **Fetch graphs zone objects** — Call `GET /api/custom-objects/zone/graphs` to know which indicators to chart (instead of relying on parsed `label` field).

3. **UUID→name resolution** — Use the indicator objects (already fetched from `indicators_zone`) to resolve UUID keys to human-readable names for chart labels, log summaries, and calendar classification.

4. **Rebuild the ViewModel data flow:**
   - Query chits with non-empty `healthData` from Room
   - For each chit, parse `healthData` as a `Map<String, Any>` (dict, not array)
   - Use the chit's date as the reading date
   - Match keys against graphs zone objects to determine which charts to show
   - Group readings by object UUID, resolve to display names

5. **Add chart enhancements** — Gridlines, axis labels, date labels on the Canvas charts.

6. **Add click-to-navigate** — Calendar cells and log entries should navigate to the chit editor.

7. **Rebuild sidebar "Show Graphs"** — Dynamic checkboxes from graphs zone objects (low priority, can come later).

---

### Data Flow Comparison

**Web:**
```
Server aggregates: chits table → parse health_data JSON dicts → flatten into [{date, chit_id, chit_title, uuid1: val, uuid2: val, ...}]
                                                                              ↓
Frontend receives flat array ← GET /api/health-data?since=&until=
                                                                              ↓
GET /api/custom-objects/zone/graphs → determines which UUIDs to chart
                                                                              ↓
For each selected UUID: extract points from data array → build SVG chart
```

**App (broken):**
```
Room DB: chits table → healthData column (JSON string of dict: {"uuid": val})
                                                              ↓
parseHealthData() tries to parse as List<Map> → FAILS (it's a dict, not an array)
                                                              ↓
Returns empty list → no charts, no calendar data, no log entries
```

**App (what it should be):**
```
Room DB: chits table → healthData column (JSON string of dict: {"uuid": val})
                                                              ↓
Parse as Map<String, Any> (dict) + use chit's date field
                                                              ↓
GET /api/custom-objects/zone/graphs → determines which UUIDs to chart
GET /api/custom-objects/zone/indicators_zone → provides names + ranges
                                                              ↓
For each graph-zone UUID: collect (date, value) pairs across all chits → build chart
For calendar: collect all readings per day → classify green/amber/none
For log: collect all readings per chit → show date + title + summary
```
