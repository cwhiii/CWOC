package com.cwoc.app.ui.screens.weather

import android.content.SharedPreferences
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.WeatherForecastEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.repository.WeatherRepository
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

// ─── Data Models ────────────────────────────────────────────────────────────────

/**
 * A single day's forecast for a location.
 */
data class DailyForecast(
    val date: String,
    val tempHigh: Double?,
    val tempLow: Double?,
    val conditions: String,
    val precipChance: Double?,
    val windSpeed: Double?,
    val weatherCode: Int?
)

/**
 * Weather forecast for a single saved location.
 * Contains the location name and its daily forecasts.
 */
data class LocationForecast(
    val locationName: String,
    val address: String,
    val daily: List<DailyForecast>
)

/**
 * Represents the server response from /api/weather/forecasts.
 * Each location entry contains the Open-Meteo daily forecast data.
 */
data class WeatherForecastsResponse(
    val locations: List<LocationForecastDto>
)

/**
 * DTO for a single location's forecast from the server.
 */
data class LocationForecastDto(
    val label: String,
    val address: String?,
    val daily: DailyDataDto?
)

/**
 * DTO matching the Open-Meteo daily data structure.
 */
data class DailyDataDto(
    val time: List<String>?,
    val temperature_2m_max: List<Double?>?,
    val temperature_2m_min: List<Double?>?,
    val precipitation_sum: List<Double?>?,
    val weathercode: List<Int?>?,
    val wind_speed_10m_max: List<Double?>?
)

// ─── Weather Code Descriptions ──────────────────────────────────────────────────

/**
 * Maps WMO weather codes to human-readable condition strings.
 * Based on the Open-Meteo WMO Weather interpretation codes.
 */
private fun weatherCodeToCondition(code: Int?): String {
    return when (code) {
        0 -> "Clear sky"
        1 -> "Mainly clear"
        2 -> "Partly cloudy"
        3 -> "Overcast"
        45, 48 -> "Foggy"
        51, 53, 55 -> "Drizzle"
        56, 57 -> "Freezing drizzle"
        61, 63, 65 -> "Rain"
        66, 67 -> "Freezing rain"
        71, 73, 75 -> "Snow"
        77 -> "Snow grains"
        80, 81, 82 -> "Rain showers"
        85, 86 -> "Snow showers"
        95 -> "Thunderstorm"
        96, 99 -> "Thunderstorm with hail"
        else -> "Unknown"
    }
}

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Weather screen.
 * Fetches weather forecasts from the server's /api/weather/forecasts endpoint,
 * caches them in Room for offline access, and exposes them as StateFlow for the UI.
 *
 * On init: loads from Room cache immediately (instant display), then refreshes from server.
 * On pull-to-refresh: fetches from server and updates cache.
 * When offline: displays cached data with no error (unless cache is empty).
 */
@HiltViewModel
class WeatherViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val chitRepository: ChitRepository,
    private val weatherRepository: WeatherRepository,
    private val prefs: SharedPreferences,
    private val gson: Gson,
    private val okHttpClient: OkHttpClient
) : ViewModel() {

    private val _forecasts = MutableStateFlow<List<LocationForecast>>(emptyList())
    val forecasts: StateFlow<List<LocationForecast>> = _forecasts.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    // ─── Period Filter State ────────────────────────────────────────────────────

    private val _period = MutableStateFlow(WeatherPeriod.FORECAST_MAX)
    val period: StateFlow<WeatherPeriod> = _period.asStateFlow()

    private val _periodOffset = MutableStateFlow(0)
    val periodOffset: StateFlow<Int> = _periodOffset.asStateFlow()

    /** Custom days count for "X Days" period (from settings, default 7). */
    private val _customDays = MutableStateFlow(7)
    val customDays: StateFlow<Int> = _customDays.asStateFlow()

    /** Computed period label showing the current date range. */
    val periodLabel: StateFlow<String> = combine(_period, _periodOffset, _customDays) { period, offset, customDays ->
        computePeriodLabel(period, offset, customDays)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, "All 16 Days")

    // ─── Settings-Derived State ─────────────────────────────────────────────────

    /** Temperature unit from settings: "imperial" → Fahrenheit, else Celsius. */
    val tempUnit: StateFlow<String> = settingsRepository.settings
        .map { it.unitSystem ?: "metric" }
        .stateIn(viewModelScope, SharingStarted.Eagerly, "metric")

    /** Precipitation unit derived from unit system setting. */
    val precipUnit: StateFlow<String> = settingsRepository.settings
        .map { if ((it.unitSystem ?: "metric") == "imperial") "in" else "mm" }
        .stateIn(viewModelScope, SharingStarted.Eagerly, "mm")

    /** Week start day from settings (0=Sunday..6=Saturday). */
    val weekStartDay: StateFlow<Int> = settingsRepository.settings
        .map { (it.weekStartDay ?: "0").toIntOrNull() ?: 0 }
        .stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    // ─── Row Order (Persisted to SharedPreferences) ─────────────────────────────

    private val _rowOrder = MutableStateFlow<List<String>>(loadRowOrder())
    val rowOrder: StateFlow<List<String>> = _rowOrder.asStateFlow()

    // ─── Chit Event Highlighting ────────────────────────────────────────────────

    /** All non-deleted chits with location data, observed for event highlighting. */
    val chits: StateFlow<List<ChitEntity>> = chitRepository.getLocationChits()
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    // ─── City Rows for Non-Saved Locations ──────────────────────────────────

    /** Weather forecasts for cities derived from chit locations that don't match saved locations. */
    private val _cityForecasts = MutableStateFlow<List<LocationForecast>>(emptyList())
    val cityForecasts: StateFlow<List<LocationForecast>> = _cityForecasts.asStateFlow()

    /** Whether city forecasts are currently loading. */
    private val _cityLoading = MutableStateFlow(false)
    val cityLoading: StateFlow<Boolean> = _cityLoading.asStateFlow()

    init {
        loadFromCacheThenRefresh()
        loadCustomDays()
        observeChitsForCityRows()
    }

    /**
     * Load the custom days count from settings for the "X Days" period.
     */
    private fun loadCustomDays() {
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                settings.customDaysCount?.toIntOrNull()?.let { days ->
                    if (days > 0) _customDays.value = days
                }
            }
        }
    }

    /**
     * Initial load: read from Room cache immediately for instant display,
     * then refresh from the server in the background.
     */
    private fun loadFromCacheThenRefresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            // Step 1: Load from cache for instant display
            try {
                val cached = weatherRepository.getCachedForecasts()
                if (cached.isNotEmpty()) {
                    _forecasts.value = mapEntitiesToForecasts(cached)
                    Log.d(TAG, "Loaded ${cached.size} forecasts from cache")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load weather cache: ${e.message}")
            }

            // Step 2: Refresh from server in background
            try {
                val serverResponse = weatherRepository.refreshFromServer()
                if (serverResponse != null) {
                    _forecasts.value = mapResponseToForecasts(serverResponse)
                    _error.value = null
                } else if (_forecasts.value.isEmpty()) {
                    _error.value = "Unable to load weather"
                }
                // If server failed but we have cache, no error shown
            } catch (e: Exception) {
                if (_forecasts.value.isEmpty()) {
                    _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
                }
                Log.w(TAG, "Weather server refresh failed: ${e.message}")
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Pull-to-refresh: re-fetches from server and updates cache.
     * Uses isRefreshing for the pull-to-refresh indicator.
     */
    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _error.value = null
            try {
                val serverResponse = weatherRepository.refreshFromServer()
                if (serverResponse != null) {
                    _forecasts.value = mapResponseToForecasts(serverResponse)
                    _error.value = null
                } else if (_forecasts.value.isEmpty()) {
                    _error.value = "Unable to load weather"
                }
            } catch (e: Exception) {
                if (_forecasts.value.isEmpty()) {
                    _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
                }
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    /**
     * Maps cached Room entities into the UI-friendly LocationForecast list.
     * Deserializes the dailyJson field back into DailyDataDto and zips into DailyForecast objects.
     */
    private fun mapEntitiesToForecasts(entities: List<WeatherForecastEntity>): List<LocationForecast> {
        val result = entities.mapNotNull { entity ->
            val dailyDto = entity.dailyJson?.let {
                try {
                    gson.fromJson(it, DailyDataDto::class.java)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to parse cached daily JSON for '${entity.locationLabel}': ${e.message}")
                    null
                }
            } ?: return@mapNotNull null

            val dates = dailyDto.time ?: return@mapNotNull null
            if (dates.isEmpty()) return@mapNotNull null

            val dailyForecasts = dates.mapIndexed { index, date ->
                DailyForecast(
                    date = date,
                    tempHigh = dailyDto.temperature_2m_max?.getOrNull(index),
                    tempLow = dailyDto.temperature_2m_min?.getOrNull(index),
                    conditions = weatherCodeToCondition(dailyDto.weathercode?.getOrNull(index)),
                    precipChance = dailyDto.precipitation_sum?.getOrNull(index),
                    windSpeed = dailyDto.wind_speed_10m_max?.getOrNull(index),
                    weatherCode = dailyDto.weathercode?.getOrNull(index)
                )
            }

            LocationForecast(
                locationName = entity.locationLabel,
                address = entity.address ?: "",
                daily = dailyForecasts
            )
        }

        ensureRowOrderPopulated(result.map { it.locationName })
        return result
    }

    /**
     * Maps the server DTO response into the UI-friendly LocationForecast list.
     * Each location's daily arrays are zipped into individual DailyForecast objects.
     * Also ensures the row order list is populated with all location names.
     */
    private fun mapResponseToForecasts(response: WeatherForecastsResponse): List<LocationForecast> {
        val result = response.locations.mapNotNull { locationDto ->
            val daily = locationDto.daily ?: return@mapNotNull null
            val dates = daily.time ?: return@mapNotNull null
            if (dates.isEmpty()) return@mapNotNull null

            val dailyForecasts = dates.mapIndexed { index, date ->
                DailyForecast(
                    date = date,
                    tempHigh = daily.temperature_2m_max?.getOrNull(index),
                    tempLow = daily.temperature_2m_min?.getOrNull(index),
                    conditions = weatherCodeToCondition(daily.weathercode?.getOrNull(index)),
                    precipChance = daily.precipitation_sum?.getOrNull(index),
                    windSpeed = daily.wind_speed_10m_max?.getOrNull(index),
                    weatherCode = daily.weathercode?.getOrNull(index)
                )
            }

            LocationForecast(
                locationName = locationDto.label,
                address = locationDto.address ?: "",
                daily = dailyForecasts
            )
        }

        // Ensure row order is populated with all location names for drag-to-reorder.
        // Preserves existing order for known locations, appends new ones at the end.
        ensureRowOrderPopulated(result.map { it.locationName })

        return result
    }

    /**
     * Ensure the row order list contains all current location names.
     * Preserves existing saved order for known locations and appends any new ones.
     */
    private fun ensureRowOrderPopulated(locationNames: List<String>) {
        val current = _rowOrder.value
        val currentSet = current.toSet()
        val newNames = locationNames.filter { it !in currentSet }
        // Remove any names that no longer exist in the forecasts
        val validNames = current.filter { it in locationNames }
        if (newNames.isNotEmpty() || validNames.size != current.size) {
            _rowOrder.value = validNames + newNames
            saveRowOrder()
        }
    }

    // ─── Period Filter Methods ───────────────────────────────────────────────────

    /**
     * Set the weather period filter.
     * Resets offset to 0 when changing period type.
     */
    fun setPeriod(period: WeatherPeriod) {
        _period.value = period
        _periodOffset.value = 0
    }

    /**
     * Navigate to the next period (increment offset by 1).
     */
    fun nextPeriod() {
        _periodOffset.value += 1
    }

    /**
     * Navigate to the previous period (decrement offset by 1).
     */
    fun prevPeriod() {
        _periodOffset.value -= 1
    }

    // ─── Row Order Methods ──────────────────────────────────────────────────────

    /**
     * Reorder location rows by moving a row from one position to another.
     * Persists the new order immediately.
     *
     * @param fromIndex The current index of the row being moved
     * @param toIndex The target index where the row should be placed
     */
    fun reorderRows(fromIndex: Int, toIndex: Int) {
        val current = _rowOrder.value.toMutableList()
        if (fromIndex < 0 || fromIndex >= current.size) return
        if (toIndex < 0 || toIndex >= current.size) return
        val item = current.removeAt(fromIndex)
        current.add(toIndex, item)
        _rowOrder.value = current
        saveRowOrder()
    }

    /**
     * Persist the current row order to SharedPreferences.
     */
    fun saveRowOrder() {
        val json = gson.toJson(_rowOrder.value)
        prefs.edit().putString(PREF_KEY_ROW_ORDER, json).apply()
    }

    /**
     * Load the persisted row order from SharedPreferences.
     * Returns an empty list if no order has been saved yet.
     */
    private fun loadRowOrder(): List<String> {
        val json = prefs.getString(PREF_KEY_ROW_ORDER, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    // ─── Period Label Computation ───────────────────────────────────────────────

    /**
     * Compute the human-readable label for the current period and offset.
     * Matches the format used in MapViewModel's updatePeriodLabel().
     */
    private fun computePeriodLabel(period: WeatherPeriod, offset: Int, customDays: Int): String {
        val now = LocalDate.now()
        val months = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

        return when (period) {
            WeatherPeriod.FORECAST_MAX -> "All 16 Days"
            WeatherPeriod.ONE_HOUR -> "Next Hour"
            WeatherPeriod.DAY, WeatherPeriod.WORK_HOURS -> {
                val day = now.plusDays(offset.toLong())
                "${months[day.monthValue - 1]} ${day.dayOfMonth}"
            }
            WeatherPeriod.WEEK -> {
                val dayOfWeek = now.dayOfWeek.value % 7 // Sun=0..Sat=6
                val weekStart = now.minusDays(dayOfWeek.toLong()).plusWeeks(offset.toLong())
                val weekEnd = weekStart.plusDays(6)
                "${months[weekStart.monthValue - 1]} ${weekStart.dayOfMonth} — ${months[weekEnd.monthValue - 1]} ${weekEnd.dayOfMonth}"
            }
            WeatherPeriod.X_DAYS -> {
                val days = customDays.coerceIn(1, 16)
                val startDay = now.plusDays((offset * days).toLong())
                val endDay = startDay.plusDays(days.toLong() - 1)
                "${months[startDay.monthValue - 1]} ${startDay.dayOfMonth} — ${months[endDay.monthValue - 1]} ${endDay.dayOfMonth} (${days}d)"
            }
            WeatherPeriod.MONTH -> {
                val monthStart = now.withDayOfMonth(1).plusMonths(offset.toLong())
                "${months[monthStart.monthValue - 1]} ${monthStart.year}"
            }
            WeatherPeriod.YEAR -> {
                "${now.year + offset}"
            }
        }
    }

    companion object {
        private const val PREF_KEY_ROW_ORDER = "weather_row_order"
        private const val TAG = "WeatherVM"
    }

    // ─── City Rows: Non-Saved Location Weather ──────────────────────────────────

    /**
     * Observe chits and forecasts to identify non-saved locations and fetch their weather.
     * When forecasts load and chits have locations that don't match any saved location,
     * geocode those locations and fetch weather from Open-Meteo.
     */
    private fun observeChitsForCityRows() {
        viewModelScope.launch {
            // Combine forecasts and chits — when both are available, compute city rows
            combine(_forecasts, chits) { forecasts, chitList ->
                Pair(forecasts, chitList)
            }.collect { (forecasts, chitList) ->
                if (forecasts.isNotEmpty() && chitList.isNotEmpty()) {
                    computeCityForecasts(forecasts, chitList)
                }
            }
        }
    }

    /**
     * Identify chit locations that don't match any saved location, extract city names,
     * geocode them, and fetch 16-day weather forecasts from Open-Meteo.
     */
    private suspend fun computeCityForecasts(
        savedForecasts: List<LocationForecast>,
        chitList: List<ChitEntity>
    ) {
        // Build set of saved location keys (case-insensitive) for exclusion
        val savedKeys = mutableSetOf<String>()
        for (loc in savedForecasts) {
            val addr = loc.address.lowercase().trim()
            val label = loc.locationName.lowercase().trim()
            if (addr.isNotEmpty()) savedKeys.add(addr)
            if (label.isNotEmpty()) savedKeys.add(label)
        }

        // Get all available forecast dates from saved forecasts
        val forecastDates = savedForecasts.firstOrNull()?.daily?.map { it.date }?.toSet() ?: emptySet()
        if (forecastDates.isEmpty()) return

        // Group chits by city (non-saved locations only)
        val cityGroups = mutableMapOf<String, CityGroup>() // cityKey → CityGroup

        for (chit in chitList) {
            if (chit.deleted) continue
            val loc = (chit.location ?: "").trim()
            if (loc.isEmpty()) continue

            // Skip if this location matches a saved location
            if (savedKeys.contains(loc.lowercase())) continue

            // Extract dates from this chit that fall within forecast range
            val chitDates = mutableSetOf<String>()
            val dateFields = listOf(chit.startDatetime, chit.endDatetime, chit.dueDatetime)
            for (field in dateFields) {
                if (field != null && field.length >= 10) {
                    val dateOnly = field.substring(0, 10)
                    if (dateOnly.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && forecastDates.contains(dateOnly)) {
                        chitDates.add(dateOnly)
                    }
                }
            }

            // Expand multi-day range
            if (chit.startDatetime != null && chit.endDatetime != null &&
                chit.startDatetime.length >= 10 && chit.endDatetime.length >= 10
            ) {
                try {
                    val startDate = LocalDate.parse(chit.startDatetime.substring(0, 10), DateTimeFormatter.ISO_LOCAL_DATE)
                    val endDate = LocalDate.parse(chit.endDatetime.substring(0, 10), DateTimeFormatter.ISO_LOCAL_DATE)
                    var cur = startDate
                    while (!cur.isAfter(endDate)) {
                        val ds = cur.format(DateTimeFormatter.ISO_LOCAL_DATE)
                        if (forecastDates.contains(ds)) chitDates.add(ds)
                        cur = cur.plusDays(1)
                    }
                } catch (_: Exception) { /* skip invalid ranges */ }
            }

            if (chitDates.isEmpty()) continue

            val city = extractCity(loc) ?: continue
            val cityKey = city.lowercase()

            cityGroups.getOrPut(cityKey) {
                CityGroup(displayName = city, dates = mutableSetOf())
            }.dates.addAll(chitDates)
        }

        if (cityGroups.isEmpty()) {
            _cityForecasts.value = emptyList()
            return
        }

        // Fetch weather for each city
        _cityLoading.value = true
        val cityForecastList = mutableListOf<LocationForecast>()

        for ((_, cityGroup) in cityGroups) {
            try {
                val forecast = fetchCityWeather(cityGroup.displayName)
                if (forecast != null) {
                    cityForecastList.add(forecast)
                }
            } catch (e: Exception) {
                Log.w(TAG, "City weather fetch failed for '${cityGroup.displayName}': ${e.message}")
            }
        }

        _cityForecasts.value = cityForecastList
        _cityLoading.value = false
    }

    /**
     * Geocode a city name and fetch its 16-day weather forecast from Open-Meteo.
     * Returns a LocationForecast or null on failure.
     */
    private suspend fun fetchCityWeather(cityName: String): LocationForecast? = withContext(Dispatchers.IO) {
        try {
            // Geocode via Nominatim
            val encoded = URLEncoder.encode(cityName, "UTF-8")
            val geoUrl = "https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=1"
            val geoRequest = Request.Builder()
                .url(geoUrl)
                .addHeader("User-Agent", "CWOC-Android/1.0")
                .get()
                .build()
            val geoResponse = okHttpClient.newCall(geoRequest).execute()
            if (!geoResponse.isSuccessful) return@withContext null

            val geoBody = geoResponse.body?.string() ?: return@withContext null
            val geoArray: List<Map<String, Any>> = gson.fromJson(
                geoBody,
                object : TypeToken<List<Map<String, Any>>>() {}.type
            ) ?: return@withContext null
            if (geoArray.isEmpty()) return@withContext null

            val lat = (geoArray[0]["lat"] as? String)?.toDoubleOrNull()
                ?: (geoArray[0]["lat"] as? Double)
                ?: return@withContext null
            val lon = (geoArray[0]["lon"] as? String)?.toDoubleOrNull()
                ?: (geoArray[0]["lon"] as? Double)
                ?: return@withContext null

            // Rate limit: small delay between geocode and weather fetch
            kotlinx.coroutines.delay(200)

            // Fetch 16-day forecast from Open-Meteo
            val wxUrl = "https://api.open-meteo.com/v1/forecast" +
                "?latitude=$lat&longitude=$lon" +
                "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
                "&timezone=auto&forecast_days=16"
            val wxRequest = Request.Builder().url(wxUrl).get().build()
            val wxResponse = okHttpClient.newCall(wxRequest).execute()
            if (!wxResponse.isSuccessful) return@withContext null

            val wxBody = wxResponse.body?.string() ?: return@withContext null
            val wxData: Map<String, Any> = gson.fromJson(
                wxBody,
                object : TypeToken<Map<String, Any>>() {}.type
            ) ?: return@withContext null

            @Suppress("UNCHECKED_CAST")
            val daily = wxData["daily"] as? Map<String, Any> ?: return@withContext null
            @Suppress("UNCHECKED_CAST")
            val times = daily["time"] as? List<String> ?: return@withContext null
            @Suppress("UNCHECKED_CAST")
            val maxTemps = daily["temperature_2m_max"] as? List<Double?>
            @Suppress("UNCHECKED_CAST")
            val minTemps = daily["temperature_2m_min"] as? List<Double?>
            @Suppress("UNCHECKED_CAST")
            val precipSums = daily["precipitation_sum"] as? List<Double?>
            @Suppress("UNCHECKED_CAST")
            val weatherCodes = daily["weathercode"] as? List<Double?>
            @Suppress("UNCHECKED_CAST")
            val windSpeeds = daily["wind_speed_10m_max"] as? List<Double?>

            val dailyForecasts = times.mapIndexed { index, date ->
                DailyForecast(
                    date = date,
                    tempHigh = maxTemps?.getOrNull(index),
                    tempLow = minTemps?.getOrNull(index),
                    conditions = weatherCodeToCondition(weatherCodes?.getOrNull(index)?.toInt()),
                    precipChance = precipSums?.getOrNull(index),
                    windSpeed = windSpeeds?.getOrNull(index),
                    weatherCode = weatherCodes?.getOrNull(index)?.toInt()
                )
            }

            LocationForecast(
                locationName = "📍 $cityName",
                address = "from chits",
                daily = dailyForecasts
            )
        } catch (e: Exception) {
            Log.w(TAG, "fetchCityWeather failed for '$cityName': ${e.message}")
            null
        }
    }

    /**
     * Extract a city name from a full address string.
     * Matches the web's _wxExtractCity logic:
     * - Tries "City, ST ZIP" or "City, ST" pattern
     * - Falls back to last comma-separated segment before any zip code
     */
    private fun extractCity(address: String): String? {
        if (address.isBlank()) return null
        val cleaned = address.trim()

        // Try "City, ST ZIP" or "City, ST"
        val pattern = Regex("([A-Za-z\\s.'-]+),\\s*([A-Z]{2})\\s*(\\d{5})?")
        val match = pattern.find(cleaned)
        if (match != null) {
            return "${match.groupValues[1].trim()}, ${match.groupValues[2]}"
        }

        // Try last two comma segments
        val parts = cleaned.split(",").map { it.trim() }
        if (parts.size >= 2) {
            val last = parts.last().replace(Regex("\\d{5}(-\\d{4})?"), "").trim()
            val secondLast = parts[parts.size - 2].trim()
            if (last.length in 1..3) {
                return "$secondLast, $last"
            }
            return secondLast
        }

        return cleaned
    }

    /**
     * Internal data class for grouping chit dates by city.
     */
    private data class CityGroup(
        val displayName: String,
        val dates: MutableSet<String>
    )
}
