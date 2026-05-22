package com.cwoc.app

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.database.CursorWindow
import android.util.Log
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.cwoc.app.data.sync.SyncOrchestrator
import com.cwoc.app.notification.NotificationChannelManager
import com.cwoc.app.notification.NotificationScheduler
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.PrintWriter
import java.io.StringWriter
import javax.inject.Inject

@HiltAndroidApp
class CwocApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var syncOrchestrator: SyncOrchestrator

    @Inject
    lateinit var notificationChannelManager: NotificationChannelManager

    @Inject
    lateinit var notificationScheduler: NotificationScheduler

    override fun onCreate() {
        super.onCreate()

        // Increase CursorWindow size to prevent crashes when loading
        // large result sets (97-column ChitEntity with email bodies, notes, etc.)
        // Try multiple approaches since reflection restrictions vary by Android version.
        try {
            val field = CursorWindow::class.java.getDeclaredField("sCursorWindowSize")
            field.isAccessible = true
            field.set(null, 100 * 1024 * 1024) // 100MB
            Log.d("CWOC_APP", "CursorWindow sCursorWindowSize set to 100MB")
        } catch (e: Exception) {
            Log.w("CWOC_APP", "Failed sCursorWindowSize reflection: ${e.message}")
            // Fallback: try setting via SQLiteGlobal if available
            try {
                val globalClass = Class.forName("android.database.sqlite.SQLiteGlobal")
                val method = globalClass.getDeclaredMethod("getDefaultPageSize")
                method.isAccessible = true
                Log.d("CWOC_APP", "SQLiteGlobal page size: ${method.invoke(null)}")
            } catch (e2: Exception) {
                Log.w("CWOC_APP", "SQLiteGlobal fallback also failed: ${e2.message}")
            }
        }

        // Global crash handler — copies stack trace to clipboard
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            val stackTrace = "CWOC ${BuildConfig.VERSION_NAME}\n\n${sw}"
            Log.e("CWOC_CRASH", "UNCAUGHT EXCEPTION on thread ${thread.name}:\n$stackTrace")

            // Copy to clipboard — append to existing content if diagnostic is there
            try {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val existing = try {
                    clipboard.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
                } catch (_: Exception) { "" }
                val combined = if (existing.startsWith("CWOC") && existing.contains("Notification Diagnostic")) {
                    "$existing\n\n--- CRASH ---\n$stackTrace"
                } else {
                    stackTrace
                }
                val clip = ClipData.newPlainText("CWOC Crash Log", combined)
                clipboard.setPrimaryClip(clip)
            } catch (e: Exception) {
                Log.e("CWOC_CRASH", "Failed to copy to clipboard: ${e.message}")
            }

            // Let the default handler finish the crash
            defaultHandler?.uncaughtException(thread, throwable)
        }

        try {
            Log.d("CWOC_APP", "Application onCreate — creating notification channels")
            notificationChannelManager.createChannels()
        } catch (e: Exception) {
            Log.e("CWOC_APP", "Failed to create notification channels: ${e.message}", e)
        }
        try {
            Log.d("CWOC_APP", "Application onCreate — starting SyncOrchestrator")
            syncOrchestrator.start()
        } catch (e: Exception) {
            Log.e("CWOC_APP", "Failed to start SyncOrchestrator: ${e.message}", e)
        }

        // Reschedule all alarms on every app launch to ensure nothing is missed
        // (alarms can be lost if the app is force-stopped, updated, or if scheduling
        // failed during sync for any reason)
        // Also collects a diagnostic report and copies to clipboard for debugging.
        try {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val report = notificationScheduler.rescheduleAllWithReport()
                    kotlinx.coroutines.withContext(Dispatchers.Main) {
                        try {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("CWOC Notification Diag", report)
                            clipboard.setPrimaryClip(clip)
                        } catch (e: Exception) {
                            Log.e("CWOC_APP", "Failed to copy diag to clipboard: ${e.message}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("CWOC_APP", "rescheduleAll failed: ${e.message}", e)
                    kotlinx.coroutines.withContext(Dispatchers.Main) {
                        try {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("CWOC Notification Diag",
                                "CWOC ${BuildConfig.VERSION_NAME}\nCRASH in rescheduleAll: ${e.message}\n${e.stackTraceToString()}")
                            clipboard.setPrimaryClip(clip)
                        } catch (_: Exception) {}
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("CWOC_APP", "Failed to launch rescheduleAll: ${e.message}", e)
        }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
