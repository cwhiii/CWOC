package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.SyncMetadataEntity

@Dao
interface SyncMetadataDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(metadata: SyncMetadataEntity)

    @Query("SELECT * FROM sync_metadata WHERE id = 1")
    suspend fun getMetadata(): SyncMetadataEntity?

    @Query("UPDATE sync_metadata SET highWaterMark = :version, lastSyncTimestamp = :timestamp WHERE id = 1")
    suspend fun updateHighWaterMark(version: Int, timestamp: String)

    @Query("UPDATE sync_metadata SET syncStatus = :status WHERE id = 1")
    suspend fun updateSyncStatus(status: String)
}
