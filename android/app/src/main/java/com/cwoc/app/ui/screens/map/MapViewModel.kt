package com.cwoc.app.ui.screens.map

import android.graphics.Color as AndroidColor
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import javax.inject.Inject

/**
 * Data class representing a map marker for a chit.
 */
data class ChitMarker(
    val chitId: String,
    val title: String,
    val geoPoint: GeoPoint,
    val color: Int,
    val type: String?
)

/**
 * ViewModel for the Map screen.
 * Loads location-bearing chits and computes map markers and bounds.
 */
@HiltViewModel
class MapViewModel @Inject constructor(
    private val chitRepository: ChitRepository
) : ViewModel() {

    private val _markers = MutableStateFlow<List<ChitMarker>>(emptyList())
    val markers: StateFlow<List<ChitMarker>> = _markers.asStateFlow()

    private val _bounds = MutableStateFlow<BoundingBox?>(null)
    val bounds: StateFlow<BoundingBox?> = _bounds.asStateFlow()

    init {
        viewModelScope.launch {
            chitRepository.getLocationChits().collect { chits ->
                val parsed = chits.mapNotNull { chit -> parseMarker(chit) }
                _markers.value = parsed
                _bounds.value = computeBounds(parsed)
            }
        }
    }

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
            val gson = com.google.gson.Gson()
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
        if (colorStr.isNullOrBlank()) return AndroidColor.parseColor("#6b4e31")
        return try {
            AndroidColor.parseColor(colorStr)
        } catch (_: Exception) {
            AndroidColor.parseColor("#6b4e31")
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
