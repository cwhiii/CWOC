package com.cwoc.app.domain.tags

import com.cwoc.app.data.local.dao.SettingsDao
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resolved tag information for display purposes.
 */
data class ResolvedTag(
    val id: String?,
    val name: String,
    val color: String?,
    val fontColor: String?,
    val favorite: Boolean = false
)

/**
 * Local tag resolution utility.
 *
 * Resolves Tag_IDs (UUIDs) to display names, colors, and font colors using
 * the local tag registry cache (from settings.tags).
 *
 * For system tags (CWOC_System/, Habits/ prefixes): displays the name string directly.
 * For user tags (UUIDs): resolves through the registry.
 * For unknown IDs: returns a fallback "[unknown tag]".
 *
 * The registry is loaded lazily from SettingsDao and cached in memory.
 * Call invalidateCache() when settings are updated to force a reload.
 */
@Singleton
class TagResolver @Inject constructor(
    private val settingsDao: SettingsDao,
    private val gson: Gson
) {
    companion object {
        private val UUID_REGEX = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
        private const val UNKNOWN_TAG_FALLBACK = "[unknown tag]"
    }

    // Cache: tag ID → ResolvedTag
    private var idToTagMap: Map<String, ResolvedTag> = emptyMap()
    // Cache: tag name (lowercase) → ResolvedTag
    private var nameToTagMap: Map<String, ResolvedTag> = emptyMap()
    private var cacheLoaded = false
    private val mutex = Mutex()

    /**
     * Returns true if the given string is a UUID (user tag ID).
     * System tags are identified by NOT being UUIDs.
     */
    fun isTagId(value: String): Boolean {
        return UUID_REGEX.matches(value)
    }

    /**
     * Returns true if the given string is a system tag (CWOC_System/ or Habits/ prefix).
     */
    fun isSystemTag(value: String): Boolean {
        return value.startsWith("CWOC_System/", ignoreCase = true) ||
            value.startsWith("Habits/", ignoreCase = true)
    }

    /**
     * Resolves a single tag value (UUID or system tag name) to display information.
     *
     * @param tagValue A UUID string (user tag) or a system tag name string
     * @return ResolvedTag with display name, color, and fontColor
     */
    suspend fun resolve(tagValue: String): ResolvedTag {
        ensureCacheLoaded()

        // System tags: display the name directly (strip prefix for display)
        if (isSystemTag(tagValue)) {
            return ResolvedTag(
                id = null,
                name = tagValue,
                color = null,
                fontColor = null
            )
        }

        // UUID: look up in registry
        if (isTagId(tagValue)) {
            val resolved = idToTagMap[tagValue]
            if (resolved != null) return resolved

            // Unknown ID — return fallback
            return ResolvedTag(
                id = tagValue,
                name = UNKNOWN_TAG_FALLBACK,
                color = null,
                fontColor = null
            )
        }

        // Legacy name string (pre-migration) — try to resolve by name
        val byName = nameToTagMap[tagValue.lowercase()]
        if (byName != null) return byName

        // Unresolvable — return the raw value as the display name
        return ResolvedTag(
            id = null,
            name = tagValue,
            color = null,
            fontColor = null
        )
    }

    /**
     * Resolves a list of tag values to display information.
     * Filters out system tags from the result (they're auto-computed, not user-facing).
     *
     * @param tagValues List of UUID strings and/or system tag name strings
     * @param includeSystemTags Whether to include system tags in the result (default: false)
     * @return List of ResolvedTag objects for display
     */
    suspend fun resolveAll(tagValues: List<String>, includeSystemTags: Boolean = false): List<ResolvedTag> {
        ensureCacheLoaded()
        return tagValues.mapNotNull { tagValue ->
            if (!includeSystemTags && isSystemTag(tagValue)) return@mapNotNull null
            resolve(tagValue)
        }
    }

    /**
     * Resolves a tag ID to just the display name.
     * Convenience method for simple name lookups.
     */
    suspend fun resolveToName(tagValue: String): String {
        return resolve(tagValue).name
    }

    /**
     * Gets the tag ID for a given tag name (case-insensitive lookup).
     * Returns null if the tag is not found in the registry.
     */
    suspend fun getIdByName(name: String): String? {
        ensureCacheLoaded()
        return nameToTagMap[name.lowercase()]?.id
    }

    /**
     * Gets the full tag registry as a list of ResolvedTag objects.
     * Useful for building tag pickers and tree views.
     */
    suspend fun getRegistry(): List<ResolvedTag> {
        ensureCacheLoaded()
        return idToTagMap.values.toList()
    }

    /**
     * Invalidates the in-memory cache, forcing a reload on next access.
     * Call this when settings are updated (e.g., after sync or tag creation).
     */
    fun invalidateCache() {
        cacheLoaded = false
        idToTagMap = emptyMap()
        nameToTagMap = emptyMap()
    }

    /**
     * Ensures the tag registry cache is loaded from the local database.
     * Thread-safe via mutex.
     */
    private suspend fun ensureCacheLoaded() {
        if (cacheLoaded) return
        mutex.withLock {
            if (cacheLoaded) return
            loadCache()
        }
    }

    /**
     * Loads the tag registry from SettingsEntity.tags JSON into the in-memory maps.
     */
    private suspend fun loadCache() {
        val settings = settingsDao.get()
        val tagsJson = settings?.tags

        if (tagsJson.isNullOrBlank() || tagsJson == "[]" || tagsJson == "null") {
            idToTagMap = emptyMap()
            nameToTagMap = emptyMap()
            cacheLoaded = true
            return
        }

        try {
            val rawTags: List<Map<String, Any?>> = gson.fromJson(
                tagsJson,
                object : TypeToken<List<Map<String, Any?>>>() {}.type
            ) ?: emptyList()

            val idMap = mutableMapOf<String, ResolvedTag>()
            val nameMap = mutableMapOf<String, ResolvedTag>()

            rawTags.forEach { tagMap ->
                val name = tagMap["name"] as? String ?: return@forEach
                val id = tagMap["id"] as? String
                val color = tagMap["color"] as? String
                val fontColor = tagMap["fontColor"] as? String
                val favorite = when (val fav = tagMap["favorite"]) {
                    is Boolean -> fav
                    is Number -> fav.toInt() != 0
                    else -> false
                }

                val resolved = ResolvedTag(
                    id = id,
                    name = name,
                    color = color,
                    fontColor = fontColor,
                    favorite = favorite
                )

                if (id != null) {
                    idMap[id] = resolved
                }
                nameMap[name.lowercase()] = resolved
            }

            idToTagMap = idMap
            nameToTagMap = nameMap
        } catch (_: Exception) {
            idToTagMap = emptyMap()
            nameToTagMap = emptyMap()
        }

        cacheLoaded = true
    }
}
