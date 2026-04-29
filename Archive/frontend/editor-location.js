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

async function _getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function _fetchWeatherData(address) {
  const compactWeatherSection = document.getElementById("compactWeatherSection");
  const cacheKey = 'cwoc_weather_editor_' + address.toLowerCase().trim();

  // Show cached weather immediately with stale indicator while we refresh
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && cached.weather && compactWeatherSection) {
      _displayWeatherInCompactSection(cached.weather, address);
      // Add stale indicator overlay
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
    const coords = await _getCoordinates(address);
    const weather = await _getWeather(coords.lat, coords.lon);

    currentWeatherLat = coords.lat;
    currentWeatherLon = coords.lon;
    currentWeatherData = weather;

    _displayWeatherInCompactSection(weather, address);

    // Update weather_data in memory for save payload (6.2)
    if (weather && weather.daily) {
      const today = weather.daily;
      // Derive focus_date from the chit's earliest date field
      let focusDate = '';
      const startVal = document.getElementById('start_datetime')?.value;
      const dueVal = document.getElementById('due_datetime')?.value;
      if (startVal) {
        try { focusDate = new Date(convertMonthFormat(startVal) + 'T12:00:00').toISOString().split('T')[0]; } catch (e) { /* skip */ }
      }
      if (!focusDate && dueVal) {
        try { focusDate = new Date(convertMonthFormat(dueVal) + 'T12:00:00').toISOString().split('T')[0]; } catch (e) { /* skip */ }
      }
      window._currentChitWeatherData = {
        focus_date: focusDate || new Date().toISOString().split('T')[0],
        updated_time: new Date().toISOString(),
        high: today.temperature_2m_max[0],
        low: today.temperature_2m_min[0],
        precipitation: today.precipitation_sum[0],
        weather_code: today.weathercode[0]
      };
    }

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
    // Remove stale badge on error too
    if (compactWeatherSection) {
      const badge = compactWeatherSection.querySelector('.weather-stale-badge');
      if (badge) badge.remove();
    }
    // Only show error if we didn't already show cached data
    const hadCache = compactWeatherSection && compactWeatherSection.querySelector('.compact-day-header');
    if (!hadCache && compactWeatherSection) {
      compactWeatherSection.classList.add('weather-placeholder');
      const msg = error.message === "Location not found."
        ? `Location not found: ${address}`
        : error.message === "No address provided."
          ? "No address provided"
          : `Weather data unavailable for ${address}`;
      compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#a33;font-size:0.85em;">⚠️ ${msg}</div>`;
    }
    throw error;
  }
}

function _getPrecipType(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunder";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  return "";
}

/** Format precipitation: nearest cm with type. Sub-0.5cm = just the type word. No precip = empty. */
function _editorFormatPrecip(precipMm, weatherCode) {
  if (!precipMm || precipMm <= 0) return '';
  var pType = _getPrecipType(weatherCode);
  if (!pType) pType = 'precip';
  var cm = Math.round(precipMm / 10);
  if (cm < 1) return pType;
  return cm + 'cm ' + pType;
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

  if (weatherData && weatherData.daily) {
    const today = weatherData.daily;
    const weatherCode = today.weathercode[0];
    const minC = today.temperature_2m_min[0];
    const maxC = today.temperature_2m_max[0];
    const precipMm = today.precipitation_sum[0];

    const min = Math.round((minC * 9) / 5 + 32);
    const max = Math.round((maxC * 9) / 5 + 32);

    const icon = weatherIcons[weatherCode] || "❓";
    const precip = _editorFormatPrecip(precipMm, weatherCode);

    const d = new Date();
    const formattedDate = `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getFullYear()}-${d.toLocaleDateString("en-US", { month: "short" })}-${String(d.getDate()).padStart(2, "0")}`;

    const barMin = -14;
    const barMax = 104;
    const range = barMax - barMin;
    const startPct = ((min - barMin) / range) * 100;
    const endPct = ((max - barMin) / range) * 100;

    compactWeatherSection.innerHTML = `
    <div class="compact-day-header">
    <span class="compact-icon">${icon}</span>
    <span class="compact-date">${formattedDate}</span>
    <div class="compact-temperatures">
    <div class="compact-high">${max}º</div>
    <div class="compact-low">${min}º</div>
    </div>
    <div class="compact-precip">${precip}</div>
    <div class="compact-temperature-track">
    <div class="compact-temperature-mask" style="left:0%; width:${startPct}%;"></div>
    <div class="compact-temperature-fill" style="left:${startPct}%; width:${endPct - startPct}%;"></div>
    <div class="compact-temperature-mask" style="right:0%; width:${100 - endPct}%;"></div>
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
    <div style="padding: 10px; font-family: 'Courier New', Courier, monospace; color: #3e2b2b;">
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
    return;
  }

  locationInput.value = address;
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
    alert('No default location set — configure in Settings');
    return;
  }
  var locationInput = document.getElementById('location');
  if (locationInput) {
    locationInput.value = defaultLoc.address || '';
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
    compactWeather.innerHTML = '📍 Date & location needed for weather';
  }

  var dropdown = document.getElementById('saved-locations-dropdown');
  if (dropdown) dropdown.value = '';

  // Also reset compact dropdown
  var compactDropdown = document.getElementById('compact-location-dropdown');
  if (compactDropdown) compactDropdown.selectedIndex = 0;

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

function searchLocationMap(event) {
  const locationInput = document.getElementById("location");
  if (!locationInput || !locationInput.value.trim()) {
    alert("Please enter a location first.");
    return;
  }

  const address = locationInput.value.trim();
  const hasDate = !!(document.getElementById("start_datetime")?.value || document.getElementById("due_datetime")?.value);

  if (!hasDate) {
    const cws = document.getElementById("compactWeatherSection");
    if (cws) {
      cws.classList.add('weather-placeholder');
      cws.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📅 Add a date for weather</div>`;
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
      alert(`Error fetching location data: ${error.message}`);
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
    alert("Please enter a destination first.");
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
