package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A custom Compose markdown renderer that parses markdown text line-by-line
 * and renders it using Compose primitives. No external markdown library needed.
 *
 * Supports: headings (H1-H6), bold, italic, links, unordered/ordered lists,
 * code blocks, inline code, blockquotes, and image alt text placeholders.
 */
@Composable
fun MarkdownRenderer(
    markdown: String,
    modifier: Modifier = Modifier
) {
    val blocks = remember(markdown) { parseMarkdownBlocks(markdown) }
    val uriHandler = LocalUriHandler.current

    Column(modifier = modifier.fillMaxWidth()) {
        blocks.forEach { block ->
            when (block) {
                is MarkdownBlock.Heading -> {
                    val style = headingStyle(block.level)
                    val annotated = parseInlineFormatting(block.text)
                    ClickableText(
                        text = annotated,
                        style = style,
                        modifier = Modifier.padding(bottom = 4.dp, top = if (block.level <= 2) 12.dp else 8.dp),
                        onClick = { offset ->
                            handleLinkClick(annotated, offset, uriHandler)
                        }
                    )
                }

                is MarkdownBlock.Paragraph -> {
                    val annotated = parseInlineFormatting(block.text)
                    ClickableText(
                        text = annotated,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(bottom = 8.dp),
                        onClick = { offset ->
                            handleLinkClick(annotated, offset, uriHandler)
                        }
                    )
                }

                is MarkdownBlock.UnorderedListItem -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = (block.indent * 16).dp, bottom = 4.dp)
                    ) {
                        Text(
                            text = "•",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(end = 8.dp)
                        )
                        val annotated = parseInlineFormatting(block.text)
                        ClickableText(
                            text = annotated,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.weight(1f),
                            onClick = { offset ->
                                handleLinkClick(annotated, offset, uriHandler)
                            }
                        )
                    }
                }

                is MarkdownBlock.OrderedListItem -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = (block.indent * 16).dp, bottom = 4.dp)
                    ) {
                        Text(
                            text = "${block.number}.",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(end = 8.dp)
                        )
                        val annotated = parseInlineFormatting(block.text)
                        ClickableText(
                            text = annotated,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.weight(1f),
                            onClick = { offset ->
                                handleLinkClick(annotated, offset, uriHandler)
                            }
                        )
                    }
                }

                is MarkdownBlock.CodeBlock -> {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        tonalElevation = 1.dp
                    ) {
                        Text(
                            text = block.code,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = FontFamily.Monospace,
                                fontSize = 13.sp
                            ),
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                is MarkdownBlock.Blockquote -> {
                    val borderColor = MaterialTheme.colorScheme.outline
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .drawBehind {
                                drawLine(
                                    color = borderColor,
                                    start = Offset(0f, 0f),
                                    end = Offset(0f, size.height),
                                    strokeWidth = 3.dp.toPx()
                                )
                            }
                            .padding(start = 12.dp)
                    ) {
                        val annotated = parseInlineFormatting(block.text)
                        ClickableText(
                            text = annotated,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontStyle = FontStyle.Italic,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            ),
                            onClick = { offset ->
                                handleLinkClick(annotated, offset, uriHandler)
                            }
                        )
                    }
                }

                is MarkdownBlock.Image -> {
                    // No Coil dependency — show alt text as placeholder
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Text(
                            text = "🖼 ${block.altText.ifEmpty { "Image" }}",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontStyle = FontStyle.Italic,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            ),
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                is MarkdownBlock.HorizontalRule -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .height(1.dp)
                            .background(MaterialTheme.colorScheme.outlineVariant)
                    )
                }

                is MarkdownBlock.BlankLine -> {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

// --- Block-level parsing ---

private sealed class MarkdownBlock {
    data class Heading(val level: Int, val text: String) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
    data class UnorderedListItem(val text: String, val indent: Int) : MarkdownBlock()
    data class OrderedListItem(val text: String, val number: Int, val indent: Int) : MarkdownBlock()
    data class CodeBlock(val code: String) : MarkdownBlock()
    data class Blockquote(val text: String) : MarkdownBlock()
    data class Image(val altText: String, val url: String) : MarkdownBlock()
    data object HorizontalRule : MarkdownBlock()
    data object BlankLine : MarkdownBlock()
}

private val headingRegex = Regex("""^(#{1,6})\s+(.+)$""")
private val unorderedListRegex = Regex("""^(\s*)[-*+]\s+(.+)$""")
private val orderedListRegex = Regex("""^(\s*)(\d+)\.\s+(.+)$""")
private val blockquoteRegex = Regex("""^>\s?(.*)$""")
private val imageLineRegex = Regex("""^!\[([^\]]*)]\(([^)]+)\)\s*$""")
private val horizontalRuleRegex = Regex("""^(---+|\*\*\*+|___+)\s*$""")
private val codeBlockFenceRegex = Regex("""^```.*$""")

private fun parseMarkdownBlocks(markdown: String): List<MarkdownBlock> {
    val lines = markdown.lines()
    val blocks = mutableListOf<MarkdownBlock>()
    var i = 0

    while (i < lines.size) {
        val line = lines[i]

        // Code block (fenced)
        if (codeBlockFenceRegex.matches(line)) {
            i++
            val codeLines = mutableListOf<String>()
            while (i < lines.size && !codeBlockFenceRegex.matches(lines[i])) {
                codeLines.add(lines[i])
                i++
            }
            if (i < lines.size) i++ // skip closing fence
            blocks.add(MarkdownBlock.CodeBlock(codeLines.joinToString("\n")))
            continue
        }

        // Horizontal rule
        if (horizontalRuleRegex.matches(line)) {
            blocks.add(MarkdownBlock.HorizontalRule)
            i++
            continue
        }

        // Heading
        val headingMatch = headingRegex.matchEntire(line)
        if (headingMatch != null) {
            val level = headingMatch.groupValues[1].length
            val text = headingMatch.groupValues[2]
            blocks.add(MarkdownBlock.Heading(level, text))
            i++
            continue
        }

        // Image (standalone line)
        val imageMatch = imageLineRegex.matchEntire(line)
        if (imageMatch != null) {
            blocks.add(MarkdownBlock.Image(imageMatch.groupValues[1], imageMatch.groupValues[2]))
            i++
            continue
        }

        // Blockquote
        val blockquoteMatch = blockquoteRegex.matchEntire(line)
        if (blockquoteMatch != null) {
            // Collect consecutive blockquote lines
            val quoteLines = mutableListOf<String>()
            while (i < lines.size) {
                val qm = blockquoteRegex.matchEntire(lines[i])
                if (qm != null) {
                    quoteLines.add(qm.groupValues[1])
                    i++
                } else {
                    break
                }
            }
            blocks.add(MarkdownBlock.Blockquote(quoteLines.joinToString(" ")))
            continue
        }

        // Unordered list
        val ulMatch = unorderedListRegex.matchEntire(line)
        if (ulMatch != null) {
            val indent = ulMatch.groupValues[1].length / 2
            blocks.add(MarkdownBlock.UnorderedListItem(ulMatch.groupValues[2], indent))
            i++
            continue
        }

        // Ordered list
        val olMatch = orderedListRegex.matchEntire(line)
        if (olMatch != null) {
            val indent = olMatch.groupValues[1].length / 2
            val number = olMatch.groupValues[2].toIntOrNull() ?: 1
            blocks.add(MarkdownBlock.OrderedListItem(olMatch.groupValues[3], number, indent))
            i++
            continue
        }

        // Blank line
        if (line.isBlank()) {
            blocks.add(MarkdownBlock.BlankLine)
            i++
            continue
        }

        // Paragraph — collect consecutive non-blank, non-special lines
        val paraLines = mutableListOf<String>()
        while (i < lines.size && lines[i].isNotBlank()
            && !headingRegex.matches(lines[i])
            && !codeBlockFenceRegex.matches(lines[i])
            && !blockquoteRegex.matches(lines[i])
            && !unorderedListRegex.matches(lines[i])
            && !orderedListRegex.matches(lines[i])
            && !imageLineRegex.matches(lines[i])
            && !horizontalRuleRegex.matches(lines[i])
        ) {
            paraLines.add(lines[i])
            i++
        }
        if (paraLines.isNotEmpty()) {
            blocks.add(MarkdownBlock.Paragraph(paraLines.joinToString(" ")))
        }
    }

    return blocks
}

// --- Inline formatting parsing ---

private val inlineCodeRegex = Regex("""`([^`]+)`""")
private val boldItalicRegex = Regex("""\*\*\*(.+?)\*\*\*|___(.+?)___""")
private val boldRegex = Regex("""\*\*(.+?)\*\*|__(.+?)__""")
private val italicRegex = Regex("""\*(.+?)\*|_(.+?)_""")
private val linkRegex = Regex("""\[([^\]]+)]\(([^)]+)\)""")
private val imageInlineRegex = Regex("""!\[([^\]]*)]\(([^)]+)\)""")

private fun parseInlineFormatting(text: String): AnnotatedString {
    return buildAnnotatedString {
        var remaining = text
        while (remaining.isNotEmpty()) {
            // Find the earliest match among all inline patterns
            data class MatchInfo(val match: MatchResult, val type: String)

            val candidates = listOfNotNull(
                inlineCodeRegex.find(remaining)?.let { MatchInfo(it, "code") },
                imageInlineRegex.find(remaining)?.let { MatchInfo(it, "image") },
                boldItalicRegex.find(remaining)?.let { MatchInfo(it, "bolditalic") },
                boldRegex.find(remaining)?.let { MatchInfo(it, "bold") },
                italicRegex.find(remaining)?.let { MatchInfo(it, "italic") },
                linkRegex.find(remaining)?.let { MatchInfo(it, "link") }
            )

            val earliest = candidates.minByOrNull { it.match.range.first }

            if (earliest == null) {
                // No more inline formatting — append rest as plain text
                append(remaining)
                break
            }

            val match = earliest.match

            // Append text before the match as plain
            if (match.range.first > 0) {
                append(remaining.substring(0, match.range.first))
            }

            when (earliest.type) {
                "code" -> {
                    val codeText = match.groupValues[1]
                    withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color(0xFFEDE0D4), // CwocSurfaceVariant
                            fontSize = 13.sp
                        )
                    ) {
                        append(" $codeText ")
                    }
                }

                "image" -> {
                    val altText = match.groupValues[1]
                    withStyle(
                        SpanStyle(
                            fontStyle = FontStyle.Italic,
                            color = Color(0xFF5C4A3A) // CwocOnSurfaceVariant
                        )
                    ) {
                        append("🖼 ${altText.ifEmpty { "Image" }}")
                    }
                }

                "bolditalic" -> {
                    val content = match.groupValues[1].ifEmpty { match.groupValues[2] }
                    withStyle(
                        SpanStyle(
                            fontWeight = FontWeight.Bold,
                            fontStyle = FontStyle.Italic
                        )
                    ) {
                        append(content)
                    }
                }

                "bold" -> {
                    val content = match.groupValues[1].ifEmpty { match.groupValues[2] }
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(content)
                    }
                }

                "italic" -> {
                    val content = match.groupValues[1].ifEmpty { match.groupValues[2] }
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(content)
                    }
                }

                "link" -> {
                    val linkText = match.groupValues[1]
                    val url = match.groupValues[2]
                    pushStringAnnotation(tag = "URL", annotation = url)
                    withStyle(
                        SpanStyle(
                            color = Color(0xFF6B4E31), // CwocPrimary
                            textDecoration = TextDecoration.Underline
                        )
                    ) {
                        append(linkText)
                    }
                    pop()
                }
            }

            remaining = remaining.substring(match.range.last + 1)
        }
    }
}

// --- Heading style helper ---

@Composable
private fun headingStyle(level: Int): TextStyle {
    return when (level) {
        1 -> MaterialTheme.typography.headlineLarge
        2 -> MaterialTheme.typography.headlineMedium
        3 -> MaterialTheme.typography.headlineSmall
        4 -> MaterialTheme.typography.titleLarge
        5 -> MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
        6 -> MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
        else -> MaterialTheme.typography.titleSmall
    }
}

// --- Link click handler ---

private fun handleLinkClick(
    annotated: AnnotatedString,
    offset: Int,
    uriHandler: androidx.compose.ui.platform.UriHandler
) {
    annotated.getStringAnnotations(tag = "URL", start = offset, end = offset)
        .firstOrNull()?.let { annotation ->
            try {
                uriHandler.openUri(annotation.item)
            } catch (_: Exception) {
                // Silently ignore if URI can't be opened
            }
        }
}
