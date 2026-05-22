package com.cwoc.app.widget.omniview

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
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
 * Omni View widget provider — displays a scrollable list of chit cards
 * using RemoteViewsService/RemoteViewsFactory pattern.
 *
 * Features:
 * - ListView adapter backed by OmniViewRemoteViewsService
 * - PendingIntent template for item taps (opens chit editor)
 * - Auth guard: shows "Please log in" when not authenticated
 * - Empty state: shows "No chits match current filters" via setEmptyView
 * - Resize handling: notifies data changed on dimension change
 *
 * Requirements: 1.1, 1.3, 1.7, 1.8, 1.9, 1.10, 1.11, 9.5
 */
class OmniViewWidgetProvider : AppWidgetProvider() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            appWidgetIds.forEach { widgetId ->
                updateWidget(context, appWidgetManager, widgetId)
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)

        // When the widget is resized, notify the factory to refresh data
        // so it can recalculate visible items based on new dimensions
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list)
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Updates a single widget instance with the appropriate state:
     * auth guard, list content, or empty state.
     */
    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_omni_view)

        // Auth guard: check if user is logged in
        if (!WidgetDataProvider.isLoggedIn(context)) {
            showAuthGuard(views)
            appWidgetManager.updateAppWidget(widgetId, views)
            return
        }

        // Show the list content (factory handles data loading)
        showListContent(context, views, widgetId)
        appWidgetManager.updateAppWidget(widgetId, views)
    }

    /**
     * Shows the auth guard message and hides list content.
     */
    private fun showAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.widget_list, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
        views.setViewVisibility(R.id.widget_auth_guard, View.VISIBLE)
    }

    /**
     * Sets up the ListView with RemoteViewsService adapter, empty view,
     * and PendingIntent template for item taps.
     */
    private fun showListContent(
        context: Context,
        views: RemoteViews,
        widgetId: Int
    ) {
        views.setViewVisibility(R.id.widget_list, View.VISIBLE)
        views.setViewVisibility(R.id.widget_auth_guard, View.GONE)
        // widget_empty visibility is managed by setEmptyView — Android shows it
        // automatically when the adapter has 0 items

        // Set up the RemoteViews adapter pointing to OmniViewRemoteViewsService
        val serviceIntent = Intent(context, OmniViewRemoteViewsService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            // Use a unique URI so the system doesn't reuse intents across widget instances
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.widget_list, serviceIntent)

        // Set the empty view for the ListView — Android shows this automatically
        // when the adapter returns 0 items ("No chits match current filters")
        views.setEmptyView(R.id.widget_list, R.id.widget_empty)

        // Set up PendingIntent template for item taps
        // The factory sets fill-in intents with "navigate_to" extra on each item;
        // the template + fill-in combine to form the final intent that opens the editor
        val templateIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val templatePendingIntent = PendingIntent.getActivity(
            context,
            widgetId,
            templateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.widget_list, templatePendingIntent)
    }
}
