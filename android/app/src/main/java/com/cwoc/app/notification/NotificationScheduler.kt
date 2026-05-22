package com.cwoc.app.notification

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Data model for a parsed chit alert, used internally by the scheduler.
 */
data class ChitAlert(
    val chitId: String,
    val chitTitle: String,
    val alertType: AlertType,
    val triggerTimeMillis: Long,
    val alertIndex: Int
)

enum class AlertType {
    ALARM,
    REMINDER,
    TIMER
}

/**
 * Schedules and cancels local notifications via AlarmManager exact alarms.
 */
interface NotificationScheduler {
    suspend fun scheduleAlarms(chit: ChitEntity)
    suspend fun cancelAlarms(chitId: String)
    suspend fun rescheduleAll()
    suspend fun rescheduleAllWithReport(): String
    fun hasExactAlarmPermission(): Boolean
}

/**
 * Implementation of [NotificationScheduler] using AlarmManager.
 *
 * - Parses alert data from ChitEntity.alerts JSON
 * - Schedules exact alarms for future, non-snoozed alerts
 * - Falls back to inexact alarms when exact alarm permission is not granted (API 31+)
 * - PendingIntent request code is derived from hash of "chitId:alertIndex" for uniqueness
 */
@Singleton
class NotificationSchedulerImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val chitDao: ChitDao
) : NotificationScheduler {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    companion object {
        private const val TAG = "CWOC_NOTIF_SCHED"
        const val ACTION_ALARM_TRIGGER = "com.cwoc.app.ALARM_TRIGGER"
        const val EXTRA_CHIT_ID = "chit_id"
        const val EXTRA_CHIT_TITLE = "chit_title"
        const val EXTRA_ALERT_TYPE = "alert_type"
        const val EXTRA_ALERT_INDEX = "alert_index"
    }

    override suspend fun scheduleAlarms(chit: ChitEntity) {
        Log.d(TAG, "scheduleAlarms called: chitId=${chit.id}, title=${chit.title}, " +
            "alerts=${chit.alerts?.take(200)}")

        // Cancel existing alarms for this chit first
        cancelAlarms(chit.id)

        // Parse alerts from chit
        val alerts = parseAlerts(chit)
        if (alerts.isEmpty()) {
            Log.d(TAG, "scheduleAlarms: no schedulable alerts for chit ${chit.id}")
            return
        }

        val now = System.currentTimeMillis()
        var scheduledCount = 0
        alerts.forEach { alert ->
            if (alert.triggerTimeMillis > now) {
                scheduleExactAlarm(alert)
                scheduledCount++
                Log.d(TAG, "Scheduled alarm: chit=${alert.chitId}, type=${alert.alertType}, " +
                    "fires at ${java.time.Instant.ofEpochMilli(alert.triggerTimeMillis)} " +
                    "(in ${(alert.triggerTimeMillis - now) / 1000}s)")
            } else {
                Log.d(TAG, "Skipped past alarm: chit=${alert.chitId}, type=${alert.alertType}, " +
                    "was at ${java.time.Instant.ofEpochMilli(alert.triggerTimeMillis)} " +
                    "(${(now - alert.triggerTimeMillis) / 1000}s ago)")
            }
        }
        Log.d(TAG, "scheduleAlarms complete: chit=${chit.id}, scheduled=$scheduledCount/${alerts.size}")
    }

    override suspend fun cancelAlarms(chitId: String) {
        val chit = chitDao.getById(chitId) ?: return
        val alerts = parseAlerts(chit)
        alerts.forEachIndexed { index, _ ->
            val requestCode = getRequestCode(chitId, index)
            val intent = createAlarmIntent(chitId, index, "", "")
            val pendingIntent = PendingIntent.getBroadcast(
                context, requestCode, intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            pendingIntent?.let { alarmManager.cancel(it) }
        }
    }

    override suspend fun rescheduleAll() {
        val chitsWithAlerts = chitDao.getChitsWithAlertsLight()
        Log.d(TAG, "rescheduleAll: found ${chitsWithAlerts.size} chits with alerts")
        val now = System.currentTimeMillis()
        chitsWithAlerts.forEach { proj ->
            val alerts = parseAlertsFromProjection(proj)
            alerts.forEach { alert ->
                if (alert.triggerTimeMillis > now) {
                    scheduleExactAlarm(alert)
                }
            }
        }
        Log.d(TAG, "rescheduleAll: complete")
    }

    /**
     * Same as rescheduleAll but returns a diagnostic report string
     * for clipboard debugging (no logcat needed).
     */
    override suspend fun rescheduleAllWithReport(): String {
        val report = StringBuilder()
        report.appendLine("CWOC ${com.cwoc.app.BuildConfig.VERSION_NAME}")
        report.appendLine("=== CWOC Notification Diagnostic ===")
        report.appendLine("Time: ${java.time.Instant.now()}")
        report.appendLine("Exact alarm permission: ${hasExactAlarmPermission()}")
        report.appendLine("Android SDK: ${android.os.Build.VERSION.SDK_INT}")
        report.appendLine()

        val chitsWithAlerts = chitDao.getChitsWithAlertsLight()
        report.appendLine("Chits with non-empty alerts field: ${chitsWithAlerts.size}")
        report.appendLine()

        if (chitsWithAlerts.isEmpty()) {
            report.appendLine("NO CHITS WITH ALERTS FOUND IN DATABASE.")
            report.appendLine("This means either:")
            report.appendLine("  - Sync hasn't completed yet")
            report.appendLine("  - No chits on the server have alerts")
            report.appendLine("  - The alerts field is stored as null/empty/[]")
            return report.toString()
        }

        val now = System.currentTimeMillis()
        var totalScheduled = 0

        chitsWithAlerts.take(10).forEachIndexed { idx, proj ->
            report.appendLine("--- Chit ${idx + 1}: ${proj.title} (${proj.id.take(8)}...) ---")
            report.appendLine("  alerts raw: ${proj.alerts?.take(300)}")
            report.appendLine("  startDatetime: ${proj.startDatetime}")
            report.appendLine("  dueDatetime: ${proj.dueDatetime}")
            report.appendLine("  endDatetime: ${proj.endDatetime}")
            report.appendLine("  pointInTime: ${proj.pointInTime}")
            report.appendLine("  timezone: ${proj.timezone}")
            report.appendLine("  status: ${proj.status}")

            val alerts = parseAlertsFromProjection(proj)
            report.appendLine("  parsed alerts: ${alerts.size}")

            alerts.forEach { alert ->
                val fireInstant = java.time.Instant.ofEpochMilli(alert.triggerTimeMillis)
                val isFuture = alert.triggerTimeMillis > now
                val diffSec = (alert.triggerTimeMillis - now) / 1000
                report.appendLine("    [${alert.alertType}] fires at $fireInstant " +
                    "(${if (isFuture) "in ${diffSec}s" else "${-diffSec}s AGO"}) " +
                    if (isFuture) "→ SCHEDULED" else "→ SKIPPED (past)")
                if (isFuture) {
                    scheduleExactAlarm(alert)
                    totalScheduled++
                }
            }
            report.appendLine()
        }

        if (chitsWithAlerts.size > 10) {
            report.appendLine("... and ${chitsWithAlerts.size - 10} more chits (showing first 10)")
            // Still schedule the rest silently
            chitsWithAlerts.drop(10).forEach { proj ->
                val alerts = parseAlertsFromProjection(proj)
                alerts.forEach { alert ->
                    if (alert.triggerTimeMillis > now) {
                        scheduleExactAlarm(alert)
                        totalScheduled++
                    }
                }
            }
        }

        report.appendLine("=== TOTAL ALARMS SCHEDULED: $totalScheduled ===")
        return report.toString()
    }

    override fun hasExactAlarmPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            // Pre-API 31 doesn't need the permission
            true
        }
    }

    private fun scheduleExactAlarm(alert: ChitAlert) {
        val requestCode = getRequestCode(alert.chitId, alert.alertIndex)
        val intent = createAlarmIntent(
            alert.chitId,
            alert.alertIndex,
            alert.chitTitle,
            alert.alertType.name
        )

        val pendingIntent = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (hasExactAlarmPermission()) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                alert.triggerTimeMillis,
                pendingIntent
            )
            Log.d(TAG, "setExactAndAllowWhileIdle: requestCode=$requestCode, " +
                "triggerAt=${java.time.Instant.ofEpochMilli(alert.triggerTimeMillis)}")
        } else {
            alarmManager.set(
                AlarmManager.RTC_WAKEUP,
                alert.triggerTimeMillis,
                pendingIntent
            )
            Log.w(TAG, "Exact alarm permission NOT granted — using inexact alarm. " +
                "requestCode=$requestCode")
        }
    }

    private fun createAlarmIntent(
        chitId: String,
        alertIndex: Int,
        chitTitle: String,
        alertType: String
    ): Intent {
        return Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_ALARM_TRIGGER
            putExtra(EXTRA_CHIT_ID, chitId)
            putExtra(EXTRA_ALERT_INDEX, alertIndex)
            putExtra(EXTRA_CHIT_TITLE, chitTitle)
            putExtra(EXTRA_ALERT_TYPE, alertType)
        }
    }

    /**
     * Deterministic request code from "chitId:alertIndex" hash.
     * Ensures uniqueness per chit + alert combination.
     */
    private fun getRequestCode(chitId: String, alertIndex: Int): Int {
        return "$chitId:$alertIndex".hashCode() and Int.MAX_VALUE
    }

    /**
     * Parses the alerts JSON from a ChitEntity and computes absolute trigger times.
     *
     * The server sends alerts in two formats:
     *
     * 1. Alarms: {"_type": "alarm", "time": "HH:MM", "days": ["Mon","Tue",...], "enabled": true, "name": "..."}
     *    - Recurring time-of-day alarms. We compute the next occurrence from now.
     *
     * 2. Notifications/Reminders: {"_type": "notification", "value": 15, "unit": "minutes",
     *    "afterTarget": false, "atTarget": false, "targetType": "start", "only_if_undone": true}
     *    - Offset-based reminders relative to the chit's start/due/end/point datetime.
     *    - We compute: target_datetime ± (value * unit) to get the absolute fire time.
     *
     * Weather notifications (unit == "weather") are skipped — they're server-side only.
     */
    private fun parseAlerts(chit: ChitEntity): List<ChitAlert> {
        val alertsJson = chit.alerts ?: return emptyList()
        return try {
            val gson = Gson()
            val alertList: List<Map<String, Any>> = gson.fromJson(
                alertsJson, object : TypeToken<List<Map<String, Any>>>() {}.type
            )
            val results = mutableListOf<ChitAlert>()

            alertList.forEachIndexed { index, alertMap ->
                val alertType = alertMap["_type"] as? String ?: return@forEachIndexed

                when (alertType) {
                    "alarm" -> parseAlarmAlert(chit, alertMap, index)?.let { results.add(it) }
                    "notification" -> parseNotificationAlert(chit, alertMap, index)?.let { results.add(it) }
                }
            }

            Log.d(TAG, "parseAlerts: chitId=${chit.id}, title=${chit.title}, " +
                "raw alerts count=${alertList.size}, scheduled=${results.size}")
            results
        } catch (e: Exception) {
            Log.e(TAG, "parseAlerts failed for chit ${chit.id}: ${e.message}")
            emptyList()
        }
    }

    /**
     * Parses an alarm-type alert and computes the next trigger time.
     * Alarms fire at a specific HH:MM on specified days of the week.
     * We find the next occurrence from now (today if the time hasn't passed yet,
     * otherwise the next matching day).
     */
    private fun parseAlarmAlert(chit: ChitEntity, alertMap: Map<String, Any>, index: Int): ChitAlert? {
        val enabled = alertMap["enabled"]
        // Gson deserializes booleans as Boolean, but sometimes as String
        val isEnabled = when (enabled) {
            is Boolean -> enabled
            is String -> enabled.equals("true", ignoreCase = true)
            else -> false
        }
        if (!isEnabled) return null

        val timeStr = alertMap["time"] as? String ?: return null // "HH:MM"
        val parts = timeStr.split(":")
        if (parts.size != 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null

        // Parse days array — e.g. ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        @Suppress("UNCHECKED_CAST")
        val daysRaw = alertMap["days"] as? List<String>
        val targetDays = if (!daysRaw.isNullOrEmpty()) {
            daysRaw.mapNotNull { dayStringToDayOfWeek(it) }.toSet()
        } else {
            // No days specified = every day
            DayOfWeek.entries.toSet()
        }

        if (targetDays.isEmpty()) return null

        // Determine timezone: use chit's timezone if set, otherwise device local
        val zoneId = getChitZoneId(chit)
        val now = ZonedDateTime.now(zoneId)
        val alarmTime = LocalTime.of(hour, minute)

        // Find the next occurrence: check today first, then subsequent days
        var candidate = now.toLocalDate()
        for (i in 0..7) {
            val checkDate = candidate.plusDays(i.toLong())
            if (targetDays.contains(checkDate.dayOfWeek)) {
                val candidateDateTime = ZonedDateTime.of(checkDate, alarmTime, zoneId)
                if (candidateDateTime.toInstant().toEpochMilli() > now.toInstant().toEpochMilli()) {
                    Log.d(TAG, "Alarm alert: chit=${chit.id}, time=$timeStr, " +
                        "next fire=${candidateDateTime}, zone=$zoneId")
                    return ChitAlert(
                        chitId = chit.id,
                        chitTitle = chit.title ?: "CWOC Alarm",
                        alertType = AlertType.ALARM,
                        triggerTimeMillis = candidateDateTime.toInstant().toEpochMilli(),
                        alertIndex = index
                    )
                }
            }
        }
        return null
    }

    /**
     * Parses a notification/reminder-type alert and computes the absolute trigger time.
     * Notifications use an offset (value + unit) relative to a target datetime on the chit.
     *
     * targetType: "start" | "due" | "end" | "point"
     * afterTarget: true = fire AFTER target, false = fire BEFORE target
     * atTarget: true = fire exactly AT target (offset = 0)
     */
    private fun parseNotificationAlert(chit: ChitEntity, alertMap: Map<String, Any>, index: Int): ChitAlert? {
        val unit = alertMap["unit"] as? String ?: return null

        // Skip weather notifications — those are server-side only
        if (unit == "weather") return null

        // "only_if_undone" check — skip if chit is already complete
        val onlyIfUndone = alertMap["only_if_undone"]
        val checkUndone = when (onlyIfUndone) {
            is Boolean -> onlyIfUndone
            is String -> onlyIfUndone.equals("true", ignoreCase = true)
            else -> true // default to true
        }
        if (checkUndone && chit.status == "Complete") return null

        // Parse atTarget flag
        val atTarget = when (val at = alertMap["atTarget"]) {
            is Boolean -> at
            is String -> at.equals("true", ignoreCase = true)
            else -> false
        }

        // Parse value (offset amount) — not needed if atTarget
        val value: Long = if (atTarget) {
            0L
        } else {
            val rawValue = alertMap["value"]
            when (rawValue) {
                is Number -> rawValue.toLong()
                is String -> rawValue.toLongOrNull() ?: return null
                else -> return null
            }
        }

        // Compute offset in seconds
        val offsetSeconds = if (atTarget) {
            0L
        } else {
            when (unit) {
                "minutes" -> value * 60
                "hours" -> value * 3600
                "days" -> value * 86400
                "weeks" -> value * 604800
                else -> value * 60 // default to minutes
            }
        }

        // Determine target datetime based on targetType
        val targetType = alertMap["targetType"] as? String ?: "start"
        val targetStr = when (targetType) {
            "due" -> chit.dueDatetime ?: chit.startDatetime
            "end" -> chit.endDatetime ?: chit.startDatetime
            "point" -> chit.pointInTime
            else -> chit.startDatetime ?: chit.dueDatetime // "start" is default
        } ?: return null

        // Parse the target datetime
        val targetMillis = parseDatetimeToMillis(targetStr, getChitZoneId(chit)) ?: return null

        // Compute fire time: at = exactly at target, before = target - offset, after = target + offset
        val afterTarget = when (val after = alertMap["afterTarget"]) {
            is Boolean -> after
            is String -> after.equals("true", ignoreCase = true)
            else -> false
        }

        val fireMillis = when {
            atTarget -> targetMillis
            afterTarget -> targetMillis + (offsetSeconds * 1000)
            else -> targetMillis - (offsetSeconds * 1000)
        }

        Log.d(TAG, "Notification alert: chit=${chit.id}, targetType=$targetType, " +
            "value=$value, unit=$unit, atTarget=$atTarget, afterTarget=$afterTarget, " +
            "targetStr=$targetStr, fireMillis=$fireMillis (${java.time.Instant.ofEpochMilli(fireMillis)})")

        return ChitAlert(
            chitId = chit.id,
            chitTitle = chit.title ?: "CWOC Reminder",
            alertType = AlertType.REMINDER,
            triggerTimeMillis = fireMillis,
            alertIndex = index
        )
    }

    /**
     * Gets the ZoneId for a chit. Uses the chit's stored timezone if available,
     * otherwise falls back to the device's default timezone.
     */
    private fun getChitZoneId(chit: ChitEntity): ZoneId {
        val tz = chit.timezone
        if (!tz.isNullOrBlank()) {
            return try {
                ZoneId.of(tz)
            } catch (e: Exception) {
                ZoneId.systemDefault()
            }
        }
        return ZoneId.systemDefault()
    }

    /**
     * Parses a datetime string to epoch millis. Handles:
     * - ISO 8601 with timezone: "2024-01-15T10:30:00+05:00"
     * - ISO 8601 with Z: "2024-01-15T10:30:00Z"
     * - ISO 8601 naive (no timezone): "2024-01-15T10:30:00" — interpreted in [zoneId]
     * - Date only: "2024-01-15" — interpreted as start of day in [zoneId]
     */
    private fun parseDatetimeToMillis(dateStr: String, zoneId: ZoneId): Long? {
        return try {
            // Try parsing as ZonedDateTime first (has timezone info)
            val cleaned = dateStr.replace("Z", "+00:00")
            if (cleaned.contains("+") || (cleaned.contains("-") && cleaned.lastIndexOf("-") > 9)) {
                // Has timezone offset
                val zdt = ZonedDateTime.parse(cleaned, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                zdt.toInstant().toEpochMilli()
            } else if (cleaned.contains("T")) {
                // Naive datetime — interpret in chit's timezone
                val ldt = LocalDateTime.parse(cleaned, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                ldt.atZone(zoneId).toInstant().toEpochMilli()
            } else {
                // Date only — start of day
                val ld = LocalDate.parse(cleaned, DateTimeFormatter.ISO_LOCAL_DATE)
                ld.atStartOfDay(zoneId).toInstant().toEpochMilli()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse datetime: $dateStr — ${e.message}")
            null
        }
    }

    /**
     * Converts a day-of-week string (as sent by the server) to a [DayOfWeek].
     * Handles: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
     * Also handles full names: "Monday", "Tuesday", etc.
     */
    private fun dayStringToDayOfWeek(day: String): DayOfWeek? {
        return when (day.lowercase().take(3)) {
            "mon" -> DayOfWeek.MONDAY
            "tue" -> DayOfWeek.TUESDAY
            "wed" -> DayOfWeek.WEDNESDAY
            "thu" -> DayOfWeek.THURSDAY
            "fri" -> DayOfWeek.FRIDAY
            "sat" -> DayOfWeek.SATURDAY
            "sun" -> DayOfWeek.SUNDAY
            else -> null
        }
    }

    // ─── Projection-based parsing (lightweight, avoids CursorWindow overflow) ───

    /**
     * Parses alerts from a lightweight ChitAlertProjection.
     * Same logic as parseAlerts(ChitEntity) but uses the projection fields.
     */
    private fun parseAlertsFromProjection(proj: com.cwoc.app.data.local.entity.ChitAlertProjection): List<ChitAlert> {
        val alertsJson = proj.alerts ?: return emptyList()
        return try {
            val gson = Gson()
            val alertList: List<Map<String, Any>> = gson.fromJson(
                alertsJson, object : TypeToken<List<Map<String, Any>>>() {}.type
            )
            val results = mutableListOf<ChitAlert>()

            alertList.forEachIndexed { index, alertMap ->
                val alertType = alertMap["_type"] as? String ?: return@forEachIndexed

                when (alertType) {
                    "alarm" -> parseAlarmAlertProj(proj, alertMap, index)?.let { results.add(it) }
                    "notification" -> parseNotificationAlertProj(proj, alertMap, index)?.let { results.add(it) }
                }
            }
            results
        } catch (e: Exception) {
            Log.e(TAG, "parseAlertsFromProjection failed for chit ${proj.id}: ${e.message}")
            emptyList()
        }
    }

    private fun parseAlarmAlertProj(proj: com.cwoc.app.data.local.entity.ChitAlertProjection, alertMap: Map<String, Any>, index: Int): ChitAlert? {
        val enabled = alertMap["enabled"]
        val isEnabled = when (enabled) {
            is Boolean -> enabled
            is String -> enabled.equals("true", ignoreCase = true)
            else -> false
        }
        if (!isEnabled) return null

        val timeStr = alertMap["time"] as? String ?: return null
        val parts = timeStr.split(":")
        if (parts.size != 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null

        @Suppress("UNCHECKED_CAST")
        val daysRaw = alertMap["days"] as? List<String>
        val targetDays = if (!daysRaw.isNullOrEmpty()) {
            daysRaw.mapNotNull { dayStringToDayOfWeek(it) }.toSet()
        } else {
            DayOfWeek.entries.toSet()
        }
        if (targetDays.isEmpty()) return null

        val zoneId = getZoneId(proj.timezone)
        val now = ZonedDateTime.now(zoneId)
        val alarmTime = LocalTime.of(hour, minute)

        for (i in 0..7) {
            val checkDate = now.toLocalDate().plusDays(i.toLong())
            if (targetDays.contains(checkDate.dayOfWeek)) {
                val candidateDateTime = ZonedDateTime.of(checkDate, alarmTime, zoneId)
                if (candidateDateTime.toInstant().toEpochMilli() > now.toInstant().toEpochMilli()) {
                    return ChitAlert(
                        chitId = proj.id,
                        chitTitle = proj.title ?: "CWOC Alarm",
                        alertType = AlertType.ALARM,
                        triggerTimeMillis = candidateDateTime.toInstant().toEpochMilli(),
                        alertIndex = index
                    )
                }
            }
        }
        return null
    }

    private fun parseNotificationAlertProj(proj: com.cwoc.app.data.local.entity.ChitAlertProjection, alertMap: Map<String, Any>, index: Int): ChitAlert? {
        val unit = alertMap["unit"] as? String ?: return null
        if (unit == "weather") return null

        val onlyIfUndone = alertMap["only_if_undone"]
        val checkUndone = when (onlyIfUndone) {
            is Boolean -> onlyIfUndone
            is String -> onlyIfUndone.equals("true", ignoreCase = true)
            else -> true
        }
        if (checkUndone && proj.status == "Complete") return null

        val atTarget = when (val at = alertMap["atTarget"]) {
            is Boolean -> at
            is String -> at.equals("true", ignoreCase = true)
            else -> false
        }

        val value: Long = if (atTarget) 0L else {
            val rawValue = alertMap["value"]
            when (rawValue) {
                is Number -> rawValue.toLong()
                is String -> rawValue.toLongOrNull() ?: return null
                else -> return null
            }
        }

        val offsetSeconds = if (atTarget) 0L else when (unit) {
            "minutes" -> value * 60
            "hours" -> value * 3600
            "days" -> value * 86400
            "weeks" -> value * 604800
            else -> value * 60
        }

        val targetType = alertMap["targetType"] as? String ?: "start"
        val targetStr = when (targetType) {
            "due" -> proj.dueDatetime ?: proj.startDatetime
            "end" -> proj.endDatetime ?: proj.startDatetime
            "point" -> proj.pointInTime
            else -> proj.startDatetime ?: proj.dueDatetime
        } ?: return null

        val zoneId = getZoneId(proj.timezone)
        val targetMillis = parseDatetimeToMillis(targetStr, zoneId) ?: return null

        val afterTarget = when (val after = alertMap["afterTarget"]) {
            is Boolean -> after
            is String -> after.equals("true", ignoreCase = true)
            else -> false
        }

        val fireMillis = when {
            atTarget -> targetMillis
            afterTarget -> targetMillis + (offsetSeconds * 1000)
            else -> targetMillis - (offsetSeconds * 1000)
        }

        return ChitAlert(
            chitId = proj.id,
            chitTitle = proj.title ?: "CWOC Reminder",
            alertType = AlertType.REMINDER,
            triggerTimeMillis = fireMillis,
            alertIndex = index
        )
    }

    private fun getZoneId(timezone: String?): ZoneId {
        if (!timezone.isNullOrBlank()) {
            return try { ZoneId.of(timezone) } catch (_: Exception) { ZoneId.systemDefault() }
        }
        return ZoneId.systemDefault()
    }
}
