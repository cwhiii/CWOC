package com.cwoc.app.widget.tasks

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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Upcoming Tasks widget — displays up to 5 ToDo/In Progress chits sorted by due date.
 * Shows "All caught up!" when empty.
 */
class UpcomingTasksWidgetProvider : AppWidgetProvider() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            val tasks = WidgetDataProvider.getUpcomingTasks(context)

            appWidgetIds.forEach { widgetId ->
                val views = RemoteViews(context.packageName, R.layout.widget_upcoming_tasks)

                if (tasks.isEmpty()) {
                    views.setViewVisibility(R.id.widget_list, View.GONE)
                    views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_list, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_empty, View.GONE)

                    views.removeAllViews(R.id.widget_list)
                    tasks.take(5).forEach { task ->
                        val itemView = RemoteViews(context.packageName, R.layout.widget_upcoming_tasks_item)
                        itemView.setTextViewText(R.id.item_title, task.title ?: "Untitled")
                        itemView.setTextViewText(R.id.item_due, task.dueDate ?: "")

                        val intent = Intent(context, MainActivity::class.java).apply {
                            putExtra("navigate_to", "editor/${task.id}")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        val pi = PendingIntent.getActivity(
                            context, task.id.hashCode(), intent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                        itemView.setOnClickPendingIntent(R.id.item_title, pi)
                        itemView.setOnClickPendingIntent(R.id.item_due, pi)

                        views.addView(R.id.widget_list, itemView)
                    }
                }

                appWidgetManager.updateAppWidget(widgetId, views)
            }
        }
    }
}
