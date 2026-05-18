package com.cwoc.app.ui.screens.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

/**
 * Email Settings tab with 3 collapsible sections:
 * Accounts & Syncing, Privacy & Sending, Display & Bundles.
 *
 * Validates: Requirements 4.2
 */
@Composable
fun EmailSettingsTab(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
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
            syncInterval = settingsState.emailSyncInterval,
            maxPullCount = settingsState.emailMaxPullCount,
            backfillEnabled = settingsState.emailBackfill,
            onAccountsChanged = { onUpdateSetting("email_accounts", it) },
            onSyncIntervalChanged = { onUpdateSetting("email_sync_interval", it) },
            onMaxPullCountChanged = { onUpdateSetting("email_max_pull_count", it) },
            onBackfillChanged = { onUpdateSetting("email_backfill", it) }
        )

        HorizontalDivider()

        // Section 2: Privacy & Sending
        PrivacySendingSection(
            blockTracking = settingsState.emailBlockTracking,
            externalContent = settingsState.emailExternalContent,
            readReceipts = settingsState.emailReadReceipts,
            undoSendDelay = settingsState.emailUndoSendDelay,
            signature = settingsState.emailSignature,
            maxAttachmentSize = settingsState.emailMaxAttachmentSize,
            onBlockTrackingChanged = { onUpdateSetting("email_block_tracking", it) },
            onExternalContentChanged = { onUpdateSetting("email_external_content", it) },
            onReadReceiptsChanged = { onUpdateSetting("email_read_receipts", it) },
            onUndoSendDelayChanged = { onUpdateSetting("email_undo_send_delay", it) },
            onSignatureChanged = { onUpdateSetting("email_signature", it) },
            onMaxAttachmentSizeChanged = { onUpdateSetting("email_max_attachment_size", it) }
        )

        HorizontalDivider()

        // Section 3: Display & Bundles
        DisplayBundlesSection(
            groupBy = settingsState.emailGroupBy,
            paginate = settingsState.emailPaginate,
            pageSize = settingsState.emailPageSize,
            bundlesEnabled = settingsState.emailBundlesEnabled,
            multiPlacement = settingsState.emailMultiPlacement,
            showCount = settingsState.emailShowCount,
            autoBundlesJson = settingsState.emailAutoBundles,
            onGroupByChanged = { onUpdateSetting("email_group_by", it) },
            onPaginateChanged = { onUpdateSetting("email_paginate", it) },
            onPageSizeChanged = { onUpdateSetting("email_page_size", it) },
            onBundlesEnabledChanged = { onUpdateSetting("email_bundles_enabled", it) },
            onMultiPlacementChanged = { onUpdateSetting("email_multi_placement", it) },
            onShowCountChanged = { onUpdateSetting("email_show_count", it) },
            onAutoBundlesChanged = { onUpdateSetting("email_auto_bundles", it) }
        )
    }
}

// ============================================================
// Section 1: Accounts & Syncing
// ============================================================

@Composable
private fun AccountsSyncingSection(
    emailAccountsJson: String,
    syncInterval: String,
    maxPullCount: String,
    backfillEnabled: String,
    onAccountsChanged: (String) -> Unit,
    onSyncIntervalChanged: (String) -> Unit,
    onMaxPullCountChanged: (String) -> Unit,
    onBackfillChanged: (String) -> Unit
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

                EmailDropdown(
                    label = "Check Interval",
                    value = syncInterval,
                    options = listOf("5" to "Every 5 min", "10" to "Every 10 min", "15" to "Every 15 min", "30" to "Every 30 min", "60" to "Every hour"),
                    onValueChanged = onSyncIntervalChanged
                )

                EmailDropdown(
                    label = "Max Pull Count",
                    value = maxPullCount,
                    options = listOf("50" to "50", "100" to "100", "200" to "200", "500" to "500", "1000" to "1000"),
                    onValueChanged = onMaxPullCountChanged
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Backfill old emails",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = backfillEnabled == "true",
                        onCheckedChange = { onBackfillChanged(if (it) "true" else "false") }
                    )
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
            }
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
            }
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
    onConfirm: (EmailAccount) -> Unit
) {
    var nickname by remember { mutableStateOf(account.nickname) }
    var email by remember { mutableStateOf(account.email) }
    var imapHost by remember { mutableStateOf(account.imapHost) }
    var imapPort by remember { mutableStateOf(account.imapPort) }
    var smtpHost by remember { mutableStateOf(account.smtpHost) }
    var smtpPort by remember { mutableStateOf(account.smtpPort) }
    var username by remember { mutableStateOf(account.username) }
    var password by remember { mutableStateOf(account.password) }

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PrivacySendingSection(
    blockTracking: String,
    externalContent: String,
    readReceipts: String,
    undoSendDelay: String,
    signature: String,
    maxAttachmentSize: String,
    onBlockTrackingChanged: (String) -> Unit,
    onExternalContentChanged: (String) -> Unit,
    onReadReceiptsChanged: (String) -> Unit,
    onUndoSendDelayChanged: (String) -> Unit,
    onSignatureChanged: (String) -> Unit,
    onMaxAttachmentSizeChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }

    Column {
        EmailCollapsibleHeader(
            title = "🔒 Privacy & Sending",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Block tracking pixels
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Block tracking pixels", style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f))
                    Switch(
                        checked = blockTracking == "true",
                        onCheckedChange = { onBlockTrackingChanged(if (it) "true" else "false") }
                    )
                }

                // External content
                EmailDropdown(
                    label = "Load External Content",
                    value = externalContent,
                    options = listOf("always" to "Always", "ask" to "Ask", "never" to "Never"),
                    onValueChanged = onExternalContentChanged
                )

                // Read receipts
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Send read receipts", style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f))
                    Switch(
                        checked = readReceipts == "true",
                        onCheckedChange = { onReadReceiptsChanged(if (it) "true" else "false") }
                    )
                }

                // Undo send delay
                EmailDropdown(
                    label = "Undo Send Delay",
                    value = undoSendDelay,
                    options = listOf("5" to "5 seconds", "10" to "10 seconds", "15" to "15 seconds", "30" to "30 seconds"),
                    onValueChanged = onUndoSendDelayChanged
                )

                // Signature
                OutlinedTextField(
                    value = signature,
                    onValueChange = onSignatureChanged,
                    label = { Text("Email Signature") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 6
                )

                // Max attachment size
                EmailDropdown(
                    label = "Max Attachment Size",
                    value = maxAttachmentSize,
                    options = listOf("5" to "5 MB", "10" to "10 MB", "25" to "25 MB", "50" to "50 MB"),
                    onValueChanged = onMaxAttachmentSizeChanged
                )
            }
        }
    }
}

// ============================================================
// Section 3: Display & Bundles
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DisplayBundlesSection(
    groupBy: String,
    paginate: String,
    pageSize: String,
    bundlesEnabled: String,
    multiPlacement: String,
    showCount: String,
    autoBundlesJson: String,
    onGroupByChanged: (String) -> Unit,
    onPaginateChanged: (String) -> Unit,
    onPageSizeChanged: (String) -> Unit,
    onBundlesEnabledChanged: (String) -> Unit,
    onMultiPlacementChanged: (String) -> Unit,
    onShowCountChanged: (String) -> Unit,
    onAutoBundlesChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddBundleDialog by remember { mutableStateOf(false) }

    val autoBundles = remember(autoBundlesJson) { parseAutoBundlesJson(autoBundlesJson) }

    Column {
        EmailCollapsibleHeader(
            title = "📋 Display & Bundles",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Group by
                EmailDropdown(
                    label = "Group By",
                    value = groupBy,
                    options = listOf("thread" to "Thread", "none" to "None"),
                    onValueChanged = onGroupByChanged
                )

                // Paginate toggle + page size
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Paginate emails", style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f))
                    Switch(
                        checked = paginate == "true",
                        onCheckedChange = { onPaginateChanged(if (it) "true" else "false") }
                    )
                }

                if (paginate == "true") {
                    EmailDropdown(
                        label = "Page Size",
                        value = pageSize,
                        options = listOf("25" to "25", "50" to "50", "100" to "100"),
                        onValueChanged = onPageSizeChanged
                    )
                }

                // Bundles enable
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Enable bundles", style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f))
                    Switch(
                        checked = bundlesEnabled == "true",
                        onCheckedChange = { onBundlesEnabledChanged(if (it) "true" else "false") }
                    )
                }

                // Multi-placement
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Multi-placement", style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f))
                    Switch(
                        checked = multiPlacement == "true",
                        onCheckedChange = { onMultiPlacementChanged(if (it) "true" else "false") }
                    )
                }

                // Show count
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Show bundle count", style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f))
                    Switch(
                        checked = showCount == "true",
                        onCheckedChange = { onShowCountChanged(if (it) "true" else "false") }
                    )
                }

                // Auto-bundles rules
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Auto-Bundle Rules",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                if (autoBundles.isEmpty()) {
                    Text(
                        text = "No auto-bundle rules defined.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    autoBundles.forEachIndexed { index, rule ->
                        AutoBundleRuleRow(
                            rule = rule,
                            onDelete = {
                                val newRules = autoBundles.toMutableList()
                                newRules.removeAt(index)
                                onAutoBundlesChanged(serializeAutoBundlesJson(newRules))
                            }
                        )
                    }
                }

                OutlinedButton(onClick = { showAddBundleDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Rule")
                }
            }
        }
    }

    // Add Bundle Rule Dialog
    if (showAddBundleDialog) {
        AutoBundleRuleDialog(
            onDismiss = { showAddBundleDialog = false },
            onConfirm = { rule ->
                val newRules = autoBundles + rule
                onAutoBundlesChanged(serializeAutoBundlesJson(newRules))
                showAddBundleDialog = false
            }
        )
    }
}

@Composable
private fun AutoBundleRuleRow(
    rule: AutoBundleRule,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = rule.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text(text = "Match: ${rule.pattern}", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Remove rule",
                    tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun AutoBundleRuleDialog(
    onDismiss: () -> Unit,
    onConfirm: (AutoBundleRule) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var pattern by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Auto-Bundle Rule") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it },
                    label = { Text("Bundle Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = pattern, onValueChange = { pattern = it },
                    label = { Text("Match Pattern (sender/subject)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(AutoBundleRule(name, pattern)) },
                enabled = name.isNotBlank() && pattern.isNotBlank()) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
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

private data class AutoBundleRule(
    val name: String,
    val pattern: String
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

private fun parseAutoBundlesJson(json: String): List<AutoBundleRule> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            AutoBundleRule(
                name = obj.optString("name", ""),
                pattern = obj.optString("pattern", "")
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun serializeAutoBundlesJson(rules: List<AutoBundleRule>): String {
    val array = JSONArray()
    rules.forEach { rule ->
        val obj = JSONObject()
        obj.put("name", rule.name)
        obj.put("pattern", rule.pattern)
        array.put(obj)
    }
    return array.toString()
}
