package com.cwoc.app.data.sync

import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import javax.inject.Inject

/**
 * Data class representing a single lost edit event.
 * Recorded when a server-side deletion overwrites a locally dirty chit.
 */
data class LostEditEntry(
    val chitId: String,
    val title: String?,
    val dirtyFields: List<String>,
    val timestamp: String
)

/**
 * Logs lost edits for user awareness when delete-vs-edit conflicts
 * are resolved in favor of the server deletion.
 *
 * Entries are stored as a JSON array in SharedPreferences, capped at 50
 * (FIFO — oldest entries dropped when over the limit).
 *
 * These entries will be visible in a future audit log view within the app.
 */
class LostEditLogger @Inject constructor(
    private val sharedPreferences: SharedPreferences
) {
    private val gson = Gson()

    companion object {
        private const val KEY_ENTRIES = "lost_edit_entries"
        private const val MAX_ENTRIES = 50
    }

    /**
     * Records a lost edit event. If the log exceeds [MAX_ENTRIES],
     * the oldest entries are dropped (FIFO).
     */
    fun logLostEdit(chitId: String, title: String?, dirtyFields: List<String>) {
        val entry = LostEditEntry(
            chitId = chitId,
            title = title,
            dirtyFields = dirtyFields,
            timestamp = java.time.Instant.now().toString()
        )
        val existing = getEntries().toMutableList()
        existing.add(entry)
        // Keep only the last MAX_ENTRIES (FIFO — oldest dropped)
        val trimmed = if (existing.size > MAX_ENTRIES) {
            existing.takeLast(MAX_ENTRIES)
        } else {
            existing
        }
        sharedPreferences.edit()
            .putString(KEY_ENTRIES, gson.toJson(trimmed))
            .apply()
    }

    /**
     * Returns all stored lost edit entries, ordered oldest to newest.
     */
    fun getEntries(): List<LostEditEntry> {
        val json = sharedPreferences.getString(KEY_ENTRIES, null)
            ?: return emptyList()
        return try {
            val type = object : TypeToken<List<LostEditEntry>>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Clears all stored lost edit entries.
     */
    fun clear() {
        sharedPreferences.edit()
            .remove(KEY_ENTRIES)
            .apply()
    }
}
