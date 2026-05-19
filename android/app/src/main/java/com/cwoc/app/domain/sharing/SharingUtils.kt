package com.cwoc.app.domain.sharing

import com.cwoc.app.data.local.entity.ChitEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Client-side sharing role resolution.
 * Mirrors the server's resolve_effective_role() logic for the subset of data
 * available on the mobile client (chit-level shares + assignment).
 *
 * Note: Tag-level shares require the owner's shared_tags setting which is not
 * available client-side. This implementation covers chit-level shares and assignment.
 */
object SharingUtils {

    /**
     * Determine the effective role for the current user on a chit.
     * Returns: "owner", "manager", "viewer", or null (no sharing relationship / own chit).
     *
     * @param chit The chit entity to check
     * @param currentUserId The current logged-in user's ID
     */
    fun resolveEffectiveRole(chit: ChitEntity, currentUserId: String): String? {
        if (currentUserId.isBlank()) return null

        // 1. Owner check
        if (chit.ownerId == currentUserId) return "owner"

        // 2. Stealth override — stealth chits are invisible to non-owners
        if (chit.stealth == true) return null

        var bestRole: String? = null

        // 3. Chit-level shares
        val shares = parseShares(chit.shares)
        for (entry in shares) {
            if (entry.userId == currentUserId) {
                val role = entry.role
                if (role == "manager" || role == "viewer") {
                    bestRole = higherRole(bestRole, role)
                }
            }
        }

        // 4. Assignment — assigned users get manager role
        if (chit.assignedTo == currentUserId) {
            bestRole = higherRole(bestRole, "manager")
        }

        return bestRole
    }

    /**
     * Returns true if the current user has viewer-only access to this chit.
     * This means they can see it but cannot edit it (status dropdown should be disabled, etc.)
     */
    fun isViewerRole(chit: ChitEntity, currentUserId: String): Boolean {
        val role = resolveEffectiveRole(chit, currentUserId)
        return role == "viewer"
    }

    /**
     * Returns true if the current user can edit this chit (owner or manager).
     */
    fun canEdit(chit: ChitEntity, currentUserId: String): Boolean {
        val role = resolveEffectiveRole(chit, currentUserId)
        return role == "owner" || role == "manager" || role == null
        // null means no sharing relationship — the chit is owned by the user
        // (or there's no sharing data, which means full access)
    }

    private fun higherRole(current: String?, candidate: String): String {
        if (current == null) return candidate
        val rank = mapOf("viewer" to 1, "manager" to 2, "owner" to 3)
        return if ((rank[candidate] ?: 0) > (rank[current] ?: 0)) candidate else current
    }

    private data class ShareEntry(val userId: String?, val role: String?)

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
                    role = entry["role"]?.toString()
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
}
