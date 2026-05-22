package com.cwoc.app.ui.util

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration

/**
 * Inline-only markdown renderer for checklist items.
 * Produces AnnotatedString with SpanStyle spans and URL annotations.
 *
 * Supports:
 * - Bold: **text**
 * - Italic: *text*
 * - Inline code: `code`
 * - Links: [text](url) with URL annotation
 * - Nested combinations (e.g., bold inside a link, italic inside bold)
 *
 * Does NOT render block-level syntax (headings, blockquotes, horizontal rules, bullet lists).
 * Block-level syntax is displayed as literal text.
 *
 * Strips GFM checkbox prefixes (- [x] , - [ ] ) from output.
 * Malformed/unclosed syntax is displayed as raw text (graceful degradation).
 */
object InlineMarkdownRenderer {

    private val linkColor = Color(0xFF1565C0)

    /**
     * Render inline markdown to an AnnotatedString.
     * @param text The raw markdown text (may be multi-line).
     * @param linkTextColor Optional override for link color.
     * @return AnnotatedString with appropriate spans and URL annotations.
     */
    fun render(text: String, linkTextColor: Color = linkColor): AnnotatedString {
        if (text.isEmpty()) return AnnotatedString("")

        return buildAnnotatedString {
            val lines = text.lines()
            for ((index, rawLine) in lines.withIndex()) {
                if (index > 0) append("\n")

                // Strip GFM checkbox prefixes at the start of lines
                val line = stripCheckboxPrefix(rawLine)

                parseInline(this, line, emptyList(), linkTextColor)
            }
        }
    }

    /**
     * Strip GFM task list checkbox syntax from the start of a line.
     * Removes: "- [x] ", "- [ ] ", "- [X] "
     */
    private fun stripCheckboxPrefix(line: String): String {
        val trimmed = line
        if (trimmed.startsWith("- [x] ") || trimmed.startsWith("- [X] ")) {
            return trimmed.removePrefix("- [x] ").let {
                if (it == trimmed) trimmed.removePrefix("- [X] ") else it
            }
        }
        if (trimmed.startsWith("- [ ] ")) {
            return trimmed.removePrefix("- [ ] ")
        }
        return line
    }

    /**
     * Parse inline markdown elements recursively, supporting nesting.
     * @param builder The AnnotatedString.Builder to append to.
     * @param text The text to parse.
     * @param activeStyles Currently active SpanStyles (for nesting).
     * @param linkTextColor The color to use for link text.
     */
    private fun parseInline(
        builder: AnnotatedString.Builder,
        text: String,
        activeStyles: List<SpanStyle>,
        linkTextColor: Color
    ) {
        var i = 0
        while (i < text.length) {
            when {
                // Inline code: `code` — no nesting inside code spans
                text.startsWith("`", i) -> {
                    val end = text.indexOf("`", i + 1)
                    if (end != -1) {
                        val codeContent = text.substring(i + 1, end)
                        val style = SpanStyle(fontFamily = FontFamily.Monospace)
                        builder.pushStyle(style)
                        builder.append(codeContent)
                        builder.pop()
                        i = end + 1
                    } else {
                        // Unclosed — display as raw text
                        builder.append(text.substring(i))
                        return
                    }
                }

                // Link: [text](url)
                text.startsWith("[", i) -> {
                    val result = tryParseLink(text, i)
                    if (result != null) {
                        val (linkText, url, endIndex) = result
                        val linkStyle = SpanStyle(
                            color = linkTextColor,
                            textDecoration = TextDecoration.Underline
                        )
                        builder.pushStringAnnotation(tag = "URL", annotation = url)
                        builder.pushStyle(linkStyle)
                        // Parse inline formatting within link text (supports nested bold/italic)
                        parseInline(builder, linkText, activeStyles + linkStyle, linkTextColor)
                        builder.pop() // pop style
                        builder.pop() // pop annotation
                        i = endIndex
                    } else {
                        builder.append(text[i])
                        i++
                    }
                }

                // Bold: **text**
                text.startsWith("**", i) -> {
                    val end = findClosingDelimiter(text, i + 2, "**")
                    if (end != -1) {
                        val boldContent = text.substring(i + 2, end)
                        val style = SpanStyle(fontWeight = FontWeight.Bold)
                        builder.pushStyle(style)
                        // Parse nested inline formatting within bold
                        parseInline(builder, boldContent, activeStyles + style, linkTextColor)
                        builder.pop()
                        i = end + 2
                    } else {
                        // Unclosed — display as raw text
                        builder.append(text.substring(i))
                        return
                    }
                }

                // Italic: *text* (but not **)
                text.startsWith("*", i) && !text.startsWith("**", i) -> {
                    val end = findClosingDelimiter(text, i + 1, "*")
                    if (end != -1 && !text.startsWith("*", end + 1)) {
                        val italicContent = text.substring(i + 1, end)
                        val style = SpanStyle(fontStyle = FontStyle.Italic)
                        builder.pushStyle(style)
                        // Parse nested inline formatting within italic
                        parseInline(builder, italicContent, activeStyles + style, linkTextColor)
                        builder.pop()
                        i = end + 1
                    } else if (end != -1 && text.startsWith("*", end + 1)) {
                        // This might be part of ** — treat as literal
                        builder.append(text[i])
                        i++
                    } else {
                        // Unclosed — display as raw text
                        builder.append(text.substring(i))
                        return
                    }
                }

                else -> {
                    builder.append(text[i])
                    i++
                }
            }
        }
    }

    /**
     * Try to parse a markdown link starting at position [start].
     * Returns (linkText, url, endIndex) or null if not a valid link.
     */
    private fun tryParseLink(text: String, start: Int): Triple<String, String, Int>? {
        // Find the closing ]
        val closeBracket = findMatchingBracket(text, start)
        if (closeBracket == -1) return null

        // Must be immediately followed by (
        if (closeBracket + 1 >= text.length || text[closeBracket + 1] != '(') return null

        // Find the closing )
        val closeParen = text.indexOf(')', closeBracket + 2)
        if (closeParen == -1) return null

        val linkText = text.substring(start + 1, closeBracket)
        val url = text.substring(closeBracket + 2, closeParen)

        // Validate: link text and url should not be empty
        if (linkText.isEmpty() || url.isEmpty()) return null

        return Triple(linkText, url, closeParen + 1)
    }

    /**
     * Find the matching closing bracket ']' for an opening '[' at [start],
     * handling nested brackets.
     */
    private fun findMatchingBracket(text: String, start: Int): Int {
        var depth = 0
        var i = start
        while (i < text.length) {
            when (text[i]) {
                '[' -> depth++
                ']' -> {
                    depth--
                    if (depth == 0) return i
                }
            }
            i++
        }
        return -1
    }

    /**
     * Find the closing delimiter starting from [start], skipping nested structures.
     * For **, we need to find the next ** that isn't part of a longer sequence.
     * For *, we need to find the next * that isn't part of **.
     */
    private fun findClosingDelimiter(text: String, start: Int, delimiter: String): Int {
        var i = start
        while (i < text.length) {
            // Skip inline code spans (they can contain anything)
            if (text[i] == '`') {
                val codeEnd = text.indexOf('`', i + 1)
                if (codeEnd != -1) {
                    i = codeEnd + 1
                    continue
                }
            }

            if (delimiter == "**") {
                if (text.startsWith("**", i)) {
                    return i
                }
            } else if (delimiter == "*") {
                if (text[i] == '*' && !text.startsWith("**", i)) {
                    return i
                }
            }
            i++
        }
        return -1
    }
}
