package com.cwoc.app.notification

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Utility for checking and prompting the user to grant exact alarm permission.
 *
 * On API 31+ (Android 12+), SCHEDULE_EXACT_ALARM requires explicit user grant via
 * system settings. This helper provides:
 * - A check for whether the permission is currently granted
 * - An Intent that opens the system settings page for granting the permission
 *
 * Usage: Call [hasPermission] to check, and if false, launch [createPermissionRequestIntent]
 * from an Activity context (e.g., from a settings screen or when the user first creates an alarm).
 */
@Singleton
class ExactAlarmPermissionHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    /**
     * Returns true if the app can schedule exact alarms.
     * Always true on API < 31 (no permission needed).
     */
    fun hasPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
    }

    /**
     * Creates an Intent that opens the system "Alarms & Reminders" settings page
     * for this app, where the user can grant SCHEDULE_EXACT_ALARM permission.
     *
     * On API < 31, returns null (no permission needed).
     *
     * The caller must launch this intent from an Activity context:
     * ```
     * helper.createPermissionRequestIntent()?.let { intent ->
     *     activity.startActivity(intent)
     * }
     * ```
     */
    fun createPermissionRequestIntent(): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return null
        }

        Log.d("CWOC_ALARM", "Creating exact alarm permission request intent for package: ${context.packageName}")
        return Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    /**
     * Checks permission and logs the current state. Useful for diagnostics.
     */
    fun logPermissionState() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val granted = alarmManager.canScheduleExactAlarms()
            Log.d("CWOC_ALARM", "Exact alarm permission granted: $granted (API ${Build.VERSION.SDK_INT})")
        } else {
            Log.d("CWOC_ALARM", "Exact alarm permission not required (API ${Build.VERSION.SDK_INT} < 31)")
        }
    }
}
