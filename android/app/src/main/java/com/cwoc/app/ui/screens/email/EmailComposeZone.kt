package com.cwoc.app.ui.screens.email

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.domain.email.TextSelection
import kotlinx.coroutines.delay

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val PgpGreen = Color(0xFF2E7D32)
private val PgpDisabledGray = Color(0xFF757575)
private val ScheduledBadgeColor = Color(0xFF1565C0)

// ─── Email Compose Zone ─────────────────────────────────────────────────────────

/**
 * Full-featured email compose zone displayed within the chit editor.
 *
 * Integrates all compose features:
 * - RecipientChipField for To/CC/BCC with autocomplete
 * - Subject field with bidirectional title sync
 * - FormattingToolbar above body textarea
 * - Live markdown preview with 500ms debounce and Render toggle
 * - PGP toggle button (green lock when enabled, open lock when disabled)
 * - PGP decryption banner with Decrypt button and password modal
 * - Email-specific save buttons: Save Draft, Send, Send & Archive (for replies)
 * - Send Later button opening SendLaterModal
 * - Read Receipt checkbox
 * - Download Raw button for received/sent emails
 * - Add Contact button for unknown senders
 * - Scheduled send indicator with Cancel button
 * - Signature auto-apply on new drafts
 * - AttachmentBar at bottom of body area
 * - EmailThreadViewInEditor section below everything
 *
 * Validates: Requirements 40.1-40.3, 41.1-41.3, 42.1-42.3, 43.1-43.3,
 *            44.1-44.6, 45.1-45.3, 47.1-47.3, 48.1-48.7, 49.1-49.7,
 *            50.5-50.6, 52.1-52.3, 53.1-53.3, 54.1-54.3, 57.1-57.5
 */
@Composable
fun EmailComposeZone(
    // ─── State from EmailComposeViewModel ────────────────────────────────────
    composeState: ComposeUiState,
    // ─── Email metadata ────────────────────────────────────────────────────────
    emailStatus: String?,
    emailFrom: String?,
    emailBodyHtml: String?,
    attachmentsJson: String?,
    serverUrl: String,
    authToken: String = "",
    isSenderKnown: Boolean,
    externalContentSetting: String,

    // ─── Thread data ─────────────────────────────────────────────────────────
    threadMessages: List<ChitEntity>,
    nestedChits: List<ChitEntity>,
    currentMessageId: String?,

    // ─── Autocomplete callbacks ──────────────────────────────────────────────
    onAutocompleteQuery: (String, RecipientField) -> Unit,
    onAddRecipient: (ContactEntity, RecipientField) -> Unit,
    onRemoveRecipient: (String, RecipientField) -> Unit,
    onChipify: (String, RecipientField) -> Unit,

    // ─── Subject/Body callbacks ──────────────────────────────────────────────
    onSubjectChange: (String) -> Unit,
    onBodyChange: (String) -> Unit,

    // ─── Formatting callbacks ────────────────────────────────────────────────
    onFormatting: (FormattingOperation, TextSelection) -> Unit,
    onLinkRequested: () -> Unit,

    // ─── PGP callbacks ───────────────────────────────────────────────────────
    onTogglePgp: () -> Unit,
    onDecrypt: (String) -> Unit,

    // ─── Action callbacks ────────────────────────────────────────────────────
    onSaveDraft: () -> Unit,
    onSend: () -> Unit,
    onSendAndArchive: () -> Unit,
    onSendLater: (String) -> Unit,
    onCancelSchedule: () -> Unit,
    onToggleReadReceipt: () -> Unit,
    onDownloadRaw: () -> Unit,
    onAddContact: () -> Unit,
    onNavigateToMessage: (String) -> Unit,

    modifier: Modifier = Modifier
) {
    val isDraft = emailStatus == "draft"
    var showCcBcc by remember {
        mutableStateOf(composeState.ccRecipients.isNotEmpty() || composeState.bccRecipients.isNotEmpty())
    }
    var showSendLaterModal by remember { mutableStateOf(false) }
    var showPgpPasswordDialog by remember { mutableStateOf(false) }
    var showRenderMode by remember { mutableStateOf(false) }

    // ─── Live markdown preview with 500ms debounce (Requirement 40.2) ────────
    var renderedMarkdown by remember { mutableStateOf("") }
    LaunchedEffect(composeState.body) {
        delay(500L)
        renderedMarkdown = composeState.body
    }

    // ─── Body text field value for selection tracking ────────────────────────
    var bodyFieldValue by remember(composeState.body) {
        mutableStateOf(TextFieldValue(text = composeState.body))
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // ─── Section Header ──────────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "✉️ Compose Email",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            // PGP Toggle (Requirements 48.1-48.5)
            if (composeState.pgpToggleVisible && isDraft) {
                PgpToggleButton(
                    pgpEnabled = composeState.pgpEnabled,
                    onToggle = onTogglePgp
                )
            }
        }

        // ─── PGP Decryption Banner (Requirements 49.1-49.5) ──────────────────
        if (composeState.pgpDecryptionBannerVisible) {
            PgpDecryptionBanner(
                decryptedBody = composeState.pgpDecryptedBody,
                onDecryptClicked = { showPgpPasswordDialog = true }
            )
        }

        // ─── Scheduled Send Indicator (Requirements 47.1-47.3) ───────────────
        if (composeState.scheduledSend != null) {
            ScheduledSendIndicator(
                sendAt = composeState.scheduledSend.sendAt,
                onCancel = onCancelSchedule
            )
        }

        // ─── Add Contact Button for unknown senders (Requirements 54.1-54.3) ─
        if (!isDraft && emailFrom != null && !isSenderKnown) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "From: $emailFrom",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
                TextButton(onClick = onAddContact) {
                    Icon(
                        imageVector = Icons.Default.PersonAdd,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Contact")
                }
            }
        }

        // ─── Recipient Fields (Requirements 36.1-36.8, 37.1-37.6) ───────────
        if (isDraft) {
            // To field
            RecipientChipField(
                label = "To",
                recipients = composeState.toRecipients,
                autocompleteResults = if (composeState.activeRecipientField == RecipientField.TO)
                    composeState.autocompleteResults else emptyList(),
                onQueryChange = { onAutocompleteQuery(it, RecipientField.TO) },
                onAddRecipient = { onAddRecipient(it, RecipientField.TO) },
                onRemoveRecipient = { onRemoveRecipient(it, RecipientField.TO) },
                onChipify = { onChipify(it, RecipientField.TO) }
            )

            // CC/BCC toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = { showCcBcc = !showCcBcc }) {
                    Icon(
                        imageVector = if (showCcBcc) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (showCcBcc) "Hide CC/BCC" else "Show CC/BCC",
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (showCcBcc) "Hide CC/BCC" else "Show CC/BCC")
                }
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
                        recipients = composeState.ccRecipients,
                        autocompleteResults = if (composeState.activeRecipientField == RecipientField.CC)
                            composeState.autocompleteResults else emptyList(),
                        onQueryChange = { onAutocompleteQuery(it, RecipientField.CC) },
                        onAddRecipient = { onAddRecipient(it, RecipientField.CC) },
                        onRemoveRecipient = { onRemoveRecipient(it, RecipientField.CC) },
                        onChipify = { onChipify(it, RecipientField.CC) }
                    )

                    RecipientChipField(
                        label = "BCC",
                        recipients = composeState.bccRecipients,
                        autocompleteResults = if (composeState.activeRecipientField == RecipientField.BCC)
                            composeState.autocompleteResults else emptyList(),
                        onQueryChange = { onAutocompleteQuery(it, RecipientField.BCC) },
                        onAddRecipient = { onAddRecipient(it, RecipientField.BCC) },
                        onRemoveRecipient = { onRemoveRecipient(it, RecipientField.BCC) },
                        onChipify = { onChipify(it, RecipientField.BCC) }
                    )
                }
            }
        }

        // ─── Subject Field with bidirectional sync (Requirements 43.1-43.3) ──
        if (isDraft) {
            OutlinedTextField(
                value = composeState.subject,
                onValueChange = { onSubjectChange(it) },
                label = { Text("Subject") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }

        // ─── Formatting Toolbar (Requirements 38.1-38.12) ────────────────────
        if (isDraft && composeState.showFormattingToolbar) {
            FormattingToolbar(
                selection = TextSelection(
                    start = bodyFieldValue.selection.start,
                    end = bodyFieldValue.selection.end,
                    text = bodyFieldValue.text.substring(
                        bodyFieldValue.selection.start.coerceAtMost(bodyFieldValue.text.length),
                        bodyFieldValue.selection.end.coerceAtMost(bodyFieldValue.text.length)
                    )
                ),
                onFormatting = { operation ->
                    val sel = TextSelection(
                        start = bodyFieldValue.selection.start,
                        end = bodyFieldValue.selection.end,
                        text = bodyFieldValue.text.substring(
                            bodyFieldValue.selection.start.coerceAtMost(bodyFieldValue.text.length),
                            bodyFieldValue.selection.end.coerceAtMost(bodyFieldValue.text.length)
                        )
                    )
                    onFormatting(operation, sel)
                },
                onLinkRequested = onLinkRequested
            )
        }

        // ─── Render Toggle (Requirements 41.1-41.3) ─────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(onClick = { showRenderMode = !showRenderMode }) {
                Icon(
                    imageVector = if (showRenderMode) Icons.Default.Edit else Icons.Default.Visibility,
                    contentDescription = if (showRenderMode) "Edit" else "Render",
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(if (showRenderMode) "Edit" else "Render")
            }
        }

        // ─── Body Area: Edit mode or Render mode ─────────────────────────────
        if (isDraft) {
            if (showRenderMode) {
                // Rendered markdown preview (Requirement 40.1, 41.2)
                MarkdownPreviewBox(markdownText = renderedMarkdown)
            } else {
                // Editable body textarea (Requirement 40.2 — debounced preview updates)
                OutlinedTextField(
                    value = bodyFieldValue,
                    onValueChange = { newValue ->
                        bodyFieldValue = newValue
                        onBodyChange(newValue.text)
                    },
                    label = { Text("Body") },
                    minLines = 8,
                    maxLines = 20,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Live markdown preview below body (Requirement 40.1)
            if (!showRenderMode && renderedMarkdown.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Preview",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                MarkdownPreviewBox(markdownText = renderedMarkdown)
            }
        } else {
            // Viewing received email — show HTML or decrypted body
            if (composeState.pgpDecryptedBody != null) {
                // Show decrypted body as read-only text (Requirement 49.4)
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    tonalElevation = 1.dp
                ) {
                    Text(
                        text = composeState.pgpDecryptedBody,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            } else if (!emailBodyHtml.isNullOrBlank()) {
                // HTML email rendering (Requirements 50.5-50.6)
                HtmlEmailRenderer(
                    htmlBody = emailBodyHtml,
                    textBody = composeState.body,
                    externalContentSetting = externalContentSetting,
                    isSenderKnown = isSenderKnown
                )
            } else {
                // Plain text body (read-only for received emails)
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    tonalElevation = 1.dp
                ) {
                    Text(
                        text = composeState.body,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }

        // ─── Attachment Bar (Requirement 56.1-56.6) ──────────────────────────
        AttachmentBar(
            attachmentsJson = attachmentsJson,
            serverUrl = serverUrl,
            authToken = authToken
        )

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(4.dp))

        // ─── Read Receipt Checkbox (Requirements 52.1-52.3) ──────────────────
        if (isDraft) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = composeState.requestReadReceipt,
                    onCheckedChange = { onToggleReadReceipt() }
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Request read receipt",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // ─── Download Raw Button (Requirements 53.1-53.3) ────────────────────
        if (!isDraft) {
            TextButton(onClick = onDownloadRaw) {
                Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Download Raw")
            }
        }

        // ─── Action Buttons (Requirements 57.1-57.5) ─────────────────────────
        if (isDraft) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Save Draft button (Requirement 57.2)
                OutlinedButton(
                    onClick = onSaveDraft,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Save,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Save Draft")
                }

                // Send button (Requirement 57.3)
                Button(
                    onClick = onSend,
                    enabled = composeState.canSend,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Send,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Send")
                }

                // Send & Archive button (Requirement 57.4, 45.1-45.3)
                if (composeState.isReply) {
                    Button(
                        onClick = onSendAndArchive,
                        enabled = composeState.canSend,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text("Send & Archive", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }

            // Send Later button (Requirements 46.1-46.6)
            TextButton(onClick = { showSendLaterModal = true }) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Send Later")
            }
        }

        // ─── Email Thread View In Editor (Requirement 55.1-55.7) ─────────────
        EmailThreadViewInEditor(
            currentMessageId = currentMessageId,
            threadMessages = threadMessages,
            nestedChits = nestedChits,
            onNavigateToMessage = onNavigateToMessage
        )
    }

    // ─── Send Later Modal ────────────────────────────────────────────────────
    if (showSendLaterModal) {
        SendLaterModal(
            onDismiss = { showSendLaterModal = false },
            onSchedule = { isoDatetime ->
                showSendLaterModal = false
                onSendLater(isoDatetime)
            }
        )
    }

    // ─── PGP Password Dialog (Requirement 49.2) ─────────────────────────────
    if (showPgpPasswordDialog) {
        PgpPasswordDialog(
            onDismiss = { showPgpPasswordDialog = false },
            onConfirm = { password ->
                showPgpPasswordDialog = false
                onDecrypt(password)
            }
        )
    }
}

// ─── PGP Toggle Button ──────────────────────────────────────────────────────────

/**
 * PGP encryption toggle button.
 * Green lock icon when enabled, open lock icon when disabled.
 *
 * Validates: Requirements 48.4, 48.5
 */
@Composable
private fun PgpToggleButton(
    pgpEnabled: Boolean,
    onToggle: () -> Unit
) {
    TextButton(onClick = onToggle) {
        Icon(
            imageVector = if (pgpEnabled) Icons.Default.Lock else Icons.Default.LockOpen,
            contentDescription = if (pgpEnabled) "PGP Enabled" else "PGP Disabled",
            modifier = Modifier.size(20.dp),
            tint = if (pgpEnabled) PgpGreen else PgpDisabledGray
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = if (pgpEnabled) "PGP ✓" else "PGP",
            color = if (pgpEnabled) PgpGreen else PgpDisabledGray,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// ─── PGP Decryption Banner ──────────────────────────────────────────────────────

/**
 * Banner shown when viewing a PGP-encrypted email.
 * Shows "This message is PGP encrypted." with a Decrypt button,
 * or "Message decrypted (view only — not saved)." after decryption.
 *
 * Validates: Requirements 49.1, 49.5
 */
@Composable
private fun PgpDecryptionBanner(
    decryptedBody: String?,
    onDecryptClicked: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = if (decryptedBody != null)
            PgpGreen.copy(alpha = 0.1f)
        else
            MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = if (decryptedBody != null) PgpGreen else MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (decryptedBody != null)
                        "Message decrypted (view only — not saved)."
                    else
                        "This message is PGP encrypted.",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium
                )
            }

            if (decryptedBody == null) {
                TextButton(onClick = onDecryptClicked) {
                    Text("Decrypt", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─── Scheduled Send Indicator ───────────────────────────────────────────────────

/**
 * Indicator badge showing when an email is scheduled for delivery.
 * Includes a Cancel button to cancel the scheduled send.
 *
 * Validates: Requirements 47.1-47.3
 */
@Composable
private fun ScheduledSendIndicator(
    sendAt: String,
    onCancel: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = ScheduledBadgeColor.copy(alpha = 0.1f),
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = ScheduledBadgeColor
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Scheduled: $sendAt",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = ScheduledBadgeColor
                )
            }

            TextButton(onClick = onCancel) {
                Icon(
                    imageVector = Icons.Default.Cancel,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    "Cancel",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium
                )
            }
        }
    }
}

// ─── Markdown Preview Box ───────────────────────────────────────────────────────

/**
 * Renders a simple markdown preview of the email body.
 * Uses basic text rendering with markdown-like formatting indicators.
 * For full HTML rendering, the web version uses marked.js — here we show
 * the raw markdown in a styled surface as a preview approximation.
 *
 * Validates: Requirements 40.1, 40.3
 */
@Composable
private fun MarkdownPreviewBox(
    markdownText: String
) {
    if (markdownText.isBlank()) return

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 60.dp, max = 200.dp),
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
            // Simple markdown rendering: parse headings, bold, italic, lists
            markdownText.lines().forEach { line ->
                val styledLine = when {
                    line.startsWith("### ") -> line.removePrefix("### ")
                    line.startsWith("## ") -> line.removePrefix("## ")
                    line.startsWith("# ") -> line.removePrefix("# ")
                    line.startsWith("- ") -> "• ${line.removePrefix("- ")}"
                    line.startsWith("* ") -> "• ${line.removePrefix("* ")}"
                    line.startsWith("> ") -> "│ ${line.removePrefix("> ")}"
                    line.startsWith("---") -> "────────────────"
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

                Text(
                    text = styledLine,
                    style = textStyle,
                    fontWeight = fontWeight,
                    color = if (line.startsWith("> "))
                        MaterialTheme.colorScheme.onSurfaceVariant
                    else
                        MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

// ─── PGP Password Dialog ────────────────────────────────────────────────────────

/**
 * Modal dialog asking for the account password to decrypt a PGP message.
 *
 * Validates: Requirement 49.2
 */
@Composable
private fun PgpPasswordDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var password by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Decrypt Message",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Enter your account password to retrieve the private PGP key for decryption.",
                    style = MaterialTheme.typography.bodyMedium
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(password) },
                enabled = password.isNotBlank()
            ) {
                Text("Decrypt", color = ParchmentBrown)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = ParchmentBrown)
            }
        }
    )
}
