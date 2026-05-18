package com.cwoc.app.ui.screens.weather

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.CwocApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
 * Fetches weather forecasts from the server's /api/weather/forecasts endpoint
 * and exposes them as StateFlow for the UI to observe.
 *
 * Supports pull-to-refresh via the refresh() method.
 */
@HiltViewModel
class WeatherViewModel @Inject constructor(
    private val apiService: CwocApiService
) : ViewModel() {

    private val _forecasts = MutableStateFlow<List<LocationForecast>>(emptyList())
    val forecasts: StateFlow<List<LocationForecast>> = _forecasts.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    init {
        loadForecasts()
    }

    /**
     * Initial load of weather forecasts.
     * Shows loading state while fetching.
     */
    private fun loadForecasts() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchForecasts()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Pull-to-refresh: re-fetches forecasts without showing the full loading state.
     * Uses isRefreshing for the pull-to-refresh indicator.
     */
    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _error.value = null
            try {
                fetchForecasts()
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    /**
     * Fetches weather forecasts from the server and maps the response
     * into the UI model (List<LocationForecast>).
     */
    private suspend fun fetchForecasts() {
        try {
            val response = apiService.getWeatherForecasts()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    _forecasts.value = mapResponseToForecasts(body)
                    _error.value = null
                } else {
                    _error.value = "Empty response from server"
                }
            } else {
                _error.value = "Unable to load weather (${response.code()})"
            }
        } catch (e: Exception) {
            _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
        }
    }

    /**
     * Maps the server DTO response into the UI-friendly LocationForecast list.
     * Each location's daily arrays are zipped into individual DailyForecast objects.
     */
    private fun mapResponseToForecasts(response: WeatherForecastsResponse): List<LocationForecast> {
        return response.locations.mapNotNull { locationDto ->
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
    }
}
