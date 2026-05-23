package com.cwoc.app

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.SharedPreferences
import android.database.CursorWindow
import android.util.Log
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import coil.ImageLoader
import coil.ImageLoaderFactory
import com.cwoc.app.data.sync.SyncOrchestrator
import com.cwoc.app.notification.NotificationChannelManager
import com.cwoc.app.notification.NotificationScheduler
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.io.PrintWriter
import java.io.StringWriter
import javax.inject.Inject

@HiltAndroidApp
class CwocApplication : Application(), Configuration.Provider, ImageLoaderFactory {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var syncOrchestrator: SyncOrchestrator

    @Inject
    lateinit var notificationChannelManager: NotificationChannelManager

    @Inject
    lateinit var notificationScheduler: NotificationScheduler

    @Inject
    lateinit var prefs: SharedPreferences

    @Inject
    lateinit var okHttpClient: OkHttpClient

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient { okHttpClient }
            .crossfade(true)
            .build()
    }

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

            // Copy to clipboard for easy reporting (no logcat access on physical device)
            try {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("CWOC Crash Log", stackTrace)
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
        try {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    notificationScheduler.rescheduleAll()
                } catch (e: Exception) {
                    Log.e("CWOC_APP", "rescheduleAll failed: ${e.message}", e)
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
