package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)

// ─── Signature Editor Modal ─────────────────────────────────────────────────────

/**
 * Full-screen modal for editing the email signature with markdown and live preview.
 *
 * Layout is split vertically:
 * - Top half: OutlinedTextField (multiline, 8+ lines) for editing markdown signature
 * - Bottom half: Live-rendered markdown preview with 500ms debounce
 *
 * Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K) apply bold, italic, and link
 * formatting to the selected text.
 *
 * Done button: calls [onDone] with the current signature text (caller should
 * call updateSignature + saveSignature on the ViewModel).
 * Cancel button: dismisses without saving.
 *
 * Validates: Requirements 61.1-61.7
 *
 * @param currentSignature The current signature markdown text to pre-populate the editor
 * @param onDone Called with the edited signature text when the user taps Done
 * @param onDismiss Called when the user taps Cancel or presses back
 */
@Composable
fun SignatureEditorModal(
    currentSignature: String,
    onDone: (String) -> Unit,
    onDismiss: () -> Unit
) {
    // Local editing state using TextFieldValue for selection tracking
    var textFieldValue by remember {
        mutableStateOf(
            TextFieldValue(
                text = currentSignature,
                selection = TextRange(currentSignature.length)
            )
        )
    }

    // Debounced preview text (500ms delay per Requirement 61.4)
    var renderedPreview by remember { mutableStateOf(currentSignature) }

    LaunchedEffect(textFieldValue.text) {
        delay(500L)
        renderedPreview = textFieldValue.text
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // ─── Header ─────────────────────────────────────────────────────

                Text(
                    text = "Edit Signature",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = ParchmentBrown
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Use markdown formatting. Ctrl+B bold, Ctrl+I italic, Ctrl+K link.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(12.dp))

                // ─── Markdown Editor (Top Half) ─────────────────────────────────

                OutlinedTextField(
                    value = textFieldValue,
                    onValueChange = { textFieldValue = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .onKeyEvent { keyEvent ->
                            if (keyEvent.type == KeyEventType.KeyDown && keyEvent.isCtrlPressed) {
                                when (keyEvent.key) {
                                    Key.B -> {
                                        textFieldValue = applyMarkdownWrap(textFieldValue, "**")
                                        true
                                    }
                                    Key.I -> {
                                        textFieldValue = applyMarkdownWrap(textFieldValue, "_")
                                        true
                                    }
                                    Key.K -> {
                                        textFieldValue = applyMarkdownLink(textFieldValue)
                                        true
                                    }
                                    else -> false
                                }
                            } else {
                                false
                            }
                        },
                    label = { Text("Signature (Markdown)") },
                    placeholder = { Text("Enter your email signature...") },
                    minLines = 8,
                    maxLines = Int.MAX_VALUE,
                    textStyle = MaterialTheme.typography.bodyMedium
                )

                Spacer(modifier = Modifier.height(8.dp))

                // ─── Divider ────────────────────────────────────────────────────

                HorizontalDivider(color = ParchmentBrown.copy(alpha = 0.3f))

                Spacer(modifier = Modifier.height(8.dp))

                // ─── Preview Label ──────────────────────────────────────────────

                Text(
                    text = "Preview",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(4.dp))

                // ─── Live Markdown Preview (Bottom Half) ────────────────────────

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                    tonalElevation = 1.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        if (renderedPreview.isBlank()) {
                            Text(
                                text = "Preview will appear here...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        } else {
                            SignatureMarkdownPreview(markdownText = renderedPreview)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // ─── Action Buttons ─────────────────────────────────────────────

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = ParchmentBrown)
                    }
                    TextButton(
                        onClick = { onDone(textFieldValue.text) }
                    ) {
                        Text("Done", color = ParchmentBrown, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ─── Markdown Preview Renderer ──────────────────────────────────────────────────

/**
 * Renders basic markdown text as styled Compose Text elements.
 * Supports: headings (#, ##, ###), bold (**), italic (_), lists (- / *),
 * blockquotes (>), horizontal rules (---), and links [text](url).
 */
@Composable
private fun SignatureMarkdownPreview(markdownText: String) {
    markdownText.lines().forEach { line ->
        val styledLine = when {
            line.startsWith("### ") -> line.removePrefix("### ")
            line.startsWith("## ") -> line.removePrefix("## ")
            line.startsWith("# ") -> line.removePrefix("# ")
            line.startsWith("- ") -> "• ${line.removePrefix("- ")}"
            line.startsWith("* ") -> "• ${line.removePrefix("* ")}"
            line.startsWith("> ") -> "│ ${line.removePrefix("> ")}"
            line.startsWith("---") -> "────────────────"
            line.matches(Regex("^\\d+\\.\\s.*")) -> line // numbered lists pass through
            else -> line
        }

        val fontWeight = when {
            line.startsWith("# ") -> FontWeight.Bold
            line.startsWith("## ") -> FontWeight.Bold
            line.startsWith("### ") -> FontWeight.SemiBold
            else -> FontWeight.Normal
        }

        val textStyle = when {
            line.startsWith("# ") -> MaterialTheme.typography.titleLarge
            line.startsWith("## ") -> MaterialTheme.typography.titleMedium
            line.startsWith("### ") -> MaterialTheme.typography.titleSmall
            line.startsWith("> ") -> MaterialTheme.typography.bodyMedium
            else -> MaterialTheme.typography.bodyMedium
        }

        // Render inline formatting (bold, italic, links)
        val displayText = renderInlineMarkdown(styledLine)

        Text(
            text = displayText,
            style = textStyle,
            fontWeight = fontWeight,
            color = if (line.startsWith("> "))
                MaterialTheme.colorScheme.onSurfaceVariant
            else
                MaterialTheme.colorScheme.onSurface
        )
    }
}

// ─── Inline Markdown Rendering ──────────────────────────────────────────────────

/**
 * Strips inline markdown markers for display purposes.
 * Handles: **bold**, _italic_, [link text](url)
 */
private fun renderInlineMarkdown(text: String): String {
    var result = text
    // Strip bold markers
    result = result.replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
    // Strip italic markers (underscore)
    result = result.replace(Regex("_(.+?)_"), "$1")
    // Strip italic markers (single asterisk, but not bold)
    result = result.replace(Regex("(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)"), "$1")
    // Strip link syntax: [text](url) → text
    result = result.replace(Regex("\\[(.+?)\\]\\(.+?\\)"), "$1")
    // Strip inline code backticks
    result = result.replace(Regex("`(.+?)`"), "$1")
    // Strip strikethrough
    result = result.replace(Regex("~~(.+?)~~"), "$1")
    return result
}

// ─── Keyboard Shortcut Helpers ──────────────────────────────────────────────────

/**
 * Wraps the current selection with the given markdown marker (e.g., "**" for bold, "_" for italic).
 * If no text is selected, inserts the markers at the cursor position.
 */
private fun applyMarkdownWrap(value: TextFieldValue, marker: String): TextFieldValue {
    val text = value.text
    val start = value.selection.min
    val end = value.selection.max

    return if (start == end) {
        // No selection: insert markers and place cursor between them
        val newText = text.substring(0, start) + marker + marker + text.substring(start)
        TextFieldValue(
            text = newText,
            selection = TextRange(start + marker.length)
        )
    } else {
        // Wrap selection with markers
        val selectedText = text.substring(start, end)
        val newText = text.substring(0, start) + marker + selectedText + marker + text.substring(end)
        TextFieldValue(
            text = newText,
            selection = TextRange(start + marker.length, end + marker.length)
        )
    }
}

/**
 * Applies link formatting to the current selection: [selected text](url)
 * If no text is selected, inserts [link text](url) placeholder.
 */
private fun applyMarkdownLink(value: TextFieldValue): TextFieldValue {
    val text = value.text
    val start = value.selection.min
    val end = value.selection.max

    return if (start == end) {
        // No selection: insert placeholder link
        val linkText = "[link text](url)"
        val newText = text.substring(0, start) + linkText + text.substring(start)
        // Select "url" for easy replacement
        val urlStart = start + "[link text](".length
        val urlEnd = urlStart + "url".length
        TextFieldValue(
            text = newText,
            selection = TextRange(urlStart, urlEnd)
        )
    } else {
        // Wrap selection as link text
        val selectedText = text.substring(start, end)
        val linkText = "[$selectedText](url)"
        val newText = text.substring(0, start) + linkText + text.substring(end)
        // Select "url" for easy replacement
        val urlStart = start + "[$selectedText](".length
        val urlEnd = urlStart + "url".length
        TextFieldValue(
            text = newText,
            selection = TextRange(urlStart, urlEnd)
        )
    }
}
