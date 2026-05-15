package com.cwoc.app.ui.util

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.sp

/**
 * Simple Compose-compatible markdown text renderer.
 * Supports headings, bold, italic, inline code, code blocks, and unordered lists.
 * Uses AnnotatedString with SpanStyle for basic formatting.
 */
object MarkdownRenderer {

    /**
     * Render a markdown string into an AnnotatedString with basic formatting.
     * Handles: # headings, **bold**, *italic*, `inline code`, - list items, ``` code blocks.
     */
    fun renderToAnnotatedString(markdown: String): AnnotatedString {
        return buildAnnotatedString {
            val lines = markdown.lines()
            var inCodeBlock = false
            var isFirstLine = true

            for (line in lines) {
                if (!isFirstLine) {
                    append("\n")
                }
                isFirstLine = false

                // Code block toggle
                if (line.trimStart().startsWith("```")) {
                    inCodeBlock = !inCodeBlock
                    continue
                }

                if (inCodeBlock) {
                    withStyle(SpanStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp)) {
                        append(line)
                    }
                    continue
                }

                // Headings
                when {
                    line.startsWith("### ") -> {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = 15.sp)) {
                            appendInlineFormatted(line.removePrefix("### "))
                        }
                    }
                    line.startsWith("## ") -> {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = 17.sp)) {
                            appendInlineFormatted(line.removePrefix("## "))
                        }
                    }
                    line.startsWith("# ") -> {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = 20.sp)) {
                            appendInlineFormatted(line.removePrefix("# "))
                        }
                    }
                    // Unordered list items
                    line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ") -> {
                        val indent = line.length - line.trimStart().length
                        val content = line.trimStart().drop(2)
                        append("  ".repeat(indent / 2))
                        append("• ")
                        appendInlineFormatted(content)
                    }
                    // Regular text
                    else -> {
                        appendInlineFormatted(line)
                    }
                }
            }
        }
    }

    /**
     * Parse inline formatting: **bold**, *italic*, `code`.
     */
    private fun AnnotatedString.Builder.appendInlineFormatted(text: String) {
        var i = 0
        while (i < text.length) {
            when {
                // Bold: **text**
                text.startsWith("**", i) -> {
                    val end = text.indexOf("**", i + 2)
                    if (end != -1) {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                            append(text.substring(i + 2, end))
                        }
                        i = end + 2
                    } else {
                        append(text[i])
                        i++
                    }
                }
                // Italic: *text*
                text.startsWith("*", i) && !text.startsWith("**", i) -> {
                    val end = text.indexOf("*", i + 1)
                    if (end != -1) {
                        withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                            append(text.substring(i + 1, end))
                        }
                        i = end + 1
                    } else {
                        append(text[i])
                        i++
                    }
                }
                // Inline code: `text`
                text.startsWith("`", i) -> {
                    val end = text.indexOf("`", i + 1)
                    if (end != -1) {
                        withStyle(SpanStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp)) {
                            append(text.substring(i + 1, end))
                        }
                        i = end + 1
                    } else {
                        append(text[i])
                        i++
                    }
                }
                else -> {
                    append(text[i])
                    i++
                }
            }
        }
    }
}
