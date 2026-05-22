package com.cwoc.app.widget.config

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

/**
 * Base class for widget configuration activities.
 * Handles common logic: reading appWidgetId from intent, accessing SharedPreferences,
 * saving config, and finishing with the appropriate result.
 *
 * Subclasses should call setContentView() in onCreate() after super.onCreate(),
 * then present their configuration UI.
 */
abstract class BaseWidgetConfigActivity : AppCompatActivity() {

    protected var appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID
        private set

    protected lateinit var prefs: SharedPreferences
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Standard Android widget config pattern: set CANCELED by default
        // so that if the user backs out, the widget isn't added
        setResult(Activity.RESULT_CANCELED)

        // Read appWidgetId from the intent that launched this activity
        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        // If we didn't get a valid widget ID, finish immediately
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        // Access the shared widget config preferences
        prefs = getSharedPreferences("cwoc_widget_config", Context.MODE_PRIVATE)
    }

    /**
     * Save a configuration value to SharedPreferences.
     */
    protected fun saveConfig(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    /**
     * Finish the config activity with RESULT_OK and the appWidgetId,
     * signaling to the widget host that configuration is complete.
     */
    protected fun finishWithResult() {
        val resultIntent = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    /**
     * Cancel the configuration — sets RESULT_CANCELED and finishes.
     * The widget will not be placed on the home screen.
     */
    protected fun cancelConfig() {
        setResult(Activity.RESULT_CANCELED)
        finish()
    }
}
