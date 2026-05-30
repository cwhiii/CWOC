package com.cwoc.app.widget.weekly

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.cwoc.app.MainActivity
import com.cwoc.app.R
import com.cwoc.app.widget.refresh.WidgetDataProvider
import com.cwoc.app.widget.refresh.WidgetDayCount
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters

/**
 * Weekly Overview widget — displays a 7-day strip with chit counts per day.
 * Highlights today's cell with accent color. Tapping a day opens the calendar
 * to that day's view. Respects user's week-start preference from settings.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.5
 */
class WeeklyOverviewWidgetProvider : AppWidgetProvider() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val ACCENT_COLOR = 0xFF6b4e31.toInt()
        private const val ACCENT_TEXT_COLOR = 0xFFfffaf0.toInt()
        private const val ACTION_WEEK_ROLLOVER = "com.cwoc.app.widget.weekly.WEEK_ROLLOVER"

        // View ID arrays for the 7 day cells — indexed by position (0-6)
        private val CELL_IDS = intArrayOf(
            R.id.day_cell_0, R.id.day_cell_1, R.id.day_cell_2,
            R.id.day_cell_3, R.id.day_cell_4, R.id.day_cell_5, R.id.day_cell_6
        )
        private val ABBREV_IDS = intArrayOf(
            R.id.day_0_abbrev, R.id.day_1_abbrev, R.id.day_2_abbrev,
            R.id.day_3_abbrev, R.id.day_4_abbrev, R.id.day_5_abbrev, R.id.day_6_abbrev
        )
        private val NUMBER_IDS = intArrayOf(
            R.id.day_0_number, R.id.day_1_number, R.id.day_2_number,
            R.id.day_3_number, R.id.day_4_number, R.id.day_5_number, R.id.day_6_number
        )
        private val COUNT_IDS = intArrayOf(
            R.id.day_0_count, R.id.day_1_count, R.id.day_2_count,
            R.id.day_3_count, R.id.day_4_count, R.id.day_5_count, R.id.day_6_count
        )
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            // Auth guard
            if (!WidgetDataProvider.isLoggedIn(context)) {
                appWidgetIds.forEach { widgetId ->
                    val views = RemoteViews(context.packageName, R.layout.widget_weekly_overview)
                    showAuthGuard(views)
                    appWidgetManager.updateAppWidget(widgetId, views)
                }
                return@launch
            }

            // Determine week start date based on user's preference
            val weekStartDate = getWeekStartDate(context)
            val weekStartStr = weekStartDate.format(DateTimeFormatter.ISO_LOCAL_DATE)

            // Fetch chit counts for the 7-day range
            val dayCounts = WidgetDataProvider.getWeeklyCounts(context, weekStartStr)

            appWidgetIds.forEach { widgetId ->
                val views = RemoteViews(context.packageName, R.layout.widget_weekly_overview)
                hideAuthGuard(views)

                if (dayCounts.size == 7) {
                    populateDayCells(context, views, dayCounts, widgetId)
                } else {
                    // Fallback: show empty cells if data is unavailable
                    for (i in 0 until 7) {
                        views.setTextViewText(ABBREV_IDS[i], "")
                        views.setTextViewText(NUMBER_IDS[i], "")
                        views.setTextViewText(COUNT_IDS[i], "")
                    }
                }

                appWidgetManager.updateAppWidget(widgetId, views)
            }

            // Schedule week rollover alarm
            scheduleWeekRollover(context, weekStartDate)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_WEEK_ROLLOVER) {
            // Week has rolled over — trigger a full refresh
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = android.content.ComponentName(context, WeeklyOverviewWidgetProvider::class.java)
            val widgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (widgetIds.isNotEmpty()) {
                onUpdate(context, appWidgetManager, widgetIds)
            }
        }
    }

    /**
     * Populates the 7 day cells with abbreviation, date number, chit count,
     * and highlights today's cell with accent color.
     */
    private fun populateDayCells(
        context: Context,
        views: RemoteViews,
        dayCounts: List<WidgetDayCount>,
        widgetId: Int
    ) {
        for (i in 0 until 7) {
            val dayData = dayCounts[i]

            // Set text content
            views.setTextViewText(ABBREV_IDS[i], dayData.dayAbbrev)
            views.setTextViewText(NUMBER_IDS[i], dayData.dayNumber.toString())
            views.setTextViewText(COUNT_IDS[i], dayData.chitCount.toString())

            // Highlight today's cell with accent color background
            if (dayData.isToday) {
                views.setInt(CELL_IDS[i], "setBackgroundColor", ACCENT_COLOR)
                views.setTextColor(ABBREV_IDS[i], ACCENT_TEXT_COLOR)
                views.setTextColor(NUMBER_IDS[i], ACCENT_TEXT_COLOR)
                views.setTextColor(COUNT_IDS[i], ACCENT_TEXT_COLOR)
            } else {
                views.setInt(CELL_IDS[i], "setBackgroundColor", 0x00000000) // transparent
                views.setTextColor(ABBREV_IDS[i], 0xFF6b4e31.toInt())
                views.setTextColor(NUMBER_IDS[i], 0xFF4a2c2a.toInt())
                views.setTextColor(COUNT_IDS[i], 0xFF6b4e31.toInt())
            }

            // Set up tap PendingIntent: day cell tap → open calendar to that day
            val dayIntent = Intent(context, MainActivity::class.java).apply {
                putExtra("navigate_to", "calendar/day/${dayData.date}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val dayPi = PendingIntent.getActivity(
                context,
                "weekly_day_${widgetId}_$i".hashCode(),
                dayIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(CELL_IDS[i], dayPi)
        }

        // Header tap → open calendar to week view
        val weekIntent = Intent(context, MainActivity::class.java).apply {
            putExtra("navigate_to", "calendar/week/${dayCounts[0].date}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val weekPi = PendingIntent.getActivity(
            context,
            "weekly_header_$widgetId".hashCode(),
            weekIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.weekly_days_container, weekPi)
    }

    /**
     * Determines the current week's start date based on the user's week-start preference.
     * Reads the weekStartDay setting from the database. Defaults to Monday if not set.
     */
    private suspend fun getWeekStartDate(context: Context): LocalDate {
        val today = LocalDate.now()
        val preferredStartDay = getWeekStartDayOfWeek(context)

        // Calculate the most recent occurrence of the preferred start day
        // (including today if today IS the start day)
        return if (today.dayOfWeek == preferredStartDay) {
            today
        } else {
            today.with(TemporalAdjusters.previousOrSame(preferredStartDay))
        }
    }

    /**
     * Reads the user's week_start_day preference from settings and maps it to a DayOfWeek.
     * Handles both numeric ("0"–"6", where 0=Sunday) and name-based formats.
     * Defaults to Monday if the setting is not found or unrecognized.
     */
    private suspend fun getWeekStartDayOfWeek(context: Context): DayOfWeek {
        return try {
            val db = getDatabase(context)
            val settings = try {
                db.settingsDao().get()
            } finally {
                db.close()
            }
            val weekStartStr = settings?.weekStartDay

            // Try numeric first (canonical format: "0"=Sun, "1"=Mon, ..., "6"=Sat)
            val numeric = weekStartStr?.toIntOrNull()
            if (numeric != null && numeric in 0..6) {
                return when (numeric) {
                    0 -> DayOfWeek.SUNDAY
                    1 -> DayOfWeek.MONDAY
                    2 -> DayOfWeek.TUESDAY
                    3 -> DayOfWeek.WEDNESDAY
                    4 -> DayOfWeek.THURSDAY
                    5 -> DayOfWeek.FRIDAY
                    6 -> DayOfWeek.SATURDAY
                    else -> DayOfWeek.MONDAY
                }
            }

            // Fallback: name-based format (legacy)
            when (weekStartStr?.lowercase()) {
                "sun", "sunday" -> DayOfWeek.SUNDAY
                "mon", "monday" -> DayOfWeek.MONDAY
                "tue", "tuesday" -> DayOfWeek.TUESDAY
                "wed", "wednesday" -> DayOfWeek.WEDNESDAY
                "thu", "thursday" -> DayOfWeek.THURSDAY
                "fri", "friday" -> DayOfWeek.FRIDAY
                "sat", "saturday" -> DayOfWeek.SATURDAY
                else -> DayOfWeek.MONDAY // default
            }
        } catch (_: Exception) {
            DayOfWeek.MONDAY
        }
    }

    /**
     * Opens a Room database connection for reading settings.
     * Uses the same pattern as WidgetDataProvider.
     */
    private fun getDatabase(context: Context): com.cwoc.app.data.local.CwocDatabase {
        return androidx.room.Room.databaseBuilder(
            context.applicationContext,
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
                com.cwoc.app.data.local.migration.MIGRATION_8_9,
                com.cwoc.app.data.local.migration.MIGRATION_9_10,
                com.cwoc.app.data.local.migration.MIGRATION_10_11,
                com.cwoc.app.data.local.migration.MIGRATION_11_12,
                com.cwoc.app.data.local.migration.MIGRATION_12_13,
                com.cwoc.app.data.local.migration.MIGRATION_13_14
            )
            .build()
    }

    /**
     * Schedules an AlarmManager alarm to fire at midnight when the displayed week ends,
     * triggering a refresh to show the new current week.
     */
    private fun scheduleWeekRollover(context: Context, weekStartDate: LocalDate) {
        val weekEndDate = weekStartDate.plusDays(7)
        val rolloverTime = weekEndDate.atStartOfDay()
            .atZone(java.time.ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()

        // Only schedule if the rollover is in the future
        if (rolloverTime <= System.currentTimeMillis()) return

        val intent = Intent(context, WeeklyOverviewWidgetProvider::class.java).apply {
            action = ACTION_WEEK_ROLLOVER
        }
        val pi = PendingIntent.getBroadcast(
            context,
            "weekly_rollover".hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.set(AlarmManager.RTC, rolloverTime, pi)
    }

    /**
     * Shows the auth guard message and hides the days container.
     */
    private fun showAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.weekly_days_container, View.GONE)
        views.setViewVisibility(R.id.widget_auth_guard, View.VISIBLE)
    }

    /**
     * Hides the auth guard message and shows the days container.
     */
    private fun hideAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.weekly_days_container, View.VISIBLE)
        views.setViewVisibility(R.id.widget_auth_guard, View.GONE)
    }
}
