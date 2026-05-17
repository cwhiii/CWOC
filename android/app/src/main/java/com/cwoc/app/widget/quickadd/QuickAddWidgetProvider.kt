package com.cwoc.app.widget.quickadd

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.cwoc.app.MainActivity
import com.cwoc.app.R

/**
 * Quick Add widget — single tap launches the Chit Editor in create mode.
 * Parchment theme colors (#fffaf0 background, #6b4e31 accent).
 */
class QuickAddWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_quick_add)

            // Tap anywhere on the widget → open editor in create mode
            val intent = Intent(context, MainActivity::class.java).apply {
                putExtra("navigate_to", "editor/new")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, widgetId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_add_icon, pendingIntent)
            views.setOnClickPendingIntent(R.id.widget_label, pendingIntent)
            views.setOnClickPendingIntent(R.id.widget_logo, pendingIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
