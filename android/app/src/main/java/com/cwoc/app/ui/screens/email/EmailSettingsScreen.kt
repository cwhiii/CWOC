package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentBackground = Color(0xFFFFF8F0)

// ─── Main Screen ────────────────────────────────────────────────────────────────

/**
 * Email Settings screen composable.
 *
 * Displays all email settings organized into sections:
 * - Accounts: pill chips summary + "Manage Accounts" button
 * - Privacy: tracking pixels, external content, read receipts, undo send delay
 * - Display: group by, paginate email
 * - Bundles: enabled, multi-placement, show count, auto-bundle toggles
 * - Signature: inline preview + "Edit Signature" button
 * - Backfill: button with estimate display and confirmation
 *
 * Validates: Requirements 59.1-59.2, 62.1-62.5, 63.1-63.3, 64.1-64.5, 65.1-65.6
 */
@Composable
fun EmailSettingsScreen(
    viewModel: EmailSettingsViewModel,
    onManageAccounts: () -> Unit,
    onEditSignature: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // ─── Accounts Section ────────────────────────────────────────────────────
        AccountsSection(
            accounts = uiState.accounts,
            onManageAccounts = onManageAccounts
        )

        SectionDivider()

        // ─── Privacy Section ─────────────────────────────────────────────────────
        PrivacySection(
            settings = uiState.privacySettings,
            onUpdateSetting = viewModel::updatePrivacySetting
        )

        SectionDivider()

        // ─── Display Section ─────────────────────────────────────────────────────
        DisplaySection(
            settings = uiState.displaySettings,
            onUpdateSetting = viewModel::updateDisplaySetting
        )

        SectionDivider()

        // ─── Bundle Section ──────────────────────────────────────────────────────
        BundleSection(
            settings = uiState.bundleSettings,
            onUpdateSetting = viewModel::updateBundleSetting,
            onToggleAutoBundle = viewModel::toggleAutoBundle
        )

        SectionDivider()

        // ─── Signature Section ───────────────────────────────────────────────────
        SignatureSection(
            signature = uiState.currentSignature,
            onEditSignature = onEditSignature
        )

        SectionDivider()

        // ─── Backfill Section ────────────────────────────────────────────────────
        BackfillSection(
            backfillState = uiState.backfillState,
            onBackfillEstimate = viewModel::backfillEstimate,
            onTriggerBackfill = viewModel::triggerBackfill,
            onClearBackfill = viewModel::clearBackfillState
        )

        Spacer(modifier = Modifier.height(32.dp))
    }
}

// ─── Section Components ─────────────────────────────────────────────────────────

@Composable
private fun SectionDivider() {
    Spacer(modifier = Modifier.height(8.dp))
    HorizontalDivider(color = ParchmentBrown.copy(alpha = 0.2f))
    Spacer(modifier = Modifier.height(8.dp))
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = ParchmentBrown
    )
    Spacer(modifier = Modifier.height(8.dp))
}

// ─── Accounts Section ───────────────────────────────────────────────────────────

/**
 * Displays configured accounts as pill chips and a "Manage Accounts" button.
 * Validates: Requirements 59.1, 59.2
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AccountsSection(
    accounts: List<EmailAccountConfig>,
    onManageAccounts: () -> Unit
) {
    SectionHeader("Accounts")

    if (accounts.isEmpty()) {
        Text(
            text = "No accounts configured",
            style = MaterialTheme.typography.bodyMedium,
            fontStyle = FontStyle.Italic,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    } else {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            accounts.forEach { account ->
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = ParchmentBrown.copy(alpha = 0.1f),
                    tonalElevation = 1.dp
                ) {
                    Text(
                        text = account.email.ifBlank { account.nickname },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }

    Spacer(modifier = Modifier.height(8.dp))

    OutlinedButton(
        onClick = onManageAccounts,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = ParchmentBrown)
    ) {
        Text("Manage Accounts")
    }
}

// ─── Privacy Section ────────────────────────────────────────────────────────────

/**
 * Privacy settings: tracking pixels, external content, read receipts, undo send delay.
 * Validates: Requirements 62.1-62.5
 */
@Composable
private fun PrivacySection(
    settings: EmailPrivacySettings,
    onUpdateSetting: ((EmailPrivacySettings) -> EmailPrivacySettings) -> Unit
) {
    SectionHeader("Privacy")

    // Block Tracking Pixels checkbox (Req 62.1)
    CheckboxRow(
        label = "Block Tracking Pixels",
        checked = settings.blockTrackingPixels,
        onCheckedChange = { checked ->
            onUpdateSetting { it.copy(blockTrackingPixels = checked) }
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // External Content selector (Req 62.2)
    DropdownSelector(
        label = "External Content",
        selectedValue = settings.externalContent,
        options = listOf("allow" to "Allow", "block" to "Block", "known_senders" to "Known Senders"),
        onValueChange = { value ->
            onUpdateSetting { it.copy(externalContent = value) }
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // Read Receipts selector (Req 62.3)
    DropdownSelector(
        label = "Read Receipts",
        selectedValue = settings.readReceipts,
        options = listOf(
            "never" to "Never",
            "always" to "Always",
            "ask" to "Ask",
            "contacts_only" to "Contacts Only"
        ),
        onValueChange = { value ->
            onUpdateSetting { it.copy(readReceipts = value) }
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // Undo Send Delay number input (Req 62.4)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "Undo Send Delay (seconds)",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
        OutlinedTextField(
            value = settings.undoSendDelay.toString(),
            onValueChange = { newValue ->
                val delay = newValue.filter { it.isDigit() }.toIntOrNull() ?: 5
                onUpdateSetting { it.copy(undoSendDelay = delay.coerceIn(0, 30)) }
            },
            modifier = Modifier.width(80.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true
        )
    }
}

// ─── Display Section ────────────────────────────────────────────────────────────

/**
 * Display settings: group by, paginate email.
 * Validates: Requirements 63.1-63.3
 */
@Composable
private fun DisplaySection(
    settings: EmailDisplaySettings,
    onUpdateSetting: ((EmailDisplaySettings) -> EmailDisplaySettings) -> Unit
) {
    SectionHeader("Display")

    // Group By selector (Req 63.1)
    DropdownSelector(
        label = "Group By",
        selectedValue = settings.groupBy,
        options = listOf("date" to "Date", "none" to "None"),
        onValueChange = { value ->
            onUpdateSetting { it.copy(groupBy = value) }
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // Paginate Email checkbox (Req 63.2)
    CheckboxRow(
        label = "Paginate Email",
        checked = settings.paginateEmail,
        onCheckedChange = { checked ->
            onUpdateSetting { it.copy(paginateEmail = checked) }
        }
    )
}

// ─── Bundle Section ─────────────────────────────────────────────────────────────

/**
 * Bundle settings: enabled, multi-placement, show count, auto-bundle toggles.
 * Validates: Requirements 64.1-64.5
 */
@Composable
private fun BundleSection(
    settings: EmailBundleSettings,
    onUpdateSetting: ((EmailBundleSettings) -> EmailBundleSettings) -> Unit,
    onToggleAutoBundle: (String, Boolean) -> Unit
) {
    SectionHeader("Bundles")

    // Bundles Enabled checkbox (Req 64.1)
    CheckboxRow(
        label = "Bundles Enabled",
        checked = settings.bundlesEnabled,
        onCheckedChange = { checked ->
            onUpdateSetting { it.copy(bundlesEnabled = checked) }
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // Multi-Placement checkbox (Req 64.2)
    CheckboxRow(
        label = "Multi-Placement",
        checked = settings.multiPlacement,
        onCheckedChange = { checked ->
            onUpdateSetting { it.copy(multiPlacement = checked) }
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // Show Count selector (Req 64.3)
    DropdownSelector(
        label = "Show Count",
        selectedValue = settings.showCount,
        options = listOf(
            "both" to "Both",
            "unread" to "Unread",
            "total" to "Total",
            "none" to "None"
        ),
        onValueChange = { value ->
            onUpdateSetting { it.copy(showCount = value) }
        }
    )

    Spacer(modifier = Modifier.height(12.dp))

    // Auto-bundle toggles (Req 64.4, 64.5)
    Text(
        text = "Auto-Bundles",
        style = MaterialTheme.typography.bodyMedium,
        fontWeight = FontWeight.SemiBold
    )
    Spacer(modifier = Modifier.height(4.dp))

    val autoBundleNames = listOf("Newsletters", "Receipts", "Calendar Invites")
    val autoBundles = settings.autoBundles.filter { bundle ->
        autoBundleNames.any { name ->
            bundle.name?.contains(name, ignoreCase = true) == true
        }
    }

    if (autoBundles.isEmpty()) {
        // Show default auto-bundle names when no bundles loaded yet
        autoBundleNames.forEach { name ->
            AutoBundleToggleRow(
                name = name,
                enabled = true,
                onToggle = { /* No bundle ID available yet */ }
            )
        }
    } else {
        autoBundles.forEach { bundle ->
            AutoBundleToggleRow(
                name = bundle.name ?: "Unknown",
                enabled = bundle.removable != false,
                onToggle = { enabled ->
                    onToggleAutoBundle(bundle.id, enabled)
                }
            )
        }
    }
}

@Composable
private fun AutoBundleToggleRow(
    name: String,
    enabled: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
        Switch(
            checked = enabled,
            onCheckedChange = onToggle
        )
    }
}

// ─── Signature Section ──────────────────────────────────────────────────────────

/**
 * Signature section: inline preview of first 2-3 lines + "Edit Signature" button.
 * Validates: Requirements 61.1 (inline preview + edit button)
 */
@Composable
private fun SignatureSection(
    signature: String,
    onEditSignature: () -> Unit
) {
    SectionHeader("Signature")

    if (signature.isBlank()) {
        Text(
            text = "No signature configured",
            style = MaterialTheme.typography.bodyMedium,
            fontStyle = FontStyle.Italic,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    } else {
        // Show first 2-3 lines of the markdown signature in a Surface
        val previewLines = signature.lines().take(3).joinToString("\n")
        Surface(
            shape = MaterialTheme.shapes.small,
            color = ParchmentBackground,
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = previewLines,
                modifier = Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodySmall,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
    }

    Spacer(modifier = Modifier.height(8.dp))

    OutlinedButton(
        onClick = onEditSignature,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = ParchmentBrown)
    ) {
        Text("Edit Signature")
    }
}

// ─── Backfill Section ───────────────────────────────────────────────────────────

/**
 * Backfill section: button that fetches estimate, shows it, then confirms to trigger.
 * Validates: Requirements 65.1-65.6
 */
@Composable
private fun BackfillSection(
    backfillState: BackfillState,
    onBackfillEstimate: () -> Unit,
    onTriggerBackfill: () -> Unit,
    onClearBackfill: () -> Unit
) {
    SectionHeader("Backfill")

    Text(
        text = "Import all historical emails from your accounts.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )

    Spacer(modifier = Modifier.height(8.dp))

    var showConfirmDialog by remember { mutableStateOf(false) }

    // Show estimate or result if available
    if (backfillState.estimateMessage != null && backfillState.resultMessage == null) {
        Surface(
            shape = MaterialTheme.shapes.small,
            color = ParchmentBackground,
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = backfillState.estimateMessage,
                modifier = Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodyMedium
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
    }

    if (backfillState.resultMessage != null) {
        Surface(
            shape = MaterialTheme.shapes.small,
            color = ParchmentBackground,
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = backfillState.resultMessage,
                modifier = Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodyMedium
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
    }

    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (backfillState.isInProgress) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.CenterVertically),
                color = ParchmentBrown
            )
        } else if (backfillState.estimateMessage != null && backfillState.resultMessage == null) {
            // Estimate is showing — offer confirm/cancel
            Button(
                onClick = { showConfirmDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Start Backfill")
            }
            OutlinedButton(
                onClick = onClearBackfill,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = ParchmentBrown)
            ) {
                Text("Cancel")
            }
        } else {
            // Initial state or after result — show Backfill button
            Button(
                onClick = onBackfillEstimate,
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Backfill")
            }
            if (backfillState.resultMessage != null) {
                OutlinedButton(
                    onClick = onClearBackfill,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ParchmentBrown)
                ) {
                    Text("Dismiss")
                }
            }
        }
    }

    // Confirmation dialog (Req 65.3, 65.6)
    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Confirm Backfill") },
            text = {
                Text(
                    "This will import all historical emails (${backfillState.estimateMessage}). " +
                            "This may take a while. Proceed?"
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showConfirmDialog = false
                    onTriggerBackfill()
                }) {
                    Text("Proceed")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ─── Shared UI Components ───────────────────────────────────────────────────────

/**
 * A row with a checkbox and label text.
 */
@Composable
private fun CheckboxRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

/**
 * A labeled dropdown selector using ExposedDropdownMenuBox.
 * @param label The label displayed above the dropdown
 * @param selectedValue The current value (key)
 * @param options List of (key, displayLabel) pairs
 * @param onValueChange Called with the selected key when user picks an option
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownSelector(
    label: String,
    selectedValue: String,
    options: List<Pair<String, String>>,
    onValueChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.find { it.first == selectedValue }?.second ?: selectedValue

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(4.dp))
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = selectedLabel,
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                singleLine = true
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { (key, displayLabel) ->
                    DropdownMenuItem(
                        text = { Text(displayLabel) },
                        onClick = {
                            onValueChange(key)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
