package com.cwoc.app.data.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.repository.SyncResult
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * WorkManager CoroutineWorker that performs periodic background sync.
 * Runs every 5 minutes with a network connectivity constraint.
 * On 401 response, returns Result.failure() to trigger token revocation flow.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val metadata = syncMetadataDao.getMetadata()
        val since = metadata?.highWaterMark ?: 0

        return when (val result = syncEngine.performSync(since)) {
            is SyncResult.Success -> Result.success()
            is SyncResult.Error -> {
                if (result.code == 401) {
                    // 401 triggers token revocation flow via failure
                    Result.failure()
                } else {
                    Result.retry()
                }
            }
            is SyncResult.NetworkError -> Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "cwoc_periodic_sync"

        /**
         * Enqueue periodic sync work with WorkManager.
         * Runs every 5 minutes with network connectivity required.
         */
        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                5, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
        }

        /**
         * Cancel periodic sync work.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
