package com.cwoc.app.widget.weather

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
import com.cwoc.app.widget.refresh.WidgetWeatherData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Weather Widget provider — displays current weather conditions for a configured location.
 * Shows temperature (respecting user's unit system), weather icon from WMO code mapping,
 * and condition text (truncated to 20 chars).
 *
 * Handles:
 * - Stale data: shows last-known values + stale indicator with "Updated: HH:mm" timestamp
 * - No data: shows "Weather unavailable" message
 * - Auth guard: shows "Please log in" if not authenticated
 * - Tap: opens weather page in app
 *
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 9.5, 9.7
 */
class WeatherWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "cwoc_widget_config"
        private const val CACHE_PREFS_NAME = "cwoc_widget_weather_cache"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        scope.launch {
            for (appWidgetId in appWidgetIds) {
                updateWidget(context, appWidgetManager, appWidgetId)
            }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)

        // Remove SharedPreferences entries for deleted widget IDs
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cachePrefs = context.getSharedPreferences(CACHE_PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        val cacheEditor = cachePrefs.edit()

        for (appWidgetId in appWidgetIds) {
            // Remove all 4 config keys
            editor.remove("weather_location_$appWidgetId")
            editor.remove("weather_lat_$appWidgetId")
            editor.remove("weather_lon_$appWidgetId")
            editor.remove("weather_label_$appWidgetId")

            // Remove cached weather data
            cacheEditor.remove("weather_cache_temp_$appWidgetId")
            cacheEditor.remove("weather_cache_condition_$appWidgetId")
            cacheEditor.remove("weather_cache_icon_$appWidgetId")
            cacheEditor.remove("weather_cache_updated_$appWidgetId")
        }

        editor.apply()
        cacheEditor.apply()
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Updates a single weather widget instance.
     */
    private suspend fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_weather)

        // Auth guard: check if user is logged in
        if (!WidgetDataProvider.isLoggedIn(context)) {
            showAuthGuard(views)
            setupTapIntent(context, views, appWidgetId)
            appWidgetManager.updateAppWidget(appWidgetId, views)
            return
        }

        // Read configured location from SharedPreferences
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lat = prefs.getString("weather_lat_$appWidgetId", null)
        val lon = prefs.getString("weather_lon_$appWidgetId", null)

        if (lat == null || lon == null) {
            // No location configured — show unavailable
            showUnavailable(views)
            setupTapIntent(context, views, appWidgetId)
            appWidgetManager.updateAppWidget(appWidgetId, views)
            return
        }

        // Build location key as "lat,lon"
        val locationKey = "$lat,$lon"

        // Fetch weather data
        val weatherData = WidgetDataProvider.getWeatherData(context, locationKey)

        if (weatherData != null) {
            // Fresh data — display it and cache for stale fallback
            showWeatherContent(views, weatherData)
            cacheWeatherData(context, appWidgetId, weatherData)
        } else {
            // Fetch failed — try to show cached/stale data
            val cachedData = getCachedWeatherData(context, appWidgetId)
            if (cachedData != null) {
                // Show stale data with indicator
                showWeatherContent(views, cachedData)
            } else {
                // No cached data available
                showUnavailable(views)
            }
        }

        setupTapIntent(context, views, appWidgetId)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    /**
     * Shows the auth guard message and hides other content.
     */
    private fun showAuthGuard(views: RemoteViews) {
        views.setViewVisibility(R.id.weather_content, View.GONE)
        views.setViewVisibility(R.id.weather_unavailable, View.GONE)
        views.setViewVisibility(R.id.weather_auth_guard, View.VISIBLE)
    }

    /**
     * Shows the "Weather unavailable" message and hides other content.
     */
    private fun showUnavailable(views: RemoteViews) {
        views.setViewVisibility(R.id.weather_content, View.GONE)
        views.setViewVisibility(R.id.weather_unavailable, View.VISIBLE)
        views.setViewVisibility(R.id.weather_auth_guard, View.GONE)
    }

    /**
     * Displays weather data (temperature, icon, condition) in the widget.
     * Shows stale indicator if data is marked as stale.
     */
    private fun showWeatherContent(views: RemoteViews, weatherData: WidgetWeatherData) {
        views.setViewVisibility(R.id.weather_content, View.VISIBLE)
        views.setViewVisibility(R.id.weather_unavailable, View.GONE)
        views.setViewVisibility(R.id.weather_auth_guard, View.GONE)

        // Set temperature text (already formatted with unit by WidgetDataProvider)
        views.setTextViewText(R.id.weather_temperature, weatherData.temperature)

        // Set weather icon from WMO code mapping
        views.setImageViewResource(R.id.weather_icon, weatherData.weatherIcon)

        // Set condition text (already truncated to 20 chars by WidgetDataProvider)
        views.setTextViewText(R.id.weather_condition, weatherData.conditionText)

        // Handle stale indicator
        if (weatherData.isStale) {
            views.setViewVisibility(R.id.weather_stale_indicator, View.VISIBLE)
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            val updatedTime = timeFormat.format(Date(weatherData.lastUpdated))
            views.setTextViewText(R.id.weather_stale_indicator, "Updated: $updatedTime")
        } else {
            views.setViewVisibility(R.id.weather_stale_indicator, View.GONE)
        }
    }

    /**
     * Sets up the tap PendingIntent to open the weather page in the app.
     */
    private fun setupTapIntent(context: Context, views: RemoteViews, appWidgetId: Int) {
        val intent = Intent(context, MainActivity::class.java).apply {
            putExtra("navigate_to", "weather")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // Set tap on the entire root FrameLayout (the layout root)
        views.setOnClickPendingIntent(R.id.weather_content, pendingIntent)
        views.setOnClickPendingIntent(R.id.weather_unavailable, pendingIntent)
        views.setOnClickPendingIntent(R.id.weather_auth_guard, pendingIntent)
    }

    /**
     * Caches weather data in SharedPreferences for stale display fallback.
     */
    private fun cacheWeatherData(context: Context, appWidgetId: Int, data: WidgetWeatherData) {
        val cachePrefs = context.getSharedPreferences(CACHE_PREFS_NAME, Context.MODE_PRIVATE)
        cachePrefs.edit()
            .putString("weather_cache_temp_$appWidgetId", data.temperature)
            .putString("weather_cache_condition_$appWidgetId", data.conditionText)
            .putInt("weather_cache_icon_$appWidgetId", data.weatherIcon)
            .putLong("weather_cache_updated_$appWidgetId", data.lastUpdated)
            .apply()
    }

    /**
     * Retrieves cached weather data from SharedPreferences.
     * Returns a WidgetWeatherData with isStale=true, or null if no cache exists.
     */
    private fun getCachedWeatherData(context: Context, appWidgetId: Int): WidgetWeatherData? {
        val cachePrefs = context.getSharedPreferences(CACHE_PREFS_NAME, Context.MODE_PRIVATE)
        val temp = cachePrefs.getString("weather_cache_temp_$appWidgetId", null) ?: return null
        val condition = cachePrefs.getString("weather_cache_condition_$appWidgetId", null) ?: return null
        val icon = cachePrefs.getInt("weather_cache_icon_$appWidgetId", 0)
        val updated = cachePrefs.getLong("weather_cache_updated_$appWidgetId", 0L)

        if (icon == 0 || updated == 0L) return null

        return WidgetWeatherData(
            temperature = temp,
            conditionText = condition,
            weatherIcon = icon,
            lastUpdated = updated,
            isStale = true
        )
    }
}
