/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Maps Page — maps.js
   Displays chits with location data as interactive markers on a Leaflet map.
   Color-coded by status, clustered, with date range filtering.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Module-level state ───────────────────────────────────────────────────────

var _mapsLeafletMap = null;
var _mapsClusterGroup = null;
var _mapsAllChits = [];
var _mapsGeocodeCache = {};

// ── Status → Color mapping ───────────────────────────────────────────────────

var _mapsStatusColors = {
  'ToDo':        '#2196F3',
  'In Progress': '#FF9800',
  'Blocked':     '#F44336',
  'Complete':    '#4CAF50'
};
var _mapsNoStatusColor = '#9E9E9E';

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * _mapsInit() — Main entry point for the Maps page.
 * Checks the Google Maps preference and either shows the warning or
 * initializes the Leaflet map.
 */
async function _mapsInit() {
  try {
    var settings = await getCachedSettings();
    var co = (settings && settings.chit_options) || {};

    if (co.prefer_google_maps) {
      // Show Google Maps warning, hide map-related elements
      var warning = document.getElementById('maps-google-warning');
      if (warning) warning.style.display = 'block';

      var filter = document.getElementById('maps-date-filter');
      if (filter) filter.style.display = 'none';

      var container = document.getElementById('maps-container');
      if (container) container.style.display = 'none';

      var legend = document.getElementById('maps-legend');
      if (legend) legend.style.display = 'none';

      return;
    }

    _initLeafletMap();
    _initDateFilters();
    _showLegend();
    await _fetchAndDisplayChits();
  } catch (e) {
    console.error('Maps init error:', e);
  }
}

// ── Leaflet map initialization ───────────────────────────────────────────────

/**
 * _initLeafletMap() — Creates the Leaflet map instance with OpenStreetMap tiles.
 */
function _initLeafletMap() {
  var container = document.getElementById('maps-container');
  if (!container) return;

  _mapsLeafletMap = L.map('maps-container').setView([20, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(_mapsLeafletMap);

  _mapsClusterGroup = L.markerClusterGroup();
  _mapsLeafletMap.addLayer(_mapsClusterGroup);
}

// ── Fetch and display chits ──────────────────────────────────────────────────

/**
 * _fetchAndDisplayChits() — Fetches all chits, filters by date range,
 * geocodes locations, and places markers on the map.
 */
async function _fetchAndDisplayChits() {
  try {
    var resp = await fetch('/api/chits');
    if (!resp.ok) {
      console.error('Failed to fetch chits:', resp.status);
      _showInfoMessage('Could not load chits. Please try again.');
      return;
    }
    _mapsAllChits = await resp.json();
  } catch (e) {
    console.error('Error fetching chits:', e);
    _showInfoMessage('Could not load chits. Please try again.');
    return;
  }

  await _filterAndRender();
}

/**
 * _filterAndRender() — Applies date filter, geocodes, and places markers.
 * Called on initial load and when date filters change.
 */
async function _filterAndRender() {
  var startInput = document.getElementById('maps-start-date');
  var endInput = document.getElementById('maps-end-date');
  var startDate = startInput ? startInput.value : '';
  var endDate = endInput ? endInput.value : '';

  var filtered = _filterChitsByDateRange(_mapsAllChits, startDate, endDate);
  var geocoded = await _geocodeChits(filtered);
  _placeMarkers(geocoded);
}

// ── Date range filtering ─────────────────────────────────────────────────────

/**
 * _filterChitsByDateRange(chits, startDate, endDate) — Returns only chits
 * with a non-empty location and at least one date field within the range.
 * Date fields checked: start_datetime, due_datetime, created_datetime.
 */
function _filterChitsByDateRange(chits, startDate, endDate) {
  if (!chits || !chits.length) return [];

  var rangeStart = startDate ? new Date(startDate + 'T00:00:00') : null;
  var rangeEnd = endDate ? new Date(endDate + 'T23:59:59') : null;

  return chits.filter(function (chit) {
    // Must have a non-empty location
    if (!chit.location || !chit.location.trim()) return false;

    // Skip deleted chits
    if (chit.deleted) return false;

    // Check if at least one date field falls within the range
    var dateFields = ['start_datetime', 'due_datetime', 'created_datetime'];
    var hasDateInRange = false;

    for (var i = 0; i < dateFields.length; i++) {
      var val = chit[dateFields[i]];
      if (!val) continue;

      var d = new Date(val);
      if (isNaN(d.getTime())) continue;

      var inRange = true;
      if (rangeStart && d < rangeStart) inRange = false;
      if (rangeEnd && d > rangeEnd) inRange = false;

      if (inRange) {
        hasDateInRange = true;
        break;
      }
    }

    return hasDateInRange;
  });
}

// ── Geocoding with in-memory cache ───────────────────────────────────────────

/**
 * _geocodeChits(chits) — Geocodes each chit's location using _geocodeAddress()
 * from shared-geocoding.js. Uses _mapsGeocodeCache to avoid duplicate calls
 * for identical (case-insensitive, trimmed) addresses.
 * Returns an array of { chit, lat, lon } objects.
 */
async function _geocodeChits(chits) {
  var results = [];

  for (var i = 0; i < chits.length; i++) {
    var chit = chits[i];
    var address = (chit.location || '').trim();
    if (!address) continue;

    var cacheKey = address.toLowerCase();

    // Check cache first
    if (_mapsGeocodeCache[cacheKey]) {
      results.push({
        chit: chit,
        lat: _mapsGeocodeCache[cacheKey].lat,
        lon: _mapsGeocodeCache[cacheKey].lon
      });
      continue;
    }

    // Geocode and cache
    try {
      var coords = await _geocodeAddress(address);
      _mapsGeocodeCache[cacheKey] = { lat: coords.lat, lon: coords.lon };
      results.push({ chit: chit, lat: coords.lat, lon: coords.lon });
    } catch (e) {
      console.warn('Geocoding failed for "' + address + '":', e.message);
      // Skip this chit silently per spec
    }
  }

  return results;
}

// ── Marker color by status ───────────────────────────────────────────────────

/**
 * _getMarkerColor(status) — Returns the hex color for a given chit status.
 * ToDo=#2196F3, In Progress=#FF9800, Blocked=#F44336, Complete=#4CAF50, no-status=#9E9E9E
 */
function _getMarkerColor(status) {
  if (status && _mapsStatusColors[status]) {
    return _mapsStatusColors[status];
  }
  return _mapsNoStatusColor;
}

// ── Popup content ────────────────────────────────────────────────────────────

/**
 * _buildPopupContent(chit) — Returns HTML string for a marker popup.
 * Includes: title, relevant date, status, and link to editor.
 */
function _buildPopupContent(chit) {
  var title = chit.title || '(Untitled)';
  var status = chit.status || 'No Status';

  // Pick the most relevant date to display
  var dateStr = '';
  if (chit.start_datetime) {
    dateStr = _mapsFormatDate(chit.start_datetime);
  } else if (chit.due_datetime) {
    dateStr = _mapsFormatDate(chit.due_datetime);
  } else if (chit.created_datetime) {
    dateStr = _mapsFormatDate(chit.created_datetime);
  }

  var color = _getMarkerColor(chit.status);

  var html = '<div style="min-width:160px;font-family:Lora,Georgia,serif;">';
  html += '<strong style="font-size:14px;">' + _mapsEsc(title) + '</strong>';
  if (dateStr) {
    html += '<br><span style="font-size:12px;color:#666;">📅 ' + _mapsEsc(dateStr) + '</span>';
  }
  html += '<br><span style="font-size:12px;">';
  html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:4px;vertical-align:middle;"></span>';
  html += _mapsEsc(status);
  html += '</span>';
  html += '<br><a href="/editor?id=' + encodeURIComponent(chit.id) + '" style="font-size:12px;color:#2196F3;">Open in Editor →</a>';
  html += '</div>';

  return html;
}

/**
 * _mapsFormatDate(isoString) — Formats an ISO datetime string for display.
 */
function _mapsFormatDate(isoString) {
  if (!isoString) return '';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

/** Simple HTML escape for popup content. */
function _mapsEsc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Marker placement ─────────────────────────────────────────────────────────

/**
 * _placeMarkers(geocodedChits) — Creates colored circle markers, adds them
 * to the MarkerClusterGroup, binds popups, and fits map bounds.
 * Shows default world view with info message if no markers.
 */
function _placeMarkers(geocodedChits) {
  if (!_mapsLeafletMap || !_mapsClusterGroup) return;

  // Clear existing markers
  _mapsClusterGroup.clearLayers();

  if (!geocodedChits || geocodedChits.length === 0) {
    // Show default world view with info message
    _mapsLeafletMap.setView([20, 0], 2);
    _showInfoMessage('No chits with locations found in the selected date range.');
    return;
  }

  // Hide info message
  _hideInfoMessage();

  var bounds = [];

  for (var i = 0; i < geocodedChits.length; i++) {
    var item = geocodedChits[i];
    var color = _getMarkerColor(item.chit.status);

    var marker = L.circleMarker([item.lat, item.lon], {
      radius: 10,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    });

    marker.bindPopup(_buildPopupContent(item.chit));
    _mapsClusterGroup.addLayer(marker);
    bounds.push([item.lat, item.lon]);
  }

  // Fit map to marker bounds with padding
  if (bounds.length > 0) {
    _mapsLeafletMap.fitBounds(bounds, { padding: [40, 40] });
  }
}

// ── Date filter initialization and handler ───────────────────────────────────

/**
 * _initDateFilters() — Sets default date values (±30 days from today)
 * and wires up change handlers.
 */
function _initDateFilters() {
  var startInput = document.getElementById('maps-start-date');
  var endInput = document.getElementById('maps-end-date');
  if (!startInput || !endInput) return;

  var today = new Date();

  var past = new Date(today);
  past.setDate(past.getDate() - 30);

  var future = new Date(today);
  future.setDate(future.getDate() + 30);

  startInput.value = _mapsToDateString(past);
  endInput.value = _mapsToDateString(future);

  startInput.addEventListener('change', _onDateFilterChange);
  endInput.addEventListener('change', _onDateFilterChange);
}

/**
 * _onDateFilterChange() — Handler for date input changes.
 * Re-filters and re-renders markers using the current date range.
 */
async function _onDateFilterChange() {
  await _filterAndRender();
}

/**
 * _mapsToDateString(date) — Converts a Date to YYYY-MM-DD string.
 */
function _mapsToDateString(d) {
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// ── Legend display ────────────────────────────────────────────────────────────

/**
 * _showLegend() — Ensures the legend element is visible.
 * The legend HTML is already in maps.html; this just shows it.
 */
function _showLegend() {
  var legend = document.getElementById('maps-legend');
  if (legend) legend.style.display = '';
}

// ── Info message helpers ─────────────────────────────────────────────────────

function _showInfoMessage(msg) {
  var el = document.getElementById('maps-info-message');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function _hideInfoMessage() {
  var el = document.getElementById('maps-info-message');
  if (el) el.style.display = 'none';
}

// ── Page load ────────────────────────────────────────────────────────────────

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _mapsInit);
  } else {
    _mapsInit();
  }
})();
