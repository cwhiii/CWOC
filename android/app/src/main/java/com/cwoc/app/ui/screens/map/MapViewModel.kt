package com.cwoc.app.ui.screens.map

import android.graphics.Color as AndroidColor
import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.ui.util.GeocodingUtil
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import javax.inject.Inject

/**
 * Data class representing a map marker for a chit or contact.
 */
data class ChitMarker(
    val chitId: String,
    val title: String,
    val geoPoint: GeoPoint,
    val color: Int,
    val type: String?
)

/**
 * Map display mode — Chits only, People only, or Both.
 */
enum class MapMode(val label: String) {
    CHITS("Chits"),
    PEOPLE("People"),
    BOTH("Both")
}

/**
 * ViewModel for the Map screen.
 * Loads location-bearing chits and/or contacts and computes map markers and bounds.
 * Supports three modes: Chits, People, Both.
 */
@HiltViewModel
class MapViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val contactDao: ContactDao,
    private val settingsRepository: com.cwoc.app.data.repository.SettingsRepository,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    companion object {
        private const val CONTACT_MARKER_COLOR = "#2196F3" // Blue for contacts
        private const val CHIT_DEFAULT_COLOR = "#6b4e31"   // Brown for chits
    }

    // ─── Map Mode State ─────────────────────────────────────────────────────

    private val _mapMode = MutableStateFlow(MapMode.CHITS)
    val mapMode: StateFlow<MapMode> = _mapMode.asStateFlow()

    private val _allPeople = MutableStateFlow(false)
    val allPeople: StateFlow<Boolean> = _allPeople.asStateFlow()

    // ─── Marker State ───────────────────────────────────────────────────────

    private val _markers = MutableStateFlow<List<ChitMarker>>(emptyList())
    val markers: StateFlow<List<ChitMarker>> = _markers.asStateFlow()

    private val _bounds = MutableStateFlow<BoundingBox?>(null)
    val bounds: StateFlow<BoundingBox?> = _bounds.asStateFlow()

    private val _defaultLat = MutableStateFlow(39.8283) // US center default
    private val _defaultLon = MutableStateFlow(-98.5795)
    private val _defaultZoom = MutableStateFlow(4.0)
    val defaultLat: StateFlow<Double> = _defaultLat.asStateFlow()
    val defaultLon: StateFlow<Double> = _defaultLon.asStateFlow()
    val defaultZoom: StateFlow<Double> = _defaultZoom.asStateFlow()

    // Internal caches for chit and contact markers
    private var chitMarkers: List<ChitMarker> = emptyList()
    private var contactMarkers: List<ChitMarker> = emptyList()
    private var savedLocationMarkers: List<ChitMarker> = emptyList()

    init {
        // T2: Load default map position from settings
        viewModelScope.launch {
            val settings = settingsRepository.get()
            if (settings != null) {
                settings.mapDefaultLat?.toDoubleOrNull()?.let { _defaultLat.value = it }
                settings.mapDefaultLon?.toDoubleOrNull()?.let { _defaultLon.value = it }
                settings.mapDefaultZoom?.toDoubleOrNull()?.let { _defaultZoom.value = it }

                // T1: Add saved locations as markers
                if (!settings.savedLocations.isNullOrBlank()) {
                    try {
                        val savedLocs: List<Map<String, Any>> = gson.fromJson(
                            settings.savedLocations,
                            object : TypeToken<List<Map<String, Any>>>() {}.type
                        ) ?: emptyList()
                        savedLocationMarkers = savedLocs.mapNotNull { loc ->
                            val lat = (loc["lat"] as? Double) ?: (loc["latitude"] as? Double) ?: return@mapNotNull null
                            val lon = (loc["lon"] as? Double) ?: (loc["lng"] as? Double) ?: (loc["longitude"] as? Double) ?: return@mapNotNull null
                            val name = (loc["name"] as? String) ?: (loc["label"] as? String) ?: "Saved"
                            ChitMarker(
                                chitId = "saved_${name.hashCode()}",
                                title = "⭐ $name",
                                geoPoint = GeoPoint(lat, lon),
                                color = AndroidColor.parseColor("#FFD700"), // Gold for saved locations
                                type = "saved"
                            )
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("CWOC_MAP", "Failed to parse saved locations: ${e.message}")
                    }
                }
            }
        }

        // Load chit location markers
        loadChitMarkers()
        // Load contact markers
        loadContactMarkers()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Switch the map display mode.
     */
    fun setMapMode(mode: MapMode) {
        _mapMode.value = mode
        updateVisibleMarkers()
    }

    /**
     * Toggle the "All People" checkbox — shows all contacts regardless of date filters.
     */
    fun setAllPeople(enabled: Boolean) {
        _allPeople.value = enabled
        // Re-load contact markers if needed (currently loads all anyway)
        updateVisibleMarkers()
    }

    // ─── Private Loading ────────────────────────────────────────────────────

    private fun loadChitMarkers() {
        viewModelScope.launch {
            chitRepository.getLocationChits().collect { chits ->
                val parsed = mutableListOf<ChitMarker>()
                chits.forEach { chit ->
                    val marker = parseMarker(chit)
                    if (marker != null) {
                        parsed.add(marker)
                    } else if (!chit.location.isNullOrBlank()) {
                        // T3: Geocode text addresses that don't have coordinates
                        val geoResult = GeocodingUtil.geocode(chit.location!!)
                        if (geoResult != null) {
                            parsed.add(ChitMarker(
                                chitId = chit.id,
                                title = chit.title ?: "Untitled",
                                geoPoint = GeoPoint(geoResult.lat, geoResult.lon),
                                color = markerColor(chit.color),
                                type = chit.status ?: if (chit.isProjectMaster) "project" else "chit"
                            ))
                        }
                    }
                }
                chitMarkers = parsed
                updateVisibleMarkers()
            }
        }
    }

    private fun loadContactMarkers() {
        viewModelScope.launch {
            try {
                val contacts = contactDao.getAllActive().first()
                val markers = mutableListOf<ChitMarker>()

                for (contact in contacts) {
                    val address = extractFirstAddress(contact.addresses)
                    if (address.isNullOrBlank()) continue

                    // Try to parse as coordinates first
                    val coordResult = parseLatLng(address)
                    if (coordResult != null) {
                        markers.add(createContactMarker(contact, GeoPoint(coordResult.first, coordResult.second)))
                        continue
                    }

                    // Geocode the address
                    val geoResult = GeocodingUtil.geocode(address)
                    if (geoResult != null) {
                        markers.add(createContactMarker(contact, GeoPoint(geoResult.lat, geoResult.lon)))
                    }
                }

                contactMarkers = markers
                updateVisibleMarkers()
            } catch (e: Exception) {
                android.util.Log.e("CWOC_MAP", "Failed to load contact markers: ${e.message}")
            }
        }
    }

    private fun createContactMarker(contact: ContactEntity, geoPoint: GeoPoint): ChitMarker {
        val displayName = contact.displayName
            ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ")
        return ChitMarker(
            chitId = contact.id,
            title = displayName.ifBlank { "Unnamed Contact" },
            geoPoint = geoPoint,
            color = AndroidColor.parseColor(CONTACT_MARKER_COLOR),
            type = "contact"
        )
    }

    /**
     * Extract the first address from the JSON array string.
     * Addresses are stored as JSON: [{"label": "Home", "value": "123 Main St, City, ST 12345"}, ...]
     * The "value" field contains the full address string.
     */
    private fun extractFirstAddress(addressesJson: String?): String? {
        if (addressesJson.isNullOrBlank() || addressesJson == "[]" || addressesJson == "null") return null

        return try {
            val listType = object : TypeToken<List<Any>>() {}.type
            val list: List<Any> = gson.fromJson(addressesJson, listType) ?: return null
            if (list.isEmpty()) return null

            val first = list[0]
            when (first) {
                is String -> first.takeIf { it.isNotBlank() }
                is Map<*, *> -> {
                    // Primary format: {"label": "Home", "value": "123 Main St..."}
                    val value = first["value"] as? String
                    if (!value.isNullOrBlank()) return value

                    // Fallback: try building from component fields
                    val parts = listOfNotNull(
                        first["street"] as? String,
                        first["city"] as? String,
                        first["state"] as? String,
                        first["zip"] as? String,
                        first["country"] as? String
                    ).filter { it.isNotBlank() }
                    parts.joinToString(", ").takeIf { it.isNotBlank() }
                }
                else -> first.toString().takeIf { it.isNotBlank() }
            }
        } catch (_: Exception) {
            // Maybe it's just a plain string
            addressesJson.takeIf { it.isNotBlank() && !it.startsWith("[") }
        }
    }

    /**
     * Update the visible markers based on the current map mode.
     */
    private fun updateVisibleMarkers() {
        val visible = when (_mapMode.value) {
            MapMode.CHITS -> savedLocationMarkers + chitMarkers
            MapMode.PEOPLE -> contactMarkers
            MapMode.BOTH -> savedLocationMarkers + chitMarkers + contactMarkers
        }
        _markers.value = visible
        _bounds.value = computeBounds(visible)
    }

    // ─── Parsing Helpers ────────────────────────────────────────────────────

    /**
     * Parse a chit's location field into a ChitMarker.
     * Location is stored as JSON: {"lat": 40.7128, "lng": -74.0060, "name": "..."}
     * or as a simple "lat,lng" string.
     */
    private fun parseMarker(chit: ChitEntity): ChitMarker? {
        val location = chit.location ?: return null
        if (location.isBlank()) return null

        val (lat, lng) = parseLatLng(location) ?: return null

        return ChitMarker(
            chitId = chit.id,
            title = chit.title ?: "Untitled",
            geoPoint = GeoPoint(lat, lng),
            color = markerColor(chit.color),
            type = chit.status ?: if (chit.isProjectMaster) "project" else "chit"
        )
    }

    /**
     * Parse lat/lng from various location formats.
     */
    private fun parseLatLng(location: String): Pair<Double, Double>? {
        // Try JSON format: {"lat": ..., "lng": ...}
        try {
            val map = gson.fromJson(location, Map::class.java) as? Map<*, *>
            if (map != null) {
                val lat = (map["lat"] as? Double) ?: (map["latitude"] as? Double)
                val lng = (map["lng"] as? Double) ?: (map["lon"] as? Double) ?: (map["longitude"] as? Double)
                if (lat != null && lng != null) return Pair(lat, lng)
            }
        } catch (_: Exception) {}

        // Try "lat,lng" format
        try {
            val parts = location.split(",")
            if (parts.size == 2) {
                val lat = parts[0].trim().toDouble()
                val lng = parts[1].trim().toDouble()
                if (lat in -90.0..90.0 && lng in -180.0..180.0) {
                    return Pair(lat, lng)
                }
            }
        } catch (_: Exception) {}

        return null
    }

    /**
     * Resolve marker color from chit color field.
     * Falls back to primary brown (#6b4e31) when no color is set.
     */
    fun markerColor(colorStr: String?): Int {
        if (colorStr.isNullOrBlank()) return AndroidColor.parseColor(CHIT_DEFAULT_COLOR)
        return try {
            AndroidColor.parseColor(colorStr)
        } catch (_: Exception) {
            AndroidColor.parseColor(CHIT_DEFAULT_COLOR)
        }
    }

    /**
     * Compute bounding box that encompasses all markers with padding.
     */
    fun computeBounds(markers: List<ChitMarker>): BoundingBox? {
        if (markers.isEmpty()) return null
        if (markers.size == 1) {
            val p = markers[0].geoPoint
            return BoundingBox(
                p.latitude + 0.01, p.longitude + 0.01,
                p.latitude - 0.01, p.longitude - 0.01
            )
        }

        var north = -90.0
        var south = 90.0
        var east = -180.0
        var west = 180.0

        markers.forEach { marker ->
            val lat = marker.geoPoint.latitude
            val lng = marker.geoPoint.longitude
            if (lat > north) north = lat
            if (lat < south) south = lat
            if (lng > east) east = lng
            if (lng < west) west = lng
        }

        // Add padding (10% of range)
        val latPad = (north - south) * 0.1
        val lngPad = (east - west) * 0.1

        return BoundingBox(
            north + latPad, east + lngPad,
            south - latPad, west - lngPad
        )
    }
}
