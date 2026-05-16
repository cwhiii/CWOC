package com.cwoc.app

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.cwoc.app.data.sync.SyncOrchestrator
import com.cwoc.app.notification.NotificationChannelManager
import dagger.hilt.android.HiltAndroidApp
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

    override fun onCreate() {
        super.onCreate()

        // Global crash handler — copies stack trace to clipboard
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            val stackTrace = "CWOC ${BuildConfig.VERSION_NAME}\n\n${sw}"
            Log.e("CWOC_CRASH", "UNCAUGHT EXCEPTION on thread ${thread.name}:\n$stackTrace")

            // Copy to clipboard so user can paste it
            try {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("CWOC Crash Log", stackTrace)
                clipboard.setPrimaryClip(clip)
                Log.e("CWOC_CRASH", "Stack trace copied to clipboard")
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
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
