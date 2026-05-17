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
import com.cwoc.app.widget.calendar.TodayCalendarWidgetProvider
import com.cwoc.app.widget.tasks.UpcomingTasksWidgetProvider
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
        }
    }
}
