# Design Document: Maps View

## Overview

The Maps View feature adds a new page at `/maps` that displays chits with location data as interactive markers on a Leaflet.js map. The page follows the existing CWOC page template pattern, reuses the shared geocoding infrastructure, and integrates with the existing navigation system.

Key capabilities:
- Interactive OpenStreetMap-based map via Leaflet.js (CDN)
- Marker clustering via Leaflet.markercluster (CDN)
- Date range filtering (default: ±30 days from today)
- Color-coded markers by chit status with a legend
- Marker popups with chit details and editor links
- Google Maps preference guard (shows warning instead of map)
- Responsive layout for mobile/tablet

## Architecture

The feature follows the existing CWOC page architecture:

```mermaid
graph TD
    A[Browser: /maps] --> B[FastAPI Route: /maps]
    B --> C[FileResponse: maps.html]
    C --> D[shared-page.js: Header/Footer Injection]
    C --> E[maps.js: Page Logic]
    E --> F[/api/chits: Fetch Chits]
    E --> G[/api/geocode: Geocode Locations]
    E --> H[Leaflet.js: Map Rendering]
    E --> I[Leaflet.markercluster: Clustering]
    E --> J[window._cwocSettings: Preference Check]
```

**Data Flow:**
1. Page loads → check `prefer_google_maps` setting
2. If Google Maps preferred → show warning, stop
3. Otherwise → fetch all chits from `/api/chits`
4. Filter chits by date range and non-empty location
5. Geocode unique locations (with in-memory cache)
6. Place color-coded markers on clustered map layer
7. Auto-fit map bounds to markers

## Components and Interfaces

### Backend Component

**New Route in `src/backend/routes/health.py`:**

```python
@router.get("/maps")
async def maps_page():
    return FileResponse("/app/src/frontend/html/maps.html")
```

No new API endpoints needed — reuses existing `/api/chits` and `/api/geocode`.

### Frontend Components

**`src/frontend/html/maps.html`** — Page structure:
- Follows `_template.html` pattern
- Loads Leaflet CSS/JS and markercluster CSS/JS from CDN
- Contains date range filter inputs, map container div, legend, and warning message element
- Loads standard shared script chain + `maps.js`

**`src/frontend/js/pages/maps.js`** — Page logic module:

| Function | Purpose |
|----------|---------|
| `_mapsInit()` | Entry point: checks Google Maps pref, initializes map or shows warning |
| `_initLeafletMap()` | Creates Leaflet map instance with OSM tiles |
| `_fetchAndDisplayChits()` | Fetches chits, filters, geocodes, places markers |
| `_filterChitsByDateRange(chits, startDate, endDate)` | Returns chits within date range with non-empty location |
| `_geocodeChits(chits)` | Geocodes unique locations with in-memory cache, returns array of {chit, lat, lon} |
| `_getMarkerColor(status)` | Returns color string for a given chit status |
| `_buildPopupContent(chit)` | Returns HTML string for marker popup |
| `_placeMarkers(geocodedChits)` | Creates markers, adds to cluster group, fits bounds |
| `_showNoResultsMessage()` | Shows info message when no markers can be placed |
| `_onDateFilterChange()` | Handler for date input changes, re-filters and re-renders |

### Navigation Integration

**`src/frontend/js/pages/shared-page.js`** — Add Maps entry to `_navPages` array:
```javascript
{ key: '9', icon: '🗺️', label: 'Maps', href: '/maps' }
```
Note: This shifts User Admin to key '0' or adjusts numbering. Based on the requirement to place it "between indicators & search buttons," the exact position will be determined by the existing nav order. Since the nav panel currently has 8 entries (with User Admin conditional at 9), Maps will be inserted at an appropriate position.

**`src/frontend/js/dashboard/main-hotkeys.js`** — Add `/maps` to `_navTargets` array.

### External Dependencies (CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| Leaflet.js | 1.9.4 | Map rendering, markers, popups |
| Leaflet.markercluster | 1.5.3 | Marker clustering |

CDN URLs:
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js`

## Data Models

### Chit (existing — relevant fields)

| Field | Type | Usage in Maps View |
|-------|------|-------------------|
| `id` | string | Used in popup editor link |
| `title` | string | Displayed in popup |
| `location` | string | Geocoded to lat/lon for marker placement |
| `status` | string | Determines marker color (ToDo, In Progress, Blocked, Complete, null) |
| `start_datetime` | string (ISO) | Used for date range filtering |
| `due_datetime` | string (ISO) | Used for date range filtering |
| `created_datetime` | string (ISO) | Used for date range filtering, displayed in popup |

### In-Memory Geocode Cache

```javascript
// Key: lowercase trimmed address string
// Value: { lat: number, lon: number }
var _mapsGeocodeCache = {};
```

### Status Color Mapping

```javascript
var _statusColors = {
    'ToDo':        '#2196F3',  // Blue
    'In Progress': '#FF9800',  // Orange
    'Blocked':     '#F44336',  // Red
    'Complete':    '#4CAF50',  // Green
    null:          '#9E9E9E'   // Grey (no status)
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Date range filtering correctness

*For any* set of chits and any date range [start, end], the `_filterChitsByDateRange` function SHALL return only chits where at least one of `start_datetime`, `due_datetime`, or `created_datetime` falls within the range AND the chit has a non-empty `location` field.

**Validates: Requirements 4.4, 4.5**

### Property 2: Geocode deduplication

*For any* list of chits with locations (including duplicates), the geocoding process SHALL call the geocode function exactly once per unique (case-insensitive, trimmed) location string.

**Validates: Requirements 5.1, 5.2**

### Property 3: Marker placement correctness

*For any* chit whose location is successfully geocoded to coordinates {lat, lon}, a marker SHALL be placed at exactly those coordinates on the map.

**Validates: Requirements 5.3**

### Property 4: Popup content completeness

*For any* chit displayed as a marker, the popup HTML SHALL contain the chit's title, a date string (from start_datetime or due_datetime or created_datetime), the chit's status, and a link to `/editor?id={chit_id}`.

**Validates: Requirements 7.1, 7.2**

### Property 5: Status-to-color mapping correctness

*For any* chit, the marker color SHALL equal the color assigned to that chit's status in the status-color mapping, and all five status values (ToDo, In Progress, Blocked, Complete, no-status) SHALL map to distinct colors.

**Validates: Requirements 8.1, 8.2**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Google Maps preference enabled | Show warning message, do not initialize map or fetch data |
| `/api/chits` fetch fails | Show error message on page, log to console |
| Geocoding fails for a location | Skip that chit silently, log warning to console |
| No chits have geocodable locations | Show map at default world view with info message |
| All chits filtered out by date range | Show map at default world view with info message |
| Leaflet CDN fails to load | Page shows empty map container (graceful degradation) |

## Testing Strategy

### Unit Tests (Example-Based)

- Verify `/maps` route returns 200 with HTML content
- Verify Google Maps warning is shown when `prefer_google_maps` is true
- Verify default date range is ±30 days from today
- Verify legend contains all 5 status-color pairs
- Verify navigation entries exist in shared-page.js and main-hotkeys.js

### Property-Based Tests

Property-based testing is appropriate for this feature because the core logic involves pure functions (date filtering, color mapping, popup generation) with clear input/output behavior and large input spaces.

**Library:** fast-check (JavaScript)
**Configuration:** Minimum 100 iterations per property test
**Tag format:** Feature: maps-view, Property {number}: {property_text}

Tests to implement:
1. **Feature: maps-view, Property 1: Date range filtering correctness** — Generate random chits with various datetime fields and random date ranges. Verify filter output satisfies the property.
2. **Feature: maps-view, Property 2: Geocode deduplication** — Generate random chit lists with duplicate locations. Mock geocoder. Verify call count equals unique location count.
3. **Feature: maps-view, Property 3: Marker placement correctness** — Generate random chits with locations. Mock geocoder to return known coords. Verify marker positions match.
4. **Feature: maps-view, Property 4: Popup content completeness** — Generate random chits with various fields. Verify popup HTML contains all required elements.
5. **Feature: maps-view, Property 5: Status-to-color mapping correctness** — Generate random statuses from the valid set. Verify color assignment is correct and all colors are distinct.

### Integration Tests

- End-to-end: page loads, fetches chits, displays markers on map
- Marker click opens popup with correct content
- Date filter change updates visible markers
- Cluster behavior when zooming (visual verification)
