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
import com.cwoc.app.data.remote.TrustedHttpClient
import okhttp3.Request
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

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient { TrustedHttpClient.instance }
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

        // ── DIAGNOSTIC: Test all HTTP paths and copy results to clipboard ──
        // Retries every 10s until prefs are populated (i.e., after login)
        CoroutineScope(Dispatchers.IO).launch {
            var attempts = 0
            while (attempts < 12) { // Try for up to 2 minutes
                kotlinx.coroutines.delay(10000)
                attempts++
                val url = prefs.getString("server_url", null)
                val tok = prefs.getString("device_token", null)
                if (!url.isNullOrBlank() && !tok.isNullOrBlank()) {
                    runHttpDiagnostic()
                    break
                } else {
                    // Update clipboard with waiting status
                    val waitMsg = "=== CWOC DIAG ${BuildConfig.VERSION_NAME} ===\nWaiting for login... attempt $attempts/12\nserver_url=${url ?: "NULL"}, token=${if (tok != null) "present" else "NULL"}"
                    copyToClipboard(waitMsg)
                }
            }
        }
    }

    /**
     * DIAGNOSTIC: Tests every HTTP path that's failing and copies results to clipboard.
     * Tests: TrustedHttpClient SSL, image URL fetch, push sync buildApiService, Coil config.
     * Appends to clipboard after EVERY step so partial results survive crashes.
     */
    private suspend fun runHttpDiagnostic() {
        val diag = StringBuilder()
        diag.appendLine("=== CWOC HTTP DIAGNOSTIC ${BuildConfig.VERSION_NAME} ===")
        diag.appendLine("Time: ${java.time.Instant.now()}")
        diag.appendLine()

        // 1. Check SharedPreferences values — read DIRECTLY from EncryptedSharedPreferences
        //    to rule out Hilt injection issues
        val directPrefs = try {
            val masterKeyAlias = androidx.security.crypto.MasterKeys.getOrCreate(
                androidx.security.crypto.MasterKeys.AES256_GCM_SPEC
            )
            androidx.security.crypto.EncryptedSharedPreferences.create(
                "cwoc_secure_prefs",
                masterKeyAlias,
                this@CwocApplication,
                androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            diag.appendLine("[PREFS ERROR] Failed to open EncryptedSharedPreferences: ${e.message}")
            copyToClipboard(diag.toString())
            return
        }

        val serverUrl = directPrefs.getString("server_url", null)
        val token = directPrefs.getString("device_token", null)
        val profileImageUrl = directPrefs.getString("user_profile_image_url", null)

        // Also check the Hilt-injected instance for comparison
        val hiltServerUrl = prefs.getString("server_url", null)
        val hiltToken = prefs.getString("device_token", null)

        diag.appendLine("[PREFS - direct read]")
        diag.appendLine("  server_url = ${serverUrl ?: "NULL"}")
        diag.appendLine("  device_token = ${if (token != null) "${token.take(8)}...(${token.length} chars)" else "NULL"}")
        diag.appendLine("  profile_image_url = ${profileImageUrl ?: "NULL"}")
        diag.appendLine("[PREFS - Hilt injected]")
        diag.appendLine("  server_url = ${hiltServerUrl ?: "NULL"}")
        diag.appendLine("  device_token = ${if (hiltToken != null) "${hiltToken.take(8)}...(${hiltToken.length} chars)" else "NULL"}")
        diag.appendLine("[PREFS - all keys]")
        try {
            val allKeys = directPrefs.all.keys
            diag.appendLine("  Total keys: ${allKeys.size}")
            allKeys.sorted().forEach { key ->
                val value = directPrefs.getString(key, null)
                val display = when {
                    key.contains("token", ignoreCase = true) && value != null -> "${value.take(8)}...(${value.length})"
                    value != null && value.length > 50 -> "${value.take(50)}...(${value.length})"
                    else -> value ?: "NULL"
                }
                diag.appendLine("  $key = $display")
            }
        } catch (e: Exception) {
            diag.appendLine("  Error listing keys: ${e.message}")
        }
        diag.appendLine()
        copyToClipboard(diag.toString())

        if (serverUrl.isNullOrBlank() || token.isNullOrBlank()) {
            diag.appendLine("[ABORT] No server_url or token — cannot test HTTP paths")
            copyToClipboard(diag.toString())
            return
        }

        // 2. Test basic HTTPS connectivity with TrustedHttpClient
        diag.appendLine("[TEST 1: TrustedHttpClient basic HTTPS GET]")
        try {
            val testUrl = "${serverUrl.trimEnd('/')}/api/health"
            diag.appendLine("  URL: $testUrl")
            val request = Request.Builder()
                .url(testUrl)
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()
            val response = TrustedHttpClient.instance.newCall(request).execute()
            diag.appendLine("  Response: HTTP ${response.code}")
            diag.appendLine("  Body: ${response.body?.string()?.take(200)}")
            response.close()
        } catch (e: Exception) {
            diag.appendLine("  EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
            val sw = StringWriter()
            e.printStackTrace(PrintWriter(sw))
            diag.appendLine("  Stack: ${sw.toString().take(500)}")
        }
        diag.appendLine()
        copyToClipboard(diag.toString())

        // 3. Test image URL fetch (profile image)
        diag.appendLine("[TEST 2: Profile image fetch]")
        if (profileImageUrl != null) {
            try {
                val imgUrl = "${serverUrl.trimEnd('/')}$profileImageUrl"
                diag.appendLine("  URL: $imgUrl")
                val request = Request.Builder()
                    .url(imgUrl)
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()
                val response = TrustedHttpClient.instance.newCall(request).execute()
                diag.appendLine("  Response: HTTP ${response.code}")
                diag.appendLine("  Content-Type: ${response.header("Content-Type")}")
                diag.appendLine("  Content-Length: ${response.header("Content-Length")}")
                val bodyBytes = response.body?.bytes()
                diag.appendLine("  Body size: ${bodyBytes?.size ?: 0} bytes")
                response.close()
            } catch (e: Exception) {
                diag.appendLine("  EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
                val sw = StringWriter()
                e.printStackTrace(PrintWriter(sw))
                diag.appendLine("  Stack: ${sw.toString().take(500)}")
            }
        } else {
            diag.appendLine("  SKIPPED: no profile_image_url in prefs")
        }
        diag.appendLine()
        copyToClipboard(diag.toString())

        // 4. Test push sync API
        diag.appendLine("[TEST 3: Push sync buildApiService]")
        try {
            val client = TrustedHttpClient.instance.newBuilder()
                .addInterceptor { chain ->
                    val req = chain.request().newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                    chain.proceed(req)
                }
                .build()
            diag.appendLine("  Client built OK (SSL factory: ${client.sslSocketFactory.javaClass.simpleName})")

            val retrofit = retrofit2.Retrofit.Builder()
                .baseUrl(serverUrl.trimEnd('/') + "/")
                .client(client)
                .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
                .build()
            diag.appendLine("  Retrofit built OK, baseUrl=${retrofit.baseUrl()}")

            val testRequest = Request.Builder()
                .url(serverUrl.trimEnd('/') + "/api/sync/changes?since=999999999&include=chits")
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()
            val response = client.newCall(testRequest).execute()
            diag.appendLine("  Sync test response: HTTP ${response.code}")
            diag.appendLine("  Body: ${response.body?.string()?.take(300)}")
            response.close()
        } catch (e: Exception) {
            diag.appendLine("  EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
            val sw = StringWriter()
            e.printStackTrace(PrintWriter(sw))
            diag.appendLine("  Stack: ${sw.toString().take(500)}")
        }
        diag.appendLine()
        copyToClipboard(diag.toString())

        // 5. Test TrustedHttpClient SSL details
        diag.appendLine("[TEST 4: TrustedHttpClient SSL details]")
        try {
            val client = TrustedHttpClient.instance
            diag.appendLine("  SSLSocketFactory: ${client.sslSocketFactory.javaClass.name}")
            diag.appendLine("  HostnameVerifier: ${client.hostnameVerifier.javaClass.name}")
            diag.appendLine("  Protocols: ${client.protocols}")
            diag.appendLine("  ConnectTimeout: ${client.connectTimeoutMillis}ms")
            diag.appendLine("  ReadTimeout: ${client.readTimeoutMillis}ms")
        } catch (e: Exception) {
            diag.appendLine("  EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
        }
        diag.appendLine()

        diag.appendLine("=== END DIAGNOSTIC ===")
        copyToClipboard(diag.toString())
    }

    private fun copyToClipboard(text: String) {
        try {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("CWOC Diagnostic", text)
            clipboard.setPrimaryClip(clip)
            Log.d("CWOC_DIAG", "Diagnostic copied to clipboard (${text.length} chars)")
        } catch (e: Exception) {
            Log.e("CWOC_DIAG", "Failed to copy diagnostic to clipboard: ${e.message}")
        }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
