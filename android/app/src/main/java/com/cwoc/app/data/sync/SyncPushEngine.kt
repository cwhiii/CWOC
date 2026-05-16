package com.cwoc.app.data.sync

import android.util.Log
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.mapper.toPushDto
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.ContactPushResultDto
import com.cwoc.app.data.remote.dto.SettingsPushResultDto
import com.cwoc.app.data.remote.dto.SyncPushRequestDto
import com.google.gson.Gson
import java.time.Instant
import javax.inject.Inject

private const val TAG = "CWOC_PUSH"

/**
 * Result of a push operation.
 * - [Success]: All records pushed successfully; includes the new server version.
 * - [Partial]: Some records succeeded, some failed (error status from server).
 * - [NetworkError]: The HTTP request itself failed (connectivity, timeout, etc.).
 */
sealed class PushResult {
    data class Success(val serverVersion: Int) : PushResult()
    data class Partial(val successes: Int, val failures: Int) : PushResult()
    data class NetworkError(val message: String) : PushResult()
}

/**
 * Interface for pushing dirty local records to the server.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 18.1, 18.2, 18.3, 18.4, 18.5
 */
interface SyncPushEngine {
    /**
     * Pushes a single dirty chit to the server.
     * If the chit is not dirty or not found, returns [PushResult.Success] immediately.
     */
    suspend fun pushSingle(chitId: String): PushResult

    /**
     * Pushes all dirty records (chits, contacts, settings) to the server in a single batch request.
     * If no dirty records exist, returns [PushResult.Success] immediately.
     */
    suspend fun pushAll(): PushResult
}

/**
 * Implementation of [SyncPushEngine] that pushes dirty records via POST /api/sync/push.
 *
 * Response handling per chit:
 * - "accepted" / "created" → clear dirty state, update syncVersion
 * - "merged" → map merged ChitDto back to ChitEntity, clearDirtyWithMerge, set conflict state
 * - "error" → preserve dirty state (do nothing), log the error
 *
 * Response handling per contact:
 * - "accepted" / "created" → clear dirty state, update syncVersion
 * - "merged" → update entity with merged data, set conflict state
 * - "error" → preserve dirty state for retry
 *
 * Response handling for settings:
 * - "accepted" → clear dirty state, update syncVersion
 * - "merged" → delegate to SettingsConflictResolver (LWW replace)
 *
 * Network failures preserve dirty state automatically (no clearDirty is called),
 * relying on the PushSyncWorker to retry on reconnect.
 */
class SyncPushEngineImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val settingsDao: SettingsDao,
    private val dirtyTracker: DirtyTracker,
    private val syncMetadataDao: SyncMetadataDao,
    private val syncStateManager: SyncStateManager,
    private val settingsConflictResolver: SettingsConflictResolver,
    private val gson: Gson
) : SyncPushEngine {

    override suspend fun pushSingle(chitId: String): PushResult {
        val entity = chitDao.getById(chitId)
            ?: return PushResult.NetworkError("Chit not found: $chitId")

        if (!entity.isDirty) {
            Log.d(TAG, "pushSingle($chitId): not dirty, skipping")
            return PushResult.Success(entity.syncVersion)
        }

        return pushChitEntities(listOf(entity))
    }

    override suspend fun pushAll(): PushResult {
        val dirtyChits = chitDao.getDirtyChits()
        val dirtyContacts = contactDao.getDirtyContacts()
        val settings = settingsDao.get()
        val dirtySettings = if (settings?.isDirty == true) settings else null

        if (dirtyChits.isEmpty() && dirtyContacts.isEmpty() && dirtySettings == null) {
            Log.d(TAG, "pushAll: no dirty records")
            return PushResult.Success(0)
        }

        Log.d(TAG, "pushAll: pushing ${dirtyChits.size} chit(s), ${dirtyContacts.size} contact(s), settings=${dirtySettings != null}")

        syncStateManager.setSyncing()

        val request = SyncPushRequestDto(
            chits = dirtyChits.takeIf { it.isNotEmpty() }?.map { it.toPushDto() },
            contacts = dirtyContacts.takeIf { it.isNotEmpty() }?.map { it.toPushDto() },
            settings = dirtySettings?.toPushDto()
        )

        try {
            val response = apiService.pushChanges(request)

            if (!response.isSuccessful) {
                Log.e(TAG, "Push failed: HTTP ${response.code()} ${response.message()}")
                syncStateManager.setIdle()
                return PushResult.NetworkError("HTTP ${response.code()}")
            }

            val body = response.body()
            if (body == null) {
                Log.e(TAG, "Push failed: empty response body")
                syncStateManager.setIdle()
                return PushResult.NetworkError("Empty response body")
            }

            var successes = 0
            var failures = 0

            // Process chit results
            body.results.chits?.forEach { result ->
                when (result.status) {
                    "accepted", "created" -> {
                        dirtyTracker.clearDirty(result.id)
                        result.sync_version?.let { version ->
                            chitDao.updateSyncVersion(result.id, version)
                        }
                        Log.d(TAG, "Chit push ${result.status}: id=${result.id}, syncVersion=${result.sync_version}")
                        successes++
                    }
                    "merged" -> {
                        result.merged?.let { mergedDto ->
                            val mergedEntity = mergedDto.toEntity(
                                Instant.now().toString(),
                                gson
                            )
                            dirtyTracker.clearDirtyWithMerge(result.id, mergedEntity)
                            // Set conflict state for UI banner — always set hasUnviewedConflict=true on merge
                            val conflictFieldsJson = result.conflict_fields?.let { gson.toJson(it) } ?: "[]"
                            chitDao.setConflictState(result.id, conflictFieldsJson)
                            Log.d(TAG, "Chit push merged: id=${result.id}, conflict_fields=${result.conflict_fields}")
                        } ?: run {
                            // Fallback: server said "merged" but didn't return merged entity
                            dirtyTracker.clearDirty(result.id)
                            result.sync_version?.let { version ->
                                chitDao.updateSyncVersion(result.id, version)
                            }
                            // Still mark conflict since server said "merged"
                            val conflictFieldsJson = result.conflict_fields?.let { gson.toJson(it) } ?: "[]"
                            chitDao.setConflictState(result.id, conflictFieldsJson)
                            Log.w(TAG, "Chit push merged without merged entity: id=${result.id}")
                        }
                        successes++
                    }
                    "error" -> {
                        // Retain dirty state — will retry later
                        Log.e(TAG, "Chit push error: id=${result.id}, conflict_fields=${result.conflict_fields}")
                        failures++
                    }
                    else -> {
                        Log.w(TAG, "Chit push unknown status '${result.status}': id=${result.id}")
                        failures++
                    }
                }
            }

            // Process contact results
            body.results.contacts?.forEach { result ->
                val contactResult = processContactResult(result)
                if (contactResult) successes++ else failures++
            }

            // Process settings result
            body.results.settings?.let { result ->
                val settingsResult = processSettingsResult(result)
                if (settingsResult) successes++ else failures++
            }

            // Update high-water mark from server response
            syncMetadataDao.updateHighWaterMark(
                body.server_version,
                Instant.now().toString()
            )

            syncStateManager.setIdle()

            Log.d(TAG, "Push complete: successes=$successes, failures=$failures, server_version=${body.server_version}")

            return if (failures == 0) {
                PushResult.Success(body.server_version)
            } else {
                PushResult.Partial(successes, failures)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Push exception: ${e.javaClass.simpleName}: ${e.message}", e)
            syncStateManager.setIdle()
            // Network failure — dirty state preserved automatically (no clearDirty called)
            return PushResult.NetworkError(e.message ?: "Unknown error")
        }
    }

    // --- Contact result processing ---

    /**
     * Processes a single contact push result from the server.
     * Returns true if the result was a success (accepted/created/merged), false if error.
     *
     * - "accepted" / "created" → clear dirty state, update syncVersion
     * - "merged" → update entity with merged data, set conflict state for UI
     * - "error" → leave dirty state intact for retry
     */
    private suspend fun processContactResult(result: ContactPushResultDto): Boolean {
        return when (result.status) {
            "accepted", "created" -> {
                dirtyTracker.clearContactDirty(result.id)
                result.sync_version?.let { version ->
                    contactDao.updateSyncVersion(result.id, version)
                }
                Log.d(TAG, "Contact push ${result.status}: id=${result.id}, syncVersion=${result.sync_version}")
                true
            }
            "merged" -> {
                result.merged?.let { mergedDto ->
                    val mergedEntity = mergedDto.toEntity(
                        Instant.now().toString(),
                        gson
                    )
                    // Replace local entity with merged version, clear dirty, set conflict state
                    val cleanEntity = mergedEntity.copy(
                        isDirty = false,
                        dirtyFields = "[]",
                        hasUnviewedConflict = true,
                        conflictFields = result.conflict_fields?.let { gson.toJson(it) } ?: "[]"
                    )
                    contactDao.upsert(cleanEntity)
                    Log.d(TAG, "Contact push merged: id=${result.id}, conflict_fields=${result.conflict_fields}")
                } ?: run {
                    // Fallback: server said "merged" but didn't return merged entity
                    dirtyTracker.clearContactDirty(result.id)
                    result.sync_version?.let { version ->
                        contactDao.updateSyncVersion(result.id, version)
                    }
                    // Still set conflict state so user is aware
                    val conflictFieldsJson = result.conflict_fields?.let { gson.toJson(it) } ?: "[]"
                    contactDao.setConflictState(result.id, conflictFieldsJson)
                    Log.w(TAG, "Contact push merged without merged entity: id=${result.id}")
                }
                true
            }
            "error" -> {
                // Retain dirty state — will retry later
                Log.e(TAG, "Contact push error: id=${result.id}")
                false
            }
            else -> {
                Log.w(TAG, "Contact push unknown status '${result.status}': id=${result.id}")
                false
            }
        }
    }

    // --- Settings result processing ---

    /**
     * Processes the settings push result from the server.
     * Returns true if the result was a success (accepted/merged), false otherwise.
     *
     * - "accepted" → clear dirty state, update syncVersion
     * - "merged" → delegate to SettingsConflictResolver for LWW replacement
     */
    private suspend fun processSettingsResult(result: SettingsPushResultDto): Boolean {
        return when (result.status) {
            "accepted" -> {
                dirtyTracker.clearSettingsDirty()
                result.sync_version?.let { version ->
                    settingsDao.updateSyncVersion(version)
                }
                Log.d(TAG, "Settings push accepted: syncVersion=${result.sync_version}")
                true
            }
            "merged" -> {
                result.merged?.let { mergedDto ->
                    val mergedEntity = mergedDto.toEntity(
                        Instant.now().toString(),
                        gson
                    )
                    settingsConflictResolver.resolve(mergedEntity)
                    result.sync_version?.let { version ->
                        settingsDao.updateSyncVersion(version)
                    }
                    Log.d(TAG, "Settings push merged: resolved via LWW, syncVersion=${result.sync_version}")
                } ?: run {
                    // Fallback: server said "merged" but didn't return merged entity
                    dirtyTracker.clearSettingsDirty()
                    result.sync_version?.let { version ->
                        settingsDao.updateSyncVersion(version)
                    }
                    Log.w(TAG, "Settings push merged without merged entity")
                }
                true
            }
            else -> {
                Log.w(TAG, "Settings push unknown status '${result.status}'")
                false
            }
        }
    }

    // --- Legacy single-chit push (used by pushSingle) ---

    /**
     * Pushes a list of chit entities to the server (chits only, no contacts/settings).
     * Used by pushSingle() for immediate single-chit pushes.
     */
    private suspend fun pushChitEntities(entities: List<ChitEntity>): PushResult {
        syncStateManager.setSyncing()

        val request = SyncPushRequestDto(
            chits = entities.map { it.toPushDto() }
        )

        try {
            val response = apiService.pushChanges(request)

            if (!response.isSuccessful) {
                Log.e(TAG, "Push failed: HTTP ${response.code()} ${response.message()}")
                syncStateManager.setIdle()
                return PushResult.NetworkError("HTTP ${response.code()}")
            }

            val body = response.body()
            if (body == null) {
                Log.e(TAG, "Push failed: empty response body")
                syncStateManager.setIdle()
                return PushResult.NetworkError("Empty response body")
            }

            var successes = 0
            var failures = 0

            body.results.chits?.forEach { result ->
                when (result.status) {
                    "accepted", "created" -> {
                        dirtyTracker.clearDirty(result.id)
                        result.sync_version?.let { version ->
                            chitDao.updateSyncVersion(result.id, version)
                        }
                        Log.d(TAG, "Push ${result.status}: id=${result.id}, syncVersion=${result.sync_version}")
                        successes++
                    }
                    "merged" -> {
                        result.merged?.let { mergedDto ->
                            val mergedEntity = mergedDto.toEntity(
                                Instant.now().toString(),
                                gson
                            )
                            dirtyTracker.clearDirtyWithMerge(result.id, mergedEntity)
                            // Always set conflict state on merge
                            val conflictFieldsJson = result.conflict_fields?.let { gson.toJson(it) } ?: "[]"
                            chitDao.setConflictState(result.id, conflictFieldsJson)
                            Log.d(TAG, "Push merged: id=${result.id}, conflict_fields=${result.conflict_fields}")
                        } ?: run {
                            dirtyTracker.clearDirty(result.id)
                            result.sync_version?.let { version ->
                                chitDao.updateSyncVersion(result.id, version)
                            }
                            // Still mark conflict since server said "merged"
                            val conflictFieldsJson = result.conflict_fields?.let { gson.toJson(it) } ?: "[]"
                            chitDao.setConflictState(result.id, conflictFieldsJson)
                            Log.w(TAG, "Push merged without merged entity: id=${result.id}")
                        }
                        successes++
                    }
                    "error" -> {
                        Log.e(TAG, "Push error: id=${result.id}, conflict_fields=${result.conflict_fields}")
                        failures++
                    }
                    else -> {
                        Log.w(TAG, "Push unknown status '${result.status}': id=${result.id}")
                        failures++
                    }
                }
            }

            syncMetadataDao.updateHighWaterMark(
                body.server_version,
                Instant.now().toString()
            )

            syncStateManager.setIdle()

            Log.d(TAG, "Push complete: successes=$successes, failures=$failures, server_version=${body.server_version}")

            return if (failures == 0) {
                PushResult.Success(body.server_version)
            } else {
                PushResult.Partial(successes, failures)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Push exception: ${e.javaClass.simpleName}: ${e.message}", e)
            syncStateManager.setIdle()
            return PushResult.NetworkError(e.message ?: "Unknown error")
        }
    }
}
