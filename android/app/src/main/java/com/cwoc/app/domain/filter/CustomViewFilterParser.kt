package com.cwoc.app.domain.filter

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.google.gson.reflect.TypeToken

/**
 * Pure utility object that parses the `custom_view_filters` JSON setting
 * into a map of tab name → FilterState.
 *
 * The JSON format (from the web app) is:
 * {
 *   "Calendar": { "statuses": [], "tags": [], "priorities": [], "people": [], "text": "",
 *                  "display": { "pinned": true, "archived": false, ... },
 *                  "sort": { "field": "", "dir": "asc" }, "project": "" },
 *   "Tasks": { ... },
 *   ...
 * }
 *
 * Tab names in JSON are capitalized (e.g., "Calendar", "Tasks", "Notes").
 * Tab routes in the Android app are lowercase (e.g., "calendar", "tasks", "notes").
 * This parser stores the map keyed by lowercase route for easy lookup.
 */
object CustomViewFilterParser {

    private const val TAG = "CustomViewFilterParser"
    private val gson = Gson()

    /**
     * Parses the `custom_view_filters` JSON string into a map keyed by tab route (lowercase).
     * Returns an empty map on null, blank, or malformed input.
     *
     * Invalid filter references (deleted tags, removed contacts) are preserved in the
     * parsed FilterState — validation against live data happens at apply time.
     */
    fun parse(json: String?): Map<String, FilterState> {
        if (json.isNullOrBlank()) return emptyMap()

        return try {
            val type = object : TypeToken<Map<String, RawTabFilter>>() {}.type
            val rawMap: Map<String, RawTabFilter>? = gson.fromJson(json, type)
            if (rawMap == null) return emptyMap()

            rawMap.mapKeys { (key, _) -> key.lowercase() }
                .mapValues { (_, raw) -> raw.toFilterState() }
                .filterValues { it != null }
                .mapValues { (_, v) -> v!! }
        } catch (e: JsonSyntaxException) {
            Log.e(TAG, "Failed to parse custom_view_filters JSON", e)
            emptyMap()
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error parsing custom_view_filters", e)
            emptyMap()
        }
    }

    /**
     * Convenience method: parses the JSON and returns the FilterState for a specific tab,
     * or null if the tab has no custom filters defined.
     *
     * @param json The raw custom_view_filters JSON string from settings
     * @param tabName The tab route (lowercase, e.g., "calendar", "tasks", "omni")
     */
    fun parseTabFilters(json: String?, tabName: String): FilterState? {
        return parse(json)[tabName.lowercase()]
    }

    /**
     * Maps a tab route (lowercase) to the capitalized key used in the JSON.
     * Used internally for lookups when the JSON uses capitalized keys.
     */
    private fun routeToJsonKey(route: String): String {
        return when (route) {
            "calendar" -> "Calendar"
            "tasks" -> "Tasks"
            "notes" -> "Notes"
            "checklists" -> "Checklists"
            "alarms" -> "Alarms"
            "projects" -> "Projects"
            "omni" -> "Omni"
            "email" -> "Email"
            "indicators" -> "Indicators"
            "notebook" -> "Notebook"
            else -> route.replaceFirstChar { it.uppercase() }
        }
    }
}

/**
 * Internal raw representation of a tab's filter config as stored in JSON.
 * Matches the web app's structure for deserialization.
 */
private data class RawTabFilter(
    val statuses: List<String>? = null,
    val tags: List<String>? = null,
    val priorities: List<String>? = null,
    val people: List<String>? = null,
    val text: String? = null,
    val display: RawDisplayToggles? = null,
    val sort: RawSort? = null,
    val project: String? = null
) {
    /**
     * Converts this raw JSON representation to a FilterState.
     * Skips null/empty collections gracefully.
     */
    fun toFilterState(): FilterState? {
        // If everything is empty/default, return null (no custom filter for this tab)
        val hasAnyFilter = !statuses.isNullOrEmpty() ||
            !tags.isNullOrEmpty() ||
            !priorities.isNullOrEmpty() ||
            !people.isNullOrEmpty() ||
            !text.isNullOrBlank() ||
            display != null ||
            sort != null ||
            !project.isNullOrBlank()

        if (!hasAnyFilter) return null

        return FilterState(
            statuses = statuses?.toSet() ?: emptySet(),
            tags = tags?.toSet() ?: emptySet(),
            priorities = priorities?.toSet() ?: emptySet(),
            people = people?.toSet() ?: emptySet(),
            searchText = text ?: "",
            showPinned = display?.pinned ?: true,
            showArchived = display?.archived ?: false,
            showSnoozed = display?.snoozed ?: false,
            showUnmarked = display?.unmarked ?: true,
            showPastDue = display?.pastDue ?: true,
            showComplete = display?.complete ?: true,
            showDeclined = display?.declined ?: true,
            showHabits = display?.habits ?: true,
            showEmailReceived = display?.emailReceived ?: false,
            showEmailSent = display?.emailSent ?: false,
            sharedWithMe = display?.sharedWithMe ?: false,
            sharedByMe = display?.sharedByMe ?: false,
            projectFilter = if (project.isNullOrBlank()) null else project
        )
    }
}

/**
 * Raw display toggle values from the JSON.
 */
private data class RawDisplayToggles(
    val pinned: Boolean? = null,
    val archived: Boolean? = null,
    val snoozed: Boolean? = null,
    val unmarked: Boolean? = null,
    val pastDue: Boolean? = null,
    val complete: Boolean? = null,
    val declined: Boolean? = null,
    val habits: Boolean? = null,
    val emailReceived: Boolean? = null,
    val emailSent: Boolean? = null,
    val sharedWithMe: Boolean? = null,
    val sharedByMe: Boolean? = null
)

/**
 * Raw sort preference from the JSON.
 */
private data class RawSort(
    val field: String? = null,
    val dir: String? = null
)
