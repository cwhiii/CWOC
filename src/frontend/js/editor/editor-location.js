/**
 * editor-location.js — Location zone: geocoding, map, weather, saved locations
 *
 * Handles geocoding addresses, fetching and displaying weather data in the
 * compact section, rendering OpenStreetMap embeds, managing saved location
 * dropdowns (both zone and compact), and opening maps/directions in new tabs.
 *
 * Depends on: shared.js (_geocodeAddress, setSaveButtonUnsaved, loadSavedLocations,
 *             getDefaultLocation), editor.js (weatherIcons, currentWeatherLat/Lon/Data)
 * Loaded before: editor-init.js, editor.js
 */

// _getCoordinates: delegate to shared _geocodeAddress (in shared.js)
async function _getCoordinates(address) {
  return _geocodeAddress(address);
}

async function _fetchWeatherData(address) {
  const compactWeatherSection = document.getElementById("compactWeatherSection");
  const cacheKey = 'cwoc_weather_editor_' + address.toLowerCase().trim();

  // Show cached weather immediately with stale indicator while we refresh
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && cached.weather && compactWeatherSection) {
      _displayWeatherInCompactSection(cached.weather, address);
      const existing = compactWeatherSection.querySelector('.weather-stale-badge');
      if (!existing) {
        const badge = document.createElement('span');
        badge.className = 'weather-stale-badge';
        badge.style.cssText = 'position:absolute;top:2px;right:6px;font-size:0.75em;opacity:0.5;';
        badge.textContent = '⏳';
        badge.title = 'Refreshing weather…';
        compactWeatherSection.style.position = 'relative';
        compactWeatherSection.appendChild(badge);
      }
    }
  } catch (e) { /* no cache, that's fine */ }

  try {
    // Determine the chit's target date from date fields
    let targetDate = '';
    const startVal = document.getElementById('start_datetime')?.value;
    const dueVal = document.getElementById('due_datetime')?.value;
    const pitVal = document.getElementById('point_in_time_date')?.value;
    if (startVal) {
      try { targetDate = new Date(convertMonthFormat(startVal) + 'T12:00:00').toISOString().split('T')[0]; } catch (e) { /* skip */ }
    }
    if (!targetDate && dueVal) {
      try { targetDate = new Date(convertMonthFormat(dueVal) + 'T12:00:00').toISOString().split('T')[0]; } catch (e) { /* skip */ }
    }
    if (!targetDate && pitVal) {
      try { targetDate = new Date(convertMonthFormat(pitVal) + 'T12:00:00').toISOString().split('T')[0]; } catch (e) { /* skip */ }
    }

    // Use the shared weather function
    var options = targetDate ? { targetDate: targetDate } : undefined;
    var wx = await getWeatherForLocation(address, options);
    if (!wx) throw new Error('Weather data unavailable');

    // Also fetch raw data for _displayWeatherInCompactSection (needs the daily object)
    var coords = await _getCoordinates(address);
    currentWeatherLat = coords.lat;
    currentWeatherLon = coords.lon;

    // Build a weather object compatible with _displayWeatherInCompactSection
    var weather = { daily: {
      weathercode: [wx.weatherCode],
      temperature_2m_max: [wx.maxC],
      temperature_2m_min: [wx.minC],
      precipitation_sum: [wx.precipMm],
      wind_speed_10m_max: [wx.wind ? wx.wind.value : 0],
      wind_gusts_10m_max: [wx.wind ? wx.wind.value : 0],
      time: [targetDate || new Date().toISOString().split('T')[0]]
    }};
    currentWeatherData = weather;

    _displayWeatherInCompactSection(weather, address);

    // Update weather_data in memory for save payload
    window._currentChitWeatherData = {
      focus_date: targetDate || new Date().toISOString().split('T')[0],
      updated_time: new Date().toISOString(),
      high: wx.maxC,
      low: wx.minC,
      precipitation: wx.precipMm,
      weather_code: wx.weatherCode,
      wind_gusts: wx.wind ? wx.wind.value : null,
      wind_speed: wx.wind ? wx.wind.value : null
    };

    // Cache the result
    try { localStorage.setItem(cacheKey, JSON.stringify({ weather, ts: Date.now() })); } catch (e) { /* ignore */ }

    // Remove stale badge
    if (compactWeatherSection) {
      const badge = compactWeatherSection.querySelector('.weather-stale-badge');
      if (badge) badge.remove();
    }

    return weather;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    if (compactWeatherSection) {
      const badge = compactWeatherSection.querySelector('.weather-stale-badge');
      if (badge) badge.remove();
    }
    const hadCache = compactWeatherSection && compactWeatherSection.querySelector('.compact-day-header');
    if (!hadCache && compactWeatherSection) {
      compactWeatherSection.classList.add('weather-placeholder');
      const msg = error.message === "Location not found."
        ? `Location not found: ${address}`
        : error.message === "No address provided."
          ? "No address provided"
          : `Weather data unavailable for ${address}`;
      compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:Lora, Georgia, serif;color:#a33;font-size:0.85em;">⚠️ ${msg}</div>`;
    }
    throw error;
  }
}

// _getPrecipType — now in shared-utils.js as _cwocGetPrecipType
// _editorFormatPrecip — now in shared-utils.js as _cwocFormatPrecip

/** Format precipitation amount only (no type word) for merged display. */
function _editorFormatPrecipAmount(precipMm) {
  if (!precipMm || precipMm <= 0) return '';
  var cm = Math.round(precipMm / 10);
  if (cm < 1) return '<1cm';
  return cm + 'cm';
}

function _displayWeatherInCompactSection(weatherData, address) {
  const compactWeatherSection = document.getElementById(
    "compactWeatherSection",
  );
  if (!compactWeatherSection) {
    console.warn("compactWeatherSection not found");
    return;
  }
  compactWeatherSection.classList.remove('weather-placeholder');
  // Force visibility for mobile zone mode
  compactWeatherSection.style.setProperty('display', 'flex', 'important');

  if (weatherData && weatherData.daily) {
    const today = weatherData.daily;
    const weatherCode = today.weathercode[0];
    const minC = today.temperature_2m_min[0];
    const maxC = today.temperature_2m_max[0];
    const precipMm = today.precipitation_sum[0];
    const windGustsKmh = today.wind_gusts_10m_max ? today.wind_gusts_10m_max[0] : null;

    const min = _convertTemp(minC);
    const max = _convertTemp(maxC);

    const icon = weatherIcons[weatherCode] || "❓";
    const fullDescription = _getWeatherDescription(weatherCode, minC, maxC, windGustsKmh);
    // Merge precip amount into description line (no separate badge)
    const precipAmt = _editorFormatPrecipAmount(precipMm);
    const descWithPrecip = precipAmt ? fullDescription + ', ' + precipAmt : fullDescription;

    const barRange = _tempBarRange();
    const barMin = barRange.barMin;
    const barMax = barRange.barMax;
    const range = barMax - barMin;
    const startPct = ((min - barMin) / range) * 100;
    const endPct = ((max - barMin) / range) * 100;

    // Use the shared temperature gradient
    const gradientStyle = _buildTempGradient();

    const lowAlt = _tempAltUnit(minC);
    const highAlt = _tempAltUnit(maxC);
    const precipAlt = precipMm > 0 ? _precipAlt(precipMm) : '';

    compactWeatherSection.innerHTML = `
    <div class="compact-day-header">
    <span class="compact-icon">${icon}</span>
    <span class="compact-description"${precipAlt ? ` title="${precipAlt}"` : ''}>${descWithPrecip}</span>
    <div class="compact-temperature-track" style="background:${gradientStyle};">
    <div class="compact-temperature-mask" style="left:0%; width:${startPct}%;"></div>
    <div class="compact-temperature-fill" style="left:${startPct}%; width:${endPct - startPct}%;"></div>
    <div class="compact-temperature-mask" style="right:0%; width:${100 - endPct}%;"></div>
    <div class="compact-temp-callout compact-low" style="left:${startPct}%;" title="${lowAlt}">${min}º</div>
    <div class="compact-temp-callout compact-high" style="left:${endPct}%;" title="${highAlt}">${max}º</div>
    ${[...Array(Math.floor((barMax - barMin) / 10) + 1)]
      .map((_, index) => {
        const temp = barMin + index * 10;
        const position = ((temp - barMin) / range) * 100;
        return `<div class="compact-temperature-line" style="left: ${position}%;"></div><div class="compact-temperature-label" style="left: ${position}%">${temp}º</div>`;
      })
      .join("")}
    </div>
    </div>
    `;

    // Add refresh button
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.textContent = "🔄";
    refreshBtn.title = "Refresh weather";
    refreshBtn.style.cssText = "position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;font-size:1em;opacity:0.5;padding:2px;";
    refreshBtn.onmouseenter = () => { refreshBtn.style.opacity = '1'; };
    refreshBtn.onmouseleave = () => { refreshBtn.style.opacity = '0.5'; };
    refreshBtn.onclick = () => {
      // Clear cache and re-fetch
      const cacheKey = 'cwoc_weather_editor_' + address.toLowerCase().trim();
      localStorage.removeItem(cacheKey);
      _fetchWeatherData(address);
    };
    compactWeatherSection.style.position = 'relative';
    compactWeatherSection.appendChild(refreshBtn);
  } else {
    compactWeatherSection.innerHTML = `
    <div style="padding: 10px; font-family: 'Lora', Georgia, serif; color: #3e2b2b;">
    <strong>Weather data unavailable for ${address}</strong>
    </div>
    `;
  }
}

function _displayMapInUI(lat, lon, address) {
  const locationSection = document.getElementById("locationSection");
  if (!locationSection) return;

  let mapDisplay = document.getElementById("map-display");
  if (!mapDisplay) {
    mapDisplay = document.createElement("div");
    mapDisplay.id = "map-display";
    mapDisplay.style.cssText =
      "margin-top: 10px; width: 100%; height: 200px; border: 1px solid #ccc; border-radius: 5px;";
    const locationInput = document.getElementById("location");
    if (locationInput && locationInput.parentNode) {
      locationInput.parentNode.insertBefore(
        mapDisplay,
        locationInput.nextSibling,
      );
    } else {
      locationSection.appendChild(mapDisplay);
    }
  }

  mapDisplay.innerHTML = `
    <iframe
    width="100%"
    height="200"
    frameborder="0"
    scrolling="no"
    marginheight="0"
    marginwidth="0"
    src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}"
    style="border: 1px solid black; border-radius: 5px;">
    </iframe>
    <br/>
    <small>
    <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}" target="_blank">
    View Larger Map
    </a>
    </small>
  `;
}

// ── Saved Locations helpers ───────────────────────────────────────────────────

/**
 * Populate the #saved-locations-dropdown from cached saved locations.
 * Called during editor init and can be re-called to refresh.
 */
async function loadSavedLocationsDropdown() {
  var locations = await loadSavedLocations();
  var dropdown = document.getElementById('saved-locations-dropdown');
  if (!dropdown) return;

  // Remove all options except the first null option
  while (dropdown.options.length > 1) {
    dropdown.remove(1);
  }

  locations.forEach(function (loc) {
    var opt = document.createElement('option');
    opt.value = loc.address || '';
    opt.textContent = loc.label || loc.address || '(unnamed)';
    dropdown.appendChild(opt);
  });

  // Attach onchange handler (remove previous to avoid duplicates)
  dropdown.onchange = onSavedLocationSelect;
}

/**
 * Handle selection from the saved-locations dropdown.
 * Populates the location input and triggers weather/map fetch.
 */
function onSavedLocationSelect() {
  var dropdown = document.getElementById('saved-locations-dropdown');
  if (!dropdown) return;
  var address = dropdown.value;
  var locationInput = document.getElementById('location');
  if (!locationInput) return;

  if (!address) {
    // Null option selected — clear the field
    locationInput.value = '';
    _updateViewInContextBtn();
    return;
  }

  locationInput.value = address;
  _updateViewInContextBtn();
  setSaveButtonUnsaved();
  searchLocationMap();
}

/**
 * "+Location" button handler — populate from default saved location.
 */
function onAddDefaultLocation(event) {
  if (event) event.stopPropagation();
  var defaultLoc = getDefaultLocation();
  if (!defaultLoc) {
    cwocToast('No default location set — configure in Settings', 'error');
    return;
  }
  var locationInput = document.getElementById('location');
  if (locationInput) {
    locationInput.value = defaultLoc.address || '';
    _updateViewInContextBtn();
    setSaveButtonUnsaved();
    searchLocationMap();
  }
}

/**
 * Clear location input, map display, and weather section.
 */
function onClearLocation(event) {
  if (event) event.stopPropagation();
  var locationInput = document.getElementById('location');
  if (locationInput) locationInput.value = '';

  var mapDisplay = document.getElementById('location-map');
  if (mapDisplay) mapDisplay.innerHTML = '';

  // Also clear the dynamic map-display iframe if present
  var mapEmbed = document.getElementById('map-display');
  if (mapEmbed) mapEmbed.innerHTML = '';

  var compactWeather = document.getElementById('compactWeatherSection');
  if (compactWeather) {
    compactWeather.classList.add('weather-placeholder');
    var hasDate = !!(document.getElementById("start_datetime")?.value || document.getElementById("due_datetime")?.value || document.getElementById("point_in_time_date")?.value);
    if (hasDate) {
      compactWeather.innerHTML = '<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Add a location for weather</div>';
    } else {
      compactWeather.innerHTML = '<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">🗓️ Date &amp; location needed for weather 📍</div>';
    }
  }

  var dropdown = document.getElementById('saved-locations-dropdown');
  if (dropdown) dropdown.value = '';

  // Also reset compact dropdown
  var compactDropdown = document.getElementById('compact-location-dropdown');
  if (compactDropdown) compactDropdown.selectedIndex = 0;

  _updateViewInContextBtn();
  setSaveButtonUnsaved();
}

// ── Compact location dropdown (title/weather area) ───────────────────────────

/**
 * Populate the #compact-location-dropdown from cached saved locations.
 * Called during editor init alongside loadSavedLocationsDropdown().
 */
async function loadCompactLocationDropdown() {
  var locations = await loadSavedLocations();
  var dropdown = document.getElementById('compact-location-dropdown');
  if (!dropdown) return;

  // Remove all options except the first label option
  while (dropdown.options.length > 1) {
    dropdown.remove(1);
  }

  if (!locations || locations.length === 0) {
    var noOpt = document.createElement('option');
    noOpt.value = '';
    noOpt.textContent = 'No saved locations';
    noOpt.disabled = true;
    dropdown.appendChild(noOpt);
  } else {
    locations.forEach(function (loc) {
      var opt = document.createElement('option');
      opt.value = loc.address || '';
      opt.textContent = loc.label || loc.address || '(unnamed)';
      dropdown.appendChild(opt);
    });
  }

  dropdown.onchange = onCompactLocationSelect;
}

/**
 * Handle selection from the compact location dropdown.
 * Populates the location input and triggers weather/map fetch.
 */
function onCompactLocationSelect() {
  var dropdown = document.getElementById('compact-location-dropdown');
  if (!dropdown) return;
  var address = dropdown.value;
  if (!address) {
    // Reset to label — no action
    dropdown.selectedIndex = 0;
    return;
  }

  var locationInput = document.getElementById('location');
  if (locationInput) {
    locationInput.value = address;
    _updateViewInContextBtn();
    setSaveButtonUnsaved();
    searchLocationMap();
  }

  // Sync the Location zone dropdown if present
  var zoneDropdown = document.getElementById('saved-locations-dropdown');
  if (zoneDropdown) {
    for (var i = 0; i < zoneDropdown.options.length; i++) {
      if (zoneDropdown.options[i].value === address) {
        zoneDropdown.selectedIndex = i;
        break;
      }
    }
  }

  // Reset compact dropdown back to the label
  dropdown.selectedIndex = 0;
}

/**
 * Re-fetch weather when a date field changes (if location is set).
 * Called from Flatpickr onChange handlers.
 */
function _refreshWeatherOnDateChange() {
  const locationInput = document.getElementById("location");
  if (!locationInput || !locationInput.value.trim()) return;
  const hasDate = !!(document.getElementById("start_datetime")?.value || document.getElementById("due_datetime")?.value || document.getElementById("point_in_time_date")?.value);
  if (!hasDate) {
    const cws = document.getElementById("compactWeatherSection");
    if (cws) {
      cws.classList.add('weather-placeholder');
      cws.innerHTML = '<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">🗓️ Add a date for weather</div>';
    }
    return;
  }
  _fetchWeatherData(locationInput.value.trim()).catch(() => {});
}

function searchLocationMap(event) {
  const locationInput = document.getElementById("location");
  if (!locationInput || !locationInput.value.trim()) {
    cwocToast("Please enter a location first.", "error");
    return;
  }

  const address = locationInput.value.trim();
  const hasDate = !!(document.getElementById("start_datetime")?.value || document.getElementById("due_datetime")?.value || document.getElementById("point_in_time_date")?.value);

  if (!hasDate) {
    const cws = document.getElementById("compactWeatherSection");
    if (cws) {
      cws.classList.add('weather-placeholder');
      cws.innerHTML = `<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">🗓️ Add a date for weather</div>`;
    }
    // Still show the map
    _getCoordinates(address).then((coords) => {
      _displayMapInUI(coords.lat, coords.lon, address);
    }).catch(() => {});
    return;
  }

  _fetchWeatherData(address)
    .then((weatherData) => {
      if (currentWeatherLat && currentWeatherLon) {
        _displayMapInUI(currentWeatherLat, currentWeatherLon, address);
      }
    })
    .catch((error) => {
      console.error("Error fetching location data:", error);
      cwocToast('Error fetching location data: ' + error.message, 'error');
    });
}

function openLocationInNewTab(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  const loc = document.getElementById("location");
  if (!loc || !loc.value.trim()) return;
  const q = encodeURIComponent(loc.value.trim());
  const co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
  if (co.prefer_google_maps) {
    window.open("https://www.google.com/maps/search/?api=1&query=" + q, "_blank", "noopener");
  } else {
    window.open("https://www.openstreetmap.org/search?query=" + q, "_blank");
  }
}

function openLocationDirections(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  const loc = document.getElementById("location");
  if (!loc || !loc.value) {
    cwocToast("Please enter a destination first.", "error");
    return;
  }
  const co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
  const destination = loc.value.trim();
  const destEnc = encodeURIComponent(destination);

  if (co.prefer_google_maps) {
    // Google Maps directions — try geolocation for origin
    if (window.isSecureContext && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.open("https://www.google.com/maps/dir/" + pos.coords.latitude + "," + pos.coords.longitude + "/" + destEnc, "_blank", "noopener");
        },
        () => {
          window.open("https://www.google.com/maps/dir//" + destEnc, "_blank", "noopener");
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    } else {
      window.open("https://www.google.com/maps/dir//" + destEnc, "_blank", "noopener");
    }
    return;
  }

  // Default: OpenStreetMap directions
  if (!window.isSecureContext || !navigator.geolocation) {
    window.open("https://www.openstreetmap.org/directions?to=" + destEnc, "_blank");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      window.open(
        "https://www.openstreetmap.org/directions?from=" + position.coords.latitude + "," + position.coords.longitude + "&to=" + destEnc,
        "_blank",
      );
    },
    () => {
      window.open("https://www.openstreetmap.org/directions?to=" + destEnc, "_blank");
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
  );
}

// ── View in Context (Maps page) ──────────────────────────────────────────────

/**
 * _viewLocationInContext(event) — Navigates to the maps page with focus and
 * address query parameters so the map centers on the chit's location.
 * Only works when the location input has a value.
 */
function _viewLocationInContext(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  var loc = document.getElementById('location');
  if (!loc || !loc.value.trim()) return;
  var address = loc.value.trim();
  var url = '/frontend/html/maps.html?focus=chit&address=' + encodeURIComponent(address);
  if (window._cwocSave && window._cwocSave.hasChanges()) {
    cwocConfirm("You have unsaved changes. Leave without saving?", { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }).then(function(ok) {
      if (ok) window.location.href = url;
    });
  } else {
    window.location.href = url;
  }
}

/**
 * _updateViewInContextBtn() — Shows or hides the "View in Context" button
 * based on whether the location input has a value.
 */
function _updateViewInContextBtn() {
  var loc = document.getElementById('location');
  var hasLocation = loc && loc.value.trim();
  var show = hasLocation ? '' : 'none';
  var btn = document.getElementById('viewInContextBtn');
  if (btn) btn.style.display = show;
  var searchBtn = document.getElementById('locationSearchBtn');
  if (searchBtn) searchBtn.style.display = show;
  var mapBtn = document.getElementById('locationMapBtn');
  if (mapBtn) mapBtn.style.display = show;
  var dirBtn = document.getElementById('locationDirectionsBtn');
  if (dirBtn) dirBtn.style.display = show;
  // Toggle +Location / ✕ Clear button
  var addClearBtn = document.getElementById('locationAddClearBtn');
  if (addClearBtn) {
    if (hasLocation) {
      addClearBtn.innerHTML = '<i class="fas fa-times"></i><span class="hideWhenNarrow">Clear</span>';
      addClearBtn.title = 'Clear location';
    } else {
      addClearBtn.innerHTML = '<i class="fas fa-plus"></i><span class="hideWhenNarrow">Location</span>';
      addClearBtn.title = 'Populate from default saved location';
    }
  }
}

/**
 * +Location / Clear toggle handler.
 */
function _locationAddClearToggle(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  var loc = document.getElementById('location');
  if (loc && loc.value.trim()) {
    onClearLocation(event);
  } else {
    onAddDefaultLocation(event);
  }
}
