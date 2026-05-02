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
  return _convertTemp(c);
}

/** Get precipitation type from WMO weather code. */
function _wxPrecipType(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunder';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  return '';
}

/**
 * Check if weather conditions are extreme.
 * Currently: high temp > 5°C (temps are in Celsius from the API).
 */
function _wxIsExtreme(highC, lowC, weatherCode) {
  if (highC !== null && highC !== undefined && highC > 5) return true;
  return false;
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
        'Add locations in <a href="/frontend/html/settings.html">⚙️ Settings</a>.' +
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
  var allChits = [];
  try {
    var chitResp = await fetch('/api/chits');
    if (chitResp.ok) {
      allChits = await chitResp.json();
      chitsByLocDate = _wxBuildLocDateMap(allChits, locations);
    }
  } catch (e) {
    console.error('Weather page: failed to load chits for event highlighting', e);
  }

  // Render the table
  _wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate);

  // Add city rows for chits at non-saved locations
  var dates = null;
  for (var ri = 0; ri < results.length; ri++) {
    if (results[ri].ok && results[ri].daily && results[ri].daily.time) {
      dates = results[ri].daily.time;
      break;
    }
  }
  if (dates && allChits.length > 0) {
    _wxAddCityRows(container, allChits, locations, dates, weekStartDay);
  }
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
      if (_wxIsExtreme(daily.temperature_2m_max[dd], daily.temperature_2m_min[dd], wCode)) blockClasses += ' wx-extreme';
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


// ── City rows for chits at non-saved locations ───────────────────────────────

/**
 * Extract a city name from a full address string.
 * Tries to parse "City, ST" or "City, State" patterns.
 * Falls back to the last comma-separated segment before any zip code.
 */
function _wxExtractCity(address) {
  if (!address) return null;
  var cleaned = address.trim();

  // Try "City, ST ZIP" or "City, ST"
  var m = cleaned.match(/([A-Za-z\s.'-]+),\s*([A-Z]{2})\s*(\d{5})?/);
  if (m) return m[1].trim() + ', ' + m[2];

  // Try last two comma segments (e.g. "123 Main St, Springfield, IL 62704")
  var parts = cleaned.split(',').map(function (s) { return s.trim(); });
  if (parts.length >= 2) {
    var last = parts[parts.length - 1].replace(/\d{5}(-\d{4})?/, '').trim();
    var secondLast = parts[parts.length - 2].trim();
    if (last.length <= 3 && last.length > 0) {
      return secondLast + ', ' + last;
    }
    return secondLast;
  }

  return cleaned;
}

/**
 * Build city groups from chits that have locations NOT matching any saved location.
 * Returns: { cityName: { dates: Set<YYYY-MM-DD>, address: string } }
 */
function _wxBuildCityGroups(chits, savedLocations, forecastDates) {
  // Build a set of saved location addresses/labels for exclusion
  var savedKeys = {};
  for (var i = 0; i < savedLocations.length; i++) {
    var addr = (savedLocations[i].address || '').toLowerCase().trim();
    var label = (savedLocations[i].label || '').toLowerCase().trim();
    if (addr) savedKeys[addr] = true;
    if (label) savedKeys[label] = true;
  }

  // Build a set of forecast dates for range checking
  var dateSet = {};
  for (var d = 0; d < forecastDates.length; d++) {
    dateSet[forecastDates[d]] = true;
  }

  // Group chits by city
  var cities = {}; // cityName → { dates: { dateStr: [chitTitle, ...] }, address: string }

  for (var c = 0; c < chits.length; c++) {
    var chit = chits[c];
    if (chit.deleted) continue;
    var loc = (chit.location || '').trim();
    if (!loc) continue;

    // Skip if this location matches a saved location
    if (savedKeys[loc.toLowerCase()]) continue;

    // Extract dates from this chit
    var chitDates = [];
    var fields = ['start_datetime', 'end_datetime', 'due_datetime'];
    for (var f = 0; f < fields.length; f++) {
      var val = chit[fields[f]];
      if (val && typeof val === 'string') {
        var dateOnly = val.substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && dateSet[dateOnly]) {
          chitDates.push(dateOnly);
        }
      }
    }

    // Fill multi-day ranges
    if (chit.start_datetime && chit.end_datetime) {
      var startD = new Date(chit.start_datetime.substring(0, 10));
      var endD = new Date(chit.end_datetime.substring(0, 10));
      if (!isNaN(startD) && !isNaN(endD)) {
        var cur = new Date(startD);
        while (cur <= endD) {
          var ds = cur.getFullYear() + '-' +
            String(cur.getMonth() + 1).padStart(2, '0') + '-' +
            String(cur.getDate()).padStart(2, '0');
          if (dateSet[ds]) chitDates.push(ds);
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    if (chitDates.length === 0) continue;

    var city = _wxExtractCity(loc);
    if (!city) continue;

    // Normalize city key for case-insensitive grouping
    var cityKey = city.toLowerCase();
    var chitTitle = chit.title || '(Untitled)';

    if (!cities[cityKey]) {
      cities[cityKey] = { dates: {}, address: loc, displayName: city };
    }
    // Deduplicate dates for this chit, then add title
    var seenDates = {};
    for (var di = 0; di < chitDates.length; di++) {
      if (seenDates[chitDates[di]]) continue;
      seenDates[chitDates[di]] = true;
      if (!cities[cityKey].dates[chitDates[di]]) {
        cities[cityKey].dates[chitDates[di]] = [];
      }
      if (cities[cityKey].dates[chitDates[di]].indexOf(chitTitle) === -1) {
        cities[cityKey].dates[chitDates[di]].push(chitTitle);
      }
    }
  }

  return cities;
}

/**
 * Add city-based weather rows to the weather table for chits at non-saved locations.
 * Only shows weather blocks on days that have chits in that city.
 */
async function _wxAddCityRows(container, allChits, savedLocations, forecastDates, weekStartDay) {
  var cities = _wxBuildCityGroups(allChits, savedLocations, forecastDates);
  var cityNames = Object.keys(cities);
  if (cityNames.length === 0) return;

  // Pre-compute week start indices
  var weekStartIndices = {};
  for (var wi = 1; wi < forecastDates.length; wi++) {
    if (_wxDayOfWeek(forecastDates[wi]) === weekStartDay) weekStartIndices[wi] = true;
  }

  var table = container.querySelector('.weather-table');
  if (!table) return;

  // Show loading indicator below the table
  var loadingEl = document.createElement('div');
  loadingEl.className = 'weather-loading';
  loadingEl.id = 'wx-city-loading';
  loadingEl.innerHTML = '⏳ Loading weather for ' + cityNames.length + ' additional ' + (cityNames.length === 1 ? 'city' : 'cities') + '…';
  table.parentNode.insertBefore(loadingEl, table.nextSibling);

  // Fetch weather for each city (geocode by city name, not full address)
  for (var ci = 0; ci < cityNames.length; ci++) {
    var cityKey = cityNames[ci];
    var cityData = cities[cityKey];
    var cityName = cityData.displayName || cityKey;

    // Update loading text with progress
    loadingEl.innerHTML = '⏳ Loading weather for city ' + (ci + 1) + ' of ' + cityNames.length + ' (' + _wxEsc(cityName) + ')…';

    // Fetch forecast for this city
    var forecast = null;
    try {
      var entry = await fetchAndCacheWeather(cityName);
      if (entry && entry.daily) {
        forecast = entry.daily;
      }
    } catch (e) {
      console.warn('Weather fetch failed for city "' + cityName + '":', e);
    }

    // Build the row HTML
    var rowHtml = '<div class="weather-row weather-city-row" draggable="true" data-wx-idx="city-' + ci + '">';

    // Row header — title on both container and label for reliable hover
    rowHtml += '<div class="weather-row-header" title="' + _wxEsc(cityName) + '">' +
      '<span class="drag-handle">☰</span>' +
      '<span class="loc-label" title="' + _wxEsc(cityName) + '">📍 ' + _wxEsc(cityName) + '</span>' +
      '<span class="loc-address" title="' + _wxEsc(cityName) + '" style="font-size:11px;opacity:0.6;">from chits</span>' +
    '</div>';

    // Day blocks — only for dates that have chits in this city
    for (var dd = 0; dd < forecastDates.length; dd++) {
      var dateStr = forecastDates[dd];
      var chitTitles = cityData.dates[dateStr];
      var hasChit = chitTitles && chitTitles.length > 0;

      if (!hasChit || !forecast) {
        // Empty placeholder to maintain alignment
        var wsAttrEmpty = weekStartIndices[dd] ? ' data-wx-week-start="1"' : '';
        rowHtml += '<div class="weather-day-block weather-day-empty"' + wsAttrEmpty + ' style="visibility:hidden;"></div>';
        continue;
      }

      // Find this date in the forecast data
      var fIdx = forecast.time ? forecast.time.indexOf(dateStr) : -1;
      if (fIdx < 0) {
        var wsAttrMiss = weekStartIndices[dd] ? ' data-wx-week-start="1"' : '';
        rowHtml += '<div class="weather-day-block weather-day-empty"' + wsAttrMiss + ' style="visibility:hidden;"></div>';
        continue;
      }

      var isToday = _wxIsToday(dateStr);
      var icon = _wxPageGetIcon(forecast.weathercode[fIdx]);
      var highF = _wxPageC2F(forecast.temperature_2m_max[fIdx]);
      var lowF = _wxPageC2F(forecast.temperature_2m_min[fIdx]);
      var precip = forecast.precipitation_sum[fIdx];
      var wCode = forecast.weathercode[fIdx];
      var precipStr = _wxFormatPrecip(precip, wCode);

      var blockClasses = 'weather-day-block has-event';
      if (isToday) blockClasses += ' today';
      if (_wxIsExtreme(forecast.temperature_2m_max[fIdx], forecast.temperature_2m_min[fIdx], wCode)) blockClasses += ' wx-extreme';
      var wsAttr = weekStartIndices[dd] ? ' data-wx-week-start="1"' : '';

      // Tooltip: chit titles that triggered this day
      var tooltip = chitTitles.join('&#10;');

      rowHtml += '<div class="' + blockClasses + '"' + wsAttr +
        ' data-wx-date="' + dateStr + '"' +
        ' data-wx-loc="' + _wxEsc(cityName) + '"' +
        ' title="' + tooltip + '"' +
        ' style="cursor:pointer">' +
        '<span class="wx-icon" title="' + tooltip + '">' + icon + '</span>' +
        '<span class="wx-temps" title="' + tooltip + '">' +
          '<span class="wx-high">' + highF + '°</span> ' +
          '<span class="wx-low">' + lowF + '°</span>' +
        '</span>' +
        '<span class="wx-precip" title="' + tooltip + '">' + precipStr + '</span>' +
      '</div>';
    }

    rowHtml += '</div>';

    // Append to table
    table.insertAdjacentHTML('beforeend', rowHtml);
  }

  // Remove loading indicator
  var loadingDone = document.getElementById('wx-city-loading');
  if (loadingDone) loadingDone.remove();

  // Re-draw week lines to include new rows
  // Remove old lines first
  var oldLines = table.querySelectorAll('.wx-week-line');
  for (var ol = 0; ol < oldLines.length; ol++) oldLines[ol].remove();
  _wxDrawWeekLines(container);

  // Re-wire drag-drop and click handlers for new rows
  _wxInitDragDrop(container);
  _wxInitBlockClick(container);
}
