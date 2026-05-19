# Maps (All 3 Modes: Chits, People, Both)

**Category:** Standalone Pages
**Item #:** 44
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Page Layout
- [ ] maps-page-layout — main layout container (shifts with sidebar)
- [ ] maps-container — Leaflet map container
- [ ] maps-info-message — "No chits with locations found" overlay message
- [ ] maps-google-warning — warning shown when Google Maps preferred but unsupported
- [ ] Shared sidebar integration (data-sidebar="true" on body)

### Mode Toggle (3 Modes)
- [ ] _injectModeToggle() — injects Chits/People/Both toggle into sidebar
- [ ] _mapsGetMode() — returns current mode from localStorage
- [ ] _mapsSetMode(mode) — saves mode to localStorage, triggers mode switch
- [ ] _mapsRestoreMode() — restores last mode on page load
- [ ] _onModeToggleChange(e) — handles radio button change
- [ ] Mode options: "chits" (default), "people", "both"
- [ ] Persisted in localStorage

### Mode Switching
- [ ] _switchToChitsMode() — removes people markers, shows chit markers
- [ ] _switchToPeopleMode() — removes chit markers, shows people markers
- [ ] _switchToBothMode() — shows both chit and people markers

### Sidebar Integration
- [ ] _initMapsSidebarShared() — initializes shared sidebar for maps page
- [ ] Period select options: 1 Hour, Day, Work Hours, Week, X Days, Month, Year, All
- [ ] onCreateChit callback — navigates to editor
- [ ] onToday callback — resets period offset to 0
- [ ] onPeriodChange / onPreviousPeriod / onNextPeriod callbacks
- [ ] onFilterChange / onClearFilters callbacks
- [ ] Navigation callbacks: Weather, Maps (no-op), Contacts, Settings, Calculator, Help
- [ ] initMobileSidebar() — mobile sidebar overlay

### Go-To Search
- [ ] _injectMapsGoToSearch() — injects address search input into sidebar
- [ ] _mapsGoToSearch() — geocodes entered address, pans map to location
- [ ] Search input with "Go" button in sidebar

### Date Display
- [ ] _updateMapsDateDisplay() — updates year and range text based on period/offset

### Leaflet Map
- [ ] _initLeafletMap() — creates Leaflet map with tile layer
- [ ] OpenStreetMap tile layer
- [ ] MarkerCluster plugin for grouping nearby markers
- [ ] Fullscreen control button
- [ ] Default view control button (resets to saved default or auto-zoom)
- [ ] Map settings from user preferences (auto-zoom, default lat/lon/zoom)

### Chit Markers
- [ ] _fetchAndDisplayChits() — fetches chits from API, geocodes, places markers
- [ ] _filterAndRender() — applies filters and re-renders chit markers
- [ ] _filterChitsByDateRange(chits, startDate, endDate) — filters by period
- [ ] _geocodeChits(chits) — geocodes chit locations (with progressive fallback)
- [ ] _placeMarkers(geocodedChits) — places colored markers on map
- [ ] _buildPopupContent(chit) — builds HTML popup for chit marker
- [ ] _getMarkerColor(status) — maps chit status to marker color
- [ ] _isChitOverdue(chit) — checks if chit is overdue (red marker)
- [ ] Marker popups show: title, status, priority, dates, location, tags
- [ ] Click popup "Open" link → navigates to chit editor

### Chit Filters (Sidebar)
- [ ] _initChitsFilters() — initializes chit-specific filter UI in sidebar
- [ ] _loadChitsFilterData() — loads tags and people for filter dropdowns
- [ ] _applyChitsFilters(chits) — applies status, priority, tag, people, text filters
- [ ] _onChitsFilterChange() — re-renders markers when filters change
- [ ] _clearChitsFilters() — resets all chit filters
- [ ] _matchesChitTextSearch(chit, query) — text search across title, note, location

### People Markers
- [ ] _fetchAndDisplayContacts() — fetches contacts, geocodes, places markers
- [ ] _geocodeContacts(contacts) — geocodes contact addresses
- [ ] _placeContactMarkers(geocodedContacts) — places contact markers on map
- [ ] _buildContactPopupContent(contact, address) — builds HTML popup for contact
- [ ] _getContactMarkerColor(contact) — uses contact color or default
- [ ] Contact markers use custom icon (circular with contact color)
- [ ] .maps-contact-marker-wrapper class — removes default Leaflet icon styling
- [ ] Marker popups show: name, address, phone, email
- [ ] Click popup "Open" link → navigates to contact editor

### People Filters (Sidebar)
- [ ] _initPeopleFilters() — initializes people-specific filter UI
- [ ] _buildPeopleTagChips(contacts) — builds tag filter chips from contact tags
- [ ] _onPeopleFilterChange() — re-renders contact markers when filters change
- [ ] _clearPeopleFilters() — resets all people filters
- [ ] _mapsContactMatchesFilter(contact, query) — text search across contact fields
- [ ] _applyPeopleFilters(contacts) — applies text and tag filters to contacts

### Map Controls
- [ ] _removeMarkersByType(type) — removes markers of a specific type (chits/people)
- [ ] _fitBoundsToAllMarkers() — auto-zooms to fit all visible markers
- [ ] Fullscreen toggle control
- [ ] Default view control — resets to user's saved default view

### Period Navigation
- [ ] _getPeriodDateRange(period) — calculates start/end dates for current period + offset
- [ ] Supports: 1hour, Day, Work, Week, SevenDay, Month, Year, all

### Focus Address (URL Param)
- [ ] _handleFocusAddress(focusType, address) — handles ?focus_address= URL param
- [ ] Geocodes address and pans/zooms to it on load

### Loading State
- [ ] _mapsShowLoading() — shows floating loading toast
- [ ] _mapsHideLoading() — hides loading toast
- [ ] maps-loading-toast — floating toast with spinner

### Info/Warning Messages
- [ ] _showInfoMessage(msg) — shows "no results" overlay on map
- [ ] _hideInfoMessage() — hides the overlay

### Helper Functions
- [ ] _hexToRgba(hex, alpha) — converts hex color to rgba string
- [ ] _mapsFormatDate(isoString) — formats date for popup display
- [ ] _mapsToDateString(d) — converts Date to YYYY-MM-DD string

### Marker Tooltips
- [ ] .maps-title-tooltip class — styled tooltip showing chit/contact title on hover

### Mobile
- [ ] Mobile toolbar (logo, sidebar hamburger, title, profile button)
- [ ] Responsive sidebar behavior (overlay on mobile, push on desktop)
- [ ] Touch-friendly map controls

### Initialization
- [ ] _mapsInit() — async main initialization function
- [ ] Checks for Google Maps preference (shows warning if enabled)
- [ ] Initializes Leaflet map
- [ ] Restores mode from localStorage
- [ ] Loads and displays data based on mode
