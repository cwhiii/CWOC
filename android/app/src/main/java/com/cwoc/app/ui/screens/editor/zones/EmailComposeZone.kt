package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocOutline
import com.cwoc.app.ui.theme.CwocInputDefaults
import androidx.compose.foundation.shape.RoundedCornerShape

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
        Column(modifier = Modifier.fillMaxWidth()) {
            // ── Section 1: Address Header (scrollable top) ──
            EmailAddressHeader(
                formState = formState,
                emailStatus = emailStatus,
                emailAccounts = emailAccounts,
                contactNames = contactNames,
                onFormUpdate = onFormUpdate
            )

            // ── Section 2: Body (fills remaining space) ──
            EmailBodySection(
                formState = formState,
                emailStatus = emailStatus,
                onFormUpdate = onFormUpdate,
                modifier = Modifier.weight(1f)
            )

            // ── Section 3: Bottom Toolbar (pinned above keyboard) ──
            EmailBottomToolbarPlaceholder(
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .navigationBarsPadding()
            )
        }
    }
}

// ─── Address Header Section ─────────────────────────────────────────────────────

/**
 * Address header section containing From, To, CC/BCC, and Subject fields.
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
    onFormUpdate: (ChitFormState) -> Unit
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
 * For draft emails: editable OutlinedTextField.
 * For received/sent emails: read-only text display.
 */
@Composable
private fun EmailBodySection(
    formState: ChitFormState,
    emailStatus: String,
    onFormUpdate: (ChitFormState) -> Unit,
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
                OutlinedTextField(
                    value = formState.emailBodyText ?: formState.note,
                    onValueChange = {
                        onFormUpdate(formState.copy(emailBodyText = it.ifBlank { null }))
                    },
                    label = { Text("Body") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors(),
                    shape = RoundedCornerShape(0.dp)
                )
            }
            "received", "sent" -> {
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

// ─── Bottom Toolbar Placeholder ─────────────────────────────────────────────────

/**
 * Placeholder bottom toolbar row. Will be filled with overflow menu, preview toggle,
 * undo/redo, and formatting buttons in task 2.3.
 */
@Composable
private fun EmailBottomToolbarPlaceholder(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .background(Color(0xFFF5F0E8))
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Placeholder — toolbar buttons will be added in task 2.3
        Text(
            text = "✉️",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
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
