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

/** Get precipitation type from WMO weather code. */
function _wxPrecipType(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunder';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  return '';
}

/** Format precipitation: nearest cm with type. Sub-0.5cm = just the type. No precip = '—'. */
function _wxFormatPrecip(precipMm, weatherCode) {
  if (!precipMm || precipMm <= 0) return '—';
  var pType = _wxPrecipType(weatherCode);
  if (!pType) pType = 'precip';
  var cm = Math.round(precipMm / 10);
  if (cm < 1) return pType;
  return cm + 'cm ' + pType;
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

  // Apply saved row order if available
  var savedOrder = _wxGetSavedRowOrder();
  if (savedOrder && savedOrder.length > 0) {
    locations.sort(function (a, b) {
      var aIdx = savedOrder.indexOf(a.label || '');
      var bIdx = savedOrder.indexOf(b.label || '');
      if (aIdx < 0) aIdx = 9999;
      if (bIdx < 0) bIdx = 9999;
      return aIdx - bIdx;
    });
  }

  // Load week start day from settings
  var weekStartDay = 0;
  try {
    var settings = await getCachedSettings();
    weekStartDay = parseInt(settings.week_start_day) || 0;
  } catch (e) { /* default to Sunday */ }

  // Fetch forecasts for all locations in parallel
  var results = await Promise.all(locations.map(function (loc) {
    return _wxFetchForecast(loc);
  }));

  // Fetch all chits to find events at each location
  var chitsByLocDate = {};
  try {
    var chitResp = await fetch('/api/chits');
    if (chitResp.ok) {
      var allChits = await chitResp.json();
      chitsByLocDate = _wxBuildLocDateMap(allChits, locations);
    }
  } catch (e) {
    console.error('Weather page: failed to load chits for event highlighting', e);
  }

  // Render the table
  _wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate);
})();

/**
 * Fetch 16-day forecast for a single location.
 * Uses shared weather cache first, falls back to fresh fetch.
 * Returns { ok: true, daily: {...} } or { ok: false, error: string }.
 */
async function _wxFetchForecast(loc) {
  try {
    var address = loc.address || loc.label || '';
    if (!address) return { ok: false, error: 'No address' };

    // Check shared cache first
    if (typeof getWeatherFromCache === 'function') {
      var cached = getWeatherFromCache(address);
      if (cached && cached.daily) {
        return { ok: true, daily: cached.daily };
      }
    }

    // Cache miss — fetch fresh and cache it
    if (typeof fetchAndCacheWeather === 'function') {
      var entry = await fetchAndCacheWeather(address);
      if (entry && entry.daily) {
        return { ok: true, daily: entry.daily };
      }
      return { ok: false, error: 'Weather data unavailable' };
    }

    // Fallback if shared cache functions not available
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

/** Get the day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD string. */
function _wxDayOfWeek(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.getDay();
}

/**
 * Build a map: locationKey → Set of YYYY-MM-DD date strings where chits exist.
 * Matches chit.location against each saved location's address and label (case-insensitive).
 */
function _wxBuildLocDateMap(chits, locations) {
  // Build a lookup: normalized address/label → location index
  var locLookup = {};
  for (var i = 0; i < locations.length; i++) {
    var addr = (locations[i].address || '').toLowerCase().trim();
    var label = (locations[i].label || '').toLowerCase().trim();
    if (addr) locLookup[addr] = i;
    if (label) locLookup[label] = i;
  }

  // result[locIndex] = Set of date strings
  var result = {};

  for (var c = 0; c < chits.length; c++) {
    var chit = chits[c];
    if (chit.deleted) continue;
    var chitLoc = (chit.location || '').toLowerCase().trim();
    if (!chitLoc) continue;

    var locIdx = locLookup[chitLoc];
    if (locIdx === undefined) continue;

    // Extract all dates from this chit
    var datesToAdd = [];
    var fields = ['start_datetime', 'end_datetime', 'due_datetime'];
    for (var f = 0; f < fields.length; f++) {
      var val = chit[fields[f]];
      if (val && typeof val === 'string') {
        var dateOnly = val.substring(0, 10); // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
          datesToAdd.push(dateOnly);
        }
      }
    }

    // If start and end span multiple days, fill in the range
    if (chit.start_datetime && chit.end_datetime) {
      var startD = new Date(chit.start_datetime.substring(0, 10));
      var endD = new Date(chit.end_datetime.substring(0, 10));
      if (!isNaN(startD) && !isNaN(endD)) {
        var cur = new Date(startD);
        while (cur <= endD) {
          var ds = cur.getFullYear() + '-' +
            String(cur.getMonth() + 1).padStart(2, '0') + '-' +
            String(cur.getDate()).padStart(2, '0');
          datesToAdd.push(ds);
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    if (!result[locIdx]) result[locIdx] = {};
    for (var di = 0; di < datesToAdd.length; di++) {
      result[locIdx][datesToAdd[di]] = true;
    }
  }

  return result;
}

/**
 * Render the full weather forecast table.
 */
function _wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate) {
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

  // Pre-compute which date indices are week starts (skip index 0 — no separator before the first day)
  var weekStartIndices = {};
  for (var wi = 1; wi < dates.length; wi++) {
    if (_wxDayOfWeek(dates[wi]) === weekStartDay) weekStartIndices[wi] = true;
  }

  // Build date header row — use an invisible row-header for perfect alignment
  var headerHtml = '<div class="weather-date-row">' +
    '<div class="weather-row-header" style="visibility:hidden;border-color:transparent;background:transparent;padding:0 6px;"></div>';
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
      rowsHtml += '<div class="weather-row-error" draggable="true" data-wx-idx="' + r + '">' +
        '<div class="weather-row-header">' +
          '<span class="drag-handle">☰</span>' +
          '<span class="loc-label">' + _wxEsc(loc.label || 'Location') + '</span>' +
          '<span class="loc-address">' + _wxEsc(loc.address || '') + '</span>' +
        '</div>' +
        '<span class="error-msg">⚠️ ' + _wxEsc(res.error || 'Weather unavailable') + '</span>' +
      '</div>';
      continue;
    }

    var daily = res.daily;
    rowsHtml += '<div class="weather-row" draggable="true" data-wx-idx="' + r + '">';

    // Row header
    rowsHtml += '<div class="weather-row-header">' +
      '<span class="drag-handle">☰</span>' +
      '<span class="loc-label">' + _wxEsc(loc.label || 'Location') + '</span>' +
      '<span class="loc-address">' + _wxEsc(loc.address || '') + '</span>' +
    '</div>';

    // Day blocks — mark week-start blocks with a data attribute
    for (var dd = 0; dd < daily.time.length; dd++) {
      var isToday = _wxIsToday(daily.time[dd]);
      var hasEvent = chitsByLocDate && chitsByLocDate[r] && chitsByLocDate[r][daily.time[dd]];
      var icon = _wxPageGetIcon(daily.weathercode[dd]);
      var highF = _wxPageC2F(daily.temperature_2m_max[dd]);
      var lowF = _wxPageC2F(daily.temperature_2m_min[dd]);
      var precip = daily.precipitation_sum[dd];
      var wCode = daily.weathercode[dd];
      var precipStr = _wxFormatPrecip(precip, wCode);

      var blockClasses = 'weather-day-block';
      if (isToday) blockClasses += ' today';
      if (hasEvent) blockClasses += ' has-event';
      var wsAttr = weekStartIndices[dd] ? ' data-wx-week-start="1"' : '';
      var locAddr = _wxEsc(loc.address || loc.label || '');

      rowsHtml += '<div class="' + blockClasses + '"' + wsAttr +
        ' data-wx-date="' + daily.time[dd] + '"' +
        ' data-wx-loc="' + locAddr + '"' +
        ' style="cursor:pointer">' +
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

  // Draw full-height week separator lines
  _wxDrawWeekLines(container);

  // Wire up drag-and-drop reordering
  _wxInitDragDrop(container);

  // Wire up day block click → navigate to dashboard Day view
  _wxInitBlockClick(container);
}

/** Simple HTML escape. */
function _wxEsc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Day block click → navigate to dashboard Day view ─────────────────────────

function _wxInitBlockClick(container) {
  container.addEventListener('click', function (e) {
    var block = e.target.closest('.weather-day-block');
    if (!block) return;
    var date = block.getAttribute('data-wx-date');
    var loc = block.getAttribute('data-wx-loc');
    if (!date) return;
    // Store nav intent in sessionStorage for the dashboard to pick up
    sessionStorage.setItem('cwoc_wx_nav', JSON.stringify({ date: date, location: loc || '' }));
    window.location.href = '/';
  });
}

// ── Week separator lines (absolute-positioned, full table height) ────────────

function _wxDrawWeekLines(container) {
  var table = container.querySelector('.weather-table');
  if (!table) return;

  // Find all week-start day blocks in the first data row
  var firstRow = table.querySelector('.weather-row');
  if (!firstRow) return;

  var wsBlocks = firstRow.querySelectorAll('.weather-day-block[data-wx-week-start]');
  if (!wsBlocks.length) return;

  var tableRect = table.getBoundingClientRect();

  wsBlocks.forEach(function (block) {
    var blockRect = block.getBoundingClientRect();
    // Center the line in the 4px gap before this block
    var lineX = blockRect.left - tableRect.left - 2;
    var line = document.createElement('div');
    line.className = 'wx-week-line';
    line.style.left = lineX + 'px';
    // Add a little breathing room top and bottom
    line.style.top = '4px';
    line.style.bottom = '4px';
    table.appendChild(line);
  });
}

// ── Drag-and-drop row reordering ─────────────────────────────────────────────

var _wxDragSrcEl = null;

function _wxInitDragDrop(container) {
  var table = container.querySelector('.weather-table');
  if (!table) return;

  var rows = table.querySelectorAll('.weather-row[draggable], .weather-row-error[draggable]');
  rows.forEach(function (row) {
    row.addEventListener('dragstart', _wxOnDragStart);
    row.addEventListener('dragover', _wxOnDragOver);
    row.addEventListener('dragenter', _wxOnDragEnter);
    row.addEventListener('dragleave', _wxOnDragLeave);
    row.addEventListener('drop', _wxOnDrop);
    row.addEventListener('dragend', _wxOnDragEnd);
  });
}

function _wxOnDragStart(e) {
  _wxDragSrcEl = this;
  this.classList.add('wx-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.getAttribute('data-wx-idx'));
}

function _wxOnDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function _wxOnDragEnter(e) {
  e.preventDefault();
  this.classList.add('wx-drag-over');
}

function _wxOnDragLeave() {
  this.classList.remove('wx-drag-over');
}

function _wxOnDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  this.classList.remove('wx-drag-over');

  if (_wxDragSrcEl === this) return;

  // Move the DOM element
  var table = this.parentNode;
  var allRows = Array.from(table.querySelectorAll('.weather-row[draggable], .weather-row-error[draggable]'));
  var srcIdx = allRows.indexOf(_wxDragSrcEl);
  var tgtIdx = allRows.indexOf(this);

  if (srcIdx < 0 || tgtIdx < 0) return;

  if (srcIdx < tgtIdx) {
    table.insertBefore(_wxDragSrcEl, this.nextSibling);
  } else {
    table.insertBefore(_wxDragSrcEl, this);
  }

  // Persist the new order
  _wxSaveRowOrder(table);
}

function _wxOnDragEnd() {
  this.classList.remove('wx-dragging');
  // Clean up any lingering drag-over highlights
  var overs = document.querySelectorAll('.wx-drag-over');
  for (var i = 0; i < overs.length; i++) overs[i].classList.remove('wx-drag-over');
}

/** Save the current row order to localStorage by location label. */
function _wxSaveRowOrder(table) {
  var rows = table.querySelectorAll('.weather-row[draggable], .weather-row-error[draggable]');
  var order = [];
  rows.forEach(function (row) {
    var label = row.querySelector('.loc-label');
    if (label) order.push(label.textContent);
  });
  try {
    localStorage.setItem('cwoc_wx_row_order', JSON.stringify(order));
  } catch (e) { /* ignore */ }
}

/** Get saved row order from localStorage. Returns array of label strings or null. */
function _wxGetSavedRowOrder() {
  try {
    var raw = localStorage.getItem('cwoc_wx_row_order');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}
