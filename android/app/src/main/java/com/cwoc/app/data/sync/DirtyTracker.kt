package com.cwoc.app.data.sync

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import javax.inject.Inject

/**
 * Interface for managing dirty state on ChitEntity records.
 * Dirty tracking enables offline-first CRUD by marking locally modified records
 * for later push to the server.
 */
interface DirtyTracker {
    /**
     * Marks a chit as dirty and unions the given changed fields with any
     * existing dirty fields (set-union semantics, no duplicates).
     */
    suspend fun markDirty(chitId: String, changedFields: Set<String>)

    /**
     * Clears the dirty state on a chit (sets isDirty=false, dirtyFields="[]").
     * Used after a successful push with status "accepted" or "created".
     */
    suspend fun clearDirty(chitId: String)

    /**
     * Clears the dirty state AND replaces the local entity with the server-merged version.
     * Used after a successful push with status "merged".
     */
    suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity)
}

/**
 * Implementation of [DirtyTracker] backed by Room via [ChitDao].
 * Injected via Hilt with ChitDao as a constructor parameter.
 */
class DirtyTrackerImpl @Inject constructor(
    private val chitDao: ChitDao
) : DirtyTracker {

    private val gson = Gson()

    override suspend fun markDirty(chitId: String, changedFields: Set<String>) {
        val entity = chitDao.getById(chitId) ?: return
        val existingFields = parseDirtyFields(entity.dirtyFields)
        val mergedFields = existingFields + changedFields // Set union — no duplicates
        chitDao.updateDirtyState(
            id = chitId,
            isDirty = true,
            dirtyFields = serializeDirtyFields(mergedFields)
        )
    }

    override suspend fun clearDirty(chitId: String) {
        chitDao.updateDirtyState(
            id = chitId,
            isDirty = false,
            dirtyFields = "[]"
        )
    }

    override suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity) {
        // Replace local entity with server-merged version, clear dirty state
        val cleanEntity = mergedEntity.copy(isDirty = false, dirtyFields = "[]")
        chitDao.upsert(cleanEntity)
    }

    /**
     * Parses the JSON array string into a Set of field names.
     * Returns an empty set for null, blank, or empty array inputs.
     */
    private fun parseDirtyFields(json: String?): Set<String> {
        if (json.isNullOrBlank() || json == "[]") return emptySet()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson<List<String>>(json, type).toSet()
    }

    /**
     * Serializes a Set of field names into a JSON array string.
     */
    private fun serializeDirtyFields(fields: Set<String>): String {
        return gson.toJson(fields.toList())
    }
}
