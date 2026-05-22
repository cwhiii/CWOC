package com.cwoc.app.domain.search

import com.cwoc.app.data.local.entity.ChitEntity

/**
 * A snippet extracted from a chit field showing where a search term matched.
 *
 * @param fieldName The name of the field that matched (e.g., "title", "note", "location")
 * @param snippet The extracted text window around the match, with "…" prefix/suffix as needed
 * @param matchStart The offset of the match start within the snippet string (accounts for "…" prefix)
 * @param matchEnd The offset of the match end within the snippet string (accounts for "…" prefix)
 */
data class SearchSnippet(
    val fieldName: String,
    val snippet: String,
    val matchStart: Int,
    val matchEnd: Int
)

/**
 * Pure utility object that extracts search result snippets from chit fields.
 * For each searchable field, finds the first case-insensitive occurrence of any search term
 * and returns a windowed snippet centered on the match.
 */
object SnippetExtractor {

    private const val ELLIPSIS = "…"

    /**
     * Extract snippets from all searchable fields of a chit that contain any of the search terms.
     *
     * @param chit The chit entity to search within
     * @param searchTerms List of terms to search for (case-insensitive matching)
     * @param maxLength Maximum length of the snippet text (excluding ellipsis characters)
     * @param contextBefore Minimum number of characters to show before the match start
     * @return One SearchSnippet per matched field, skipping fields with no match
     */
    fun extractSnippets(
        chit: ChitEntity,
        searchTerms: List<String>,
        maxLength: Int = 50,
        contextBefore: Int = 15
    ): List<SearchSnippet> {
        if (searchTerms.isEmpty()) return emptyList()

        val fields = buildSearchableFields(chit)
        val results = mutableListOf<SearchSnippet>()

        for ((fieldName, fieldValue) in fields) {
            if (fieldValue.isNullOrBlank()) continue

            val snippet = findAndExtractSnippet(fieldValue, searchTerms, maxLength, contextBefore)
            if (snippet != null) {
                results.add(
                    SearchSnippet(
                        fieldName = fieldName,
                        snippet = snippet.text,
                        matchStart = snippet.matchStart,
                        matchEnd = snippet.matchEnd
                    )
                )
            }
        }

        return results
    }

    /**
     * Builds the list of searchable field name/value pairs from a ChitEntity.
     * Includes: title, note, location, tags (joined), people (joined),
     * checklist text, email subject, email body, email from, email to.
     */
    private fun buildSearchableFields(chit: ChitEntity): List<Pair<String, String?>> {
        return listOf(
            "title" to chit.title,
            "note" to chit.note,
            "location" to chit.location,
            "tags" to chit.tags?.joinToString(", "),
            "people" to chit.people?.joinToString(", "),
            "checklist" to extractChecklistText(chit.checklist),
            "email subject" to chit.emailSubject,
            "email body" to chit.emailBodyText,
            "email from" to chit.emailFrom,
            "email to" to chit.emailTo
        )
    }

    /**
     * Extracts plain text from checklist JSON.
     * The checklist field stores JSON with item text — we extract just the text content.
     */
    private fun extractChecklistText(checklistJson: String?): String? {
        if (checklistJson.isNullOrBlank()) return null

        // Checklist is stored as JSON array of objects with "text" fields.
        // Extract text values using a simple regex approach to avoid JSON parsing dependency.
        val textPattern = Regex(""""text"\s*:\s*"([^"]*?)"""")
        val matches = textPattern.findAll(checklistJson)
        val texts = matches.map { it.groupValues[1] }.toList()

        return if (texts.isEmpty()) null else texts.joinToString(" ")
    }

    /**
     * Finds the first case-insensitive occurrence of any search term in the field value
     * and extracts a snippet window around it.
     */
    private fun findAndExtractSnippet(
        fieldValue: String,
        searchTerms: List<String>,
        maxLength: Int,
        contextBefore: Int
    ): SnippetResult? {
        val lowerField = fieldValue.lowercase()

        // Find the first occurrence of any search term
        var bestIndex = Int.MAX_VALUE
        var bestTermLength = 0

        for (term in searchTerms) {
            if (term.isBlank()) continue
            val index = lowerField.indexOf(term.lowercase())
            if (index != -1 && index < bestIndex) {
                bestIndex = index
                bestTermLength = term.length
            }
        }

        if (bestIndex == Int.MAX_VALUE) return null

        // Calculate snippet window centered on the match
        val matchEnd = bestIndex + bestTermLength

        // Ensure at least contextBefore chars before match start
        var windowStart = (bestIndex - contextBefore).coerceAtLeast(0)
        var windowEnd = (windowStart + maxLength).coerceAtMost(fieldValue.length)

        // If window end is constrained, try to shift window start back
        if (windowEnd - windowStart < maxLength) {
            windowStart = (windowEnd - maxLength).coerceAtLeast(0)
        }

        val snippetText = fieldValue.substring(windowStart, windowEnd)

        // Determine if we need ellipsis
        val needsPrefixEllipsis = windowStart > 0
        val needsSuffixEllipsis = windowEnd < fieldValue.length

        // Build final snippet with ellipsis
        val prefix = if (needsPrefixEllipsis) ELLIPSIS else ""
        val suffix = if (needsSuffixEllipsis) ELLIPSIS else ""
        val finalSnippet = "$prefix$snippetText$suffix"

        // Calculate match offsets within the final snippet string
        val matchStartInSnippet = (bestIndex - windowStart) + prefix.length
        val matchEndInSnippet = matchStartInSnippet + bestTermLength

        return SnippetResult(
            text = finalSnippet,
            matchStart = matchStartInSnippet,
            matchEnd = matchEndInSnippet
        )
    }

    /**
     * Internal result holder for snippet extraction.
     */
    private data class SnippetResult(
        val text: String,
        val matchStart: Int,
        val matchEnd: Int
    )
}
