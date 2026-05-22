package com.cwoc.app.domain.checklist

import java.util.UUID

/**
 * Clipboard operations for the checklist zone.
 * Handles parsing clipboard text into checklist items and formatting items for clipboard.
 *
 * Parsing logic:
 * - Splits text by newline
 * - Detects indent: tabs or 4-space blocks (2-space as fallback)
 * - Detects markdown checklist format: - [x], - [ ], * [x], * [ ]
 * - Strips list markers (-, *, •, numbered)
 * - Builds items with id, text, level, checked
 * - Assigns parents based on indent levels
 */
object ChecklistClipboard {

    /**
     * Parse clipboard/note text into checklist items.
     * Recognizes:
     * - Markdown checkboxes: `- [ ] text`, `- [x] text`, `* [ ] text`, `* [x] text`
     * - List markers: `- text`, `* text`, `• text`, `1. text`, `1) text`
     * - Indentation: 4 spaces or 1 tab = 1 level, 2 spaces = 1 level
     *
     * @param text Raw clipboard text to parse
     * @return List of ChecklistItemV2 with parent relationships assigned
     */
    fun parseClipboardText(text: String): List<ChecklistItemV2> {
        if (text.isBlank()) return emptyList()

        val lines = text.split("\n")
        val items = mutableListOf<ChecklistItemV2>()

        for (line in lines) {
            if (line.isBlank()) continue

            // Detect indent level
            var indent = 0
            var stripped = line
            while (stripped.startsWith("    ") || stripped.startsWith("\t")) {
                indent++
                stripped = if (stripped.startsWith("\t")) stripped.substring(1) else stripped.substring(4)
            }
            // 2-space indent as a single level
            if (stripped.startsWith("  ")) {
                indent++
                stripped = stripped.substring(2)
            }

            // Detect markdown checklist format: - [x] or - [ ] or * [x] or * [ ]
            var isChecked = false
            val mdChecklistRegex = Regex("^[-*]\\s+\\[([ xX])\\]\\s*")
            val mdMatch = mdChecklistRegex.find(stripped)
            if (mdMatch != null) {
                isChecked = mdMatch.groupValues[1].lowercase() == "x"
                stripped = stripped.removeRange(mdMatch.range)
            } else {
                // Strip list markers
                stripped = stripped.replace(Regex("^[-*•]\\s+"), "")
                stripped = stripped.replace(Regex("^\\d+[.)]\\s+"), "")
                // Check for standalone [x] or [ ] at start (legacy format)
                val legacyRegex = Regex("^\\[([ xX])\\]\\s*")
                val legacyMatch = legacyRegex.find(stripped)
                if (legacyMatch != null) {
                    isChecked = legacyMatch.groupValues[1].lowercase() == "x"
                    stripped = stripped.removeRange(legacyMatch.range)
                }
            }

            if (stripped.isBlank()) continue

            items.add(
                ChecklistItemV2(
                    id = UUID.randomUUID().toString(),
                    text = stripped.trim(),
                    level = indent.coerceAtMost(ChecklistOperationsV2.MAX_INDENT_LEVEL),
                    checked = isChecked,
                    parent = null
                )
            )
        }

        // Assign parents based on indent levels
        for (i in 1 until items.size) {
            if (items[i].level > 0) {
                for (j in (i - 1) downTo 0) {
                    if (items[j].level == items[i].level - 1) {
                        items[i] = items[i].copy(parent = items[j].id)
                        break
                    }
                }
            }
        }

        return items
    }

    /**
     * Format unchecked items as markdown checklist for clipboard copy.
     * Format: `"  ".repeat(level) + "- [ ] " + text`, joined with newlines.
     *
     * @param items All checklist items (will be filtered to unchecked only)
     * @return Formatted markdown string, or null if no unchecked items
     */
    fun copyIncompleteToClipboard(items: List<ChecklistItemV2>): String? {
        val unchecked = items.filter { !it.checked }
        if (unchecked.isEmpty()) return null
        return unchecked.joinToString("\n") { item ->
            "${"  ".repeat(item.level)}- [ ] ${item.text}"
        }
    }
}
