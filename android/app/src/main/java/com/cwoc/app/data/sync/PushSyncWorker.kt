package com.cwoc.app.data.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.cwoc.app.data.local.dao.SyncMetadataDao
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

private const val TAG = "CWOC_PUSH_WORKER"

/**
 * WorkManager one-shot worker that flushes the dirty queue on reconnect.
 *
 * Flow:
 * 1. Push all dirty records via SyncPushEngine.pushAll()
 * 2. If push succeeds, perform an incremental pull via SyncEngine.performSync(since)
 * 3. On PushResult.Success → Result.success()
 * 4. On PushResult.NetworkError → Result.retry() (WorkManager handles exponential backoff)
 * 5. On PushResult.Partial → Result.retry() (some records failed, try again)
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
@HiltWorker
class PushSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncPushEngine: SyncPushEngine,
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "PushSyncWorker starting (attempt #$runAttemptCount)")

        // Step 1: Push all dirty records
        val pushResult = syncPushEngine.pushAll()

        return when (pushResult) {
            is PushResult.Success -> {
                Log.d(TAG, "Push succeeded (serverVersion=${pushResult.serverVersion}). Starting incremental pull.")

                // Step 2: Incremental pull to fetch any missed server changes
                val metadata = syncMetadataDao.getMetadata()
                val since = metadata?.highWaterMark ?: 0
                syncEngine.performSync(since)

                Log.d(TAG, "PushSyncWorker complete — push + pull succeeded.")
                Result.success()
            }

            is PushResult.Partial -> {
                Log.w(TAG, "Push partial: ${pushResult.successes} succeeded, ${pushResult.failures} failed. Will retry.")
                Result.retry()
            }

            is PushResult.NetworkError -> {
                Log.w(TAG, "Push network error: ${pushResult.message}. Will retry.")
                Result.retry()
            }
        }
    }

    companion object {
        const val WORK_NAME = "cwoc_push_sync"

        /**
         * Enqueue a one-time push sync job with network connectivity constraint
         * and exponential backoff (initial delay 30 seconds).
         *
         * Uses KEEP policy so that if a push job is already enqueued/running,
         * we don't duplicate it.
         */
        fun enqueueOnce(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val pushRequest = OneTimeWorkRequestBuilder<PushSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30,
                    TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.KEEP,
                pushRequest
            )

            Log.d(TAG, "PushSyncWorker enqueued as one-time work")
        }

        /**
         * Cancel any pending push sync work.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
