package com.cwoc.app.data.sync

import android.content.SharedPreferences
import android.util.Log
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.SyncMetadataEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.repository.SyncResult
import com.cwoc.app.data.remote.dto.ClientLogRequest
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.time.Instant
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

private const val TAG = "CWOC_SYNC"

@Singleton
class SyncEngine @Inject constructor(
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val settingsDao: SettingsDao,
    private val syncMetadataDao: SyncMetadataDao,
    private val gson: Gson,
    private val prefs: SharedPreferences
) {

    /**
     * Build a fresh API service using the stored server URL and auth token.
     * This ensures we always use the correct URL (not the stale singleton).
     */
    private fun buildApiService(): CwocApiService? {
        val serverUrl = prefs.getString("server_url", null)
        val token = prefs.getString("device_token", null)

        if (serverUrl.isNullOrBlank() || token.isNullOrBlank()) {
            Log.e(TAG, "Cannot sync: serverUrl=$serverUrl, token=${if (token != null) "present" else "null"}")
            return null
        }

        val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })
        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustAllCerts, SecureRandom())

        val client = OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true }
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
                chain.proceed(request)
            }
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(serverUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit.create(CwocApiService::class.java)
    }

    suspend fun performSync(since: Int = 0): SyncResult {
        Log.d(TAG, "Starting sync with since=$since")

        // Ensure sync metadata row exists
        if (syncMetadataDao.getMetadata() == null) {
            syncMetadataDao.upsert(SyncMetadataEntity())
        }

        val apiService = buildApiService()
        if (apiService == null) {
            Log.e(TAG, "Cannot build API service — no server URL or token")
            reportLog("Sync aborted: no server URL or token configured", "error")
            return SyncResult.Error(0, "Not authenticated")
        }

        syncMetadataDao.updateSyncStatus("syncing")

        try {
            Log.d(TAG, "Calling GET /api/sync/changes?since=$since&include=chits,contacts,settings")
            val response = apiService.getSyncChanges(
                since = since,
                include = "chits,contacts,settings"
            )

            if (!response.isSuccessful) {
                Log.e(TAG, "Sync failed: HTTP ${response.code()} ${response.message()}")
                syncMetadataDao.updateSyncStatus("error")
                reportLog("Sync HTTP error: ${response.code()} ${response.message()}", "error")
                return SyncResult.Error(response.code(), response.message())
            }

            val body = response.body()
            if (body == null) {
                Log.e(TAG, "Sync failed: empty response body")
                syncMetadataDao.updateSyncStatus("error")
                reportLog("Sync failed: empty response body", "error")
                return SyncResult.Error(0, "Empty response body")
            }

            Log.d(TAG, "Sync response: server_version=${body.server_version}, chits=${body.chits?.size ?: 0}, contacts=${body.contacts?.size ?: 0}, settings=${if (body.settings != null) "present" else "null"}")

            val now = Instant.now().toString()

            // Upsert chits
            body.chits?.let { chits ->
                if (chits.isNotEmpty()) {
                    Log.d(TAG, "Upserting ${chits.size} chits")
                    val entities = chits.map { it.toEntity(now, gson) }
                    // Log first chit for debugging
                    entities.firstOrNull()?.let { first ->
                        Log.d(TAG, "First chit: id=${first.id}, title=${first.title}, status=${first.status}, deleted=${first.deleted}, archived=${first.archived}")
                    }
                    chitDao.upsertAll(entities)
                    val dbCount = chitDao.getCount()
                    Log.d(TAG, "Chits upserted successfully. DB now has $dbCount total chits")
                } else {
                    Log.d(TAG, "Server returned empty chits list")
                }
            } ?: Log.d(TAG, "Server returned null chits field")

            // Upsert contacts
            body.contacts?.let { contacts ->
                if (contacts.isNotEmpty()) {
                    Log.d(TAG, "Upserting ${contacts.size} contacts")
                    val entities = contacts.map { it.toEntity(now, gson) }
                    contactDao.upsertAll(entities)
                    Log.d(TAG, "Contacts upserted successfully")
                }
            }

            // Upsert settings
            body.settings?.let { settings ->
                Log.d(TAG, "Upserting settings")
                val entity = settings.toEntity(now, gson)
                settingsDao.upsert(entity)
            }

            // Update high-water mark
            syncMetadataDao.updateHighWaterMark(body.server_version, now)
            syncMetadataDao.updateSyncStatus("idle")

            val finalDbCount = chitDao.getCount()
            Log.d(TAG, "Sync complete. New high-water mark: ${body.server_version}, DB chit count: $finalDbCount")
            reportLog("Sync success: version=${body.server_version}, chits_received=${body.chits?.size ?: 0}, contacts_received=${body.contacts?.size ?: 0}, db_chit_count=$finalDbCount", "info")
            return SyncResult.Success(body.server_version)

        } catch (e: IOException) {
            Log.e(TAG, "Sync IOException: ${e.message}", e)
            syncMetadataDao.updateSyncStatus("error")
            reportLog("Sync IOException: ${e.message}", "error")
            return SyncResult.NetworkError(e.message ?: "Network error")
        } catch (e: Exception) {
            Log.e(TAG, "Sync Exception: ${e.javaClass.simpleName}: ${e.message}", e)
            syncMetadataDao.updateSyncStatus("error")
            reportLog("Sync Exception: ${e.javaClass.simpleName}: ${e.message}", "error")
            return SyncResult.NetworkError("${e.javaClass.simpleName}: ${e.message}")
        }
    }

    /**
     * Report a log entry to the server's client-log endpoint for remote diagnostics.
     * Fire-and-forget — failures are silently logged locally.
     */
    suspend fun reportLog(message: String, level: String = "info") {
        try {
            val apiService = buildApiService() ?: return
            withContext(Dispatchers.IO) {
                val request = ClientLogRequest(
                    message = message,
                    level = level,
                    source = "android-sync",
                    timestamp = Instant.now().toString()
                )
                val response = apiService.postClientLog(request)
                if (!response.isSuccessful) {
                    Log.w(TAG, "Client log POST failed: HTTP ${response.code()}")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to report to server: ${e.message}")
        }
    }
}
