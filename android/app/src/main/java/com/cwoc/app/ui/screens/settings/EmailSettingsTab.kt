package com.cwoc.app.ui.screens.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Switch
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.screens.settings.components.CollapsibleSection
import com.cwoc.app.ui.screens.settings.components.SignatureEditorModal
import org.json.JSONArray
import org.json.JSONObject

/**
 * Email Settings tab with 4 collapsible sections:
 * Accounts & Syncing, Privacy & Sending, Display & Bundles, and Badges.
 *
 * Badges was merged from a separate tab into this tab per Requirement 29.1.
 *
 * Validates: Requirements 4.2, 20.1, 20.2, 20.3, 20.4, 20.5, 21.1-21.7, 29.1
 */
@Composable
fun EmailSettingsTab(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    onTestConnection: (
        email: String,
        imapHost: String,
        imapPort: String,
        smtpHost: String,
        smtpPort: String,
        username: String,
        password: String,
        onResult: (EmailTestConnectionUiState) -> Unit
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onNavigateToAttachments: () -> Unit = {},
    bundles: List<com.cwoc.app.data.remote.BundleDto> = emptyList(),
    onToggleBundle: (bundleId: String, enable: Boolean) -> Unit = { _, _ -> },
    onBackfillTriggered: () -> Unit = {},
    isBackfillInProgress: Boolean = false,
    backfillResultMessage: String? = null
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Section 1: Accounts & Syncing
        AccountsSyncingSection(
            emailAccountsJson = settingsState.emailAccounts,
            checkInterval = settingsState.emailCheckInterval,
            maxPull = settingsState.emailMaxPull,
            onAccountsChanged = { onUpdateSetting("email_accounts", it) },
            onCheckIntervalChanged = { onUpdateSetting("email_check_interval", it) },
            onMaxPullChanged = { onUpdateSetting("email_max_pull", it) },
            onBackfillTriggered = onBackfillTriggered,
            isBackfillInProgress = isBackfillInProgress,
            backfillResultMessage = backfillResultMessage,
            onTestConnection = onTestConnection
        )

        HorizontalDivider()

        // Section 2: Privacy & Sending
        PrivacySendingSection(
            externalContent = settingsState.emailExternalContent,
            readReceipts = settingsState.emailReadReceipts,
            signature = settingsState.emailSignature,
            onExternalContentChanged = { onUpdateSetting("email_external_content", it) },
            onReadReceiptsChanged = { onUpdateSetting("email_read_receipts", it) },
            onSignatureChanged = { onUpdateSetting("email_signature", it) },
            onNavigateToAttachments = onNavigateToAttachments
        )

        HorizontalDivider()

        // Section 3: Display & Bundles
        DisplayBundlesSection(
            groupBy = settingsState.emailGroupBy,
            bundlesShowCount = settingsState.bundlesShowCount,
            bundles = bundles,
            onGroupByChanged = { onUpdateSetting("email_group_by", it) },
            onBundlesShowCountChanged = { onUpdateSetting("bundles_show_count", it) },
            onToggleBundle = onToggleBundle
        )

        HorizontalDivider()

        // Section 4: Badges (merged from separate tab per Requirement 29.1)
        BadgesSection(
            badgeDetectorsJson = settingsState.badgeDetectors,
            badgeMaxPerEmail = settingsState.badgeMaxPerEmail,
            onDetectorsChanged = { onUpdateSetting("badge_detectors", it) },
            onMaxPerEmailChanged = { onUpdateSetting("badge_max_per_email", it) }
        )
    }
}

// ============================================================
// Section 1: Accounts & Syncing
// ============================================================

@Composable
private fun AccountsSyncingSection(
    emailAccountsJson: String,
    checkInterval: String,
    maxPull: String,
    onAccountsChanged: (String) -> Unit,
    onCheckIntervalChanged: (String) -> Unit,
    onMaxPullChanged: (String) -> Unit,
    onBackfillTriggered: () -> Unit,
    isBackfillInProgress: Boolean,
    backfillResultMessage: String?,
    onTestConnection: (
        email: String,
        imapHost: String,
        imapPort: String,
        smtpHost: String,
        smtpPort: String,
        username: String,
        password: String,
        onResult: (EmailTestConnectionUiState) -> Unit
    ) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingAccountIndex by remember { mutableStateOf<Int?>(null) }
    var showDeleteConfirm by remember { mutableStateOf<Int?>(null) }

    val accounts = remember(emailAccountsJson) { parseEmailAccountsJson(emailAccountsJson) }

    Column {
        EmailCollapsibleHeader(
            title = "📧 Accounts & Syncing",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Account list
                if (accounts.isEmpty()) {
                    Text(
                        text = "No email accounts configured.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    accounts.forEachIndexed { index, account ->
                        EmailAccountCard(
                            account = account,
                            onEdit = { editingAccountIndex = index },
                            onDelete = { showDeleteConfirm = index }
                        )
                    }
                }

                OutlinedButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Account")
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Sync settings
                Text(
                    text = "Sync Settings",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                // Max Pull — free-form number input (1–1000)
                var maxPullError by remember(maxPull) {
                    val parsed = maxPull.toIntOrNull()
                    val error = when {
                        maxPull.isBlank() -> null // Don't show error on initial empty (server default will populate)
                        parsed == null -> "Valid range: 1–1000"
                        parsed < 1 -> "Valid range: 1–1000"
                        parsed > 1000 -> "Valid range: 1–1000"
                        else -> null
                    }
                    mutableStateOf(error)
                }
                OutlinedTextField(
                    value = maxPull,
                    onValueChange = { newValue ->
                        onMaxPullChanged(newValue)
                        // Validate inline
                        val parsed = newValue.toIntOrNull()
                        maxPullError = when {
                            newValue.isBlank() -> "Valid range: 1–1000"
                            parsed == null -> "Valid range: 1–1000"
                            parsed < 1 -> "Valid range: 1–1000"
                            parsed > 1000 -> "Valid range: 1–1000"
                            else -> null
                        }
                    },
                    label = { Text("Max Pull") },
                    isError = maxPullError != null,
                    supportingText = if (maxPullError != null) {
                        { Text(maxPullError!!, color = MaterialTheme.colorScheme.error) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Check Mail interval dropdown
                EmailDropdown(
                    label = "Check Mail",
                    value = checkInterval,
                    options = listOf(
                        "manual" to "Manual only",
                        "5" to "Every 5 min",
                        "15" to "Every 15 min",
                        "30" to "Every 30 min",
                        "60" to "Every 1 hour"
                    ),
                    onValueChanged = onCheckIntervalChanged
                )

                // Backfill action button with progress indicator
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onBackfillTriggered,
                        enabled = !isBackfillInProgress
                    ) {
                        if (isBackfillInProgress) {
                            androidx.compose.material3.CircularProgressIndicator(
                                modifier = Modifier
                                    .padding(end = 8.dp)
                                    .height(16.dp)
                                    .width(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        }
                        Text(if (isBackfillInProgress) "Backfilling..." else "📥 Backfill")
                    }
                    if (backfillResultMessage != null) {
                        Text(
                            text = backfillResultMessage,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (backfillResultMessage.startsWith("✅"))
                                MaterialTheme.colorScheme.primary
                            else if (backfillResultMessage.startsWith("❌"))
                                MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }

    // Add Account Dialog
    if (showAddDialog) {
        EmailAccountEditDialog(
            title = "Add Email Account",
            account = EmailAccount(),
            onDismiss = { showAddDialog = false },
            onConfirm = { account ->
                val newAccounts = accounts + account
                onAccountsChanged(serializeEmailAccountsJson(newAccounts))
                showAddDialog = false
            },
            onTestConnection = onTestConnection
        )
    }

    // Edit Account Dialog
    editingAccountIndex?.let { index ->
        EmailAccountEditDialog(
            title = "Edit Email Account",
            account = accounts[index],
            onDismiss = { editingAccountIndex = null },
            onConfirm = { account ->
                val newAccounts = accounts.toMutableList()
                newAccounts[index] = account
                onAccountsChanged(serializeEmailAccountsJson(newAccounts))
                editingAccountIndex = null
            },
            onTestConnection = onTestConnection
        )
    }

    // Delete Confirmation
    showDeleteConfirm?.let { index ->
        val account = accounts[index]
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            title = { Text("Delete Account") },
            text = { Text("Remove \"${account.nickname.ifEmpty { account.email }}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    val newAccounts = accounts.toMutableList()
                    newAccounts.removeAt(index)
                    onAccountsChanged(serializeEmailAccountsJson(newAccounts))
                    showDeleteConfirm = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun EmailAccountCard(
    account: EmailAccount,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Collapsed: nickname + email
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = account.nickname.ifEmpty { "Unnamed Account" },
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = account.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit")
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.error)
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.KeyboardArrowUp
                        else Icons.Default.KeyboardArrowDown,
                    contentDescription = if (expanded) "Collapse" else "Expand"
                )
            }

            // Expanded: show all fields
            AnimatedVisibility(visible = expanded) {
                Column(
                    modifier = Modifier.padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("IMAP: ${account.imapHost}:${account.imapPort}", style = MaterialTheme.typography.bodySmall)
                    Text("SMTP: ${account.smtpHost}:${account.smtpPort}", style = MaterialTheme.typography.bodySmall)
                    Text("Username: ${account.username}", style = MaterialTheme.typography.bodySmall)
                    Text("Password: ${"•".repeat(8)}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun EmailAccountEditDialog(
    title: String,
    account: EmailAccount,
    onDismiss: () -> Unit,
    onConfirm: (EmailAccount) -> Unit,
    onTestConnection: (
        email: String,
        imapHost: String,
        imapPort: String,
        smtpHost: String,
        smtpPort: String,
        username: String,
        password: String,
        onResult: (EmailTestConnectionUiState) -> Unit
    ) -> Unit
) {
    var nickname by remember { mutableStateOf(account.nickname) }
    var email by remember { mutableStateOf(account.email) }
    var imapHost by remember { mutableStateOf(account.imapHost) }
    var imapPort by remember { mutableStateOf(account.imapPort) }
    var smtpHost by remember { mutableStateOf(account.smtpHost) }
    var smtpPort by remember { mutableStateOf(account.smtpPort) }
    var username by remember { mutableStateOf(account.username) }
    var password by remember { mutableStateOf(account.password) }

    // Test connection state
    var testState by remember { mutableStateOf(EmailTestConnectionUiState()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(value = nickname, onValueChange = { nickname = it },
                    label = { Text("Nickname") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = email, onValueChange = { email = it },
                    label = { Text("Email Address") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = imapHost, onValueChange = { imapHost = it },
                    label = { Text("IMAP Host") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = imapPort, onValueChange = { imapPort = it },
                    label = { Text("IMAP Port") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = smtpHost, onValueChange = { smtpHost = it },
                    label = { Text("SMTP Host") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = smtpPort, onValueChange = { smtpPort = it },
                    label = { Text("SMTP Port") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = username, onValueChange = { username = it },
                    label = { Text("Username") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = password, onValueChange = { password = it },
                    label = { Text("Password") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation())

                // ─── Test Connection Button ─────────────────────────────────────
                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = {
                        testState = EmailTestConnectionUiState(isTesting = true)
                        onTestConnection(
                            email, imapHost, imapPort, smtpHost, smtpPort, username, password
                        ) { result ->
                            testState = result
                        }
                    },
                    enabled = !testState.isTesting && email.isNotBlank() && imapHost.isNotBlank() && smtpHost.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(if (testState.isTesting) "Testing..." else "Test Connection")
                }

                // Inline test results
                if (testState.isTesting) {
                    Text(
                        text = "Testing...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (!testState.isTesting && testState.imapResult != null) {
                    Text(
                        text = testState.imapResult!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (testState.imapResult!!.startsWith("IMAP OK"))
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.error
                    )
                }

                if (!testState.isTesting && testState.smtpResult != null) {
                    Text(
                        text = testState.smtpResult!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (testState.smtpResult!!.startsWith("SMTP OK"))
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.error
                    )
                }

                if (!testState.isTesting && testState.errorMessage != null) {
                    Text(
                        text = testState.errorMessage!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(EmailAccount(nickname, email, imapHost, imapPort, smtpHost, smtpPort, username, password))
                },
                enabled = email.isNotBlank() && imapHost.isNotBlank() && smtpHost.isNotBlank()
            ) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

// ============================================================
// Section 2: Privacy & Sending
// ============================================================

/**
 * Corrected Privacy & Sending section per requirements 19.1–19.9.
 *
 * - "External Content" dropdown: Allow all / Block all / Allow from contacts
 * - "Read Receipts" dropdown: Never send / Always send / Ask each time / Contacts only
 * - Signature inline preview rendering stored markdown (or "No signature set" placeholder)
 * - "Edit Signature" button opening SignatureEditorModal
 * - "Attachments" hint text about Administration → Data Management
 * - "View All Attachments" button navigating to attachments page
 *
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PrivacySendingSection(
    externalContent: String,
    readReceipts: String,
    signature: String,
    onExternalContentChanged: (String) -> Unit,
    onReadReceiptsChanged: (String) -> Unit,
    onSignatureChanged: (String) -> Unit,
    onNavigateToAttachments: () -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showSignatureEditor by remember { mutableStateOf(false) }

    Column {
        EmailCollapsibleHeader(
            title = "🔒 Privacy & Sending",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // External Content dropdown — Requirement 19.1
                EmailDropdown(
                    label = "External Content",
                    value = externalContent,
                    options = listOf(
                        "allow" to "Allow all",
                        "block" to "Block all",
                        "known_senders" to "Allow from contacts"
                    ),
                    onValueChanged = onExternalContentChanged
                )

                // Read Receipts dropdown — Requirement 19.2
                EmailDropdown(
                    label = "Read Receipts",
                    value = readReceipts,
                    options = listOf(
                        "never" to "Never send",
                        "always" to "Always send",
                        "ask" to "Ask each time",
                        "contacts_only" to "Contacts only"
                    ),
                    onValueChanged = onReadReceiptsChanged
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Signature section — Requirements 19.3, 19.4, 19.5, 19.6, 19.7
                Text(
                    text = "Signature",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                // Inline preview rendering stored markdown or placeholder
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp, max = 120.dp)
                        .border(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.outline,
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(8.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (signature.isBlank()) {
                        Text(
                            text = "No signature set",
                            style = MaterialTheme.typography.bodyMedium,
                            fontStyle = FontStyle.Italic,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    } else {
                        MarkdownRenderer(
                            markdown = signature,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                // "Edit Signature" button
                OutlinedButton(onClick = { showSignatureEditor = true }) {
                    Icon(Icons.Default.Edit, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Edit Signature")
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Attachments section — Requirements 19.8, 19.9
                Text(
                    text = "Attachments",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Attachment limits are configured in Administration → Data Management",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedButton(onClick = onNavigateToAttachments) {
                    Text("View All Attachments")
                }
            }
        }
    }

    // Signature Editor Modal — Requirements 19.4, 19.5, 19.6, 19.7
    if (showSignatureEditor) {
        SignatureEditorModal(
            currentSignature = signature,
            onConfirm = { newSignature ->
                onSignatureChanged(newSignature)
                showSignatureEditor = false
            },
            onDismiss = {
                // Discard edits, preserve previous signature
                showSignatureEditor = false
            }
        )
    }
}

// ============================================================
// Section 3: Display & Bundles
// ============================================================

/**
 * Display & Bundles section with corrected options per requirements 20.1-20.5:
 * - "Group Emails By" dropdown: Date (date), None (none)
 * - "Bundle Count Display" dropdown: Unread / Total (both), Unread only (unread), Total only (total), Hidden (none)
 * - "Auto-Bundles" checkbox list populated from server bundles (non-removable, excluding "Everything Else")
 * - Placeholder message when no auto-bundles exist
 * - On disable toggle: call bundle disable endpoint
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DisplayBundlesSection(
    groupBy: String,
    bundlesShowCount: String,
    bundles: List<com.cwoc.app.data.remote.BundleDto>,
    onGroupByChanged: (String) -> Unit,
    onBundlesShowCountChanged: (String) -> Unit,
    onToggleBundle: (bundleId: String, enable: Boolean) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }

    // Filter to non-removable bundles only (auto-bundles)
    val autoBundles = remember(bundles) {
        bundles.filter { it.removable == false }
    }

    Column {
        EmailCollapsibleHeader(
            title = "📋 Display & Bundles",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Group Emails By dropdown
                EmailDropdown(
                    label = "Group Emails By",
                    value = groupBy,
                    options = listOf(
                        "date" to "Date (Today, Yesterday, Last Week, Older)",
                        "none" to "None"
                    ),
                    onValueChanged = onGroupByChanged
                )

                // Bundle Count Display dropdown
                EmailDropdown(
                    label = "Bundle Count Display",
                    value = bundlesShowCount,
                    options = listOf(
                        "both" to "Unread / Total",
                        "unread" to "Unread only",
                        "total" to "Total only",
                        "none" to "Hidden"
                    ),
                    onValueChanged = onBundlesShowCountChanged
                )

                // Auto-Bundles section
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Auto-Bundles",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                if (autoBundles.isEmpty()) {
                    // Placeholder when no auto-bundles exist
                    Text(
                        text = "Auto-bundles will appear here after the first email sync.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    autoBundles.forEach { bundle ->
                        val isEnabled = (bundle.displayOrder ?: 0) >= 0
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onToggleBundle(bundle.id, !isEnabled)
                                }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isEnabled,
                                onCheckedChange = { checked ->
                                    onToggleBundle(bundle.id, checked)
                                }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = bundle.name ?: "Unnamed Bundle",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// Shared Components
// ============================================================

@Composable
private fun EmailCollapsibleHeader(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggle() }
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
            contentDescription = if (expanded) "Collapse" else "Expand"
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmailDropdown(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onValueChanged: (String) -> Unit
) {
    var dropdownExpanded by remember { mutableStateOf(false) }
    val displayValue = options.find { it.first == value }?.second ?: value

    ExposedDropdownMenuBox(
        expanded = dropdownExpanded,
        onExpandedChange = { dropdownExpanded = !dropdownExpanded }
    ) {
        OutlinedTextField(
            value = displayValue,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = dropdownExpanded,
            onDismissRequest = { dropdownExpanded = false }
        ) {
            options.forEach { (key, display) ->
                DropdownMenuItem(
                    text = { Text(display) },
                    onClick = {
                        onValueChanged(key)
                        dropdownExpanded = false
                    }
                )
            }
        }
    }
}

// ============================================================
// Data Models
// ============================================================

private data class EmailAccount(
    val nickname: String = "",
    val email: String = "",
    val imapHost: String = "",
    val imapPort: String = "993",
    val smtpHost: String = "",
    val smtpPort: String = "587",
    val username: String = "",
    val password: String = ""
)

// ============================================================
// JSON Parsing & Serialization
// ============================================================

private fun parseEmailAccountsJson(json: String): List<EmailAccount> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            EmailAccount(
                nickname = obj.optString("nickname", ""),
                email = obj.optString("email", ""),
                imapHost = obj.optString("imap_host", ""),
                imapPort = obj.optString("imap_port", "993"),
                smtpHost = obj.optString("smtp_host", ""),
                smtpPort = obj.optString("smtp_port", "587"),
                username = obj.optString("username", ""),
                password = obj.optString("password", "")
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun serializeEmailAccountsJson(accounts: List<EmailAccount>): String {
    val array = JSONArray()
    accounts.forEach { account ->
        val obj = JSONObject()
        obj.put("nickname", account.nickname)
        obj.put("email", account.email)
        obj.put("imap_host", account.imapHost)
        obj.put("imap_port", account.imapPort)
        obj.put("smtp_host", account.smtpHost)
        obj.put("smtp_port", account.smtpPort)
        obj.put("username", account.username)
        obj.put("password", account.password)
        array.put(obj)
    }
    return array.toString()
}

// ============================================================
// Section 4: Badges (merged from separate tab)
// Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 29.1
// ============================================================

// Badge detector categories matching web implementation
private val BADGE_CATEGORIES = listOf(
    "Custom", "Package", "Flight", "Hotel", "Rental",
    "Event", "Restaurant", "Transit", "Order"
)

// Badge button label options matching web implementation
private val BADGE_BUTTON_LABELS = listOf(
    "View", "Track", "Manage", "Order", "Tickets", "Flight", "Open"
)

// Built-in badge detectors (non-editable, only enable/disable)
private val BUILT_IN_BADGE_DETECTORS = listOf(
    BuiltInBadgeDetector("Tracking Numbers", "Package", "tracking_number", true),
    BuiltInBadgeDetector("Order Confirmations", "Order", "order_confirmation", true),
    BuiltInBadgeDetector("Flight Info", "Flight", "flight_info", true),
    BuiltInBadgeDetector("Calendar Invites", "Event", "calendar_invite", true),
    BuiltInBadgeDetector("Shipping Updates", "Package", "shipping_update", true)
)

private data class BuiltInBadgeDetector(
    val name: String,
    val category: String,
    val id: String,
    val defaultEnabled: Boolean
)

private data class CustomBadgeDetector(
    val id: String = "",
    val name: String = "",
    val category: String = "Custom",
    val keywords: List<String> = emptyList(),
    val regex: String = "",
    val url: String = "",
    val label: String = "View",
    val enabled: Boolean = true
)

@Composable
private fun BadgesSection(
    badgeDetectorsJson: String,
    badgeMaxPerEmail: String,
    onDetectorsChanged: (String) -> Unit,
    onMaxPerEmailChanged: (String) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var editingDetector by remember { mutableStateOf<CustomBadgeDetector?>(null) }
    var showDeleteConfirm by remember { mutableStateOf<CustomBadgeDetector?>(null) }

    val config = remember(badgeDetectorsJson) { parseBadgeConfig(badgeDetectorsJson) }
    val customDetectors = config.customDetectors

    CollapsibleSection(
        title = "🏷️ Badges",
        sectionId = "email_badges",
        defaultExpanded = true
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Max badges per email
            EmailDropdown(
                label = "Max Badges Per Email",
                value = badgeMaxPerEmail,
                options = listOf("1" to "1", "2" to "2", "3" to "3", "5" to "5", "10" to "10"),
                onValueChanged = onMaxPerEmailChanged
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Built-in detectors section
            Text(
                text = "Built-in Detectors",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            BUILT_IN_BADGE_DETECTORS.forEach { builtIn ->
                val isDisabled = config.disabled.contains(builtIn.id)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = builtIn.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = builtIn.category,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(
                            checked = !isDisabled,
                            onCheckedChange = { enabled ->
                                val newConfig = if (enabled) {
                                    config.copy(disabled = config.disabled - builtIn.id)
                                } else {
                                    config.copy(disabled = config.disabled + builtIn.id)
                                }
                                onDetectorsChanged(serializeBadgeConfig(newConfig))
                            }
                        )
                    }
                }
            }

            // Category toggles
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Category Toggles",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            BADGE_CATEGORIES.forEach { category ->
                val isCatDisabled = config.disabledCategories.contains(category)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = category,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = !isCatDisabled,
                        onCheckedChange = { enabled ->
                            val newConfig = if (enabled) {
                                config.copy(disabledCategories = config.disabledCategories - category)
                            } else {
                                config.copy(disabledCategories = config.disabledCategories + category)
                            }
                            onDetectorsChanged(serializeBadgeConfig(newConfig))
                        }
                    )
                }
            }

            // Custom detectors section
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Custom Detectors",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            if (customDetectors.isEmpty()) {
                Text(
                    text = "No custom detectors defined. Add one to detect patterns in emails.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                customDetectors.forEach { detector ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = detector.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "${detector.category} • ${detector.label}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            IconButton(onClick = { editingDetector = detector }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit")
                            }
                            IconButton(onClick = { showDeleteConfirm = detector }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Delete",
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }

            OutlinedButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Custom Detector")
            }
        }
    }

    // Add Custom Detector Dialog
    if (showAddDialog) {
        CustomDetectorEditDialog(
            title = "Add Custom Detector",
            detector = CustomBadgeDetector(),
            onDismiss = { showAddDialog = false },
            onConfirm = { newDetector ->
                val withId = newDetector.copy(id = "custom-${System.currentTimeMillis()}")
                val newConfig = config.copy(customDetectors = config.customDetectors + withId)
                onDetectorsChanged(serializeBadgeConfig(newConfig))
                showAddDialog = false
            }
        )
    }

    // Edit Custom Detector Dialog
    editingDetector?.let { detector ->
        CustomDetectorEditDialog(
            title = "Edit Custom Detector",
            detector = detector,
            onDismiss = { editingDetector = null },
            onConfirm = { updatedDetector ->
                val newCustom = config.customDetectors.map {
                    if (it.id == detector.id) updatedDetector else it
                }
                val newConfig = config.copy(customDetectors = newCustom)
                onDetectorsChanged(serializeBadgeConfig(newConfig))
                editingDetector = null
            }
        )
    }

    // Delete Confirmation
    showDeleteConfirm?.let { detector ->
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            title = { Text("Delete Detector") },
            text = { Text("Remove \"${detector.name}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    val newCustom = config.customDetectors.filter { it.id != detector.id }
                    val newConfig = config.copy(customDetectors = newCustom)
                    onDetectorsChanged(serializeBadgeConfig(newConfig))
                    showDeleteConfirm = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) { Text("Cancel") }
            }
        )
    }
}

// ============================================================
// Custom Detector Edit Dialog
// Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomDetectorEditDialog(
    title: String,
    detector: CustomBadgeDetector,
    onDismiss: () -> Unit,
    onConfirm: (CustomBadgeDetector) -> Unit
) {
    var name by remember { mutableStateOf(detector.name) }
    var category by remember { mutableStateOf(detector.category) }
    var keywordsText by remember { mutableStateOf(detector.keywords.joinToString(", ")) }
    var regex by remember { mutableStateOf(detector.regex) }
    var urlTemplate by remember { mutableStateOf(detector.url) }
    var buttonLabel by remember { mutableStateOf(detector.label) }

    // Validation error states
    var nameError by remember { mutableStateOf<String?>(null) }
    var regexError by remember { mutableStateOf<String?>(null) }
    var urlError by remember { mutableStateOf<String?>(null) }

    // Dropdown expanded states
    var categoryExpanded by remember { mutableStateOf(false) }
    var labelExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name (Req 21.1)
                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        nameError = null
                    },
                    label = { Text("Name") },
                    placeholder = { Text("e.g. Amazon Orders") },
                    singleLine = true,
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    modifier = Modifier.fillMaxWidth()
                )

                // Category dropdown (Req 21.2)
                ExposedDropdownMenuBox(
                    expanded = categoryExpanded,
                    onExpandedChange = { categoryExpanded = !categoryExpanded }
                ) {
                    OutlinedTextField(
                        value = category,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Category") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = categoryExpanded,
                        onDismissRequest = { categoryExpanded = false }
                    ) {
                        BADGE_CATEGORIES.forEach { cat ->
                            DropdownMenuItem(
                                text = { Text(cat) },
                                onClick = {
                                    category = cat
                                    categoryExpanded = false
                                }
                            )
                        }
                    }
                }

                // Keywords (Req 21.3)
                OutlinedTextField(
                    value = keywordsText,
                    onValueChange = { keywordsText = it },
                    label = { Text("Keywords") },
                    placeholder = { Text("e.g. shipped, tracking, delivery") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    text = "Comma-separated. At least one must appear in email text. May be empty.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Regex Pattern (Req 21.4)
                OutlinedTextField(
                    value = regex,
                    onValueChange = {
                        regex = it
                        regexError = null
                    },
                    label = { Text("Regex Pattern") },
                    placeholder = { Text("e.g. (?i)order\\s*#?\\s*(\\w+)") },
                    singleLine = true,
                    isError = regexError != null,
                    supportingText = regexError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp),
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    text = "Must have one capture group for the code/value to extract.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // URL Template (Req 21.5)
                OutlinedTextField(
                    value = urlTemplate,
                    onValueChange = {
                        urlTemplate = it
                        urlError = null
                    },
                    label = { Text("URL Template") },
                    placeholder = { Text("e.g. https://example.com/track/{code}") },
                    singleLine = true,
                    isError = urlError != null,
                    supportingText = urlError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp),
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    text = "Use {code} where the matched value should be inserted.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Button Label dropdown (Req 21.6)
                ExposedDropdownMenuBox(
                    expanded = labelExpanded,
                    onExpandedChange = { labelExpanded = !labelExpanded }
                ) {
                    OutlinedTextField(
                        value = buttonLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Button Label") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = labelExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = labelExpanded,
                        onDismissRequest = { labelExpanded = false }
                    ) {
                        BADGE_BUTTON_LABELS.forEach { lbl ->
                            DropdownMenuItem(
                                text = { Text(lbl) },
                                onClick = {
                                    buttonLabel = lbl
                                    labelExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    // Validation (Req 21.7)
                    var hasError = false

                    if (name.isBlank()) {
                        nameError = "Name is required"
                        hasError = true
                    }

                    if (regex.isBlank()) {
                        regexError = "Regex pattern is required"
                        hasError = true
                    } else {
                        try {
                            Regex(regex)
                        } catch (e: Exception) {
                            regexError = "Invalid regex: ${e.message}"
                            hasError = true
                        }
                    }

                    if (urlTemplate.isBlank()) {
                        urlError = "URL template is required"
                        hasError = true
                    } else if (!urlTemplate.contains("{code}")) {
                        urlError = "URL must contain {code} placeholder"
                        hasError = true
                    }

                    if (!hasError) {
                        val keywords = keywordsText
                            .split(",")
                            .map { it.trim() }
                            .filter { it.isNotEmpty() }

                        onConfirm(
                            detector.copy(
                                name = name.trim(),
                                category = category,
                                keywords = keywords,
                                regex = regex.trim(),
                                url = urlTemplate.trim(),
                                label = buttonLabel
                            )
                        )
                    }
                }
            ) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

// ============================================================
// Badge Config Data Model & Serialization
// ============================================================

private data class BadgeConfig(
    val disabled: Set<String> = emptySet(),
    val disabledCategories: List<String> = emptyList(),
    val maxResults: Int = 3,
    val customDetectors: List<CustomBadgeDetector> = emptyList()
)

private fun parseBadgeConfig(json: String): BadgeConfig {
    return try {
        val obj = JSONObject(json)
        val disabled = mutableSetOf<String>()
        val disabledObj = obj.optJSONObject("disabled")
        if (disabledObj != null) {
            val keys = disabledObj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                if (disabledObj.optBoolean(key, false)) {
                    disabled.add(key)
                }
            }
        }

        val disabledCategories = mutableListOf<String>()
        val catArray = obj.optJSONArray("disabledCategories")
        if (catArray != null) {
            for (i in 0 until catArray.length()) {
                disabledCategories.add(catArray.getString(i))
            }
        }

        val maxResults = obj.optInt("maxResults", 3)

        val customDetectors = mutableListOf<CustomBadgeDetector>()
        val customArray = obj.optJSONArray("customDetectors")
        if (customArray != null) {
            for (i in 0 until customArray.length()) {
                val det = customArray.getJSONObject(i)
                val keywords = mutableListOf<String>()
                val kwArray = det.optJSONArray("keywords")
                if (kwArray != null) {
                    for (k in 0 until kwArray.length()) {
                        keywords.add(kwArray.getString(k))
                    }
                }
                customDetectors.add(
                    CustomBadgeDetector(
                        id = det.optString("id", "custom-${System.currentTimeMillis()}"),
                        name = det.optString("name", ""),
                        category = det.optString("category", "Custom"),
                        keywords = keywords,
                        regex = det.optString("regex", ""),
                        url = det.optString("url", ""),
                        label = det.optString("label", "View"),
                        enabled = det.optBoolean("enabled", true)
                    )
                )
            }
        }

        BadgeConfig(
            disabled = disabled,
            disabledCategories = disabledCategories,
            maxResults = maxResults,
            customDetectors = customDetectors
        )
    } catch (e: Exception) {
        // If the JSON is the old array format from BadgesSettingsTab, try parsing that
        try {
            JSONArray(json)
            // Old format: array of detector objects — return empty config
            BadgeConfig()
        } catch (e2: Exception) {
            BadgeConfig()
        }
    }
}

private fun serializeBadgeConfig(config: BadgeConfig): String {
    val obj = JSONObject()

    // disabled map
    val disabledObj = JSONObject()
    config.disabled.forEach { disabledObj.put(it, true) }
    obj.put("disabled", disabledObj)

    // disabledCategories array
    val catArray = JSONArray()
    config.disabledCategories.forEach { catArray.put(it) }
    obj.put("disabledCategories", catArray)

    // maxResults
    obj.put("maxResults", config.maxResults)

    // customDetectors array
    val customArray = JSONArray()
    config.customDetectors.forEach { det ->
        val detObj = JSONObject()
        detObj.put("id", det.id)
        detObj.put("name", det.name)
        detObj.put("category", det.category)
        val kwArray = JSONArray()
        det.keywords.forEach { kwArray.put(it) }
        detObj.put("keywords", kwArray)
        detObj.put("regex", det.regex)
        detObj.put("url", det.url)
        detObj.put("label", det.label)
        detObj.put("enabled", det.enabled)
        detObj.put("icon", "/static/tracking/order.svg")
        detObj.put("priority", 50)
        customArray.put(detObj)
    }
    obj.put("customDetectors", customArray)

    return obj.toString()
}
