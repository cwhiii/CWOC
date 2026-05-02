/**
 * main-modals.js — Clock, weather, and quick-edit modals for the dashboard.
 *
 * Contains:
 *   - Clock modal (_openClockModal, _closeClockModal, _renderClocks, _renderAnalogClock, _renderHSTClock)
 *   - Weather modal (_openWeatherModal, _closeWeatherModal, _fetchWeatherForModal)
 *   - Weather helpers (_weatherIcons, _getWeatherIcon, _escHtml, _getPrecipLabel, _formatPrecip,
 *     _celsiusToFahrenheit, _isWeatherStale, _buildWeatherModalHTML, _buildLocationSelectorHTML,
 *     _onWeatherModalLocChange, _onWeatherModalManualGo)
 *   - Chit weather indicators (_queueChitWeatherFetch, _processChitWxQueue, _fetchAndApplyChitWeather,
 *     _prefetchChitWeather, _fetchWeatherForCache)
 *   - Quick-edit modal helpers (deleteChit, cancelEdit)
 *   - Misc view helpers (changeView, toggleAllDay, setColor, _convertDBDateToDisplayDate)
 *
 * Depends on globals from main.js: chits, currentTab, currentView, previousState
 * Depends on shared.js: getCachedSettings, cwocConfirm, _geocodeAddress, loadSavedLocations,
 *   getDefaultLocation, _showDeleteUndoToast, _utcToLocalDate, _parseISOTime
 */

/* ── Clock Modal ─────────────────────────────────────────────────────────── */
let _clockModalInterval = null;
async function _openClockModal() {
  // Remove existing
  const existing = document.getElementById('clock-modal-overlay');
  if (existing) { _closeClockModal(); return; }

  // Load clock settings
  let activeClocks = ['24hour', '12hour', 'hst']; // defaults
  let orientation = 'Horizontal';
  try {
    const s = await getCachedSettings();
    if (s.active_clocks) {
      const parsed = typeof s.active_clocks === 'string' ? JSON.parse(s.active_clocks) : s.active_clocks;
      if (Array.isArray(parsed) && parsed.length > 0) activeClocks = parsed;
    }
    if (s.alarm_orientation) orientation = s.alarm_orientation;
  } catch (e) { console.error('Failed to load clock settings', e); }

  const overlay = document.createElement('div');
  overlay.id = 'clock-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99998;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeClockModal(); });

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:24px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:Lora, Georgia, serif;min-width:280px;text-align:center;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:1.1em;font-weight:bold;color:#4a2c2a;margin-bottom:16px;';
  title.textContent = '🕐 Clocks';
  modal.appendChild(title);

  const isVertical = orientation === 'Vertical';
  const clocksDiv = document.createElement('div');
  clocksDiv.id = 'clock-modal-clocks';
  clocksDiv.style.cssText = `display:flex;flex-direction:${isVertical ? 'column' : 'row'};gap:12px;align-items:center;${isVertical ? '' : 'justify-content:center;flex-wrap:wrap;'}`;
  modal.appendChild(clocksDiv);

  const closeBtn = document.createElement('div');
  closeBtn.style.cssText = 'margin-top:16px;font-size:0.8em;opacity:0.5;cursor:pointer;';
  closeBtn.textContent = 'ESC or click outside to close';
  closeBtn.onclick = _closeClockModal;
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  _renderClocks(clocksDiv, activeClocks, isVertical);
  _clockModalInterval = setInterval(() => _renderClocks(clocksDiv, activeClocks, isVertical), 1000);
}

function _renderClocks(container, activeClocks, isVertical) {
  const now = new Date();
  const h24 = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';

  // HST (Holeman Simplified Time): day fraction in sub-days (sd)
  const dayFraction = (h24 * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  const hstVal = (dayFraction * 100).toFixed(3);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateStr = `${now.getFullYear()}-${months[now.getMonth()]}-${String(now.getDate()).padStart(2,'0')} ${days[now.getDay()]}`;

  let html = `<div style="font-size:1.4em;font-weight:300;color:#6b4e31;letter-spacing:3px;margin-bottom:6px;opacity:0.8;">${dateStr}</div>`;

  const bgColors = ['rgba(139,69,19,0.06)', 'rgba(139,69,19,0.18)'];
  activeClocks.forEach((clock, idx) => {
    const isHST = clock === 'hst' || clock === 'metric' || clock === 'hstbar' || clock === 'metricbar';
    const bg = (!isVertical && !isHST) ? `background:${bgColors[idx % 2]};border-radius:8px;padding:6px 14px;` : '';
    let inner = '';
    switch (clock) {
      case '24hour':
        inner = `<div style="font-size:2em;font-weight:bold;color:#4a2c2a;letter-spacing:2px;">${String(h24).padStart(2,'0')}:${m}:${s} <span style="font-size:0.65em;">Hours</span></div>`;
        break;
      case '12hour':
        inner = `<div style="font-size:2em;font-weight:bold;color:#4a2c2a;letter-spacing:2px;">${h12}:${m}:${s} <span style="font-size:0.65em;">${ampm}</span></div>`;
        break;
      case '12houranalog':
        inner = _renderAnalogClock(h24, now.getMinutes(), now.getSeconds());
        break;
      case 'metric':
      case 'hst':
      case 'metricbar':
      case 'hstbar':
        inner = _renderHSTClock(dayFraction, hstVal);
        break;
    }
    if (inner) html += `<div style="${bg}">${inner}</div>`;
  });

  container.innerHTML = html;
}

function _renderHSTClock(dayFraction, hstVal) {
  const pct = (dayFraction * 100).toFixed(1);
  return `<div style="position:relative;width:300px;margin:2px auto;" title="Holeman Simplified Time — ${hstVal} sd">
    <div style="width:100%;height:2.4em;background:#f5e6cc;border:2px solid #8b4513;border-radius:6px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.15);display:flex;align-items:center;">
      <div style="position:absolute;top:2px;left:2px;bottom:2px;width:calc(${pct}% - 4px);background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);transition:width 1s linear;border-radius:4px;"></div>
      <div style="position:relative;width:100%;text-align:center;font-size:1.5em;font-weight:bold;color:#4a2c2a;letter-spacing:2px;line-height:2.4em;text-shadow:0 0 4px #fff8e1,0 0 8px #fff8e1,0 0 2px #fff8e1;z-index:1;">${hstVal} sd</div>
    </div>
  </div>`;
}

function _renderAnalogClock(h24, min, sec) {
  const size = 220;
  const cx = size / 2, cy = size / 2;
  const r = cx - 4;

  // Angles (0° = 12 o'clock, clockwise)
  const hDeg = ((h24 % 12) + min / 60) * 30;
  const mDeg = (min + sec / 60) * 6;
  const sDeg = sec * 6;

  const hand = (deg, len) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + len * Math.cos(rad), y: cy + len * Math.sin(rad) };
  };
  const hTip = hand(hDeg, r * 0.48);
  const mTip = hand(mDeg, r * 0.70);
  const sTip = hand(sDeg, r * 0.78);
  const sTail = hand(sDeg + 180, r * 0.18);

  // Hour markers & minute ticks
  let markers = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    const isQ = i % 3 === 0;
    const o = r - 2, inner = isQ ? r - 16 : r - 9;
    markers += `<line x1="${cx + o * Math.cos(a)}" y1="${cy + o * Math.sin(a)}" x2="${cx + inner * Math.cos(a)}" y2="${cy + inner * Math.sin(a)}" stroke="#4a2c2a" stroke-width="${isQ ? 4 : 1.5}" stroke-linecap="round"/>`;
  }
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i * 6 - 90) * Math.PI / 180;
    ticks += `<line x1="${cx + (r - 2) * Math.cos(a)}" y1="${cy + (r - 2) * Math.sin(a)}" x2="${cx + (r - 5.5) * Math.cos(a)}" y2="${cy + (r - 5.5) * Math.sin(a)}" stroke="#8b4513" stroke-width="0.8" opacity="0.4"/>`;
  }

  // Hour numerals
  let numerals = '';
  const nums = [12,1,2,3,4,5,6,7,8,9,10,11];
  nums.forEach((n, i) => {
    const a = (i * 30 - 90) * Math.PI / 180;
    const nr = r - 30;
    numerals += `<text x="${cx + nr * Math.cos(a)}" y="${cy + nr * Math.sin(a)}" text-anchor="middle" dominant-baseline="central" fill="#4a2c2a" font-size="20" font-family="'Lora', Georgia, serif" font-weight="bold">${n}</text>`;
  });

  return `<div style="display:inline-block;margin:2px auto;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="_cg" cx="45%" cy="40%">
          <stop offset="0%" stop-color="#fff8e1"/>
          <stop offset="80%" stop-color="#f5e6cc"/>
          <stop offset="100%" stop-color="#e8d5b0"/>
        </radialGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#5c3a1e"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 1}" fill="#8b4513"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#_cg)"/>
      ${ticks}
      ${markers}
      ${numerals}
      <line x1="${cx}" y1="${cy}" x2="${hTip.x}" y2="${hTip.y}" stroke="#4a2c2a" stroke-width="6" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy}" x2="${mTip.x}" y2="${mTip.y}" stroke="#4a2c2a" stroke-width="4" stroke-linecap="round"/>
      <line x1="${sTail.x}" y1="${sTail.y}" x2="${sTip.x}" y2="${sTip.y}" stroke="#a0522d" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#d4af37" stroke="#4a2c2a" stroke-width="1.5"/>
    </svg>
  </div>`;
}

function _closeClockModal() {
  const overlay = document.getElementById('clock-modal-overlay');
  if (overlay) overlay.remove();
  if (_clockModalInterval) { clearInterval(_clockModalInterval); _clockModalInterval = null; }
}

// ── Weather Modal (W hotkey) ─────────────────────────────────────────────────
// ── Weather Modal (W hotkey) ─────────────────────────────────────────────────

const _weatherIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌦️', 57: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

function _getWeatherIcon(code) {
  return _weatherIcons[code] || '❓';
}

function _escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _getPrecipLabel(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunder';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  return '';
}

/**
 * Format precipitation for display. Returns '' if no precip.
 * precipMm: precipitation in mm, weatherCode: WMO code for type.
 * Rounds to nearest cm. If > 0 but < 0.5cm, just says the type word.
 */
function _formatPrecip(precipMm, weatherCode) {
  if (!precipMm || precipMm <= 0) return '';
  var pType = _getPrecipLabel(weatherCode);
  if (!pType) pType = 'precip';
  var cm = Math.round(precipMm / 10);
  if (cm < 1) return pType;
  return cm + 'cm ' + pType;
}

// ── Weather Utility Functions ─────────────────────────────────────────────────

/** Convert Celsius to display temperature, respecting unit_system setting. */
function _celsiusToFahrenheit(c) {
  return _convertTemp(c);
}

/** Returns true if the given ISO timestamp is older than 24 hours from now. */
function _isWeatherStale(updatedTime) {
  if (!updatedTime) return true;
  var then = new Date(updatedTime).getTime();
  if (isNaN(then)) return true;
  return (Date.now() - then) > 24 * 60 * 60 * 1000;
}

// ── Chit Weather Indicators (async fetch for card views) ─────────────────────

var _chitWxQueue = [];       // [{location, span}] — pending fetches
var _chitWxFetching = false; // true while processing queue
var _chitWxGeoCache = {};    // location → {lat, lon} (in-memory for session)

/** Queue a weather fetch for a chit indicator span. Batched to avoid flooding APIs. */
function _queueChitWeatherFetch(location, span) {
  _chitWxQueue.push({ location: location, span: span });
  if (!_chitWxFetching) _processChitWxQueue();
}

async function _processChitWxQueue() {
  if (_chitWxFetching || _chitWxQueue.length === 0) return;
  _chitWxFetching = true;

  // Group by location to avoid duplicate fetches
  var byLoc = {};
  while (_chitWxQueue.length > 0) {
    var item = _chitWxQueue.shift();
    var key = item.location.toLowerCase().trim();
    if (!byLoc[key]) byLoc[key] = { location: item.location, spans: [] };
    byLoc[key].spans.push(item.span);
  }

  var keys = Object.keys(byLoc);
  for (var i = 0; i < keys.length; i++) {
    var entry = byLoc[keys[i]];
    try {
      await _fetchAndApplyChitWeather(entry.location, entry.spans);
    } catch (e) { /* silently fail */ }
    // Rate-limit: small delay between locations to respect Nominatim policy
    if (i < keys.length - 1) await new Promise(function(r) { setTimeout(r, 300); });
  }

  _chitWxFetching = false;
  // Process any items queued while we were fetching
  if (_chitWxQueue.length > 0) _processChitWxQueue();
}

async function _fetchAndApplyChitWeather(address, spans) {
  var cacheKey = 'cwoc_wx_' + address.toLowerCase().trim();

  // Check localStorage cache (1 hour TTL)
  try {
    var cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && cached.icon && (Date.now() - cached.ts < 3600000)) {
      spans.forEach(function(s) {
        s.textContent = cached.icon;
        s.title = cached.tooltip;
      });
      return;
    }
  } catch (e) {}

  // Geocode using shared progressive fallback
  var lat, lon;
  var geoKey = address.toLowerCase().trim();
  if (_chitWxGeoCache[geoKey]) {
    lat = _chitWxGeoCache[geoKey].lat;
    lon = _chitWxGeoCache[geoKey].lon;
  } else {
    try {
      var coords = await _geocodeAddress(address);
      lat = coords.lat;
      lon = coords.lon;
      _chitWxGeoCache[geoKey] = { lat: lat, lon: lon };
    } catch (e) { return; }
  }

  // Fetch weather
  var wxResp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1');
  if (!wxResp.ok) return;
  var wxData = await wxResp.json();
  if (!wxData || !wxData.daily) return;

  var today = wxData.daily;
  var weatherCode = today.weathercode[0];
  var minC = today.temperature_2m_min[0], maxC = today.temperature_2m_max[0], precipMm = today.precipitation_sum[0];
  var windKmh = today.wind_speed_10m_max ? today.wind_speed_10m_max[0] : 0;
  var wind = _convertWind(windKmh);
  var minT = _convertTemp(minC), maxT = _convertTemp(maxC);
  var icon = _getWeatherIcon(weatherCode);
  var precipText = _formatPrecip(precipMm, weatherCode);
  var windText = wind.value >= (_isMetricUnits() ? 32 : 20) ? ' · 💨' + wind.value + wind.unit : '';
  var tooltip = maxT + '°/' + minT + '°';
  if (precipText) tooltip += ' · ' + precipText;
  tooltip += windText;

  // Update all spans for this location — icon only, details in title
  spans.forEach(function(s) {
    s.textContent = icon;
    s.title = tooltip;
  });

  // Cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ icon: icon, tooltip: tooltip, ts: Date.now() }));
  } catch (e) { /* ignore */ }
}

function _buildWeatherModalHTML(content) {
  return `<div class="weather-modal">${content}<div class="weather-modal-actions"><button class="weather-modal-forecast-btn" onclick="_closeWeatherModal(); storePreviousState(); window.location.href='/frontend/html/weather.html';">📊 Full Forecast</button></div><div class="weather-modal-close" onclick="_closeWeatherModal()">ESC or click outside to close</div></div>`;
}

function _buildLocationSelectorHTML(locations, selectedAddress) {
  var opts = '';
  if (locations && locations.length > 0) {
    locations.forEach(function (loc) {
      var sel = (loc.address === selectedAddress) ? ' selected' : '';
      opts += `<option value="${(loc.address || '').replace(/"/g, '&quot;')}"${sel}>${loc.label || loc.address || '(unnamed)'}</option>`;
    });
  }
  return '<div class="weather-modal-location-selector">' +
    '<select id="weather-modal-loc-dropdown" onchange="_onWeatherModalLocChange()">' +
      '<option value="">— Saved Locations —</option>' +
      opts +
      '<option value="__manual__">✏️ Type a location…</option>' +
    '</select>' +
    '<div id="weather-modal-manual-row" style="display:none;gap:4px;margin-bottom:6px;">' +
      '<input id="weather-modal-manual-input" type="text" placeholder="Enter address…" />' +
      '<button onclick="_onWeatherModalManualGo()">Go</button>' +
    '</div>' +
  '</div>';
}

function _onWeatherModalLocChange() {
  var dd = document.getElementById('weather-modal-loc-dropdown');
  var manualRow = document.getElementById('weather-modal-manual-row');
  if (!dd) return;
  if (dd.value === '__manual__') {
    if (manualRow) manualRow.style.display = 'flex';
    var inp = document.getElementById('weather-modal-manual-input');
    if (inp) inp.focus();
    return;
  }
  if (manualRow) manualRow.style.display = 'none';
  if (dd.value) {
    // Find the label for this address
    var locs = window._savedLocations || [];
    var loc = locs.find(function (l) { return l.address === dd.value; });
    _fetchWeatherForModal(dd.value, loc ? loc.label : 'Custom');
  }
}

function _onWeatherModalManualGo() {
  var inp = document.getElementById('weather-modal-manual-input');
  if (!inp || !inp.value.trim()) return;
  _fetchWeatherForModal(inp.value.trim(), 'Custom');
}

async function _openWeatherModal() {
  // Toggle off if already open
  var existing = document.getElementById('weather-modal-overlay');
  if (existing) { _closeWeatherModal(); return; }

  // Ensure saved locations are loaded
  await loadSavedLocations();
  var locations = window._savedLocations || [];
  var defaultLoc = getDefaultLocation();

  var overlay = document.createElement('div');
  overlay.id = 'weather-modal-overlay';
  overlay.setAttribute('tabindex', '-1');
  overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeWeatherModal(); });
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      var dd = document.getElementById('weather-modal-loc-dropdown');
      var inp = document.getElementById('weather-modal-manual-input');
      // If dropdown or input is focused, just blur it (first Escape)
      if (dd && document.activeElement === dd) { dd.blur(); overlay.focus(); return; }
      if (inp && document.activeElement === inp) { inp.blur(); overlay.focus(); return; }
      // Otherwise close the modal (second Escape)
      _closeWeatherModal();
    }
  });

  if (!defaultLoc && locations.length === 0) {
    overlay.innerHTML = _buildWeatherModalHTML(
      '<div class="weather-modal-error">No saved locations configured. Add one in Settings.</div>'
    );
    document.body.appendChild(overlay);
    overlay.focus();
    return;
  }

  var startLoc = defaultLoc || locations[0];
  var label = startLoc.label || 'Default';
  var address = startLoc.address || '';

  // Show modal with location selector + loading state
  overlay.innerHTML = _buildWeatherModalHTML(
    _buildLocationSelectorHTML(locations, address) +
    '<div class="weather-modal-body" id="weather-modal-body"><div style="opacity:0.6;">Loading weather…</div></div>'
  );
  document.body.appendChild(overlay);
  overlay.focus();

  // Fetch weather for the default/first location
  _fetchWeatherForModal(address, label);
}

async function _fetchWeatherForModal(address, label) {
  var overlay = document.getElementById('weather-modal-overlay');
  if (!overlay) return;

  // Show loading in body — but if we have cached data, show it with stale indicator
  var bodyEl = document.getElementById('weather-modal-body');
  var cacheKey = 'cwoc_weather_cache_' + address.toLowerCase().trim();
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { /* ignore */ }

  if (cached && cached.html && bodyEl) {
    // Show cached data with hourglass stale indicator
    bodyEl.innerHTML = '<div style="text-align:right;font-size:0.75em;opacity:0.5;margin-bottom:4px;">⏳ Refreshing…</div>' + cached.html;
  } else if (bodyEl) {
    bodyEl.innerHTML = '<div style="opacity:0.6;">Loading weather…</div>';
  }

  try {
    // Geocode with shared progressive fallback
    var coords = await _geocodeAddress(address);
    var lat = coords.lat, lon = coords.lon;

    // Fetch weather
    var wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1';
    var wxResp = await fetch(wxUrl);
    if (!wxResp.ok) throw new Error('weather_network');
    var wxData = await wxResp.json();
    if (!wxData || !wxData.daily) throw new Error('weather_empty');

    var today = wxData.daily;
    var weatherCode = today.weathercode[0];
    var minC = today.temperature_2m_min[0];
    var maxC = today.temperature_2m_max[0];
    var precipMm = today.precipitation_sum[0];
    var windKmh = today.wind_speed_10m_max ? today.wind_speed_10m_max[0] : 0;
    var wind = _convertWind(windKmh);

    var minT = _convertTemp(minC);
    var maxT = _convertTemp(maxC);
    var tUnit = _tempUnit();

    var icon = _getWeatherIcon(weatherCode);
    var precipText = _formatPrecip(precipMm, weatherCode);
    var windText = wind.value >= (_isMetricUnits() ? 24 : 15) ? '💨 ' + wind.value + ' ' + wind.unit + ' wind' : '';

    var barR = _tempBarRange();
    var barMin = barR.barMin, barMax = barR.barMax, barRange = barMax - barMin;
    var lowPct = Math.max(0, Math.min(100, ((minT - barMin) / barRange) * 100));
    var highPct = Math.max(0, Math.min(100, ((maxT - barMin) / barRange) * 100));

    if (bodyEl) {
      var weatherHtml =
        '<div class="weather-modal-icon">' + icon + '</div>' +
        '<div class="weather-modal-temps"><span class="temp-high">' + maxT + tUnit + '</span> / <span class="temp-low">' + minT + tUnit + '</span></div>' +
        (precipText ? '<div class="weather-modal-precip">' + precipText + '</div>' : '') +
        (windText ? '<div class="weather-modal-precip" style="margin-top:2px;">' + windText + '</div>' : '') +
        '<div class="weather-modal-temp-bar"><div class="temp-bar-marker" style="left:' + lowPct + '%" title="Low ' + minT + tUnit + '"></div><div class="temp-bar-marker" style="left:' + highPct + '%" title="High ' + maxT + tUnit + '"></div></div>';
      bodyEl.innerHTML = weatherHtml;
      // Cache the result
      try { localStorage.setItem(cacheKey, JSON.stringify({ html: weatherHtml, ts: Date.now() })); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('Weather modal error:', err);
    var msg = 'Weather unavailable — try again later';
    if (err.message === 'Location not found.' || err.message === 'geocode_empty') msg = 'Could not find location: ' + address;
    else if (err.message === 'No address provided.') msg = 'No address provided';
    else if (err.message === 'geocode_network') msg = 'Could not reach location service';
    else if (err.message === 'weather_network') msg = 'Could not reach weather service';
    else if (err.message === 'weather_empty') msg = 'Weather data unavailable for ' + address;

    if (bodyEl) bodyEl.innerHTML = '<div class="weather-modal-error">' + msg + '</div>';
  }
}

function _closeWeatherModal() {
  const overlay = document.getElementById('weather-modal-overlay');
  if (overlay) overlay.remove();
}

/** Pre-fetch weather for a location and store in localStorage cache (background, no UI). */
async function _fetchWeatherForCache(address, cacheKey) {
  try {
    var coords = await _geocodeAddress(address);
    var lat = coords.lat, lon = coords.lon;
    var wxResp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1');
    if (!wxResp.ok) return;
    var wxData = await wxResp.json();
    if (!wxData || !wxData.daily) return;
    var today = wxData.daily;
    var weatherCode = today.weathercode[0];
    var minC = today.temperature_2m_min[0], maxC = today.temperature_2m_max[0], precipMm = today.precipitation_sum[0];
    var minT = _convertTemp(minC), maxT = _convertTemp(maxC);
    var tUnit = _tempUnit();
    var icon = _getWeatherIcon(weatherCode);
    var precipText = _formatPrecip(precipMm, weatherCode);
    var barR = _tempBarRange();
    var barMin = barR.barMin, barMax = barR.barMax, barRange = barMax - barMin;
    var lowPct = Math.max(0, Math.min(100, ((minT - barMin) / barRange) * 100));
    var highPct = Math.max(0, Math.min(100, ((maxT - barMin) / barRange) * 100));
    var html = '<div class="weather-modal-icon">' + icon + '</div><div class="weather-modal-temps"><span class="temp-high">' + maxT + tUnit + '</span> / <span class="temp-low">' + minT + tUnit + '</span></div>' + (precipText ? '<div class="weather-modal-precip">' + precipText + '</div>' : '') + '<div class="weather-modal-temp-bar"><div class="temp-bar-marker" style="left:' + lowPct + '%" title="Low ' + minT + tUnit + '"></div><div class="temp-bar-marker" style="left:' + highPct + '%" title="High ' + maxT + tUnit + '"></div></div>';
    try { localStorage.setItem(cacheKey, JSON.stringify({ html: html, ts: Date.now() })); } catch (e) { /* ignore */ }
  } catch (e) { /* background fetch — silently fail */ }
}

/** Pre-fetch weather for all chits that have locations. Deduplicates by location. */
function _prefetchChitWeather(chitList) {
  if (!chitList || !chitList.length) return;
  var seen = {};
  chitList.forEach(function(chit) {
    if (!chit.location || !chit.location.trim()) return;
    var key = chit.location.toLowerCase().trim();
    if (seen[key]) return;
    seen[key] = true;
    var cacheKey = 'cwoc_wx_' + key;
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && cached.icon && (Date.now() - cached.ts < 3600000)) return; // already cached
    } catch (e) {}
    // Queue a fetch with a dummy span (just to populate the cache)
    var dummy = document.createElement('span');
    _queueChitWeatherFetch(chit.location, dummy);
  });
}

/* ── Misc view helpers ───────────────────────────────────────────────────── */

function changeView() {
  storePreviousState();
  currentView = document.getElementById("period-select")?.value || currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
}

function toggleAllDay() {
  const allDay = document.getElementById("all_day").checked;
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  if (allDay) {
    startTime.dataset.previousValue = startTime.value;
    endTime.dataset.previousValue = endTime.value;
    startTime.style.display = "none";
    endTime.style.display = "none";
    startTime.value = "";
    endTime.value = "";
  } else {
    startTime.style.display = "";
    endTime.style.display = "";
    if (startTime.dataset.previousValue)
      startTime.value = startTime.dataset.previousValue;
    if (endTime.dataset.previousValue)
      endTime.value = endTime.dataset.previousValue;
  }
}

function setColor(color, name) {
  document.getElementById("color").value = color;
  document.getElementById("selected-color").textContent = name;
}

// _utcToLocalDate, _parseISOTime moved to shared.js

function _convertDBDateToDisplayDate(dateString) {
  if (!dateString) return "";
  const date = _utcToLocalDate(dateString);
  if (isNaN(date.getTime())) return "";
  return formatDate(date);
}

/* ── Legacy editor form population is in main.js coordinator ─────────────── */

async function deleteChit() {
  if (!chitId) {
    alert("No chit to delete.");
    return;
  }
  if (!(await cwocConfirm("Are you sure you want to delete this chit?", { title: 'Delete Chit', confirmLabel: '🗑️ Delete', danger: true }))) return;
  var delId = chitId;
  var chit = chits.find(function(c) { return c.id === delId; });
  var delTitle = (chit && chit.title) || "(Untitled)";
  fetch(`/api/chits/${delId}`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(() => {
      currentTab = previousState.tab;
      currentView = previousState.view;
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelector(
          `.tab:nth-child(${["Calendar", "Checklists", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
        )
        .classList.add("active");
      document.getElementById("period-select").value = currentView;
      fetchChits();
      _showDeleteUndoToast(delId, delTitle, null, function () {
        fetch("/api/trash/" + delId + "/restore", { method: "POST" })
          .then(function () { fetchChits(); })
          .catch(function (err) { console.error("Undo restore failed:", err); });
      });
    })
    .catch((err) => {
      console.error("Error deleting chit:", err);
      alert("Failed to delete chit. Check console for details.");
    });
}

function cancelEdit() {
  currentTab = previousState.tab;
  currentView = previousState.view;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(
      `.tab:nth-child(${["Calendar", "Checklists", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
    )
    .classList.add("active");
  document.getElementById("period-select").value = currentView;
  fetchChits();
}
