package com.cwoc.app.data.sync

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.notification.NotificationScheduler
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant
import javax.inject.Inject

/**
 * Handles sync edge cases that require special resolution logic:
 * - Delete-vs-edit: server deletion wins over local edits
 * - Tag rename: propagate server-originated tag renames to all local chits
 * - Checklist LWW: replace local checklist with server version (last-writer-wins)
 */
interface EdgeCaseHandler {
    /**
     * Handles a server-side deletion that conflicts with local edits.
     * Delete wins: marks the chit as deleted, clears dirty state, logs the lost edit,
     * and cancels any scheduled alarms.
     *
     * @param chitId The ID of the chit that was deleted on the server
     */
    suspend fun handleServerDeletion(chitId: String)

    /**
     * Applies a server-originated tag rename to all local chits containing the old tag.
     * Does NOT mark affected chits as dirty since this is a server-originated change.
     *
     * @param oldTag The tag name being replaced
     * @param newTag The new tag name
     */
    suspend fun applyTagRename(oldTag: String, newTag: String)

    /**
     * Replaces the local checklist field with the server's version (LWW).
     * Does NOT mark the chit as dirty since the server version wins.
     *
     * @param chitId The ID of the chit whose checklist is being replaced
     * @param serverChecklist The server's checklist JSON string
     */
    suspend fun applyChecklistMerge(chitId: String, serverChecklist: String)
}

/**
 * Implementation of [EdgeCaseHandler] using Room DAOs, DirtyTracker,
 * LostEditLogger, and NotificationScheduler.
 */
class EdgeCaseHandlerImpl @Inject constructor(
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val lostEditLogger: LostEditLogger,
    private val notificationScheduler: NotificationScheduler
) : EdgeCaseHandler {

    private val gson = Gson()

    /**
     * Delete wins over local edits:
     * 1. Get the chit from Room
     * 2. If the chit was dirty (had local edits), log the lost edit
     * 3. Mark the chit as deleted in Room
     * 4. Clear dirty state
     * 5. Cancel any scheduled alarms
     */
    override suspend fun handleServerDeletion(chitId: String) {
        val chit = chitDao.getById(chitId)

        // If the chit had local edits, log the lost edit for user awareness
        if (chit != null && chit.isDirty) {
            val dirtyFields = parseDirtyFields(chit.dirtyFields)
            lostEditLogger.logLostEdit(
                chitId = chitId,
                title = chit.title,
                dirtyFields = dirtyFields
            )
        }

        // Mark as deleted in Room
        val now = Instant.now().toString()
        chitDao.markDeleted(chitId, now)

        // Clear dirty state — deletion takes precedence
        dirtyTracker.clearDirty(chitId)

        // Cancel any scheduled alarms for this chit
        notificationScheduler.cancelAlarms(chitId)
    }

    /**
     * Propagates a server-originated tag rename to all local chits:
     * 1. Get all chits that have oldTag in their tags list
     * 2. For each, replace oldTag with newTag in the tags list
     * 3. Upsert the updated entity WITHOUT marking it dirty
     */
    override suspend fun applyTagRename(oldTag: String, newTag: String) {
        val affectedChits = chitDao.getChitsWithTag(oldTag)

        affectedChits.forEach { chit ->
            val currentTags = chit.tags ?: return@forEach
            val updatedTags = currentTags.map { tag ->
                if (tag == oldTag) newTag else tag
            }
            // Upsert without dirtying — this is a server-originated change
            val updatedChit = chit.copy(tags = updatedTags)
            chitDao.upsertWithoutDirty(updatedChit)
        }
    }

    /**
     * Replaces the local checklist with the server version (LWW):
     * 1. Get the chit from Room
     * 2. Replace the checklist field with serverChecklist
     * 3. Upsert without marking dirty (server version wins)
     */
    override suspend fun applyChecklistMerge(chitId: String, serverChecklist: String) {
        val chit = chitDao.getById(chitId) ?: return

        val updatedChit = chit.copy(checklist = serverChecklist)
        // Upsert without dirtying — server version wins (LWW)
        chitDao.upsertWithoutDirty(updatedChit)
    }

    /**
     * Parses the dirty fields JSON array string into a List of field names.
     */
    private fun parseDirtyFields(json: String?): List<String> {
        if (json.isNullOrBlank() || json == "[]") return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) {
            emptyList()
        }
    }
}
