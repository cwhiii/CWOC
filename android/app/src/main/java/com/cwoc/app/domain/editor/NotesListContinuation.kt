package com.cwoc.app.domain.editor

/**
 * List continuation logic for the notes editor.
 * Detects markdown list prefixes on the current line and determines
 * whether to continue the list (insert next prefix) or remove the
 * empty prefix (end the list).
 *
 * Supported patterns (matched in order):
 * - Checkbox: `- [ ] `, `* [x] `, `+ [ ] ` (with optional leading whitespace)
 * - Unordered list: `- `, `* `, `+ ` (with optional leading whitespace)
 * - Ordered list: `1. `, `2) ` (with optional leading whitespace)
 * - Blockquote: `> ` (with optional leading whitespace)
 */
object NotesListContinuation {

    // Patterns matched in priority order
    private val CHECKBOX_REGEX = Regex("^(\\s*)([-*+])\\s\\[[ xX]\\]\\s")
    private val UNORDERED_REGEX = Regex("^(\\s*)([-*+])\\s")
    private val ORDERED_REGEX = Regex("^(\\s*)(\\d+)([.)]) ")
    private val BLOCKQUOTE_REGEX = Regex("^(\\s*)(>)\\s?")

    /**
     * Analyze the current line text and determine the list continuation behavior.
     *
     * @param currentLineText The full text of the line the cursor is on
     * @return A [ListContinuationResult] describing the action to take, or null if
     *         the line is not a recognized list line (normal Enter behavior).
     */
    fun getListContinuation(currentLineText: String): ListContinuationResult? {
        // Try checkbox first
        CHECKBOX_REGEX.find(currentLineText)?.let { match ->
            val indent = match.groupValues[1]
            val bullet = match.groupValues[2]
            val prefix = "$indent$bullet [ ] "
            val prefixLength = match.value.length
            val content = currentLineText.substring(prefixLength)
            return if (content.isEmpty()) {
                ListContinuationResult(ListAction.REMOVE_PREFIX, prefix, prefixLength)
            } else {
                ListContinuationResult(ListAction.CONTINUE, prefix, prefixLength)
            }
        }

        // Try unordered list
        UNORDERED_REGEX.find(currentLineText)?.let { match ->
            val indent = match.groupValues[1]
            val bullet = match.groupValues[2]
            val prefix = "$indent$bullet "
            val prefixLength = match.value.length
            val content = currentLineText.substring(prefixLength)
            return if (content.isEmpty()) {
                ListContinuationResult(ListAction.REMOVE_PREFIX, prefix, prefixLength)
            } else {
                ListContinuationResult(ListAction.CONTINUE, prefix, prefixLength)
            }
        }

        // Try ordered list
        ORDERED_REGEX.find(currentLineText)?.let { match ->
            val indent = match.groupValues[1]
            val number = match.groupValues[2].toInt()
            val delimiter = match.groupValues[3]
            val currentPrefix = "$indent$number$delimiter "
            val prefixLength = match.value.length
            val content = currentLineText.substring(prefixLength)
            return if (content.isEmpty()) {
                ListContinuationResult(ListAction.REMOVE_PREFIX, currentPrefix, prefixLength)
            } else {
                val nextPrefix = "$indent${number + 1}$delimiter "
                ListContinuationResult(ListAction.CONTINUE, nextPrefix, prefixLength)
            }
        }

        // Try blockquote
        BLOCKQUOTE_REGEX.find(currentLineText)?.let { match ->
            val indent = match.groupValues[1]
            val prefix = "$indent> "
            val prefixLength = match.value.length
            val content = currentLineText.substring(prefixLength)
            return if (content.isEmpty()) {
                ListContinuationResult(ListAction.REMOVE_PREFIX, prefix, prefixLength)
            } else {
                ListContinuationResult(ListAction.CONTINUE, prefix, prefixLength)
            }
        }

        // Not a list line
        return null
    }
}

/**
 * The action to take when Enter is pressed on a list line.
 */
enum class ListAction {
    /** Insert a newline followed by the continuation prefix */
    CONTINUE,
    /** Remove the empty prefix from the current line (end the list) */
    REMOVE_PREFIX
}

/**
 * Result of analyzing a line for list continuation.
 *
 * @property action Whether to continue the list or remove the empty prefix
 * @property prefix The full prefix string (including indent). For CONTINUE, this is
 *                  what gets inserted after the newline. For REMOVE_PREFIX, this is
 *                  the prefix that was on the current line.
 * @property prefixLength The length of the matched prefix on the current line
 *                        (used for REMOVE_PREFIX to know how many chars to delete)
 */
data class ListContinuationResult(
    val action: ListAction,
    val prefix: String,
    val prefixLength: Int
)
