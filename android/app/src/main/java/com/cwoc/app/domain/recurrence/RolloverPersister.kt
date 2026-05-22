package com.cwoc.app.domain.recurrence

import android.util.Log
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.sync.DirtyTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "CWOC_ROLLOVER"

/**
 * Interface for persisting habit rollover changes to the server.
 *
 * The caller (ViewModel) invokes [persistRollover] with a [RolloverResult] that has
 * `rolledOver = true`. Persistence is fire-and-forget — the call returns immediately
 * and the actual PATCH happens asynchronously on a background thread.
 *
 * Error handling:
 * - HTTP 404: Discard silently (chit no longer exists on server)
 * - Network error or HTTP 500+: Log failure and mark chit dirty for retry on next sync cycle
 *
 * Validates: Requirements 4
 */
interface RolloverPersister {
    /**
     * Persist rollover changes to the server asynchronously (fire-and-forget).
     *
     * @param chitId The ID of the chit that was rolled over
     * @param result The RolloverResult containing the updated chit state
     */
    fun persistRollover(chitId: String, result: RolloverResult)
}

/**
 * Implementation of [RolloverPersister] that uses PATCH /api/chits/{id}/fields
 * to persist rollover changes asynchronously.
 *
 * Injected via Hilt as a singleton. Uses its own CoroutineScope on Dispatchers.IO
 * for fire-and-forget behavior (matching the pattern in ChitRepository.triggerPushIfOnline).
 */
@Singleton
class RolloverPersisterImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val dirtyTracker: DirtyTracker
) : RolloverPersister {

    private val persistScope = CoroutineScope(Dispatchers.IO)

    override fun persistRollover(chitId: String, result: RolloverResult) {
        if (!result.rolledOver) return

        persistScope.launch {
            try {
                val updatedChit = result.updatedChit

                // Build the fields map matching server's ALLOWED_FIELDS
                val fields = mutableMapOf<String, Any?>(
                    "habit_success" to (updatedChit.habitSuccess ?: 0),
                    "status" to (updatedChit.status ?: "")
                )

                // recurrence_exceptions is stored as a JSON string in the entity,
                // but the server expects it as a parsed JSON array
                val exceptionsJson = updatedChit.recurrenceExceptions
                if (!exceptionsJson.isNullOrBlank() && exceptionsJson != "null") {
                    // Parse the JSON string into a list so Retrofit serializes it correctly
                    val gson = com.google.gson.Gson()
                    val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any?>>>() {}.type
                    val parsed: List<Map<String, Any?>> = gson.fromJson(exceptionsJson, type)
                    fields["recurrence_exceptions"] = parsed
                } else {
                    fields["recurrence_exceptions"] = emptyList<Map<String, Any?>>()
                }

                Log.d(TAG, "Persisting rollover for chit $chitId: fields=${fields.keys}")

                val response = apiService.patchChitFields(chitId, fields)

                when {
                    response.isSuccessful -> {
                        Log.d(TAG, "Rollover persisted successfully for chit $chitId")
                    }
                    response.code() == 404 -> {
                        // Chit no longer exists on server — discard without retry
                        Log.w(TAG, "Rollover persistence discarded for chit $chitId: 404 (chit not found on server)")
                    }
                    response.code() >= 500 -> {
                        // Server error — mark dirty for retry on next sync cycle
                        Log.e(TAG, "Rollover persistence failed for chit $chitId: HTTP ${response.code()}")
                        markDirtyForRetry(chitId)
                    }
                    else -> {
                        // Other client errors (400, 403, etc.) — mark dirty for retry
                        Log.e(TAG, "Rollover persistence failed for chit $chitId: HTTP ${response.code()}")
                        markDirtyForRetry(chitId)
                    }
                }
            } catch (e: Exception) {
                // Network error (no connectivity, timeout, etc.) — mark dirty for retry
                Log.e(TAG, "Rollover persistence network error for chit $chitId: ${e.message}", e)
                markDirtyForRetry(chitId)
            }
        }
    }

    /**
     * Mark the chit as dirty with the rollover-related fields so the next sync cycle
     * will push the updated values to the server.
     */
    private suspend fun markDirtyForRetry(chitId: String) {
        dirtyTracker.markDirty(chitId, setOf("habit_success", "status", "recurrence_exceptions"))
        Log.d(TAG, "Marked chit $chitId dirty for sync retry (rollover fields)")
    }
}
