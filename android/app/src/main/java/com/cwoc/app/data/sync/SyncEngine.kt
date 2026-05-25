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
import com.cwoc.app.notification.EmailNotificationHelper
import com.cwoc.app.notification.NotificationScheduler
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "CWOC_SYNC"

@Singleton
class SyncEngine @Inject constructor(
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val settingsDao: SettingsDao,
    private val syncMetadataDao: SyncMetadataDao,
    private val edgeCaseHandler: EdgeCaseHandler,
    private val notificationScheduler: NotificationScheduler,
    private val emailNotificationHelper: EmailNotificationHelper,
    private val gson: Gson,
    private val prefs: SharedPreferences,
    private val apiService: CwocApiService
) {

    suspend fun performSync(since: Int = 0): SyncResult {
        val syncStart = System.nanoTime()
        Log.d(TAG, "[PERF] Starting sync with since=$since")

        // Ensure sync metadata row exists
        if (syncMetadataDao.getMetadata() == null) {
            syncMetadataDao.upsert(SyncMetadataEntity())
        }

        // Verify credentials are present before attempting sync
        val serverUrl = prefs.getString("server_url", null)
        val token = prefs.getString("device_token", null)
        if (serverUrl.isNullOrBlank() || token.isNullOrBlank()) {
            Log.e(TAG, "Cannot sync: serverUrl=$serverUrl, token=${if (token != null) "present" else "null"}")
            reportLog("Sync aborted: no server URL or token configured", "error")
            return SyncResult.Error(0, "Not authenticated")
        }

        syncMetadataDao.updateSyncStatus("syncing")

        try {
            val httpStart = System.nanoTime()
            Log.d(TAG, "[PERF] Calling GET /api/sync/changes?since=$since")
            val response = apiService.getSyncChanges(
                since = since,
                include = "chits,contacts,settings"
            )
            val httpElapsed = (System.nanoTime() - httpStart) / 1_000_000
            Log.d(TAG, "[PERF] HTTP response received in ${httpElapsed}ms, code=${response.code()}")

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

            // Process chits — handle deletions via EdgeCaseHandler, upsert others, schedule alarms
            body.chits?.let { chits ->
                if (chits.isNotEmpty()) {
                    Log.d(TAG, "Processing ${chits.size} chits")

                    val deletedChits = chits.filter { it.deleted == true }
                    val activeChits = chits.filter { it.deleted != true }

                    // Handle server deletions via EdgeCaseHandler (delete wins over local edits)
                    if (deletedChits.isNotEmpty()) {
                        Log.d(TAG, "Handling ${deletedChits.size} server deletions")
                        deletedChits.forEach { chitDto ->
                            edgeCaseHandler.handleServerDeletion(chitDto.id)
                        }
                    }

                    // Upsert non-deleted chits
                    if (activeChits.isNotEmpty()) {
                        Log.d(TAG, "Upserting ${activeChits.size} active chits")
                        val entities = activeChits.map { it.toEntity(now, gson) }
                        // Log first chit for debugging
                        entities.firstOrNull()?.let { first ->
                            Log.d(TAG, "First chit: id=${first.id}, title=${first.title}, status=${first.status}, deleted=${first.deleted}, archived=${first.archived}")
                        }

                        // Detect new email chits BEFORE upserting (so we can tell which are new)
                        // Only show notifications on incremental syncs (since > 0), not initial full sync
                        val newEmailChits = mutableListOf<com.cwoc.app.data.local.entity.ChitEntity>()
                        if (since > 0) {
                            entities.filter { !it.emailMessageId.isNullOrBlank() }.forEach { emailEntity ->
                                val existing = chitDao.getById(emailEntity.id)
                                if (existing == null) {
                                    newEmailChits.add(emailEntity)
                                }
                            }
                        }

                        val upsertStart = System.currentTimeMillis()
                        chitDao.upsertAll(entities)
                        val upsertElapsed = System.currentTimeMillis() - upsertStart
                        Log.d(TAG, "[PERF] upsertAll ${entities.size} chits took ${upsertElapsed}ms")

                        // Fire notifications for new email chits
                        if (newEmailChits.isNotEmpty()) {
                            Log.d(TAG, "Detected ${newEmailChits.size} new email chits — showing notifications")
                            newEmailChits.forEach { emailEntity ->
                                emailNotificationHelper.showEmailNotification(emailEntity)
                            }
                            if (newEmailChits.size > 1) {
                                emailNotificationHelper.showEmailSummaryNotification(newEmailChits.size)
                            }
                        }

                        // Schedule/reschedule alarms for chits with alerts
                        entities.forEach { entity ->
                            if (!entity.alerts.isNullOrBlank() && entity.alerts != "[]" && entity.alerts != "null") {
                                Log.d(TAG, "Scheduling alarms for chit ${entity.id}")
                                notificationScheduler.scheduleAlarms(entity)
                            }
                        }
                    }

                    val dbCount = chitDao.getCount()
                    Log.d(TAG, "Chits processed successfully. DB now has $dbCount total chits")
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

            // Replace settings with server version
            body.settings?.let { settings ->
                Log.d(TAG, "Replacing settings with server version")
                val entity = settings.toEntity(now, gson)
                settingsDao.replace(entity)
                Log.d(TAG, "Settings replaced successfully")
            }

            // If settings weren't included in sync response but local settings have
            // missing critical fields (tags, saved_locations), force-fetch from API.
            // This handles the case where settings were updated on the server after
            // the app's initial sync, and the settings sync_version wasn't bumped.
            if (body.settings == null) {
                val localSettings = settingsDao.get()
                if (localSettings != null && (localSettings.tags.isNullOrBlank() || localSettings.tags == "[]" || localSettings.tags == "null" ||
                    localSettings.savedLocations.isNullOrBlank() || localSettings.savedLocations == "[]" || localSettings.savedLocations == "null")) {
                    Log.d(TAG, "Local settings missing tags or savedLocations — force-fetching from API")
                    try {
                        val settingsResp = apiService.getSettings(localSettings.userId)
                        if (settingsResp.isSuccessful) {
                            val serverMap = settingsResp.body()
                            if (serverMap != null) {
                                val serverTags = serverMap["tags"]
                                val serverLocations = serverMap["saved_locations"]
                                val tagsJson = serverTags?.let { gson.toJson(it) }
                                val locationsJson = serverLocations?.let { gson.toJson(it) }
                                if ((tagsJson != null && tagsJson != "null" && tagsJson != "[]") ||
                                    (locationsJson != null && locationsJson != "null" && locationsJson != "[]")) {
                                    val updatedEntity = localSettings.copy(
                                        tags = if (tagsJson != null && tagsJson != "null" && tagsJson != "[]") tagsJson else localSettings.tags,
                                        savedLocations = if (locationsJson != null && locationsJson != "null" && locationsJson != "[]") locationsJson else localSettings.savedLocations
                                    )
                                    settingsDao.replace(updatedEntity)
                                    Log.d(TAG, "Force-fetched settings: tags=${tagsJson?.take(50)}, savedLocations=${locationsJson?.take(50)}")
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to force-fetch settings (best-effort): ${e.message}")
                    }
                }
            }

            // Process tag renames — propagate to all local chits without dirtying
            body.tag_renames?.let { tagRenames ->
                if (tagRenames.isNotEmpty()) {
                    Log.d(TAG, "Processing ${tagRenames.size} tag renames")
                    tagRenames.forEach { rename ->
                        Log.d(TAG, "Applying tag rename: '${rename.old_tag}' -> '${rename.new_tag}'")
                        edgeCaseHandler.applyTagRename(rename.old_tag, rename.new_tag)
                    }
                    Log.d(TAG, "Tag renames applied successfully")
                }
            }

            // Update high-water mark
            syncMetadataDao.updateHighWaterMark(body.server_version, now)
            syncMetadataDao.updateSyncStatus("idle")

            val finalDbCount = chitDao.getCount()
            val syncElapsed = (System.nanoTime() - syncStart) / 1_000_000
            Log.d(TAG, "[PERF] Sync complete in ${syncElapsed}ms. New high-water mark: ${body.server_version}, DB chit count: $finalDbCount")
            reportLog("[PERF] Sync complete: ${syncElapsed}ms total, version=${body.server_version}, chits_received=${body.chits?.size ?: 0}, contacts_received=${body.contacts?.size ?: 0}, tag_renames=${body.tag_renames?.size ?: 0}, db_chit_count=$finalDbCount", "info")

            // ── Fetch user profile via the SAME working apiService that just synced ──
            // This ensures profile_image_url is always populated using the proven sync pipeline.
            try {
                val meResponse = apiService.getMe()
                if (meResponse.isSuccessful) {
                    val profile = meResponse.body()
                    if (profile != null) {
                        prefs.edit()
                            .putString("user_display_name", profile.displayName)
                            .putString("user_username", profile.username)
                            .putString("user_id", profile.userId)
                            .putString("user_profile_image_url", profile.profileImageUrl)
                            .apply()
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to fetch user profile during sync: ${e.message}")
            }

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
