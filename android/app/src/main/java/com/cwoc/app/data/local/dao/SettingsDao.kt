package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.SettingsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SettingsDao {

    @Query("SELECT * FROM settings LIMIT 1")
    suspend fun get(): SettingsEntity?

    @Query("SELECT * FROM settings LIMIT 1")
    fun getSettings(): Flow<SettingsEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun update(settings: SettingsEntity)

    @Query("UPDATE settings SET isDirty = 0 WHERE userId = (SELECT userId FROM settings LIMIT 1)")
    suspend fun clearDirty()

    @Query("UPDATE settings SET isDirty = 1 WHERE userId = (SELECT userId FROM settings LIMIT 1)")
    suspend fun markDirty()

    @Query("UPDATE settings SET syncVersion = :version WHERE userId = (SELECT userId FROM settings LIMIT 1)")
    suspend fun updateSyncVersion(version: Int)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun replace(settings: SettingsEntity)

    // Legacy alias for backward compatibility
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(settings: SettingsEntity)

    @Query("SELECT * FROM settings LIMIT 1")
    suspend fun getSettingsOnce(): SettingsEntity?
}
