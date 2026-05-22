package com.cwoc.app.widget.weather

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ListView
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.cwoc.app.R
import com.cwoc.app.widget.config.BaseWidgetConfigActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Configuration activity for the Weather Widget.
 * Allows the user to select a saved location or enter a custom location
 * (geocoded via Nominatim) for weather display.
 */
class WeatherWidgetConfigActivity : BaseWidgetConfigActivity() {

    private lateinit var savedLocationsList: ListView
    private lateinit var savedLocationsLabel: TextView
    private lateinit var customLocationInput: EditText
    private lateinit var geocodeButton: Button
    private lateinit var geocodeError: TextView
    private lateinit var confirmButton: Button
    private lateinit var cancelButton: Button

    // Parsed saved locations: list of (label, address, lat, lon)
    private data class SavedLocation(
        val label: String,
        val address: String,
        val lat: Double?,
        val lon: Double?
    )

    private var savedLocations: List<SavedLocation> = emptyList()

    // Currently selected/geocoded location data
    private var selectedLabel: String? = null
    private var selectedLat: Double? = null
    private var selectedLon: Double? = null
    private var isLocationValid = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_weather_config)

        // Bind views
        savedLocationsList = findViewById(R.id.saved_locations_list)
        savedLocationsLabel = findViewById(R.id.saved_locations_label)
        customLocationInput = findViewById(R.id.custom_location_input)
        geocodeButton = findViewById(R.id.geocode_button)
        geocodeError = findViewById(R.id.geocode_error)
        confirmButton = findViewById(R.id.confirm_button)
        cancelButton = findViewById(R.id.cancel_button)

        // Confirm button starts disabled until a valid location is selected
        confirmButton.isEnabled = false

        // Cancel button
        cancelButton.setOnClickListener { cancelConfig() }

        // Confirm button — save config and finish
        confirmButton.setOnClickListener {
            if (isLocationValid && selectedLat != null && selectedLon != null && selectedLabel != null) {
                saveConfig("weather_location_$appWidgetId", "$selectedLat,$selectedLon")
                saveConfig("weather_lat_$appWidgetId", selectedLat.toString())
                saveConfig("weather_lon_$appWidgetId", selectedLon.toString())
                saveConfig("weather_label_$appWidgetId", selectedLabel!!)
                finishWithResult()
            }
        }

        // Geocode button — resolve custom location via Nominatim
        geocodeButton.setOnClickListener {
            val query = customLocationInput.text.toString().trim()
            if (query.isNotBlank()) {
                geocodeLocation(query)
            }
        }

        // Load saved locations from Room
        loadSavedLocations()
    }

    /**
     * Load saved locations from the Room settings table.
     * Parses the savedLocations JSON field.
     */
    private fun loadSavedLocations() {
        lifecycleScope.launch(Dispatchers.IO) {
            val locations = try {
                val db = androidx.room.Room.databaseBuilder(
                    applicationContext,
                    com.cwoc.app.data.local.CwocDatabase::class.java,
                    "cwoc.db"
                )
                    .addMigrations(
                        com.cwoc.app.data.local.migration.MIGRATION_1_2,
                        com.cwoc.app.data.local.migration.MIGRATION_2_3,
                        com.cwoc.app.data.local.migration.MIGRATION_3_4,
                        com.cwoc.app.data.local.migration.MIGRATION_4_5,
                        com.cwoc.app.data.local.migration.MIGRATION_5_6,
                        com.cwoc.app.data.local.migration.MIGRATION_6_7,
                        com.cwoc.app.data.local.migration.MIGRATION_7_8,
                        com.cwoc.app.data.local.migration.MIGRATION_8_9
                    )
                    .build()

                val settings = db.settingsDao().get()
                db.close()

                parseSavedLocations(settings?.savedLocations)
            } catch (_: Exception) {
                emptyList()
            }

            withContext(Dispatchers.Main) {
                savedLocations = locations
                displaySavedLocations()
            }
        }
    }

    /**
     * Parse the savedLocations JSON string into a list of SavedLocation objects.
     * Format: [{"label": "Home", "address": "123 Main St", "is_default": true}, ...]
     */
    private fun parseSavedLocations(json: String?): List<SavedLocation> {
        if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()
        return try {
            val array = JSONArray(json)
            val result = mutableListOf<SavedLocation>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val label = obj.optString("label", "").ifBlank {
                    obj.optString("name", "")
                }
                val address = obj.optString("address", "").ifBlank { label }
                if (label.isBlank() && address.isBlank()) continue

                // Parse lat/lon — check multiple field name variants (matching MapViewModel)
                val lat = when {
                    obj.has("lat") -> obj.optDouble("lat", Double.NaN)
                    obj.has("latitude") -> obj.optDouble("latitude", Double.NaN)
                    else -> Double.NaN
                }
                val lon = when {
                    obj.has("lon") -> obj.optDouble("lon", Double.NaN)
                    obj.has("lng") -> obj.optDouble("lng", Double.NaN)
                    obj.has("longitude") -> obj.optDouble("longitude", Double.NaN)
                    else -> Double.NaN
                }

                result.add(
                    SavedLocation(
                        label = label.ifBlank { address },
                        address = address.ifBlank { label },
                        lat = if (lat.isNaN()) null else lat,
                        lon = if (lon.isNaN()) null else lon
                    )
                )
            }
            result
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Display saved locations in the ListView, or hide the section if none exist.
     */
    private fun displaySavedLocations() {
        if (savedLocations.isEmpty()) {
            // Hide saved locations section, show only custom entry
            savedLocationsList.visibility = View.GONE
            savedLocationsLabel.visibility = View.GONE
        } else {
            savedLocationsList.visibility = View.VISIBLE
            savedLocationsLabel.visibility = View.VISIBLE

            val labels = savedLocations.map { loc ->
                if (loc.label != loc.address && loc.address.isNotBlank()) {
                    "${loc.label} — ${loc.address}"
                } else {
                    loc.label
                }
            }

            val adapter = ArrayAdapter(
                this,
                android.R.layout.simple_list_item_single_choice,
                labels.toMutableList()
            )
            savedLocationsList.adapter = adapter
            savedLocationsList.choiceMode = ListView.CHOICE_MODE_SINGLE

            savedLocationsList.setOnItemClickListener { _, _, position, _ ->
                val location = savedLocations[position]
                geocodeError.visibility = View.GONE

                if (location.lat != null && location.lon != null) {
                    // Location already has coordinates
                    selectedLabel = location.label
                    selectedLat = location.lat
                    selectedLon = location.lon
                    isLocationValid = true
                    confirmButton.isEnabled = true
                } else {
                    // Need to geocode the address
                    geocodeSavedLocation(location)
                }
            }
        }
    }

    /**
     * Geocode a saved location that doesn't have lat/lon stored.
     */
    private fun geocodeSavedLocation(location: SavedLocation) {
        confirmButton.isEnabled = false
        isLocationValid = false

        lifecycleScope.launch(Dispatchers.IO) {
            val result = performGeocode(location.address)

            withContext(Dispatchers.Main) {
                if (result != null) {
                    selectedLabel = location.label
                    selectedLat = result.first
                    selectedLon = result.second
                    isLocationValid = true
                    confirmButton.isEnabled = true
                    geocodeError.visibility = View.GONE
                } else {
                    geocodeError.text = "Location could not be found"
                    geocodeError.visibility = View.VISIBLE
                    isLocationValid = false
                    confirmButton.isEnabled = false
                }
            }
        }
    }

    /**
     * Geocode a custom location entered by the user.
     */
    private fun geocodeLocation(query: String) {
        geocodeError.visibility = View.GONE
        confirmButton.isEnabled = false
        isLocationValid = false
        geocodeButton.isEnabled = false

        lifecycleScope.launch(Dispatchers.IO) {
            val result = performGeocode(query)

            withContext(Dispatchers.Main) {
                geocodeButton.isEnabled = true

                if (result != null) {
                    selectedLabel = query
                    selectedLat = result.first
                    selectedLon = result.second
                    isLocationValid = true
                    confirmButton.isEnabled = true
                    geocodeError.visibility = View.GONE

                    // Deselect any saved location
                    savedLocationsList.clearChoices()
                    savedLocationsList.requestLayout()
                } else {
                    geocodeError.text = "Location could not be found"
                    geocodeError.visibility = View.VISIBLE
                    isLocationValid = false
                    confirmButton.isEnabled = false
                }
            }
        }
    }

    /**
     * Perform geocoding via the server's /api/geocode endpoint.
     * This uses the same progressive fallback (zoom-out) as the desktop weather.
     * Returns (lat, lon) pair on success, null on failure.
     */
    private fun performGeocode(query: String): Pair<Double, Double>? {
        return try {
            // Get server URL from SharedPreferences
            val appPrefs = getSharedPreferences("cwoc_prefs", MODE_PRIVATE)
            val serverUrl = appPrefs.getString("server_url", null)?.trimEnd('/') ?: return null
            val authToken = appPrefs.getString("auth_token", null) ?: return null

            val encodedQuery = URLEncoder.encode(query, "UTF-8")
            val urlStr = "$serverUrl/api/geocode?q=$encodedQuery"
            val url = URL(urlStr)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.requestMethod = "GET"
            connection.setRequestProperty("User-Agent", "CWOC-Android-Widget/1.0")
            connection.setRequestProperty("Authorization", "Bearer $authToken")

            val responseCode = connection.responseCode
            if (responseCode != 200) return null

            val responseBody = connection.inputStream.bufferedReader().readText()
            val json = org.json.JSONObject(responseBody)
            val results = json.optJSONArray("results")
            if (results == null || results.length() == 0) return null

            val firstResult = results.getJSONObject(0)
            val lat = firstResult.getDouble("lat")
            val lon = firstResult.getDouble("lon")

            Pair(lat, lon)
        } catch (_: Exception) {
            null
        }
    }
}
