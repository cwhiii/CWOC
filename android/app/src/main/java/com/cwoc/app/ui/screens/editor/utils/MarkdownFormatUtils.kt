package com.cwoc.app.ui.screens.editor.utils

import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue

/**
 * Shared markdown formatting utilities used by both NotesZone and EmailComposeZone.
 * Each function takes a TextFieldValue (text + selection) and returns a new TextFieldValue
 * with the formatting applied and cursor/selection updated appropriately.
 *
 * These are pure functions — they do not manage undo stacks or trigger callbacks.
 * The caller is responsible for pushing undo state before calling and propagating
 * the result to the appropriate state holder.
 */
object MarkdownFormatUtils {

    /**
     * Wrap formatting (bold, italic, strikethrough, inline code).
     * If no selection, inserts delimiter pair at cursor with cursor between them.
     * If selection exists, wraps selected text with delimiters and selects the result.
     */
    fun applyWrapFormat(textFieldValue: TextFieldValue, delimiter: String): TextFieldValue {
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        val text = textFieldValue.text

        return if (start == end) {
            // No selection — insert delimiter pair at cursor
            val before = text.substring(0, start)
            val after = text.substring(start)
            val newText = "$before$delimiter$delimiter$after"
            val cursorPos = start + delimiter.length
            TextFieldValue(text = newText, selection = TextRange(cursorPos))
        } else {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val newText = "$before$delimiter$selected$delimiter$after"
            val newEnd = start + delimiter.length + selected.length + delimiter.length
            TextFieldValue(text = newText, selection = TextRange(start, newEnd))
        }
    }

    /**
     * Link formatting.
     * If no selection, inserts [text](url) template at cursor with "text" selected.
     * If selection is a URL (starts with http:// or https://), wraps as [link text](selection)
     * with "link text" selected.
     * If selection is regular text, wraps as [selection](url) with "url" selected.
     */
    fun applyLinkFormat(textFieldValue: TextFieldValue): TextFieldValue {
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        val text = textFieldValue.text

        return if (start == end) {
            // No selection — insert template at cursor
            val before = text.substring(0, start)
            val after = text.substring(start)
            val newText = "${before}[text](url)$after"
            TextFieldValue(text = newText, selection = TextRange(start + 1, start + 5))
        } else {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val isUrl = selected.trim().let { it.startsWith("http://") || it.startsWith("https://") }

            if (isUrl) {
                val newText = "${before}[link text](${selected.trim()})$after"
                val newSel = TextRange(start + 1, start + 1 + "link text".length)
                TextFieldValue(text = newText, selection = newSel)
            } else {
                val newText = "${before}[$selected](url)$after"
                val urlPos = start + 1 + selected.length + 2
                val newSel = TextRange(urlPos, urlPos + 3)
                TextFieldValue(text = newText, selection = newSel)
            }
        }
    }

    /**
     * Heading formatting: strips any existing heading prefix from the current line,
     * then applies the specified heading level (1-3).
     * Works on the line containing the cursor. Selects the resulting line.
     * Returns the original TextFieldValue unchanged if the line is blank and there's no selection.
     */
    fun applyHeadingFormat(textFieldValue: TextFieldValue, level: Int): TextFieldValue {
        val text = textFieldValue.text
        val cursorPos = textFieldValue.selection.min
        val lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
        val lineEnd = text.indexOf('\n', cursorPos).let { if (it == -1) text.length else it }
        val lineText = text.substring(lineStart, lineEnd)

        if (lineText.isBlank() && textFieldValue.selection.min == textFieldValue.selection.max) {
            return textFieldValue
        }

        val stripped = lineText.replace(Regex("^#{1,3}\\s+"), "")
        val prefix = "#".repeat(level) + " "
        val replacement = prefix + stripped
        val newText = text.substring(0, lineStart) + replacement + text.substring(lineEnd)
        return TextFieldValue(text = newText, selection = TextRange(lineStart, lineStart + replacement.length))
    }

    /**
     * Line prefix formatting (bullet list, numbered list).
     * If selection spans multiple lines, prefixes each line.
     * If no selection, prefixes the current line.
     *
     * @param prefix The prefix to apply (e.g. "- " for bullets)
     * @param numbered If true, uses "1. ", "2. ", etc. instead of the prefix parameter
     */
    fun applyLinePrefixFormat(
        textFieldValue: TextFieldValue,
        prefix: String,
        numbered: Boolean = false
    ): TextFieldValue {
        val text = textFieldValue.text
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max

        return if (start != end) {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val prefixed = if (numbered) {
                selected.split('\n').mapIndexed { i, l -> "${i + 1}. $l" }.joinToString("\n")
            } else {
                selected.split('\n').joinToString("\n") { "$prefix$it" }
            }
            val newText = "$before$prefixed$after"
            TextFieldValue(text = newText, selection = TextRange(start, start + prefixed.length))
        } else {
            val lineStart = text.lastIndexOf('\n', start - 1) + 1
            val lineEnd = text.indexOf('\n', start).let { if (it == -1) text.length else it }
            val lineText = text.substring(lineStart, lineEnd)
            val actualPrefix = if (numbered) "1. " else prefix
            val replacement = actualPrefix + lineText
            val newText = text.substring(0, lineStart) + replacement + text.substring(lineEnd)
            val newCursor = lineStart + replacement.length
            TextFieldValue(text = newText, selection = TextRange(newCursor))
        }
    }

    /**
     * Blockquote formatting: prefixes selected lines with "> ".
     * If no selection, prefixes the current line.
     * If selection spans multiple lines, prefixes each line.
     */
    fun applyBlockquoteFormat(textFieldValue: TextFieldValue): TextFieldValue {
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        val text = textFieldValue.text

        return if (start == end) {
            // No selection — prefix current line
            val lineStart = text.lastIndexOf('\n', start - 1) + 1
            val lineEnd = text.indexOf('\n', start).let { if (it == -1) text.length else it }
            val lineText = text.substring(lineStart, lineEnd)
            val replacement = "> $lineText"
            val newText = text.substring(0, lineStart) + replacement + text.substring(lineEnd)
            val newCursor = lineStart + replacement.length
            TextFieldValue(text = newText, selection = TextRange(newCursor))
        } else {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val quoted = selected.split('\n').joinToString("\n") { "> $it" }
            val newText = "$before$quoted$after"
            TextFieldValue(text = newText, selection = TextRange(start, start + quoted.length))
        }
    }

    /**
     * Horizontal rule: inserts "\n---\n" at the current cursor position.
     * Cursor is placed after the inserted rule.
     */
    fun applyHorizontalRule(textFieldValue: TextFieldValue): TextFieldValue {
        val text = textFieldValue.text
        val cursorPos = textFieldValue.selection.min
        val insertion = "\n---\n"
        val newText = text.substring(0, cursorPos) + insertion + text.substring(cursorPos)
        val newCursor = cursorPos + insertion.length
        return TextFieldValue(text = newText, selection = TextRange(newCursor))
    }
}
