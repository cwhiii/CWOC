package com.cwoc.app.notification

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.Instant
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
        const val ACTION_ALARM_TRIGGER = "com.cwoc.app.ALARM_TRIGGER"
        const val EXTRA_CHIT_ID = "chit_id"
        const val EXTRA_CHIT_TITLE = "chit_title"
        const val EXTRA_ALERT_TYPE = "alert_type"
        const val EXTRA_ALERT_INDEX = "alert_index"
    }

    override suspend fun scheduleAlarms(chit: ChitEntity) {
        // Cancel existing alarms for this chit first
        cancelAlarms(chit.id)

        // Parse alerts from chit
        val alerts = parseAlerts(chit)
        if (alerts.isEmpty()) return

        val now = System.currentTimeMillis()
        alerts.forEach { alert ->
            if (alert.triggerTimeMillis > now) {
                scheduleExactAlarm(alert)
            }
        }
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
        val chitsWithAlerts = chitDao.getChitsWithAlerts()
        chitsWithAlerts.forEach { chit ->
            scheduleAlarms(chit)
        }
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
        } else {
            // Fallback to inexact alarm when exact alarm permission not granted (API 31+)
            alarmManager.set(
                AlarmManager.RTC_WAKEUP,
                alert.triggerTimeMillis,
                pendingIntent
            )
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
     * Parses the alerts JSON from a ChitEntity.
     *
     * Expected JSON format: array of objects with:
     * - type: "alarm" | "reminder" | "timer"
     * - triggerAt: ISO 8601 datetime string
     * - snoozed: boolean
     *
     * Only non-snoozed alerts are returned.
     */
    private fun parseAlerts(chit: ChitEntity): List<ChitAlert> {
        val alertsJson = chit.alerts ?: return emptyList()
        return try {
            val gson = Gson()
            val alertList: List<Map<String, Any>> = gson.fromJson(
                alertsJson, object : TypeToken<List<Map<String, Any>>>() {}.type
            )
            alertList.mapIndexedNotNull { index, alertMap ->
                // Skip snoozed alerts
                val snoozed = alertMap["snoozed"] as? Boolean ?: false
                if (snoozed) return@mapIndexedNotNull null

                val triggerAtStr = alertMap["triggerAt"] as? String
                    ?: return@mapIndexedNotNull null
                val triggerTimeMillis = try {
                    Instant.parse(triggerAtStr).toEpochMilli()
                } catch (e: Exception) {
                    return@mapIndexedNotNull null
                }

                val type = when (alertMap["type"] as? String) {
                    "alarm" -> AlertType.ALARM
                    "reminder" -> AlertType.REMINDER
                    "timer" -> AlertType.TIMER
                    else -> AlertType.REMINDER
                }

                ChitAlert(
                    chitId = chit.id,
                    chitTitle = chit.title ?: "CWOC Alert",
                    alertType = type,
                    triggerTimeMillis = triggerTimeMillis,
                    alertIndex = index
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
