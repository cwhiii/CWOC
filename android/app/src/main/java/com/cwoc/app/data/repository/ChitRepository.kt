package com.cwoc.app.data.repository

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.Lazy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import java.time.Instant
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
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: Lazy<SyncPushEngine>,
    private val connectivityMonitor: ConnectivityMonitor
) {

    private val pushScope = CoroutineScope(Dispatchers.IO)

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

    /** All deleted chits (for trash screen). */
    fun getDeletedChits(): Flow<List<ChitEntity>> = chitDao.getDeletedChits()

    /** Get a single chit by ID. */
    suspend fun getById(id: String): ChitEntity? = chitDao.getById(id)

    /** Get total count of chits in the database. */
    suspend fun getCount(): Int = chitDao.getCount()

    // Phase 4 — New view queries

    /** All chits with checklist data (not deleted/archived). */
    fun getChecklistChits(): Flow<List<ChitEntity>> = chitDao.getChecklistChits()

    /** All project master chits (not deleted/archived). */
    fun getProjectMasterChits(): Flow<List<ChitEntity>> = chitDao.getProjectMasterChits()

    /** Get multiple chits by their IDs. */
    suspend fun getChitsByIds(ids: List<String>): List<ChitEntity> = chitDao.getChitsByIds(ids)

    /** All chits with alert data (not deleted/archived). */
    fun getAlertChits(): Flow<List<ChitEntity>> = chitDao.getAlertChits()

    /** All chits with health/indicator data (not deleted/archived). */
    fun getIndicatorChits(): Flow<List<ChitEntity>> = chitDao.getIndicatorChits()

    /** All chits with location data (not deleted/archived). */
    fun getLocationChits(): Flow<List<ChitEntity>> = chitDao.getLocationChits()

    /** All non-deleted chits (for search). */
    fun getAllNonDeleted(): Flow<List<ChitEntity>> = chitDao.getAllNonDeleted()

    /** Mark a chit as dirty with specific fields. */
    suspend fun markDirty(id: String, field: String) {
        dirtyTracker.markDirty(id, setOf(field))
    }

    // --- Pin/Archive/Snooze convenience methods ---

    /** Pin a chit. Updates pinned=true, marks dirty, triggers sync push if online. */
    suspend fun pin(chitId: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(pinned = true, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("pinned"))
        triggerPushIfOnline(chitId)
    }

    /** Unpin a chit. Updates pinned=false, marks dirty, triggers sync push if online. */
    suspend fun unpin(chitId: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(pinned = false, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("pinned"))
        triggerPushIfOnline(chitId)
    }

    /** Archive a chit. Updates archived=true, marks dirty, triggers sync push if online. */
    suspend fun archive(chitId: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(archived = true, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("archived"))
        triggerPushIfOnline(chitId)
    }

    /** Unarchive a chit. Updates archived=false, marks dirty, triggers sync push if online. */
    suspend fun unarchive(chitId: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(archived = false, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("archived"))
        triggerPushIfOnline(chitId)
    }

    /** Snooze a chit until the given ISO datetime string. Marks dirty, triggers sync push if online. */
    suspend fun snooze(chitId: String, until: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(snoozedUntil = until, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("snoozedUntil"))
        triggerPushIfOnline(chitId)
    }

    /** Unsnooze a chit. Clears snoozedUntil, marks dirty, triggers sync push if online. */
    suspend fun unsnooze(chitId: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(snoozedUntil = null, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("snoozedUntil"))
        triggerPushIfOnline(chitId)
    }

    /** Update a chit's title and note content. Marks dirty, triggers sync push if online. */
    suspend fun updateTitleAndNote(chitId: String, title: String, note: String) {
        val entity = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()
        chitDao.upsert(entity.copy(title = title, note = note, modifiedDatetime = now))
        dirtyTracker.markDirty(chitId, setOf("title", "note"))
        triggerPushIfOnline(chitId)
    }

    /**
     * Triggers an immediate push if the device is currently online.
     * Launches in a separate coroutine scope so the caller doesn't block on the push.
     */
    private fun triggerPushIfOnline(chitId: String) {
        if (connectivityMonitor.isOnline.value) {
            pushScope.launch {
                syncPushEngine.get().pushSingle(chitId)
            }
        }
    }
}
