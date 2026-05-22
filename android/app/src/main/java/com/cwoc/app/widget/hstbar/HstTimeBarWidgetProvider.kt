package com.cwoc.app.widget.hstbar

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.widget.RemoteViews
import com.cwoc.app.R
import com.cwoc.app.widget.refresh.WidgetUtils
import java.util.Calendar

/**
 * HST Time Bar Widget — displays Holeman Simplified Time as a progress bar
 * with 1-second updates while the screen is on.
 *
 * Requirements: 8.1, 8.6, 8.7, 8.8, 8.9
 */
class HstTimeBarWidgetProvider : AppWidgetProvider() {

    companion object {
        private val handler = Handler(Looper.getMainLooper())
        private var timerRunnable: Runnable? = null
        private var screenReceiver: BroadcastReceiver? = null
        private var isTimerRunning = false
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        updateAllWidgets(context, appWidgetManager, appWidgetIds)
        // Ensure timer is running after any update (covers first placement)
        if (!isTimerRunning) {
            registerScreenReceiver(context)
            startTimer(context)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        registerScreenReceiver(context)
        startTimer(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        stopTimer()
        unregisterScreenReceiver(context)
    }

    private fun updateAllWidgets(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val cal = Calendar.getInstance()
        val hours = cal.get(Calendar.HOUR_OF_DAY)
        val minutes = cal.get(Calendar.MINUTE)
        val seconds = cal.get(Calendar.SECOND)

        val (formattedHst, dayFraction) = WidgetUtils.calculateHst(hours, minutes, seconds)

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_hst_bar)

            // Set the HST text
            views.setTextViewText(R.id.hst_time_text, formattedHst)

            // Get widget width from options (SDK 36 guarantees API 31+)
            val options = appWidgetManager.getAppWidgetOptions(widgetId)
            val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
            val effectiveWidthDp = if (minWidthDp > 0) minWidthDp else 180

            // Convert to pixels and subtract padding (6dp each side = 12dp total)
            val widthPx = TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                effectiveWidthDp.toFloat(),
                context.resources.displayMetrics
            ).toInt()
            val paddingPx = TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                12f,
                context.resources.displayMetrics
            ).toInt()

            val availableWidth = (widthPx - paddingPx).coerceAtLeast(20)
            val progressWidth = (availableWidth * dayFraction).toInt().coerceAtLeast(2)

            // Set progress bar width using setViewLayoutWidth (API 31+, SDK 36 guaranteed)
            views.setViewLayoutWidth(
                R.id.hst_progress_bar,
                progressWidth.toFloat(),
                TypedValue.COMPLEX_UNIT_PX
            )

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    private fun startTimer(context: Context) {
        if (isTimerRunning) return

        isTimerRunning = true
        timerRunnable = object : Runnable {
            override fun run() {
                val appContext = context.applicationContext
                val appWidgetManager = AppWidgetManager.getInstance(appContext)
                val componentName = ComponentName(appContext, HstTimeBarWidgetProvider::class.java)
                val widgetIds = appWidgetManager.getAppWidgetIds(componentName)

                if (widgetIds.isNotEmpty()) {
                    updateAllWidgets(appContext, appWidgetManager, widgetIds)
                    handler.postDelayed(this, 1000L)
                } else {
                    isTimerRunning = false
                }
            }
        }
        handler.post(timerRunnable!!)
    }

    private fun stopTimer() {
        isTimerRunning = false
        timerRunnable?.let { handler.removeCallbacks(it) }
        timerRunnable = null
    }

    private fun registerScreenReceiver(context: Context) {
        if (screenReceiver != null) return

        screenReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                when (intent.action) {
                    Intent.ACTION_SCREEN_OFF -> stopTimer()
                    Intent.ACTION_SCREEN_ON -> startTimer(ctx)
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
        }

        context.applicationContext.registerReceiver(
            screenReceiver,
            filter,
            Context.RECEIVER_NOT_EXPORTED
        )
    }

    private fun unregisterScreenReceiver(context: Context) {
        screenReceiver?.let {
            try {
                context.applicationContext.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) { }
        }
        screenReceiver = null
    }
}
