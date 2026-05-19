package com.cwoc.app.ui.components

import android.content.SharedPreferences
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Weather modal — quick peek at current weather conditions for a saved location.
 * Matches the web's _openWeatherModal() behavior:
 * - Location selector dropdown (from saved locations)
 * - Current conditions: icon, description, high/low temps, precipitation, wind
 * - "Full Forecast" button to navigate to weather screen
 * - Close button
 *
 * @param savedLocations JSON string of saved locations from settings
 * @param onDismiss Callback when modal is closed
 * @param onFullForecast Callback to navigate to the full weather screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeatherModal(
    savedLocations: String?,
    serverUrl: String,
    authToken: String,
    onDismiss: () -> Unit,
    onFullForecast: () -> Unit
) {
    val gson = remember { Gson() }
    val locations = remember(savedLocations) {
        if (savedLocations.isNullOrBlank()) emptyList()
        else try {
            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val list: List<Map<String, Any>> = gson.fromJson(savedLocations, type)
            list.mapNotNull { loc ->
                val label = (loc["label"] as? String) ?: (loc["name"] as? String) ?: return@mapNotNull null
                val address = (loc["address"] as? String) ?: label
                label to address
            }
        } catch (_: Exception) { emptyList() }
    }

    var selectedIndex by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var weatherData by remember { mutableStateOf<WeatherModalData?>(null) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    // Fetch weather for the selected location
    fun fetchWeather(address: String) {
        isLoading = true
        errorMsg = null
        coroutineScope.launch {
            val result = fetchWeatherData(serverUrl, authToken, address)
            weatherData = result.first
            errorMsg = result.second
            isLoading = false
        }
    }

    // Initial fetch
    LaunchedEffect(selectedIndex) {
        if (locations.isNotEmpty() && selectedIndex < locations.size) {
            fetchWeather(locations[selectedIndex].second)
        } else {
            isLoading = false
            errorMsg = "No saved locations configured."
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🌤️ Weather", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Location selector
                if (locations.size > 1) {
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = locations.getOrNull(selectedIndex)?.first ?: "",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            singleLine = true,
                            textStyle = MaterialTheme.typography.bodyMedium
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            locations.forEachIndexed { index, (label, _) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        selectedIndex = index
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                } else if (locations.size == 1) {
                    Text(
                        text = locations[0].first,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF6B4E31)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Weather content
                when {
                    isLoading -> {
                        CircularProgressIndicator(
                            modifier = Modifier.size(32.dp),
                            color = Color(0xFF6B4E31)
                        )
                    }
                    errorMsg != null -> {
                        Text(
                            text = errorMsg!!,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center
                        )
                    }
                    weatherData != null -> {
                        val data = weatherData!!
                        // Icon + description
                        Text(
                            text = "${data.icon} ${data.description}",
                            style = MaterialTheme.typography.headlineSmall,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        // Temps
                        Row(
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${data.tempLow}°",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color(0xFF1565C0)
                            )
                            Text(
                                text = " — ",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "${data.tempHigh}°",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color(0xFFC62828)
                            )
                        }
                        // Precipitation
                        if (data.precip > 0) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "${data.precipIcon} ${String.format("%.1f", data.precip)} mm",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        // Wind
                        if (data.wind > 0) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "💨 ${data.wind.toInt()} km/h",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onDismiss()
                onFullForecast()
            }) {
                Text("📊 Full Forecast", color = Color(0xFF6B4E31))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

// ─── Data Model ─────────────────────────────────────────────────────────────────

private data class WeatherModalData(
    val icon: String,
    val description: String,
    val tempHigh: Int,
    val tempLow: Int,
    val precip: Double,
    val precipIcon: String,
    val wind: Double
)

// ─── Weather Code → Icon (matches web _cwocGetWeatherIcon) ──────────────────────

private fun weatherCodeToIcon(code: Int): String = when (code) {
    0 -> "☀️"; 1 -> "🌤️"; 2 -> "⛅"; 3 -> "☁️"
    45, 48 -> "🌫️"
    51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82 -> "🌧️"
    71, 73, 75, 77, 85, 86 -> "🌨️"
    95, 96, 99 -> "⛈️"
    else -> "❓"
}

private fun weatherCodeToDescription(code: Int): String = when (code) {
    0 -> "Clear sky"; 1 -> "Mainly clear"; 2 -> "Partly cloudy"; 3 -> "Overcast"
    45, 48 -> "Foggy"
    51, 53, 55 -> "Drizzle"; 56, 57 -> "Freezing drizzle"
    61, 63, 65 -> "Rain"; 66, 67 -> "Freezing rain"
    71, 73, 75 -> "Snow"; 77 -> "Snow grains"
    80, 81, 82 -> "Rain showers"; 85, 86 -> "Snow showers"
    95 -> "Thunderstorm"; 96, 99 -> "Thunderstorm with hail"
    else -> "Unknown"
}

// ─── Fetch Weather Data ─────────────────────────────────────────────────────────

private suspend fun fetchWeatherData(
    serverUrl: String,
    authToken: String,
    address: String
): Pair<WeatherModalData?, String?> = withContext(Dispatchers.IO) {
    try {
        // Use the server's weather/forecasts endpoint or geocode + Open-Meteo directly
        val client = OkHttpClient()

        // First geocode the address via the server proxy
        val geoUrl = "$serverUrl/api/geocode?q=${java.net.URLEncoder.encode(address, "UTF-8")}"
        val geoRequest = Request.Builder()
            .url(geoUrl)
            .addHeader("Authorization", "Bearer $authToken")
            .get()
            .build()
        val geoResponse = client.newCall(geoRequest).execute()
        if (!geoResponse.isSuccessful) return@withContext null to "Geocoding failed"

        val geoBody = geoResponse.body?.string() ?: return@withContext null to "Empty geocode response"
        val gson = Gson()
        val geoResult: Map<String, Any> = gson.fromJson(geoBody, object : TypeToken<Map<String, Any>>() {}.type)
        val results = (geoResult["results"] as? List<*>) ?: return@withContext null to "No geocode results"
        if (results.isEmpty()) return@withContext null to "Location not found"

        val firstResult = results[0] as? Map<*, *> ?: return@withContext null to "Invalid geocode"
        val lat = (firstResult["lat"] as? Double) ?: return@withContext null to "No lat"
        val lon = (firstResult["lon"] as? Double) ?: return@withContext null to "No lon"

        // Fetch weather from Open-Meteo
        val wxUrl = "https://api.open-meteo.com/v1/forecast" +
            "?latitude=$lat&longitude=$lon" +
            "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
            "&timezone=auto&forecast_days=1"
        val wxRequest = Request.Builder().url(wxUrl).get().build()
        val wxResponse = client.newCall(wxRequest).execute()
        if (!wxResponse.isSuccessful) return@withContext null to "Weather API error"

        val wxBody = wxResponse.body?.string() ?: return@withContext null to "Empty weather response"
        val wxData: Map<String, Any> = gson.fromJson(wxBody, object : TypeToken<Map<String, Any>>() {}.type)
        val daily = wxData["daily"] as? Map<*, *> ?: return@withContext null to "Invalid weather data"

        val codes = (daily["weathercode"] as? List<*>)?.firstOrNull()
        val maxTemps = (daily["temperature_2m_max"] as? List<*>)?.firstOrNull()
        val minTemps = (daily["temperature_2m_min"] as? List<*>)?.firstOrNull()
        val precips = (daily["precipitation_sum"] as? List<*>)?.firstOrNull()
        val winds = (daily["wind_speed_10m_max"] as? List<*>)?.firstOrNull()

        val code = (codes as? Double)?.toInt() ?: 0
        val high = (maxTemps as? Double) ?: 0.0
        val low = (minTemps as? Double) ?: 0.0
        val precip = (precips as? Double) ?: 0.0
        val wind = (winds as? Double) ?: 0.0

        val isSnow = code in listOf(71, 73, 75, 77, 85, 86)

        WeatherModalData(
            icon = weatherCodeToIcon(code),
            description = weatherCodeToDescription(code),
            tempHigh = high.toInt(),
            tempLow = low.toInt(),
            precip = precip,
            precipIcon = if (isSnow) "❄️" else "💧",
            wind = wind
        ) to null
    } catch (e: Exception) {
        null to "Error: ${e.message}"
    }
}
