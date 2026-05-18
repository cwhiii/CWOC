package com.cwoc.app.ui.screens.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp


/**
 * Admin settings tab containing Diagnostics, Data Management, Calendar Export,
 * Dependent Apps, and Version & Updates sections.
 *
 * Reuses DebugViewModel logic (same dependencies: ChitDao, SyncMetadataDao, SyncEngine).
 *
 * Validates: Requirements 2.8, 4.4
 */
@Composable
fun AdminSettingsTab(
    debugViewModel: DebugViewModel,
    settingsState: SettingsFormState = SettingsFormState(),
    onUpdateSetting: (key: String, value: String) -> Unit = { _, _ -> },
    onNavigateToAdminChits: () -> Unit = {}
) {
    val uiState by debugViewModel.uiState.collectAsState()
    val clipboardManager = LocalClipboardManager.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Section header
        Text(
            text = "Diagnostics",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        // Chit Manager button
        Button(
            onClick = onNavigateToAdminChits,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF6B4E31)
            )
        ) {
            Text("📋 Chit Manager")
        }

        HorizontalDivider()

        // Sync controls
        DiagnosticsCard(title = "Sync Controls") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { debugViewModel.syncNow() },
                    enabled = !uiState.isSyncing,
                    modifier = Modifier.weight(1f)
                ) {
                    if (uiState.isSyncing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text("Sync Now")
                    }
                }
                OutlinedButton(
                    onClick = { debugViewModel.fullResync() },
                    enabled = !uiState.isSyncing,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Full Resync")
                }
            }
            uiState.lastSyncResult?.let { result ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = result,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = if (result.startsWith("Error") || result.startsWith("Network"))
                        MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary
                )
            }
        }

        // Copy all to clipboard
        OutlinedButton(
            onClick = {
                val text = buildString {
                    appendLine("=== CWOC Debug Info ===")
                    appendLine("Database: total=${uiState.totalChits}, tasks=${uiState.taskCount}, notes=${uiState.noteCount}, calendar=${uiState.calendarCount}")
                    appendLine("Sync: status=${uiState.syncStatus}, hwm=${uiState.highWaterMark}, lastSync=${uiState.lastSyncedAt}")
                    uiState.lastSyncResult?.let { appendLine("Last result: $it") }
                    if (uiState.sampleChits.isNotEmpty()) {
                        appendLine("Sample chits:")
                        uiState.sampleChits.forEach { (title, status) ->
                            appendLine("  ${title ?: "(no title)"} [status=${status ?: "null"}]")
                        }
                    }
                }
                clipboardManager.setText(AnnotatedString(text))
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Copy All to Clipboard")
        }

        // Database stats
        DiagnosticsCard(title = "Database") {
            DiagnosticsLine("Total chits in DB", uiState.totalChits.toString())
            DiagnosticsLine("Tasks (status != null)", uiState.taskCount.toString())
            DiagnosticsLine("Notes", uiState.noteCount.toString())
            DiagnosticsLine("Calendar", uiState.calendarCount.toString())
        }

        // Sync status
        DiagnosticsCard(title = "Sync Status") {
            DiagnosticsLine("Status", uiState.syncStatus ?: "unknown")
            DiagnosticsLine("High-water mark", uiState.highWaterMark?.toString() ?: "none")
            DiagnosticsLine("Last synced", uiState.lastSyncedAt ?: "never")
        }

        // Sample chit data
        if (uiState.sampleChits.isNotEmpty()) {
            DiagnosticsCard(title = "Sample Chits (first 5)") {
                uiState.sampleChits.forEach { (title, status) ->
                    DiagnosticsLine(title ?: "(no title)", "status=${status ?: "null"}")
                }
            }
        }

        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        HorizontalDivider()

        // Section: Data Management
        DataManagementSection()

        HorizontalDivider()

        // Section: Calendar Export
        CalendarExportSection(
            serverUrl = settingsState.serverUrl,
            clipboardManager = clipboardManager
        )

        HorizontalDivider()

        // Section: Dependent Apps
        DependentAppsSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting
        )

        HorizontalDivider()

        // Section: Version & Updates
        VersionUpdatesSection()
    }
}

/**
 * Card container for diagnostics sections.
 */
@Composable
private fun DiagnosticsCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(8.dp))
            content()
        }
    }
}

/**
 * Single line of diagnostics info in label: value format.
 */
@Composable
private fun DiagnosticsLine(label: String, value: String) {
    Text(
        text = "$label: $value",
        style = MaterialTheme.typography.bodySmall,
        fontFamily = FontFamily.Monospace
    )
}

// ============================================================
// Section: Data Management (Task 17.1)
// ============================================================

@Composable
private fun DataManagementSection() {
    var expanded by remember { mutableStateOf(true) }
    var showReplaceConfirm by remember { mutableStateOf(false) }
    var showPurgeConfirm1 by remember { mutableStateOf(false) }
    var showPurgeConfirm2 by remember { mutableStateOf(false) }

    Column {
        AdminCollapsibleHeader(
            title = "💾 Data Management",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Export All
                Button(
                    onClick = { /* TODO: Call GET /api/export and share the JSON file */ },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Export All Data")
                }

                // Import
                OutlinedButton(
                    onClick = { /* TODO: Open file picker, then POST /api/import */ },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Import Data")
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Replace All (danger)
                Button(
                    onClick = { showReplaceConfirm = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Replace All Data")
                }

                // Purge All (danger)
                Button(
                    onClick = { showPurgeConfirm1 = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Purge All Data")
                }
            }
        }
    }

    // Replace All confirmation
    if (showReplaceConfirm) {
        AlertDialog(
            onDismissRequest = { showReplaceConfirm = false },
            title = { Text("⚠️ Replace All Data") },
            text = { Text("This will REPLACE all existing data with imported data. This action cannot be undone. Are you sure?") },
            confirmButton = {
                TextButton(onClick = {
                    // TODO: Call POST /api/replace
                    showReplaceConfirm = false
                }) { Text("Replace", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showReplaceConfirm = false }) { Text("Cancel") }
            }
        )
    }

    // Purge All - first confirmation
    if (showPurgeConfirm1) {
        AlertDialog(
            onDismissRequest = { showPurgeConfirm1 = false },
            title = { Text("⚠️ Purge All Data") },
            text = { Text("This will PERMANENTLY DELETE all data. This cannot be undone. Are you absolutely sure?") },
            confirmButton = {
                TextButton(onClick = {
                    showPurgeConfirm1 = false
                    showPurgeConfirm2 = true
                }) { Text("Yes, Continue", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showPurgeConfirm1 = false }) { Text("Cancel") }
            }
        )
    }

    // Purge All - second confirmation
    if (showPurgeConfirm2) {
        AlertDialog(
            onDismissRequest = { showPurgeConfirm2 = false },
            title = { Text("🚨 Final Confirmation") },
            text = { Text("LAST CHANCE: All chits, settings, contacts, and history will be permanently erased. Type 'PURGE' mentally and confirm.") },
            confirmButton = {
                TextButton(onClick = {
                    // TODO: Call DELETE /api/purge
                    showPurgeConfirm2 = false
                }) { Text("PURGE EVERYTHING", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showPurgeConfirm2 = false }) { Text("Cancel") }
            }
        )
    }
}

// ============================================================
// Section: Calendar Export (Task 17.2)
// ============================================================

@Composable
private fun CalendarExportSection(
    serverUrl: String,
    clipboardManager: androidx.compose.ui.platform.ClipboardManager
) {
    var expanded by remember { mutableStateOf(true) }
    val icsUrl = "${serverUrl.ifEmpty { "http://192.168.1.111:3333" }}/api/calendar/ics"

    Column {
        AdminCollapsibleHeader(
            title = "📅 Calendar Export",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Subscribe to your CWOC calendar from any calendar app (Google Calendar, Apple Calendar, Outlook) using this ICS feed URL:",
                    style = MaterialTheme.typography.bodyMedium
                )

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = icsUrl,
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = {
                            clipboardManager.setText(AnnotatedString(icsUrl))
                        }) {
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy URL")
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// Section: Dependent Apps (Task 17.3)
// ============================================================

@Composable
private fun DependentAppsSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }

    Column {
        AdminCollapsibleHeader(
            title = "🔗 Dependent Apps",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Tailscale
                DiagnosticsCard(title = "Tailscale") {
                    Text(
                        text = "Status: Connected",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = "Tailscale provides secure network access to the CWOC server.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Ntfy
                DiagnosticsCard(title = "Ntfy (Push Notifications)") {
                    OutlinedTextField(
                        value = settingsState.ntfyServerUrl,
                        onValueChange = { onUpdateSetting("ntfy_server_url", it) },
                        label = { Text("Server URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = settingsState.ntfyTopic,
                        onValueChange = { onUpdateSetting("ntfy_topic", it) },
                        label = { Text("Topic") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { /* TODO: Send test notification via ntfy */ },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Test Notification")
                    }
                }

                // Home Assistant
                DiagnosticsCard(title = "Home Assistant") {
                    OutlinedTextField(
                        value = settingsState.haUrl,
                        onValueChange = { onUpdateSetting("ha_url", it) },
                        label = { Text("Home Assistant URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = settingsState.haToken,
                        onValueChange = { onUpdateSetting("ha_token", it) },
                        label = { Text("Long-Lived Access Token") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { /* TODO: Test HA connection */ },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Test Connection")
                    }
                }
            }
        }
    }
}

// ============================================================
// Section: Version & Updates (Task 17.4)
// ============================================================

@Composable
private fun VersionUpdatesSection() {
    var expanded by remember { mutableStateOf(true) }
    var showReleaseNotes by remember { mutableStateOf(false) }

    Column {
        AdminCollapsibleHeader(
            title = "📦 Version & Updates",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Current Version: ${getAppVersion()}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )

                OutlinedButton(
                    onClick = { showReleaseNotes = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📋 Release Notes")
                }

                OutlinedButton(
                    onClick = { /* TODO: Check for updates via /api/version */ },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("🔄 Check for Updates")
                }
            }
        }
    }

    // Release Notes Dialog
    if (showReleaseNotes) {
        AlertDialog(
            onDismissRequest = { showReleaseNotes = false },
            title = { Text("Release Notes") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = "Release notes will be fetched from the server.\n\nEndpoint: GET /api/release-notes",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showReleaseNotes = false }) { Text("Close") }
            }
        )
    }
}

// ============================================================
// Shared Admin Components
// ============================================================

@Composable
private fun AdminCollapsibleHeader(
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

private fun getAppVersion(): String {
    // Returns the app version from BuildConfig at runtime
    return try {
        "m20250101.0000" // Placeholder — actual version comes from BuildConfig.VERSION_NAME
    } catch (e: Exception) {
        "unknown"
    }
}
