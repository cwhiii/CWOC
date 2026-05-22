package com.cwoc.app.widget.checklist

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.RemoteViews
import com.cwoc.app.MainActivity
import com.cwoc.app.R
import com.cwoc.app.data.sync.PushSyncWorker
import com.cwoc.app.widget.refresh.WidgetDataProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Checklist widget provider — displays a selected checklist's items with
 * interactive checkboxes using RemoteViewsService/RemoteViewsFactory pattern.
 *
 * Features:
 * - ListView adapter backed by ChecklistRemoteViewsService
 * - PendingIntent template for item interactions (toggle checkbox, open editor)
 * - Auth guard: shows "Please log in" when not authenticated
 * - Unavailable state: shows "Checklist unavailable — reconfigure" when chit is deleted/missing
 * - onReceive handles ACTION_TOGGLE_CHECKBOX for optimistic toggle with revert on failure
 * - onDeleted cleans up SharedPreferences for removed widget instances
 *
 * Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 9.5, 9.7
 */
class ChecklistWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_TOGGLE_CHECKBOX = "com.cwoc.app.widget.ACTION_TOGGLE_CHECKBOX"
        private const val PREFS_NAME = "cwoc_widget_config"
        private const val REVERT_DELAY_MS = 5000L
    }

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

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_TOGGLE_CHECKBOX) {
            val action = intent.getStringExtra("action")
            val chitId = intent.getStringExtra("chit_id") ?: return

            when (action) {
                "open" -> {
                    // Open the chit editor for this checklist
                    val openIntent = Intent(context, MainActivity::class.java).apply {
                        putExtra("navigate_to", "editor/$chitId")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    context.startActivity(openIntent)
                }
                "toggle" -> {
                    val itemIndex = intent.getIntExtra("item_index", -1)
                    if (itemIndex < 0) return

                    scope.launch {
                        val success = WidgetDataProvider.toggleChecklistItem(context, chitId, itemIndex)

                        if (success) {
                            // Trigger sync push to server
                            PushSyncWorker.enqueueOnce(context)

                            // Notify data changed to refresh the list immediately
                            val appWidgetManager = AppWidgetManager.getInstance(context)
                            val componentName = ComponentName(context, ChecklistWidgetProvider::class.java)
                            val widgetIds = appWidgetManager.getAppWidgetIds(componentName)
                            widgetIds.forEach { widgetId ->
                                appWidgetManager.notifyAppWidgetViewDataChanged(widgetId, R.id.checklist_list)
                            }
                        } else {
                            // On failure: schedule a revert (toggle back) after 5 seconds
                            Handler(Looper.getMainLooper()).postDelayed({
                                scope.launch {
                                    // Revert by toggling back
                                    WidgetDataProvider.toggleChecklistItem(context, chitId, itemIndex)

                                    // Refresh widget to show reverted state
                                    val appWidgetManager = AppWidgetManager.getInstance(context)
                                    val componentName = ComponentName(context, ChecklistWidgetProvider::class.java)
                                    val widgetIds = appWidgetManager.getAppWidgetIds(componentName)
                                    widgetIds.forEach { widgetId ->
                                        appWidgetManager.notifyAppWidgetViewDataChanged(widgetId, R.id.checklist_list)
                                    }
                                }
                            }, REVERT_DELAY_MS)
                        }
                    }
                }
            }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)

        // Remove SharedPreferences entries for deleted widget IDs
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        appWidgetIds.forEach { widgetId ->
            editor.remove("checklist_$widgetId")
        }
        editor.apply()
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Updates a single widget instance with the appropriate state:
     * auth guard, list content, or unavailable state.
     */
    private suspend fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_checklist)

        // Auth guard: check if user is logged in
        if (!WidgetDataProvider.isLoggedIn(context)) {
            showAuthGuard(views)
            appWidgetManager.updateAppWidget(widgetId, views)
            return
        }

        // Read configured chit ID from SharedPreferences
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val chitId = prefs.getString("checklist_$widgetId", null)

        if (chitId == null) {
            // No chit configured — show unavailable state
            showUnavailable(views, "Checklist unavailable \u2014 reconfigure")
            appWidgetManager.updateAppWidget(widgetId, views)
            return
        }

        // Check if the configured chit still has checklist data
        val items = WidgetDataProvider.getChecklistItems(context, chitId)
        val checklistChits = WidgetDataProvider.getChecklistChits(context)
        val chitSummary = checklistChits.find { it.chitId == chitId }

        if (chitSummary == null) {
            // Chit deleted or no longer has checklist data
            showUnavailable(views, "Checklist unavailable \u2014 reconfigure")
            appWidgetManager.updateAppWidget(widgetId, views)
            return
        }

        // Show the list content
        showListContent(context, views, widgetId, chitId, chitSummary.title)
        appWidgetManager.updateAppWidget(widgetId, views)
    }

    /**
     * Shows the auth guard message and hides list content.
     */
    private fun showAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.checklist_list, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        views.setViewVisibility(R.id.widget_title, View.GONE)
        views.setTextViewText(R.id.widget_empty, "Please log in")
    }

    /**
     * Shows the unavailable/reconfigure message.
     */
    private fun showUnavailable(views: RemoteViews, message: String) {
        views.setViewVisibility(R.id.checklist_list, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        views.setViewVisibility(R.id.widget_title, View.GONE)
        views.setTextViewText(R.id.widget_empty, message)
    }

    /**
     * Sets up the ListView with RemoteViewsService adapter, title,
     * and PendingIntent template for item interactions.
     */
    private fun showListContent(
        context: Context,
        views: RemoteViews,
        widgetId: Int,
        chitId: String,
        title: String?
    ) {
        views.setViewVisibility(R.id.checklist_list, View.VISIBLE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
        views.setViewVisibility(R.id.widget_title, View.VISIBLE)

        // Set the checklist title
        views.setTextViewText(R.id.widget_title, title ?: "Checklist")

        // Set up the RemoteViews adapter pointing to ChecklistRemoteViewsService
        val serviceIntent = Intent(context, ChecklistRemoteViewsService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            // Use a unique URI so the system doesn't reuse intents across widget instances
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.checklist_list, serviceIntent)

        // Set the empty view for the ListView
        views.setEmptyView(R.id.checklist_list, R.id.widget_empty)

        // Set up PendingIntent template for item interactions
        // The factory sets fill-in intents with "action", "chit_id", "item_index" on each item.
        // We use a broadcast template for "toggle" actions and an activity template for "open" actions.
        // Since RemoteViews only supports one template per ListView, we use a broadcast template
        // and handle routing in onReceive.
        val templateIntent = Intent(context, ChecklistWidgetProvider::class.java).apply {
            action = ACTION_TOGGLE_CHECKBOX
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        }
        val templatePendingIntent = PendingIntent.getBroadcast(
            context,
            widgetId,
            templateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.checklist_list, templatePendingIntent)

        // Add button — opens the chit editor so user can add items
        val addIntent = Intent(context, MainActivity::class.java).apply {
            putExtra("navigate_to", "editor/$chitId")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val addPendingIntent = PendingIntent.getActivity(
            context,
            "checklist_add_$widgetId".hashCode(),
            addIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_add_button, addPendingIntent)
    }
}
