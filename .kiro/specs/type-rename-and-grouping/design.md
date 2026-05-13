# Design Document: Type Rename and Grouping

## Overview

This feature adds two capabilities to the Custom Objects system:

1. **Type Rename** — A rename button on each type group header in the Custom Objects Editor, backed by a `PUT /api/custom-objects/rename-type` endpoint that atomically updates the `type` field on all matching objects for an owner.
2. **Type Grouping** — Collapsible type group headers in the chit editor's Indicators Zone (`editor-health.js`) and the dashboard's Indicators view (`main-views-indicators.js`) across all three modes (charts, log, calendar).

Key architectural decisions:
1. **Minimal backend change** — one new endpoint, one SQL UPDATE statement, no schema changes
2. **Reuse existing grouping pattern** — the Custom Objects Editor already groups by type with `co-type-group` / `co-type-group-header` CSS classes; the rename icon is added to that existing header
3. **Shared grouping utility** — a pure function `_groupObjectsByType(objects)` is used by both `editor-health.js` and `main-views-indicators.js` to produce `{type: [objects]}` maps
4. **Collapsible headers** — all expanded by default, click to toggle, state not persisted (reset on page load)
5. **No new dependencies** — vanilla JS, existing Font Awesome icons, existing CSS patterns

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Custom Objects Editor (existing)                                     │
│  ┌─ co-type-group-header ──────────────────────────────────────┐    │
│  │  "Vital" (3)  [✏️ rename icon]                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  → Click rename icon → Rename_Type_Modal → PUT /rename-type         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Chit Editor — Indicators Zone (editor-health.js)                     │
│  ┌─ type-group-header ─────────────────────────────────────────┐    │
│  │  ▼ Vital                                                     │    │
│  ├──────────────────────────────────────────────────────────────┤    │
│  │  Heart Rate [___] bpm                                        │    │
│  │  Blood Pressure [___] mmHg                                   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌─ type-group-header ─────────────────────────────────────────┐    │
│  │  ▼ Measurement                                               │    │
│  ├──────────────────────────────────────────────────────────────┤    │
│  │  Weight [___] lbs                                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard — Indicators View (main-views-indicators.js)               │
│  [Calendar | Log | Charts]                                           │
│  ┌─ type-group-header ─────────────────────────────────────────┐    │
│  │  ▼ Vital                                                     │    │
│  ├──────────────────────────────────────────────────────────────┤    │
│  │  (charts / log entries / calendar for Vital indicators)      │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. Rename Type Endpoint

**Route:** `PUT /api/custom-objects/rename-type`

**File:** `src/backend/routes/custom_objects.py` (added to existing router)

**Request Body:**
```python
class RenameTypeRequest(BaseModel):
    old_type: str
    new_type: str
```

**Logic:**
1. Validate `old_type` and `new_type` are non-empty strings (after `.strip()`)
2. If `old_type == new_type`, return `{"updated_count": 0}` immediately (no-op)
3. Execute: `UPDATE custom_objects SET type = ?, modified_datetime = ? WHERE type = ? AND owner_id = ?`
4. Return `{"updated_count": cursor.rowcount}`

**Error responses:**
- 422 if `old_type` or `new_type` is missing/empty

```python
@router.put("/api/custom-objects/rename-type")
async def rename_type(request: Request, body: RenameTypeRequest):
    """Bulk-rename a type across all matching Custom Objects for the owner."""
    owner_id = request.state.user_id

    old_type = body.old_type.strip() if body.old_type else ""
    new_type = body.new_type.strip() if body.new_type else ""

    if not old_type or not new_type:
        raise HTTPException(
            status_code=422,
            detail="Both old_type and new_type must be non-empty strings"
        )

    if old_type == new_type:
        return {"updated_count": 0}

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        now = datetime.utcnow().isoformat() + "Z"
        cursor.execute(
            "UPDATE custom_objects SET type = ?, modified_datetime = ? "
            "WHERE type = ? AND owner_id = ?",
            (new_type, now, old_type, owner_id)
        )
        conn.commit()
        return {"updated_count": cursor.rowcount}
    except Exception as e:
        logger.error(f"Error renaming type: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
```

#### 2. Pydantic Model

Added to `src/backend/models.py`:

```python
class RenameTypeRequest(BaseModel):
    old_type: str
    new_type: str
```

### Frontend Components

#### 1. Rename Type Modal (Custom Objects Editor)

**File:** `src/frontend/js/pages/custom-objects-editor.js`

**Changes to `_coRenderList()`:**
- Add a rename icon button (`<i class="fas fa-pen-to-square"></i>`) inside the existing `co-type-group-header` element, after the type name and count span.

**New functions:**
- `_coOpenRenameModal(currentType)` — creates and shows a parchment-themed modal with a text input pre-populated with `currentType`, Cancel and Rename buttons.
- `_coCloseRenameModal()` — removes the modal overlay.
- `_coSubmitRename(oldType, newType)` — validates non-empty, calls `PUT /api/custom-objects/rename-type`, on success calls `_coFetchAll()` to refresh, shows toast.

**Modal HTML structure (built in JS, following existing modal pattern):**
```html
<div class="co-modal-overlay active" id="coRenameModalOverlay">
  <div class="co-modal" role="dialog">
    <h3>Rename Type</h3>
    <div class="field">
      <label>New Type Name</label>
      <input type="text" id="coRenameInput" value="[current type]" />
      <div class="field-hint co-rename-error" style="color:#b22222;display:none;"></div>
    </div>
    <div class="co-modal-buttons">
      <button class="co-btn-cancel">Cancel</button>
      <button class="co-btn-save">Rename</button>
    </div>
  </div>
</div>
```

#### 2. Type Grouping in Indicators Zone (Chit Editor)

**File:** `src/frontend/js/editor/editor-health.js`

**Changes to `_loadHealthData()`:**
- After sorting objects by `zone_sort_order`, group them by `obj.type` using a helper function.
- For each type group, render a collapsible header (`div.indicator-type-group-header`) before the group's indicator fields.
- Wrap each group's fields in a `div.indicator-type-group-body`.
- If all indicators in a type group are hidden by conditional display, skip rendering that group's header entirely.

**New helper function:**
```javascript
/**
 * Group an array of objects by their `type` field.
 * Preserves the relative order of objects within each group.
 * @param {Array} objects - Custom Objects with a `type` field
 * @returns {Array<{type: string, objects: Array}>} ordered groups
 */
function _groupByType(objects) {
  var groups = {};
  var order = [];
  for (var i = 0; i < objects.length; i++) {
    var type = objects[i].type || 'Other';
    if (!groups[type]) {
      groups[type] = [];
      order.push(type);
    }
    groups[type].push(objects[i]);
  }
  return order.map(function(t) { return { type: t, objects: groups[t] }; });
}
```

**Collapsible header rendering:**
```javascript
function _renderTypeGroupHeader(typeName) {
  var header = document.createElement('div');
  header.className = 'indicator-type-group-header';
  header.innerHTML = '<i class="fas fa-caret-down indicator-type-caret"></i>'
    + '<span class="indicator-type-name">' + _escapeHtml(typeName) + '</span>';
  header.addEventListener('click', function() {
    var body = header.nextElementSibling;
    var caret = header.querySelector('.indicator-type-caret');
    if (body && body.classList.contains('indicator-type-group-body')) {
      var isCollapsed = body.classList.toggle('collapsed');
      if (caret) caret.className = isCollapsed
        ? 'fas fa-caret-right indicator-type-caret'
        : 'fas fa-caret-down indicator-type-caret';
    }
  });
  return header;
}
```

#### 3. Type Grouping in Dashboard Indicators View

**File:** `src/frontend/js/dashboard/main-views-indicators.js`

**Changes to charts mode (`_indicatorsLoad`):**
- After building the `charts` array, group charts by their source object's `type` field.
- Render a collapsible type group header before each group of chart divs.

**Changes to log mode (`_indicatorsRenderLog`):**
- Group log entries by the indicator's type (resolve UUID keys to objects, group by `obj.type`).
- Render a collapsible type group header before each group of log entries.

**Changes to calendar mode (`_indicatorsRenderCalendar`):**
- Group the calendar grid by indicator type (one calendar section per type group).
- Render a collapsible type group header before each group.

**Shared header rendering (reused across modes):**
```javascript
function _indRenderTypeGroupHeader(typeName) {
  var header = document.createElement('div');
  header.className = 'ind-type-group-header';
  header.innerHTML = '<i class="fas fa-caret-down ind-type-caret"></i>'
    + '<span class="ind-type-name">' + _escapeHtml(typeName) + '</span>';
  header.addEventListener('click', function() {
    var body = header.nextElementSibling;
    var caret = header.querySelector('.ind-type-caret');
    if (body && body.classList.contains('ind-type-group-body')) {
      var isCollapsed = body.classList.toggle('collapsed');
      if (caret) caret.className = isCollapsed
        ? 'fas fa-caret-right ind-type-caret'
        : 'fas fa-caret-down ind-type-caret';
    }
  });
  return header;
}
```

### CSS Additions

#### Chit Editor (added to `editor.css` or inline in `editor.html`):

```css
/* ── Indicator Type Group Headers ─────────────────────────────── */
.indicator-type-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 10px;
  background: #e8dcc8;
  border: 1px solid #d4c5a9;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  user-select: none;
  font-family: 'Lora', Georgia, serif;
  font-weight: 600;
  font-size: 0.95em;
  color: #4a2c2a;
  min-height: 38px;
}
.indicator-type-group-header:hover {
  background: #ddd0b8;
}
.indicator-type-group-header:first-child {
  margin-top: 0;
}
.indicator-type-caret {
  font-size: 0.9em;
  color: #6b4e31;
  width: 12px;
  text-align: center;
}
.indicator-type-group-body {
  border: 1px solid #d4c5a9;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 6px 0;
  margin-bottom: 6px;
}
.indicator-type-group-body.collapsed {
  display: none;
}
```

#### Dashboard (added to `styles-variables.css` or a dashboard-specific section):

```css
/* ── Dashboard Indicator Type Group Headers ───────────────────── */
.ind-type-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 12px;
  background: #e8dcc8;
  border: 1px solid #d4c5a9;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  user-select: none;
  font-family: 'Lora', Georgia, serif;
  font-weight: 600;
  font-size: 0.95em;
  color: #4a2c2a;
  min-height: 38px;
}
.ind-type-group-header:hover {
  background: #ddd0b8;
}
.ind-type-caret {
  font-size: 0.9em;
  color: #6b4e31;
  width: 12px;
  text-align: center;
}
.ind-type-group-body {
  border: 1px solid #d4c5a9;
  border-top: none;
  border-radius: 0 0 6px 6px;
  margin-bottom: 8px;
}
.ind-type-group-body.collapsed {
  display: none;
}
```

#### Custom Objects Editor (rename button addition):

```css
/* ── Rename button in type group header ───────────────────────── */
.co-type-rename-btn {
  margin-left: auto;
  padding: 4px 8px;
  font-size: 0.8em;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #8b5a2b;
  opacity: 0.6;
  transition: opacity 0.15s, border-color 0.15s;
}
.co-type-rename-btn:hover {
  opacity: 1;
  border-color: #8b5a2b;
  background: rgba(139, 90, 43, 0.08);
}
```

## Data Flow

### Rename Type Flow

```
User clicks rename icon on "Vital" header
  → _coOpenRenameModal("Vital")
  → Modal shows with input pre-filled "Vital"
  → User types "Vitals" and clicks Rename
  → _coSubmitRename("Vital", "Vitals")
  → PUT /api/custom-objects/rename-type {old_type: "Vital", new_type: "Vitals"}
  → Backend: UPDATE custom_objects SET type='Vitals' WHERE type='Vital' AND owner_id=?
  → Response: {updated_count: 5}
  → _coFetchAll() refreshes the list
  → Toast: "Renamed type to 'Vitals' (5 objects updated)"
```

### Indicators Zone Grouping Flow

```
_loadHealthData(chit) called
  → Fetch indicator objects from zone
  → Sort by zone_sort_order
  → _groupByType(sorted) → [{type: "Vital", objects: [...]}, {type: "Measurement", objects: [...]}]
  → For each group:
      → Evaluate conditional display for all objects in group
      → If all hidden → skip group entirely
      → Else → render header + body with visible indicator fields
  → Render "Add Indicator" button at bottom
```

### Dashboard Grouping Flow

```
displayIndicatorsView() called
  → Determine mode (charts/log/calendar)
  → Fetch indicator objects
  → _groupByType(objects) → [{type: "Vital", objects: [...]}, ...]
  → For each group:
      → Render type group header
      → Render group body (charts/log entries/calendar per mode)
```

## Data Models

### Rename Type Request

```json
{
  "old_type": "Vital",
  "new_type": "Vitals"
}
```

### Rename Type Response

```json
{
  "updated_count": 5
}
```

### Grouped Objects Structure (internal, JS)

```javascript
// Output of _groupByType(objects)
[
  { type: "Vital", objects: [/* Custom Object instances */] },
  { type: "Measurement", objects: [/* ... */] },
  { type: "Activity", objects: [/* ... */] }
]
```

## Error Handling

| Scenario | Status | Response |
|----------|--------|----------|
| `old_type` or `new_type` empty/missing | 422 | `{"detail": "Both old_type and new_type must be non-empty strings"}` |
| No objects match `old_type` | 200 | `{"updated_count": 0}` |
| `old_type == new_type` | 200 | `{"updated_count": 0}` (no DB write) |
| Server error | 500 | `{"detail": "Internal server error"}` |

**Frontend error handling:**
- Empty input in rename modal → inline validation message, submission blocked
- API failure → toast error message, modal stays open for retry
- Network failure during grouping data fetch → graceful fallback to flat list (no grouping)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Rename updates all matching objects and returns correct count

*For any* non-empty `old_type` string and non-empty `new_type` string (where `old_type != new_type`), and *for any* set of Custom Objects where N objects have `type == old_type` for a given owner, after calling the rename endpoint, all N objects SHALL have `type == new_type`, no other objects SHALL be modified, and the response `updated_count` SHALL equal N.

**Validates: Requirements 1.4, 2.2, 2.3**

### Property 2: Rename validation rejects invalid input

*For any* request body where `old_type` is empty/whitespace-only OR `new_type` is empty/whitespace-only, the rename endpoint SHALL return a 422 status code and SHALL NOT modify any database records.

**Validates: Requirements 2.4**

### Property 3: Grouping by type produces correct partitions

*For any* array of Custom Objects with varying `type` field values, the `_groupByType` function SHALL produce groups where (a) every object appears in exactly one group, (b) all objects in a group share the same `type` value, (c) the total count of objects across all groups equals the input array length, and (d) the relative order of objects within each group matches their original order in the input.

**Validates: Requirements 3.1, 4.1, 4.2, 4.3, 5.1**

### Property 4: Empty type groups are hidden when all indicators filtered

*For any* type group where every indicator object has a `conditional_display` rule that evaluates to `false` against the current user settings, the Indicators Zone SHALL NOT render a header or body for that group.

**Validates: Requirements 3.5**


## Testing Strategy

### Property-Based Testing

The rename endpoint and grouping utility have clear universal properties suitable for PBT:

- **Property 1** (rename correctness): Generate random type names and random sets of objects, perform rename, verify all matching objects updated and count is correct.
- **Property 2** (validation): Generate invalid inputs (empty strings, whitespace), verify 422 response and no DB modification.
- **Property 3** (grouping): Generate random arrays of objects with varying types, verify partition correctness.
- **Property 4** (empty group hiding): Generate objects with conditional display rules and settings that filter all out, verify no header rendered.

**Configuration:** Minimum 100 iterations per property test.

**Tag format:** `Feature: type-rename-and-grouping, Property {number}: {property_text}`

### Unit Tests (Example-Based)

- Rename modal opens pre-populated with current type name
- Rename modal rejects empty input with inline error
- Rename modal closes on Cancel/ESC without API call
- Successful rename refreshes the object list and shows toast
- Type group headers render with caret icon in expanded state
- Clicking a type group header collapses/expands the body
- All groups start expanded on page load (state not persisted)
- Dashboard charts/log/calendar modes all show type group headers

### Tests Are Optional

Per project rules, all tests are optional and never block feature completion.
