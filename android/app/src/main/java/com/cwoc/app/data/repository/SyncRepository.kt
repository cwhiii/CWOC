package com.cwoc.app.data.repository

import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.SyncMetadataEntity
import com.cwoc.app.data.sync.SyncEngine
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Sealed class representing the result of a sync operation.
 */
sealed class SyncResult {
    data class Success(val serverVersion: Int) : SyncResult()
    data class Error(val code: Int, val message: String) : SyncResult()
    data class NetworkError(val message: String) : SyncResult()
}

/**
 * Repository managing sync operations and high-water mark state.
 * Delegates actual sync work to SyncEngine.
 */
@Singleton
class SyncRepository @Inject constructor(
    private val syncMetadataDao: SyncMetadataDao,
    private val syncEngine: SyncEngine
) {

    /**
     * Get the current high-water mark (last successful server_version).
     * Returns 0 if no sync has been performed yet.
     */
    suspend fun getHighWaterMark(): Int {
        val metadata = syncMetadataDao.getMetadata()
        return metadata?.highWaterMark ?: 0
    }

    /**
     * Get the full sync metadata record.
     */
    suspend fun getSyncMetadata(): SyncMetadataEntity? {
        return syncMetadataDao.getMetadata()
    }

    /**
     * Perform an initial full sync (since=0).
     */
    suspend fun performInitialSync(): SyncResult {
        return syncEngine.performSync(since = 0)
    }

    /**
     * Perform an incremental sync using the stored high-water mark.
     */
    suspend fun performIncrementalSync(): SyncResult {
        val hwm = getHighWaterMark()
        return syncEngine.performSync(since = hwm)
    }
}
