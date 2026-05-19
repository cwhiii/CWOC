package com.cwoc.app.domain.email

import com.cwoc.app.data.local.entity.ContactEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Pure function: searches contacts by name and email address for autocomplete
 * in email recipient fields (To, CC, BCC).
 *
 * Behavior:
 * - Case-insensitive matching against display name, given name, surname, and email addresses
 * - Favorites sort to the top of results
 * - Contacts whose email is already in existingChips are excluded
 * - Returns at most maxResults (default 5) matching contacts
 *
 * Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6
 */
object AutocompleteSearch {

    private val gson = Gson()
    private val multiValueListType = object : TypeToken<List<Map<String, Any?>>>() {}.type

    /**
     * Searches contacts matching the query, excluding those already chipped.
     *
     * @param query The search string (typically 2+ characters typed by the user)
     * @param contacts The full list of contacts to search through
     * @param existingChips Email addresses already added as recipient chips (to exclude from results)
     * @param maxResults Maximum number of results to return (default 5)
     * @return Matching contacts sorted with favorites first, capped at maxResults
     */
    fun search(
        query: String,
        contacts: List<ContactEntity>,
        existingChips: List<String>,
        maxResults: Int = 5
    ): List<ContactEntity> {
        if (query.isBlank()) return emptyList()

        val lowerQuery = query.lowercase()
        val chipsLower = existingChips.map { it.lowercase() }.toSet()

        return contacts
            .filter { contact -> !isAlreadyChipped(contact, chipsLower) }
            .filter { contact -> matchesQuery(contact, lowerQuery) }
            .sortedByDescending { it.favorite }
            .take(maxResults)
    }

    /**
     * Checks if a contact's email(s) are already in the existing chips set.
     */
    private fun isAlreadyChipped(contact: ContactEntity, chipsLower: Set<String>): Boolean {
        val emailAddresses = extractEmails(contact.emails)
        return emailAddresses.any { it.lowercase() in chipsLower }
    }

    /**
     * Checks if a contact matches the query by name or email address.
     * Case-insensitive matching against display name, given name, surname, and all email addresses.
     */
    private fun matchesQuery(contact: ContactEntity, lowerQuery: String): Boolean {
        // Match against display name
        if (contact.displayName?.lowercase()?.contains(lowerQuery) == true) return true

        // Match against given name
        if (contact.givenName.lowercase().contains(lowerQuery)) return true

        // Match against surname
        if (contact.surname?.lowercase()?.contains(lowerQuery) == true) return true

        // Match against email addresses
        val emailAddresses = extractEmails(contact.emails)
        if (emailAddresses.any { it.lowercase().contains(lowerQuery) }) return true

        return false
    }

    /**
     * Extracts email address strings from the JSON-encoded emails field.
     * The emails field uses the multi-value format: [{"label": "work", "value": "user@example.com"}]
     * This matches the parseMultiValueJson pattern used throughout the app.
     */
    private fun extractEmails(emailsJson: String?): List<String> {
        if (emailsJson.isNullOrBlank() || emailsJson == "[]" || emailsJson == "null") {
            return emptyList()
        }
        return try {
            val list: List<Map<String, Any?>> = gson.fromJson(emailsJson, multiValueListType)
                ?: emptyList()
            list.mapNotNull { (it["value"] as? String)?.takeIf { v -> v.isNotBlank() } }
        } catch (e: Exception) {
            // If parsing fails, try treating it as a simple email string
            listOf(emailsJson)
        }
    }
}
