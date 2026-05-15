package com.cwoc.app.data.repository

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository providing Flow-based access to chit data from the local Room database.
 *
 * This is a thin wrapper over ChitDao, exposing reactive queries for the UI layer.
 * All filtering (tasks vs notes vs calendar) is handled by the DAO queries.
 */
@Singleton
class ChitRepository @Inject constructor(
    private val chitDao: ChitDao
) {

    /** All task chits (status not null, not deleted/archived), ordered by priority and due date. */
    fun getTaskChits(): Flow<List<ChitEntity>> = chitDao.getTaskChits()

    /** Task chits filtered by a specific status value. */
    fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = chitDao.getTasksByStatus(status)

    /** All note chits (has note content, no status or dates, not deleted/archived). */
    fun getNoteChits(): Flow<List<ChitEntity>> = chitDao.getNoteChits()

    /** All calendar chits (has start or end datetime, not deleted/archived). */
    fun getCalendarChits(): Flow<List<ChitEntity>> = chitDao.getCalendarChits()

    /** Calendar chits for a specific day range. */
    fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> =
        chitDao.getChitsForDay(dayStart, dayEnd)

    /** Get a single chit by ID. */
    suspend fun getById(id: String): ChitEntity? = chitDao.getById(id)

    /** Get total count of chits in the database. */
    suspend fun getCount(): Int = chitDao.getCount()
}
