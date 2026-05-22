package com.cwoc.app.widget.progress

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.util.TypedValue
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
 * Project Progress widget — displays a horizontal progress bar showing
 * the completion ratio of a selected project's child chits.
 *
 * Shows the project title, a colored progress bar (HST color or default #6b4e31),
 * and "X of Y" completion text.
 *
 * Handles:
 * - Zero children: 0% bar with "0 of 0" text
 * - Deleted project: "Project unavailable — reconfigure" message
 * - Auth guard: "Please log in" if not authenticated
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 9.5, 9.7
 */
class ProjectProgressWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "cwoc_widget_config"
        private const val DEFAULT_PROGRESS_COLOR = 0xFF6b4e31.toInt()
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            // Auth guard: check if user is logged in
            if (!WidgetDataProvider.isLoggedIn(context)) {
                appWidgetIds.forEach { widgetId ->
                    val views = RemoteViews(context.packageName, R.layout.widget_project_progress)
                    showAuthGuard(views)
                    appWidgetManager.updateAppWidget(widgetId, views)
                }
                return@launch
            }

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            appWidgetIds.forEach { widgetId ->
                val views = RemoteViews(context.packageName, R.layout.widget_project_progress)

                // Read configured project ID from SharedPreferences
                val projectId = prefs.getString("project_$widgetId", null)

                if (projectId.isNullOrBlank()) {
                    // No project configured — show unavailable state
                    showUnavailable(views)
                    appWidgetManager.updateAppWidget(widgetId, views)
                    return@forEach
                }

                // Fetch project progress data
                val progress = WidgetDataProvider.getProjectProgress(context, projectId)

                if (progress == null) {
                    // Project deleted or not found — show unavailable message
                    showUnavailable(views)
                    appWidgetManager.updateAppWidget(widgetId, views)
                    return@forEach
                }

                // Show normal content
                showProgress(context, views, progress, widgetId, appWidgetManager)

                // Set up tap PendingIntent to open project view in app
                val intent = Intent(context, MainActivity::class.java).apply {
                    putExtra("navigate_to", "project/$projectId")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    widgetId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.project_content, pendingIntent)

                appWidgetManager.updateAppWidget(widgetId, views)
            }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        // Remove SharedPreferences entries for deleted widget IDs
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        appWidgetIds.forEach { widgetId ->
            editor.remove("project_$widgetId")
        }
        editor.apply()
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Shows the auth guard message and hides all other content.
     */
    private fun showAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.project_content, View.GONE)
        views.setViewVisibility(R.id.project_unavailable, View.GONE)
        views.setViewVisibility(R.id.project_auth_guard, View.VISIBLE)
    }

    /**
     * Shows the "Project unavailable — reconfigure" message.
     */
    private fun showUnavailable(views: RemoteViews) {
        views.setViewVisibility(R.id.project_content, View.GONE)
        views.setViewVisibility(R.id.project_unavailable, View.VISIBLE)
        views.setViewVisibility(R.id.project_auth_guard, View.GONE)
        views.setTextViewText(R.id.project_unavailable, "Project unavailable \u2014 reconfigure")
    }

    /**
     * Populates the widget with project progress data:
     * - Sets title text
     * - Calculates and sets progress bar fill width
     * - Sets progress bar color (HST color or default)
     * - Sets "X of Y" count text
     */
    private fun showProgress(
        context: Context,
        views: RemoteViews,
        progress: com.cwoc.app.widget.refresh.WidgetProjectProgress,
        widgetId: Int,
        appWidgetManager: AppWidgetManager
    ) {
        views.setViewVisibility(R.id.project_content, View.VISIBLE)
        views.setViewVisibility(R.id.project_unavailable, View.GONE)
        views.setViewVisibility(R.id.project_auth_guard, View.GONE)

        // Set project title
        views.setTextViewText(R.id.project_title, progress.title ?: "Project")

        // Set "X of Y" count text
        views.setTextViewText(
            R.id.progress_count_text,
            "${progress.completedCount} of ${progress.totalCount}"
        )

        // Set progress bar color (HST color or default #6b4e31)
        val barColor = progress.hstColor ?: DEFAULT_PROGRESS_COLOR
        views.setInt(R.id.progress_bar_fill, "setBackgroundColor", barColor)

        // Calculate progress bar width based on widget width and progress percent
        val options = appWidgetManager.getAppWidgetOptions(widgetId)
        val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
        val effectiveWidthDp = if (minWidthDp > 0) minWidthDp else 180

        // Convert dp to pixels
        val widthPx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            effectiveWidthDp.toFloat(),
            context.resources.displayMetrics
        ).toInt()

        // Subtract padding (10dp on each side from the LinearLayout padding)
        val paddingPx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            20f, // 10dp padding on each side
            context.resources.displayMetrics
        ).toInt()

        val containerWidth = (widthPx - paddingPx).coerceAtLeast(20)
        val progressWidth = (containerWidth * progress.progressPercent).toInt().coerceAtLeast(0)

        // Set progress bar fill width (API 31+, SDK 36 guaranteed)
        views.setViewLayoutWidth(
            R.id.progress_bar_fill,
            progressWidth.toFloat(),
            TypedValue.COMPLEX_UNIT_PX
        )
    }
}
