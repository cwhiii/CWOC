package com.cwoc.app.widget.refresh

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.cwoc.app.widget.alarms.UpcomingAlarmsWidgetProvider
import com.cwoc.app.widget.calendar.TodayCalendarWidgetProvider
import com.cwoc.app.widget.checklist.ChecklistWidgetProvider
import com.cwoc.app.widget.hstbar.HstTimeBarWidgetProvider
import com.cwoc.app.widget.omniview.OmniViewWidgetProvider
import com.cwoc.app.widget.progress.ProjectProgressWidgetProvider
import com.cwoc.app.widget.quickcapture.QuickCaptureWidgetProvider
import com.cwoc.app.widget.tasks.UpcomingTasksWidgetProvider
import com.cwoc.app.widget.weather.WeatherWidgetProvider
import com.cwoc.app.widget.weekly.WeeklyOverviewWidgetProvider
import java.util.concurrent.TimeUnit

/**
 * WorkManager job that periodically refreshes all home screen widgets.
 * Runs every 30 minutes and can be triggered immediately on sync/CRUD events.
 */
class WidgetUpdateWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        refreshAllWidgets(applicationContext)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "cwoc_widget_refresh"

        /**
         * Schedule periodic widget refresh (every 30 minutes).
         */
        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(
                30, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        /**
         * Trigger an immediate widget refresh (e.g., after sync or CRUD).
         */
        fun refreshNow(context: Context) {
            refreshAllWidgets(context)
        }

        /**
         * Send update broadcasts to all active widget providers.
         */
        private fun refreshAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)

            // Refresh Today Calendar widgets
            val calendarComponent = ComponentName(context, TodayCalendarWidgetProvider::class.java)
            val calendarIds = appWidgetManager.getAppWidgetIds(calendarComponent)
            if (calendarIds.isNotEmpty()) {
                val intent = Intent(context, TodayCalendarWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, calendarIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Upcoming Tasks widgets
            val tasksComponent = ComponentName(context, UpcomingTasksWidgetProvider::class.java)
            val taskIds = appWidgetManager.getAppWidgetIds(tasksComponent)
            if (taskIds.isNotEmpty()) {
                val intent = Intent(context, UpcomingTasksWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, taskIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Omni View widgets
            val omniViewComponent = ComponentName(context, OmniViewWidgetProvider::class.java)
            val omniViewIds = appWidgetManager.getAppWidgetIds(omniViewComponent)
            if (omniViewIds.isNotEmpty()) {
                val intent = Intent(context, OmniViewWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, omniViewIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Checklist widgets
            val checklistComponent = ComponentName(context, ChecklistWidgetProvider::class.java)
            val checklistIds = appWidgetManager.getAppWidgetIds(checklistComponent)
            if (checklistIds.isNotEmpty()) {
                val intent = Intent(context, ChecklistWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, checklistIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Upcoming Alarms widgets
            val alarmsComponent = ComponentName(context, UpcomingAlarmsWidgetProvider::class.java)
            val alarmIds = appWidgetManager.getAppWidgetIds(alarmsComponent)
            if (alarmIds.isNotEmpty()) {
                val intent = Intent(context, UpcomingAlarmsWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, alarmIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Project Progress widgets
            val progressComponent = ComponentName(context, ProjectProgressWidgetProvider::class.java)
            val progressIds = appWidgetManager.getAppWidgetIds(progressComponent)
            if (progressIds.isNotEmpty()) {
                val intent = Intent(context, ProjectProgressWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, progressIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Weather widgets
            val weatherComponent = ComponentName(context, WeatherWidgetProvider::class.java)
            val weatherIds = appWidgetManager.getAppWidgetIds(weatherComponent)
            if (weatherIds.isNotEmpty()) {
                val intent = Intent(context, WeatherWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, weatherIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Weekly Overview widgets
            val weeklyComponent = ComponentName(context, WeeklyOverviewWidgetProvider::class.java)
            val weeklyIds = appWidgetManager.getAppWidgetIds(weeklyComponent)
            if (weeklyIds.isNotEmpty()) {
                val intent = Intent(context, WeeklyOverviewWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, weeklyIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh HST Time Bar widgets
            val hstBarComponent = ComponentName(context, HstTimeBarWidgetProvider::class.java)
            val hstBarIds = appWidgetManager.getAppWidgetIds(hstBarComponent)
            if (hstBarIds.isNotEmpty()) {
                val intent = Intent(context, HstTimeBarWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, hstBarIds)
                }
                context.sendBroadcast(intent)
            }

            // Refresh Quick Capture widgets
            val quickCaptureComponent = ComponentName(context, QuickCaptureWidgetProvider::class.java)
            val quickCaptureIds = appWidgetManager.getAppWidgetIds(quickCaptureComponent)
            if (quickCaptureIds.isNotEmpty()) {
                val intent = Intent(context, QuickCaptureWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, quickCaptureIds)
                }
                context.sendBroadcast(intent)
            }
        }
    }
}
