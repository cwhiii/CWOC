# Weather

**Category:** Standalone Pages
**Item #:** 43
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Page Layout
- [ ] weather-page-layout — main layout container (shifts with sidebar)
- [ ] weather-content — content area (loading → table)
- [ ] Shared sidebar integration (data-sidebar="true" on body)
- [ ] Mobile toolbar (logo, sidebar hamburger, title, profile button)

### Sidebar Integration
- [ ] _initWeatherSidebarShared() — initializes shared sidebar for weather page
- [ ] _cwocInitSidebar() call with weather-specific config
- [ ] Period select options: 1 Hour, Day, Work Hours, Week, X Days, Month, Year, Forecast Max (16 day)
- [ ] onCreateChit callback — navigates to editor
- [ ] onToday callback — resets to "all" period
- [ ] onPeriodChange / onPreviousPeriod / onNextPeriod callbacks
- [ ] onFilterChange / onClearFilters callbacks
- [ ] Navigation callbacks: Weather (no-op), Maps, Contacts, Settings, Calculator, Help
- [ ] initMobileSidebar() — mobile sidebar overlay (Hide button, backdrop, swipe)

### Period Navigation
- [ ] _wxCurrentPeriodOffset — offset from current date for prev/next
- [ ] _wxOnFilterChange() — applies date filter and re-renders
- [ ] _wxClearFilters() — resets to "all" period, offset 0
- [ ] _wxPrevPeriod() — decrements offset, re-renders
- [ ] _wxNextPeriod() — increments offset, re-renders
- [ ] _wxUpdateDateDisplay() — updates year and range text in sidebar

### Date Filtering
- [ ] _wxApplyDateFilter() — shows/hides day blocks based on period + sidebar filters
- [ ] Supports: status filters, priority filters, text search, tag filters, people filters
- [ ] Builds matchingDates map from chits that pass all filters
- [ ] Syncs date header visibility with first row's block visibility

### Weather Table
- [ ] _wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate) — renders full forecast table
- [ ] Weather date row (sticky header) — day-of-week + date labels
- [ ] Weather rows (one per location) — row header + day blocks
- [ ] Weather row header — drag handle + location label + address
- [ ] Weather day blocks — icon + high/low temps + precipitation

### Day Block Features
- [ ] .today class — highlights today's block
- [ ] .has-event class — highlights days with chits at that location
- [ ] .wx-extreme class — highlights extreme weather conditions
- [ ] Temperature-based border gradient (blue for cold → red for hot)
- [ ] data-wx-date attribute — stores YYYY-MM-DD for filtering
- [ ] data-wx-loc attribute — stores location for navigation
- [ ] Alt-unit tooltips on temps and precipitation

### Day Block Click
- [ ] _wxInitBlockClick(container) — click handler on day blocks
- [ ] Stores nav intent in sessionStorage (date + location)
- [ ] Navigates to dashboard (Day view for that date)

### City Label Tap (Mobile)
- [ ] _wxInitCityTap(container) — shows full city name toast on tap
- [ ] Brief toast at bottom of screen (2.5s auto-dismiss)

### Drag-and-Drop Row Reordering
- [ ] _wxInitDragDrop(container) — wires drag events on weather rows
- [ ] Rows are draggable="true" with data-wx-idx attribute
- [ ] _wxGetSavedRowOrder() — reads saved order from localStorage
- [ ] Saves new order to localStorage on drop

### Week Separator Lines
- [ ] _wxDrawWeekLines(container) — draws vertical lines at week boundaries
- [ ] Based on weekStartDay setting

### City Rows (Chit-Derived Locations)
- [ ] _wxAddCityRows(container, allChits, locations, dates, weekStartDay) — adds rows for chit locations not in saved locations
- [ ] .weather-city-header class — different background for city rows
- [ ] Pin emoji (📍) on city row headers

### Data Loading
- [ ] _initWeatherPage() — async IIFE that initializes everything
- [ ] loadSavedLocations() — fetches saved locations from settings
- [ ] _wxFetchForecast(loc) — fetches 16-day forecast for a location
- [ ] Uses shared weather cache (getWeatherFromCache / fetchAndCacheWeather)
- [ ] Fallback: direct Open-Meteo API call with geocoding
- [ ] _geocodeAddress(address) — geocodes address to lat/lon
- [ ] Fetches all chits for event highlighting
- [ ] _wxBuildLocDateMap(chits, locations) — maps location indices to date sets

### Helper Functions
- [ ] _wxPageGetIcon(code) — gets weather emoji from code (uses _cwocGetWeatherIcon)
- [ ] _wxIsExtreme(highC, lowC, weatherCode) — checks for extreme conditions
- [ ] _wxFormatDate(dateStr) — formats YYYY-MM-DD to {dow, label}
- [ ] _wxIsToday(dateStr) — checks if date string is today
- [ ] _wxDayOfWeek(dateStr) — gets day-of-week (0–6) for a date string
- [ ] _convertTemp() — converts Celsius to user's preferred unit
- [ ] _tempAltUnit() — gets alt-unit temperature string for tooltip
- [ ] _precipAlt() — gets alt-unit precipitation string for tooltip
- [ ] _getTempBorderColor() — maps temperature to gradient color
- [ ] _cwocFormatPrecip() — formats precipitation with type indicator

### Settings Integration
- [ ] Loads week_start_day from settings
- [ ] Loads custom_days_count from settings (capped at 16)
- [ ] Unit system affects temperature display (imperial/metric)

### Empty/Error States
- [ ] "No saved locations configured" — with link to Settings
- [ ] Per-location error rows — "⚠️ Weather unavailable" with error message
- [ ] "Could not load settings" error state
