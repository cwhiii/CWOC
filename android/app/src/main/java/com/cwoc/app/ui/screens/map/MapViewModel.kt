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
import com.cwoc.app.domain.tags.TagTreeParser
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
 * Sealed class representing the data displayed in a marker popup overlay.
 */
sealed class MarkerPopupData {
    data class ChitPopup(
        val chitId: String,
        val title: String,
        val formattedDate: String?,
        val status: String?,
        val isOverdue: Boolean,
        val hasPriority: Boolean,
        val hasChecklist: Boolean,
        val hasAlarm: Boolean,
        val hasRecurrence: Boolean,
        val hasPeople: Boolean,
        val hasLocation: Boolean
    ) : MarkerPopupData()

    data class ContactPopup(
        val contactId: String,
        val displayName: String,
        val address: String?
    ) : MarkerPopupData()
}

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
    NEXT_HOUR("Next Hour"),
    TODAY("Today"),
    DAY("Day"),
    WEEK("Week"),
    NEXT_X_DAYS("Next X Days"),
    MONTH("Month"),
    QUARTER("Quarter"),
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

    private val _availableTags = MutableStateFlow<List<String>>(emptyList())
    val availableTags: StateFlow<List<String>> = _availableTags.asStateFlow()

    private val _availablePeople = MutableStateFlow<List<String>>(emptyList())
    val availablePeople: StateFlow<List<String>> = _availablePeople.asStateFlow()

    private val _peopleFilters = MutableStateFlow<Set<String>>(emptySet())
    val peopleFilters: StateFlow<Set<String>> = _peopleFilters.asStateFlow()

    // ─── People Filter Panel State ──────────────────────────────────────────

    private val _peopleSearchText = MutableStateFlow("")
    val peopleSearchText: StateFlow<String> = _peopleSearchText.asStateFlow()

    private val _peopleFavoritesOnly = MutableStateFlow(false)
    val peopleFavoritesOnly: StateFlow<Boolean> = _peopleFavoritesOnly.asStateFlow()

    private val _peopleSelectedTags = MutableStateFlow<Set<String>>(emptySet())
    val peopleSelectedTags: StateFlow<Set<String>> = _peopleSelectedTags.asStateFlow()

    private val _allContactTags = MutableStateFlow<List<String>>(emptyList())
    val allContactTags: StateFlow<List<String>> = _allContactTags.asStateFlow()

    // ─── "Go to" / Focus State ──────────────────────────────────────────────

    private val _flyToPoint = MutableStateFlow<GeoPoint?>(null)
    val flyToPoint: StateFlow<GeoPoint?> = _flyToPoint.asStateFlow()

    private val _goToError = MutableStateFlow<String?>(null)
    val goToError: StateFlow<String?> = _goToError.asStateFlow()

    /** True when the map was opened with a focus address — skips auto-zoom-to-fit-all. */
    private val _isFocusMode = MutableStateFlow(false)
    val isFocusMode: StateFlow<Boolean> = _isFocusMode.asStateFlow()

    /** The GeoPoint of the focused location for the highlight marker. */
    private val _focusPoint = MutableStateFlow<GeoPoint?>(null)
    val focusPoint: StateFlow<GeoPoint?> = _focusPoint.asStateFlow()

    // ─── Marker Popup State ─────────────────────────────────────────────────

    private val _selectedPopup = MutableStateFlow<MarkerPopupData?>(null)
    val selectedPopup: StateFlow<MarkerPopupData?> = _selectedPopup.asStateFlow()

    // ─── Settings State ─────────────────────────────────────────────────────

    private val _autoZoomEnabled = MutableStateFlow(true)
    val autoZoomEnabled: StateFlow<Boolean> = _autoZoomEnabled.asStateFlow()

    private val _preferGoogleMaps = MutableStateFlow(false)
    val preferGoogleMaps: StateFlow<Boolean> = _preferGoogleMaps.asStateFlow()

    private val _customDaysCount = MutableStateFlow(7) // Default 7 days for "Next X Days"

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
    private var allContactMarkersWithEntity: List<ContactMarkerWithEntity> = emptyList()
    private var savedLocationMarkers: List<ChitMarker> = emptyList()

    // Focus mode from navigation args
    private val focusAddress: String? = savedStateHandle.get<String>("address")
    private val focusType: String? = savedStateHandle.get<String>("focusType")

    init {
        loadSettings()
        loadChitMarkers()
        loadContactMarkers()
        loadAvailablePeople()

        // Handle focus mode if address was passed via navigation
        if (!focusAddress.isNullOrBlank()) {
            _isFocusMode.value = true
            goToFocusAddress(focusAddress)
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

                // Custom days count for "Next X Days" period filter
                settings.customDaysCount?.toIntOrNull()?.let { days ->
                    if (days > 0) _customDaysCount.value = days
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

                // Load available tags for tag filter chips
                val tagTree = TagTreeParser.parseTagTree(settings.tags)
                val flatTags = TagTreeParser.flattenTree(tagTree)
                _availableTags.value = flatTags.map { it.fullPath }.sorted()
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
        if (_period.value != MapPeriod.ALL && _period.value != MapPeriod.NEXT_HOUR) {
            _periodOffset.value -= 1
            updatePeriodLabel()
            updateVisibleMarkers()
        }
    }

    fun nextPeriod() {
        if (_period.value != MapPeriod.ALL && _period.value != MapPeriod.NEXT_HOUR) {
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

    // ─── People Filter Panel API ────────────────────────────────────────────

    fun setPeopleSearchText(text: String) {
        _peopleSearchText.value = text
        updateVisibleMarkers()
    }

    fun setPeopleFavoritesOnly(enabled: Boolean) {
        _peopleFavoritesOnly.value = enabled
        updateVisibleMarkers()
    }

    fun togglePeopleTag(tag: String) {
        val current = _peopleSelectedTags.value.toMutableSet()
        if (tag in current) current.remove(tag) else current.add(tag)
        _peopleSelectedTags.value = current
        updateVisibleMarkers()
    }

    fun clearPeopleFilters() {
        _peopleSearchText.value = ""
        _peopleFavoritesOnly.value = false
        _peopleSelectedTags.value = emptySet()
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

    /**
     * Focus mode geocoding — geocodes the focus address and sets both flyToPoint and focusPoint.
     * The focusPoint is used to render a distinct highlight marker at the focused location.
     */
    private fun goToFocusAddress(address: String) {
        if (address.isBlank()) return
        viewModelScope.launch {
            _isSearching.value = true
            _goToError.value = null
            try {
                val result = GeocodingUtil.geocode(address)
                if (result != null) {
                    val point = GeoPoint(result.lat, result.lon)
                    _flyToPoint.value = point
                    _focusPoint.value = point
                } else {
                    _goToError.value = "Location not found"
                    _isFocusMode.value = false
                }
            } catch (e: Exception) {
                _goToError.value = "Geocoding failed: ${e.message}"
                _isFocusMode.value = false
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

    // ─── Marker Popup API ───────────────────────────────────────────────────

    /**
     * Called when a marker is tapped. Fetches the full entity data and shows the popup.
     */
    fun onMarkerTapped(chitMarker: ChitMarker) {
        viewModelScope.launch {
            if (chitMarker.type == "contact") {
                val contact = contactDao.getById(chitMarker.chitId)
                if (contact != null) {
                    val displayName = contact.displayName
                        ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ")
                    val address = extractFirstAddress(contact.addresses)
                    _selectedPopup.value = MarkerPopupData.ContactPopup(
                        contactId = contact.id,
                        displayName = displayName.ifBlank { "Unnamed Contact" },
                        address = address
                    )
                }
            } else if (chitMarker.type != "saved") {
                val chit = chitRepository.getById(chitMarker.chitId)
                if (chit != null) {
                    _selectedPopup.value = MarkerPopupData.ChitPopup(
                        chitId = chit.id,
                        title = chit.title ?: "Untitled",
                        formattedDate = formatChitDate(chit),
                        status = chit.status,
                        isOverdue = isChitOverdue(chit),
                        hasPriority = !chit.priority.isNullOrBlank(),
                        hasChecklist = !chit.checklist.isNullOrBlank() && chit.checklist != "[]",
                        hasAlarm = chit.alarm == true || chit.notification == true,
                        hasRecurrence = !chit.recurrenceRule.isNullOrBlank(),
                        hasPeople = !chit.people.isNullOrEmpty(),
                        hasLocation = !chit.location.isNullOrBlank()
                    )
                }
            }
        }
    }

    /**
     * Dismiss the marker popup.
     */
    fun dismissPopup() {
        _selectedPopup.value = null
    }

    /**
     * Format a chit's most relevant date for display in the popup.
     * Priority: due date > start date > point-in-time > created date.
     */
    private fun formatChitDate(chit: ChitEntity): String? {
        val dateStr = chit.dueDatetime ?: chit.startDatetime ?: chit.pointInTime ?: return null
        return try {
            val date = LocalDate.parse(dateStr.take(10))
            val months = arrayOf("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
            "${months[date.monthValue - 1]} ${date.dayOfMonth}, ${date.year}"
        } catch (_: Exception) {
            dateStr.take(10)
        }
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
                val markersWithEntity = mutableListOf<ContactMarkerWithEntity>()
                val allTags = mutableSetOf<String>()

                for (contact in contacts) {
                    // Collect all contact tags for the filter panel
                    contact.tags?.forEach { tag -> allTags.add(tag) }

                    val address = extractFirstAddress(contact.addresses)
                    if (address.isNullOrBlank()) continue

                    val coordResult = parseLatLng(address)
                    if (coordResult != null) {
                        markersWithEntity.add(ContactMarkerWithEntity(
                            marker = createContactMarker(contact, GeoPoint(coordResult.first, coordResult.second)),
                            entity = contact
                        ))
                        continue
                    }

                    val geoResult = GeocodingUtil.geocode(address)
                    if (geoResult != null) {
                        markersWithEntity.add(ContactMarkerWithEntity(
                            marker = createContactMarker(contact, GeoPoint(geoResult.lat, geoResult.lon)),
                            entity = contact
                        ))
                    }
                }

                allContactMarkersWithEntity = markersWithEntity
                _allContactTags.value = allTags.sorted()
                updateVisibleMarkers()
            } catch (e: Exception) {
                android.util.Log.e("CWOC_MAP", "Failed to load contact markers: ${e.message}")
            }
        }
    }

    /**
     * Load available people names from contacts + system users for the people filter chips.
     * Merges contact display names with system user names (deduplicated, case-insensitive).
     */
    private fun loadAvailablePeople() {
        viewModelScope.launch {
            try {
                val contacts = contactDao.getAllActive().first()
                val systemUsers = contactDao.getSystemUsers()

                val peopleNames = mutableSetOf<String>()
                val seenLower = mutableSetOf<String>()

                // Add contact display names
                for (contact in contacts) {
                    val name = contact.displayName
                        ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ")
                    if (name.isNotBlank() && seenLower.add(name.lowercase())) {
                        peopleNames.add(name)
                    }
                }

                // Add system users (deduplicated against contacts)
                for (user in systemUsers) {
                    val name = user.displayName ?: user.username ?: continue
                    if (name.isNotBlank() && seenLower.add(name.lowercase())) {
                        peopleNames.add(name)
                    }
                }

                _availablePeople.value = peopleNames.sorted()
            } catch (e: Exception) {
                android.util.Log.e("CWOC_MAP", "Failed to load available people: ${e.message}")
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
     * When "All People" is checked, bypass people filter panel filters.
     * When in focus mode, skip auto-zoom-to-fit-all (don't update bounds).
     */
    private fun updateVisibleMarkers() {
        val filteredChits = applyChitFilters(allChitMarkers)
        val filteredContacts = applyPeopleFilters(allContactMarkersWithEntity)

        val visible = when (_mapMode.value) {
            MapMode.CHITS -> savedLocationMarkers + filteredChits
            MapMode.PEOPLE -> filteredContacts
            MapMode.BOTH -> savedLocationMarkers + filteredChits + filteredContacts
        }
        _markers.value = visible
        // Skip auto-zoom-to-fit-all when in focus mode — maintain focus on the target location
        if (_autoZoomEnabled.value && !_isFocusMode.value) {
            _bounds.value = computeBounds(visible)
        }
    }

    /**
     * Apply people filter panel filters (search text, favorites, tags) to contact markers.
     * When "All People" checkbox is checked, bypass all people filter panel filters.
     */
    private fun applyPeopleFilters(markers: List<ContactMarkerWithEntity>): List<ChitMarker> {
        // When "All People" is checked, show all contacts without filtering
        if (_allPeople.value) {
            return markers.map { it.marker }
        }

        var filtered = markers.asSequence()

        // Text search filter (case-insensitive, matches display name)
        val searchText = _peopleSearchText.value.trim().lowercase()
        if (searchText.isNotBlank()) {
            filtered = filtered.filter { item ->
                val contact = item.entity
                val displayName = contact.displayName
                    ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ")
                displayName.lowercase().contains(searchText)
            }
        }

        // Favorites-only filter
        if (_peopleFavoritesOnly.value) {
            filtered = filtered.filter { it.entity.favorite }
        }

        // Tag filter (show contacts having at least one of the selected tags)
        val selectedTags = _peopleSelectedTags.value
        if (selectedTags.isNotEmpty()) {
            filtered = filtered.filter { item ->
                val contactTags = item.entity.tags
                if (contactTags.isNullOrEmpty()) false
                else contactTags.any { it in selectedTags }
            }
        }

        return filtered.map { it.marker }.toList()
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
                MapPeriod.NEXT_HOUR -> {
                    // Next hour: show chits with dates within the next 60 minutes from now
                    // We approximate by using today's date (hour-level filtering done below)
                    now to now
                }
                MapPeriod.TODAY -> {
                    val day = now.plusDays(offset.toLong())
                    day to day
                }
                MapPeriod.DAY -> {
                    val day = now.plusDays(offset.toLong())
                    day to day
                }
                MapPeriod.WEEK -> {
                    val startOfWeek = now.minusDays(now.dayOfWeek.value.toLong() % 7).plusWeeks(offset.toLong())
                    startOfWeek to startOfWeek.plusDays(6)
                }
                MapPeriod.NEXT_X_DAYS -> {
                    val days = _customDaysCount.value
                    val startDay = now.plusDays((offset * days).toLong())
                    startDay to startDay.plusDays(days.toLong() - 1)
                }
                MapPeriod.MONTH -> {
                    val monthStart = now.withDayOfMonth(1).plusMonths(offset.toLong())
                    monthStart to monthStart.plusMonths(1).minusDays(1)
                }
                MapPeriod.QUARTER -> {
                    val currentQuarterStart = now.withDayOfMonth(1).withMonth(((now.monthValue - 1) / 3) * 3 + 1)
                    val quarterStart = currentQuarterStart.plusMonths((offset * 3).toLong())
                    quarterStart to quarterStart.plusMonths(3).minusDays(1)
                }
                MapPeriod.YEAR -> {
                    val yearStart = LocalDate.of(now.year + offset, 1, 1)
                    yearStart to LocalDate.of(now.year + offset, 12, 31)
                }
                else -> null to null
            }

            if (period == MapPeriod.NEXT_HOUR) {
                // For NEXT_HOUR, filter by actual datetime within the next 60 minutes
                val nowInstant = Instant.now()
                val oneHourLater = nowInstant.plus(1, ChronoUnit.HOURS)
                filtered = filtered.filter { item ->
                    chitInTimeRange(item.entity, nowInstant, oneHourLater)
                }
            } else if (start != null && end != null) {
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

    /**
     * Check if a chit falls within a specific time range (used for NEXT_HOUR filter).
     * Parses datetime strings and checks if any fall between start and end instants.
     */
    private fun chitInTimeRange(chit: ChitEntity, start: Instant, end: Instant): Boolean {
        val dates = listOfNotNull(chit.startDatetime, chit.dueDatetime, chit.pointInTime)
        if (dates.isEmpty()) return false // No dates = don't show for time-specific filter

        return dates.any { dateStr ->
            try {
                val instant = Instant.parse(dateStr)
                !instant.isBefore(start) && !instant.isAfter(end)
            } catch (_: Exception) {
                try {
                    // Try parsing as LocalDateTime and converting to instant in system zone
                    val ldt = LocalDateTime.parse(dateStr.take(19))
                    val instant = ldt.atZone(ZoneId.systemDefault()).toInstant()
                    !instant.isBefore(start) && !instant.isAfter(end)
                } catch (_: Exception) {
                    // Fall back to date-only check: if date is today, include it
                    try {
                        val date = LocalDate.parse(dateStr.take(10))
                        date == LocalDate.now()
                    } catch (_: Exception) {
                        false
                    }
                }
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
            MapPeriod.NEXT_HOUR -> "Next Hour"
            MapPeriod.TODAY -> {
                val day = now.plusDays(offset.toLong())
                "${months[day.monthValue - 1]} ${day.dayOfMonth}"
            }
            MapPeriod.DAY -> {
                val day = now.plusDays(offset.toLong())
                "${months[day.monthValue - 1]} ${day.dayOfMonth}"
            }
            MapPeriod.WEEK -> {
                val startOfWeek = now.minusDays(now.dayOfWeek.value.toLong() % 7).plusWeeks(offset.toLong())
                val endOfWeek = startOfWeek.plusDays(6)
                "${months[startOfWeek.monthValue - 1]} ${startOfWeek.dayOfMonth} — ${months[endOfWeek.monthValue - 1]} ${endOfWeek.dayOfMonth}"
            }
            MapPeriod.NEXT_X_DAYS -> {
                val days = _customDaysCount.value
                val startDay = now.plusDays((offset * days).toLong())
                val endDay = startDay.plusDays(days.toLong() - 1)
                "${months[startDay.monthValue - 1]} ${startDay.dayOfMonth} — ${months[endDay.monthValue - 1]} ${endDay.dayOfMonth} (${days}d)"
            }
            MapPeriod.MONTH -> {
                val monthStart = now.withDayOfMonth(1).plusMonths(offset.toLong())
                "${months[monthStart.monthValue - 1]} ${monthStart.year}"
            }
            MapPeriod.QUARTER -> {
                val currentQuarterStart = now.withDayOfMonth(1).withMonth(((now.monthValue - 1) / 3) * 3 + 1)
                val quarterStart = currentQuarterStart.plusMonths((offset * 3).toLong())
                val quarterEnd = quarterStart.plusMonths(3).minusDays(1)
                val qNum = ((quarterStart.monthValue - 1) / 3) + 1
                "Q$qNum ${quarterStart.year} (${months[quarterStart.monthValue - 1]} — ${months[quarterEnd.monthValue - 1]})"
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

/**
 * Internal wrapper that pairs a ChitMarker (contact type) with its source ContactEntity for filtering.
 */
private data class ContactMarkerWithEntity(
    val marker: ChitMarker,
    val entity: ContactEntity
)
