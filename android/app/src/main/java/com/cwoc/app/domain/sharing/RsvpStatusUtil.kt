package com.cwoc.app.domain.sharing

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Pure utility for extracting RSVP status from a shares JSON string.
 *
 * Shares JSON format:
 * [{"user_id": "user123", "rsvp_status": "accepted", "permissions": "edit"}, ...]
 *
 * When rsvp_status is missing or empty, defaults to "invited" (matching server normalization).
 */
object RsvpStatusUtil {

    private const val TAG = "RsvpStatusUtil"

    /**
     * Get the current user's RSVP status from a shares JSON string.
     *
     * @param sharesJson Raw JSON array string of share entries
     * @param currentUserId The current logged-in user's ID
     * @return The RSVP status string ("invited", "accepted", "declined") or null if user not found
     */
    fun getUserRsvpStatus(sharesJson: String?, currentUserId: String): String? {
        if (sharesJson.isNullOrBlank()) return null

        return try {
            val jsonArray = JSONArray(sharesJson)
            for (i in 0 until jsonArray.length()) {
                val entry: JSONObject = jsonArray.getJSONObject(i)
                val userId = entry.optString("user_id", "")
                if (userId == currentUserId) {
                    val rsvpStatus = entry.optString("rsvp_status", "")
                    return if (rsvpStatus.isBlank()) "invited" else rsvpStatus
                }
            }
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse shares JSON: ${e.message}")
            null
        }
    }

    /**
     * Check if the current user has declined a shared chit.
     * Owners never have RSVP status — they are always shown normally.
     *
     * @param sharesJson Raw JSON array string of share entries
     * @param ownerId The chit owner's user ID
     * @param currentUserId The current logged-in user's ID
     * @return true if the current user has declined this chit
     */
    fun isDeclinedByCurrentUser(sharesJson: String?, ownerId: String?, currentUserId: String): Boolean {
        if (ownerId == currentUserId) return false
        return getUserRsvpStatus(sharesJson, currentUserId) == "declined"
    }
}
