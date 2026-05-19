package com.cwoc.app.ui.screens.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.search.BooleanSearchEvaluator
import com.cwoc.app.domain.search.BooleanSearchParser
import com.cwoc.app.domain.search.SearchNode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Data class representing a single search result.
 *
 * @param chitId The ID of the matched chit
 * @param title The chit's title (for display)
 * @param matchedFields List of field names that matched the query (e.g., "title", "note", "tags")
 * @param highlightRanges Map of field name to list of IntRanges indicating where matches occur
 * @param chit The full ChitEntity for rendering in result cards
 */
data class SearchResult(
    val chitId: String,
    val title: String?,
    val matchedFields: List<String>,
    val highlightRanges: Map<String, List<IntRange>>,
    val chit: ChitEntity
)

/**
 * ViewModel for the global search screen.
 *
 * Provides debounced search across all non-deleted chits using the existing
 * BooleanSearchParser and BooleanSearchEvaluator. Supports field::value syntax,
 * #tag shorthand, and boolean operators (&&, ||, !, -prefix).
 *
 * Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.8
 */
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val searchParser: BooleanSearchParser,
    private val searchEvaluator: BooleanSearchEvaluator
) : ViewModel() {

    /** The current search query text, updated by the UI. */
    val query = MutableStateFlow("")

    /** Status filter (empty = show all) */
    val statusFilter = MutableStateFlow("")

    /** Priority filter (empty = show all) */
    val priorityFilter = MutableStateFlow("")

    /** Email filter: "no_email" (default), "all", "only_email" */
    val emailFilter = MutableStateFlow("no_email")

    fun onQueryChange(newQuery: String) { query.value = newQuery }
    fun setStatusFilter(status: String) { statusFilter.value = status }
    fun setPriorityFilter(priority: String) { priorityFilter.value = priority }
    fun setEmailFilter(mode: String) { emailFilter.value = mode }

    /**
     * Search results produced by evaluating the debounced query against all non-deleted chits.
     * Emits an empty list when the query is blank.
     * Applies status, priority, and email filters after search.
     */
    val results: StateFlow<List<SearchResult>> = combine(
        query.debounce(300L),
        chitRepository.getAllNonDeleted(),
        statusFilter,
        priorityFilter,
        emailFilter
    ) { queryText, allChits, status, priority, emailMode ->
        val searchResults = performSearch(queryText, allChits)
        // Apply post-search filters
        searchResults.filter { result ->
            val chit = result.chit
            // Status filter
            if (status.isNotBlank() && chit.status != status) return@filter false
            // Priority filter
            if (priority.isNotBlank() && chit.priority != priority) return@filter false
            // Email filter
            val isEmail = !chit.emailMessageId.isNullOrBlank() || !chit.emailStatus.isNullOrBlank()
            when (emailMode) {
                "no_email" -> if (isEmail) return@filter false
                "only_email" -> if (!isEmail) return@filter false
                // "all" — no filter
            }
            true
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000L),
        initialValue = emptyList()
    )

    /**
     * Performs the search logic:
     * 1. Pre-processes the query (handles #tag and field::value syntax)
     * 2. Parses into a SearchNode AST via BooleanSearchParser
     * 3. Evaluates each chit against the AST
     * 4. Computes matched fields and highlight ranges for results
     */
    private fun performSearch(queryText: String, chits: List<ChitEntity>): List<SearchResult> {
        if (queryText.isBlank()) return emptyList()

        // Pre-process: convert && to AND, || to OR for the parser
        val normalizedQuery = queryText
            .replace("&&", " AND ")
            .replace("||", " OR ")

        // Handle #tag shorthand: #tagname → tags::tagname
        val tagProcessed = TAG_PATTERN.replace(normalizedQuery) { match ->
            "tags::${match.groupValues[1]}"
        }

        // Parse field::value directives and remaining boolean query
        val fieldDirectives = mutableListOf<FieldDirective>()
        val remainingTerms = mutableListOf<String>()

        // Split by spaces while respecting quotes and operators
        val tokens = tokenizeForFieldExtraction(tagProcessed)
        for (token in tokens) {
            val fieldMatch = FIELD_VALUE_PATTERN.matchEntire(token)
            if (fieldMatch != null) {
                fieldDirectives.add(
                    FieldDirective(
                        field = fieldMatch.groupValues[1].lowercase(),
                        value = fieldMatch.groupValues[2].lowercase()
                    )
                )
            } else {
                remainingTerms.add(token)
            }
        }

        // Build the boolean query from remaining terms
        val booleanQuery = remainingTerms.joinToString(" ")
        val searchNode = if (booleanQuery.isNotBlank()) searchParser.parse(booleanQuery) else null

        // Evaluate each chit
        val results = mutableListOf<SearchResult>()
        for (chit in chits) {
            val matchedFields = mutableListOf<String>()
            val highlightRanges = mutableMapOf<String, List<IntRange>>()

            // Check field directives
            var allDirectivesMatch = true
            for (directive in fieldDirectives) {
                val fieldValue = getFieldValue(chit, directive.field)
                if (fieldValue != null && fieldValue.lowercase().contains(directive.value)) {
                    matchedFields.add(directive.field)
                    val ranges = findHighlightRanges(fieldValue, directive.value)
                    if (ranges.isNotEmpty()) {
                        highlightRanges[directive.field] = ranges
                    }
                } else {
                    allDirectivesMatch = false
                    break
                }
            }

            if (!allDirectivesMatch) continue

            // Check boolean search node
            if (searchNode != null) {
                if (!searchEvaluator.matches(chit, searchNode)) continue

                // Find which fields matched and compute highlight ranges
                val queryTerms = extractTerms(searchNode)
                for (term in queryTerms) {
                    for ((fieldName, fieldValue) in getSearchableFields(chit)) {
                        if (fieldValue.lowercase().contains(term)) {
                            if (fieldName !in matchedFields) matchedFields.add(fieldName)
                            val ranges = findHighlightRanges(fieldValue, term)
                            if (ranges.isNotEmpty()) {
                                val existing = highlightRanges[fieldName].orEmpty()
                                highlightRanges[fieldName] = mergeRanges(existing + ranges)
                            }
                        }
                    }
                }
            }

            // If we have field directives but no boolean query, the chit matches
            // If we have both, both must match (already handled above)
            if (matchedFields.isNotEmpty() || (fieldDirectives.isEmpty() && searchNode == null)) {
                // Only add if there's actually a match
                if (matchedFields.isNotEmpty()) {
                    results.add(
                        SearchResult(
                            chitId = chit.id,
                            title = chit.title,
                            matchedFields = matchedFields,
                            highlightRanges = highlightRanges,
                            chit = chit
                        )
                    )
                }
            }
        }

        return results
    }

    /**
     * Gets the value of a specific field from a chit for field::value matching.
     */
    private fun getFieldValue(chit: ChitEntity, field: String): String? {
        return when (field) {
            "title" -> chit.title
            "note", "notes" -> chit.note
            "tags", "tag" -> chit.tags?.joinToString(" ")
            "status" -> chit.status
            "priority" -> chit.priority
            "people", "person" -> chit.people?.joinToString(" ")
            "checklist" -> extractChecklistText(chit)
            "color" -> chit.color
            "location" -> chit.location
            // Email fields
            "subject" -> chit.emailSubject
            "sender", "from" -> chit.emailFrom
            "to" -> chit.emailTo
            "cc" -> chit.emailCc
            "bcc" -> chit.emailBcc
            "body" -> chit.emailBodyText ?: chit.emailBodyHtml
            // Date fields
            "due" -> chit.dueDatetime
            "start" -> chit.startDatetime
            "end" -> chit.endDatetime
            // Other
            "assigned" -> chit.assignedTo
            "child" -> chit.childChits?.joinToString(" ")
            else -> null
        }
    }

    /**
     * Returns all searchable fields as name-value pairs for highlight computation.
     */
    private fun getSearchableFields(chit: ChitEntity): List<Pair<String, String>> {
        val fields = mutableListOf<Pair<String, String>>()
        chit.title?.let { fields.add("title" to it) }
        chit.note?.let { fields.add("note" to it) }
        chit.tags?.let { tags ->
            if (tags.isNotEmpty()) fields.add("tags" to tags.joinToString(" "))
        }
        chit.people?.let { people ->
            if (people.isNotEmpty()) fields.add("people" to people.joinToString(" "))
        }
        // U2: Include location in general search
        chit.location?.let { fields.add("location" to it) }
        // U3: Include checklist items in general search
        extractChecklistText(chit)?.let { fields.add("checklist" to it) }
        // Email fields
        chit.emailSubject?.let { fields.add("subject" to it) }
        chit.emailFrom?.let { fields.add("from" to it) }
        chit.emailTo?.let { fields.add("to" to it) }
        chit.emailBodyText?.let { fields.add("body" to it) }
        return fields
    }

    /**
     * Extracts text content from checklist JSON for searching.
     */
    private fun extractChecklistText(chit: ChitEntity): String? {
        val json = chit.checklist ?: return null
        if (json.isBlank() || json == "[]" || json == "null") return null
        return try {
            val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
            val items: List<Map<String, Any>> = com.google.gson.Gson().fromJson(json, type)
            items.mapNotNull { item ->
                (item["text"] as? String) ?: (item["label"] as? String)
            }.joinToString(" ").takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Finds all occurrences of a search term within a field value (case-insensitive).
     * Returns a list of IntRanges indicating match positions.
     */
    private fun findHighlightRanges(fieldValue: String, term: String): List<IntRange> {
        val ranges = mutableListOf<IntRange>()
        val lowerValue = fieldValue.lowercase()
        val lowerTerm = term.lowercase()
        var startIndex = 0
        while (startIndex < lowerValue.length) {
            val index = lowerValue.indexOf(lowerTerm, startIndex)
            if (index == -1) break
            ranges.add(IntRange(index, index + lowerTerm.length - 1))
            startIndex = index + 1
        }
        return ranges
    }

    /**
     * Extracts all Term values from a SearchNode AST (for highlight computation).
     */
    private fun extractTerms(node: SearchNode): List<String> {
        return when (node) {
            is SearchNode.Term -> listOf(node.value)
            is SearchNode.And -> extractTerms(node.left) + extractTerms(node.right)
            is SearchNode.Or -> extractTerms(node.left) + extractTerms(node.right)
            is SearchNode.Not -> extractTerms(node.child)
        }
    }

    /**
     * Merges overlapping IntRanges into non-overlapping ranges.
     */
    private fun mergeRanges(ranges: List<IntRange>): List<IntRange> {
        if (ranges.isEmpty()) return emptyList()
        val sorted = ranges.sortedBy { it.first }
        val merged = mutableListOf(sorted.first())
        for (range in sorted.drop(1)) {
            val last = merged.last()
            if (range.first <= last.last + 1) {
                merged[merged.lastIndex] = IntRange(last.first, maxOf(last.last, range.last))
            } else {
                merged.add(range)
            }
        }
        return merged
    }

    /**
     * Tokenizes the query for field::value extraction while preserving quoted strings
     * and boolean operators as single tokens.
     */
    private fun tokenizeForFieldExtraction(input: String): List<String> {
        val tokens = mutableListOf<String>()
        var i = 0
        while (i < input.length) {
            when {
                input[i].isWhitespace() -> i++
                input[i] == '"' -> {
                    // Quoted string — keep as single token
                    val start = i
                    i++ // skip opening quote
                    while (i < input.length && input[i] != '"') i++
                    if (i < input.length) i++ // skip closing quote
                    tokens.add(input.substring(start, i))
                }
                else -> {
                    val start = i
                    while (i < input.length && !input[i].isWhitespace()) i++
                    tokens.add(input.substring(start, i))
                }
            }
        }
        return tokens
    }

    private data class FieldDirective(val field: String, val value: String)

    companion object {
        /** Matches #tagname patterns (tag shorthand). */
        private val TAG_PATTERN = Regex("""#(\w+)""")

        /** Matches field::value patterns. */
        private val FIELD_VALUE_PATTERN = Regex("""(\w+)::(.+)""")
    }
}
