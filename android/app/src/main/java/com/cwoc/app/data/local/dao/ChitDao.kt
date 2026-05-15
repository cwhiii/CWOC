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
}
