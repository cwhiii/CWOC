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

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND (startDatetime BETWEEN :dayStart AND :dayEnd OR endDatetime BETWEEN :dayStart AND :dayEnd OR (startDatetime <= :dayStart AND endDatetime >= :dayEnd) OR dueDatetime BETWEEN :dayStart AND :dayEnd OR pointInTime BETWEEN :dayStart AND :dayEnd)")
    fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>>

    /** All recurring chits (for recurrence expansion into any date range). */
    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND recurrenceRule IS NOT NULL AND recurrenceRule != '' AND recurrenceRule != 'null'")
    fun getRecurringChits(): Flow<List<ChitEntity>>

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

    @Query("UPDATE chits SET deleted = 0, modifiedDatetime = :now WHERE id = :id")
    suspend fun restoreDeleted(id: String, now: String)

    @Query("DELETE FROM chits WHERE id = :id")
    suspend fun hardDelete(id: String)

    @Query("SELECT * FROM chits WHERE deleted = 1")
    fun getDeletedChits(): Flow<List<ChitEntity>>

    // Phase 2 — Sync version update

    @Query("UPDATE chits SET syncVersion = :version WHERE id = :id")
    suspend fun updateSyncVersion(id: String, version: Int)

    // Phase 3 — Conflict state queries

    @Query("UPDATE chits SET hasUnviewedConflict = 0, conflictFields = NULL WHERE id = :id")
    suspend fun clearConflictFlag(id: String)

    @Query("UPDATE chits SET hasUnviewedConflict = 1, conflictFields = :fields WHERE id = :id")
    suspend fun setConflictState(id: String, fields: String)

    // Phase 4 — View queries

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND checklist IS NOT NULL AND checklist != '' AND checklist != '[]'")
    fun getChecklistChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND isProjectMaster = 1")
    fun getProjectMasterChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND id IN (:ids)")
    suspend fun getChitsByIds(ids: List<String>): List<ChitEntity>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND alerts IS NOT NULL AND alerts != '' AND alerts != '[]'")
    fun getAlertChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND healthData IS NOT NULL AND healthData != '' AND healthData != '[]'")
    fun getIndicatorChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND location IS NOT NULL AND location != ''")
    fun getLocationChits(): Flow<List<ChitEntity>>

    @Query("UPDATE chits SET isDirty = 1, dirtyFields = :dirtyFields, modifiedDatetime = :now WHERE id = :id")
    suspend fun markDirty(id: String, dirtyFields: String, now: String)

    /** All non-deleted chits (for search). */
    @Query("SELECT * FROM chits WHERE deleted = 0")
    fun getAllNonDeleted(): Flow<List<ChitEntity>>

    /** All non-deleted chits as a one-shot suspend query (for autocomplete/search). */
    @Query("SELECT * FROM chits WHERE deleted = 0")
    suspend fun getAllNonDeletedSnapshot(): List<ChitEntity>

    // Phase 4 — Widget suspend queries (non-Flow for RemoteViews context)

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND (startDatetime BETWEEN :dayStart AND :dayEnd OR endDatetime BETWEEN :dayStart AND :dayEnd OR (startDatetime <= :dayStart AND endDatetime >= :dayEnd) OR dueDatetime BETWEEN :dayStart AND :dayEnd OR pointInTime BETWEEN :dayStart AND :dayEnd) ORDER BY startDatetime ASC")
    suspend fun getChitsForDaySuspend(dayStart: String, dayEnd: String): List<ChitEntity>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND status IN ('ToDo', 'In Progress') ORDER BY dueDatetime ASC LIMIT 5")
    suspend fun getUpcomingTasksSuspend(): List<ChitEntity>

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
