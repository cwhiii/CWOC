package com.cwoc.app.util

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings

/**
 * Utility for managing the one-time battery optimization exemption prompt.
 * Called once after successful login to recommend disabling Doze for reliable
 * background sync and alert delivery.
 */
object BatteryOptimizationHelper {

    private const val PREF_BATTERY_PROMPT_SHOWN = "battery_optimization_prompt_shown"

    /**
     * Returns true if the battery optimization prompt should be shown.
     * The prompt is shown only when:
     * - It has not been previously shown/dismissed (recorded in SharedPreferences)
     * - The app is NOT already ignoring battery optimizations
     */
    fun shouldShowPrompt(context: Context, prefs: SharedPreferences): Boolean {
        if (prefs.getBoolean(PREF_BATTERY_PROMPT_SHOWN, false)) return false
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return !pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Records that the prompt has been shown (either accepted or dismissed).
     * After this call, [shouldShowPrompt] will always return false,
     * ensuring the prompt is one-time per device regardless of login/logout cycles.
     */
    fun recordPromptShown(prefs: SharedPreferences) {
        prefs.edit().putBoolean(PREF_BATTERY_PROMPT_SHOWN, true).apply()
    }

    /**
     * Launches the system intent to request battery optimization exemption
     * for this app's package.
     */
    fun requestExemption(context: Context) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
        }
        context.startActivity(intent)
    }
}
