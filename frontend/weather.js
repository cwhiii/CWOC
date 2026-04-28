/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Weather Page — weather.js
   Fetches 16-day forecasts for all saved locations and renders a table.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Weather icon map (same as main.js) ───────────────────────────────────────
var _wxPageIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌦️', 57: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

function _wxPageGetIcon(code) {
  return _wxPageIcons[code] || '❓';
}

function _wxPageC2F(c) {
  return Math.round(c * 9 / 5 + 32);
}

// ── Day-of-week abbreviations ────────────────────────────────────────────────
var _wxDow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Month abbreviations ──────────────────────────────────────────────────────
var _wxMon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format a date string (YYYY-MM-DD) for the header. */
function _wxFormatDate(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var dow = _wxDow[d.getDay()];
  var mon = _wxMon[d.getMonth()];
  return { dow: dow, label: mon + ' ' + d.getDate() };
}

/** Check if a date string is today. */
function _wxIsToday(dateStr) {
  var now = new Date();
  var todayStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
  return dateStr === todayStr;
}

// ── Main page logic ──────────────────────────────────────────────────────────

(async function _initWeatherPage() {
  var container = document.getElementById('weather-content');
  if (!container) return;

  // Load saved locations
  var locations = [];
  try {
    locations = await loadSavedLocations();
  } catch (e) {
    console.error('Failed to load saved locations:', e);
    container.innerHTML = '<div class="weather-empty">Could not load settings.</div>';
    return;
  }

  if (!locations || locations.length === 0) {
    container.innerHTML =
      '<div class="weather-empty">' +
        'No saved locations configured.<br>' +
        'Add locations in <a href="/frontend/settings.html">⚙️ Settings</a>.' +
      '</div>';
    return;
  }

  // Fetch forecasts for all locations in parallel
  var results = await Promise.all(locations.map(function (loc) {
    return _wxFetchForecast(loc);
  }));

  // Render the table
  _wxRenderTable(container, locations, results);
})();

/**
 * Fetch 16-day forecast for a single location.
 * Returns { ok: true, daily: {...} } or { ok: false, error: string }.
 */
async function _wxFetchForecast(loc) {
  try {
    var address = loc.address || loc.label || '';
    if (!address) return { ok: false, error: 'No address' };

    var geo = await _geocodeAddress(address);
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + geo.lat +
      '&longitude=' + geo.lon +
      '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum' +
      '&timezone=auto&forecast_days=16';

    var resp = await fetch(url);
    if (!resp.ok) return { ok: false, error: 'Weather API error (' + resp.status + ')' };

    var data = await resp.json();
    if (!data.daily || !data.daily.time) return { ok: false, error: 'Invalid weather response' };

    return { ok: true, daily: data.daily };
  } catch (e) {
    return { ok: false, error: e.message || 'Fetch failed' };
  }
}

/**
 * Render the full weather forecast table.
 */
function _wxRenderTable(container, locations, results) {
  // Determine the date list from the first successful result
  var dates = null;
  for (var i = 0; i < results.length; i++) {
    if (results[i].ok && results[i].daily && results[i].daily.time) {
      dates = results[i].daily.time;
      break;
    }
  }

  if (!dates || dates.length === 0) {
    // All failed — show errors
    var html = '';
    for (var j = 0; j < locations.length; j++) {
      var errMsg = results[j].ok ? '' : (results[j].error || 'Unknown error');
      html += '<div class="weather-row-error">' +
        '<div class="weather-row-header"><span class="loc-label">' + _wxEsc(locations[j].label || 'Location') + '</span></div>' +
        '<span class="error-msg">⚠️ ' + _wxEsc(errMsg) + '</span>' +
      '</div>';
    }
    container.innerHTML = html;
    return;
  }

  // Build date header row
  var headerHtml = '<div class="weather-date-row">';
  for (var d = 0; d < dates.length; d++) {
    var fmt = _wxFormatDate(dates[d]);
    headerHtml += '<div class="weather-date-header">' +
      '<span class="date-dow">' + fmt.dow + '</span>' +
      fmt.label +
    '</div>';
  }
  headerHtml += '</div>';

  // Build location rows
  var rowsHtml = '';
  for (var r = 0; r < locations.length; r++) {
    var loc = locations[r];
    var res = results[r];

    if (!res.ok) {
      // Error row
      rowsHtml += '<div class="weather-row-error">' +
        '<div class="weather-row-header">' +
          '<span class="loc-label">' + _wxEsc(loc.label || 'Location') + '</span>' +
          '<span class="loc-address">' + _wxEsc(loc.address || '') + '</span>' +
        '</div>' +
        '<span class="error-msg">⚠️ ' + _wxEsc(res.error || 'Weather unavailable') + '</span>' +
      '</div>';
      continue;
    }

    var daily = res.daily;
    rowsHtml += '<div class="weather-row">';

    // Row header
    rowsHtml += '<div class="weather-row-header">' +
      '<span class="loc-label">' + _wxEsc(loc.label || 'Location') + '</span>' +
      '<span class="loc-address">' + _wxEsc(loc.address || '') + '</span>' +
    '</div>';

    // Day blocks
    for (var dd = 0; dd < daily.time.length; dd++) {
      var isToday = _wxIsToday(daily.time[dd]);
      var icon = _wxPageGetIcon(daily.weathercode[dd]);
      var highF = _wxPageC2F(daily.temperature_2m_max[dd]);
      var lowF = _wxPageC2F(daily.temperature_2m_min[dd]);
      var precip = daily.precipitation_sum[dd];
      var precipStr = precip > 0 ? (precip.toFixed(1) + ' mm') : '—';

      rowsHtml += '<div class="weather-day-block' + (isToday ? ' today' : '') + '">' +
        '<span class="wx-icon">' + icon + '</span>' +
        '<span class="wx-temps">' +
          '<span class="wx-high">' + highF + '°</span> ' +
          '<span class="wx-low">' + lowF + '°</span>' +
        '</span>' +
        '<span class="wx-precip">' + precipStr + '</span>' +
      '</div>';
    }

    rowsHtml += '</div>';
  }

  container.innerHTML = '<div class="weather-table">' + headerHtml + rowsHtml + '</div>';
}

/** Simple HTML escape. */
function _wxEsc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
