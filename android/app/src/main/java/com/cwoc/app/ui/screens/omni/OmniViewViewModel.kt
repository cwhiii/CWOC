package com.cwoc.app.ui.screens.omni

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import javax.inject.Inject

// ─── Models ─────────────────────────────────────────────────────────────────────

enum class OmniSectionType {
    HST, WEATHER, HST_WEATHER, HST_TEMP_STRIP,
    CHRONO_ANCHORED, REMINDERS, ON_DECK, SOON,
    EMAIL, PINNED_NOTES, PINNED_CHECKLISTS, PINNED_ALL
}

data class OmniSection(
    val type: OmniSectionType,
    val visible: Boolean,
    val order: Int,
    val hideWhenEmpty: Boolean = false
)

/**
 * Data class for an HST (Horizontal Strip Timeline) item.
 * Represents a chit event positioned on the 24-hour timeline.
 */
data class HstItem(
    val chitId: String,
    val title: String,
    val startTime: String,
    val endTime: String?,
    val positionPercent: Float, // 0-100 position on the 24h bar
    val icon: String // emoji icon based on chit type
)

/**
 * Data class for weather summary shown in the Omni Weather section.
 */
data class OmniWeatherData(
    val locationName: String,
    val currentTemp: Double?,
    val tempHigh: Double?,
    val tempLow: Double?,
    val conditions: String,
    val weatherCode: Int?,
    val hourlyForecast: List<OmniHourlyForecast>
)

/**
 * A single hour's forecast for the weather strip.
 */
data class OmniHourlyForecast(
    val hour: String, // e.g. "2 PM"
    val temp: Double?,
    val weatherCode: Int?
)

/**
 * Serialization model for persisted layout config (matches server omni_layout JSON).
 */
data class OmniLayoutConfig(
    val id: String,
    val visible: Boolean,
    val position: Int,
    val hideWhenEmpty: Boolean = true
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class OmniViewViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val settingsRepository: SettingsRepository,
    private val apiService: CwocApiService
) : ViewModel() {

    private val gson = Gson()

    private val _sections = MutableStateFlow(defaultSections())
    val sections: StateFlow<List<OmniSection>> = _sections.asStateFlow()

    private val _chronoAnchored = MutableStateFlow<List<ChitEntity>>(emptyList())
    val chronoAnchored: StateFlow<List<ChitEntity>> = _chronoAnchored.asStateFlow()

    private val _reminders = MutableStateFlow<List<ChitEntity>>(emptyList())
    val reminders: StateFlow<List<ChitEntity>> = _reminders.asStateFlow()

    private val _onDeck = MutableStateFlow<List<ChitEntity>>(emptyList())
    val onDeck: StateFlow<List<ChitEntity>> = _onDeck.asStateFlow()

    private val _soon = MutableStateFlow<List<ChitEntity>>(emptyList())
    val soon: StateFlow<List<ChitEntity>> = _soon.asStateFlow()

    private val _pinnedNotes = MutableStateFlow<List<ChitEntity>>(emptyList())
    val pinnedNotes: StateFlow<List<ChitEntity>> = _pinnedNotes.asStateFlow()

    private val _pinnedChecklists = MutableStateFlow<List<ChitEntity>>(emptyList())
    val pinnedChecklists: StateFlow<List<ChitEntity>> = _pinnedChecklists.asStateFlow()

    // ─── New section state flows (Wave 8) ───────────────────────────────────

    private val _hstItems = MutableStateFlow<List<HstItem>>(emptyList())
    val hstItems: StateFlow<List<HstItem>> = _hstItems.asStateFlow()

    private val _weatherData = MutableStateFlow<OmniWeatherData?>(null)
    val weatherData: StateFlow<OmniWeatherData?> = _weatherData.asStateFlow()

    private val _emailChits = MutableStateFlow<List<ChitEntity>>(emptyList())
    val emailChits: StateFlow<List<ChitEntity>> = _emailChits.asStateFlow()

    private val _pinnedAll = MutableStateFlow<List<ChitEntity>>(emptyList())
    val pinnedAll: StateFlow<List<ChitEntity>> = _pinnedAll.asStateFlow()

    private val _emailPageSize = MutableStateFlow(5)
    val emailPageSize: StateFlow<Int> = _emailPageSize.asStateFlow()

    private val _emailExpanded = MutableStateFlow(false)
    val emailExpanded: StateFlow<Boolean> = _emailExpanded.asStateFlow()

    private val _hasEmailConfigured = MutableStateFlow(false)
    val hasEmailConfigured: StateFlow<Boolean> = _hasEmailConfigured.asStateFlow()

    private val _showLayoutDialog = MutableStateFlow(false)
    val showLayoutDialog: StateFlow<Boolean> = _showLayoutDialog.asStateFlow()

    init {
        loadSectionConfig()
        observeChits()
        loadWeatherData()
    }

    // ─── Public actions ─────────────────────────────────────────────────────

    fun toggleEmailExpanded() {
        _emailExpanded.value = !_emailExpanded.value
    }

    fun openLayoutDialog() {
        _showLayoutDialog.value = true
    }

    fun closeLayoutDialog() {
        _showLayoutDialog.value = false
    }

    /**
     * Save updated layout configuration. Persists to settings and pushes to server.
     */
    fun saveLayout(updatedSections: List<OmniSection>) {
        _sections.value = updatedSections
        _showLayoutDialog.value = false
        viewModelScope.launch {
            try {
                val settings = settingsRepository.get() ?: return@launch
                val layoutConfigs = updatedSections.map { section ->
                    OmniLayoutConfig(
                        id = sectionTypeToId(section.type),
                        visible = section.visible,
                        position = section.order,
                        hideWhenEmpty = section.hideWhenEmpty
                    )
                }
                val layoutJson = gson.toJson(layoutConfigs)
                val updatedSettings = settings.copy(omniLayout = layoutJson)
                settingsRepository.update(updatedSettings)
            } catch (_: Exception) {
                // Silently fail — layout is already applied locally
            }
        }
    }

    /**
     * Loads section configuration from settings omni_layout JSON.
     * Falls back to defaults if not configured or parse fails.
     */
    private fun loadSectionConfig() {
        viewModelScope.launch {
            try {
                val settings = settingsRepository.get()
                if (settings != null) {
                    // Check email configuration
                    _hasEmailConfigured.value = !settings.emailAccounts.isNullOrBlank() &&
                        settings.emailAccounts != "[]" && settings.emailAccounts != "null"

                    // Load email page size
                    settings.omniEmailCount?.toIntOrNull()?.let { count ->
                        _emailPageSize.value = count
                    }

                    // Parse omni layout
                    val layoutJson = settings.omniLayout
                    if (!layoutJson.isNullOrBlank() && layoutJson != "null") {
                        val type = object : TypeToken<List<OmniLayoutConfig>>() {}.type
                        val configs: List<OmniLayoutConfig> = gson.fromJson(layoutJson, type)
                        if (configs.isNotEmpty()) {
                            _sections.value = configs.mapNotNull { config ->
                                val sectionType = idToSectionType(config.id) ?: return@mapNotNull null
                                OmniSection(
                                    type = sectionType,
                                    visible = config.visible,
                                    order = config.position,
                                    hideWhenEmpty = config.hideWhenEmpty
                                )
                            }.sortedBy { it.order }
                            return@launch
                        }
                    }
                }
                _sections.value = defaultSections()
            } catch (_: Exception) {
                _sections.value = defaultSections()
            }
        }
    }

    /**
     * Fetches weather data from the server for the Omni Weather section.
     * Uses the first saved location's forecast.
     */
    private fun loadWeatherData() {
        viewModelScope.launch {
            try {
                val response = apiService.getWeatherForecasts()
                if (response.isSuccessful) {
                    val body = response.body()
                    val firstLocation = body?.locations?.firstOrNull()
                    if (firstLocation != null && firstLocation.daily != null) {
                        val daily = firstLocation.daily
                        val todayForecast = if (!daily.time.isNullOrEmpty()) {
                            val todayIdx = 0 // First day is today
                            OmniWeatherData(
                                locationName = firstLocation.label,
                                currentTemp = daily.temperature_2m_max?.getOrNull(todayIdx),
                                tempHigh = daily.temperature_2m_max?.getOrNull(todayIdx),
                                tempLow = daily.temperature_2m_min?.getOrNull(todayIdx),
                                conditions = weatherCodeToCondition(
                                    daily.weathercode?.getOrNull(todayIdx)
                                ),
                                weatherCode = daily.weathercode?.getOrNull(todayIdx),
                                hourlyForecast = buildHourlyForecast(daily, todayIdx)
                            )
                        } else null
                        _weatherData.value = todayForecast
                    }
                }
            } catch (_: Exception) {
                // Weather is optional — don't crash if unavailable
            }
        }
    }

    /**
     * Builds a synthetic hourly forecast from daily data.
     * Since we only have daily data from the forecasts endpoint,
     * we create a 5-hour strip using interpolated temps from today and tomorrow.
     */
    private fun buildHourlyForecast(
        daily: com.cwoc.app.ui.screens.weather.DailyDataDto,
        todayIdx: Int
    ): List<OmniHourlyForecast> {
        val now = LocalDateTime.now()
        val currentHour = now.hour
        val todayHigh = daily.temperature_2m_max?.getOrNull(todayIdx)
        val todayLow = daily.temperature_2m_min?.getOrNull(todayIdx)
        val todayCode = daily.weathercode?.getOrNull(todayIdx)

        if (todayHigh == null && todayLow == null) return emptyList()

        // Generate 5 hours starting from current hour
        return (0 until 5).map { offset ->
            val hour = (currentHour + offset) % 24
            val hourLabel = when {
                hour == 0 -> "12 AM"
                hour < 12 -> "$hour AM"
                hour == 12 -> "12 PM"
                else -> "${hour - 12} PM"
            }
            // Simple interpolation: morning hours lean toward low, afternoon toward high
            val temp = if (todayHigh != null && todayLow != null) {
                val factor = when {
                    hour < 6 -> 0.1
                    hour < 10 -> 0.3
                    hour < 14 -> 0.8
                    hour < 18 -> 1.0
                    hour < 22 -> 0.6
                    else -> 0.2
                }
                todayLow + (todayHigh - todayLow) * factor
            } else todayHigh ?: todayLow

            OmniHourlyForecast(
                hour = hourLabel,
                temp = temp,
                weatherCode = todayCode
            )
        }
    }

    /**
     * Observes all non-deleted chits and filters them into the appropriate sections.
     */
    private fun observeChits() {
        viewModelScope.launch {
            chitRepository.getAllNonDeleted().collect { allChits ->
                val now = Instant.now()
                val today = LocalDate.now()
                val zone = ZoneId.systemDefault()

                // Filter out archived and snoozed chits
                val activeChits = allChits.filter { chit ->
                    !chit.archived && !isSnoozed(chit, now)
                }

                _chronoAnchored.value = filterChronoAnchored(activeChits, today, zone)
                _reminders.value = filterReminders(activeChits, now)
                _onDeck.value = filterOnDeck(activeChits)
                _soon.value = filterSoon(activeChits, today, zone)
                _pinnedNotes.value = filterPinnedNotes(activeChits)
                _pinnedChecklists.value = filterPinnedChecklists(activeChits)
                _hstItems.value = filterHstItems(activeChits, now, zone)
                _emailChits.value = filterEmailChits(allChits)
                _pinnedAll.value = filterPinnedAll(activeChits)
            }
        }
    }

    /**
     * HST Items: chits with startDatetime in the next 24 hours, positioned on timeline.
     */
    private fun filterHstItems(
        chits: List<ChitEntity>,
        now: Instant,
        zone: ZoneId
    ): List<HstItem> {
        val next24h = now.plus(24, ChronoUnit.HOURS)
        val todayStart = LocalDate.now().atStartOfDay(zone).toInstant()
        val todayEnd = todayStart.plus(24, ChronoUnit.HOURS)

        return chits.filter { chit ->
            val startDt = chit.startDatetime ?: return@filter false
            if (chit.allDay) return@filter false
            val startInstant = parseToInstant(startDt) ?: return@filter false
            startInstant.isAfter(todayStart) && startInstant.isBefore(todayEnd)
        }.mapNotNull { chit ->
            val startInstant = parseToInstant(chit.startDatetime!!) ?: return@mapNotNull null
            val startLdt = startInstant.atZone(zone).toLocalDateTime()
            val totalMinutes = startLdt.hour * 60.0 + startLdt.minute
            val pct = (totalMinutes / 1440.0 * 100.0).toFloat().coerceIn(0f, 100f)

            val icon = getChitIcon(chit)

            HstItem(
                chitId = chit.id,
                title = chit.title ?: "Untitled",
                startTime = formatHstTime(startLdt),
                endTime = chit.endDatetime?.let { end ->
                    parseToInstant(end)?.atZone(zone)?.toLocalDateTime()?.let { formatHstTime(it) }
                },
                positionPercent = pct,
                icon = icon
            )
        }.sortedBy { it.positionPercent }
    }

    /**
     * Email: chits with emailMessageId, in Inbox, unread, sorted by date desc.
     */
    private fun filterEmailChits(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            !chit.deleted &&
                !chit.emailMessageId.isNullOrBlank() &&
                chit.emailRead != true &&
                (chit.emailFolder?.contains("Inbox", ignoreCase = true) == true ||
                    chit.tags?.any { it.equals("Inbox", ignoreCase = true) } == true)
        }.sortedByDescending { it.emailDate ?: it.createdDatetime }
    }

    /**
     * Pinned All: all pinned chits regardless of type, sorted by modified date.
     */
    private fun filterPinnedAll(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { it.pinned }
            .sortedByDescending { it.modifiedDatetime }
    }

    /**
     * Chrono Anchored: today's timed events (has startDatetime today, not all-day).
     */
    private fun filterChronoAnchored(
        chits: List<ChitEntity>,
        today: LocalDate,
        zone: ZoneId
    ): List<ChitEntity> {
        return chits.filter { chit ->
            val startDt = chit.startDatetime ?: return@filter false
            if (chit.allDay) return@filter false
            val chitDate = parseToLocalDate(startDt, zone) ?: return@filter false
            chitDate == today
        }.sortedBy { it.startDatetime }
    }

    /**
     * Reminders: chits with alerts in the next 24 hours.
     */
    private fun filterReminders(
        chits: List<ChitEntity>,
        now: Instant
    ): List<ChitEntity> {
        val next24h = now.plus(24, ChronoUnit.HOURS)

        return chits.filter { chit ->
            val alertsJson = chit.alerts ?: return@filter false
            if (alertsJson.isBlank() || alertsJson == "[]" || alertsJson == "null") return@filter false

            try {
                val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
                val alerts: List<Map<String, Any?>> = gson.fromJson(alertsJson, type)
                    ?: return@filter false

                alerts.any { alert ->
                    val absoluteTime = alert["absoluteTime"] as? String
                    val offsetMinutes = (alert["offsetMinutes"] as? Number)?.toInt()

                    when {
                        absoluteTime != null && absoluteTime.isNotBlank() -> {
                            val alertInstant = parseToInstant(absoluteTime)
                            alertInstant != null && alertInstant.isAfter(now) && alertInstant.isBefore(next24h)
                        }
                        offsetMinutes != null && chit.startDatetime != null -> {
                            val startInstant = parseToInstant(chit.startDatetime)
                            if (startInstant != null) {
                                val alertInstant = startInstant.minus(offsetMinutes.toLong(), ChronoUnit.MINUTES)
                                alertInstant.isAfter(now) && alertInstant.isBefore(next24h)
                            } else false
                        }
                        else -> false
                    }
                }
            } catch (_: Exception) {
                false
            }
        }.sortedBy { it.startDatetime ?: it.dueDatetime }
    }

    /**
     * On Deck: next 5 tasks by due date (status != Complete).
     */
    private fun filterOnDeck(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            chit.status != null &&
                chit.status != "Complete" &&
                chit.dueDatetime != null
        }
            .sortedBy { it.dueDatetime }
            .take(5)
    }

    /**
     * Soon: tasks due within 7 days (status != Complete).
     */
    private fun filterSoon(
        chits: List<ChitEntity>,
        today: LocalDate,
        zone: ZoneId
    ): List<ChitEntity> {
        val sevenDaysFromNow = today.plusDays(7)

        return chits.filter { chit ->
            if (chit.status == null || chit.status == "Complete") return@filter false
            val dueDt = chit.dueDatetime ?: return@filter false
            val dueDate = parseToLocalDate(dueDt, zone) ?: return@filter false
            dueDate.isAfter(today) && !dueDate.isAfter(sevenDaysFromNow)
        }.sortedBy { it.dueDatetime }
    }

    /**
     * Pinned Notes: pinned=true, has note content, no checklist.
     */
    private fun filterPinnedNotes(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            chit.pinned &&
                !chit.note.isNullOrBlank() &&
                (chit.checklist.isNullOrBlank() || chit.checklist == "[]" || chit.checklist == "null")
        }.sortedByDescending { it.modifiedDatetime }
    }

    /**
     * Pinned Checklists: pinned=true, has checklist content.
     */
    private fun filterPinnedChecklists(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            chit.pinned &&
                !chit.checklist.isNullOrBlank() &&
                chit.checklist != "[]" &&
                chit.checklist != "null"
        }.sortedByDescending { it.modifiedDatetime }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private fun isSnoozed(chit: ChitEntity, now: Instant): Boolean {
        val snoozedUntil = chit.snoozedUntil ?: return false
        val snoozeInstant = parseToInstant(snoozedUntil) ?: return false
        return now.isBefore(snoozeInstant)
    }

    private fun parseToLocalDate(dateStr: String, zone: ZoneId): LocalDate? {
        return try {
            val ldt = LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ldt.toLocalDate()
        } catch (_: Exception) {
            try {
                LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            } catch (_: Exception) {
                try {
                    val instant = Instant.parse(dateStr)
                    instant.atZone(zone).toLocalDate()
                } catch (_: Exception) {
                    null
                }
            }
        }
    }

    private fun parseToInstant(dateStr: String): Instant? {
        return try {
            Instant.parse(dateStr)
        } catch (_: Exception) {
            try {
                val ldt = LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                ldt.atZone(ZoneId.systemDefault()).toInstant()
            } catch (_: Exception) {
                null
            }
        }
    }

    private fun formatHstTime(ldt: LocalDateTime): String {
        val hour = ldt.hour
        val minute = ldt.minute
        val amPm = if (hour < 12) "AM" else "PM"
        val displayHour = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        return if (minute == 0) "$displayHour $amPm" else "$displayHour:${minute.toString().padStart(2, '0')} $amPm"
    }

    private fun getChitIcon(chit: ChitEntity): String {
        return when {
            chit.isProjectMaster -> "📁"
            !chit.checklist.isNullOrBlank() && chit.checklist != "[]" -> "☑️"
            chit.alarm == true || chit.notification == true -> "🔔"
            chit.status != null -> "📋"
            !chit.note.isNullOrBlank() -> "📝"
            !chit.emailMessageId.isNullOrBlank() -> "✉️"
            else -> "📌"
        }
    }

    /**
     * Returns the type indicator icon for a pinned chit in the Pinned All section.
     */
    fun getPinnedTypeIcon(chit: ChitEntity): String {
        return when {
            !chit.checklist.isNullOrBlank() && chit.checklist != "[]" && chit.checklist != "null" -> "☑️"
            !chit.note.isNullOrBlank() -> "📝"
            chit.status != null -> "📋"
            chit.isProjectMaster -> "📁"
            !chit.emailMessageId.isNullOrBlank() -> "✉️"
            else -> "📌"
        }
    }

    companion object {
        /**
         * Default section configuration matching the web app's default Omni View layout.
         */
        fun defaultSections(): List<OmniSection> = listOf(
            OmniSection(OmniSectionType.HST, visible = true, order = 0, hideWhenEmpty = true),
            OmniSection(OmniSectionType.WEATHER, visible = true, order = 1, hideWhenEmpty = true),
            OmniSection(OmniSectionType.HST_WEATHER, visible = false, order = 2, hideWhenEmpty = true),
            OmniSection(OmniSectionType.HST_TEMP_STRIP, visible = false, order = 3, hideWhenEmpty = true),
            OmniSection(OmniSectionType.CHRONO_ANCHORED, visible = true, order = 4, hideWhenEmpty = true),
            OmniSection(OmniSectionType.REMINDERS, visible = true, order = 5, hideWhenEmpty = true),
            OmniSection(OmniSectionType.ON_DECK, visible = true, order = 6),
            OmniSection(OmniSectionType.SOON, visible = true, order = 7),
            OmniSection(OmniSectionType.EMAIL, visible = true, order = 8, hideWhenEmpty = true),
            OmniSection(OmniSectionType.PINNED_NOTES, visible = true, order = 9),
            OmniSection(OmniSectionType.PINNED_CHECKLISTS, visible = true, order = 10),
            OmniSection(OmniSectionType.PINNED_ALL, visible = false, order = 11)
        )

        fun sectionTypeToId(type: OmniSectionType): String = when (type) {
            OmniSectionType.HST -> "hst"
            OmniSectionType.WEATHER -> "weather"
            OmniSectionType.HST_WEATHER -> "hst_weather"
            OmniSectionType.HST_TEMP_STRIP -> "hst_temp_strip"
            OmniSectionType.CHRONO_ANCHORED -> "chrono"
            OmniSectionType.REMINDERS -> "reminders"
            OmniSectionType.ON_DECK -> "on_deck"
            OmniSectionType.SOON -> "soon"
            OmniSectionType.EMAIL -> "email"
            OmniSectionType.PINNED_NOTES -> "pinned_notes"
            OmniSectionType.PINNED_CHECKLISTS -> "pinned_checklists"
            OmniSectionType.PINNED_ALL -> "pinned_all"
        }

        fun idToSectionType(id: String): OmniSectionType? = when (id) {
            "hst" -> OmniSectionType.HST
            "weather" -> OmniSectionType.WEATHER
            "hst_weather" -> OmniSectionType.HST_WEATHER
            "hst_temp_strip" -> OmniSectionType.HST_TEMP_STRIP
            "chrono" -> OmniSectionType.CHRONO_ANCHORED
            "reminders" -> OmniSectionType.REMINDERS
            "on_deck" -> OmniSectionType.ON_DECK
            "soon" -> OmniSectionType.SOON
            "email" -> OmniSectionType.EMAIL
            "pinned_notes" -> OmniSectionType.PINNED_NOTES
            "pinned_checklists" -> OmniSectionType.PINNED_CHECKLISTS
            "pinned_all" -> OmniSectionType.PINNED_ALL
            else -> null
        }

        fun sectionDisplayName(type: OmniSectionType): String = when (type) {
            OmniSectionType.HST -> "HST Bar"
            OmniSectionType.WEATHER -> "Weather"
            OmniSectionType.HST_WEATHER -> "HST + Weather"
            OmniSectionType.HST_TEMP_STRIP -> "HST Weather Strip"
            OmniSectionType.CHRONO_ANCHORED -> "Chrono Anchored"
            OmniSectionType.REMINDERS -> "Reminders"
            OmniSectionType.ON_DECK -> "On Deck"
            OmniSectionType.SOON -> "Soon"
            OmniSectionType.EMAIL -> "Email"
            OmniSectionType.PINNED_NOTES -> "Pinned Notes"
            OmniSectionType.PINNED_CHECKLISTS -> "Pinned Checklists"
            OmniSectionType.PINNED_ALL -> "Pinned All"
        }
    }

}

/**
 * Maps WMO weather codes to human-readable condition strings.
 */
fun weatherCodeToCondition(code: Int?): String {
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

/**
 * Maps WMO weather codes to emoji icons for display.
 */
fun weatherCodeToIcon(code: Int?): String {
    return when (code) {
        0 -> "☀️"
        1 -> "🌤️"
        2 -> "⛅"
        3 -> "☁️"
        45, 48 -> "🌫️"
        51, 53, 55 -> "🌦️"
        56, 57 -> "🌧️"
        61, 63, 65 -> "🌧️"
        66, 67 -> "🌧️"
        71, 73, 75 -> "❄️"
        77 -> "❄️"
        80, 81, 82 -> "🌧️"
        85, 86 -> "🌨️"
        95 -> "⛈️"
        96, 99 -> "⛈️"
        else -> "🌡️"
    }
}
