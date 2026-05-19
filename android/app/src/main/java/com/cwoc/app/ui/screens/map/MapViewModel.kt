package com.cwoc.app.ui.screens.map

import android.graphics.Color as AndroidColor
import android.content.SharedPreferences
import androidx.lifecycle.SavedStateHandle
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
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import javax.inject.Inject

/**
 * Data class representing a map marker for a chit or contact.
 */
data class ChitMarker(
    val chitId: String,
    val title: String,
    val geoPoint: GeoPoint,
    val color: Int,
    val type: String?,
    val isOverdue: Boolean = false
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
 * Period filter options matching the web's maps sidebar period dropdown.
 */
enum class MapPeriod(val label: String) {
    ALL("All Time"),
    TODAY("Today"),
    WEEK("Week"),
    MONTH("Month"),
    YEAR("Year")
}

/**
 * ViewModel for the Map screen.
 * Loads location-bearing chits and/or contacts and computes map markers and bounds.
 * Supports three modes: Chits, People, Both.
 * Implements: mode persistence, status-based colors, period filtering, text search,
 * "Go to" geocoding, focus mode, auto-zoom setting, loading state, overdue detection.
 */
@HiltViewModel
class MapViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val contactDao: ContactDao,
    private val settingsRepository: com.cwoc.app.data.repository.SettingsRepository,
    private val prefs: SharedPreferences,
    private val gson: Gson,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        private const val CONTACT_MARKER_COLOR = "#2196F3" // Blue for contacts
        private const val CHIT_DEFAULT_COLOR = "#6b4e31"   // Brown for chits
        private const val MODE_PREF_KEY = "cwoc_maps_mode"

        // Status → Color mapping matching web's _mapsStatusColors
        private val STATUS_COLORS = mapOf(
            "ToDo" to "#2196F3",
            "In Progress" to "#FF9800",
            "Blocked" to "#F44336",
            "Complete" to "#4CAF50",
            "Rejected" to "#9E9E9E"
        )
        private const val NO_STATUS_COLOR = "#9E9E9E"
    }

    // ─── Map Mode State (persisted) ─────────────────────────────────────────

    private val _mapMode = MutableStateFlow(restoreMode())
    val mapMode: StateFlow<MapMode> = _mapMode.asStateFlow()

    private val _allPeople = MutableStateFlow(false)
    val allPeople: StateFlow<Boolean> = _allPeople.asStateFlow()

    // ─── Loading State ──────────────────────────────────────────────────────

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    // ─── Filter State ───────────────────────────────────────────────────────

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _period = MutableStateFlow(MapPeriod.ALL)
    val period: StateFlow<MapPeriod> = _period.asStateFlow()

    private val _periodOffset = MutableStateFlow(0)
    val periodOffset: StateFlow<Int> = _periodOffset.asStateFlow()

    private val _periodLabel = MutableStateFlow("All Time")
    val periodLabel: StateFlow<String> = _periodLabel.asStateFlow()

    private val _statusFilters = MutableStateFlow<Set<String>>(emptySet())
    val statusFilters: StateFlow<Set<String>> = _statusFilters.asStateFlow()

    private val _priorityFilters = MutableStateFlow<Set<String>>(emptySet())
    val priorityFilters: StateFlow<Set<String>> = _priorityFilters.asStateFlow()

    private val _tagFilters = MutableStateFlow<Set<String>>(emptySet())
    val tagFilters: StateFlow<Set<String>> = _tagFilters.asStateFlow()

    private val _peopleFilters = MutableStateFlow<Set<String>>(emptySet())
    val peopleFilters: StateFlow<Set<String>> = _peopleFilters.asStateFlow()

    // ─── "Go to" / Focus State ──────────────────────────────────────────────

    private val _flyToPoint = MutableStateFlow<GeoPoint?>(null)
    val flyToPoint: StateFlow<GeoPoint?> = _flyToPoint.asStateFlow()

    private val _goToError = MutableStateFlow<String?>(null)
    val goToError: StateFlow<String?> = _goToError.asStateFlow()

    // ─── Settings State ─────────────────────────────────────────────────────

    private val _autoZoomEnabled = MutableStateFlow(true)
    val autoZoomEnabled: StateFlow<Boolean> = _autoZoomEnabled.asStateFlow()

    private val _preferGoogleMaps = MutableStateFlow(false)
    val preferGoogleMaps: StateFlow<Boolean> = _preferGoogleMaps.asStateFlow()

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

    // Internal caches for chit and contact markers (unfiltered)
    private var allChitMarkers: List<ChitMarkerWithEntity> = emptyList()
    private var contactMarkers: List<ChitMarker> = emptyList()
    private var savedLocationMarkers: List<ChitMarker> = emptyList()

    // Focus mode from navigation args
    private val focusAddress: String? = savedStateHandle.get<String>("address")
    private val focusType: String? = savedStateHandle.get<String>("focusType")

    init {
        loadSettings()
        loadChitMarkers()
        loadContactMarkers()

        // Handle focus mode if address was passed via navigation
        if (!focusAddress.isNullOrBlank()) {
            goToAddress(focusAddress)
        }
    }

    // ─── Mode Persistence ───────────────────────────────────────────────────

    private fun restoreMode(): MapMode {
        val stored = prefs.getString(MODE_PREF_KEY, null)
        return when (stored) {
            "chits" -> MapMode.CHITS
            "people" -> MapMode.PEOPLE
            "both" -> MapMode.BOTH
            else -> MapMode.CHITS
        }
    }

    private fun persistMode(mode: MapMode) {
        prefs.edit().putString(MODE_PREF_KEY, mode.name.lowercase()).apply()
    }

    // ─── Settings Loading ───────────────────────────────────────────────────

    private fun loadSettings() {
        viewModelScope.launch {
            val settings = settingsRepository.get()
            if (settings != null) {
                settings.mapDefaultLat?.toDoubleOrNull()?.let { _defaultLat.value = it }
                settings.mapDefaultLon?.toDoubleOrNull()?.let { _defaultLon.value = it }
                settings.mapDefaultZoom?.toDoubleOrNull()?.let { _defaultZoom.value = it }

                // Auto-zoom setting
                val autoZoom = settings.mapAutoZoom
                _autoZoomEnabled.value = (autoZoom == "1" || autoZoom == null || autoZoom.isBlank())

                // Google Maps preference
                val chitOptions = settings.chitOptions
                if (!chitOptions.isNullOrBlank()) {
                    try {
                        val opts: Map<String, Any> = gson.fromJson(chitOptions, object : TypeToken<Map<String, Any>>() {}.type)
                        _preferGoogleMaps.value = (opts["prefer_google_maps"] as? Boolean) == true
                    } catch (_: Exception) {}
                }

                // Saved locations as markers
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
                                color = AndroidColor.parseColor("#FFD700"),
                                type = "saved"
                            )
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("CWOC_MAP", "Failed to parse saved locations: ${e.message}")
                    }
                }
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun setMapMode(mode: MapMode) {
        _mapMode.value = mode
        persistMode(mode)
        updateVisibleMarkers()
    }

    fun setAllPeople(enabled: Boolean) {
        _allPeople.value = enabled
        updateVisibleMarkers()
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
        updateVisibleMarkers()
    }

    fun setPeriod(period: MapPeriod) {
        _period.value = period
        _periodOffset.value = 0
        updatePeriodLabel()
        updateVisibleMarkers()
    }

    fun previousPeriod() {
        if (_period.value != MapPeriod.ALL) {
            _periodOffset.value -= 1
            updatePeriodLabel()
            updateVisibleMarkers()
        }
    }

    fun nextPeriod() {
        if (_period.value != MapPeriod.ALL) {
            _periodOffset.value += 1
            updatePeriodLabel()
            updateVisibleMarkers()
        }
    }

    fun toggleStatusFilter(status: String) {
        val current = _statusFilters.value.toMutableSet()
        if (status in current) current.remove(status) else current.add(status)
        _statusFilters.value = current
        updateVisibleMarkers()
    }

    fun togglePriorityFilter(priority: String) {
        val current = _priorityFilters.value.toMutableSet()
        if (priority in current) current.remove(priority) else current.add(priority)
        _priorityFilters.value = current
        updateVisibleMarkers()
    }

    fun toggleTagFilter(tag: String) {
        val current = _tagFilters.value.toMutableSet()
        if (tag in current) current.remove(tag) else current.add(tag)
        _tagFilters.value = current
        updateVisibleMarkers()
    }

    fun togglePeopleFilter(person: String) {
        val current = _peopleFilters.value.toMutableSet()
        if (person in current) current.remove(person) else current.add(person)
        _peopleFilters.value = current
        updateVisibleMarkers()
    }

    fun clearFilters() {
        _searchQuery.value = ""
        _period.value = MapPeriod.ALL
        _periodOffset.value = 0
        _statusFilters.value = emptySet()
        _priorityFilters.value = emptySet()
        _tagFilters.value = emptySet()
        _peopleFilters.value = emptySet()
        updatePeriodLabel()
        updateVisibleMarkers()
    }

    /**
     * "Go to" search — geocode an address and emit a flyToPoint for the map to animate to.
     */
    fun goToAddress(address: String) {
        if (address.isBlank()) return
        viewModelScope.launch {
            _isSearching.value = true
            _goToError.value = null
            try {
                val result = GeocodingUtil.geocode(address)
                if (result != null) {
                    _flyToPoint.value = GeoPoint(result.lat, result.lon)
                } else {
                    _goToError.value = "Location not found"
                }
            } catch (e: Exception) {
                _goToError.value = "Geocoding failed: ${e.message}"
            } finally {
                _isSearching.value = false
            }
        }
    }

    fun clearFlyTo() {
        _flyToPoint.value = null
    }

    fun clearGoToError() {
        _goToError.value = null
    }

    // ─── Private Loading ────────────────────────────────────────────────────

    private fun loadChitMarkers() {
        viewModelScope.launch {
            _isLoading.value = true
            chitRepository.getLocationChits().collect { chits ->
                val parsed = mutableListOf<ChitMarkerWithEntity>()
                chits.forEach { chit ->
                    val marker = parseMarkerWithEntity(chit)
                    if (marker != null) {
                        parsed.add(marker)
                    } else if (!chit.location.isNullOrBlank()) {
                        val geoResult = GeocodingUtil.geocode(chit.location!!)
                        if (geoResult != null) {
                            parsed.add(ChitMarkerWithEntity(
                                marker = ChitMarker(
                                    chitId = chit.id,
                                    title = chit.title ?: "Untitled",
                                    geoPoint = GeoPoint(geoResult.lat, geoResult.lon),
                                    color = resolveChitColor(chit),
                                    type = chit.status ?: if (chit.isProjectMaster) "project" else "chit",
                                    isOverdue = isChitOverdue(chit)
                                ),
                                entity = chit
                            ))
                        }
                    }
                }
                allChitMarkers = parsed
                _isLoading.value = false
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

                    val coordResult = parseLatLng(address)
                    if (coordResult != null) {
                        markers.add(createContactMarker(contact, GeoPoint(coordResult.first, coordResult.second)))
                        continue
                    }

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

    // ─── Filtering ──────────────────────────────────────────────────────────

    /**
     * Apply all active filters (search, period, status) to chit markers
     * and combine with contact markers based on mode.
     */
    private fun updateVisibleMarkers() {
        val filteredChits = applyChitFilters(allChitMarkers)

        val visible = when (_mapMode.value) {
            MapMode.CHITS -> savedLocationMarkers + filteredChits
            MapMode.PEOPLE -> contactMarkers
            MapMode.BOTH -> savedLocationMarkers + filteredChits + contactMarkers
        }
        _markers.value = visible
        if (_autoZoomEnabled.value) {
            _bounds.value = computeBounds(visible)
        }
    }

    private fun applyChitFilters(markers: List<ChitMarkerWithEntity>): List<ChitMarker> {
        var filtered = markers.asSequence()

        // Status filter
        val statuses = _statusFilters.value
        if (statuses.isNotEmpty()) {
            filtered = filtered.filter { it.entity.status in statuses }
        }

        // Priority filter
        val priorities = _priorityFilters.value
        if (priorities.isNotEmpty()) {
            filtered = filtered.filter { it.entity.priority in priorities }
        }

        // Tag filter
        val tags = _tagFilters.value
        if (tags.isNotEmpty()) {
            filtered = filtered.filter { item ->
                val chitTags = item.entity.tags
                if (chitTags.isNullOrEmpty()) false
                else chitTags.any { it in tags }
            }
        }

        // People filter
        val people = _peopleFilters.value
        if (people.isNotEmpty()) {
            filtered = filtered.filter { item ->
                val chitPeople = item.entity.people
                if (chitPeople.isNullOrEmpty()) false
                else chitPeople.any { it in people }
            }
        }

        // Text search filter
        val query = _searchQuery.value.trim().lowercase()
        if (query.isNotBlank()) {
            filtered = filtered.filter { item ->
                val chit = item.entity
                (chit.title?.lowercase()?.contains(query) == true) ||
                (chit.note?.lowercase()?.contains(query) == true) ||
                (chit.location?.lowercase()?.contains(query) == true)
            }
        }

        // Period/date filter with offset
        val period = _period.value
        if (period != MapPeriod.ALL) {
            val offset = _periodOffset.value
            val now = LocalDate.now()
            val (start, end) = when (period) {
                MapPeriod.TODAY -> {
                    val day = now.plusDays(offset.toLong())
                    day to day
                }
                MapPeriod.WEEK -> {
                    val startOfWeek = now.minusDays(now.dayOfWeek.value.toLong() % 7).plusWeeks(offset.toLong())
                    startOfWeek to startOfWeek.plusDays(6)
                }
                MapPeriod.MONTH -> {
                    val monthStart = now.withDayOfMonth(1).plusMonths(offset.toLong())
                    monthStart to monthStart.plusMonths(1).minusDays(1)
                }
                MapPeriod.YEAR -> {
                    val yearStart = LocalDate.of(now.year + offset, 1, 1)
                    yearStart to LocalDate.of(now.year + offset, 12, 31)
                }
                else -> null to null
            }
            if (start != null && end != null) {
                filtered = filtered.filter { item ->
                    chitInDateRange(item.entity, start, end)
                }
            }
        }

        return filtered.map { it.marker }.toList()
    }

    private fun chitInDateRange(chit: ChitEntity, start: LocalDate, end: LocalDate): Boolean {
        val dates = listOfNotNull(chit.startDatetime, chit.dueDatetime, chit.pointInTime)
        if (dates.isEmpty()) return true // No dates = show always

        return dates.any { dateStr ->
            try {
                val date = LocalDate.parse(dateStr.take(10))
                !date.isBefore(start) && !date.isAfter(end)
            } catch (_: Exception) {
                false
            }
        }
    }

    private fun updatePeriodLabel() {
        val period = _period.value
        val offset = _periodOffset.value
        val now = LocalDate.now()
        val months = arrayOf("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")

        _periodLabel.value = when (period) {
            MapPeriod.ALL -> "All Time"
            MapPeriod.TODAY -> {
                val day = now.plusDays(offset.toLong())
                "${months[day.monthValue - 1]} ${day.dayOfMonth}"
            }
            MapPeriod.WEEK -> {
                val startOfWeek = now.minusDays(now.dayOfWeek.value.toLong() % 7).plusWeeks(offset.toLong())
                val endOfWeek = startOfWeek.plusDays(6)
                "${months[startOfWeek.monthValue - 1]} ${startOfWeek.dayOfMonth} — ${months[endOfWeek.monthValue - 1]} ${endOfWeek.dayOfMonth}"
            }
            MapPeriod.MONTH -> {
                val monthStart = now.withDayOfMonth(1).plusMonths(offset.toLong())
                "${months[monthStart.monthValue - 1]} ${monthStart.year}"
            }
            MapPeriod.YEAR -> {
                "${now.year + offset}"
            }
        }
    }

    // ─── Color Resolution ───────────────────────────────────────────────────

    /**
     * Resolve marker color for a chit:
     * 1. If chit has a custom color, use it
     * 2. If chit has a status, use the status color map
     * 3. Otherwise use default brown
     */
    private fun resolveChitColor(chit: ChitEntity): Int {
        // Custom color takes priority
        if (!chit.color.isNullOrBlank()) {
            return try {
                AndroidColor.parseColor(chit.color)
            } catch (_: Exception) {
                AndroidColor.parseColor(CHIT_DEFAULT_COLOR)
            }
        }
        // Status-based color
        if (!chit.status.isNullOrBlank()) {
            val hex = STATUS_COLORS[chit.status] ?: NO_STATUS_COLOR
            return AndroidColor.parseColor(hex)
        }
        return AndroidColor.parseColor(CHIT_DEFAULT_COLOR)
    }

    // ─── Overdue Detection ──────────────────────────────────────────────────

    /**
     * Returns true if the chit has a due_datetime in the past and status is not Complete.
     * Matches web's _isChitOverdue().
     */
    private fun isChitOverdue(chit: ChitEntity): Boolean {
        if (chit.dueDatetime.isNullOrBlank()) return false
        if (chit.status == "Complete") return false
        return try {
            val due = Instant.parse(chit.dueDatetime)
            due.isBefore(Instant.now())
        } catch (_: Exception) {
            try {
                val dueDate = LocalDate.parse(chit.dueDatetime.take(10))
                dueDate.isBefore(LocalDate.now())
            } catch (_: Exception) {
                false
            }
        }
    }

    // ─── Parsing Helpers ────────────────────────────────────────────────────

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
                    val value = first["value"] as? String
                    if (!value.isNullOrBlank()) return value
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
            addressesJson.takeIf { it.isNotBlank() && !it.startsWith("[") }
        }
    }

    private fun parseMarkerWithEntity(chit: ChitEntity): ChitMarkerWithEntity? {
        val location = chit.location ?: return null
        if (location.isBlank()) return null
        val (lat, lng) = parseLatLng(location) ?: return null
        return ChitMarkerWithEntity(
            marker = ChitMarker(
                chitId = chit.id,
                title = chit.title ?: "Untitled",
                geoPoint = GeoPoint(lat, lng),
                color = resolveChitColor(chit),
                type = chit.status ?: if (chit.isProjectMaster) "project" else "chit",
                isOverdue = isChitOverdue(chit)
            ),
            entity = chit
        )
    }

    private fun parseLatLng(location: String): Pair<Double, Double>? {
        try {
            val map = gson.fromJson(location, Map::class.java) as? Map<*, *>
            if (map != null) {
                val lat = (map["lat"] as? Double) ?: (map["latitude"] as? Double)
                val lng = (map["lng"] as? Double) ?: (map["lon"] as? Double) ?: (map["longitude"] as? Double)
                if (lat != null && lng != null) return Pair(lat, lng)
            }
        } catch (_: Exception) {}

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

    fun markerColor(colorStr: String?): Int {
        if (colorStr.isNullOrBlank()) return AndroidColor.parseColor(CHIT_DEFAULT_COLOR)
        return try {
            AndroidColor.parseColor(colorStr)
        } catch (_: Exception) {
            AndroidColor.parseColor(CHIT_DEFAULT_COLOR)
        }
    }

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

        val latPad = (north - south) * 0.1
        val lngPad = (east - west) * 0.1

        return BoundingBox(
            north + latPad, east + lngPad,
            south - latPad, west - lngPad
        )
    }
}

/**
 * Internal wrapper that pairs a ChitMarker with its source entity for filtering.
 */
private data class ChitMarkerWithEntity(
    val marker: ChitMarker,
    val entity: ChitEntity
)
