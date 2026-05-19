package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

// ─── Security Options ───────────────────────────────────────────────────────────

private val SECURITY_OPTIONS = listOf("SSL/TLS", "STARTTLS", "None")

// ─── Accounts Modal ─────────────────────────────────────────────────────────────

/**
 * Full-screen modal for managing email accounts.
 *
 * Two views:
 * 1. List view: shows all configured accounts as cards (icon, nickname/email, server info)
 *    with an "Add Account" button at the bottom.
 * 2. Edit view: form with all account fields, Test Connection button, Back/Delete buttons.
 *
 * Validates: Requirements 59.3-59.8, 60.1-60.4
 *
 * @param accounts List of currently configured email accounts
 * @param testConnectionState Current state of the test connection operation
 * @param onAddAccount Called with the new [EmailAccountConfig] when the user saves a new account
 * @param onEditAccount Called with (index, updatedConfig) when the user saves edits to an existing account
 * @param onDeleteAccount Called with the account index when the user confirms deletion
 * @param onTestConnection Called with the current [EmailAccountConfig] to test IMAP/SMTP connectivity
 * @param onClearTestConnection Called when navigating away from edit view to reset test state
 * @param onDismiss Called when the modal is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsModal(
    accounts: List<EmailAccountConfig>,
    testConnectionState: TestConnectionState,
    onAddAccount: (EmailAccountConfig) -> Unit,
    onEditAccount: (Int, EmailAccountConfig) -> Unit,
    onDeleteAccount: (Int) -> Unit,
    onTestConnection: (EmailAccountConfig) -> Unit,
    onClearTestConnection: () -> Unit,
    onDismiss: () -> Unit
) {
    // Navigation state: null = list view, non-null = edit view (index or -1 for new)
    var editingIndex by remember { mutableStateOf<Int?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = if (editingIndex == null) "Email Accounts"
                            else if (editingIndex == -1) "Add Account"
                            else "Edit Account",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        if (editingIndex != null) {
                            IconButton(onClick = {
                                onClearTestConnection()
                                editingIndex = null
                            }) {
                                Icon(
                                    imageVector = Icons.Default.ArrowBack,
                                    contentDescription = "Back to list"
                                )
                            }
                        } else {
                            IconButton(onClick = onDismiss) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Close"
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            },
            containerColor = MaterialTheme.colorScheme.background
        ) { paddingValues ->
            if (editingIndex == null) {
                // ─── List View ───────────────────────────────────────────────
                AccountListView(
                    accounts = accounts,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(horizontal = 16.dp),
                    onAccountTap = { index -> editingIndex = index },
                    onAddAccount = { editingIndex = -1 }
                )
            } else {
                // ─── Edit View ──────────────────────────────────────────────
                val index = editingIndex!!
                val initialAccount = if (index >= 0 && index < accounts.size) {
                    accounts[index]
                } else {
                    EmailAccountConfig()
                }

                AccountEditView(
                    initialAccount = initialAccount,
                    isNewAccount = index == -1,
                    testConnectionState = testConnectionState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(horizontal = 16.dp),
                    onSave = { config ->
                        if (index == -1) {
                            onAddAccount(config)
                        } else {
                            onEditAccount(index, config)
                        }
                        onClearTestConnection()
                        editingIndex = null
                    },
                    onDelete = {
                        if (index >= 0) {
                            onDeleteAccount(index)
                        }
                        onClearTestConnection()
                        editingIndex = null
                    },
                    onTestConnection = onTestConnection
                )
            }
        }
    }
}

// ─── Account List View ──────────────────────────────────────────────────────────

/**
 * Displays all configured accounts as cards with an "Add Account" button at the bottom.
 * Each card shows: email icon, nickname (or email if no nickname), email address, and server summary.
 *
 * Validates: Requirements 59.3, 59.4, 59.5
 */
@Composable
private fun AccountListView(
    accounts: List<EmailAccountConfig>,
    modifier: Modifier = Modifier,
    onAccountTap: (Int) -> Unit,
    onAddAccount: () -> Unit
) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Spacer(modifier = Modifier.height(8.dp))

        if (accounts.isEmpty()) {
            Text(
                text = "No email accounts configured.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 24.dp)
            )
        } else {
            accounts.forEachIndexed { index, account ->
                AccountCard(
                    account = account,
                    onClick = { onAccountTap(index) }
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Add Account button
        OutlinedButton(
            onClick = onAddAccount,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Account")
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

/**
 * A single account card in the list view showing icon, nickname/email, and server info.
 */
@Composable
private fun AccountCard(
    account: EmailAccountConfig,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Email,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                // Nickname or email as primary text
                Text(
                    text = account.nickname.ifBlank { account.email.ifBlank { "Unnamed Account" } },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Email address (if nickname is shown as primary)
                if (account.nickname.isNotBlank() && account.email.isNotBlank()) {
                    Text(
                        text = account.email,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Server summary
                val serverSummary = buildServerSummary(account)
                if (serverSummary.isNotBlank()) {
                    Text(
                        text = serverSummary,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

/**
 * Builds a brief server summary string like "IMAP: mail.example.com | SMTP: smtp.example.com"
 */
private fun buildServerSummary(account: EmailAccountConfig): String {
    val parts = mutableListOf<String>()
    if (account.imapHost.isNotBlank()) {
        parts.add("IMAP: ${account.imapHost}")
    }
    if (account.smtpHost.isNotBlank()) {
        parts.add("SMTP: ${account.smtpHost}")
    }
    return parts.joinToString(" | ")
}

// ─── Account Edit View ──────────────────────────────────────────────────────────

/**
 * Form view for editing or creating an email account.
 * Fields: Nickname, Email, Display Name, Username, Password (visibility toggle),
 * IMAP Host/Port/Security, SMTP Host/Port/Security.
 * Buttons: Test Connection, Save, Delete (with confirmation).
 *
 * Validates: Requirements 59.5, 59.6, 59.7, 59.8, 60.1-60.4
 */
@Composable
private fun AccountEditView(
    initialAccount: EmailAccountConfig,
    isNewAccount: Boolean,
    testConnectionState: TestConnectionState,
    modifier: Modifier = Modifier,
    onSave: (EmailAccountConfig) -> Unit,
    onDelete: () -> Unit,
    onTestConnection: (EmailAccountConfig) -> Unit
) {
    // Form state
    var nickname by remember { mutableStateOf(initialAccount.nickname) }
    var email by remember { mutableStateOf(initialAccount.email) }
    var displayName by remember { mutableStateOf(initialAccount.displayName) }
    var username by remember { mutableStateOf(initialAccount.username) }
    var password by remember { mutableStateOf(initialAccount.password) }
    var passwordVisible by remember { mutableStateOf(false) }
    var imapHost by remember { mutableStateOf(initialAccount.imapHost) }
    var imapPort by remember { mutableStateOf(initialAccount.imapPort) }
    var imapSecurity by remember { mutableStateOf(initialAccount.imapSecurity) }
    var smtpHost by remember { mutableStateOf(initialAccount.smtpHost) }
    var smtpPort by remember { mutableStateOf(initialAccount.smtpPort) }
    var smtpSecurity by remember { mutableStateOf(initialAccount.smtpSecurity) }

    // Delete confirmation state
    var showDeleteConfirm by remember { mutableStateOf(false) }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = {
                Text(
                    text = "Delete Account",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error
                )
            },
            text = {
                Text(
                    "Are you sure you want to delete \"${nickname.ifBlank { email.ifBlank { "this account" } }}\"? " +
                            "This action cannot be undone."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        onDelete()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            },
            containerColor = MaterialTheme.colorScheme.surface
        )
    }

    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Spacer(modifier = Modifier.height(4.dp))

        // ─── Account Info Section ───────────────────────────────────────────
        Text(
            text = "Account Info",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        OutlinedTextField(
            value = nickname,
            onValueChange = { nickname = it },
            label = { Text("Nickname") },
            placeholder = { Text("e.g., Personal, Work") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email Address") },
            placeholder = { Text("user@example.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text("Display Name") },
            placeholder = { Text("Your Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            placeholder = { Text("Usually your email address") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Password with visibility toggle
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            placeholder = { Text("Account password") },
            singleLine = true,
            visualTransformation = if (passwordVisible) VisualTransformation.None
            else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.Visibility
                        else Icons.Default.VisibilityOff,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password"
                    )
                }
            },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        // ─── IMAP Settings Section ──────────────────────────────────────────
        Text(
            text = "IMAP Settings",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        OutlinedTextField(
            value = imapHost,
            onValueChange = { imapHost = it },
            label = { Text("IMAP Host") },
            placeholder = { Text("imap.example.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = imapPort,
                onValueChange = { imapPort = it },
                label = { Text("Port") },
                placeholder = { Text("993") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )

            SecuritySelector(
                selectedSecurity = imapSecurity,
                onSecuritySelected = { imapSecurity = it },
                modifier = Modifier.weight(2f)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // ─── SMTP Settings Section ──────────────────────────────────────────
        Text(
            text = "SMTP Settings",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        OutlinedTextField(
            value = smtpHost,
            onValueChange = { smtpHost = it },
            label = { Text("SMTP Host") },
            placeholder = { Text("smtp.example.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = smtpPort,
                onValueChange = { smtpPort = it },
                label = { Text("Port") },
                placeholder = { Text("587") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )

            SecuritySelector(
                selectedSecurity = smtpSecurity,
                onSecuritySelected = { smtpSecurity = it },
                modifier = Modifier.weight(2f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // ─── Test Connection ────────────────────────────────────────────────
        TestConnectionSection(
            testConnectionState = testConnectionState,
            onTestConnection = {
                val currentConfig = EmailAccountConfig(
                    nickname = nickname.trim(),
                    email = email.trim(),
                    displayName = displayName.trim(),
                    username = username.trim(),
                    password = password,
                    imapHost = imapHost.trim(),
                    imapPort = imapPort.trim(),
                    imapSecurity = imapSecurity,
                    smtpHost = smtpHost.trim(),
                    smtpPort = smtpPort.trim(),
                    smtpSecurity = smtpSecurity
                )
                onTestConnection(currentConfig)
            }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // ─── Action Buttons ─────────────────────────────────────────────────
        Button(
            onClick = {
                val config = EmailAccountConfig(
                    nickname = nickname.trim(),
                    email = email.trim(),
                    displayName = displayName.trim(),
                    username = username.trim(),
                    password = password,
                    imapHost = imapHost.trim(),
                    imapPort = imapPort.trim(),
                    imapSecurity = imapSecurity,
                    smtpHost = smtpHost.trim(),
                    smtpPort = smtpPort.trim(),
                    smtpSecurity = smtpSecurity
                )
                onSave(config)
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = email.isNotBlank()
        ) {
            Text(if (isNewAccount) "Add Account" else "Save Account")
        }

        // Delete button (only for existing accounts)
        if (!isNewAccount) {
            OutlinedButton(
                onClick = { showDeleteConfirm = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Delete Account")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

// ─── Test Connection Section ────────────────────────────────────────────────────

/**
 * Displays the Test Connection button and IMAP/SMTP status indicators.
 *
 * Validates: Requirements 60.1-60.4
 */
@Composable
private fun TestConnectionSection(
    testConnectionState: TestConnectionState,
    onTestConnection: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedButton(
            onClick = onTestConnection,
            modifier = Modifier.fillMaxWidth(),
            enabled = !testConnectionState.isTesting
        ) {
            if (testConnectionState.isTesting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Testing…")
            } else {
                Text("Test Connection")
            }
        }

        // IMAP result indicator
        if (testConnectionState.imapResult != null) {
            ConnectionStatusRow(
                label = "IMAP",
                result = testConnectionState.imapResult,
                isSuccess = testConnectionState.imapResult.startsWith("IMAP OK")
            )
        }

        // SMTP result indicator
        if (testConnectionState.smtpResult != null) {
            ConnectionStatusRow(
                label = "SMTP",
                result = testConnectionState.smtpResult,
                isSuccess = testConnectionState.smtpResult.startsWith("SMTP OK")
            )
        }

        // General error message
        if (testConnectionState.errorMessage != null) {
            Text(
                text = testConnectionState.errorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * A single row showing connection test result with a green check or red X icon.
 */
@Composable
private fun ConnectionStatusRow(
    label: String,
    result: String,
    isSuccess: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = if (isSuccess) Icons.Default.Check else Icons.Default.Close,
            contentDescription = if (isSuccess) "$label connected" else "$label failed",
            tint = if (isSuccess) Color(0xFF4CAF50) else Color(0xFFF44336),
            modifier = Modifier.size(20.dp)
        )
        Text(
            text = result,
            style = MaterialTheme.typography.bodyMedium,
            color = if (isSuccess) Color(0xFF4CAF50) else Color(0xFFF44336)
        )
    }
}

// ─── Security Selector ──────────────────────────────────────────────────────────

/**
 * A row of selectable security options: "SSL/TLS", "STARTTLS", "None".
 * Displays as segmented text buttons.
 */
@Composable
private fun SecuritySelector(
    selectedSecurity: String,
    onSecuritySelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(
            text = "Security",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            SECURITY_OPTIONS.forEach { option ->
                val isSelected = selectedSecurity == option
                TextButton(
                    onClick = { onSecuritySelected(option) },
                    colors = ButtonDefaults.textButtonColors(
                        containerColor = if (isSelected)
                            MaterialTheme.colorScheme.primaryContainer
                        else
                            Color.Transparent,
                        contentColor = if (isSelected)
                            MaterialTheme.colorScheme.onPrimaryContainer
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = option,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
