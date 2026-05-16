package com.cwoc.app.data.sync

import android.util.Log
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.mapper.toPushDto
import com.cwoc.app.data.remote.CwocApiService
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
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
interface SyncPushEngine {
    /**
     * Pushes a single dirty chit to the server.
     * If the chit is not dirty or not found, returns [PushResult.Success] immediately.
     */
    suspend fun pushSingle(chitId: String): PushResult

    /**
     * Pushes all dirty chits to the server in a single batch request.
     * If no dirty chits exist, returns [PushResult.Success] immediately.
     */
    suspend fun pushAll(): PushResult
}

/**
 * Implementation of [SyncPushEngine] that pushes dirty records via POST /api/sync/push.
 *
 * Response handling per chit:
 * - "accepted" / "created" → clear dirty state, update syncVersion
 * - "merged" → map merged ChitDto back to ChitEntity, clearDirtyWithMerge
 * - "error" → preserve dirty state (do nothing), log the error
 *
 * Network failures preserve dirty state automatically (no clearDirty is called),
 * relying on the PushSyncWorker to retry on reconnect.
 */
class SyncPushEngineImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncMetadataDao: SyncMetadataDao,
    private val syncStateManager: SyncStateManager,
    private val gson: Gson
) : SyncPushEngine {

    override suspend fun pushSingle(chitId: String): PushResult {
        val entity = chitDao.getById(chitId)
            ?: return PushResult.NetworkError("Chit not found: $chitId")

        if (!entity.isDirty) {
            Log.d(TAG, "pushSingle($chitId): not dirty, skipping")
            return PushResult.Success(entity.syncVersion)
        }

        return pushEntities(listOf(entity))
    }

    override suspend fun pushAll(): PushResult {
        val dirtyChits = chitDao.getDirtyChits()
        if (dirtyChits.isEmpty()) {
            Log.d(TAG, "pushAll: no dirty chits")
            return PushResult.Success(0)
        }

        Log.d(TAG, "pushAll: pushing ${dirtyChits.size} dirty chit(s)")
        return pushEntities(dirtyChits)
    }

    /**
     * Pushes a list of entities to the server and processes per-chit results.
     */
    private suspend fun pushEntities(entities: List<ChitEntity>): PushResult {
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
                            Log.d(TAG, "Push merged: id=${result.id}, conflict_fields=${result.conflict_fields}")
                        } ?: run {
                            // Fallback: server said "merged" but didn't return merged entity
                            // Just clear dirty and update version
                            dirtyTracker.clearDirty(result.id)
                            result.sync_version?.let { version ->
                                chitDao.updateSyncVersion(result.id, version)
                            }
                            Log.w(TAG, "Push merged without merged entity: id=${result.id}")
                        }
                        successes++
                    }
                    "error" -> {
                        // Retain dirty state — will retry later
                        Log.e(TAG, "Push error: id=${result.id}, conflict_fields=${result.conflict_fields}")
                        failures++
                    }
                    else -> {
                        Log.w(TAG, "Push unknown status '${result.status}': id=${result.id}")
                        failures++
                    }
                }
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
}
