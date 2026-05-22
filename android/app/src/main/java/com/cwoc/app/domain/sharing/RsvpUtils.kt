package com.cwoc.app.domain.sharing

import com.cwoc.app.data.local.entity.ChitEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * RSVP status utilities for shared chits.
 * Parses the chit's shares JSON field to determine the current user's RSVP status.
 *
 * Shares JSON format: [{"user_id": "...", "role": "...", "rsvp_status": "invited|accepted|declined"}, ...]
 * When rsvp_status is missing, defaults to "invited" (matching server normalization).
 */
object RsvpUtils {

    /**
     * Get the current user's RSVP status from a chit's shares array.
     *
     * @param chit The chit entity to check
     * @param currentUserId The current logged-in user's ID
     * @return The RSVP status string ("invited", "accepted", "declined") or null if user not in shares
     */
    fun getUserRsvpStatus(chit: ChitEntity, currentUserId: String): String? {
        if (currentUserId.isBlank()) return null
        if (chit.shares.isNullOrBlank() || chit.shares == "[]" || chit.shares == "null") return null

        val shares = parseShares(chit.shares)
        val userEntry = shares.find { it.userId == currentUserId }
        return userEntry?.rsvpStatus ?: if (userEntry != null) "invited" else null
    }

    /**
     * Check if the current user has declined a shared chit.
     * Owners never have RSVP status — they are always shown normally.
     *
     * @param chit The chit entity to check
     * @param currentUserId The current logged-in user's ID
     * @return true if the current user has declined this chit
     */
    fun isDeclinedByCurrentUser(chit: ChitEntity, currentUserId: String): Boolean {
        if (currentUserId.isBlank()) return false
        // Owners don't have RSVP status
        if (chit.ownerId == currentUserId) return false
        return getUserRsvpStatus(chit, currentUserId) == "declined"
    }

    // ── Internal parsing ────────────────────────────────────────────────────────

    private data class ShareEntry(val userId: String?, val rsvpStatus: String?)

    private fun parseShares(sharesJson: String?): List<ShareEntry> {
        if (sharesJson.isNullOrBlank() || sharesJson == "[]" || sharesJson == "null") {
            return emptyList()
        }
        return try {
            val gson = Gson()
            val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
            val list: List<Map<String, Any?>> = gson.fromJson(sharesJson, type)
            list.map { entry ->
                ShareEntry(
                    userId = entry["user_id"]?.toString(),
                    rsvpStatus = entry["rsvp_status"]?.toString()
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
}
