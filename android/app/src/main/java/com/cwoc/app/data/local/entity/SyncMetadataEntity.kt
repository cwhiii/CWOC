package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_metadata")
data class SyncMetadataEntity(
    @PrimaryKey val id: Int = 1,
    val highWaterMark: Int = 0,
    val lastSyncTimestamp: String? = null,
    val syncStatus: String = "idle"
)
