package com.cwoc.app.domain.email

/**
 * Represents a text selection within an editor field.
 *
 * @param start The start index of the selection (inclusive).
 * @param end The end index of the selection (exclusive).
 * @param text The selected text content.
 */
data class TextSelection(val start: Int, val end: Int, val text: String)

/**
 * Pure function: applies markdown formatting operations to text selections.
 *
 * Used by the email compose formatting toolbar to wrap or prefix
 * selected text with appropriate markdown markers.
 */
object MarkdownFormatter {

    /**
     * Wraps the selected text with ** bold markers.
     *
     * Example: "hello" → "**hello**"
     *
     * @param text The full text content.
     * @param selection The current text selection.
     * @return The text with bold markers applied around the selection.
     */
    fun applyBold(text: String, selection: TextSelection): String {
        return wrapSelection(text, selection, "**", "**")
    }

    /**
     * Wraps the selected text with _ italic markers.
     *
     * Example: "hello" → "_hello_"
     *
     * @param text The full text content.
     * @param selection The current text selection.
     * @return The text with italic markers applied around the selection.
     */
    fun applyItalic(text: String, selection: TextSelection): String {
        return wrapSelection(text, selection, "_", "_")
    }

    /**
     * Wraps the selected text with ~~ strikethrough markers.
     *
     * Example: "hello" → "~~hello~~"
     *
     * @param text The full text content.
     * @param selection The current text selection.
     * @return The text with strikethrough markers applied around the selection.
     */
    fun applyStrikethrough(text: String, selection: TextSelection): String {
        return wrapSelection(text, selection, "~~", "~~")
    }

    /**
     * Wraps the selected text as a markdown link: [text](url).
     *
     * Example: "click here" with url "https://example.com" → "[click here](https://example.com)"
     *
     * @param text The full text content.
     * @param selection The current text selection.
     * @param url The URL to link to.
     * @return The text with link formatting applied around the selection.
     */
    fun applyLink(text: String, selection: TextSelection, url: String): String {
        val before = text.substring(0, selection.start)
        val after = text.substring(selection.end)
        return "${before}[${selection.text}](${url})${after}"
    }

    /**
     * Prefixes the line at the given position with heading markers (# level).
     *
     * Supports levels 1-3:
     * - Level 1: "# "
     * - Level 2: "## "
     * - Level 3: "### "
     *
     * @param text The full text content.
     * @param lineStart The index of the start of the line to prefix.
     * @param level The heading level (1, 2, or 3).
     * @return The text with heading prefix applied at the line start.
     */
    fun applyHeading(text: String, lineStart: Int, level: Int): String {
        val clampedLevel = level.coerceIn(1, 3)
        val prefix = "#".repeat(clampedLevel) + " "
        val before = text.substring(0, lineStart)
        val after = text.substring(lineStart)
        return "${before}${prefix}${after}"
    }

    /**
     * Prefixes the line at the given position with a bullet list marker "- ".
     *
     * @param text The full text content.
     * @param lineStart The index of the start of the line to prefix.
     * @return The text with bullet list prefix applied at the line start.
     */
    fun applyBulletList(text: String, lineStart: Int): String {
        val before = text.substring(0, lineStart)
        val after = text.substring(lineStart)
        return "${before}- ${after}"
    }

    /**
     * Prefixes the line at the given position with a numbered list marker "1. ".
     *
     * @param text The full text content.
     * @param lineStart The index of the start of the line to prefix.
     * @return The text with numbered list prefix applied at the line start.
     */
    fun applyNumberedList(text: String, lineStart: Int): String {
        val before = text.substring(0, lineStart)
        val after = text.substring(lineStart)
        return "${before}1. ${after}"
    }

    /**
     * Prefixes each line in the selection with "> " blockquote markers.
     *
     * If the selection spans multiple lines, each line gets the prefix.
     *
     * @param text The full text content.
     * @param selection The current text selection.
     * @return The text with blockquote prefix applied to selected lines.
     */
    fun applyBlockquote(text: String, selection: TextSelection): String {
        val before = text.substring(0, selection.start)
        val after = text.substring(selection.end)
        val quoted = selection.text.lines().joinToString("\n") { "> $it" }
        return "${before}${quoted}${after}"
    }

    /**
     * Wraps the selected text with backtick inline code markers.
     *
     * Example: "code" → "`code`"
     *
     * @param text The full text content.
     * @param selection The current text selection.
     * @return The text with inline code markers applied around the selection.
     */
    fun applyInlineCode(text: String, selection: TextSelection): String {
        return wrapSelection(text, selection, "`", "`")
    }

    /**
     * Inserts a horizontal rule ("\n---\n") at the cursor position.
     *
     * @param text The full text content.
     * @param cursorPos The cursor position where the rule should be inserted.
     * @return The text with a horizontal rule inserted at the cursor position.
     */
    fun applyHorizontalRule(text: String, cursorPos: Int): String {
        val before = text.substring(0, cursorPos)
        val after = text.substring(cursorPos)
        return "${before}\n---\n${after}"
    }

    /**
     * Helper: wraps the selected text with prefix and suffix markers.
     */
    private fun wrapSelection(
        text: String,
        selection: TextSelection,
        prefix: String,
        suffix: String
    ): String {
        val before = text.substring(0, selection.start)
        val after = text.substring(selection.end)
        return "${before}${prefix}${selection.text}${suffix}${after}"
    }
}
