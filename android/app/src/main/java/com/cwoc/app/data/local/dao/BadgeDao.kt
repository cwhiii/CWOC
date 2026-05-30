package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.BadgeEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface BadgeDao {

    /** Observe all cached badges reactively. */
    @Query("SELECT * FROM badges")
    fun getAll(): Flow<List<BadgeEntity>>

    /** Observe badges filtered by status reactively. */
    @Query("SELECT * FROM badges WHERE status = :status")
    fun getByStatus(status: String): Flow<List<BadgeEntity>>

    /** Replace all cached badges with fresh data from the server. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(badges: List<BadgeEntity>)

    /** Update the status of a single badge (e.g., for dismiss). */
    @Query("UPDATE badges SET status = :status, completedAt = :completedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, completedAt: String?)

    /** Clear all cached badges (used before a full refresh). */
    @Query("DELETE FROM badges")
    suspend fun deleteAll()
}
