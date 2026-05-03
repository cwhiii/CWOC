# Design Document: Maps People Mode

## Overview

The Maps People Mode feature extends the existing Maps View page (`/maps`) to support two display modes: **Chits mode** (existing behavior — chit locations as color-coded markers) and **People mode** (contact addresses as markers). A toggle control lets the user switch between modes, and each mode has its own filter panel:

- **Chits mode filters**: status, tags, priority, people, text search, and date range — mirroring the dashboard sidebar filter system.
- **People mode filters**: text search (across all contact fields, matching `_contactMatchesFilter` logic), favorites-only toggle, and tag filter chips — mirroring the editor Rolodex patterns.

The feature reuses existing infrastructure: the Leaflet map, MarkerCluster plugin, shared geocoding (`_geocodeAddress`), the Contacts API (`/api/contacts`), and the Chits API (`/api/chits`). No new backend endpoints are needed.

Key capabilities:
- Mode toggle with localStorage persistence
- Chits filter panel (status, tags, priority, people, text search, date range)
- People filter panel (text search, favorites toggle, tag chips)
- Contact markers colored by contact color, visually distinct from chit markers
- Contact popups with name, address, organization, phone, email, and editor link
- Separate cluster groups per mode with distinct styling
- Mode-specific legends
- Google Maps preference guard applies to both modes
- Responsive layout for mobile

## Architecture

The feature extends the existing `maps.js` module and `maps.html` page. No new files are created — all logic lives in the existing maps page files, following the CWOC pattern of page-specific scripts.

```mermaid
graph TD
    A[Browser: /maps] --> B[maps.html]
    B --> C[maps.js: Page Logic]
    C --> D{Mode Toggle}
    D -->|Chits| E[Chits Mode]
    D -->|People| F[People Mode]
    
    E --> G[/api/chits]
    E --> H[Chit Filters: status, tags, priority, people, text, date]
    E --> I[Geocode chit locations]
    E --> J[Place chit markers - circle markers, status colors]
    
    F --> K[/api/contacts]
    F --> L[People Filters: text search, favorites, tags]
    F --> M[Geocode contact addresses]
    F --> N[Place contact markers - diamond/square markers, contact colors]
    
    I --> O[shared-geocoding.js: _geocodeAddress]
    M --> O
    
    J --> P[Leaflet MarkerClusterGroup - Chits]
    N --> Q[Leaflet MarkerClusterGroup - People]
    
    C --> R[getCachedSettings: Google Maps guard]
    C --> S[localStorage: mode persistence]
```

**Data Flow — Chits Mode:**
1. Fetch all chits from `/api/chits`
2. Apply all active filters (status, tags, priority, people, text search, date range)
3. Geocode filtered chit locations (with in-memory cache)
4. Place color-coded circle markers on chits cluster group
5. Fit map bounds to markers

**Data Flow — People Mode:**
1. Fetch all contacts from `/api/contacts`
2. Apply all active filters (text search, favorites, tags)
3. For each filtered contact, geocode each address field
4. Place contact-colored markers on people cluster group
5. Fit map bounds to markers

## Components and Interfaces

### Backend Components

No new backend routes or endpoints are needed. The feature reuses:
- `GET /api/chits` — returns all non-deleted chits for the authenticated user
- `GET /api/contacts` — returns all contacts for the authenticated user
- `GET /api/geocode?q=...` — Nominatim geocoding proxy
- `GET /api/settings/default_user` — settings including `chit_options.prefer_google_maps`

### Frontend Components

**`src/frontend/html/maps.html`** — Extended with:
- Mode toggle control (above the map, below the Google Maps warning)
- Chits filter panel (status checkboxes, tag chips, priority checkboxes, people chips, text search, date range)
- People filter panel (text search, favorites toggle, tag chips)
- People mode legend (replaces chits legend when active)
- Responsive CSS for mobile filter collapse

**`src/frontend/js/pages/maps.js`** — Extended with new functions:

| Function | Purpose |
|----------|---------|
| **Mode Management** | |
| `_mapsGetMode()` | Returns current mode ("chits" or "people") from module state |
| `_mapsSetMode(mode)` | Sets mode, persists to localStorage, triggers mode switch |
| `_mapsRestoreMode()` | Reads mode from localStorage, defaults to "chits" |
| `_onModeToggleChange()` | Handler for mode toggle clicks — calls `_mapsSetMode` |
| **Chits Filter Panel** | |
| `_initChitsFilters()` | Builds the chits filter panel: status, tags, priority, people, text search, date range |
| `_loadChitsFilterData()` | Fetches tags from settings and contacts/users for people filter |
| `_applyChitsFilters(chits)` | Applies all active chit filters, returns filtered array |
| `_matchesChitTextSearch(chit, query)` | Returns true if chit title/note/location/tags contain query |
| `_clearChitsFilters()` | Resets all chit filters to defaults |
| `_onChitsFilterChange()` | Handler for any chit filter change — re-filters and re-renders |
| **People Mode** | |
| `_fetchAndDisplayContacts()` | Fetches contacts, filters, geocodes, places markers |
| `_geocodeContacts(contacts)` | Geocodes each contact's addresses, returns array of {contact, address, lat, lon} |
| `_placeContactMarkers(geocodedContacts)` | Creates contact markers, adds to people cluster group, fits bounds |
| `_buildContactPopupContent(contact, address)` | Returns HTML for contact marker popup |
| `_getContactMarkerColor(contact)` | Returns contact color or default teal (#008080) |
| **People Filter Panel** | |
| `_initPeopleFilters()` | Builds the people filter panel: text search, favorites toggle, tag chips |
| `_applyPeopleFilters(contacts)` | Applies all active people filters, returns filtered array |
| `_mapsContactMatchesFilter(contact, query)` | Reuses `_contactMatchesFilter` logic for text search |
| `_clearPeopleFilters()` | Resets all people filters to defaults |
| `_onPeopleFilterChange()` | Handler for any people filter change — re-filters and re-renders |
| **Legend & UI** | |
| `_showChitsLegend()` | Shows the status-color legend, hides people legend |
| `_showPeopleLegend()` | Shows the contact-color legend, hides chits legend |
| `_switchToChitsMode()` | Clears people markers, shows chits filter panel/legend, loads chits |
| `_switchToPeopleMode()` | Clears chit markers, shows people filter panel/legend, loads contacts |

### Module-Level State (additions to maps.js)

```javascript
var _mapsCurrentMode = 'chits';           // 'chits' or 'people'
var _mapsAllContacts = [];                 // Full contacts list from API
var _mapsPeopleClusterGroup = null;        // Separate MarkerClusterGroup for people mode
var _mapsContactGeocodeCache = {};         // In-memory geocode cache for contact addresses

// Chits filter state
var _mapsChitsFilterStatus = [];           // Selected statuses (empty = any)
var _mapsChitsFilterTags = [];             // Selected tag names
var _mapsChitsFilterPriority = [];         // Selected priorities (empty = any)
var _mapsChitsFilterPeople = [];           // Selected people names
var _mapsChitsFilterText = '';             // Text search query

// People filter state
var _mapsPeopleFilterText = '';            // Text search query
var _mapsPeopleFilterFavoritesOnly = false; // Favorites-only toggle
var _mapsPeopleFilterTags = [];            // Selected tag names
```

### External Dependencies

No new dependencies. Reuses existing CDN libraries already loaded in `maps.html`:
- Leaflet.js 1.9.4
- Leaflet.markercluster 1.5.3
- Font Awesome 6 (for filter icons)

## Data Models

### Contact (existing — relevant fields for maps)

| Field | Type | Usage in People Mode |
|-------|------|---------------------|
| `id` | string | Used in popup editor link |
| `display_name` | string | Displayed in popup, used for search |
| `given_name` | string | Fallback display name |
| `surname` | string | Used for search |
| `nickname` | string | Used for search |
| `organization` | string | Displayed in popup, used for search |
| `social_context` | string | Used for search |
| `phones` | `[{label, value}]` | Primary phone in popup, used for search |
| `emails` | `[{label, value}]` | Primary email in popup, used for search |
| `addresses` | `[{label, value}]` | Geocoded for marker placement, displayed in popup |
| `call_signs` | `[{label, value}]` | Used for search |
| `x_handles` | `[{label, value}]` | Used for search |
| `websites` | `[{label, value}]` | Used for search |
| `notes` | string | Used for search |
| `tags` | `[string]` | Used for tag filtering and search |
| `favorite` | boolean | Used for favorites filter |
| `color` | string (hex) | Marker fill color |
| `image_url` | string | Thumbnail in popup |

### Chit (existing — additional fields used by new filters)

| Field | Type | Usage in Chits Filters |
|-------|------|----------------------|
| `title` | string | Text search |
| `note` | string | Text search |
| `location` | string | Text search, geocoding |
| `tags` | `[string]` | Tag filter, text search |
| `status` | string | Status filter, marker color |
| `priority` | string | Priority filter |
| `people` | `[string]` | People filter |
| `start_datetime` | string (ISO) | Date range filter |
| `due_datetime` | string (ISO) | Date range filter |
| `created_datetime` | string (ISO) | Date range filter |
| `deleted` | boolean | Excluded from display |

### In-Memory State

```javascript
// Mode persistence key
var MAPS_MODE_KEY = 'cwoc_maps_mode';  // localStorage key, values: "chits" | "people"

// Geocode caches (separate for chits and contacts to avoid cross-contamination on mode switch)
var _mapsGeocodeCache = {};          // Existing — keyed by lowercase trimmed address
var _mapsContactGeocodeCache = {};   // New — same structure, for contact addresses

// Geocoded contact result shape
// { contact: Contact, address: string, lat: number, lon: number }
```

### Contact Marker Styling

Contact markers use a distinct visual style from chit markers:

| Property | Chit Markers | Contact Markers |
|----------|-------------|-----------------|
| Shape | `L.circleMarker` (circle) | `L.marker` with `L.divIcon` (square with rounded corners) |
| Fill color | Status color | Contact color (or #008080 default) |
| Border | 2px white | 2px dark brown (#5c4033) |
| Size | radius: 10 | 28×28px div icon |
| Cluster color | Default blue | Teal (#008080) |


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mode persistence round-trip

*For any* mode value ("chits" or "people"), persisting the mode to localStorage and then restoring it SHALL produce the same mode value.

**Validates: Requirements 1.5**

### Property 2: Chit filter correctness

*For any* set of chits and any combination of active filter criteria (status, tags, priority, people, text search, date range), the `_applyChitsFilters` function SHALL return only chits that match ALL active filter criteria simultaneously. Specifically: if a text search is active, every returned chit's title, note, location, or tags must contain the search text (case-insensitive).

**Validates: Requirements 2.2, 2.3, 2.5**

### Property 3: Contact marker count and placement

*For any* contact with N address entries (where N ≥ 0), the geocoding and marker placement process SHALL produce exactly N marker placement attempts (one per address). For each successfully geocoded address, a marker SHALL be placed at the geocoded coordinates.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 4: Contact address geocode deduplication

*For any* list of contacts with addresses (including duplicate address strings across contacts), the geocoder SHALL be called at most once per unique (case-insensitive, trimmed) address string. Subsequent occurrences of the same address SHALL use the cached result.

**Validates: Requirements 3.6**

### Property 5: People filter correctness

*For any* set of contacts and any combination of active people filter criteria (text search, favorites-only toggle, tag selection), the `_applyPeopleFilters` function SHALL return only contacts that match ALL active filter criteria simultaneously. Specifically: if favorites-only is active, every returned contact must have `favorite === true`; if tags are selected, every returned contact must have at least one tag in the selected set; if text search is active, every returned contact must match the `_contactMatchesFilter` logic.

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

### Property 6: Contact marker color mapping

*For any* contact, the marker fill color SHALL equal the contact's `color` field when it is non-null and non-empty. When the contact's `color` is null or empty, the marker fill color SHALL be the default teal (#008080).

**Validates: Requirements 5.1, 5.2**

### Property 7: Contact popup content completeness

*For any* contact and any address string, the popup HTML generated by `_buildContactPopupContent` SHALL contain the contact's display name and the address text. When the contact has an organization, the popup SHALL contain it. When the contact has at least one phone, the popup SHALL contain the first phone value. When the contact has at least one email, the popup SHALL contain the first email value. The popup SHALL always contain a link to `/frontend/html/contact-editor.html?id={contact_id}`.

**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Google Maps preference enabled | Show warning message, hide mode toggle and all filter panels, do not initialize map |
| `/api/chits` fetch fails | Show error message on page, log to console |
| `/api/contacts` fetch fails | Show error message on page, log to console |
| Geocoding fails for a chit location | Skip that chit silently, log warning to console |
| Geocoding fails for a contact address | Skip that address silently, log warning to console |
| No chits match active filters | Show info message: "No chits match the current filters." |
| No contacts have geocodable addresses | Show info message: "No contacts with addresses were found." |
| No contacts match active filters | Show info message: "No contacts match the current filters." |
| Settings fetch fails | Default to Chits mode, hide Google Maps warning, proceed normally |
| localStorage unavailable | Default to Chits mode, filters work but mode preference is not persisted |
| Contact has no addresses | Skip contact silently (no markers placed, no error) |
| Leaflet CDN fails to load | Page shows empty map container (graceful degradation) |

## Testing Strategy

### Unit Tests (Example-Based)

- Verify mode toggle defaults to "chits" on fresh page load (no localStorage)
- Verify mode toggle restores from localStorage when present
- Verify Google Maps warning hides mode toggle and both filter panels
- Verify Chits filter panel contains all required controls (status, tags, priority, people, text, date)
- Verify People filter panel contains all required controls (text search, favorites toggle, tag chips)
- Verify "Clear Filters" button resets all chit filters to defaults
- Verify "Clear Filters" button resets all people filters to defaults
- Verify switching to People mode hides chits filter panel and shows people filter panel
- Verify switching to Chits mode hides people filter panel and shows chits filter panel
- Verify chits legend is shown in Chits mode, people legend in People mode
- Verify contact popup includes editor link with correct contact ID
- Verify contact markers use square/diamond shape (distinct from circle chit markers)
- Verify people cluster group uses distinct color scheme from chits cluster group
- Verify empty state messages appear for each no-results scenario
- Verify responsive layout: filter panels collapse on viewports ≤ 768px

### Property-Based Tests

Property-based testing is appropriate for this feature because the core logic involves pure functions (filter matching, color mapping, popup generation, geocode deduplication) with clear input/output behavior and large input spaces.

**Library:** fast-check (JavaScript)
**Configuration:** Minimum 100 iterations per property test
**Tag format:** Feature: maps-people-mode, Property {number}: {property_text}

Tests to implement:

1. **Feature: maps-people-mode, Property 1: Mode persistence round-trip** — Generate random mode values from {"chits", "people"}. Persist to a mock localStorage, restore, verify equality.

2. **Feature: maps-people-mode, Property 2: Chit filter correctness** — Generate random arrays of chit objects with varying status, tags, priority, people, title, note, location fields. Generate random filter criteria. Apply `_applyChitsFilters`. Verify every returned chit matches all active criteria, and no excluded chit matches all criteria.

3. **Feature: maps-people-mode, Property 3: Contact marker count and placement** — Generate random contacts with 0–5 addresses each. Mock geocoder to return known coordinates. Verify the number of geocode calls equals the total number of non-empty addresses, and each successful geocode produces a marker at the correct coordinates.

4. **Feature: maps-people-mode, Property 4: Contact address geocode deduplication** — Generate random contacts where some share identical addresses (case-insensitive). Mock geocoder. Verify the geocoder is called exactly once per unique address string.

5. **Feature: maps-people-mode, Property 5: People filter correctness** — Generate random arrays of contact objects with varying display_name, tags, favorite status, and other searchable fields. Generate random filter criteria (text, favorites toggle, tag selection). Apply `_applyPeopleFilters`. Verify every returned contact matches all active criteria.

6. **Feature: maps-people-mode, Property 6: Contact marker color mapping** — Generate random contacts with color values (including null, empty string, and valid hex colors). Verify `_getContactMarkerColor` returns the contact's color when non-null/non-empty, and #008080 otherwise.

7. **Feature: maps-people-mode, Property 7: Contact popup content completeness** — Generate random contacts with varying fields (some with organization, phones, emails, image_url; some without). Generate random address strings. Verify `_buildContactPopupContent` output contains display_name, address, and the editor link. Verify conditional fields (organization, phone, email, image) appear only when present.

### Integration Tests

- End-to-end: page loads in Chits mode, fetches chits, displays markers
- Switch to People mode, verify contacts are fetched and contact markers appear
- Switch back to Chits mode, verify chit markers are restored
- Chit filter change updates visible chit markers
- People filter change updates visible contact markers
- Contact with multiple addresses shows multiple markers
- Cluster behavior when zooming (visual verification)
- Mode persists across page reload
