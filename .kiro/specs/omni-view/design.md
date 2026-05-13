# Omni View — Design

## Architecture Overview

The Omni View is implemented as a new "virtual tab" on the dashboard — it uses the same rendering pipeline as C CAPTN tabs but with its own display function and hard-filtered data source. No new pages are created; it lives entirely within `index.html`.

---

## Frontend Architecture

### New Files
- `src/frontend/js/dashboard/main-omni.js` — Omni View rendering, HST bar, section orchestration, pagination, filter lock
- `src/frontend/css/dashboard/styles-omni.css` — Omni View layout, HST bar styling, responsive rules

### Modified Files
- `src/frontend/html/index.html` — Load new JS/CSS, make "Omni" clickable in h1, add Omni View templates
- `src/frontend/js/shared/shared-hotkeys.js` — Remap `O` → Omni, `S` → Sort, `F9` → Settings
- `src/frontend/js/dashboard/main-hotkeys.js` — Update `O` from Order to Omni, `S` for Sort submenu
- `src/frontend/js/dashboard/main-init.js` — Add Omni View to `displayChits()` switch, handle `O` hotkey in state machine
- `src/frontend/js/dashboard/main-email-bundles.js` — Add "Include in Omni View" checkbox to bundle modal
- `src/frontend/html/settings.html` — Add Omni View config section
- `src/frontend/js/pages/settings.js` — Omni View settings logic (layout configurator, bundle toggles, filter defaults)

### State Management
```
var _omniViewActive = false;       // Whether Omni View is currently displayed
var _omniEmailPage = 0;            // Current email pagination offset
var _omniLockedFilters = null;     // Persisted filter defaults (from settings)
```

When `_omniViewActive` is true:
- `currentTab` is set to `'Omni'` (a virtual tab name)
- No C CAPTN tab shows as active
- The sidebar filters are available but start fresh (or with locked defaults)
- `displayChits()` routes to `displayOmniView()`

### Rendering Flow
```
displayOmniView(filteredChits):
  1. Load Omni layout config from settings (section order, widths, visibility)
  2. Load Omni-enabled bundles list
  3. Build two-column container (or single on mobile)
  4. For each visible section in configured order:
     - HST Bar: render timeline with events + weather
     - Weather Bar: render current conditions strip
     - Chrono/OnDeck/Soon: reuse itinerary categorization + rendering
     - Email: fetch unread from Omni bundles, paginate, render with _buildEmailCard
     - Pinned Notes/Checklists: filter pinned chits, render with existing card builders
  5. Apply deduplication (each chit in exactly one section)
  6. Inject time-until badges on Chrono items
  7. Inject habit streak counters on habit items
```

### HST Bar Implementation
```
_renderOmniHST(chronoItems, weatherHourly):
  1. Create bar container (full-width, same gradient fill as _renderHSTClock)
  2. Calculate current time percentage: (h*3600 + m*60 + s) / 86400 * 100
  3. Fill bar up to current time
  4. Place chit icons at their time positions:
     - If spacing < 20px between adjacent icons → collapse to vertical lines
     - Attach tooltip (title) and click → quick-edit
  5. Place weather icons at their hour positions:
     - Click → _openWeatherModal()
     - Mobile long-press → _openWeatherModal()
  6. Set 1-second update interval for fill animation
```

### Email Pagination
```
_omniEmailPage = 0;  // offset into sorted unread list
PAGE_SIZE = 3;

_renderOmniEmail():
  1. Fetch all unread emails from Omni-enabled bundles (filter from global chits)
  2. Sort by email_date descending
  3. Slice [page*3, page*3+3]
  4. Render each with _buildEmailCard()
  5. Show "Previous 3" if page > 0
  6. Show "Next 3" if more emails exist beyond current page
  7. On "Next 3" click: page++, re-render (replaces, doesn't append)
  8. On "Previous 3" click: page--, re-render
```

### Filter Lock
```
_lockOmniFilters():
  1. Gather current sidebar filter state (status, tags, priority, people, text)
  2. POST to /api/settings with omni_locked_filters: JSON.stringify(filterState)
  3. Show brief toast: "Filters saved as Omni defaults"

On Omni View entry:
  1. Load omni_locked_filters from settings
  2. If present, apply them to sidebar programmatically
  3. Show 🔒 indicator that defaults are active
```

---

## Backend Architecture

### Database Changes (`migrations.py`)

```python
def migrate_bundles_omni_view(conn):
    """Add omni_view column to bundles table."""
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(bundles)")
    columns = [row[1] for row in cursor.fetchall()]
    if "omni_view" not in columns:
        cursor.execute("ALTER TABLE bundles ADD COLUMN omni_view INTEGER DEFAULT 0")
    conn.commit()
```

### Settings Fields (new)
- `omni_layout` — JSON string: `[{id: "hst", width: "full", visible: true, position: 0}, ...]`
- `omni_locked_filters` — JSON string: `{statuses: [...], tags: [...], priorities: [...], people: [...], text: "..."}`

### API Changes

**`GET /api/bundles`** — already returns all bundle fields; `omni_view` will be included automatically once the column exists.

**`PUT /api/bundles/{id}`** — already accepts arbitrary fields for update; `omni_view` just needs to be included in the UPDATE statement.

**`GET /api/settings/default_user`** — already returns all settings fields; new fields are automatically included.

**`POST /api/settings`** — already accepts arbitrary settings fields for save.

No new endpoints needed.

---

## Layout Configuration Data Model

```json
{
  "omni_layout": [
    {"id": "hst", "width": "full", "visible": true, "position": 0},
    {"id": "weather", "width": "full", "visible": true, "position": 1},
    {"id": "chrono", "width": "half", "visible": true, "position": 2, "column": "left"},
    {"id": "ondeck", "width": "half", "visible": true, "position": 3, "column": "left"},
    {"id": "soon", "width": "half", "visible": true, "position": 4, "column": "left"},
    {"id": "email", "width": "half", "visible": true, "position": 5, "column": "left"},
    {"id": "pinned_notes", "width": "half", "visible": true, "position": 6, "column": "right"},
    {"id": "pinned_checklists", "width": "half", "visible": true, "position": 7, "column": "right"}
  ]
}
```

---

## Deduplication Algorithm

```
Given all chits:
  1. Separate email chits → email section only
  2. For remaining chits, categorize into itinerary buckets (same logic as displayItineraryView):
     - Has time today → Chrono Anchored
     - All-day today / untimed due today / habit due today → On Deck
     - Due this week (not today) → Soon
  3. Track all chit IDs placed in steps 1-2
  4. For pinned chits NOT already placed:
     - Has checklist items → Pinned Checklists
     - Otherwise → Pinned Notes
  5. Each chit appears in exactly one section
```

---

## Settings Page Layout Configurator

Reuses the existing drag-and-drop pattern from the clock format grid in Settings:
- Active zone: shows configured sections as draggable cards in a visual grid
- Each card shows: section name, width toggle (half/full), visibility toggle (eye icon)
- Drag to reorder within the grid
- Cards can be dragged between left/right columns
- Uses `setupDragListeners` pattern with `ondragstart/ondragover/ondrop`
- Touch support via `enableTouchDrag` from `shared-touch.js`

---

## Hotkey Changes

### `shared-hotkeys.js`
```javascript
// Remove 's' from action hotkeys (no longer Settings)
// Add: F9 → Settings navigation

var _cwocHotkeyTabMap = {
  c: 'Calendar',
  h: 'Checklists',
  a: 'Alarms',
  p: 'Projects',
  t: 'Tasks',
  n: 'Notes',
  e: 'Email',
  i: 'Indicators',
  g: 'Search',
  o: 'Omni'       // NEW
};

function _cwocHandleActionHotkey(keyLower, e) {
  // S → Sort submenu (dashboard only, handled in main-init.js)
  // F9 → Settings
  if (e.key === 'F9') {
    e.preventDefault();
    window.location.href = '/frontend/html/settings.html';
    return true;
  }
  // K, W, L, R, M unchanged
  ...
}
```

### `main-init.js`
```javascript
// Replace 'o' (Order) with 's' (Sort)
if (keyLower === 's' && !_hotkeyMode) {
  e.preventDefault();
  _hotkeyMode = 'ORDER';
  expandSidebarSection('section-order');
  _showPanel('panel-order');
  return;
}
// 'o' is now handled by tab map → 'Omni'
```

---

## Mobile Considerations

- Below 768px: all sections stack in a single column
- HST Bar: full width, slightly shorter height, icons scale down
- Email swipe: already works via existing touch handlers in `_buildEmailCard`
- Weather long-press: attach `touchstart`/`touchend` timer on weather icons (500ms threshold)
- Layout configurator in Settings: simplified to a sortable list (no two-column preview)
