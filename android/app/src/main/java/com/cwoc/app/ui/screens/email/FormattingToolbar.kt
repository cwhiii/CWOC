package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.HorizontalRule
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.StrikethroughS
import androidx.compose.material.icons.filled.Title
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.email.TextSelection

/**
 * Markdown formatting toolbar for the email compose body.
 *
 * Displays horizontally scrollable buttons for: Bold, Italic, Strikethrough,
 * Link, Heading (H1/H2/H3 dropdown), Bullet List, Numbered List, Blockquote,
 * Inline Code, and Horizontal Rule.
 *
 * Each button delegates to MarkdownFormatter via EmailComposeViewModel.applyFormatting().
 * Keyboard shortcuts are wired via Modifier.onKeyEvent for physical keyboard support.
 *
 * Validates: Requirements 38.1-38.12, 39.1-39.8
 */
@Composable
fun FormattingToolbar(
    selection: TextSelection,
    onFormatting: (FormattingOperation) -> Unit,
    onLinkRequested: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showHeadingDropdown by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .horizontalScroll(rememberScrollState())
            .onKeyEvent { keyEvent ->
                if (keyEvent.type == KeyEventType.KeyDown && keyEvent.isCtrlPressed) {
                    when {
                        // Ctrl+B → Bold (Requirement 39.1)
                        !keyEvent.isShiftPressed && keyEvent.key == Key.B -> {
                            onFormatting(FormattingOperation.BOLD)
                            true
                        }
                        // Ctrl+I → Italic (Requirement 39.2)
                        !keyEvent.isShiftPressed && keyEvent.key == Key.I -> {
                            onFormatting(FormattingOperation.ITALIC)
                            true
                        }
                        // Ctrl+K → Link (Requirement 39.3)
                        !keyEvent.isShiftPressed && keyEvent.key == Key.K -> {
                            onLinkRequested()
                            true
                        }
                        // Ctrl+E → Inline Code (Requirement 39.4)
                        !keyEvent.isShiftPressed && keyEvent.key == Key.E -> {
                            onFormatting(FormattingOperation.INLINE_CODE)
                            true
                        }
                        // Ctrl+Shift+X → Strikethrough (Requirement 39.5)
                        keyEvent.isShiftPressed && keyEvent.key == Key.X -> {
                            onFormatting(FormattingOperation.STRIKETHROUGH)
                            true
                        }
                        // Ctrl+Shift+8 → Bullet List (Requirement 39.6)
                        keyEvent.isShiftPressed && keyEvent.key == Key.Eight -> {
                            onFormatting(FormattingOperation.BULLET_LIST)
                            true
                        }
                        // Ctrl+Shift+7 → Numbered List (Requirement 39.7)
                        keyEvent.isShiftPressed && keyEvent.key == Key.Seven -> {
                            onFormatting(FormattingOperation.NUMBERED_LIST)
                            true
                        }
                        // Ctrl+Shift+. → Blockquote (Requirement 39.8)
                        keyEvent.isShiftPressed && keyEvent.key == Key.Period -> {
                            onFormatting(FormattingOperation.BLOCKQUOTE)
                            true
                        }
                        else -> false
                    }
                } else {
                    false
                }
            }
    ) {
        // Bold (Requirement 38.3)
        IconButton(onClick = { onFormatting(FormattingOperation.BOLD) }) {
            Icon(
                imageVector = Icons.Filled.FormatBold,
                contentDescription = "Bold (Ctrl+B)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Italic (Requirement 38.4)
        IconButton(onClick = { onFormatting(FormattingOperation.ITALIC) }) {
            Icon(
                imageVector = Icons.Filled.FormatItalic,
                contentDescription = "Italic (Ctrl+I)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Strikethrough (Requirement 38.5)
        IconButton(onClick = { onFormatting(FormattingOperation.STRIKETHROUGH) }) {
            Icon(
                imageVector = Icons.Filled.StrikethroughS,
                contentDescription = "Strikethrough (Ctrl+Shift+X)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Link (Requirement 38.6)
        IconButton(onClick = { onLinkRequested() }) {
            Icon(
                imageVector = Icons.Filled.Link,
                contentDescription = "Link (Ctrl+K)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Heading with H1/H2/H3 dropdown (Requirement 38.7)
        IconButton(onClick = { showHeadingDropdown = true }) {
            Icon(
                imageVector = Icons.Filled.Title,
                contentDescription = "Heading",
                modifier = Modifier.size(24.dp)
            )
        }
        DropdownMenu(
            expanded = showHeadingDropdown,
            onDismissRequest = { showHeadingDropdown = false }
        ) {
            DropdownMenuItem(
                text = { Text("H1") },
                onClick = {
                    onFormatting(FormattingOperation.HEADING_1)
                    showHeadingDropdown = false
                }
            )
            DropdownMenuItem(
                text = { Text("H2") },
                onClick = {
                    onFormatting(FormattingOperation.HEADING_2)
                    showHeadingDropdown = false
                }
            )
            DropdownMenuItem(
                text = { Text("H3") },
                onClick = {
                    onFormatting(FormattingOperation.HEADING_3)
                    showHeadingDropdown = false
                }
            )
        }

        // Bullet List (Requirement 38.8)
        IconButton(onClick = { onFormatting(FormattingOperation.BULLET_LIST) }) {
            Icon(
                imageVector = Icons.Filled.FormatListBulleted,
                contentDescription = "Bullet List (Ctrl+Shift+8)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Numbered List (Requirement 38.9)
        IconButton(onClick = { onFormatting(FormattingOperation.NUMBERED_LIST) }) {
            Icon(
                imageVector = Icons.Filled.FormatListNumbered,
                contentDescription = "Numbered List (Ctrl+Shift+7)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Blockquote (Requirement 38.10)
        IconButton(onClick = { onFormatting(FormattingOperation.BLOCKQUOTE) }) {
            Icon(
                imageVector = Icons.Filled.FormatQuote,
                contentDescription = "Blockquote (Ctrl+Shift+.)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Inline Code (Requirement 38.11)
        IconButton(onClick = { onFormatting(FormattingOperation.INLINE_CODE) }) {
            Icon(
                imageVector = Icons.Filled.Code,
                contentDescription = "Inline Code (Ctrl+E)",
                modifier = Modifier.size(24.dp)
            )
        }

        // Horizontal Rule (Requirement 38.12)
        IconButton(onClick = { onFormatting(FormattingOperation.HORIZONTAL_RULE) }) {
            Icon(
                imageVector = Icons.Filled.HorizontalRule,
                contentDescription = "Horizontal Rule",
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
