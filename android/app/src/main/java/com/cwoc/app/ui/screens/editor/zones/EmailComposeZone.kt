package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.FormatStrikethrough
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.screens.editor.utils.MarkdownFormatUtils
import com.cwoc.app.ui.screens.email.sanitizeHtml
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocOutline
import com.cwoc.app.ui.theme.CwocInputDefaults
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context

/**
 * Undo state for email body — stores text content and cursor/selection position.
 */
data class EmailUndoState(val text: String, val selection: TextRange)

/**
 * Full Email Compose Zone for the chit editor.
 *
 * Handles three email states:
 * - "draft": Full compose UI with From, To, CC, BCC, Subject, Body, and bottom toolbar
 * - "received": Read-only view with address header, body, and bottom toolbar
 * - "sent": Read-only view with address header, body, and bottom toolbar
 *
 * Layout follows the Notes zone pattern:
 * 1. Address Header (scrollable top section)
 * 2. Body (OutlinedTextField with Modifier.weight(1f) filling remaining space)
 * 3. Bottom Toolbar (pinned with imePadding + navigationBarsPadding)
 *
 * Uses EditorZoneHeader for collapsible zone pattern.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun EmailComposeZone(
    formState: ChitFormState,
    emailAccounts: List<String>,
    contactNames: List<String>,
    onFormUpdate: (ChitFormState) -> Unit,
    onSend: () -> Unit,
    onSendLater: () -> Unit,
    onSendAndArchive: () -> Unit,
    onDiscard: () -> Unit,
    onReply: () -> Unit,
    onForward: () -> Unit,
    onArchive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val emailStatus = formState.emailStatus ?: return
    if (emailStatus != "draft" && emailStatus != "received" && emailStatus != "sent") return

    var isExpanded by remember { mutableStateOf(true) }

    EditorZoneHeader(
        title = when (emailStatus) {
            "draft" -> "✉️ Compose Email"
            "received" -> "✉️ Received Email"
            "sent" -> "✉️ Sent Email"
            else -> "✉️ Email"
        },
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            Text(
                text = emailStatus.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    ) {
        // Three-section layout following Notes zone pattern
        // Use BoxWithConstraints to calculate 40% height cap for address header
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val maxHeaderHeight = maxHeight * 0.4f

            // ── Hoisted email body TextFieldValue state ──
            // This allows both the body section and toolbar to access/modify the text + selection
            val initialBodyText = formState.emailBodyText ?: formState.note
            var bodyTextFieldValue by remember {
                mutableStateOf(TextFieldValue(text = initialBodyText))
            }

            // Track whether the body field is focused
            var isBodyFocused by remember { mutableStateOf(false) }
            val bodyFocusRequester = remember { FocusRequester() }

            // ── Preview/Edit mode state ──
            // For received emails with HTML content, default to preview (HTML view)
            // For drafts, default to edit mode
            val hasHtmlContent = !formState.emailBodyHtml.isNullOrBlank()
            var isPreviewMode by remember {
                mutableStateOf(
                    when (emailStatus) {
                        "received", "sent" -> hasHtmlContent
                        else -> false // draft defaults to edit mode
                    }
                )
            }

            // Determine if formatting should be enabled:
            // Only in draft edit mode AND when body field is focused AND not in preview mode
            val isEditMode = emailStatus == "draft"
            val isFormattingEnabled = isEditMode && isBodyFocused && !isPreviewMode

            // ── Overflow menu state ──
            var showOverflowMenu by remember { mutableStateOf(false) }
            var showDiscardDialog by remember { mutableStateOf(false) }
            var pgpEncryptEnabled by remember { mutableStateOf(false) }
            val context = LocalContext.current

            // Determine if send actions should be disabled (To field empty)
            val isToEmpty = formState.emailTo.isNullOrBlank()

            // ─── Undo/Redo stacks (max 50 entries, oldest discarded first) ──────
            // Preserved across preview/edit mode switches via remember (no keys that change on mode switch)
            val undoStack = remember { mutableListOf<EmailUndoState>() }
            val redoStack = remember { mutableListOf<EmailUndoState>() }
            // Force recomposition when stacks change (MutableList changes don't trigger recomposition)
            var undoStackSize by remember { mutableStateOf(0) }
            var redoStackSize by remember { mutableStateOf(0) }

            // Track last text for debounce/word-boundary detection
            var lastPushedText by remember { mutableStateOf(initialBodyText) }

            // Push current state onto undo stack (max 50, oldest discarded first). Clears redo stack.
            fun pushUndo(text: String, selection: TextRange) {
                // Don't push duplicate states
                if (undoStack.isNotEmpty() && undoStack.last().text == text) return
                undoStack.add(EmailUndoState(text, selection))
                if (undoStack.size > 50) {
                    undoStack.removeAt(0)
                }
                redoStack.clear()
                undoStackSize = undoStack.size
                redoStackSize = 0
                lastPushedText = text
            }

            // Perform undo: pop from undo stack, push current state to redo, restore text + cursor.
            fun performUndo() {
                if (undoStack.isEmpty()) return
                val currentState = EmailUndoState(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                redoStack.add(currentState)
                if (redoStack.size > 50) redoStack.removeAt(0)
                val prev = undoStack.removeLast()
                bodyTextFieldValue = TextFieldValue(text = prev.text, selection = prev.selection)
                onFormUpdate(formState.copy(emailBodyText = prev.text.ifBlank { null }))
                lastPushedText = prev.text
                undoStackSize = undoStack.size
                redoStackSize = redoStack.size
            }

            // Perform redo: pop from redo stack, push current state to undo, restore text + cursor.
            fun performRedo() {
                if (redoStack.isEmpty()) return
                val currentState = EmailUndoState(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                undoStack.add(currentState)
                if (undoStack.size > 50) undoStack.removeAt(0)
                val next = redoStack.removeLast()
                bodyTextFieldValue = TextFieldValue(text = next.text, selection = next.selection)
                onFormUpdate(formState.copy(emailBodyText = next.text.ifBlank { null }))
                lastPushedText = next.text
                undoStackSize = undoStack.size
                redoStackSize = redoStack.size
            }

            // ─── Debounced undo push: 500ms after text change or word boundary ──────
            LaunchedEffect(bodyTextFieldValue.text) {
                val currentText = bodyTextFieldValue.text
                if (currentText == lastPushedText) return@LaunchedEffect

                // Word boundary detection: if the new character is whitespace
                val textDiff = currentText.length - lastPushedText.length
                if (textDiff == 1 && currentText.length > 1) {
                    val newCharIndex = bodyTextFieldValue.selection.min - 1
                    if (newCharIndex >= 0 && newCharIndex < currentText.length) {
                        val newChar = currentText[newCharIndex]
                        if (newChar == ' ' || newChar == '\n' || newChar == '\t') {
                            // Word boundary crossed — push immediately
                            pushUndo(lastPushedText, TextRange(newCharIndex))
                            return@LaunchedEffect
                        }
                    }
                }

                // 500ms debounce
                delay(500L)
                if (bodyTextFieldValue.text != lastPushedText) {
                    pushUndo(lastPushedText, bodyTextFieldValue.selection)
                }
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                // ── Section 1: Address Header (scrollable top, capped at 40% zone height) ──
                EmailAddressHeader(
                    formState = formState,
                    emailStatus = emailStatus,
                    emailAccounts = emailAccounts,
                    contactNames = contactNames,
                    onFormUpdate = onFormUpdate,
                    maxHeight = maxHeaderHeight
                )

                // ── Section 2: Body (fills remaining space) ──
                EmailBodySection(
                    formState = formState,
                    emailStatus = emailStatus,
                    bodyTextFieldValue = bodyTextFieldValue,
                    onBodyValueChange = { newValue ->
                        bodyTextFieldValue = newValue
                        // Sync back to formState
                        onFormUpdate(formState.copy(emailBodyText = newValue.text.ifBlank { null }))
                    },
                    isPreviewMode = isPreviewMode,
                    onExitPreview = { isPreviewMode = false },
                    focusRequester = bodyFocusRequester,
                    onFocusChanged = { focused -> isBodyFocused = focused },
                    modifier = Modifier.weight(1f)
                )

                // ── Section 3: Bottom Toolbar (pinned above keyboard) ──
                Box {
                    EmailBottomToolbar(
                        onOverflowClick = { showOverflowMenu = true },
                        onPreviewClick = { isPreviewMode = !isPreviewMode },
                        onUndoClick = { performUndo() },
                        onRedoClick = { performRedo() },
                        onFormatBold = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyWrapFormat(bodyTextFieldValue, "**")
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatItalic = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyWrapFormat(bodyTextFieldValue, "*")
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatStrikethrough = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyWrapFormat(bodyTextFieldValue, "~~")
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatLink = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyLinkFormat(bodyTextFieldValue)
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatHeading = { level ->
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyHeadingFormat(bodyTextFieldValue, level)
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatBullet = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyLinePrefixFormat(bodyTextFieldValue, "- ")
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatNumbered = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyLinePrefixFormat(bodyTextFieldValue, "", numbered = true)
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatBlockquote = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyBlockquoteFormat(bodyTextFieldValue)
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatCode = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyWrapFormat(bodyTextFieldValue, "`")
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        onFormatHorizontalRule = {
                            pushUndo(bodyTextFieldValue.text, bodyTextFieldValue.selection)
                            bodyTextFieldValue = MarkdownFormatUtils.applyHorizontalRule(bodyTextFieldValue)
                            onFormUpdate(formState.copy(emailBodyText = bodyTextFieldValue.text.ifBlank { null }))
                        },
                        isUndoEnabled = undoStackSize > 0,
                        isRedoEnabled = redoStackSize > 0,
                        isFormattingEnabled = isFormattingEnabled,
                        isPreviewMode = isPreviewMode,
                        showPreviewToggle = when (emailStatus) {
                            "draft" -> true
                            "received", "sent" -> hasHtmlContent
                            else -> false
                        },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // ── Overflow Menu (anchored to toolbar) ──
                    EmailOverflowMenu(
                        expanded = showOverflowMenu,
                        onDismiss = { showOverflowMenu = false },
                        emailStatus = emailStatus,
                        isToEmpty = isToEmpty,
                        pgpEncryptEnabled = pgpEncryptEnabled,
                        onSend = { showOverflowMenu = false; onSend() },
                        onSendLater = { showOverflowMenu = false; onSendLater() },
                        onSendAndArchive = { showOverflowMenu = false; onSendAndArchive() },
                        onPgpToggle = { showOverflowMenu = false; pgpEncryptEnabled = !pgpEncryptEnabled },
                        onCopyBody = {
                            showOverflowMenu = false
                            val bodyText = formState.emailBodyText ?: formState.note
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("Email body", bodyText))
                            android.widget.Toast.makeText(context, "Body copied", android.widget.Toast.LENGTH_SHORT).show()
                        },
                        onDiscard = { showOverflowMenu = false; showDiscardDialog = true },
                        onReply = { showOverflowMenu = false; onReply() },
                        onForward = { showOverflowMenu = false; onForward() },
                        onArchive = { showOverflowMenu = false; onArchive() },
                        onDownload = {
                            showOverflowMenu = false
                            // Trigger download action (save email as file)
                            android.widget.Toast.makeText(context, "Download not yet implemented", android.widget.Toast.LENGTH_SHORT).show()
                        },
                        onAddSenderToContacts = {
                            showOverflowMenu = false
                            // Navigate to contact creation with sender info
                            android.widget.Toast.makeText(context, "Add to contacts not yet implemented", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    )
                } // closes Box

                // ── Discard Confirmation Dialog ──
                if (showDiscardDialog) {
                    DiscardConfirmationDialog(
                        onConfirm = {
                            showDiscardDialog = false
                            onDiscard()
                        },
                        onCancel = { showDiscardDialog = false }
                    )
                }
            }
        }
    }
}

// ─── Address Header Section ─────────────────────────────────────────────────────

/**
 * Address header section containing From, To, CC/BCC, and Subject fields.
 * Wrapped in a scrollable container capped at 40% of zone height.
 * For draft emails: editable fields with chip input and autocomplete.
 * For received/sent emails: read-only display.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun EmailAddressHeader(
    formState: ChitFormState,
    emailStatus: String,
    emailAccounts: List<String>,
    contactNames: List<String>,
    onFormUpdate: (ChitFormState) -> Unit,
    maxHeight: Dp
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = maxHeight)
            .verticalScroll(rememberScrollState())
    ) {
        when (emailStatus) {
            "draft" -> DraftAddressHeader(
                formState = formState,
                emailAccounts = emailAccounts,
                contactNames = contactNames,
                onFormUpdate = onFormUpdate
            )
            "received", "sent" -> ReadOnlyAddressHeader(formState = formState)
        }
    }
}

/**
 * Editable address header for draft emails.
 * Contains From dropdown, To chip field, CC/BCC toggle with collapsible fields, and Subject.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun DraftAddressHeader(
    formState: ChitFormState,
    emailAccounts: List<String>,
    contactNames: List<String>,
    onFormUpdate: (ChitFormState) -> Unit
) {
    var showCcBcc by remember {
        mutableStateOf(!formState.emailCc.isNullOrBlank() || !formState.emailBcc.isNullOrBlank())
    }
    var fromExpanded by remember { mutableStateOf(false) }

    // To field chip state
    var toInput by remember { mutableStateOf("") }
    var ccInput by remember { mutableStateOf("") }
    var bccInput by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // From dropdown
        ExposedDropdownMenuBox(
            expanded = fromExpanded,
            onExpandedChange = { fromExpanded = it }
        ) {
            OutlinedTextField(
                value = formState.emailFrom ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("From") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = fromExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                singleLine = true,
                colors = CwocInputDefaults.outlinedColors()
            )
            ExposedDropdownMenu(
                expanded = fromExpanded,
                onDismissRequest = { fromExpanded = false },
                modifier = Modifier
                    .background(CwocDialogDefaults.containerColor)
                    .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
            ) {
                emailAccounts.forEach { account ->
                    DropdownMenuItem(
                        text = { Text(account) },
                        onClick = {
                            onFormUpdate(formState.copy(emailFrom = account))
                            fromExpanded = false
                        }
                    )
                }
                if (emailAccounts.isEmpty()) {
                    DropdownMenuItem(
                        text = { Text("No email accounts configured") },
                        onClick = { fromExpanded = false },
                        enabled = false
                    )
                }
            }
        }

        // To field with chips
        RecipientChipField(
            label = "To",
            recipients = parseRecipients(formState.emailTo),
            inputValue = toInput,
            onInputChange = { toInput = it },
            onAddRecipient = { recipient ->
                val current = parseRecipients(formState.emailTo)
                val updated = (current + recipient).joinToString(", ")
                onFormUpdate(formState.copy(emailTo = updated))
                toInput = ""
            },
            onRemoveRecipient = { recipient ->
                val current = parseRecipients(formState.emailTo)
                val updated = current.filter { it != recipient }.joinToString(", ")
                onFormUpdate(formState.copy(emailTo = updated.ifBlank { null }))
            },
            suggestions = contactNames
        )

        // CC/BCC toggle
        TextButton(onClick = { showCcBcc = !showCcBcc }) {
            Icon(
                imageVector = if (showCcBcc) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(if (showCcBcc) "Hide CC/BCC" else "Show CC/BCC")
        }

        // CC field (collapsible)
        AnimatedVisibility(
            visible = showCcBcc,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RecipientChipField(
                    label = "CC",
                    recipients = parseRecipients(formState.emailCc),
                    inputValue = ccInput,
                    onInputChange = { ccInput = it },
                    onAddRecipient = { recipient ->
                        val current = parseRecipients(formState.emailCc)
                        val updated = (current + recipient).joinToString(", ")
                        onFormUpdate(formState.copy(emailCc = updated))
                        ccInput = ""
                    },
                    onRemoveRecipient = { recipient ->
                        val current = parseRecipients(formState.emailCc)
                        val updated = current.filter { it != recipient }.joinToString(", ")
                        onFormUpdate(formState.copy(emailCc = updated.ifBlank { null }))
                    },
                    suggestions = contactNames
                )

                RecipientChipField(
                    label = "BCC",
                    recipients = parseRecipients(formState.emailBcc),
                    inputValue = bccInput,
                    onInputChange = { bccInput = it },
                    onAddRecipient = { recipient ->
                        val current = parseRecipients(formState.emailBcc)
                        val updated = (current + recipient).joinToString(", ")
                        onFormUpdate(formState.copy(emailBcc = updated))
                        bccInput = ""
                    },
                    onRemoveRecipient = { recipient ->
                        val current = parseRecipients(formState.emailBcc)
                        val updated = current.filter { it != recipient }.joinToString(", ")
                        onFormUpdate(formState.copy(emailBcc = updated.ifBlank { null }))
                    },
                    suggestions = contactNames
                )
            }
        }

        // Subject field
        OutlinedTextField(
            value = formState.emailSubject ?: formState.title,
            onValueChange = {
                onFormUpdate(formState.copy(emailSubject = it.ifBlank { null }, title = it))
            },
            label = { Text("Subject") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
    }
}

/**
 * Read-only address header for received and sent emails.
 */
@Composable
private fun ReadOnlyAddressHeader(formState: ChitFormState) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        ReadOnlyEmailField(label = "From", value = formState.emailFrom)
        ReadOnlyEmailField(label = "To", value = formState.emailTo)
        if (!formState.emailCc.isNullOrBlank()) {
            ReadOnlyEmailField(label = "CC", value = formState.emailCc)
        }
        if (!formState.emailBcc.isNullOrBlank()) {
            ReadOnlyEmailField(label = "BCC", value = formState.emailBcc)
        }
        ReadOnlyEmailField(label = "Subject", value = formState.emailSubject)

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
    }
}

// ─── Body Section ───────────────────────────────────────────────────────────────

/**
 * Email body section that fills remaining vertical space between address header and toolbar.
 * Supports preview/edit toggle:
 * - Draft edit mode: editable OutlinedTextField
 * - Draft preview mode: rendered markdown via MarkdownRenderer
 * - Received/sent preview mode (default when HTML available): HTML rendered via WebView
 * - Received/sent edit mode: plain text display
 */
@Composable
private fun EmailBodySection(
    formState: ChitFormState,
    emailStatus: String,
    bodyTextFieldValue: TextFieldValue,
    onBodyValueChange: (TextFieldValue) -> Unit,
    isPreviewMode: Boolean,
    onExitPreview: () -> Unit,
    focusRequester: FocusRequester,
    onFocusChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(vertical = 8.dp)
    ) {
        when (emailStatus) {
            "draft" -> {
                if (isPreviewMode) {
                    // Preview mode: show rendered markdown, tap to return to edit
                    MarkdownRenderer(
                        markdown = bodyTextFieldValue.text.ifBlank { "_No content_" },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onExitPreview() }
                            .padding(8.dp)
                    )
                } else {
                    // Edit mode: editable OutlinedTextField
                    OutlinedTextField(
                        value = bodyTextFieldValue,
                        onValueChange = onBodyValueChange,
                        label = { Text("Body") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester)
                            .onFocusChanged { focusState ->
                                onFocusChanged(focusState.isFocused)
                            },
                        colors = CwocInputDefaults.outlinedColors(),
                        shape = RoundedCornerShape(0.dp)
                    )
                }
            }
            "received", "sent" -> {
                if (isPreviewMode && !formState.emailBodyHtml.isNullOrBlank()) {
                    // Preview mode: show HTML rendered view via WebView
                    EmailHtmlWebView(
                        html = formState.emailBodyHtml!!,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    // Plain text view
                    Text(
                        text = formState.emailBodyText ?: formState.note,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp)
                    )
                }
            }
        }
    }
}

// ─── Bottom Toolbar ─────────────────────────────────────────────────────────────

/**
 * Email bottom toolbar matching the Notes zone pattern.
 *
 * Two modes:
 * - Edit mode (isPreviewMode = false): Full toolbar with Overflow (⋮) | Preview (👁) | Undo (↺) | Redo (↻) | scrollable formatting buttons
 * - Preview mode (isPreviewMode = true): Minimal toolbar with Overflow (⋮) | Edit (✏️) only
 *
 * Uses imePadding + navigationBarsPadding to stay above keyboard.
 * IconButtons use combinedClickable (tap = action, long-press = tooltip toast).
 *
 * The Preview toggle button is hidden entirely when showPreviewToggle is false
 * (e.g., received email with no HTML content).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun EmailBottomToolbar(
    onOverflowClick: () -> Unit,
    onPreviewClick: () -> Unit,
    onUndoClick: () -> Unit,
    onRedoClick: () -> Unit,
    onFormatBold: () -> Unit,
    onFormatItalic: () -> Unit,
    onFormatStrikethrough: () -> Unit,
    onFormatLink: () -> Unit,
    onFormatHeading: (Int) -> Unit,
    onFormatBullet: () -> Unit,
    onFormatNumbered: () -> Unit,
    onFormatBlockquote: () -> Unit,
    onFormatCode: () -> Unit,
    onFormatHorizontalRule: () -> Unit,
    isUndoEnabled: Boolean = true,
    isRedoEnabled: Boolean = true,
    isFormattingEnabled: Boolean = true,
    isPreviewMode: Boolean = false,
    showPreviewToggle: Boolean = true,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var showHeadingDropdown by remember { mutableStateOf(false) }
    var showBlockDropdown by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .imePadding()
            .navigationBarsPadding()
            .background(Color(0xFFF5F0E8))
            .padding(horizontal = 2.dp, vertical = 0.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Overflow menu button (⋮) — always visible
        IconButton(
            onClick = onOverflowClick,
            modifier = Modifier
                .size(42.dp)
                .combinedClickable(
                    onClick = onOverflowClick,
                    onLongClick = {
                        android.widget.Toast
                            .makeText(context, "More actions", android.widget.Toast.LENGTH_SHORT)
                            .show()
                    }
                )
        ) {
            Icon(Icons.Default.MoreVert, "More actions", modifier = Modifier.size(23.dp))
        }

        if (isPreviewMode) {
            // ── Preview mode: show Edit button only ──
            IconButton(
                onClick = onPreviewClick,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onPreviewClick,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Edit", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.Edit, "Edit", modifier = Modifier.size(23.dp))
            }
        } else {
            // ── Edit mode: full toolbar ──

            // Preview toggle button (👁) — hidden if showPreviewToggle is false
            if (showPreviewToggle) {
                IconButton(
                    onClick = onPreviewClick,
                    modifier = Modifier
                        .size(42.dp)
                        .combinedClickable(
                            onClick = onPreviewClick,
                            onLongClick = {
                                android.widget.Toast
                                    .makeText(context, "Preview", android.widget.Toast.LENGTH_SHORT)
                                    .show()
                            }
                        )
                ) {
                    Icon(Icons.Default.Visibility, "Preview", modifier = Modifier.size(23.dp))
                }
            }

        // Undo button (↺)
        IconButton(
            onClick = onUndoClick,
            enabled = isUndoEnabled,
            modifier = Modifier
                .size(42.dp)
                .combinedClickable(
                    onClick = {},
                    onLongClick = {
                        android.widget.Toast
                            .makeText(context, "Undo", android.widget.Toast.LENGTH_SHORT)
                            .show()
                    }
                )
        ) {
            Icon(Icons.Default.Undo, "Undo", modifier = Modifier.size(23.dp))
        }

        // Redo button (↻)
        IconButton(
            onClick = onRedoClick,
            enabled = isRedoEnabled,
            modifier = Modifier
                .size(42.dp)
                .combinedClickable(
                    onClick = {},
                    onLongClick = {
                        android.widget.Toast
                            .makeText(context, "Redo", android.widget.Toast.LENGTH_SHORT)
                            .show()
                    }
                )
        ) {
            Icon(Icons.Default.Redo, "Redo", modifier = Modifier.size(23.dp))
        }

        // Scrollable formatting section
        Row(
            modifier = Modifier
                .weight(1f)
                .horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            // Bold
            IconButton(
                onClick = onFormatBold,
                enabled = isFormattingEnabled,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onFormatBold,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Bold", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.FormatBold, "Bold", modifier = Modifier.size(23.dp))
            }

            // Italic
            IconButton(
                onClick = onFormatItalic,
                enabled = isFormattingEnabled,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onFormatItalic,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Italic", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.FormatItalic, "Italic", modifier = Modifier.size(23.dp))
            }

            // Strikethrough
            IconButton(
                onClick = onFormatStrikethrough,
                enabled = isFormattingEnabled,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onFormatStrikethrough,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Strikethrough", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.FormatStrikethrough, "Strikethrough", modifier = Modifier.size(23.dp))
            }

            // Link
            IconButton(
                onClick = onFormatLink,
                enabled = isFormattingEnabled,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onFormatLink,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Link", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.Link, "Link", modifier = Modifier.size(23.dp))
            }

            // Heading dropdown (H1/H2/H3)
            Box {
                IconButton(
                    onClick = { if (isFormattingEnabled) showHeadingDropdown = true },
                    enabled = isFormattingEnabled,
                    modifier = Modifier
                        .size(42.dp)
                        .combinedClickable(
                            onClick = { if (isFormattingEnabled) showHeadingDropdown = true },
                            onLongClick = {
                                android.widget.Toast
                                    .makeText(context, "Heading", android.widget.Toast.LENGTH_SHORT)
                                    .show()
                            }
                        )
                ) {
                    Text(
                        "H▾",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
                DropdownMenu(
                    expanded = showHeadingDropdown,
                    onDismissRequest = { showHeadingDropdown = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("H1", fontWeight = FontWeight.Bold) },
                        onClick = { onFormatHeading(1); showHeadingDropdown = false }
                    )
                    DropdownMenuItem(
                        text = { Text("H2", fontWeight = FontWeight.Bold) },
                        onClick = { onFormatHeading(2); showHeadingDropdown = false }
                    )
                    DropdownMenuItem(
                        text = { Text("H3", fontWeight = FontWeight.Bold) },
                        onClick = { onFormatHeading(3); showHeadingDropdown = false }
                    )
                }
            }

            // Bullet list
            IconButton(
                onClick = onFormatBullet,
                enabled = isFormattingEnabled,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onFormatBullet,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Bullet List", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.FormatListBulleted, "Bullet", modifier = Modifier.size(23.dp))
            }

            // Numbered list
            IconButton(
                onClick = onFormatNumbered,
                enabled = isFormattingEnabled,
                modifier = Modifier
                    .size(42.dp)
                    .combinedClickable(
                        onClick = onFormatNumbered,
                        onLongClick = {
                            android.widget.Toast
                                .makeText(context, "Numbered List", android.widget.Toast.LENGTH_SHORT)
                                .show()
                        }
                    )
            ) {
                Icon(Icons.Default.FormatListNumbered, "Numbered", modifier = Modifier.size(23.dp))
            }

            // Block dropdown (Blockquote/Code/HR)
            Box {
                IconButton(
                    onClick = { if (isFormattingEnabled) showBlockDropdown = true },
                    enabled = isFormattingEnabled,
                    modifier = Modifier
                        .size(42.dp)
                        .combinedClickable(
                            onClick = { if (isFormattingEnabled) showBlockDropdown = true },
                            onLongClick = {
                                android.widget.Toast
                                    .makeText(context, "Block formatting", android.widget.Toast.LENGTH_SHORT)
                                    .show()
                            }
                        )
                ) {
                    Icon(Icons.Default.FormatQuote, "Block", modifier = Modifier.size(23.dp))
                }
                DropdownMenu(
                    expanded = showBlockDropdown,
                    onDismissRequest = { showBlockDropdown = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("❝ Blockquote") },
                        onClick = { onFormatBlockquote(); showBlockDropdown = false }
                    )
                    DropdownMenuItem(
                        text = { Text("⟨⟩ Inline Code") },
                        onClick = { onFormatCode(); showBlockDropdown = false }
                    )
                    DropdownMenuItem(
                        text = { Text("— Horizontal Rule") },
                        onClick = { onFormatHorizontalRule(); showBlockDropdown = false }
                    )
                }
            }
        }
        } // end else (edit mode)
    }
}

// ─── Email Overflow Menu ────────────────────────────────────────────────────────

/**
 * Context-dependent overflow menu for the email zone.
 * Shows different items based on email status (draft/received/sent).
 * - Draft: Send, Send Later, Send & Archive, PGP Encrypt toggle, Copy body, Discard draft
 * - Received: Reply, Forward, Archive, Copy body, Download, Add sender to contacts
 * - Sent: Forward, Copy body, Download
 *
 * Dismisses automatically on tap outside (built-in Compose DropdownMenu behavior).
 */
@Composable
private fun EmailOverflowMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    emailStatus: String,
    isToEmpty: Boolean,
    pgpEncryptEnabled: Boolean,
    onSend: () -> Unit,
    onSendLater: () -> Unit,
    onSendAndArchive: () -> Unit,
    onPgpToggle: () -> Unit,
    onCopyBody: () -> Unit,
    onDiscard: () -> Unit,
    onReply: () -> Unit,
    onForward: () -> Unit,
    onArchive: () -> Unit,
    onDownload: () -> Unit,
    onAddSenderToContacts: () -> Unit
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = Modifier
            .background(CwocDialogDefaults.containerColor)
            .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
    ) {
        when (emailStatus) {
            "draft" -> {
                // Send
                DropdownMenuItem(
                    text = { Text("✉️ Send") },
                    onClick = onSend,
                    enabled = !isToEmpty
                )
                // Send Later
                DropdownMenuItem(
                    text = { Text("🕐 Send Later") },
                    onClick = onSendLater,
                    enabled = !isToEmpty
                )
                // Send & Archive
                DropdownMenuItem(
                    text = { Text("📦 Send & Archive") },
                    onClick = onSendAndArchive,
                    enabled = !isToEmpty
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                // PGP Encrypt toggle
                DropdownMenuItem(
                    text = {
                        Text(
                            if (pgpEncryptEnabled) "🔒 PGP Encrypt: ON"
                            else "🔓 PGP Encrypt: OFF"
                        )
                    },
                    onClick = onPgpToggle
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                // Copy body
                DropdownMenuItem(
                    text = { Text("📋 Copy body") },
                    onClick = onCopyBody
                )
                // Discard draft
                DropdownMenuItem(
                    text = { Text("🗑️ Discard draft", color = Color(0xFFB22222)) },
                    onClick = onDiscard
                )
            }
            "received" -> {
                // Reply
                DropdownMenuItem(
                    text = { Text("↩️ Reply") },
                    onClick = onReply
                )
                // Forward
                DropdownMenuItem(
                    text = { Text("↪️ Forward") },
                    onClick = onForward
                )
                // Archive
                DropdownMenuItem(
                    text = { Text("📦 Archive") },
                    onClick = onArchive
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                // Copy body
                DropdownMenuItem(
                    text = { Text("📋 Copy body") },
                    onClick = onCopyBody
                )
                // Download
                DropdownMenuItem(
                    text = { Text("⬇️ Download") },
                    onClick = onDownload
                )
                // Add sender to contacts
                DropdownMenuItem(
                    text = { Text("👤 Add sender to contacts") },
                    onClick = onAddSenderToContacts
                )
            }
            "sent" -> {
                // Forward
                DropdownMenuItem(
                    text = { Text("↪️ Forward") },
                    onClick = onForward
                )
                // Copy body
                DropdownMenuItem(
                    text = { Text("📋 Copy body") },
                    onClick = onCopyBody
                )
                // Download
                DropdownMenuItem(
                    text = { Text("⬇️ Download") },
                    onClick = onDownload
                )
            }
        }
    }
}

// ─── Discard Confirmation Dialog ────────────────────────────────────────────────

/**
 * Confirmation dialog shown when the user taps "Discard draft" from the overflow menu.
 * Provides Confirm and Cancel buttons. Cancel dismisses the dialog and retains the draft.
 */
@Composable
private fun DiscardConfirmationDialog(
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancel,
        modifier = CwocDialogDefaults.borderModifier,
        containerColor = CwocDialogDefaults.containerColor,
        title = {
            Text(
                text = "Discard Draft?",
                style = CwocDialogDefaults.titleStyle
            )
        },
        text = {
            Text("This will permanently discard the current email draft. This action cannot be undone.")
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                colors = CwocDialogDefaults.dangerButtonColors()
            ) {
                Text("Discard", color = Color(0xFFB22222))
            }
        },
        dismissButton = {
            TextButton(
                onClick = onCancel,
                colors = CwocDialogDefaults.confirmButtonColors()
            ) {
                Text("Cancel")
            }
        }
    )
}

// ─── Email HTML WebView (for preview mode) ─────────────────────────────────────

/**
 * Renders HTML email content in a sandboxed WebView with JavaScript disabled.
 * Used for received/sent email preview mode (controlled by toolbar toggle).
 * No internal toggle — the preview/edit toggle is in the bottom toolbar.
 *
 * Features:
 * - HTML sanitization (removes script, iframe, object, embed, form tags)
 * - Links open in device browser
 * - Auto-resize WebView height (clamped 200-800dp)
 */
@Composable
private fun EmailHtmlWebView(
    html: String,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    var webViewHeight by remember { mutableIntStateOf(200) }

    // Sanitize and wrap HTML in a basic document structure
    val wrappedHtml = remember(html) {
        val sanitized = sanitizeHtml(html)
        buildString {
            append("<!DOCTYPE html><html><head>")
            append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0\">")
            append("<style>")
            append("body { margin: 0; padding: 8px; font-family: sans-serif; font-size: 14px; ")
            append("word-wrap: break-word; overflow-wrap: break-word; }")
            append("img { max-width: 100%; height: auto; }")
            append("table { max-width: 100%; }")
            append("pre { white-space: pre-wrap; word-wrap: break-word; }")
            append("</style></head><body>")
            append(sanitized)
            append("</body></html>")
        }
    }

    Box(
        modifier = modifier
            .heightIn(min = 200.dp, max = 800.dp)
    ) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = false
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true
                    settings.builtInZoomControls = false
                    settings.displayZoomControls = false
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    setBackgroundColor(AndroidColor.TRANSPARENT)

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            request?.url?.let { uri ->
                                val intent = Intent(Intent.ACTION_VIEW, uri)
                                ctx.startActivity(intent)
                            }
                            return true
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            view?.let { wv ->
                                val contentHeightPx = wv.contentHeight
                                if (contentHeightPx > 0) {
                                    val heightDp = with(density) {
                                        contentHeightPx.toDp().value.toInt()
                                    }
                                    webViewHeight = heightDp.coerceIn(200, 800)
                                }
                            }
                        }
                    }

                    loadDataWithBaseURL(null, wrappedHtml, "text/html", "UTF-8", null)
                }
            },
            update = { webView ->
                webView.loadDataWithBaseURL(null, wrappedHtml, "text/html", "UTF-8", null)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(webViewHeight.dp)
        )
    }
}

// ─── Recipient Chip Field ───────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecipientChipField(
    label: String,
    recipients: List<String>,
    inputValue: String,
    onInputChange: (String) -> Unit,
    onAddRecipient: (String) -> Unit,
    onRemoveRecipient: (String) -> Unit,
    suggestions: List<String>
) {
    var showSuggestions by remember { mutableStateOf(false) }
    val filteredSuggestions = remember(inputValue, suggestions) {
        if (inputValue.length >= 2) {
            suggestions.filter {
                it.contains(inputValue, ignoreCase = true) && !recipients.contains(it)
            }.take(5)
        } else emptyList()
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Chips for existing recipients
        if (recipients.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(bottom = 4.dp)
            ) {
                recipients.forEach { recipient ->
                    InputChip(
                        selected = false,
                        onClick = { onRemoveRecipient(recipient) },
                        label = { Text(recipient, style = MaterialTheme.typography.labelSmall) },
                        trailingIcon = {
                            Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(14.dp))
                        }
                    )
                }
            }
        }

        // Input field
        OutlinedTextField(
            value = inputValue,
            onValueChange = {
                onInputChange(it)
                showSuggestions = it.length >= 2
            },
            label = { Text(label) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                imeAction = androidx.compose.ui.text.input.ImeAction.Done
            ),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                onDone = {
                    if (inputValue.isNotBlank()) {
                        onAddRecipient(inputValue.trim())
                    }
                }
            ),
            colors = CwocInputDefaults.outlinedColors()
        )

        // Autocomplete suggestions
        AnimatedVisibility(visible = showSuggestions && filteredSuggestions.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
            ) {
                filteredSuggestions.forEach { suggestion ->
                    TextButton(
                        onClick = {
                            onAddRecipient(suggestion)
                            showSuggestions = false
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = suggestion,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

// ─── Read-Only Email Field ──────────────────────────────────────────────────────

@Composable
private fun ReadOnlyEmailField(label: String, value: String?) {
    if (value.isNullOrBlank()) return
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "$label:",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(60.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parses a comma-separated recipient string into a list of individual recipients.
 */
private fun parseRecipients(recipientString: String?): List<String> {
    if (recipientString.isNullOrBlank()) return emptyList()
    return recipientString.split(",").map { it.trim() }.filter { it.isNotBlank() }
}
