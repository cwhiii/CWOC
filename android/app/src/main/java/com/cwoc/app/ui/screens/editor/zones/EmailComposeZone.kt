package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Forward
import androidx.compose.material.icons.filled.Reply
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.ui.components.MarkdownRenderer

/**
 * Full Email Compose Zone for the chit editor.
 *
 * Handles three email states:
 * - "draft": Full compose UI with From, To, CC, BCC, Subject, Body, and action buttons
 * - "received": Read-only view with Reply, Forward, Archive actions
 * - "sent": Read-only view with Forward action
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
        when (emailStatus) {
            "draft" -> DraftComposeContent(
                formState = formState,
                emailAccounts = emailAccounts,
                contactNames = contactNames,
                onFormUpdate = onFormUpdate,
                onSend = onSend,
                onSendLater = onSendLater,
                onSendAndArchive = onSendAndArchive,
                onDiscard = onDiscard
            )
            "received" -> ReceivedEmailContent(
                formState = formState,
                onReply = onReply,
                onForward = onForward,
                onArchive = onArchive
            )
            "sent" -> SentEmailContent(
                formState = formState,
                onForward = onForward
            )
        }
    }
}

// ─── Draft Compose Content ──────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun DraftComposeContent(
    formState: ChitFormState,
    emailAccounts: List<String>,
    contactNames: List<String>,
    onFormUpdate: (ChitFormState) -> Unit,
    onSend: () -> Unit,
    onSendLater: () -> Unit,
    onSendAndArchive: () -> Unit,
    onDiscard: () -> Unit
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
                singleLine = true
            )
            ExposedDropdownMenu(
                expanded = fromExpanded,
                onDismissRequest = { fromExpanded = false }
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
            modifier = Modifier.fillMaxWidth()
        )

        // Body field (multi-line markdown area)
        OutlinedTextField(
            value = formState.emailBodyText ?: formState.note,
            onValueChange = {
                onFormUpdate(formState.copy(emailBodyText = it.ifBlank { null }))
            },
            label = { Text("Body") },
            minLines = 8,
            maxLines = 20,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(4.dp))

        // Action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Send
            Button(
                onClick = onSend,
                enabled = !formState.emailTo.isNullOrBlank(),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Send, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Send")
            }

            // Send Later
            OutlinedButton(
                onClick = onSendLater,
                enabled = !formState.emailTo.isNullOrBlank()
            ) {
                Icon(Icons.Default.Schedule, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Later")
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Send & Archive
            OutlinedButton(
                onClick = onSendAndArchive,
                enabled = !formState.emailTo.isNullOrBlank()
            ) {
                Icon(Icons.Default.Archive, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Send & Archive")
            }

            Spacer(modifier = Modifier.weight(1f))

            // Discard Draft
            OutlinedButton(
                onClick = onDiscard
            ) {
                Icon(
                    Icons.Default.Delete, null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Discard", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

// ─── Received Email Content ─────────────────────────────────────────────────────

@Composable
private fun ReceivedEmailContent(
    formState: ChitFormState,
    onReply: () -> Unit,
    onForward: () -> Unit,
    onArchive: () -> Unit
) {
    var showHtml by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Read-only fields
        ReadOnlyEmailField(label = "From", value = formState.emailFrom)
        ReadOnlyEmailField(label = "To", value = formState.emailTo)
        if (!formState.emailCc.isNullOrBlank()) {
            ReadOnlyEmailField(label = "CC", value = formState.emailCc)
        }
        ReadOnlyEmailField(label = "Subject", value = formState.emailSubject)

        // Body toggle: HTML view | Text view
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = showHtml,
                onClick = { showHtml = true },
                label = { Text("HTML") }
            )
            FilterChip(
                selected = !showHtml,
                onClick = { showHtml = false },
                label = { Text("Text") }
            )
        }

        // Body content
        if (showHtml && !formState.emailBodyHtml.isNullOrBlank()) {
            MarkdownRenderer(
                markdown = formState.emailBodyHtml,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            )
        } else {
            Text(
                text = formState.emailBodyText ?: formState.note,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            )
        }

        HorizontalDivider()

        // Action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(onClick = onReply) {
                Icon(Icons.Default.Reply, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Reply")
            }
            OutlinedButton(onClick = onForward) {
                Icon(Icons.Default.Forward, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Forward")
            }
            OutlinedButton(onClick = onArchive) {
                Icon(Icons.Default.Archive, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Archive")
            }
        }
    }
}

// ─── Sent Email Content ─────────────────────────────────────────────────────────

@Composable
private fun SentEmailContent(
    formState: ChitFormState,
    onForward: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Read-only fields
        ReadOnlyEmailField(label = "From", value = formState.emailFrom)
        ReadOnlyEmailField(label = "To", value = formState.emailTo)
        if (!formState.emailCc.isNullOrBlank()) {
            ReadOnlyEmailField(label = "CC", value = formState.emailCc)
        }
        ReadOnlyEmailField(label = "Subject", value = formState.emailSubject)

        // Body
        Text(
            text = formState.emailBodyText ?: formState.note,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        )

        HorizontalDivider()

        // Action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(onClick = onForward) {
                Icon(Icons.Default.Forward, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Forward")
            }
        }
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
            )
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
