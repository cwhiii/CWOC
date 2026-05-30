package com.cwoc.app.widget.refresh

import android.content.Context
import android.graphics.Color
import androidx.room.Room
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.cwoc.app.data.local.CwocDatabase
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.migration.MIGRATION_1_2
import com.cwoc.app.data.local.migration.MIGRATION_2_3
import com.cwoc.app.data.local.migration.MIGRATION_3_4
import com.cwoc.app.data.local.migration.MIGRATION_4_5
import com.cwoc.app.data.local.migration.MIGRATION_5_6
import com.cwoc.app.data.local.migration.MIGRATION_6_7
import com.cwoc.app.data.local.migration.MIGRATION_7_8
import com.cwoc.app.data.local.migration.MIGRATION_8_9
import com.cwoc.app.data.local.migration.MIGRATION_9_10
import com.cwoc.app.data.local.migration.MIGRATION_10_11
import com.cwoc.app.data.local.migration.MIGRATION_11_12
import com.cwoc.app.data.local.migration.MIGRATION_12_13
import com.cwoc.app.data.local.migration.MIGRATION_13_14
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Simple data class for widget calendar items.
 */
data class WidgetCalendarItem(
    val id: String,
    val title: String?,
    val time: String?
)

/**
 * Simple data class for widget task items.
 */
data class WidgetTaskItem(
    val id: String,
    val title: String?,
    val dueDate: String?
)

/**
 * Provides data for home screen widgets by reading directly from Room.
 * No network calls — reads exclusively from the local database
 * (except getWeatherData which fetches from Open-Meteo API).
 */
object WidgetDataProvider {

    private const val DEFAULT_ACCENT_COLOR = 0xFF6b4e31.toInt()

    private fun getDatabase(context: Context): CwocDatabase {
        return Room.databaseBuilder(
            context.applicationContext,
            CwocDatabase::class.java,
            "cwoc.db"
        )
            .addMigrations(
                MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4,
                MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7,
                MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10,
                MIGRATION_10_11, MIGRATION_11_12, MIGRATION_12_13,
                MIGRATION_13_14
            )
            .build()
    }

    // ─── Existing Methods ────────────────────────────────────────────────────

    /**
     * Get today's calendar chits sorted by start time.
     */
    suspend fun getTodayCalendarChits(context: Context): List<WidgetCalendarItem> {
        val db = getDatabase(context)
        return try {
            val today = LocalDate.now()
            val dayStart = today.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            val dayEnd = today.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

            db.chitDao().getChitsForDaySuspend(dayStart, dayEnd)
                .map { chit ->
                    val time = chit.startDatetime?.let {
                        try {
                            // Strip timezone offset before parsing
                            var s = it.trimEnd()
                            if (s.endsWith("Z", ignoreCase = true)) s = s.dropLast(1)
                            else s = s.replace(Regex("[+-]\\d{2}:\\d{2}$"), "")
                            val dt = LocalDateTime.parse(s)
                            dt.format(DateTimeFormatter.ofPattern("h:mm a"))
                        } catch (_: Exception) { null }
                    }
                    WidgetCalendarItem(
                        id = chit.id,
                        title = chit.title,
                        time = if (chit.allDay) "All day" else time
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    /**
     * Get up to 5 upcoming tasks (ToDo or In Progress) sorted by due date.
     */
    suspend fun getUpcomingTasks(context: Context): List<WidgetTaskItem> {
        val db = getDatabase(context)
        return try {
            db.chitDao().getUpcomingTasksSuspend()
                .map { chit ->
                    val due = chit.dueDatetime?.let {
                        try {
                            val dt = LocalDateTime.parse(it)
                            dt.format(DateTimeFormatter.ofPattern("MMM d"))
                        } catch (_: Exception) { null }
                    }
                    WidgetTaskItem(
                        id = chit.id,
                        title = chit.title,
                        dueDate = due
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    // ─── Omni View Widget ────────────────────────────────────────────────────

    /**
     * Queries non-deleted chits respecting Omni View settings from the settings table.
     * Returns up to [limit] WidgetOmniItems (max 20).
     *
     * Respects the user's omniLockedFilters (locked filter defaults) from settings.
     * Sorts by priority descending, then by modified date descending.
     */
    suspend fun getOmniViewChits(context: Context, limit: Int = 20): List<WidgetOmniItem> {
        val db = getDatabase(context)
        return try {
            val settings = db.settingsDao().get()
            val lockedFilters = parseLockedFilters(settings?.omniLockedFilters)

            val allChits = db.chitDao().getAllNonDeletedSnapshot()
                .filter { !it.archived }

            // Apply locked filters if any
            val filtered = applyOmniFilters(allChits, lockedFilters)

            // Sort by priority descending, then modified date descending
            filtered
                .sortedWith(
                    compareByDescending<ChitEntity> { priorityWeight(it.priority) }
                        .thenByDescending { it.modifiedDatetime }
                )
                .take(limit.coerceAtMost(20))
                .map { chit ->
                    WidgetOmniItem(
                        id = chit.id,
                        title = chit.title,
                        categoryColor = resolveChitCategoryColor(chit),
                        statusIcon = chit.status,
                        dueDate = chit.dueDatetime?.let { formatShortDate(it) },
                        priority = chit.priority
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    // ─── Checklist Widget ────────────────────────────────────────────────────

    /**
     * Parses checklist JSON for a specific chit, returns WidgetChecklistItem list
     * with depth calculation. Supports nested items up to depth 2.
     * Only returns incomplete (unchecked) items for the widget display.
     */
    suspend fun getChecklistItems(context: Context, chitId: String): List<WidgetChecklistItem> {
        val db = getDatabase(context)
        return try {
            val chit = db.chitDao().getById(chitId) ?: return emptyList()
            val checklistJson = chit.checklist
            if (checklistJson.isNullOrBlank() || checklistJson == "[]") return emptyList()
            parseChecklistJson(checklistJson).filter { !it.checked }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    /**
     * Returns all non-deleted chits that have checklist data.
     */
    suspend fun getChecklistChits(context: Context): List<WidgetChecklistSummary> {
        val db = getDatabase(context)
        return try {
            db.chitDao().getAllNonDeletedSnapshot()
                .filter { chit ->
                    !chit.archived &&
                    !chit.checklist.isNullOrBlank() &&
                    chit.checklist != "[]"
                }
                .map { chit ->
                    WidgetChecklistSummary(
                        chitId = chit.id,
                        title = chit.title
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    /**
     * Flips the checked state at [itemIndex] in the checklist JSON for [chitId].
     * Marks the chit as dirty and returns true on success, false on failure.
     */
    suspend fun toggleChecklistItem(context: Context, chitId: String, itemIndex: Int): Boolean {
        val db = getDatabase(context)
        return try {
            val chit = db.chitDao().getById(chitId) ?: return false
            val checklistJson = chit.checklist
            if (checklistJson.isNullOrBlank() || checklistJson == "[]") return false

            val array = JSONArray(checklistJson)
            if (itemIndex < 0 || itemIndex >= array.length()) return false

            val item = array.getJSONObject(itemIndex)
            val currentChecked = item.optBoolean("checked", false)
            item.put("checked", !currentChecked)
            array.put(itemIndex, item)

            val updatedChecklist = array.toString()
            val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            val updatedChit = chit.copy(
                checklist = updatedChecklist,
                modifiedDatetime = now,
                isDirty = true,
                dirtyFields = addDirtyField(chit.dirtyFields, "checklist")
            )
            db.chitDao().upsert(updatedChit)
            true
        } catch (_: Exception) {
            false
        } finally {
            db.close()
        }
    }

    // ─── Upcoming Alarms Widget ──────────────────────────────────────────────

    /**
     * Returns the next [limit] future alarms sorted by trigger time ascending.
     * Parses the alerts JSON field on each chit to find alarm trigger times.
     */
    suspend fun getUpcomingAlarms(context: Context, limit: Int = 3): List<WidgetAlarmItem> {
        val db = getDatabase(context)
        return try {
            val now = System.currentTimeMillis()
            val chitsWithAlerts = db.chitDao().getChitsWithAlerts()

            val alarmItems = mutableListOf<WidgetAlarmItem>()
            for (chit in chitsWithAlerts) {
                val alerts = chit.alerts ?: continue
                if (alerts.isBlank() || alerts == "[]") continue

                val triggerTime = parseNextAlarmTrigger(chit, now) ?: continue
                if (triggerTime <= now) continue

                val secondsRemaining = (triggerTime - now) / 1000
                alarmItems.add(
                    WidgetAlarmItem(
                        chitId = chit.id,
                        title = chit.title?.let { WidgetUtils.truncateTitle(it, 30) },
                        triggerTime = triggerTime,
                        countdownText = WidgetUtils.formatCountdown(secondsRemaining)
                    )
                )
            }

            alarmItems
                .sortedBy { it.triggerTime }
                .take(limit.coerceAtMost(3))
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    // ─── Project Progress Widget ─────────────────────────────────────────────

    /**
     * Calculates completion ratio from child chits for a given project.
     * Returns null if the project doesn't exist or is deleted.
     */
    suspend fun getProjectProgress(context: Context, projectId: String): WidgetProjectProgress? {
        val db = getDatabase(context)
        return try {
            val project = db.chitDao().getById(projectId) ?: return null
            if (project.deleted || !project.isProjectMaster) return null

            val childIds = project.childChits ?: emptyList()
            val totalCount: Int
            val completedCount: Int

            if (childIds.isEmpty()) {
                totalCount = 0
                completedCount = 0
            } else {
                val children = db.chitDao().getChitsByIds(childIds)
                    .filter { !it.deleted }
                totalCount = children.size
                completedCount = children.count { it.status == "Complete" }
            }

            val progressPercent = if (totalCount > 0) {
                completedCount.toFloat() / totalCount.toFloat()
            } else {
                0f
            }

            val hstColor = resolveProjectColor(project)

            WidgetProjectProgress(
                projectId = projectId,
                title = project.title,
                completedCount = completedCount,
                totalCount = totalCount,
                progressPercent = progressPercent,
                hstColor = hstColor
            )
        } catch (_: Exception) {
            null
        } finally {
            db.close()
        }
    }

    /**
     * Returns all non-deleted project chits for the config activity selection list.
     */
    suspend fun getProjectChits(context: Context): List<WidgetProjectSummary> {
        val db = getDatabase(context)
        return try {
            db.chitDao().getAllNonDeletedSnapshot()
                .filter { it.isProjectMaster && !it.archived }
                .map { chit ->
                    WidgetProjectSummary(
                        chitId = chit.id,
                        title = chit.title
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    // ─── Weather Widget ──────────────────────────────────────────────────────

    /**
     * Fetches weather from Open-Meteo API for given coordinates.
     * The [locationKey] format is "lat,lon" (e.g., "47.6062,-122.3321").
     *
     * Returns null if the fetch fails and no cached data is available.
     */
    suspend fun getWeatherData(context: Context, locationKey: String): WidgetWeatherData? {
        return try {
            val parts = locationKey.split(",")
            if (parts.size != 2) return null
            val lat = parts[0].trim()
            val lon = parts[1].trim()

            // Determine unit system from settings
            val db = getDatabase(context)
            val unitSystem = try {
                db.settingsDao().get()?.unitSystem ?: "imperial"
            } finally {
                db.close()
            }

            val tempUnit = if (unitSystem == "metric") "celsius" else "fahrenheit"
            val urlStr = "https://api.open-meteo.com/v1/forecast" +
                "?latitude=$lat&longitude=$lon" +
                "&current_weather=true" +
                "&temperature_unit=$tempUnit"

            val url = URL(urlStr)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.requestMethod = "GET"

            val responseCode = connection.responseCode
            if (responseCode != 200) return null

            val responseBody = connection.inputStream.bufferedReader().readText()
            val json = JSONObject(responseBody)
            val currentWeather = json.getJSONObject("current_weather")

            val temperature = currentWeather.getDouble("temperature")
            val wmoCode = currentWeather.getInt("weathercode")
            val unitSymbol = if (unitSystem == "metric") "°C" else "°F"
            val tempFormatted = "${temperature.toInt()}$unitSymbol"

            val conditionText = WidgetUtils.truncateTitle(
                WmoCodeMapper.getConditionText(wmoCode), 20
            )
            val weatherIcon = WmoCodeMapper.getWeatherIcon(wmoCode)
            val now = System.currentTimeMillis()

            WidgetWeatherData(
                temperature = tempFormatted,
                conditionText = conditionText,
                weatherIcon = weatherIcon,
                lastUpdated = now,
                isStale = false
            )
        } catch (_: Exception) {
            null
        }
    }

    // ─── Weekly Overview Widget ──────────────────────────────────────────────

    /**
     * Counts chits per day for a 7-day range starting at [weekStartDate].
     * A chit counts for a day if its startDatetime, dueDatetime, or pointInTime
     * falls within that day's boundaries (midnight to midnight).
     *
     * @param weekStartDate ISO date string (e.g., "2024-01-15")
     */
    suspend fun getWeeklyCounts(context: Context, weekStartDate: String): List<WidgetDayCount> {
        val db = getDatabase(context)
        return try {
            val startDate = LocalDate.parse(weekStartDate)
            val today = LocalDate.now()

            val allChits = db.chitDao().getAllNonDeletedSnapshot()
                .filter { !it.archived }

            val dayCounts = (0 until 7).map { offset ->
                val date = startDate.plusDays(offset.toLong())
                val dayStart = date.atStartOfDay()
                val dayEnd = date.plusDays(1).atStartOfDay()

                val count = allChits.count { chit ->
                    chitFallsOnDay(chit, dayStart, dayEnd)
                }

                WidgetDayCount(
                    date = date.format(DateTimeFormatter.ISO_LOCAL_DATE),
                    dayAbbrev = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()),
                    dayNumber = date.dayOfMonth,
                    chitCount = count,
                    isToday = date == today
                )
            }

            dayCounts
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    // ─── Auth Check ──────────────────────────────────────────────────────────

    /**
     * Checks EncryptedSharedPreferences for a valid auth token.
     * Returns true if a device_token is present, false otherwise.
     */
    fun isLoggedIn(context: Context): Boolean {
        return try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            val prefs = EncryptedSharedPreferences.create(
                "cwoc_secure_prefs",
                masterKeyAlias,
                context.applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            !prefs.getString("device_token", null).isNullOrBlank()
        } catch (_: Exception) {
            false
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Parses checklist JSON into a flat list of WidgetChecklistItems with depth.
     * Supports nested "items" arrays up to depth 2.
     */
    private fun parseChecklistJson(json: String): List<WidgetChecklistItem> {
        val items = mutableListOf<WidgetChecklistItem>()
        try {
            val array = JSONArray(json)
            var index = 0
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                index = addChecklistItem(obj, items, index, depth = 0)
            }
        } catch (_: Exception) { }
        return items.take(20)
    }

    /**
     * Recursively adds a checklist item and its children to the flat list.
     * Returns the next available index.
     */
    private fun addChecklistItem(
        obj: JSONObject,
        items: MutableList<WidgetChecklistItem>,
        startIndex: Int,
        depth: Int
    ): Int {
        var index = startIndex
        val text = obj.optString("text", "")
        val checked = obj.optBoolean("checked", false)

        items.add(
            WidgetChecklistItem(
                index = index,
                text = text,
                checked = checked,
                depth = depth.coerceAtMost(2)
            )
        )
        index++

        // Process nested sub-items
        val subItems = obj.optJSONArray("items")
        if (subItems != null && depth < 2) {
            for (i in 0 until subItems.length()) {
                val subObj = subItems.getJSONObject(i)
                index = addChecklistItem(subObj, items, index, depth + 1)
            }
        }

        return index
    }

    /**
     * Parses the next alarm trigger time from a chit's alerts JSON.
     * Returns epoch millis of the next future trigger, or null if none found.
     */
    private fun parseNextAlarmTrigger(chit: ChitEntity, now: Long): Long? {
        val alertsJson = chit.alerts ?: return null
        try {
            val array = JSONArray(alertsJson)
            var earliest: Long? = null

            for (i in 0 until array.length()) {
                val alert = array.getJSONObject(i)

                // Try to get absolute trigger time from the alert
                val triggerStr = alert.optString("trigger", "")
                val triggerTime = if (triggerStr.isNotBlank()) {
                    parseDateTimeToEpoch(triggerStr)
                } else {
                    // Calculate from chit's start/due time minus offset
                    val offsetMinutes = alert.optInt("offsetMinutes", 0)
                    val baseTime = chit.startDatetime ?: chit.dueDatetime ?: chit.pointInTime
                    if (baseTime != null) {
                        val baseEpoch = parseDateTimeToEpoch(baseTime)
                        if (baseEpoch != null) {
                            baseEpoch - (offsetMinutes * 60 * 1000L)
                        } else null
                    } else null
                }

                if (triggerTime != null && triggerTime > now) {
                    if (earliest == null || triggerTime < earliest) {
                        earliest = triggerTime
                    }
                }
            }
            return earliest
        } catch (_: Exception) {
            return null
        }
    }

    /**
     * Parses an ISO datetime string to epoch millis.
     */
    private fun parseDateTimeToEpoch(dateTimeStr: String): Long? {
        return try {
            val ldt = LocalDateTime.parse(dateTimeStr)
            ldt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Formats a datetime string as a short date (e.g., "Jan 15").
     * Strips timezone offset/suffix before parsing.
     */
    private fun formatShortDate(dateTimeStr: String): String? {
        return try {
            // Strip timezone offset (Z, +HH:MM, -HH:MM) before parsing
            var s = dateTimeStr.trimEnd()
            if (s.endsWith("Z", ignoreCase = true)) {
                s = s.dropLast(1)
            } else {
                s = s.replace(Regex("[+-]\\d{2}:\\d{2}$"), "")
            }
            val dt = LocalDateTime.parse(s)
            dt.format(DateTimeFormatter.ofPattern("MMM d"))
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Returns a priority weight for sorting (higher = more important).
     */
    private fun priorityWeight(priority: String?): Int {
        return when (priority?.lowercase()) {
            "critical" -> 4
            "high" -> 3
            "medium" -> 2
            "low" -> 1
            else -> 0
        }
    }

    /**
     * Resolves a category color for a chit based on its type/status.
     * Uses the chit's explicit color if set, otherwise derives from status.
     */
    private fun resolveChitCategoryColor(chit: ChitEntity): Int {
        // Use explicit color if set
        if (!chit.color.isNullOrBlank() && chit.color != "transparent") {
            return try {
                Color.parseColor(chit.color)
            } catch (_: Exception) {
                DEFAULT_ACCENT_COLOR
            }
        }

        // Derive from status
        return when (chit.status?.lowercase()) {
            "todo" -> Color.parseColor("#4A90D9")
            "in progress" -> Color.parseColor("#F5A623")
            "blocked" -> Color.parseColor("#D0021B")
            "complete" -> Color.parseColor("#7ED321")
            else -> DEFAULT_ACCENT_COLOR
        }
    }

    /**
     * Resolves the project's display color from its hex color field.
     * Returns null if no color is set (widget will use default accent).
     */
    private fun resolveProjectColor(project: ChitEntity): Int? {
        if (project.color.isNullOrBlank() || project.color == "transparent") {
            return null
        }
        return try {
            Color.parseColor(project.color)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Parses locked filters JSON from settings.
     * Returns a list of filter objects (status, tag, etc.) that should be applied.
     */
    private fun parseLockedFilters(json: String?): List<JSONObject> {
        if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()
        return try {
            val array = JSONArray(json)
            (0 until array.length()).map { array.getJSONObject(it) }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Applies Omni View locked filters to a list of chits.
     * Filters include status, tag, and other criteria.
     */
    private fun applyOmniFilters(
        chits: List<ChitEntity>,
        filters: List<JSONObject>
    ): List<ChitEntity> {
        if (filters.isEmpty()) return chits

        var result = chits
        for (filter in filters) {
            val type = filter.optString("type", "")
            val value = filter.optString("value", "")
            if (type.isBlank() || value.isBlank()) continue

            result = when (type) {
                "status" -> result.filter { it.status == value }
                "tag" -> result.filter { it.tags?.contains(value) == true }
                "priority" -> result.filter { it.priority == value }
                else -> result
            }
        }
        return result
    }

    /**
     * Checks if a chit falls on a given day (between dayStart and dayEnd).
     * A chit counts if its startDatetime, dueDatetime, or pointInTime
     * falls within the day boundaries.
     */
    private fun chitFallsOnDay(
        chit: ChitEntity,
        dayStart: LocalDateTime,
        dayEnd: LocalDateTime
    ): Boolean {
        val dayStartStr = dayStart.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        val dayEndStr = dayEnd.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        // Check startDatetime
        val start = chit.startDatetime
        if (start != null && start >= dayStartStr && start < dayEndStr) return true

        // Check dueDatetime
        val due = chit.dueDatetime
        if (due != null && due >= dayStartStr && due < dayEndStr) return true

        // Check pointInTime
        val pit = chit.pointInTime
        if (pit != null && pit >= dayStartStr && pit < dayEndStr) return true

        return false
    }

    /**
     * Adds a field name to the dirty fields JSON array string.
     */
    private fun addDirtyField(currentFields: String?, field: String): String {
        return try {
            val array = if (!currentFields.isNullOrBlank() && currentFields != "[]") {
                JSONArray(currentFields)
            } else {
                JSONArray()
            }
            // Check if field already exists
            val existing = (0 until array.length()).any { array.getString(it) == field }
            if (!existing) {
                array.put(field)
            }
            array.toString()
        } catch (_: Exception) {
            "[\"$field\"]"
        }
    }
}
