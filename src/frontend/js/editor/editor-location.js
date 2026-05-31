/**
 * editor-location.js — Location zone: multiple locations, geocoding, map, weather
 *
 * Handles multiple locations per chit with labels, primary location designation,
 * geocoding addresses, fetching and displaying weather data, rendering OpenStreetMap
 * embeds, managing saved location dropdowns, and opening maps/directions in new tabs.
 *
 * Depends on: shared.js (_geocodeAddress, setSaveButtonUnsaved, loadSavedLocations,
 *             getDefaultLocation), editor.js (weatherIcons, currentWeatherLat/Lon/Data)
 * Loaded before: editor-init.js, editor.js
 */

// Global state for multiple locations
window._chitLocations = [];  // Array of location objects
window._locationIdCounter = 0;  // For generating temporary IDs

// ── Location Entry Management ─────────────────────────────────────────────

/**
 * Initialize the locations list from chit data on load.
 * Called from editor-init.js after chit data is loaded.
 */
async function _initLocationsFromChit() {
    const locationInput = document.getElementById('location');
    const locationsList = document.getElementById('locations-list');
    if (!locationsList) return;

    // Clear existing entries
    locationsList.innerHTML = '';
    window._chitLocations = [];
    window._locationIdCounter = 0;

    // Check if chit has new locations array format
    const existingLocations = window._chitData?.locations;
    const existingLocationStr = window._chitData?.location;  // Legacy single location

    if (existingLocations && Array.isArray(existingLocations) && existingLocations.length > 0) {
        // Use new locations array
        for (const loc of existingLocations) {
            await _addLocationEntry({
                address: loc.address || '',
                label: loc.label || null,
                lat: loc.lat || null,
                lon: loc.lon || null,
                is_primary: loc.is_primary || false
            });
        }
    } else if (existingLocationStr && existingLocationStr.trim()) {
        // Migrate legacy single location to new format
        await _addLocationEntry({
            address: existingLocationStr.trim(),
            label: null,
            lat: null,
            lon: null,
            is_primary: true
        });
    } else {
        // Show empty state
        _renderLocationsEmptyState();
    }

    // Load saved locations dropdown
    await loadSavedLocationsDropdown();
}

/**
 * Add a new location entry to the list.
 * @param {Object} initialData - Optional initial data {address, label, lat, lon, is_primary}
 */
async function _addLocationEntry(initialData = {}) {
    const locationsList = document.getElementById('locations-list');
    if (!locationsList) return;

    // Remove empty state if present
    const emptyState = locationsList.querySelector('.locations-empty');
    if (emptyState) emptyState.remove();

    const entryId = 'loc-' + (++window._locationIdCounter);
    const isFirst = window._chitLocations.length === 0;

    // If this is marked as primary, unmark others
    if (initialData.is_primary) {
        window._chitLocations.forEach(loc => loc.is_primary = false);
    }

    // If first entry, make it primary by default
    const shouldBePrimary = initialData.is_primary || isFirst;

    const locationObj = {
        id: entryId,
        address: initialData.address || '',
        label: initialData.label || '',
        lat: initialData.lat || null,
        lon: initialData.lon || null,
        is_primary: shouldBePrimary
    };

    window._chitLocations.push(locationObj);

    const entryEl = document.createElement('div');
    entryEl.className = 'location-entry' + (shouldBePrimary ? ' primary' : '');
    entryEl.id = entryId;
    entryEl.dataset.entryId = entryId;

    entryEl.innerHTML = `
        <div class="location-entry-header">
            <label class="location-primary-toggle" title="Primary location used for weather and map">
                <input type="radio" name="primary-location" ${shouldBePrimary ? 'checked' : ''}
                       onchange="_setPrimaryLocation('${entryId}')">
                <span class="primary-star" style="visibility: ${shouldBePrimary ? 'visible' : 'hidden'}">★</span>
                <span>Primary</span>
            </label>
            <div class="location-entry-actions">
                <button type="button" onclick="_geocodeLocation('${entryId}')" title="Geocode address">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button type="button" onclick="_openLocationMap('${entryId}')" title="Open map">
                    <i class="fas fa-external-link-alt"></i>
                </button>
                <button type="button" onclick="_openLocationDirections('${entryId}')" title="Directions">
                    <i class="fas fa-directions"></i>
                </button>
                <button type="button" class="delete-btn" onclick="_deleteLocationEntry('${entryId}')" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="field full-width">
            <input type="text" class="location-label-input" placeholder="Label (e.g., Home, Office)"
                   value="${_escapeHtml(locationObj.label || '')}"
                   oninput="_onLocationLabelChange('${entryId}', this.value)">
        </div>
        <div class="field full-width" style="margin-bottom: 0">
            <input type="text" class="location-address-input" placeholder="Address (e.g., 123 Main St, City, State)"
                   value="${_escapeHtml(locationObj.address || '')}"
                   oninput="_onLocationAddressChange('${entryId}', this.value)">
        </div>
        <div class="location-entry-loading" id="${entryId}-loading" style="display:none;">Loading...</div>
        <div class="location-entry-error" id="${entryId}-error" style="display:none;"></div>
        <div class="location-entry-map" id="${entryId}-map" style="display:none;"></div>
    `;

    locationsList.appendChild(entryEl);

    // If we have coordinates, show the map
    if (locationObj.lat && locationObj.lon) {
        _displayMapInLocationEntry(entryId, locationObj.lat, locationObj.lon, locationObj.address);
    }

    // If this is the primary location and has an address, fetch weather
    if (shouldBePrimary && locationObj.address) {
        _fetchWeatherForPrimary();
    }

    setSaveButtonUnsaved();
}

/**
 * Render empty state when no locations exist.
 */
function _renderLocationsEmptyState() {
    const locationsList = document.getElementById('locations-list');
    if (!locationsList) return;

    locationsList.innerHTML = `
        <div class="locations-empty">
            No locations yet. Add one using the dropdown above or the + Add button.
        </div>
    `;
}

/**
 * Delete a location entry.
 */
function _deleteLocationEntry(entryId) {
    const entryEl = document.getElementById(entryId);
    if (!entryEl) return;

    const index = window._chitLocations.findIndex(loc => loc.id === entryId);
    if (index === -1) return;

    const wasPrimary = window._chitLocations[index].is_primary;
    window._chitLocations.splice(index, 1);
    entryEl.remove();

    // If deleted was primary, make the first remaining entry primary
    if (wasPrimary && window._chitLocations.length > 0) {
        _setPrimaryLocation(window._chitLocations[0].id);
    }

    // Show empty state if no locations left
    if (window._chitLocations.length === 0) {
        _renderLocationsEmptyState();
        // Clear weather section
        _clearWeatherDisplay();
    } else if (wasPrimary) {
        // Fetch weather for new primary
        _fetchWeatherForPrimary();
    }

    setSaveButtonUnsaved();
}

/**
 * Set a location as primary (only one can be primary).
 */
function _setPrimaryLocation(entryId) {
    // Unmark all others
    window._chitLocations.forEach(loc => {
        loc.is_primary = false;
    });

    // Mark this one as primary
    const loc = window._chitLocations.find(l => l.id === entryId);
    if (loc) {
        loc.is_primary = true;
    }

    // Update UI
    document.querySelectorAll('.location-entry').forEach(el => {
        el.classList.remove('primary');
        const radio = el.querySelector('input[type="radio"]');
        const star = el.querySelector('.primary-star');
        if (el.id === entryId) {
            el.classList.add('primary');
            if (radio) radio.checked = true;
            if (star) star.style.visibility = 'visible';
        } else {
            if (radio) radio.checked = false;
            if (star) star.style.visibility = 'hidden';
        }
    });

    // Fetch weather for new primary
    if (loc && loc.address) {
        _fetchWeatherForPrimary();
    } else {
        _clearWeatherDisplay();
    }

    setSaveButtonUnsaved();
}

/**
 * Handle label input change.
 */
function _onLocationLabelChange(entryId, value) {
    const loc = window._chitLocations.find(l => l.id === entryId);
    if (loc) {
        loc.label = value;
        setSaveButtonUnsaved();
    }
}

/**
 * Handle address input change.
 */
function _onLocationAddressChange(entryId, value) {
    const loc = window._chitLocations.find(l => l.id === entryId);
    if (loc) {
        loc.address = value;
        loc.lat = null;
        loc.lon = null;

        // Hide map and clear coordinates display
        const mapEl = document.getElementById(entryId + '-map');
        const errorEl = document.getElementById(entryId + '-error');
        if (mapEl) mapEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }

        // If this is primary, clear weather
        if (loc.is_primary) {
            _clearWeatherDisplay();
        }

        setSaveButtonUnsaved();
    }
}

// ── Geocoding ─────────────────────────────────────────────────────────────

/**
 * Geocode a location entry's address.
 */
async function _geocodeLocation(entryId) {
    const loc = window._chitLocations.find(l => l.id === entryId);
    if (!loc || !loc.address.trim()) {
        cwocToast('Please enter an address first', 'error');
        return;
    }

    const loadingEl = document.getElementById(entryId + '-loading');
    const errorEl = document.getElementById(entryId + '-error');
    const mapEl = document.getElementById(entryId + '-map');

    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (mapEl) mapEl.style.display = 'none';

    try {
        const coords = await _geocodeAddress(loc.address.trim());
        loc.lat = coords.lat;
        loc.lon = coords.lon;

        if (loadingEl) loadingEl.style.display = 'none';

        // Display map
        _displayMapInLocationEntry(entryId, coords.lat, coords.lon, loc.address);

        // Check timezone if this is primary
        if (loc.is_primary) {
            _checkLocationTimezone(coords.lat, coords.lon, coords.country_code);
        }

        setSaveButtonUnsaved();
    } catch (error) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.textContent = error.message || 'Geocoding failed';
            errorEl.style.display = 'block';
        }
    }
}

/**
 * Display map in a location entry.
 */
function _displayMapInLocationEntry(entryId, lat, lon, address) {
    const mapEl = document.getElementById(entryId + '-map');
    if (!mapEl) return;

    mapEl.style.display = 'block';
    mapEl.innerHTML = `
        <iframe
            width="100%"
            height="100%"
            frameborder="0"
            scrolling="no"
            marginheight="0"
            marginwidth="0"
            src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}"
            style="border: 1px solid black; border-radius: 4px;">
        </iframe>
    `;
}

// ── Weather (Primary Location Only) ───────────────────────────────────────

/**
 * Fetch weather for the primary location.
 */
async function _fetchWeatherForPrimary() {
    const primaryLoc = window._chitLocations.find(l => l.is_primary);
    if (!primaryLoc || !primaryLoc.address) {
        _clearWeatherDisplay();
        return;
    }

    // Check if we have coordinates
    if (!primaryLoc.lat || !primaryLoc.lon) {
        // Try to geocode first
        try {
            const coords = await _geocodeAddress(primaryLoc.address.trim());
            primaryLoc.lat = coords.lat;
            primaryLoc.lon = coords.lon;
        } catch (e) {
            // Geocoding failed, can't get weather
            return;
        }
    }

    // Fetch weather data
    try {
        await _fetchWeatherData(primaryLoc.address.trim());
    } catch (e) {
        // Weather fetch failed, that's okay
    }
}

/**
 * Clear the weather display section.
 */
function _clearWeatherDisplay() {
    const compactWeatherSection = document.getElementById("compactWeatherSection");
    if (compactWeatherSection) {
        compactWeatherSection.classList.add('weather-placeholder');
        const hasDate = !!(document.getElementById("start_datetime")?.value || document.getElementById("due_datetime")?.value || document.getElementById("point_in_time_date")?.value);
        if (hasDate) {
            compactWeatherSection.innerHTML = '<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Add a primary location for weather</div>';
        } else {
            compactWeatherSection.innerHTML = '<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">🗓️ Date &amp; primary location needed for weather 📍</div>';
        }
    }
    window._currentChitWeatherData = null;
    currentWeatherLat = null;
    currentWeatherLon = null;
    currentWeatherData = null;
}

// ── Actions for Individual Locations ─────────────────────────────────────

/**
 * Open map in new tab for a location entry.
 */
function _openLocationMap(entryId) {
    const loc = window._chitLocations.find(l => l.id === entryId);
    if (!loc || !loc.address.trim()) {
        cwocToast('Please enter an address first', 'error');
        return;
    }
    const q = encodeURIComponent(loc.address.trim());
    const co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
    if (co.prefer_google_maps) {
        window.open("https://www.google.com/maps/search/?api=1&query=" + q, "_blank", "noopener");
    } else {
        window.open("https://www.openstreetmap.org/search?query=" + q, "_blank");
    }
}

/**
 * Open directions for a location entry.
 */
function _openLocationDirections(entryId) {
    const loc = window._chitLocations.find(l => l.id === entryId);
    if (!loc || !loc.address) {
        cwocToast('Please enter a destination first', 'error');
        return;
    }
    const co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
    const destination = loc.address.trim();
    const destEnc = encodeURIComponent(destination);

    if (co.prefer_google_maps) {
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

    // OpenStreetMap
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

// ── Saved Locations Dropdown ─────────────────────────────────────────────

/**
 * Populate the saved-locations dropdown.
 */
async function loadSavedLocationsDropdown() {
    var locations = await loadSavedLocations();
    var dropdown = document.getElementById('saved-locations-dropdown');
    if (!dropdown) return;

    // Remove all options except the first
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }

    var currentSection = null;

    locations.forEach(function (loc) {
        if (loc.section) {
            var group = document.createElement('optgroup');
            group.label = loc.section;
            dropdown.appendChild(group);
            currentSection = loc.section;
        } else {
            var opt = document.createElement('option');
            opt.value = JSON.stringify({address: loc.address || '', label: loc.label || null});
            opt.textContent = loc.label || loc.address || '(unnamed)';

            if (currentSection) {
                var groups = dropdown.querySelectorAll('optgroup');
                if (groups.length > 0) {
                    groups[groups.length - 1].appendChild(opt);
                    return;
                }
            }
            dropdown.appendChild(opt);
        }
    });

    dropdown.onchange = onSavedLocationSelect;
}

/**
 * Handle selection from saved locations dropdown.
 */
function onSavedLocationSelect() {
    var dropdown = document.getElementById('saved-locations-dropdown');
    if (!dropdown) return;

    var selectedValue = dropdown.value;
    if (!selectedValue) {
        dropdown.selectedIndex = 0;
        return;
    }

    try {
        var locData = JSON.parse(selectedValue);
        _addLocationEntry({
            address: locData.address || '',
            label: locData.label || null,
            is_primary: window._chitLocations.length === 0  // First location is primary
        });
    } catch (e) {
        console.error('Error parsing saved location:', e);
    }

    dropdown.selectedIndex = 0;
}

// ── View in Context (Maps page with all locations) ────────────────────────

/**
 * Navigate to maps page showing all chit locations.
 */
function _viewLocationsInContext(event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }

    if (window._chitLocations.length === 0) {
        cwocToast('No locations to view', 'error');
        return;
    }

    // Build addresses parameter
    var addresses = window._chitLocations.map(function(loc) {
        return encodeURIComponent(loc.address);
    }).join(',');

    var url = '/frontend/html/maps.html?focus=chit&addresses=' + addresses;

    if (window._cwocSave && window._cwocSave.hasChanges()) {
        cwocConfirm("You have unsaved changes. Leave without saving?", { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }).then(function(ok) {
            if (ok) window.location.href = url;
        });
    } else {
        window.location.href = url;
    }
}

// ── Legacy Compatibility Functions (for existing code references) ─────────

/**
 * Legacy: Get primary location address (for backward compatibility).
 */
function _getPrimaryLocationAddress() {
    const primary = window._chitLocations.find(l => l.is_primary);
    return primary ? primary.address : '';
}

/**
 * Legacy: Clear all locations (for backward compatibility).
 */
function _clearAllLocations() {
    const locationsList = document.getElementById('locations-list');
    if (locationsList) {
        locationsList.innerHTML = '';
    }
    window._chitLocations = [];
    _renderLocationsEmptyState();
    _clearWeatherDisplay();
    setSaveButtonUnsaved();
}

// ── Utility Functions ─────────────────────────────────────────────────────

/**
 * Escape HTML to prevent XSS.
 */
function _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Weather Functions (from original editor-location.js) ───────────────────

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

function _displayWeatherInCompactSection(weatherData, address) {
    const compactWeatherSection = document.getElementById("compactWeatherSection");
    if (!compactWeatherSection) {
        console.warn("compactWeatherSection not found");
        return;
    }
    compactWeatherSection.classList.remove('weather-placeholder');
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
        const precipAmt = _editorFormatPrecipAmount(precipMm);
        const descWithPrecip = precipAmt ? fullDescription + ', ' + precipAmt : fullDescription;

        const barRange = _tempBarRange();
        const barMin = barRange.barMin;
        const barMax = barRange.barMax;
        const range = barMax - barMin;
        const startPct = ((min - barMin) / range) * 100;
        const endPct = ((max - barMin) / range) * 100;

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

        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.textContent = "🔄";
        refreshBtn.title = "Refresh weather";
        refreshBtn.style.cssText = "position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;font-size:1em;opacity:0.5;padding:2px;";
        refreshBtn.onmouseenter = () => { refreshBtn.style.opacity = '1'; };
        refreshBtn.onmouseleave = () => { refreshBtn.style.opacity = '0.5'; };
        refreshBtn.onclick = () => {
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

function _editorFormatPrecipAmount(precipMm) {
    if (!precipMm || precipMm <= 0) return '';
    var cm = Math.round(precipMm / 10);
    if (cm < 1) return '<1cm';
    return cm + 'cm';
}

// ── Legacy Functions (kept for backward compatibility) ───────────────────

// These functions are kept but may not be used in the new multi-location UI

function _getCoordinates(address) {
    return _geocodeAddress(address);
}

function _checkLocationTimezone(lat, lon, countryCode) {
    if (!countryCode) return;
    var detectedTz = _detectTimezoneFromCoords(lat, lon, countryCode);
    if (!detectedTz) return;
    if (window._chitTimezone) return;
    try {
        getCurrentTimezone().then(currentTz => {
            if (detectedTz !== currentTz) {
                _showTimezoneSuggestion(detectedTz);
            }
        });
    } catch (e) { }
}

function _refreshWeatherOnDateChange() {
    const primaryAddr = _getPrimaryLocationAddress();
    if (!primaryAddr.trim()) {
        const cws = document.getElementById("compactWeatherSection");
        if (cws) {
            cws.classList.add('weather-placeholder');
            cws.innerHTML = '<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">🗓️ Add a date for weather</div>';
        }
        return;
    }
    _fetchWeatherData(primaryAddr.trim()).catch(() => {});
}

function searchLocationMap(event) {
    const primaryAddr = _getPrimaryLocationAddress();
    if (!primaryAddr.trim()) {
        cwocToast("Please enter a location first.", "error");
        return;
    }
    // For legacy compatibility - opens first location in new tab
    _openLocationMap(window._chitLocations[0]?.id);
}

function openLocationInNewTab(event) {
    const primaryAddr = _getPrimaryLocationAddress();
    if (!primaryAddr.trim()) return;
    const q = encodeURIComponent(primaryAddr.trim());
    const co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
    if (co.prefer_google_maps) {
        window.open("https://www.google.com/maps/search/?api=1&query=" + q, "_blank", "noopener");
    } else {
        window.open("https://www.openstreetmap.org/search?query=" + q, "_blank");
    }
}

function openLocationDirections(event) {
    const primaryAddr = _getPrimaryLocationAddress();
    if (!primaryAddr) {
        cwocToast("Please enter a destination first.", "error");
        return;
    }
    const co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
    const destination = primaryAddr.trim();
    const destEnc = encodeURIComponent(destination);

    if (co.prefer_google_maps) {
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

function _viewLocationInContext(event) {
    _viewLocationsInContext(event);
}

function _updateViewInContextBtn() {
    // New UI doesn't use this - locations list handles its own actions
}

function _locationAddClearToggle(event) {
    // Legacy function - not used in new multi-location UI
}