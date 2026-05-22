package com.cwoc.app.widget.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.cwoc.app.MainActivity
import com.cwoc.app.R
import com.cwoc.app.widget.refresh.WidgetDataProvider
import com.cwoc.app.widget.refresh.WidgetUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Upcoming Alarms widget — displays the next 3 alarms with countdown timers.
 * Shows "No upcoming alarms" when empty, "Please log in" when not authenticated.
 *
 * Schedules AlarmManager-based refresh:
 * - Every 60s when nearest alarm < 1 hour away
 * - Every 15 minutes otherwise
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.5
 */
class UpcomingAlarmsWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_REFRESH_ALARMS = "com.cwoc.app.widget.ACTION_REFRESH_ALARMS"
        private const val REFRESH_INTERVAL_URGENT_MS = 60_000L      // 60 seconds
        private const val REFRESH_INTERVAL_NORMAL_MS = 900_000L     // 15 minutes
        private const val ONE_HOUR_MS = 3_600_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_REFRESH_ALARMS) {
            // Alarm-triggered refresh — update all widget instances
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, UpcomingAlarmsWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds.isNotEmpty()) {
                onUpdate(context, appWidgetManager, appWidgetIds)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            // Auth guard: check if user is logged in
            if (!WidgetDataProvider.isLoggedIn(context)) {
                appWidgetIds.forEach { widgetId ->
                    val views = RemoteViews(context.packageName, R.layout.widget_upcoming_alarms)
                    showAuthGuard(views)
                    appWidgetManager.updateAppWidget(widgetId, views)
                }
                cancelAlarmRefresh(context)
                return@launch
            }

            // Fetch upcoming alarms (max 3)
            val alarms = WidgetDataProvider.getUpcomingAlarms(context, 3)

            appWidgetIds.forEach { widgetId ->
                val views = RemoteViews(context.packageName, R.layout.widget_upcoming_alarms)

                if (alarms.isEmpty()) {
                    showEmptyState(views)
                } else {
                    showAlarms(context, views, alarms)
                }

                appWidgetManager.updateAppWidget(widgetId, views)
            }

            // Schedule next refresh based on nearest alarm proximity
            scheduleAlarmRefresh(context, alarms)
        }
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // Cancel alarm refresh when all widget instances are removed
        cancelAlarmRefresh(context)
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Shows the auth guard message and hides alarm content.
     */
    private fun showAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.alarm_list_container, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
        views.setViewVisibility(R.id.widget_auth_guard, View.VISIBLE)
    }

    /**
     * Shows the empty state message and hides alarm content.
     */
    private fun showEmptyState(views: RemoteViews) {
        views.setViewVisibility(R.id.alarm_list_container, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        views.setViewVisibility(R.id.widget_auth_guard, View.GONE)
    }

    /**
     * Populates alarm slots with data and sets up tap PendingIntents.
     */
    private fun showAlarms(
        context: Context,
        views: RemoteViews,
        alarms: List<com.cwoc.app.widget.refresh.WidgetAlarmItem>
    ) {
        views.setViewVisibility(R.id.alarm_list_container, View.VISIBLE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
        views.setViewVisibility(R.id.widget_auth_guard, View.GONE)

        // Alarm slot IDs for title, countdown, and container
        val slotContainerIds = intArrayOf(R.id.alarm_item_1, R.id.alarm_item_2, R.id.alarm_item_3)
        val slotTitleIds = intArrayOf(R.id.alarm_title_1, R.id.alarm_title_2, R.id.alarm_title_3)
        val slotCountdownIds = intArrayOf(R.id.alarm_countdown_1, R.id.alarm_countdown_2, R.id.alarm_countdown_3)

        for (i in 0 until 3) {
            if (i < alarms.size) {
                val alarm = alarms[i]

                // Show this slot
                views.setViewVisibility(slotContainerIds[i], View.VISIBLE)

                // Set title (already truncated by WidgetDataProvider, but ensure fallback)
                val displayTitle = alarm.title ?: "Untitled"
                views.setTextViewText(slotTitleIds[i], displayTitle)

                // Set countdown text (recalculate for freshness)
                val now = System.currentTimeMillis()
                val secondsRemaining = (alarm.triggerTime - now) / 1000
                val countdownText = if (secondsRemaining > 0) {
                    WidgetUtils.formatCountdown(secondsRemaining)
                } else {
                    "Now"
                }
                views.setTextViewText(slotCountdownIds[i], countdownText)

                // Set up tap PendingIntent to open editor for this alarm's chit
                val intent = Intent(context, MainActivity::class.java).apply {
                    putExtra("navigate_to", "editor/${alarm.chitId}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    alarm.chitId.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(slotContainerIds[i], pendingIntent)
            } else {
                // Hide unused slots
                views.setViewVisibility(slotContainerIds[i], View.GONE)
            }
        }
    }

    /**
     * Schedules AlarmManager for countdown refresh based on nearest alarm proximity.
     * - Every 60s when nearest alarm < 1 hour away
     * - Every 15 minutes otherwise
     * - Cancels if no alarms exist
     */
    private fun scheduleAlarmRefresh(
        context: Context,
        alarms: List<com.cwoc.app.widget.refresh.WidgetAlarmItem>
    ) {
        if (alarms.isEmpty()) {
            cancelAlarmRefresh(context)
            return
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val refreshIntent = getRefreshPendingIntent(context)

        // Determine interval based on nearest alarm's proximity
        val now = System.currentTimeMillis()
        val nearestTriggerTime = alarms.first().triggerTime
        val timeUntilNearest = nearestTriggerTime - now

        val intervalMs = if (timeUntilNearest in 1 until ONE_HOUR_MS) {
            REFRESH_INTERVAL_URGENT_MS
        } else {
            REFRESH_INTERVAL_NORMAL_MS
        }

        // Schedule next refresh using setExactAndAllowWhileIdle for urgent,
        // setInexactRepeating for normal
        val triggerAtMillis = SystemClock.elapsedRealtime() + intervalMs

        if (timeUntilNearest in 1 until ONE_HOUR_MS) {
            // Urgent: use exact alarm for precise countdown updates
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME,
                triggerAtMillis,
                refreshIntent
            )
        } else {
            // Normal: use inexact repeating for battery efficiency
            alarmManager.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME,
                triggerAtMillis,
                intervalMs,
                refreshIntent
            )
        }
    }

    /**
     * Cancels any scheduled alarm refresh.
     */
    private fun cancelAlarmRefresh(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val refreshIntent = getRefreshPendingIntent(context)
        alarmManager.cancel(refreshIntent)
    }

    /**
     * Creates the PendingIntent used for alarm-based refresh broadcasts.
     */
    private fun getRefreshPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, UpcomingAlarmsWidgetProvider::class.java).apply {
            action = ACTION_REFRESH_ALARMS
        }
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
