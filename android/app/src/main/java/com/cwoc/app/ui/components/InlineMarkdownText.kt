package com.cwoc.app.ui.components

import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration

/**
 * Parse inline markdown text into an AnnotatedString.
 * Can be used directly with ClickableText when custom click handling is needed
 * (e.g., tap-to-edit in checklist items alongside link clicks).
 *
 * Returns plain AnnotatedString(text) if no markdown syntax is detected (fast path).
 */
fun parseInlineMarkdownToAnnotatedString(text: String): AnnotatedString {
    if (!containsInlineMarkdown(text)) {
        return AnnotatedString(text)
    }
    return parseInlineMarkdown(text)
}

/**
 * Lightweight composable that renders inline markdown formatting for checklist items.
 *
 * Supports:
 * - **bold** / __bold__ → FontWeight.Bold
 * - *italic* / _italic_ → FontStyle.Italic
 * - ~~strikethrough~~ → TextDecoration.LineThrough
 * - `code` → monospace font with subtle background
 * - [text](url) → steel-blue color (#4682B4) with underline + URL annotation
 * - [[title]] → steel-blue color with underline + CHIT_LINK annotation
 *
 * Does NOT process block-level markdown (headers, code blocks, blockquotes, HRs, lists).
 * If text contains no markdown syntax, renders as plain text (fast path).
 */
@Composable
fun InlineMarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    onLinkClick: ((String) -> Unit)? = null,
    onChitLinkClick: ((String) -> Unit)? = null
) {
    // Fast path: if no markdown syntax detected, render plain text
    if (!containsInlineMarkdown(text)) {
        Text(
            text = text,
            modifier = modifier,
            style = style
        )
        return
    }

    val annotated = remember(text) { parseInlineMarkdown(text) }
    val hasLinks = remember(annotated) {
        annotated.getStringAnnotations(tag = "URL", start = 0, end = annotated.length).isNotEmpty()
    }
    val hasChitLinks = remember(annotated) {
        annotated.getStringAnnotations(tag = "CHIT_LINK", start = 0, end = annotated.length).isNotEmpty()
    }

    if ((hasLinks && onLinkClick != null) || (hasChitLinks && onChitLinkClick != null)) {
        ClickableText(
            text = annotated,
            modifier = modifier,
            style = style,
            onClick = { offset ->
                // Check CHIT_LINK first
                annotated.getStringAnnotations(tag = "CHIT_LINK", start = offset, end = offset)
                    .firstOrNull()?.let { annotation ->
                        onChitLinkClick?.invoke(annotation.item)
                        return@ClickableText
                    }
                // Then check URL
                annotated.getStringAnnotations(tag = "URL", start = offset, end = offset)
                    .firstOrNull()?.let { annotation ->
                        onLinkClick?.invoke(annotation.item)
                    }
            }
        )
    } else {
        Text(
            text = annotated,
            modifier = modifier,
            style = style
        )
    }
}

// --- Fast-path detection ---

/**
 * Quick check for any inline markdown syntax characters.
 * Returns false if the text is guaranteed to have no markdown formatting.
 */
private fun containsInlineMarkdown(text: String): Boolean {
    return text.contains('*') ||
            text.contains('_') ||
            text.contains('~') ||
            text.contains('`') ||
            (text.contains('[') && text.contains("](")) ||
            text.contains("[[")
}

// --- Inline markdown parsing ---

private val LINK_COLOR = Color(0xFF4682B4) // Steel blue
private val CODE_BACKGROUND = Color(0xFFEDE0D4) // Subtle parchment variant

/**
 * Parse inline markdown into an AnnotatedString.
 *
 * Priority order (to prevent inner formatting conflicts):
 * 1. Code spans (backticks) — content inside is literal, no further parsing
 * 2. Chit links [[title]] — before regular links since [[ starts with [
 * 3. Links [text](url) — text inside may contain formatting
 * 4. Bold **text** / __text__
 * 5. Strikethrough ~~text~~
 * 6. Italic *text* / _text_
 */
private fun parseInlineMarkdown(text: String): AnnotatedString {
    return buildAnnotatedString {
        parseSegment(this, text)
    }
}

/**
 * Recursively parse a text segment, applying inline markdown formatting.
 * Processes patterns in priority order: code → links → bold → strikethrough → italic
 */
private fun parseSegment(builder: AnnotatedString.Builder, text: String) {
    var i = 0
    while (i < text.length) {
        when {
            // 1. Code spans: `code` — highest priority, no nesting
            text.startsWith("`", i) -> {
                val end = text.indexOf('`', i + 1)
                if (end != -1) {
                    val codeContent = text.substring(i + 1, end)
                    builder.pushStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = CODE_BACKGROUND
                        )
                    )
                    builder.append(codeContent)
                    builder.pop()
                    i = end + 1
                } else {
                    // Unclosed backtick — render as literal
                    builder.append(text[i])
                    i++
                }
            }

            // 2. Chit links: [[title]] — before regular links since [[ starts with [
            text.startsWith("[[", i) -> {
                val end = text.indexOf("]]", i + 2)
                if (end != -1) {
                    val linkTitle = text.substring(i + 2, end)
                    // Empty or whitespace-only [[]] renders as plain text
                    if (linkTitle.isBlank()) {
                        builder.append(text.substring(i, end + 2))
                    } else {
                        builder.pushStringAnnotation(tag = "CHIT_LINK", annotation = linkTitle)
                        builder.pushStyle(
                            SpanStyle(
                                color = LINK_COLOR,
                                textDecoration = TextDecoration.Underline
                            )
                        )
                        builder.append(linkTitle)
                        builder.pop() // pop style
                        builder.pop() // pop annotation
                    }
                    i = end + 2
                } else {
                    // Unclosed [[ — render as literal
                    builder.append(text[i])
                    i++
                }
            }

            // 3. Links: [text](url)
            text.startsWith("[", i) -> {
                val linkResult = tryParseLink(text, i)
                if (linkResult != null) {
                    val (linkText, url, endIndex) = linkResult
                    builder.pushStringAnnotation(tag = "URL", annotation = url)
                    builder.pushStyle(
                        SpanStyle(
                            color = LINK_COLOR,
                            textDecoration = TextDecoration.Underline
                        )
                    )
                    // Parse inline formatting within link text
                    parseSegment(builder, linkText)
                    builder.pop() // pop style
                    builder.pop() // pop annotation
                    i = endIndex
                } else {
                    builder.append(text[i])
                    i++
                }
            }

            // 4. Bold: **text** or __text__
            text.startsWith("**", i) -> {
                val end = findClosing(text, i + 2, "**")
                if (end != -1) {
                    val content = text.substring(i + 2, end)
                    builder.pushStyle(SpanStyle(fontWeight = FontWeight.Bold))
                    parseSegment(builder, content)
                    builder.pop()
                    i = end + 2
                } else {
                    builder.append(text[i])
                    i++
                }
            }

            text.startsWith("__", i) -> {
                val end = findClosing(text, i + 2, "__")
                if (end != -1) {
                    val content = text.substring(i + 2, end)
                    builder.pushStyle(SpanStyle(fontWeight = FontWeight.Bold))
                    parseSegment(builder, content)
                    builder.pop()
                    i = end + 2
                } else {
                    builder.append(text[i])
                    i++
                }
            }

            // 5. Strikethrough: ~~text~~
            text.startsWith("~~", i) -> {
                val end = findClosing(text, i + 2, "~~")
                if (end != -1) {
                    val content = text.substring(i + 2, end)
                    builder.pushStyle(SpanStyle(textDecoration = TextDecoration.LineThrough))
                    parseSegment(builder, content)
                    builder.pop()
                    i = end + 2
                } else {
                    builder.append(text[i])
                    i++
                }
            }

            // 6. Italic: *text* (but not **) or _text_ (but not __)
            text.startsWith("*", i) && !text.startsWith("**", i) -> {
                val end = findClosingSingle(text, i + 1, '*')
                if (end != -1) {
                    val content = text.substring(i + 1, end)
                    builder.pushStyle(SpanStyle(fontStyle = FontStyle.Italic))
                    parseSegment(builder, content)
                    builder.pop()
                    i = end + 1
                } else {
                    builder.append(text[i])
                    i++
                }
            }

            text.startsWith("_", i) && !text.startsWith("__", i) -> {
                // Only treat _ as italic if it's at a word boundary
                // (avoid matching mid-word underscores like some_variable_name)
                val prevChar = if (i > 0) text[i - 1] else ' '
                val isWordBoundary = prevChar == ' ' || prevChar == '\t' || i == 0
                val end = findClosingSingle(text, i + 1, '_')
                if (end != -1 && isWordBoundary) {
                    // Check that closing _ is also at a word boundary
                    val nextChar = if (end + 1 < text.length) text[end + 1] else ' '
                    val closingBoundary = nextChar == ' ' || nextChar == '\t' ||
                            nextChar == '.' || nextChar == ',' || nextChar == '!' ||
                            nextChar == '?' || nextChar == ')' || end + 1 == text.length
                    if (closingBoundary) {
                        val content = text.substring(i + 1, end)
                        builder.pushStyle(SpanStyle(fontStyle = FontStyle.Italic))
                        parseSegment(builder, content)
                        builder.pop()
                        i = end + 1
                    } else {
                        builder.append(text[i])
                        i++
                    }
                } else {
                    builder.append(text[i])
                    i++
                }
            }

            else -> {
                builder.append(text[i])
                i++
            }
        }
    }
}

// --- Helper functions ---

/**
 * Try to parse a markdown link [text](url) starting at position [start].
 * Returns (linkText, url, endIndex) or null if not a valid link.
 */
private fun tryParseLink(text: String, start: Int): Triple<String, String, Int>? {
    // Find closing ]
    var depth = 0
    var closeBracket = -1
    var j = start
    while (j < text.length) {
        when (text[j]) {
            '[' -> depth++
            ']' -> {
                depth--
                if (depth == 0) {
                    closeBracket = j
                    break
                }
            }
        }
        j++
    }
    if (closeBracket == -1) return null

    // Must be immediately followed by (
    if (closeBracket + 1 >= text.length || text[closeBracket + 1] != '(') return null

    // Find closing )
    val closeParen = text.indexOf(')', closeBracket + 2)
    if (closeParen == -1) return null

    val linkText = text.substring(start + 1, closeBracket)
    val url = text.substring(closeBracket + 2, closeParen)

    if (linkText.isEmpty() || url.isEmpty()) return null

    return Triple(linkText, url, closeParen + 1)
}

/**
 * Find the closing two-character delimiter (**, __, ~~) starting from [start].
 * Skips over code spans to avoid false matches inside backticks.
 */
private fun findClosing(text: String, start: Int, delimiter: String): Int {
    var i = start
    while (i < text.length) {
        // Skip code spans
        if (text[i] == '`') {
            val codeEnd = text.indexOf('`', i + 1)
            if (codeEnd != -1) {
                i = codeEnd + 1
                continue
            }
        }
        if (i + 1 < text.length && text.substring(i, i + 2) == delimiter) {
            return i
        }
        i++
    }
    return -1
}

/**
 * Find the closing single-character delimiter (* or _) starting from [start].
 * Ensures the found delimiter is not part of a double delimiter (** or __).
 * Skips over code spans.
 */
private fun findClosingSingle(text: String, start: Int, delimiter: Char): Int {
    var i = start
    while (i < text.length) {
        // Skip code spans
        if (text[i] == '`') {
            val codeEnd = text.indexOf('`', i + 1)
            if (codeEnd != -1) {
                i = codeEnd + 1
                continue
            }
        }
        if (text[i] == delimiter) {
            // Make sure it's not part of a double delimiter
            val isDouble = (i + 1 < text.length && text[i + 1] == delimiter)
            if (!isDouble) {
                return i
            }
            // Skip the double delimiter
            i += 2
            continue
        }
        i++
    }
    return -1
}
