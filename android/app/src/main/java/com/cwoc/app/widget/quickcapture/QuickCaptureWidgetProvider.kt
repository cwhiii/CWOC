package com.cwoc.app.widget.quickcapture

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.cwoc.app.MainActivity
import com.cwoc.app.R

/**
 * Quick Capture widget — 1×1 hexagonal "+" button that creates a new blank chit.
 * Tap → opens editor in create mode (same as the FAB in the app views).
 * No picker menu, no data queries — purely a launcher widget.
 *
 * Requirements: 2.1, 2.2
 */
class QuickCaptureWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_quick_capture)

            // Tap anywhere on the widget → create a new blank chit
            val intent = Intent(context, MainActivity::class.java).apply {
                putExtra("navigate_to", "editor/new")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, widgetId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_quick_capture_root, pendingIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
