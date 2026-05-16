package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.ChitEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ChitDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(chits: List<ChitEntity>)

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND status IS NOT NULL ORDER BY priority DESC, dueDatetime ASC")
    fun getTaskChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND status IS NOT NULL AND status = :status")
    fun getTasksByStatus(status: String): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND note IS NOT NULL AND note != '' AND status IS NULL AND startDatetime IS NULL AND endDatetime IS NULL")
    fun getNoteChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND (startDatetime IS NOT NULL OR endDatetime IS NOT NULL)")
    fun getCalendarChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND (startDatetime BETWEEN :dayStart AND :dayEnd OR endDatetime BETWEEN :dayStart AND :dayEnd OR (startDatetime <= :dayStart AND endDatetime >= :dayEnd))")
    fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE id = :id")
    suspend fun getById(id: String): ChitEntity?

    @Query("SELECT COUNT(*) FROM chits")
    suspend fun getCount(): Int

    @Query("SELECT * FROM chits LIMIT 5")
    suspend fun getFirstFive(): List<ChitEntity>

    // Phase 2 — Dirty tracking queries

    @Query("SELECT * FROM chits WHERE isDirty = 1")
    suspend fun getDirtyChits(): List<ChitEntity>

    @Query("SELECT COUNT(*) FROM chits WHERE isDirty = 1")
    suspend fun getDirtyCount(): Int

    @Query("UPDATE chits SET isDirty = :isDirty, dirtyFields = :dirtyFields WHERE id = :id")
    suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String)

    // Phase 2 — CRUD queries

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(chit: ChitEntity)

    @Query("UPDATE chits SET deleted = 1, modifiedDatetime = :now WHERE id = :id")
    suspend fun markDeleted(id: String, now: String)

    // Phase 2 — Sync version update

    @Query("UPDATE chits SET syncVersion = :version WHERE id = :id")
    suspend fun updateSyncVersion(id: String, version: Int)

    // Phase 3 — Conflict state queries

    @Query("UPDATE chits SET hasUnviewedConflict = 0, conflictFields = NULL WHERE id = :id")
    suspend fun clearConflictFlag(id: String)

    @Query("UPDATE chits SET hasUnviewedConflict = 1, conflictFields = :fields WHERE id = :id")
    suspend fun setConflictState(id: String, fields: String)

    // Phase 3 — Notification scheduling queries

    @Query("SELECT * FROM chits WHERE deleted = 0 AND alerts IS NOT NULL AND alerts != ''")
    suspend fun getChitsWithAlerts(): List<ChitEntity>

    // Phase 3 — Edge case handling queries

    /**
     * Finds all non-deleted chits whose tags JSON contains the given tag string.
     * Uses LIKE with the tag wrapped in quotes to match JSON array elements.
     */
    @Query("SELECT * FROM chits WHERE deleted = 0 AND tags LIKE '%' || '\"' || :tag || '\"' || '%'")
    suspend fun getChitsWithTag(tag: String): List<ChitEntity>

    /**
     * Upserts a chit without triggering dirty tracking.
     * Used for server-originated changes (tag renames, checklist LWW).
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertWithoutDirty(chit: ChitEntity)
}
