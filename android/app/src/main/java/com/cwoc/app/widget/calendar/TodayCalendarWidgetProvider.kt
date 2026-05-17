package com.cwoc.app.widget.calendar

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
 * Today Calendar widget — displays today's calendar chits sorted by start time.
 * Shows "No events today" when empty.
 */
class TodayCalendarWidgetProvider : AppWidgetProvider() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            val chits = WidgetDataProvider.getTodayCalendarChits(context)

            appWidgetIds.forEach { widgetId ->
                val views = RemoteViews(context.packageName, R.layout.widget_today_calendar)

                if (chits.isEmpty()) {
                    views.setViewVisibility(R.id.widget_list, View.GONE)
                    views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_list, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_empty, View.GONE)

                    // For a simple widget, we'll show up to 5 items directly
                    // (Full RemoteViewsService/Factory pattern would be needed for scrollable list)
                    views.removeAllViews(R.id.widget_list)
                    chits.take(5).forEach { chit ->
                        val itemView = RemoteViews(context.packageName, R.layout.widget_today_calendar_item)
                        itemView.setTextViewText(R.id.item_title, chit.title ?: "Untitled")
                        itemView.setTextViewText(R.id.item_time, chit.time ?: "")

                        // Tap item → open editor
                        val intent = Intent(context, MainActivity::class.java).apply {
                            putExtra("navigate_to", "editor/${chit.id}")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        val pi = PendingIntent.getActivity(
                            context, chit.id.hashCode(), intent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                        itemView.setOnClickPendingIntent(R.id.item_title, pi)
                        itemView.setOnClickPendingIntent(R.id.item_time, pi)

                        views.addView(R.id.widget_list, itemView)
                    }
                }

                appWidgetManager.updateAppWidget(widgetId, views)
            }
        }
    }
}
