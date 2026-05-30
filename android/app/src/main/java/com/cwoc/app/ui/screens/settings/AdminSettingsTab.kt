package com.cwoc.app.ui.screens.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import com.cwoc.app.ui.theme.CwocButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.MutableState
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
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Checkbox
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.platform.LocalContext
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.components.CwocSectionHeading
import com.cwoc.app.ui.screens.settings.components.CollapsibleSection
import com.cwoc.app.ui.screens.settings.components.UpgradeModal
import com.cwoc.app.ui.screens.settings.components.UpgradeModalMode
import com.cwoc.app.ui.components.ReleaseNotesDialog
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.BackupConfigSaveRequestDto
import com.cwoc.app.data.remote.dto.BackupSnapshotDto
import com.cwoc.app.data.remote.dto.BackupTargetDto
import com.cwoc.app.data.remote.dto.NotificationRecipientsDto
import com.cwoc.app.data.remote.dto.OrphanRepoDto
import com.cwoc.app.data.remote.dto.RetentionPolicyDto
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.material3.RadioButton
import okhttp3.OkHttpClient
import org.json.JSONArray
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocInputDefaults
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocSurface

/**
 * Admin settings tab containing Administration, Diagnostics, Data Management, Calendar Export,
 * Dependent Apps, and Version & Updates sections.
 *
 * Reuses DebugViewModel logic (same dependencies: ChitDao, SyncMetadataDao, SyncEngine).
 *
 * Validates: Requirements 2.8, 4.4, 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 24.1-24.16
 */
@Composable
fun AdminSettingsTab(
    debugViewModel: DebugViewModel,
    settingsState: SettingsFormState = SettingsFormState(),
    onUpdateSetting: (key: String, value: String) -> Unit = { _, _ -> },
    onNavigateToAdminChits: () -> Unit = {},
    onNavigateToUserAdmin: () -> Unit = {},
    onNavigateToAuditLog: () -> Unit = {},
    onNavigateToTrash: () -> Unit = {},
    onNavigateToCustomObjects: () -> Unit = {},
    onNavigateToKiosk: (selectedTags: List<String>) -> Unit = {},
    settingsViewModel: SettingsViewModel? = null,
    apiService: CwocApiService? = null,
    authToken: String = "",
    isAdmin: Boolean = true,
    okHttpClient: OkHttpClient? = null
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
        // ============================================================
        // Section: Administration (Task 29.1)
        // Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7
        // ============================================================
        AdministrationSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            onNavigateToUserAdmin = onNavigateToUserAdmin
        )

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // ============================================================
        // Section: Kiosk (Task 30.1)
        // Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5
        // ============================================================
        KioskSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            onNavigateToKiosk = onNavigateToKiosk
        )

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // Section header
        CwocSectionHeading(text = "Diagnostics")

        // Chit Manager button
        Button(
            onClick = onNavigateToAdminChits,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocButtonDefaults.outsetColors(),
            border = CwocButtonDefaults.outsetBorder,
            shape = CwocButtonDefaults.outsetShape
        ) {
            Text("📋 Chit Manager")
        }

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // Sync controls
        DiagnosticsCard(title = "Sync Controls") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { debugViewModel.syncNow() },
                    enabled = !uiState.isSyncing,
                    modifier = Modifier.weight(1f),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
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
                    modifier = Modifier.weight(1f),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
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
            modifier = Modifier.fillMaxWidth(),
            colors = CwocButtonDefaults.outsetColors(),
            border = CwocButtonDefaults.outsetBorder,
            shape = CwocButtonDefaults.outsetShape
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

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // Section: Data Management
        DataManagementSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            onNavigateToAuditLog = onNavigateToAuditLog,
            onNavigateToTrash = onNavigateToTrash,
            onNavigateToCustomObjects = onNavigateToCustomObjects
        )

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // Section: Calendar Export
        CalendarExportSection(
            serverUrl = settingsState.serverUrl,
            clipboardManager = clipboardManager
        )

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // Section: Dependent Apps
        DependentAppsSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            settingsViewModel = settingsViewModel
        )

        HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

        // Section: Version & Updates
        // Validates: Requirements 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8
        VersionUpdatesSection(
            apiService = apiService,
            serverUrl = settingsState.serverUrl,
            authToken = authToken,
            isAdmin = isAdmin,
            timeFormat = settingsState.timeFormat,
            okHttpClient = okHttpClient
        )
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
// Section: Administration (Task 29.1)
// Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7
// ============================================================

/**
 * Administration section with Manage Users button, Instance Name input,
 * Welcome Message textarea with live markdown preview, and Session Lifetime dropdown.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdministrationSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    onNavigateToUserAdmin: () -> Unit
) {
    // Debounced welcome message for markdown preview (500ms delay)
    var debouncedWelcomeMessage by remember { mutableStateOf(settingsState.welcomeMessage) }

    // Update debounced value with 500ms delay after last keystroke
    LaunchedEffect(settingsState.welcomeMessage) {
        delay(500L)
        debouncedWelcomeMessage = settingsState.welcomeMessage
    }

    // Session lifetime options: display label -> stored value
    val sessionLifetimeOptions = listOf(
        "1 hour" to "1",
        "12 hours" to "12",
        "24 hours" to "24",
        "1 week" to "168",
        "1 month" to "720",
        "Never" to "0"
    )

    // Find the display label for the current stored value
    val currentSessionLabel = sessionLifetimeOptions
        .firstOrNull { it.second == settingsState.sessionLifetime }?.first ?: "24 hours"

    CollapsibleSection(
        title = "🔧 Administration",
        sectionId = "administration",
        defaultExpanded = false
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Manage Users button — Validates: Requirement 22.1
            Button(
                onClick = onNavigateToUserAdmin,
                modifier = Modifier.fillMaxWidth(),
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                Text("👥 Manage Users")
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Instance Name — Validates: Requirement 22.2
            Text(
                text = "Instance Name",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            OutlinedTextField(
                value = settingsState.instanceName,
                onValueChange = { newValue ->
                    if (newValue.length <= 100) {
                        onUpdateSetting("instance_name", newValue)
                    }
                },
                label = { Text("Instance Name") },
                placeholder = { Text("My CWOC Instance") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                supportingText = {
                    Text("${settingsState.instanceName.length} / 100")
                },
                colors = CwocInputDefaults.outlinedColors()
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Welcome Message — Validates: Requirements 22.3, 22.4
            Text(
                text = "Welcome Message",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            OutlinedTextField(
                value = settingsState.welcomeMessage,
                onValueChange = { newValue ->
                    if (newValue.length <= 5000) {
                        onUpdateSetting("welcome_message", newValue)
                    }
                },
                label = { Text("Welcome Message (Markdown)") },
                placeholder = { Text("Enter a welcome message shown on the login screen...") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp),
                maxLines = 10,
                supportingText = {
                    Text("${settingsState.welcomeMessage.length} / 5000 • Markdown supported")
                },
                colors = CwocInputDefaults.outlinedColors()
            )

            // Rendered markdown preview — Validates: Requirement 22.4
            // Updates within 500ms of last keystroke via debounced state
            if (debouncedWelcomeMessage.isNotBlank()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "Preview",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        MarkdownRenderer(
                            markdown = debouncedWelcomeMessage,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Session Lifetime dropdown — Validates: Requirement 22.5
            Text(
                text = "Session Lifetime",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )

            var sessionDropdownExpanded by remember { mutableStateOf(false) }

            ExposedDropdownMenuBox(
                expanded = sessionDropdownExpanded,
                onExpandedChange = { sessionDropdownExpanded = it },
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = currentSessionLabel,
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = sessionDropdownExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )
                ExposedDropdownMenu(
                    expanded = sessionDropdownExpanded,
                    onDismissRequest = { sessionDropdownExpanded = false }
                ) {
                    sessionLifetimeOptions.forEach { (label, value) ->
                        DropdownMenuItem(
                            text = { Text(label) },
                            onClick = {
                                onUpdateSetting("session_lifetime", value)
                                sessionDropdownExpanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                        )
                    }
                }
            }

            Text(
                text = "How long user sessions remain active before requiring re-authentication.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// ============================================================
// Section: Kiosk (Task 30.1)
// Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5
// ============================================================

/**
 * Kiosk configuration section.
 * Displays a collapsible section with a hint about parent/child tag behavior,
 * a scrollable hierarchical tag selection list (excluding system tags),
 * and an "Open Kiosk" button that navigates to the kiosk view with selected tags.
 *
 * Checking a parent does NOT auto-check children — the kiosk display itself
 * handles inclusion of child tag chits when a parent is selected.
 *
 * Persists kiosk tag selection via the kiosk_selected_tags setting key (JSON array of tag names).
 */
@Composable
private fun KioskSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    onNavigateToKiosk: (selectedTags: List<String>) -> Unit
) {
    val context = LocalContext.current

    // System tags to exclude from the kiosk tag list
    val systemTags = remember {
        setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")
    }

    // Parse user tags from sharedTags JSON, excluding system tags
    val userTags = remember(settingsState.sharedTags) {
        parseKioskTagsFromJson(settingsState.sharedTags, systemTags)
    }

    // Build hierarchical tree from user tags
    val tagTree = remember(userTags) { buildKioskTagTree(userTags) }

    // Parse currently selected kiosk tags from settings
    val selectedTags = remember(settingsState.kioskSelectedTags) {
        parseKioskSelectedTags(settingsState.kioskSelectedTags).toMutableStateList()
    }

    CollapsibleSection(
        title = "🖥️ Kiosk",
        sectionId = "admin_kiosk",
        defaultExpanded = false
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Hint about parent/child tag behavior
            Text(
                text = "Selecting a parent tag automatically includes all child tags in the kiosk display. Checking a parent here does not auto-check children — the kiosk handles inclusion.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Scrollable tag selection list (max 200px height)
            if (tagTree.isEmpty()) {
                Text(
                    text = "No user-created tags available.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    tagTree.forEach { node ->
                        KioskTagTreeNode(
                            node = node,
                            selectedTags = selectedTags,
                            onTagToggled = { tagName ->
                                if (tagName in selectedTags) {
                                    selectedTags.remove(tagName)
                                } else {
                                    selectedTags.add(tagName)
                                }
                                // Persist selection to settings
                                val json = JSONArray(selectedTags.toList()).toString()
                                onUpdateSetting("kiosk_selected_tags", json)
                            },
                            depth = 0
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Open Kiosk button
            Button(
                onClick = {
                    if (selectedTags.isEmpty()) {
                        Toast.makeText(
                            context,
                            "Please select at least one tag for kiosk mode",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        onNavigateToKiosk(selectedTags.toList())
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                Text("🖥️ Open Kiosk")
            }
        }
    }
}

/**
 * Renders a single node in the kiosk tag tree with a checkbox.
 * Recursively renders children with increased indentation.
 */
@Composable
private fun KioskTagTreeNode(
    node: KioskTagNode,
    selectedTags: List<String>,
    onTagToggled: (String) -> Unit,
    depth: Int
) {
    val isChecked = node.fullPath in selectedTags

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = (depth * 24).dp)
            .clickable { onTagToggled(node.fullPath) },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = isChecked,
            onCheckedChange = { onTagToggled(node.fullPath) }
        )
        Text(
            text = node.displayName,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(start = 4.dp)
        )
    }

    // Render children recursively
    node.children.forEach { child ->
        KioskTagTreeNode(
            node = child,
            selectedTags = selectedTags,
            onTagToggled = onTagToggled,
            depth = depth + 1
        )
    }
}

/**
 * Data class representing a node in the kiosk tag tree.
 */
private data class KioskTagNode(
    val displayName: String,   // Last segment of the tag name
    val fullPath: String,      // Full tag path (e.g., "Work/Projects")
    val children: MutableList<KioskTagNode> = mutableListOf()
)

/**
 * Parses the sharedTags JSON array and returns a list of tag names,
 * excluding system tags.
 */
private fun parseKioskTagsFromJson(json: String, systemTags: Set<String>): List<String> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).mapNotNull { i ->
            val obj = array.getJSONObject(i)
            val name = obj.optString("name", "")
            if (name.isNotEmpty() && name !in systemTags && !name.startsWith("CWOC_System/")) {
                name
            } else {
                null
            }
        }
    } catch (e: Exception) {
        emptyList()
    }
}

/**
 * Builds a hierarchical tree of KioskTagNode from a flat list of tag names.
 * Uses "/" as the delimiter for parent-child relationships.
 */
private fun buildKioskTagTree(tagNames: List<String>): List<KioskTagNode> {
    val root = mutableListOf<KioskTagNode>()
    val nodeMap = mutableMapOf<String, KioskTagNode>()

    tagNames.sorted().forEach { tagName ->
        val parts = tagName.split("/")
        var currentLevel = root
        var pathSoFar = ""

        parts.forEachIndexed { index, part ->
            pathSoFar = if (pathSoFar.isEmpty()) part else "$pathSoFar/$part"

            if (!nodeMap.containsKey(pathSoFar)) {
                val node = KioskTagNode(
                    displayName = part,
                    fullPath = pathSoFar
                )
                nodeMap[pathSoFar] = node
                currentLevel.add(node)
            }
            currentLevel = nodeMap[pathSoFar]!!.children
        }
    }

    return root
}

/**
 * Parses the kiosk_selected_tags JSON array string into a list of tag names.
 */
private fun parseKioskSelectedTags(json: String): List<String> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i -> array.getString(i) }
    } catch (e: Exception) {
        emptyList()
    }
}

// ============================================================
// Section: Data Management (Task 31.1)
// Validates: Requirements 24.1-24.16
// ============================================================

@Composable
private fun DataManagementSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    onNavigateToAuditLog: () -> Unit,
    onNavigateToTrash: () -> Unit,
    onNavigateToCustomObjects: () -> Unit
) {
    var showExportDialog by remember { mutableStateOf(false) }
    var showImportDialog by remember { mutableStateOf(false) }
    var showImportModeDialog by remember { mutableStateOf(false) }
    var importModeTarget by remember { mutableStateOf("") } // "chit", "user", "all", "calendar", "google_tasks", "google_keep"
    var showReplaceConfirm by remember { mutableStateOf(false) }
    var showPurgeConfirm1 by remember { mutableStateOf(false) }
    var showPurgeConfirm2 by remember { mutableStateOf(false) }
    var importError by remember { mutableStateOf<String?>(null) }
    var selectedImportUser by remember { mutableStateOf("") } // For calendar import user selection

    CollapsibleSection(
        title = "💾 Data Management",
        sectionId = "admin_data_management",
        defaultExpanded = false
    ) {
            Column(
                modifier = Modifier.padding(start = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // ── Export & Import Buttons ──
                CwocSectionHeading(text = "Export & Import")
                Text(
                    text = "Export your data as JSON files or import from a previous export. For automated encrypted backups, see Restic Backup below.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { showExportDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("📤 Export Data")
                    }
                    Button(
                        onClick = { showImportDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("📥 Import Data")
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))

                // ── Import Batches (Req 24.6) ──
                ImportBatchesSubsection()

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))

                // ── Navigation Buttons (Req 24.7, 24.8, 24.9) ──
                CwocSectionHeading(text = "Navigation")
                OutlinedButton(
                    onClick = onNavigateToAuditLog,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("📜 Audit Log")
                }
                OutlinedButton(
                    onClick = onNavigateToTrash,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("🗑️ Trash")
                }
                OutlinedButton(
                    onClick = onNavigateToCustomObjects,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("🧩 Custom Objects")
                }

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))

                // ── Audit Log Limits (Req 24.10) ──
                AuditLogLimitsSubsection(
                    settingsState = settingsState,
                    onUpdateSetting = onUpdateSetting
                )

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))

                // ── Attachment Limits (Req 24.11) ──
                AttachmentLimitsSubsection(
                    settingsState = settingsState,
                    onUpdateSetting = onUpdateSetting
                )

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                Spacer(modifier = Modifier.height(12.dp))

                // ── Purge All Data (Req 24.16) ──
                Button(
                    onClick = { showPurgeConfirm1 = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.dangerColors(),
                    border = CwocButtonDefaults.dangerBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("🚨 Purge All Data")
                }

                // Show import error if any (Req 24.15)
                importError?.let { error ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
    }

    // ── Export Data Dialog ──
    if (showExportDialog) {
        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("📤 Export Data", style = CwocDialogDefaults.titleStyle) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Download your data as JSON files for backup or migration.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedButton(
                        onClick = {
                            showExportDialog = false
                            // TODO: GET /api/export/all → share sheet
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("🌐 All Data", fontWeight = FontWeight.Bold)
                            Text("Chits, settings, tags, colors, contacts, alerts", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            showExportDialog = false
                            // TODO: GET /api/export/chits → share sheet
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("📝 Chit Data Only", fontWeight = FontWeight.Bold)
                            Text("All chits including deleted chits", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            showExportDialog = false
                            // TODO: GET /api/export/userdata → share sheet
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("👤 User Data Only", fontWeight = FontWeight.Bold)
                            Text("Settings, tags, colors, saved locations, contacts", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showExportDialog = false }) { Text("Close") }
            }
        )
    }

    // ── Import Data Dialog ──
    if (showImportDialog) {
        AlertDialog(
            onDismissRequest = { showImportDialog = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("📥 Import Data", style = CwocDialogDefaults.titleStyle) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Restore from a previous CWOC export, or import from external apps.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text("From CWOC Export", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(
                        onClick = {
                            showImportDialog = false
                            importModeTarget = "all"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("🌐 Import All Data", fontWeight = FontWeight.Bold)
                            Text("From a combined export file", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            showImportDialog = false
                            importModeTarget = "chit"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("📝 Import Chit Data", fontWeight = FontWeight.Bold)
                            Text("From a chit-only export file", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            showImportDialog = false
                            importModeTarget = "user"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("👤 Import User Data", fontWeight = FontWeight.Bold)
                            Text("From a user data export file", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("From External Apps", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(
                        onClick = {
                            showImportDialog = false
                            importModeTarget = "calendar"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("📅 Calendar (.ics)", fontWeight = FontWeight.Bold)
                            Text("Google Calendar, Apple Calendar, or Outlook", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            showImportDialog = false
                            importModeTarget = "google_tasks"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("✅ Google Tasks (.json)", fontWeight = FontWeight.Bold)
                            Text("From Google Takeout export", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            showImportDialog = false
                            importModeTarget = "google_keep"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()) {
                            Text("📝 Google Keep (.json)", fontWeight = FontWeight.Bold)
                            Text("From Google Takeout export (multiple files)", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showImportDialog = false }) { Text("Close") }
            }
        )
    }

    // ── Import Mode Dialog (Req 24.12) ──
    if (showImportModeDialog) {
        AlertDialog(
            onDismissRequest = {
                showImportModeDialog = false
                importModeTarget = ""
            },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Import Mode", style = CwocDialogDefaults.titleStyle) },
            text = { Text("How would you like to import this data?") },
            confirmButton = {
                TextButton(onClick = {
                    showImportModeDialog = false
                    // "Add to existing" mode — proceed to file selection
                    // TODO: Open file picker with importModeTarget type, mode = "add"
                    importModeTarget = ""
                }, colors = CwocDialogDefaults.confirmButtonColors()) { Text("Add to existing") }
            },
            dismissButton = {
                Column {
                    TextButton(onClick = {
                        showImportModeDialog = false
                        showReplaceConfirm = true
                    }, colors = CwocDialogDefaults.confirmButtonColors()) { Text("Replace all data", color = MaterialTheme.colorScheme.error) }
                    TextButton(onClick = {
                        showImportModeDialog = false
                        importModeTarget = ""
                    }) { Text("Cancel") }
                }
            }
        )
    }

    // ── Replace All Confirmation (Req 24.13) ──
    if (showReplaceConfirm) {
        AlertDialog(
            onDismissRequest = { showReplaceConfirm = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("⚠️ Replace All Data", style = CwocDialogDefaults.titleStyle) },
            text = { Text("This will REPLACE all existing data with the imported data. This action cannot be undone. Are you sure you want to proceed?") },
            confirmButton = {
                TextButton(onClick = {
                    showReplaceConfirm = false
                    // TODO: Open file picker with importModeTarget type, mode = "replace"
                    importModeTarget = ""
                }, colors = CwocDialogDefaults.confirmButtonColors()) { Text("Replace", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = {
                    showReplaceConfirm = false
                    importModeTarget = ""
                }) { Text("Cancel") }
            }
        )
    }

    // ── Purge All - first confirmation (Req 24.16) ──
    if (showPurgeConfirm1) {
        AlertDialog(
            onDismissRequest = { showPurgeConfirm1 = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("⚠️ Purge All Data", style = CwocDialogDefaults.titleStyle) },
            text = { Text("This will PERMANENTLY DELETE all data including chits, contacts, settings, and history. This cannot be undone. Are you absolutely sure?") },
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

    // ── Purge All - second confirmation (Req 24.16) ──
    if (showPurgeConfirm2) {
        AlertDialog(
            onDismissRequest = { showPurgeConfirm2 = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("🚨 Final Confirmation", style = CwocDialogDefaults.titleStyle) },
            text = { Text("LAST CHANCE: All chits, settings, contacts, and history will be permanently erased. This is irreversible.") },
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

/**
 * Import Batches subsection showing previously imported batches (max 100, most recent first)
 * with a delete button per batch.
 * Validates: Requirement 24.6
 */
@Composable
private fun ImportBatchesSubsection() {
    // TODO: Fetch import batches from server API
    var batches by remember { mutableStateOf<List<ImportBatch>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        CwocSectionHeading(text = "Import Batches")

        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp))
        } else if (batches.isEmpty()) {
            Text(
                text = "No import batches found.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            // Show max 100 batches, most recent first
            batches.take(100).forEach { batch ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = batch.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = batch.importedAt,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconButton(onClick = {
                            // TODO: DELETE batch via API, then refresh list
                        }) {
                            Text("🗑️")
                        }
                    }
                }
            }
        }
    }
}

/**
 * Audit Log Limits subsection with Enable Pruning checkbox,
 * Max Age (days) input (1-9999), and Max Size (MB) input (1-99999).
 * Validates: Requirement 24.10
 */
@Composable
private fun AuditLogLimitsSubsection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CwocSectionHeading(text = "Audit Log Limits")

        // Enable Pruning checkbox
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val newValue = if (settingsState.auditLogPruningEnabled == "1") "0" else "1"
                    onUpdateSetting("audit_log_pruning_enabled", newValue)
                }
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = settingsState.auditLogPruningEnabled == "1",
                onCheckedChange = { checked ->
                    onUpdateSetting("audit_log_pruning_enabled", if (checked) "1" else "0")
                }
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Enable Pruning",
                style = MaterialTheme.typography.bodyMedium
            )
        }

        // Max Age (days) input — only interactive when pruning enabled
        val pruningEnabled = settingsState.auditLogPruningEnabled == "1"
        OutlinedTextField(
            value = settingsState.auditLogMaxDays,
            onValueChange = { newValue ->
                // Allow only digits, enforce range on save
                if (newValue.all { it.isDigit() } || newValue.isEmpty()) {
                    onUpdateSetting("audit_log_max_days", newValue)
                }
            },
            label = { Text("Max Age (days)") },
            placeholder = { Text("1–9999") },
            singleLine = true,
            enabled = pruningEnabled,
            modifier = Modifier.fillMaxWidth(),
            isError = pruningEnabled && settingsState.auditLogMaxDays.isNotEmpty() &&
                    (settingsState.auditLogMaxDays.toIntOrNull()?.let { it < 1 || it > 9999 } ?: true),
            colors = CwocInputDefaults.outlinedColors()
        )
        if (pruningEnabled && settingsState.auditLogMaxDays.isNotEmpty() &&
            (settingsState.auditLogMaxDays.toIntOrNull()?.let { it < 1 || it > 9999 } ?: true)) {
            Text(
                text = "Valid range: 1–9999 days",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        // Max Size (MB) input — only interactive when pruning enabled
        OutlinedTextField(
            value = settingsState.auditLogMaxMb,
            onValueChange = { newValue ->
                if (newValue.all { it.isDigit() } || newValue.isEmpty()) {
                    onUpdateSetting("audit_log_max_mb", newValue)
                }
            },
            label = { Text("Max Size (MB)") },
            placeholder = { Text("1–99999") },
            singleLine = true,
            enabled = pruningEnabled,
            modifier = Modifier.fillMaxWidth(),
            isError = pruningEnabled && settingsState.auditLogMaxMb.isNotEmpty() &&
                    (settingsState.auditLogMaxMb.toIntOrNull()?.let { it < 1 || it > 99999 } ?: true),
            colors = CwocInputDefaults.outlinedColors()
        )
        if (pruningEnabled && settingsState.auditLogMaxMb.isNotEmpty() &&
            (settingsState.auditLogMaxMb.toIntOrNull()?.let { it < 1 || it > 99999 } ?: true)) {
            Text(
                text = "Valid range: 1–99999 MB",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * Attachment Limits subsection with Max File Size dropdown (5/10/25/50 MB)
 * and Max Storage Per User dropdown (100 MB/250 MB/500 MB/1 GB/2 GB/5 GB/Unlimited).
 * Validates: Requirement 24.11
 */
@Composable
private fun AttachmentLimitsSubsection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CwocSectionHeading(text = "Attachment Limits")

        // Max File Size dropdown
        SettingsDropdown(
            label = "Max File Size",
            value = settingsState.attachmentMaxSizeMb,
            options = listOf("5", "10", "25", "50"),
            displayLabels = listOf("5 MB", "10 MB", "25 MB", "50 MB"),
            onValueChange = { onUpdateSetting("attachment_max_size_mb", it) }
        )

        // Max Storage Per User dropdown
        SettingsDropdown(
            label = "Max Storage Per User",
            value = settingsState.attachmentMaxStorageMb,
            options = listOf("100", "250", "500", "1024", "2048", "5120", "0"),
            displayLabels = listOf("100 MB", "250 MB", "500 MB", "1 GB", "2 GB", "5 GB", "Unlimited"),
            onValueChange = { onUpdateSetting("attachment_max_storage_mb", it) }
        )
    }
}

/**
 * Data class representing an import batch entry.
 */
private data class ImportBatch(
    val id: String,
    val name: String,
    val importedAt: String
)

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
    onUpdateSetting: (key: String, value: String) -> Unit,
    settingsViewModel: SettingsViewModel? = null
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
                if (settingsViewModel != null) {
                    TailscaleSection(
                        settingsState = settingsState,
                        onUpdateSetting = onUpdateSetting,
                        settingsViewModel = settingsViewModel
                    )
                } else {
                    DiagnosticsCard(title = "Tailscale") {
                        Text(
                            text = "Tailscale provides secure network access to the CWOC server.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Ntfy
                if (settingsViewModel != null) {
                    NtfySection(
                        settingsState = settingsState,
                        onUpdateSetting = onUpdateSetting,
                        settingsViewModel = settingsViewModel
                    )
                }

                // Home Assistant
                if (settingsViewModel != null) {
                    HomeAssistantSection(
                        settingsState = settingsState,
                        onUpdateSetting = onUpdateSetting,
                        settingsViewModel = settingsViewModel
                    )
                } else {
                    DiagnosticsCard(title = "Home Assistant") {
                        OutlinedTextField(
                            value = settingsState.haUrl,
                            onValueChange = { onUpdateSetting("ha_url", it) },
                            label = { Text("Home Assistant URL") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = settingsState.haToken,
                            onValueChange = { onUpdateSetting("ha_token", it) },
                            label = { Text("Long-Lived Access Token") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
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

                // Restic Backup
                if (settingsViewModel != null) {
                    BackupSection(
                        settingsState = settingsState,
                        onUpdateSetting = onUpdateSetting,
                        settingsViewModel = settingsViewModel
                    )
                }
            }
        }

        // Backup Target Modal (rendered outside section body so it overlays everything)
        if (settingsViewModel != null) {
            BackupTargetModal(settingsViewModel = settingsViewModel)
        }
    }
}

// ============================================================
// Section: Ntfy Configuration (Task 33.1, 33.2)
// Validates: Requirements 26.1-26.12, 30.1-30.4
// ============================================================

/**
 * Full Ntfy configuration section with zone-button toggle, status display,
 * server URLs, topic, test notification, enable/disable, open app, and status refresh.
 *
 * Validates: Requirements 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.10, 26.11, 26.12
 * Also validates: Requirements 30.1, 30.2, 30.3, 30.4
 */
@Composable
private fun NtfySection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    settingsViewModel: SettingsViewModel
) {
    val ntfyState by settingsViewModel.ntfyState.collectAsState()
    val ntfyTestState by settingsViewModel.ntfyTestState.collectAsState()
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current

    var sectionExpanded by remember { mutableStateOf(false) }
    var showHelp by remember { mutableStateOf(false) }

    // Initialize: fetch status when section first expands
    val initialized = remember { mutableStateOf(false) }
    if (sectionExpanded && !initialized.value) {
        initialized.value = true
        settingsViewModel.refreshNtfyStatus()
    }

    // Determine status icon for the header button
    val statusIcon = when (ntfyState.status) {
        "active" -> "🟢"
        "disabled" -> "⚫"
        "unreachable" -> "🔴"
        "not_configured" -> "⚪"
        else -> "⚪"
    }

    // Derive the local server URL from the server URL (host:2586)
    val serverHost = remember(settingsState.serverUrl) {
        try {
            val url = java.net.URL(settingsState.serverUrl)
            url.host
        } catch (_: Exception) {
            "192.168.1.111"
        }
    }
    val localNtfyUrl = "http://$serverHost:2586"

    // Derive the Ntfy topic: "cwoc-" + first 12 alphanumeric chars of user ID
    val ntfyTopic = remember(settingsViewModel.currentUserId) {
        val alphanumeric = settingsViewModel.currentUserId.replace(Regex("[^a-zA-Z0-9]"), "")
        "cwoc-" + alphanumeric.take(12)
    }

    // Tailscale server URL (if active)
    val tailscaleNtfyUrl = ntfyState.tailscaleIp?.let { "http://$it:2586" }

    // Whether ntfy is configured (for test button enablement)
    val ntfyConfigured = ntfyState.status == "active" || ntfyState.status == "disabled"
    val isTesting = ntfyTestState.isTesting
    val isEnabling = ntfyState.isEnabling
    val isDisabling = ntfyState.isDisabling
    val isLoading = ntfyState.isLoading

    Column {
        // Header row: Ntfy zone-button with status icon + help icon (Req 26.1, 26.2)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { sectionExpanded = !sectionExpanded },
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                Text("Ntfy  $statusIcon")
            }

            // Help icon (circle-question)
            IconButton(
                onClick = { showHelp = !showHelp },
                modifier = Modifier.size(32.dp)
            ) {
                Text(
                    text = "❓",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Help text (toggled by help icon) — Req 26.2
        AnimatedVisibility(visible = showHelp) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Ntfy is a push notification service that delivers CWOC alerts (timers, alarms, reminders) directly to your phone — even when the app is closed.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Setup:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "1. Install the Ntfy app on your phone (Play Store / F-Droid).\n" +
                                "2. Open the Ntfy app and tap \"+\" to add a subscription.\n" +
                                "3. Enter the Server URL shown below.\n" +
                                "4. Enter the Topic shown below.\n" +
                                "5. Tap Subscribe.\n" +
                                "6. Click \"Enable\" below to activate notifications.\n" +
                                "7. Click \"🔔 Test\" to verify it works.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "See the full Ntfy Notifications help guide for more details.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        // Collapsible config body
        AnimatedVisibility(visible = sectionExpanded) {
            Column(
                modifier = Modifier.padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Status row — Req 26.3
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Status:",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = when (ntfyState.status) {
                            "active" -> "🟢 Active"
                            "disabled" -> "⚫ Disabled"
                            "unreachable" -> "🔴 Unreachable"
                            "not_configured" -> "⚪ Not Configured"
                            else -> if (isLoading) "⏳ Checking..." else "⚪ Unknown"
                        },
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                // Local Server URL — Req 26.4
                Text(
                    text = "Server URL (Local)",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    var localCopied by remember { mutableStateOf(false) }
                    Text(
                        text = localNtfyUrl,
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = {
                            clipboardManager.setText(AnnotatedString(localNtfyUrl))
                            localCopied = true
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy local URL",
                            modifier = Modifier.size(18.dp),
                            tint = if (localCopied) Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // Reset copy feedback after delay
                    LaunchedEffect(localCopied) {
                        if (localCopied) {
                            delay(1500L)
                            localCopied = false
                        }
                    }
                }

                // Tailscale Server URL — Req 26.5
                if (tailscaleNtfyUrl != null) {
                    Text(
                        text = "Server URL (Tailscale)",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        var tsCopied by remember { mutableStateOf(false) }
                        Text(
                            text = tailscaleNtfyUrl,
                            style = MaterialTheme.typography.bodyMedium,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(tailscaleNtfyUrl))
                                tsCopied = true
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "Copy Tailscale URL",
                                modifier = Modifier.size(18.dp),
                                tint = if (tsCopied) Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        LaunchedEffect(tsCopied) {
                            if (tsCopied) {
                                delay(1500L)
                                tsCopied = false
                            }
                        }
                    }
                    Text(
                        text = "Only subscribe to one URL to avoid duplicate notifications.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Ntfy Topic — Req 26.6
                Text(
                    text = "Topic",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    var topicCopied by remember { mutableStateOf(false) }
                    Text(
                        text = ntfyTopic,
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = {
                            clipboardManager.setText(AnnotatedString(ntfyTopic))
                            topicCopied = true
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy topic",
                            modifier = Modifier.size(18.dp),
                            tint = if (topicCopied) Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    LaunchedEffect(topicCopied) {
                        if (topicCopied) {
                            delay(1500L)
                            topicCopied = false
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Action buttons row: Test + Open App — Req 26.7, 26.8
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // 🔔 Test button — Req 26.7, 30.1-30.4
                    // Disabled when ntfy not configured (server URL or topic empty) per Req 30.2
                    OutlinedButton(
                        onClick = { settingsViewModel.testNtfyNotification() },
                        enabled = ntfyConfigured && !isTesting && !isLoading,
                        modifier = Modifier.weight(1f)
                    ) {
                        if (isTesting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Testing...", style = MaterialTheme.typography.bodySmall)
                        } else {
                            Text("🔔 Test")
                        }
                    }

                    // 📱 Open App button — Req 26.8
                    OutlinedButton(
                        onClick = {
                            try {
                                val intent = Intent(
                                    Intent.ACTION_VIEW,
                                    Uri.parse("ntfy://")
                                )
                                context.startActivity(intent)
                            } catch (_: Exception) {
                                Toast.makeText(context, "Ntfy app not installed", Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("📱 Open App")
                    }
                }

                // Test notification inline feedback — Req 26.7, 30.3
                ntfyTestState.resultMessage?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (ntfyTestState.isSuccess == true)
                            Color(0xFF2E7D32)
                        else
                            MaterialTheme.colorScheme.error
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Enable/Disable toggle button — Req 26.9, 26.10
                val isActive = ntfyState.status == "active"
                Button(
                    onClick = {
                        if (isActive) {
                            settingsViewModel.disableNtfy()
                        } else {
                            settingsViewModel.enableNtfy()
                        }
                    },
                    enabled = !isEnabling && !isDisabling && !isLoading,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isActive) Color(0xFF8B1A1A) else Color(0xFF2D5A1E),
                        disabledContainerColor = if (isActive) Color(0xFF8B1A1A).copy(alpha = 0.5f) else Color(0xFF2D5A1E).copy(alpha = 0.5f)
                    )
                ) {
                    if (isEnabling || isDisabling) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(
                        text = if (isActive) "⏹️ Disable" else "▶️ Enable",
                        color = Color.White
                    )
                }

                // 🔄 Check Status button — Req 26.11
                OutlinedButton(
                    onClick = { settingsViewModel.refreshNtfyStatus() },
                    enabled = !isLoading,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text("🔄 Check Status")
                }

                // Inline feedback message — Req 26.12
                ntfyState.feedbackMessage?.let { message ->
                    val feedbackColor = when (ntfyState.feedbackType) {
                        "success" -> Color(0xFF1E3F14)
                        "error" -> Color(0xFF8B1A1A)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    val feedbackBg = when (ntfyState.feedbackType) {
                        "success" -> Color(0x1F2D5A1E)
                        "error" -> Color(0x1F8B1A1A)
                        else -> Color(0x1A4A2C2A)
                    }
                    val feedbackIcon = when (ntfyState.feedbackType) {
                        "success" -> "✅"
                        "error" -> "❌"
                        else -> "ℹ️"
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = feedbackBg)
                    ) {
                        Text(
                            text = "$feedbackIcon  $message",
                            style = MaterialTheme.typography.bodySmall,
                            color = feedbackColor,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            }
        }
    }
}

// ============================================================
// Section: Home Assistant (Task 34.1)
// Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9
// ============================================================

/**
 * Home Assistant configuration section with toggle button, help instructions,
 * URL/token/poll interval inputs, test connection, save config, webhook URL
 * with copy, and regenerate webhook secret with confirmation.
 */
@Composable
private fun HomeAssistantSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    settingsViewModel: SettingsViewModel
) {
    val haState by settingsViewModel.haState.collectAsState()
    val clipboardManager = LocalClipboardManager.current

    // Section expanded state driven by the haEnabled toggle
    var sectionExpanded by remember { mutableStateOf(settingsState.haEnabled == "1") }
    var showHelp by remember { mutableStateOf(false) }
    var tokenVisible by remember { mutableStateOf(false) }
    var showRegenerateConfirm by remember { mutableStateOf(false) }

    // Local form fields for HA config (independent of global save)
    var localBaseUrl by remember(haState.haBaseUrl) { mutableStateOf(haState.haBaseUrl) }
    var localAccessToken by remember(haState.haAccessToken) { mutableStateOf(haState.haAccessToken) }
    var localPollInterval by remember(haState.haPollInterval) { mutableStateOf(haState.haPollInterval) }

    // Clipboard copy confirmation
    var showCopyConfirmation by remember { mutableStateOf(false) }

    // Initialize: load HA config when section first expands
    val initialized = remember { mutableStateOf(false) }
    if (sectionExpanded && !initialized.value) {
        initialized.value = true
        settingsViewModel.loadHaConfig()
    }

    // Determine the colored circle indicator
    val isEnabled = settingsState.haEnabled == "1"
    val indicatorColor = if (isEnabled) Color(0xFF4CAF50) else Color(0xFF9E9E9E)

    Column {
        // Header row: Home Assistant toggle button + help icon — Validates: Req 27.1, 27.2
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Toggle button with colored circle indicator
            Button(
                onClick = {
                    val newEnabled = if (isEnabled) "0" else "1"
                    onUpdateSetting("ha_enabled", newEnabled)
                    sectionExpanded = newEnabled == "1"
                    if (newEnabled == "1" && !initialized.value) {
                        initialized.value = true
                        settingsViewModel.loadHaConfig()
                    }
                },
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                // Colored circle indicator
                Canvas(
                    modifier = Modifier.size(12.dp)
                ) {
                    drawCircle(color = indicatorColor)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text("Home Assistant")
            }

            // Help icon — Validates: Req 27.2
            IconButton(
                onClick = { showHelp = !showHelp },
                modifier = Modifier.size(32.dp)
            ) {
                Text(
                    text = "❓",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Help text (toggled by help icon) — Validates: Req 27.2
        AnimatedVisibility(visible = showHelp) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Home Assistant Integration Setup:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "1. Enter your Home Assistant base URL (e.g., http://192.168.1.100:8123)\n" +
                                "2. In HA, go to Profile → Long-Lived Access Tokens → Create Token\n" +
                                "3. Paste the token into the Access Token field\n" +
                                "4. Set your desired poll interval and click Save HA Config\n" +
                                "5. Click Test Connection to verify connectivity\n" +
                                "6. Use the Webhook URL below in your HA automations to send events to CWOC",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        // Collapsible config body — Validates: Req 27.1 (expands when enabled)
        AnimatedVisibility(visible = sectionExpanded) {
            Column(
                modifier = Modifier.padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Loading indicator
                if (haState.isLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Loading HA config...",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                // HA Base URL — Validates: Req 27.3
                OutlinedTextField(
                    value = localBaseUrl,
                    onValueChange = { localBaseUrl = it },
                    label = { Text("HA Base URL") },
                    placeholder = { Text("http://192.168.1.100:8123") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Access Token — Validates: Req 27.4
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    OutlinedTextField(
                        value = localAccessToken,
                        onValueChange = { localAccessToken = it },
                        label = { Text("Access Token") },
                        placeholder = { Text("Long-Lived Access Token") },
                        singleLine = true,
                        visualTransformation = if (tokenVisible)
                            VisualTransformation.None
                        else
                            PasswordVisualTransformation(),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    // Show/hide toggle
                    IconButton(
                        onClick = { tokenVisible = !tokenVisible },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Text(
                            text = if (tokenVisible) "🔒" else "👁️",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                // Poll Interval — Validates: Req 27.5
                OutlinedTextField(
                    value = localPollInterval,
                    onValueChange = { newValue ->
                        // Only allow numeric input
                        val filtered = newValue.filter { it.isDigit() }
                        localPollInterval = filtered
                    },
                    label = { Text("Poll Interval (sec)") },
                    placeholder = { Text("30") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = {
                        Text("Min: 5, Max: 3600, Default: 30")
                    },
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Test Connection button — Validates: Req 27.6
                OutlinedButton(
                    onClick = { settingsViewModel.testHaConnection() },
                    enabled = !haState.isTestingConnection,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (haState.isTestingConnection) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Testing...")
                    } else {
                        Text("🔌 Test Connection")
                    }
                }

                // Test result display
                haState.testResult?.let { result ->
                    Text(
                        text = result,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (haState.testSuccess == true)
                            Color(0xFF2E7D32)
                        else
                            MaterialTheme.colorScheme.error
                    )
                }

                // Save HA Config button — Validates: Req 27.7
                Button(
                    onClick = {
                        // Validate poll interval
                        val pollInt = localPollInterval.toIntOrNull() ?: 30
                        val clampedPoll = pollInt.coerceIn(5, 3600)
                        settingsViewModel.saveHaConfig(
                            baseUrl = localBaseUrl,
                            accessToken = localAccessToken,
                            pollInterval = clampedPoll
                        )
                    },
                    enabled = !haState.isSaving,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    if (haState.isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Saving...")
                    } else {
                        Text("💾 Save HA Config")
                    }
                }
                Text(
                    text = "Saves immediately — independent of the main settings Save button",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Feedback message (save success/error)
                haState.feedbackMessage?.let { message ->
                    val feedbackColor = when (haState.feedbackType) {
                        "success" -> Color(0xFF1E3F14)
                        "error" -> Color(0xFF8B1A1A)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    val feedbackBg = when (haState.feedbackType) {
                        "success" -> Color(0x1F2D5A1E)
                        "error" -> Color(0x1F8B1A1A)
                        else -> Color(0x1A4A2C2A)
                    }
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = feedbackBg)
                    ) {
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodySmall,
                            color = feedbackColor,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

                // Webhook URL — Validates: Req 27.8
                Text(
                    text = "Webhook URL",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    OutlinedTextField(
                        value = haState.webhookUrl.ifEmpty { "Not configured" },
                        onValueChange = {},
                        readOnly = true,
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace
                        ),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    // Copy button
                    IconButton(
                        onClick = {
                            if (haState.webhookUrl.isNotEmpty()) {
                                clipboardManager.setText(AnnotatedString(haState.webhookUrl))
                                showCopyConfirmation = true
                            }
                        },
                        enabled = haState.webhookUrl.isNotEmpty()
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy Webhook URL"
                        )
                    }
                }

                // Clipboard copy confirmation
                if (showCopyConfirmation) {
                    Text(
                        text = "✅ Copied to clipboard",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF2E7D32)
                    )
                    // Auto-dismiss after 2 seconds
                    LaunchedEffect(showCopyConfirmation) {
                        delay(2000L)
                        showCopyConfirmation = false
                    }
                }

                // Regenerate Webhook Secret button — Validates: Req 27.9
                OutlinedButton(
                    onClick = { showRegenerateConfirm = true },
                    enabled = !haState.isRegenerating && haState.webhookUrl.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (haState.isRegenerating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Regenerating...")
                    } else {
                        Text("🔄 Regenerate Webhook Secret")
                    }
                }
                Text(
                    text = "⚠️ Regenerating will break any existing HA automations using the old URL.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Regenerate confirmation dialog — Validates: Req 27.9
        if (showRegenerateConfirm) {
            AlertDialog(
                onDismissRequest = { showRegenerateConfirm = false },
                modifier = CwocDialogDefaults.borderModifier,
                containerColor = CwocDialogDefaults.containerColor,
                title = { Text("Regenerate Webhook Secret?", style = CwocDialogDefaults.titleStyle) },
                text = {
                    Text(
                        "This will generate a new webhook URL. Any existing Home Assistant " +
                                "automations using the current webhook URL will stop working and " +
                                "must be updated with the new URL.\n\nThis action cannot be undone."
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            showRegenerateConfirm = false
                            settingsViewModel.regenerateHaWebhook()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text("Regenerate")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showRegenerateConfirm = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

// ============================================================
// Section: Restic Backup (Task 3.1)
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.9, 11.3
// ============================================================

/**
 * Restic Backup section with zone-button header (status icon), help toggle,
 * collapsible body with status panel, and lazy-load initialization.
 *
 * Follows the same pattern as NtfySection: zone-button header, help icon,
 * AnimatedVisibility body, and initialized flag for lazy-loading.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.9, 11.3
 */
@Composable
fun BackupSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    settingsViewModel: SettingsViewModel
) {
    val backupState by settingsViewModel.backupState.collectAsState()
    val context = LocalContext.current

    var sectionExpanded by remember { mutableStateOf(false) }
    var showHelp by remember { mutableStateOf(false) }

    // Observe download events — open URL in browser via Intent.ACTION_VIEW (Req 6.5, 7.2)
    LaunchedEffect(Unit) {
        settingsViewModel.backupDownloadEvent.collect { url ->
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
        }
    }

    // Observe toast events — show Toast messages for backup operations
    LaunchedEffect(Unit) {
        settingsViewModel.backupToastEvent.collect { message ->
            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        }
    }

    // Initialize: fetch targets when section first expands (matching Ntfy's initialized pattern)
    val initialized = remember { mutableStateOf(false) }
    if (sectionExpanded && !initialized.value) {
        initialized.value = true
        settingsViewModel.loadBackupTargets()
    }

    // Determine status icon for the header button — Req 1.2
    val statusIcon = when (backupState.headerStatus) {
        "inactive" -> "⚪"
        "incomplete" -> "🟡"
        "ok" -> "🟢"
        "local_only" -> "🟢🟡"
        "error" -> "🔴"
        else -> "⚪"
    }

    Column {
        // Header row: Restic Backup zone-button with status icon + help icon (Req 1.1, 1.2)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { sectionExpanded = !sectionExpanded },
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                Text("Restic Backup  $statusIcon")
            }

            // Help icon (circle-question) — Req 1.3
            IconButton(
                onClick = { showHelp = !showHelp },
                modifier = Modifier.size(32.dp)
            ) {
                Text(
                    text = "❓",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Help text (toggled by help icon) — Req 1.3
        AnimatedVisibility(visible = showHelp) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Restic is an encrypted, deduplicated backup tool. Configure multiple backup targets to protect your CWOC data across local or remote storage.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "See the full Restic Backup help guide for setup and configuration details.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        // Collapsible body — Req 1.4
        AnimatedVisibility(visible = sectionExpanded) {
            Column(
                modifier = Modifier.padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Status panel — Req 1.9, 11.3
                // Matching web's #backup-status-panel: Targets count, Last backup, Next scheduled
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
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Targets",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "${backupState.targetCount}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Last backup",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = settingsViewModel.formatBackupRelativeTime(backupState.lastBackupTime),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Next scheduled",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = settingsViewModel.formatBackupDateTime(backupState.nextBackupTime),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Loading indicator
                if (backupState.isLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    }
                }

                // Target list + orphans — Req 1.5, 1.8, 2.1, 2.2, 2.3, 2.4
                BackupTargetList(
                    targets = backupState.targets,
                    orphans = backupState.orphans,
                    settingsViewModel = settingsViewModel
                )
            }
        }
    }
}

// ============================================================
// Section: Restic Backup Target List (Task 3.2)
// Validates: Requirements 1.5, 1.8, 2.1, 2.2, 2.3, 2.4
// ============================================================

/**
 * Renders the list of backup targets as clickable cards, plus orphan repos.
 * Each target card shows: status icon (🟢/🔴/⚪) + name (bold) + subtitle (repo type · last time · size) + chevron (›).
 * Empty state: "No backup targets configured yet." (centered, dimmed).
 * Orphans: 👻 icon, "Orphaned Local Backup", path + size, "💀 Delete" button with confirmation.
 */
@Composable
private fun BackupTargetList(
    targets: List<BackupTargetDto>,
    orphans: List<OrphanRepoDto>,
    settingsViewModel: SettingsViewModel
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (targets.isEmpty() && orphans.isEmpty()) {
            // Empty state — Req 1.8
            Text(
                text = "No backup targets configured yet.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        } else {
            // Render each target as a clickable card — Req 1.5, 2.1
            targets.forEach { target ->
                BackupTargetCard(
                    target = target,
                    settingsViewModel = settingsViewModel,
                    onClick = { settingsViewModel.openBackupTargetModal(target.id) }
                )
            }

            // Render orphan repos — Req 2.2, 2.3, 2.4
            orphans.forEach { orphan ->
                BackupOrphanCard(
                    orphan = orphan,
                    settingsViewModel = settingsViewModel
                )
            }
        }
    }
}

/**
 * A single backup target rendered as a clickable Material 3 Card.
 * Shows status icon, name (bold), subtitle (repo_type · relative time · size), and chevron.
 *
 * Status icon logic:
 * - last_backup_result?.success == false → 🔴
 * - last_backup_time != null → 🟢
 * - Otherwise → ⚪
 */
@Composable
private fun BackupTargetCard(
    target: BackupTargetDto,
    settingsViewModel: SettingsViewModel,
    onClick: () -> Unit
) {
    // Determine status icon
    val statusIcon = when {
        target.last_backup_result?.success == false -> "🔴"
        target.last_backup_time != null -> "🟢"
        else -> "⚪"
    }

    // Build subtitle: repo_type · relative time · size
    val repoType = target.repo_type?.replaceFirstChar { it.uppercase() } ?: "Unknown"
    val relativeTime = settingsViewModel.formatBackupRelativeTime(target.last_backup_time)
    val size = target.repo_size ?: "—"
    val subtitle = "$repoType · $relativeTime · $size"

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status icon
            Text(
                text = statusIcon,
                style = MaterialTheme.typography.bodyLarge
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Name + subtitle
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = target.name ?: "Unnamed Target",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Chevron
            Text(
                text = "›",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * An orphan repo rendered as a card with dashed-border styling.
 * Shows 👻 icon, "Orphaned Local Backup", path + size, and a "💀 Delete" button
 * that shows a confirmation dialog before calling deleteOrphanRepo.
 */
@Composable
private fun BackupOrphanCard(
    orphan: OrphanRepoDto,
    settingsViewModel: SettingsViewModel
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        border = androidx.compose.foundation.BorderStroke(
            width = 1.dp,
            color = MaterialTheme.colorScheme.outline
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ghost icon
            Text(
                text = "👻",
                style = MaterialTheme.typography.bodyLarge
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Orphaned Local Backup",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${orphan.path} · ${orphan.repo_size ?: "—"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Delete button
            TextButton(
                onClick = { showDeleteConfirm = true },
                colors = ButtonDefaults.textButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("💀 Delete")
            }
        }
    }

    // Confirmation dialog for orphan deletion
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Orphaned Backup?") },
            text = {
                Text("This will permanently delete the orphaned backup repository at:\n\n${orphan.path}\n\nThis cannot be undone.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        settingsViewModel.deleteOrphanRepo(orphan.path)
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
            containerColor = CwocDialogDefaults.containerColor,
            titleContentColor = CwocDialogDefaults.titleContentColor,
            textContentColor = CwocDialogDefaults.textContentColor
        )
    }
}

// ============================================================
// Section: Restic Backup — Action Buttons (Task 3.3)
// Validates: Requirements 1.6, 1.7
// ============================================================

/**
 * Action buttons row for the Backup section: "➕ Add Target" and "▶️ Backup All Now".
 * Both buttons use equal width via Modifier.weight(1f) with CWOC outset styling.
 * The "Backup All Now" button shows a CircularProgressIndicator when backup is running.
 */
@Composable
fun BackupActionButtons(
    settingsViewModel: SettingsViewModel,
    isLoading: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // ➕ Add Target button — Validates: Requirement 1.6
        Button(
            onClick = { settingsViewModel.openBackupTargetModal(null) },
            modifier = Modifier.weight(1f),
            colors = CwocButtonDefaults.outsetColors(),
            border = CwocButtonDefaults.outsetBorder,
            shape = CwocButtonDefaults.outsetShape
        ) {
            Text("➕ Add Target")
        }

        // ▶️ Backup All Now button — Validates: Requirement 1.7
        Button(
            onClick = { settingsViewModel.runBackupAll() },
            enabled = !isLoading,
            modifier = Modifier.weight(1f),
            colors = CwocButtonDefaults.outsetColors(),
            border = CwocButtonDefaults.outsetBorder,
            shape = CwocButtonDefaults.outsetShape
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Backing up…")
            } else {
                Text("▶️ Backup All Now")
            }
        }
    }
}

// ============================================================
// Section: Backup Target Modal — Repository (Task 4.2)
// Validates: Requirements 3.2, 3.3, 3.4, 3.5
// ============================================================

/**
 * Repository section for the BackupTargetModal.
 * Collapsible (expanded by default) with:
 * - Name field (required)
 * - Type dropdown (8 options, Local disabled if localTargetExists)
 * - URL/Path field (conditional visibility based on type)
 * - Password field with show/hide toggle
 * - Dynamic credential fields per type (SFTP, S3, B2, Azure, GCS, REST, rclone)
 *
 * All field values are passed as MutableState parameters so the parent modal
 * can read them for validation/save.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupRepositorySection(
    name: String,
    onNameChange: (String) -> Unit,
    repoType: String,
    onRepoTypeChange: (String) -> Unit,
    repoUrl: String,
    onRepoUrlChange: (String) -> Unit,
    repoPassword: String,
    onRepoPasswordChange: (String) -> Unit,
    // SFTP fields
    sftpUsername: String,
    onSftpUsernameChange: (String) -> Unit,
    sftpHost: String,
    onSftpHostChange: (String) -> Unit,
    sftpPort: String,
    onSftpPortChange: (String) -> Unit,
    sftpRemotePath: String,
    onSftpRemotePathChange: (String) -> Unit,
    sftpAuthMethod: String, // "password" or "key"
    onSftpAuthMethodChange: (String) -> Unit,
    sftpPassword: String,
    onSftpPasswordChange: (String) -> Unit,
    sftpKeyPath: String,
    onSftpKeyPathChange: (String) -> Unit,
    // S3 fields
    s3AccessKeyId: String,
    onS3AccessKeyIdChange: (String) -> Unit,
    s3SecretAccessKey: String,
    onS3SecretAccessKeyChange: (String) -> Unit,
    s3Region: String,
    onS3RegionChange: (String) -> Unit,
    // B2 fields
    b2AccountId: String,
    onB2AccountIdChange: (String) -> Unit,
    b2ApplicationKey: String,
    onB2ApplicationKeyChange: (String) -> Unit,
    // Azure fields
    azureAccountName: String,
    onAzureAccountNameChange: (String) -> Unit,
    azureAccountKey: String,
    onAzureAccountKeyChange: (String) -> Unit,
    // GCS fields
    gcsProjectId: String,
    onGcsProjectIdChange: (String) -> Unit,
    gcsCredentialsJsonPath: String,
    onGcsCredentialsJsonPathChange: (String) -> Unit,
    // REST fields
    restUsername: String,
    onRestUsernameChange: (String) -> Unit,
    restPassword: String,
    onRestPasswordChange: (String) -> Unit,
    // rclone fields
    rcloneConfigName: String,
    onRcloneConfigNameChange: (String) -> Unit,
    // Whether a local target already exists (disables "Local" option)
    localTargetExists: Boolean = false
) {
    var expanded by remember { mutableStateOf(true) }
    var passwordVisible by remember { mutableStateOf(false) }
    var sftpPasswordVisible by remember { mutableStateOf(false) }
    var typeDropdownExpanded by remember { mutableStateOf(false) }

    // Repository type options — Req 3.3
    val repoTypeOptions = listOf(
        "local" to "Local",
        "sftp" to "SFTP",
        "s3" to "Amazon S3 / S3-Compatible",
        "b2" to "Backblaze B2",
        "azure" to "Microsoft Azure Blob Storage",
        "gcs" to "Google Cloud Storage",
        "rest" to "REST Server",
        "rclone" to "rclone"
    )

    // Find display label for current type
    val currentTypeLabel = repoTypeOptions.firstOrNull { it.first == repoType }?.second ?: "Local"

    Column(modifier = Modifier.fillMaxWidth()) {
        // Collapsible header — "Repository ▾/▸"
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Repository ${if (expanded) "▾" else "▸"}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        AnimatedVisibility(visible = expanded) {
            Column(
                modifier = Modifier.padding(start = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name field (required) — Req 3.2
                OutlinedTextField(
                    value = name,
                    onValueChange = onNameChange,
                    label = { Text("Name *") },
                    placeholder = { Text("e.g. Local Backup, NAS Nightly") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Type dropdown — Req 3.3
                ExposedDropdownMenuBox(
                    expanded = typeDropdownExpanded,
                    onExpandedChange = { typeDropdownExpanded = it },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = currentTypeLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = typeDropdownExpanded,
                        onDismissRequest = { typeDropdownExpanded = false }
                    ) {
                        repoTypeOptions.forEach { (value, label) ->
                            val isDisabled = value == "local" && localTargetExists
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = label,
                                        color = if (isDisabled)
                                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                                        else
                                            MaterialTheme.colorScheme.onSurface
                                    )
                                },
                                onClick = {
                                    if (!isDisabled) {
                                        onRepoTypeChange(value)
                                        typeDropdownExpanded = false
                                    }
                                },
                                enabled = !isDisabled,
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                            )
                        }
                    }
                }

                // URL/Path field — conditional visibility based on type (Req 3.4)
                // Hidden for local and sftp, shown for others with type-specific label/placeholder
                if (repoType != "local" && repoType != "sftp") {
                    val (urlLabel, urlPlaceholder) = when (repoType) {
                        "s3" -> "Bucket URL" to "s3:s3.amazonaws.com/bucket-name"
                        "b2" -> "Bucket Name" to "b2:bucket-name:/path"
                        "azure" -> "Container URL" to "azure:container-name:/path"
                        "gcs" -> "Bucket Name" to "gs:bucket-name:/path"
                        "rest" -> "Server URL" to "rest:https://user:pass@host:8000/"
                        "rclone" -> "Remote Path" to "rclone:remote-name:path"
                        else -> "URL" to "Enter repository URL"
                    }

                    OutlinedTextField(
                        value = repoUrl,
                        onValueChange = onRepoUrlChange,
                        label = { Text(urlLabel) },
                        placeholder = { Text(urlPlaceholder) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                }

                // Password field with show/hide toggle — Req 3.2
                OutlinedTextField(
                    value = repoPassword,
                    onValueChange = onRepoPasswordChange,
                    label = { Text("Repository Password") },
                    placeholder = { Text("Encryption password for the repository") },
                    singleLine = true,
                    visualTransformation = if (passwordVisible)
                        VisualTransformation.None
                    else
                        PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Text(
                                text = if (passwordVisible) "🔒" else "👁️",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Dynamic credential fields per type — Req 3.4
                when (repoType) {
                    "sftp" -> {
                        // SFTP-specific fields
                        SftpCredentialFields(
                            username = sftpUsername,
                            onUsernameChange = onSftpUsernameChange,
                            host = sftpHost,
                            onHostChange = onSftpHostChange,
                            port = sftpPort,
                            onPortChange = onSftpPortChange,
                            remotePath = sftpRemotePath,
                            onRemotePathChange = onSftpRemotePathChange,
                            authMethod = sftpAuthMethod,
                            onAuthMethodChange = onSftpAuthMethodChange,
                            password = sftpPassword,
                            onPasswordChange = onSftpPasswordChange,
                            passwordVisible = sftpPasswordVisible,
                            onPasswordVisibleChange = { sftpPasswordVisible = it },
                            keyPath = sftpKeyPath,
                            onKeyPathChange = onSftpKeyPathChange
                        )
                    }
                    "s3" -> {
                        // S3-specific fields
                        OutlinedTextField(
                            value = s3AccessKeyId,
                            onValueChange = onS3AccessKeyIdChange,
                            label = { Text("Access Key ID") },
                            placeholder = { Text("AWS Access Key ID") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        OutlinedTextField(
                            value = s3SecretAccessKey,
                            onValueChange = onS3SecretAccessKeyChange,
                            label = { Text("Secret Access Key") },
                            placeholder = { Text("AWS Secret Access Key") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        OutlinedTextField(
                            value = s3Region,
                            onValueChange = onS3RegionChange,
                            label = { Text("Region") },
                            placeholder = { Text("e.g. us-east-1") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }
                    "b2" -> {
                        // B2-specific fields
                        OutlinedTextField(
                            value = b2AccountId,
                            onValueChange = onB2AccountIdChange,
                            label = { Text("Account ID") },
                            placeholder = { Text("Backblaze Account ID") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        OutlinedTextField(
                            value = b2ApplicationKey,
                            onValueChange = onB2ApplicationKeyChange,
                            label = { Text("Application Key") },
                            placeholder = { Text("Backblaze Application Key") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }
                    "azure" -> {
                        // Azure-specific fields
                        OutlinedTextField(
                            value = azureAccountName,
                            onValueChange = onAzureAccountNameChange,
                            label = { Text("Account Name") },
                            placeholder = { Text("Azure Storage Account Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        OutlinedTextField(
                            value = azureAccountKey,
                            onValueChange = onAzureAccountKeyChange,
                            label = { Text("Account Key") },
                            placeholder = { Text("Azure Storage Account Key") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }
                    "gcs" -> {
                        // GCS-specific fields
                        OutlinedTextField(
                            value = gcsProjectId,
                            onValueChange = onGcsProjectIdChange,
                            label = { Text("Project ID") },
                            placeholder = { Text("Google Cloud Project ID") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        OutlinedTextField(
                            value = gcsCredentialsJsonPath,
                            onValueChange = onGcsCredentialsJsonPathChange,
                            label = { Text("Credentials JSON Path") },
                            placeholder = { Text("/path/to/credentials.json") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }
                    "rest" -> {
                        // REST-specific fields
                        OutlinedTextField(
                            value = restUsername,
                            onValueChange = onRestUsernameChange,
                            label = { Text("Username") },
                            placeholder = { Text("REST server username") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        OutlinedTextField(
                            value = restPassword,
                            onValueChange = onRestPasswordChange,
                            label = { Text("Password") },
                            placeholder = { Text("REST server password") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }
                    "rclone" -> {
                        // rclone-specific fields
                        OutlinedTextField(
                            value = rcloneConfigName,
                            onValueChange = onRcloneConfigNameChange,
                            label = { Text("Config Name") },
                            placeholder = { Text("rclone remote config name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }
                    // "local" — no additional credential fields needed
                }
            }
        }
    }
}

/**
 * SFTP-specific credential fields sub-composable.
 * Shows Username, Host (required), Port (default 22), Remote Path,
 * Auth method radio (Password/SSH Key), and conditional password or key path field.
 */
@Composable
private fun SftpCredentialFields(
    username: String,
    onUsernameChange: (String) -> Unit,
    host: String,
    onHostChange: (String) -> Unit,
    port: String,
    onPortChange: (String) -> Unit,
    remotePath: String,
    onRemotePathChange: (String) -> Unit,
    authMethod: String,
    onAuthMethodChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    passwordVisible: Boolean,
    onPasswordVisibleChange: (Boolean) -> Unit,
    keyPath: String,
    onKeyPathChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = username,
            onValueChange = onUsernameChange,
            label = { Text("Username") },
            placeholder = { Text("SSH username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        OutlinedTextField(
            value = host,
            onValueChange = onHostChange,
            label = { Text("Host *") },
            placeholder = { Text("hostname or IP address") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        OutlinedTextField(
            value = port,
            onValueChange = { newValue ->
                // Only allow numeric input for port
                if (newValue.all { it.isDigit() } || newValue.isEmpty()) {
                    onPortChange(newValue)
                }
            },
            label = { Text("Port") },
            placeholder = { Text("22") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        OutlinedTextField(
            value = remotePath,
            onValueChange = onRemotePathChange,
            label = { Text("Remote Path") },
            placeholder = { Text("/path/to/backup/repo") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        // Auth method radio buttons
        Text(
            text = "Authentication Method",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onAuthMethodChange("password") }
            ) {
                RadioButton(
                    selected = authMethod == "password",
                    onClick = { onAuthMethodChange("password") }
                )
                Text(
                    text = "Password",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onAuthMethodChange("key") }
            ) {
                RadioButton(
                    selected = authMethod == "key",
                    onClick = { onAuthMethodChange("key") }
                )
                Text(
                    text = "SSH Key",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
        }

        // Conditional field based on auth method
        if (authMethod == "password") {
            OutlinedTextField(
                value = password,
                onValueChange = onPasswordChange,
                label = { Text("SSH Password") },
                placeholder = { Text("SSH password") },
                singleLine = true,
                visualTransformation = if (passwordVisible)
                    VisualTransformation.None
                else
                    PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { onPasswordVisibleChange(!passwordVisible) }) {
                        Text(
                            text = if (passwordVisible) "🔒" else "👁️",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = CwocInputDefaults.outlinedColors()
            )
        } else {
            OutlinedTextField(
                value = keyPath,
                onValueChange = onKeyPathChange,
                label = { Text("SSH Key Path") },
                placeholder = { Text("/path/to/id_rsa") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = CwocInputDefaults.outlinedColors()
            )
        }
    }
}

// ============================================================
// Section: Backup Target Modal — Data to Backup (Task 4.3)
// Validates: Requirements 3.2
// ============================================================

/**
 * Data class representing a single backup path item with its display label,
 * actual path string, and priority group.
 */
private data class BackupPathItem(
    val label: String,
    val path: String,
    val group: String // "Critical", "Important", "Nice to Have"
)

/**
 * All backup path items matching the web implementation exactly.
 * Critical and Important are checked by default; Nice to Have are unchecked.
 */
private val allBackupPathItems = listOf(
    // Critical (checked by default)
    BackupPathItem("Database pre-backup copy", "/app/data/app.db.backup", "Critical"),
    BackupPathItem("Encryption key", "/app/data/encryption.key", "Critical"),
    BackupPathItem("Contact profile pictures", "/app/data/contact_pictures", "Critical"),
    BackupPathItem("User profile pictures", "/app/data/profile_pictures", "Critical"),
    BackupPathItem("Attachments", "/app/data/attachments", "Critical"),
    BackupPathItem("Contact vCards", "/app/data/vcards", "Critical"),
    // Important (checked by default)
    BackupPathItem("SSL certificates", "/etc/ssl/certs/cwoc", "Important"),
    BackupPathItem("Systemd service file", "/etc/systemd/system/cwoc.service", "Important"),
    BackupPathItem("Nginx config", "/etc/nginx/sites-available/cwoc", "Important"),
    // Nice to Have (unchecked by default)
    BackupPathItem("Client log", "/app/data/client-log.json", "Nice to Have"),
    BackupPathItem("Update log", "/app/data/update-log.json", "Nice to Have")
)

/**
 * Returns the default selected paths (Critical + Important items).
 */
fun getDefaultBackupPaths(): List<String> {
    return allBackupPathItems
        .filter { it.group == "Critical" || it.group == "Important" }
        .map { it.path }
}

/**
 * Collapsible "Data to Backup" section for the backup target modal.
 * Collapsed by default. Shows three groups (Critical, Important, Nice to Have)
 * with checkbox items for each backup path.
 *
 * @param selectedPaths The currently selected backup paths (mutable state list)
 * @param onPathToggled Callback when a path is checked/unchecked
 */
@Composable
fun BackupDataSection(
    selectedPaths: List<String>,
    onPathToggled: (String, Boolean) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Collapsible header — collapsed by default
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Data to Backup ${if (expanded) "▾" else "▸"}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
        }

        // Animated collapsible body
        AnimatedVisibility(visible = expanded) {
            Column(
                modifier = Modifier.padding(start = 8.dp, top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Group items by their group label
                val groups = listOf("Critical", "Important", "Nice to Have")

                groups.forEach { groupName ->
                    val groupItems = allBackupPathItems.filter { it.group == groupName }

                    // Bold group label
                    Text(
                        text = groupName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                    )

                    // Checkbox items for this group
                    groupItems.forEach { item ->
                        val isChecked = item.path in selectedPaths

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onPathToggled(item.path, !isChecked) }
                                .padding(vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isChecked,
                                onCheckedChange = { checked ->
                                    onPathToggled(item.path, checked)
                                }
                            )
                            Text(
                                text = item.label,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// Section: Backup Target Modal — Notifications (Task 4.6)
// Validates: Requirement 3.2
// ============================================================

/**
 * Notifications section for the Backup Target Modal.
 * Collapsible, collapsed by default. Contains:
 * - Notify dropdown: "All Admins" (only option)
 * - Trigger dropdown: "Both (Success & Failures)" (default), "Success Only", "Failures Only"
 * - Checkboxes: "Transfer notifications (backup/restore)" (checked), "Maintenance notifications (prune)" (checked)
 *
 * @param notifyRecipients Current notify recipients value (e.g., "all_admins")
 * @param onNotifyRecipientsChange Callback when notify recipients changes
 * @param notifyTrigger Current trigger value (e.g., "both", "success", "failures")
 * @param onNotifyTriggerChange Callback when trigger changes
 * @param notifyTransfer Whether transfer notifications are enabled
 * @param onNotifyTransferChange Callback when transfer notification checkbox changes
 * @param notifyMaintenance Whether maintenance notifications are enabled
 * @param onNotifyMaintenanceChange Callback when maintenance notification checkbox changes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupNotificationsSection(
    notifyRecipients: String,
    onNotifyRecipientsChange: (String) -> Unit,
    notifyTrigger: String,
    onNotifyTriggerChange: (String) -> Unit,
    notifyTransfer: Boolean,
    onNotifyTransferChange: (Boolean) -> Unit,
    notifyMaintenance: Boolean,
    onNotifyMaintenanceChange: (Boolean) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    // Notify dropdown options (value → display)
    val notifyOptions = listOf(
        "all_admins" to "All Admins"
    )

    // Trigger dropdown options (value → display)
    val triggerOptions = listOf(
        "both" to "Both (Success & Failures)",
        "success" to "Success Only",
        "failures" to "Failures Only"
    )

    Column(modifier = Modifier.fillMaxWidth()) {
        // Collapsible header — collapsed by default
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Notifications ${if (expanded) "▾" else "▸"}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
        }

        // Animated collapsible body
        AnimatedVisibility(visible = expanded) {
            Column(
                modifier = Modifier.padding(start = 8.dp, top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // --- Notify dropdown ---
                Text(
                    text = "Notify",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )

                var notifyDropdownExpanded by remember { mutableStateOf(false) }
                val currentNotifyLabel = notifyOptions
                    .firstOrNull { it.first == notifyRecipients }?.second ?: "All Admins"

                ExposedDropdownMenuBox(
                    expanded = notifyDropdownExpanded,
                    onExpandedChange = { notifyDropdownExpanded = it },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = currentNotifyLabel,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = notifyDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        singleLine = true,
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = notifyDropdownExpanded,
                        onDismissRequest = { notifyDropdownExpanded = false }
                    ) {
                        notifyOptions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onNotifyRecipientsChange(value)
                                    notifyDropdownExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                            )
                        }
                    }
                }

                // --- Trigger dropdown ---
                Text(
                    text = "Trigger",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )

                var triggerDropdownExpanded by remember { mutableStateOf(false) }
                val currentTriggerLabel = triggerOptions
                    .firstOrNull { it.first == notifyTrigger }?.second ?: "Both (Success & Failures)"

                ExposedDropdownMenuBox(
                    expanded = triggerDropdownExpanded,
                    onExpandedChange = { triggerDropdownExpanded = it },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = currentTriggerLabel,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = triggerDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        singleLine = true,
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = triggerDropdownExpanded,
                        onDismissRequest = { triggerDropdownExpanded = false }
                    ) {
                        triggerOptions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onNotifyTriggerChange(value)
                                    triggerDropdownExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                            )
                        }
                    }
                }

                // --- Transfer notifications checkbox ---
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNotifyTransferChange(!notifyTransfer) }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = notifyTransfer,
                        onCheckedChange = { onNotifyTransferChange(it) }
                    )
                    Text(
                        text = "Transfer notifications (backup/restore)",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 4.dp)
                    )
                }

                // --- Maintenance notifications checkbox ---
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNotifyMaintenanceChange(!notifyMaintenance) }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = notifyMaintenance,
                        onCheckedChange = { onNotifyMaintenanceChange(it) }
                    )
                    Text(
                        text = "Maintenance notifications (prune)",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 4.dp)
                    )
                }
            }
        }
    }
}

// ============================================================
// Section: Backup Target Modal — Retention Policy (Task 4.5)
// Validates: Requirements 3.2
// ============================================================

/**
 * Collapsible "Retention Policy" section for the backup target modal.
 * Collapsed by default. Shows hint text explaining the retention policy,
 * followed by five number fields for configuring how many snapshots to keep.
 *
 * @param keepLast MutableState for "Keep last" value (default "5")
 * @param keepDaily MutableState for "Keep daily" value (default "7")
 * @param keepWeekly MutableState for "Keep weekly" value (default "4")
 * @param keepMonthly MutableState for "Keep monthly" value (default "6")
 * @param keepYearly MutableState for "Keep yearly" value (default "2")
 */
@Composable
fun BackupRetentionSection(
    keepLast: MutableState<String>,
    keepDaily: MutableState<String>,
    keepWeekly: MutableState<String>,
    keepMonthly: MutableState<String>,
    keepYearly: MutableState<String>
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Collapsible header — collapsed by default
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Retention Policy ${if (expanded) "▾" else "▸"}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
        }

        // Animated collapsible body
        AnimatedVisibility(visible = expanded) {
            Column(
                modifier = Modifier.padding(start = 8.dp, top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Hint text
                Text(
                    text = "How many snapshots to keep. Old snapshots are automatically pruned to this policy after each backup.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Retention fields — 2 per row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = keepLast.value,
                        onValueChange = { keepLast.value = it.filter { c -> c.isDigit() } },
                        label = { Text("Keep last") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
                        ),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    OutlinedTextField(
                        value = keepDaily.value,
                        onValueChange = { keepDaily.value = it.filter { c -> c.isDigit() } },
                        label = { Text("Keep daily") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
                        ),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = keepWeekly.value,
                        onValueChange = { keepWeekly.value = it.filter { c -> c.isDigit() } },
                        label = { Text("Keep weekly") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
                        ),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    OutlinedTextField(
                        value = keepMonthly.value,
                        onValueChange = { keepMonthly.value = it.filter { c -> c.isDigit() } },
                        label = { Text("Keep monthly") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
                        ),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = keepYearly.value,
                        onValueChange = { keepYearly.value = it.filter { c -> c.isDigit() } },
                        label = { Text("Keep yearly") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
                        ),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    // Spacer to maintain grid alignment
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

// ============================================================
// Section: Restic Backup — Schedule Section (Task 4.4)
// Validates: Requirements 3.6, 3.7
// ============================================================

/**
 * Backup Schedule section — collapsible, expanded by default.
 * Contains a frequency dropdown and a time picker (visible only for Daily/Weekly).
 *
 * Frequency options (value → display):
 *   "hourly" → "Hourly"
 *   "6hour" → "Every 6 Hours"
 *   "daily" → "Daily" (default)
 *   "weekly" → "Weekly"
 *   "manual" → "Manual Only"
 *
 * Time is stored as "HH:mm" (24-hour internal), displayed per user preference.
 * Default time: "02:00" (2 AM).
 *
 * Validates: Requirements 3.6, 3.7
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupScheduleSection(
    frequency: String,
    onFrequencyChange: (String) -> Unit,
    time: String,
    onTimeChange: (String) -> Unit,
    timeFormat: String = "12hour"
) {
    var expanded by remember { mutableStateOf(true) }
    var frequencyDropdownExpanded by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val context = LocalContext.current

    // Frequency options: value → display label
    val frequencyOptions = listOf(
        "hourly" to "Hourly",
        "6hour" to "Every 6 Hours",
        "daily" to "Daily",
        "weekly" to "Weekly",
        "manual" to "Manual Only"
    )

    // Get display label for current frequency value
    val currentFrequencyLabel = frequencyOptions
        .firstOrNull { it.first == frequency }?.second ?: "Daily"

    // Whether time picker should be visible (only for daily/weekly)
    val showTimeField = frequency == "daily" || frequency == "weekly"

    // Format the time for display based on user preference
    val displayTime = remember(time, timeFormat) {
        try {
            val parts = time.split(":")
            val hour = parts[0].toInt()
            val minute = parts[1].toInt()
            if (timeFormat == "24hour") {
                String.format("%02d:%02d", hour, minute)
            } else {
                val displayHour = when {
                    hour == 0 -> 12
                    hour > 12 -> hour - 12
                    else -> hour
                }
                val amPm = if (hour < 12) "AM" else "PM"
                String.format("%d:%02d %s", displayHour, minute, amPm)
            }
        } catch (_: Exception) {
            time
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Collapsible header: "Schedule ▾/▸"
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Schedule ${if (expanded) "▾" else "▸"}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
        }

        // Collapsible body
        AnimatedVisibility(visible = expanded) {
            Column(
                modifier = Modifier.padding(bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Frequency dropdown — Validates: Requirement 3.6
                Text(
                    text = "Frequency",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )

                ExposedDropdownMenuBox(
                    expanded = frequencyDropdownExpanded,
                    onExpandedChange = { frequencyDropdownExpanded = it },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = currentFrequencyLabel,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = frequencyDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        singleLine = true,
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = frequencyDropdownExpanded,
                        onDismissRequest = { frequencyDropdownExpanded = false }
                    ) {
                        frequencyOptions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onFrequencyChange(value)
                                    frequencyDropdownExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                            )
                        }
                    }
                }

                // Time picker — visible only for Daily/Weekly — Validates: Requirement 3.7
                if (showTimeField) {
                    Text(
                        text = "Time",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )

                    // Tappable time display that opens TimePickerDialog
                    // Wrap in Box with clickable since disabled TextField doesn't receive clicks
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showTimePicker = true }
                    ) {
                        OutlinedTextField(
                            value = displayTime,
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = false,
                            colors = CwocInputDefaults.outlinedColors()
                        )
                    }

                    // Show TimePickerDialog when triggered
                    if (showTimePicker) {
                        val timeParts = time.split(":")
                        val currentHour = timeParts.getOrNull(0)?.toIntOrNull() ?: 2
                        val currentMinute = timeParts.getOrNull(1)?.toIntOrNull() ?: 0

                        LaunchedEffect(Unit) {
                            val dialog = android.app.TimePickerDialog(
                                context,
                                { _, selectedHour, selectedMinute ->
                                    val newTime = String.format("%02d:%02d", selectedHour, selectedMinute)
                                    onTimeChange(newTime)
                                    showTimePicker = false
                                },
                                currentHour,
                                currentMinute,
                                timeFormat == "24hour"
                            )
                            dialog.setOnCancelListener {
                                showTimePicker = false
                            }
                            dialog.setOnDismissListener {
                                showTimePicker = false
                            }
                            dialog.show()
                        }
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
private fun VersionUpdatesSection(
    apiService: CwocApiService?,
    serverUrl: String,
    authToken: String,
    isAdmin: Boolean,
    timeFormat: String = "12hour",
    okHttpClient: OkHttpClient? = null
) {
    var expanded by remember { mutableStateOf(true) }
    var showReleaseNotes by remember { mutableStateOf(false) }
    var showUpgradeModal by remember { mutableStateOf(false) }
    var upgradeModalMode by remember { mutableStateOf(UpgradeModalMode.UPGRADE) }
    var showRestartConfirm by remember { mutableStateOf(false) }

    // Version info state
    var versionString by remember { mutableStateOf<String?>(null) }
    var installedDatetime by remember { mutableStateOf<String?>(null) }
    var isLoadingVersion by remember { mutableStateOf(true) }

    // Disk usage state
    var diskUsed by remember { mutableStateOf<Long?>(null) }
    var diskTotal by remember { mutableStateOf<Long?>(null) }
    var diskPercent by remember { mutableStateOf<Double?>(null) }
    var cwocDataSize by remember { mutableStateOf<Long?>(null) }
    var cwocDataPercent by remember { mutableStateOf<Double?>(null) }
    var isLoadingDisk by remember { mutableStateOf(true) }
    var isRefreshingDisk by remember { mutableStateOf(false) }

    // Restart state
    var isRestarting by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Fetch version info on first composition
    LaunchedEffect(Unit) {
        if (apiService != null) {
            try {
                val response = withContext(Dispatchers.IO) {
                    apiService.getVersion()
                }
                if (response.isSuccessful) {
                    val body = response.body()
                    versionString = body?.version
                    installedDatetime = body?.installedDatetime
                }
            } catch (_: Exception) {
                // Silently fail — version will show as unavailable
            } finally {
                isLoadingVersion = false
            }
        } else {
            isLoadingVersion = false
        }
    }

    // Fetch disk usage on first composition
    LaunchedEffect(Unit) {
        if (apiService != null) {
            try {
                val response = withContext(Dispatchers.IO) {
                    apiService.getDiskUsage()
                }
                if (response.isSuccessful) {
                    val body = response.body()
                    diskUsed = body?.used
                    diskTotal = body?.total
                    diskPercent = body?.percent
                    cwocDataSize = body?.cwocDataBytes
                    cwocDataPercent = body?.cwocDataPercent
                }
            } catch (_: Exception) {
                // Silently fail
            } finally {
                isLoadingDisk = false
            }
        } else {
            isLoadingDisk = false
        }
    }

    Column {
        AdminCollapsibleHeader(
            title = "📦 Version & Updates",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // --- Version info (Req 28.1) ---
                if (isLoadingVersion) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Loading version...", style = MaterialTheme.typography.bodySmall)
                    }
                } else {
                    Text(
                        text = "Version: ${versionString ?: "Unknown"}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    if (installedDatetime != null) {
                        val formattedDate = formatVersionDate(installedDatetime!!, timeFormat)
                        Text(
                            text = "Updated: $formattedDate",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // --- Disk usage (Req 28.2) ---
                if (isLoadingDisk && !isRefreshingDisk) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Loading disk usage...", style = MaterialTheme.typography.bodySmall)
                    }
                } else {
                    val diskColor = when {
                        diskPercent != null && diskPercent!! >= 90.0 -> Color(0xFFD32F2F) // Critical red
                        diskPercent != null && diskPercent!! >= 75.0 -> Color(0xFFFF8F00) // Warning amber
                        else -> MaterialTheme.colorScheme.onSurface
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            if (diskUsed != null && diskTotal != null && diskPercent != null) {
                                Text(
                                    text = "Disk: ${formatBytes(diskUsed!!)} / ${formatBytes(diskTotal!!)} (${String.format("%.0f", diskPercent)}% used)",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = diskColor,
                                    fontWeight = if (diskPercent!! >= 75.0) FontWeight.Bold else FontWeight.Normal
                                )
                            } else {
                                Text(
                                    text = "Disk: unavailable",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        // Refresh button (Req 28.2)
                        IconButton(
                            onClick = {
                                if (apiService != null) {
                                    isRefreshingDisk = true
                                    scope.launch {
                                        try {
                                            val response = withContext(Dispatchers.IO) {
                                                apiService.getDiskUsage()
                                            }
                                            if (response.isSuccessful) {
                                                val body = response.body()
                                                diskUsed = body?.used
                                                diskTotal = body?.total
                                                diskPercent = body?.percent
                                                cwocDataSize = body?.cwocDataBytes
                                                cwocDataPercent = body?.cwocDataPercent
                                            }
                                        } catch (_: Exception) {
                                            Toast.makeText(context, "Failed to refresh disk usage", Toast.LENGTH_SHORT).show()
                                        } finally {
                                            isRefreshingDisk = false
                                        }
                                    }
                                }
                            },
                            enabled = !isRefreshingDisk
                        ) {
                            if (isRefreshingDisk) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "Refresh disk usage"
                                )
                            }
                        }
                    }

                    // --- CWOC Data size (Req 28.3) ---
                    if (cwocDataSize != null && cwocDataPercent != null) {
                        Text(
                            text = "CWOC Data: ${formatBytes(cwocDataSize!!)} (${String.format("%.1f", cwocDataPercent)}% of disk)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // --- Upgrade button (Req 28.4, 28.5) ---
                Button(
                    onClick = {
                        upgradeModalMode = UpgradeModalMode.UPGRADE
                        showUpgradeModal = true
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("⬆️ Upgrade")
                }

                // --- Show Log button (Req 28.6) ---
                OutlinedButton(
                    onClick = {
                        upgradeModalMode = UpgradeModalMode.VIEW_LOG
                        showUpgradeModal = true
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("📄 Show Log")
                }

                // --- Restart CWOC button (Req 28.7) — admin only ---
                if (isAdmin) {
                    Button(
                        onClick = { showRestartConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isRestarting,
                        colors = CwocButtonDefaults.dangerColors(),
                        border = CwocButtonDefaults.dangerBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        if (isRestarting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Restarting...")
                        } else {
                            Text("🔄 Restart CWOC")
                        }
                    }
                }

                // --- Release Notes button (Req 28.8) ---
                OutlinedButton(
                    onClick = { showReleaseNotes = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📋 Release Notes")
                }
            }
        }
    }

    // --- Upgrade Modal (Req 28.4, 28.5, 28.6) ---
    if (showUpgradeModal && apiService != null) {
        UpgradeModal(
            mode = upgradeModalMode,
            apiService = apiService,
            onDismiss = { showUpgradeModal = false }
        )
    }

    // --- Release Notes Dialog (Req 28.8) ---
    if (showReleaseNotes && okHttpClient != null) {
        ReleaseNotesDialog(
            serverUrl = serverUrl.ifEmpty { "http://192.168.1.111:3333" },
            authToken = authToken,
            okHttpClient = okHttpClient,
            onDismiss = { showReleaseNotes = false }
        )
    }

    // --- Restart Confirmation Dialog (Req 28.7) ---
    if (showRestartConfirm) {
        AlertDialog(
            onDismissRequest = { showRestartConfirm = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("⚠️ Restart CWOC", style = CwocDialogDefaults.titleStyle) },
            text = {
                Text("The CWOC service will be briefly unavailable during restart. All connected clients will be temporarily disconnected. Are you sure you want to restart?")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showRestartConfirm = false
                        isRestarting = true
                        scope.launch {
                            try {
                                val response = withContext(Dispatchers.IO) {
                                    apiService?.restartService()
                                }
                                if (response?.isSuccessful == true) {
                                    Toast.makeText(context, "Restart initiated", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "Restart failed: ${response?.code()}", Toast.LENGTH_SHORT).show()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Restart failed: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isRestarting = false
                            }
                        }
                    }, colors = CwocDialogDefaults.confirmButtonColors()) {
                    Text("Restart", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showRestartConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ============================================================
// Section: Tailscale Configuration (Task 32.1)
// ============================================================

/**
 * Full Tailscale configuration section with toggle, status display,
 * auth key management, connect/disconnect, and status refresh.
 *
 * Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10
 */
@Composable
private fun TailscaleSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    settingsViewModel: SettingsViewModel
) {
    val tailscaleState by settingsViewModel.tailscaleState.collectAsState()
    val context = LocalContext.current
    var sectionExpanded by remember { mutableStateOf(false) }
    var showHelp by remember { mutableStateOf(false) }
    var authKeyVisible by remember { mutableStateOf(false) }
    var localAuthKey by remember(settingsState.tailscaleAuthKey) {
        mutableStateOf(settingsState.tailscaleAuthKey)
    }

    // Initialize saved state when section first expands
    val initialized = remember { mutableStateOf(false) }
    if (sectionExpanded && !initialized.value) {
        initialized.value = true
        settingsViewModel.initTailscaleSavedState()
        settingsViewModel.refreshTailscaleStatus()
    }

    // Determine status icon for the header
    val statusIcon = when (tailscaleState.status) {
        "active" -> "🟢"
        "installed_inactive" -> "🟡"
        "not_installed" -> "⚪"
        "error" -> "🔴"
        else -> "⚪"
    }

    // Determine if Save Config should be enabled
    val currentEnabled = settingsState.tailscaleEnabled == "1"
    val saveConfigDirty = (localAuthKey != tailscaleState.savedAuthKey) ||
            (currentEnabled != tailscaleState.savedEnabled)

    Column {
        // Header row: Tailscale toggle button + help icon
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Tailscale toggle button with status icon
            Button(
                onClick = {
                    sectionExpanded = !sectionExpanded
                },
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                Text("Tailscale  $statusIcon")
            }

            // Help icon
            IconButton(
                onClick = { showHelp = !showHelp },
                modifier = Modifier.size(32.dp)
            ) {
                Text(
                    text = "❓",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Help text (toggled by help icon)
        AnimatedVisibility(visible = showHelp) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Tailscale is a free mesh VPN that lets you securely access your CWOC instance from anywhere — your phone, laptop, or another network — without port forwarding or exposing your server to the internet.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Setup:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "1. Click the Tailscale button to expand the configuration.\n" +
                                "2. Create a free account at tailscale.com if you don't have one.\n" +
                                "3. Click \"Get Key\" to open the Tailscale admin console.\n" +
                                "4. Generate an Auth Key (one-time use recommended). Copy it.\n" +
                                "5. Paste the key into the Auth Key field and click Save Config.\n" +
                                "6. Click Connect.\n" +
                                "7. Install Tailscale on your phone/laptop and sign in with the same account.\n" +
                                "8. Access CWOC from anywhere using the Tailscale IP shown above.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        // Collapsible config body
        AnimatedVisibility(visible = sectionExpanded) {
            Column(
                modifier = Modifier.padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Status row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Status:",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = when (tailscaleState.status) {
                            "not_installed" -> "⚪ Not Installed"
                            "installed_inactive" -> "🟡 Inactive"
                            "active" -> "🟢 Connected"
                            "error" -> "🔴 Error"
                            else -> if (tailscaleState.isLoading) "⏳ Checking..." else "⚪ Unknown"
                        },
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    // Check Status button
                    OutlinedButton(
                        onClick = { settingsViewModel.refreshTailscaleStatus() },
                        enabled = !tailscaleState.isLoading
                    ) {
                        if (tailscaleState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                        Text("🔄 Check Status", style = MaterialTheme.typography.bodySmall)
                    }
                }

                // IP + Hostname (shown when connected)
                if (tailscaleState.status == "active" && (tailscaleState.ip.isNotEmpty() || tailscaleState.hostname.isNotEmpty())) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0x1A2D5A1E) // light green tint
                        )
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            if (tailscaleState.ip.isNotEmpty()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "IP: ",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = tailscaleState.ip,
                                        style = MaterialTheme.typography.bodySmall,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                            if (tailscaleState.hostname.isNotEmpty()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Host: ",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = tailscaleState.hostname,
                                        style = MaterialTheme.typography.bodySmall,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }
                }

                // Error message row
                if (tailscaleState.errorMessage != null) {
                    Text(
                        text = tailscaleState.errorMessage!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                // Auth Key input
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    OutlinedTextField(
                        value = localAuthKey,
                        onValueChange = { newValue ->
                            localAuthKey = newValue
                            onUpdateSetting("tailscale_auth_key", newValue)
                        },
                        label = { Text("Auth Key") },
                        placeholder = { Text("tskey-auth-...") },
                        singleLine = true,
                        visualTransformation = if (authKeyVisible)
                            androidx.compose.ui.text.input.VisualTransformation.None
                        else
                            androidx.compose.ui.text.input.PasswordVisualTransformation(),
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    // Show/hide toggle
                    IconButton(
                        onClick = { authKeyVisible = !authKeyVisible },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Text(
                            text = if (authKeyVisible) "🔒" else "👁️",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                // Get Key link
                TextButton(
                    onClick = {
                        // Open Tailscale admin console in browser
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://login.tailscale.com/admin/settings/keys"))
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            Toast.makeText(context, "Unable to open browser", Toast.LENGTH_SHORT).show()
                        }
                    }
                ) {
                    Text("🔑 Get Key (login.tailscale.com/admin/settings/keys)")
                }

                // Save Config button
                Button(
                    onClick = {
                        settingsViewModel.saveTailscaleConfig(
                            authKey = localAuthKey,
                            enabled = currentEnabled
                        )
                    },
                    enabled = saveConfigDirty && !tailscaleState.isLoading,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("💾 Save Config")
                }
                Text(
                    text = "Saves immediately — independent of the main settings Save button",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Connect / Disconnect buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val canConnect = tailscaleState.status == "installed_inactive"
                    val canDisconnect = tailscaleState.status == "active"

                    Button(
                        onClick = { settingsViewModel.connectTailscale() },
                        enabled = canConnect && !tailscaleState.isLoading,
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("▶️ Connect")
                    }

                    OutlinedButton(
                        onClick = { settingsViewModel.disconnectTailscale() },
                        enabled = canDisconnect && !tailscaleState.isLoading,
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("⏹️ Disconnect")
                    }
                }

                // Inline feedback message
                if (tailscaleState.feedbackMessage != null) {
                    val feedbackColor = when (tailscaleState.feedbackType) {
                        "success" -> Color(0xFF1E3F14)
                        "error" -> Color(0xFF8B1A1A)
                        "warning" -> Color(0xFF6B4F00)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    val feedbackBg = when (tailscaleState.feedbackType) {
                        "success" -> Color(0x1F2D5A1E)
                        "error" -> Color(0x1F8B1A1A)
                        "warning" -> Color(0x1FB8860B)
                        else -> Color(0x1A4A2C2A)
                    }
                    val feedbackIcon = when (tailscaleState.feedbackType) {
                        "success" -> "✅"
                        "error" -> "❌"
                        "warning" -> "⚠️"
                        else -> "ℹ️"
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = feedbackBg)
                    ) {
                        Text(
                            text = "$feedbackIcon  ${tailscaleState.feedbackMessage}",
                            style = MaterialTheme.typography.bodySmall,
                            color = feedbackColor,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            }
        }
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

/**
 * Formats a byte count into a human-readable string (e.g., "1.5 GB", "256 MB").
 */
private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val kb = bytes / 1024.0
    if (kb < 1024) return String.format("%.1f KB", kb)
    val mb = kb / 1024.0
    if (mb < 1024) return String.format("%.1f MB", mb)
    val gb = mb / 1024.0
    if (gb < 1024) return String.format("%.1f GB", gb)
    val tb = gb / 1024.0
    return String.format("%.1f TB", tb)
}

/**
 * Formats an ISO datetime string (from /api/version installed_datetime) according to
 * the user's configured time format setting.
 * - "12hour" → "Jan 15, 2025, 3:45 PM"
 * - "24hour" or "metric" → "Jan 15, 2025, 15:45"
 */
private fun formatVersionDate(isoDatetime: String, timeFormat: String): String {
    return try {
        // Parse ISO datetime (e.g., "2025-01-15T15:45:00" or "2025-01-15 15:45:00")
        val normalized = isoDatetime.replace("T", " ").trim()
        val parts = normalized.split(" ")
        if (parts.size < 2) return isoDatetime

        val dateParts = parts[0].split("-")
        if (dateParts.size != 3) return isoDatetime

        val year = dateParts[0].toIntOrNull() ?: return isoDatetime
        val month = dateParts[1].toIntOrNull() ?: return isoDatetime
        val day = dateParts[2].toIntOrNull() ?: return isoDatetime

        val timeParts = parts[1].split(":")
        val hour = timeParts.getOrNull(0)?.toIntOrNull() ?: 0
        val minute = timeParts.getOrNull(1)?.toIntOrNull() ?: 0

        val monthNames = arrayOf(
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        )
        val monthName = if (month in 1..12) monthNames[month - 1] else "???"

        val timeStr = when (timeFormat) {
            "12hour" -> {
                val displayHour = when {
                    hour == 0 -> 12
                    hour > 12 -> hour - 12
                    else -> hour
                }
                val amPm = if (hour < 12) "AM" else "PM"
                String.format("%d:%02d %s", displayHour, minute, amPm)
            }
            else -> { // "24hour" or "metric"
                String.format("%02d:%02d", hour, minute)
            }
        }

        "$monthName $day, $year, $timeStr"
    } catch (_: Exception) {
        isoDatetime // Fallback to raw string if parsing fails
    }
}

/**
 * Dropdown composable for admin settings with label, value/options mapping,
 * and optional display labels.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsDropdown(
    label: String,
    value: String,
    options: List<String>,
    displayLabels: List<String> = options,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val currentIndex = options.indexOf(value).coerceAtLeast(0)
    val displayValue = displayLabels.getOrElse(currentIndex) { value }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = displayValue,
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth(),
                singleLine = true,
                colors = CwocInputDefaults.outlinedColors()
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEachIndexed { index, option ->
                    DropdownMenuItem(
                        text = { Text(displayLabels.getOrElse(index) { option }) },
                        onClick = {
                            onValueChange(option)
                            expanded = false
                        },
                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                    )
                }
            }
        }
    }
}

// ============================================================
// Section: Restic Backup — Inline Feedback & Results Area (Task 4.7)
// Validates: Requirements 8.1, 8.2, 8.3
// ============================================================

/**
 * Inline feedback composable for the backup modal.
 * Displays a colored Card with an icon and message text, dismissible on tap.
 *
 * Color mapping:
 * - "success" → green background (Color(0xFFE8F5E9)) with ✓ icon
 * - "error" → red background (Color(0xFFFFEBEE)) with ✗ icon
 * - "warning" → yellow background (Color(0xFFFFF8E1)) with ⚠️ icon
 * - "info" or null → neutral/gray background (Color(0xFFF5F5F5)) with ℹ️ icon
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 */
@Composable
fun BackupFeedbackArea(
    feedbackMessage: String?,
    feedbackType: String?,
    onDismiss: () -> Unit
) {
    if (feedbackMessage == null) return

    val backgroundColor = when (feedbackType) {
        "success" -> Color(0xFFE8F5E9)
        "error" -> Color(0xFFFFEBEE)
        "warning" -> Color(0xFFFFF8E1)
        else -> Color(0xFFF5F5F5)
    }

    val icon = when (feedbackType) {
        "success" -> "✓"
        "error" -> "✗"
        "warning" -> "⚠️"
        else -> "ℹ️"
    }

    val textColor = when (feedbackType) {
        "success" -> Color(0xFF2E7D32)
        "error" -> Color(0xFFC62828)
        "warning" -> Color(0xFFF57F17)
        else -> Color(0xFF424242)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onDismiss() },
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = icon,
                style = MaterialTheme.typography.bodyLarge,
                color = textColor
            )
            Text(
                text = feedbackMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/**
 * Scrollable results area for the backup modal.
 * Wraps content in a scrollable Column with a max height constraint (300.dp).
 * Used for displaying snapshot lists and restore picker below the feedback area.
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 */
@Composable
fun BackupResultsArea(
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 300.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        content()
    }
}

// ============================================================
// Section: Restic Backup — Operation Buttons Grid (Task 4.8)
// Validates: Requirements 3.8, 3.9, 4.3, 4.4
// ============================================================

/**
 * 3-column grid of operation buttons for the backup target modal.
 * Matches the web's button grid layout:
 * - Row 1: 🩺 Status, 📋 Snapshots, (spacer)
 * - Row 2: ▶️ Backup Now, ♻️ Restore, ⬇️ Download
 * - Row 3: 🗑️ Manual Prune, 🔌 Remove, 💀 Remove & Delete (edit mode only)
 *
 * Each button shows a CircularProgressIndicator when its operation is in progress.
 * "▶️ Backup Now" is disabled in create mode.
 * Row 3 buttons are only visible in edit mode.
 * Remove/Delete buttons use MaterialTheme.colorScheme.error for text color.
 *
 * Validates: Requirements 3.8, 3.9, 4.3, 4.4
 */
@Composable
fun BackupOperationButtons(
    settingsViewModel: SettingsViewModel,
    targetId: String?,
    isEditMode: Boolean,
    isRunningBackup: Boolean,
    isCheckingStatus: Boolean,
    isLoadingSnapshots: Boolean,
    isRestoring: Boolean,
    isPruning: Boolean,
    onRestore: () -> Unit,
    onPrune: () -> Unit,
    onRemove: () -> Unit,
    onRemoveAndDelete: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Row 1: Status, Snapshots, (spacer)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // 🩺 Status button
            OutlinedButton(
                onClick = { targetId?.let { settingsViewModel.checkBackupStatus(it) } },
                modifier = Modifier.weight(1f),
                enabled = isEditMode && !isCheckingStatus
            ) {
                if (isCheckingStatus) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                } else {
                    Text("🩺 Status")
                }
            }

            // 📋 Snapshots button
            OutlinedButton(
                onClick = { targetId?.let { settingsViewModel.loadBackupSnapshots(it) } },
                modifier = Modifier.weight(1f),
                enabled = isEditMode && !isLoadingSnapshots
            ) {
                if (isLoadingSnapshots) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                } else {
                    Text("📋 Snapshots")
                }
            }

            // Spacer to maintain 3-column grid
            Spacer(modifier = Modifier.weight(1f))
        }

        // Row 2: Backup Now, Restore, Download
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // ▶️ Backup Now button — disabled in create mode
            OutlinedButton(
                onClick = { targetId?.let { settingsViewModel.runBackupTarget(it) } },
                modifier = Modifier.weight(1f),
                enabled = isEditMode && !isRunningBackup
            ) {
                if (isRunningBackup) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                } else {
                    Text("▶️ Backup Now")
                }
            }

            // ♻️ Restore button
            OutlinedButton(
                onClick = onRestore,
                modifier = Modifier.weight(1f),
                enabled = isEditMode && !isRestoring
            ) {
                if (isRestoring) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                } else {
                    Text("♻️ Restore")
                }
            }

            // ⬇️ Download button
            OutlinedButton(
                onClick = { /* Download triggers snapshot list first — handled by task 4.9 */ },
                modifier = Modifier.weight(1f),
                enabled = isEditMode
            ) {
                Text("⬇️ Download")
            }
        }

        // Row 3: Manual Prune, Remove, Remove & Delete — only visible in edit mode
        if (isEditMode) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // 🗑️ Manual Prune button
                OutlinedButton(
                    onClick = onPrune,
                    modifier = Modifier.weight(1f),
                    enabled = !isPruning
                ) {
                    if (isPruning) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    } else {
                        Text("🗑️ Prune")
                    }
                }

                // 🔌 Remove button — danger text color
                OutlinedButton(
                    onClick = onRemove,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "🔌 Remove",
                        color = MaterialTheme.colorScheme.error
                    )
                }

                // 💀 Remove & Delete button — danger text color
                OutlinedButton(
                    onClick = onRemoveAndDelete,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "💀 Delete",
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

// ============================================================
// Section: Restic Backup — Snapshot List Display (Task 4.9)
// Validates: Requirements 6.3, 7.1, 7.2, 7.3
// ============================================================

/**
 * Displays a list of backup snapshots with count header, snapshot details, and action buttons.
 * Triggered by the "📋 Snapshots" button in the operations grid.
 *
 * Each snapshot row shows:
 * - First line: short_id (monospace, bold) + relative time (dimmed, right-aligned)
 * - Second line: formatted timestamp + size
 * - Action buttons: ⬇️ Download and 🗑️ Delete
 *
 * Delete button shows a confirmation dialog before calling the API.
 * Download button triggers the DownloadManager via the ViewModel.
 *
 * @param snapshots List of BackupSnapshotDto from the API
 * @param settingsViewModel ViewModel for formatting helpers and API operations
 * @param targetId The backup target ID for API calls
 *
 * Validates: Requirements 6.3, 7.1, 7.2, 7.3
 */
@Composable
fun BackupSnapshotList(
    snapshots: List<BackupSnapshotDto>,
    settingsViewModel: SettingsViewModel,
    targetId: String
) {
    // Track which snapshot is pending delete confirmation
    var deleteConfirmSnapshotId by remember { mutableStateOf<String?>(null) }
    var deleteConfirmShortId by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Count header
        Text(
            text = "${snapshots.size} Snapshot(s)",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        // Snapshot rows
        snapshots.forEach { snapshot ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // First line: short_id (monospace, bold) + relative time (dimmed, right-aligned)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = snapshot.short_id ?: snapshot.id.take(8),
                            style = MaterialTheme.typography.bodyMedium,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = settingsViewModel.formatBackupRelativeTime(snapshot.time),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Second line: formatted timestamp + size
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = settingsViewModel.formatBackupDateTime(snapshot.time),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = settingsViewModel.formatBackupBytes(snapshot.summary?.total_size),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Action buttons row: Download and Delete
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Download button
                        TextButton(
                            onClick = {
                                settingsViewModel.downloadBackupSnapshot(snapshot.id, targetId)
                            }
                        ) {
                            Text("⬇️ Download")
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        // Delete button
                        TextButton(
                            onClick = {
                                deleteConfirmSnapshotId = snapshot.id
                                deleteConfirmShortId = snapshot.short_id ?: snapshot.id.take(8)
                            },
                            colors = ButtonDefaults.textButtonColors(
                                contentColor = Color(0xFFC62828)
                            )
                        ) {
                            Text("🗑️ Delete")
                        }
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    if (deleteConfirmSnapshotId != null) {
        AlertDialog(
            onDismissRequest = {
                deleteConfirmSnapshotId = null
                deleteConfirmShortId = null
            },
            containerColor = CwocDialogDefaults.containerColor,
            title = {
                Text(
                    text = "Delete Snapshot",
                    style = CwocDialogDefaults.titleStyle
                )
            },
            text = {
                Text(
                    text = "Permanently delete snapshot ${deleteConfirmShortId}? This cannot be undone.",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val snapshotId = deleteConfirmSnapshotId!!
                        deleteConfirmSnapshotId = null
                        deleteConfirmShortId = null
                        settingsViewModel.deleteBackupSnapshot(snapshotId, targetId)
                    },
                    colors = CwocDialogDefaults.dangerButtonColors()
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        deleteConfirmSnapshotId = null
                        deleteConfirmShortId = null
                    }
                ) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ============================================================
// Section: Restic Backup — BackupTargetModal (Task 4.1)
// Validates: Requirements 3.1, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
// ============================================================

/**
 * Full-screen modal dialog for creating or editing a backup target.
 * Uses Dialog with DialogProperties(usePlatformDefaultWidth = false) for full-screen.
 * Contains a Scaffold with TopAppBar (title + Cancel/Done buttons) and a scrollable Column body.
 *
 * - Observes `backupModalState` from the ViewModel
 * - Only renders when `backupModalState.isOpen == true`
 * - Title: "Add Backup Target" (create) or "Edit: {name}" (edit)
 * - Cancel (✗) closes without saving via `closeBackupTargetModal()`
 * - Done (✓) validates required fields, builds BackupConfigSaveRequestDto, calls saveBackupConfig()
 * - Back/dismiss → same as cancel
 * - Shows loading indicator when `backupModalState.isLoading` is true
 *
 * Validates: Requirements 3.1, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupTargetModal(
    settingsViewModel: SettingsViewModel
) {
    val modalState by settingsViewModel.backupModalState.collectAsState()

    // Only render when modal is open
    if (!modalState.isOpen) return

    // Derive title: "Add Backup Target" for create, "Edit: {name}" for edit
    val title = if (modalState.isEditMode) {
        "Edit: ${modalState.config?.name ?: "Target"}"
    } else {
        "Add Backup Target"
    }

    // ---- Form state variables (initialized from config for edit mode) ----
    // Repository fields
    var name by remember(modalState.config) { mutableStateOf(modalState.config?.name ?: "") }
    var repoType by remember(modalState.config) { mutableStateOf(modalState.config?.repo_type ?: "local") }
    var repoUrl by remember(modalState.config) { mutableStateOf(modalState.config?.repo_url ?: "") }
    var repoPassword by remember(modalState.config) { mutableStateOf(modalState.config?.repo_password ?: "") }

    // SFTP credential fields
    var sftpUsername by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("user") ?: "") }
    var sftpHost by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("host") ?: "") }
    var sftpPort by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("port") ?: "22") }
    var sftpRemotePath by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("path") ?: "") }
    var sftpAuthMethod by remember(modalState.config) { mutableStateOf("password") }
    var sftpPassword by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("password") ?: "") }
    var sftpKeyPath by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("ssh_key_path") ?: "") }

    // S3 credential fields
    var s3AccessKeyId by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("access_key_id") ?: "") }
    var s3SecretAccessKey by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("secret_access_key") ?: "") }
    var s3Region by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("region") ?: "") }

    // B2 credential fields
    var b2AccountId by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("account_id") ?: "") }
    var b2ApplicationKey by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("application_key") ?: "") }

    // Azure credential fields
    var azureAccountName by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("account_name") ?: "") }
    var azureAccountKey by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("account_key") ?: "") }

    // GCS credential fields
    var gcsProjectId by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("project_id") ?: "") }
    var gcsCredentialsJsonPath by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("credentials_path") ?: "") }

    // REST credential fields
    var restUsername by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("username") ?: "") }
    var restPassword by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("password") ?: "") }

    // rclone credential fields
    var rcloneConfigName by remember(modalState.config) { mutableStateOf(modalState.config?.backend_credentials?.get("config_name") ?: "") }

    // Schedule fields
    var scheduleFrequency by remember(modalState.config) { mutableStateOf(modalState.config?.schedule_frequency ?: "daily") }
    var scheduleTime by remember(modalState.config) { mutableStateOf(modalState.config?.schedule_time ?: "02:00") }

    // Retention policy fields
    val keepLast = remember(modalState.config) { mutableStateOf(modalState.config?.retention_policy?.keep_last?.toString() ?: "5") }
    val keepDaily = remember(modalState.config) { mutableStateOf(modalState.config?.retention_policy?.keep_daily?.toString() ?: "7") }
    val keepWeekly = remember(modalState.config) { mutableStateOf(modalState.config?.retention_policy?.keep_weekly?.toString() ?: "4") }
    val keepMonthly = remember(modalState.config) { mutableStateOf(modalState.config?.retention_policy?.keep_monthly?.toString() ?: "6") }
    val keepYearly = remember(modalState.config) { mutableStateOf(modalState.config?.retention_policy?.keep_yearly?.toString() ?: "2") }

    // Notification fields
    var notifyRecipients by remember(modalState.config) { mutableStateOf(modalState.config?.notification_recipients?.admins ?: "all_admins") }
    var notifyTrigger by remember(modalState.config) { mutableStateOf(modalState.config?.notification_recipients?.trigger ?: "both") }
    var notifyTransfer by remember(modalState.config) { mutableStateOf(modalState.config?.notification_transfer ?: true) }
    var notifyMaintenance by remember(modalState.config) { mutableStateOf(modalState.config?.notification_maintenance ?: true) }

    // Backup paths — default checked paths matching web
    val defaultBackupPaths = listOf(
        "/app/data/pre-backup.db",
        "/app/data/encryption.key",
        "/app/data/contact_pictures",
        "/app/data/profile_pictures",
        "/app/data/attachments",
        "/app/data/vcards",
        "/etc/ssl/certs/cwoc",
        "/etc/systemd/system/cwoc.service",
        "/etc/nginx/sites-available/cwoc"
    )
    var selectedBackupPaths by remember(modalState.config) {
        mutableStateOf(modalState.config?.backup_paths ?: defaultBackupPaths)
    }

    // ---- Validation error states ----
    var nameError by remember { mutableStateOf(false) }
    var passwordError by remember { mutableStateOf(false) }
    var hostError by remember { mutableStateOf(false) }
    var urlError by remember { mutableStateOf(false) }

    // ---- Feedback state (for validation errors shown inline) ----
    var validationFeedback by remember { mutableStateOf<String?>(null) }

    // Clear error states when user types in the respective fields
    if (name.isNotBlank()) nameError = false
    if (repoPassword.isNotBlank()) passwordError = false
    if (sftpHost.isNotBlank()) hostError = false
    if (repoUrl.isNotBlank()) urlError = false

    Dialog(
        onDismissRequest = { settingsViewModel.closeBackupTargetModal() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = title,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        // Cancel button (✗) — close without saving
                        IconButton(onClick = { settingsViewModel.closeBackupTargetModal() }) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel")
                        }
                    },
                    actions = {
                        // Done button (✓) — validate + save + close
                        TextButton(
                            onClick = {
                                // ---- Validation logic (Task 4.11) ----
                                var valid = true
                                validationFeedback = null

                                // Name is always required
                                if (name.isBlank()) {
                                    nameError = true
                                    valid = false
                                }

                                // Password required if creating new target (not editing existing)
                                if (!modalState.isEditMode && repoPassword.isBlank()) {
                                    passwordError = true
                                    valid = false
                                }

                                // Host required for SFTP type
                                if (repoType == "sftp" && sftpHost.isBlank()) {
                                    hostError = true
                                    valid = false
                                }

                                // URL required for non-local, non-SFTP types
                                if (repoType != "local" && repoType != "sftp" && repoUrl.isBlank()) {
                                    urlError = true
                                    valid = false
                                }

                                if (!valid) {
                                    validationFeedback = "Please fill in the required fields"
                                    // Update modal feedback via ViewModel state
                                    settingsViewModel.setBackupModalFeedback(
                                        "Please fill in the required fields",
                                        "error"
                                    )
                                    return@TextButton
                                }

                                // ---- Gather config (matching web's _gatherBackupConfig) ----

                                // Build backend_credentials based on repo type
                                val backendCredentials = when (repoType) {
                                    "sftp" -> mapOf(
                                        "user" to sftpUsername,
                                        "host" to sftpHost,
                                        "port" to sftpPort.ifBlank { "22" },
                                        "path" to sftpRemotePath,
                                        "password" to sftpPassword,
                                        "ssh_key_path" to sftpKeyPath
                                    )
                                    "s3" -> mapOf(
                                        "access_key_id" to s3AccessKeyId,
                                        "secret_access_key" to s3SecretAccessKey,
                                        "region" to s3Region
                                    )
                                    "b2" -> mapOf(
                                        "account_id" to b2AccountId,
                                        "application_key" to b2ApplicationKey
                                    )
                                    "azure" -> mapOf(
                                        "account_name" to azureAccountName,
                                        "account_key" to azureAccountKey
                                    )
                                    "gcs" -> mapOf(
                                        "project_id" to gcsProjectId,
                                        "credentials_path" to gcsCredentialsJsonPath
                                    )
                                    "rest" -> mapOf(
                                        "username" to restUsername,
                                        "password" to restPassword
                                    )
                                    "rclone" -> mapOf(
                                        "config_name" to rcloneConfigName
                                    )
                                    else -> emptyMap() // local — no credentials
                                }

                                // Build repo_url based on type
                                val finalRepoUrl = when (repoType) {
                                    "local" -> "/app/data/backups/restic"
                                    "sftp" -> {
                                        // Build sftp:{user}@{host}:{port}/{path} matching web logic
                                        val user = sftpUsername
                                        val host = sftpHost
                                        val port = sftpPort.ifBlank { "22" }
                                        val path = sftpRemotePath.ifBlank { "/" }
                                        if (user.isNotBlank() && host.isNotBlank()) {
                                            var url = "$user@$host"
                                            if (port.isNotBlank() && port != "22") {
                                                url += ":$port"
                                            }
                                            url += ":$path"
                                            url
                                        } else {
                                            ""
                                        }
                                    }
                                    else -> repoUrl
                                }

                                // Build retention policy
                                val retentionPolicy = RetentionPolicyDto(
                                    keep_last = keepLast.value.toIntOrNull() ?: 0,
                                    keep_daily = keepDaily.value.toIntOrNull() ?: 0,
                                    keep_weekly = keepWeekly.value.toIntOrNull() ?: 0,
                                    keep_monthly = keepMonthly.value.toIntOrNull() ?: 0,
                                    keep_yearly = keepYearly.value.toIntOrNull() ?: 0
                                )

                                // Build notification recipients
                                val notificationRecipients = NotificationRecipientsDto(
                                    admins = notifyRecipients,
                                    trigger = notifyTrigger
                                )

                                // Build the full save request DTO
                                val dto = BackupConfigSaveRequestDto(
                                    id = modalState.targetId, // null for create, non-null for edit
                                    name = name.trim(),
                                    enabled = true, // always enabled on save
                                    repo_type = repoType,
                                    repo_url = finalRepoUrl,
                                    repo_password = repoPassword,
                                    backend_credentials = backendCredentials,
                                    backup_paths = selectedBackupPaths,
                                    schedule_frequency = scheduleFrequency,
                                    schedule_time = scheduleTime,
                                    retention_policy = retentionPolicy,
                                    notification_recipients = notificationRecipients,
                                    notification_transfer = notifyTransfer,
                                    notification_maintenance = notifyMaintenance
                                )

                                // Call save on ViewModel
                                settingsViewModel.saveBackupConfig(dto)
                            },
                            enabled = !modalState.isSaving
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = "Done",
                                tint = CwocPrimary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Done", color = CwocPrimary, fontWeight = FontWeight.Bold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = CwocSurface
                    )
                )
            },
            containerColor = CwocSurface
        ) { paddingValues ->
            // Loading overlay
            if (modalState.isLoading) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(48.dp),
                        color = CwocPrimary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Loading configuration…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                // Scrollable form body
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Spacer(modifier = Modifier.height(8.dp))

                    // Validation feedback banner
                    if (validationFeedback != null || (modalState.feedbackMessage != null && modalState.feedbackType == "error")) {
                        val feedbackMsg = validationFeedback ?: modalState.feedbackMessage ?: ""
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFFFEBEE) // light red background
                            )
                        ) {
                            Text(
                                text = "⚠️ $feedbackMsg",
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFFC62828)
                            )
                        }
                    }

                    // Form sections will be added by tasks 4.2-4.6:
                    // - 4.2: Repository section (uses name, repoType, repoUrl, repoPassword, credential fields, error states)
                    // - 4.3: Data to Backup section (uses selectedBackupPaths)
                    // - 4.4: Schedule section (uses scheduleFrequency, scheduleTime)
                    // - 4.5: Retention Policy section (uses keepLast, keepDaily, keepWeekly, keepMonthly, keepYearly)
                    // - 4.6: Notifications section (uses notifyRecipients, notifyTrigger, notifyTransfer, notifyMaintenance)
                    // - 4.7: Inline feedback area
                    // - 4.8: Operation buttons grid

                    // Placeholder content showing modal is working
                    Text(
                        text = if (modalState.isEditMode) {
                            "Editing target: ${modalState.config?.name ?: "Unknown"}"
                        } else {
                            "Configure a new backup target below."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}

// ============================================================
// Section: Restic Backup — Prune Confirmation Dialog (Task 4.12)
// Validates: Requirements 6.6
// ============================================================

/**
 * Confirmation dialog for the Manual Prune operation.
 *
 * Warns the user that pruning permanently removes old snapshots based on
 * their retention policy and cannot be undone. Uses danger-styled confirm button.
 *
 * @param showDialog Whether the dialog is currently visible
 * @param onDismiss Called when the user cancels or dismisses the dialog
 * @param onConfirm Called when the user confirms the prune operation
 */
@Composable
fun BackupPruneConfirmDialog(
    showDialog: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    if (showDialog) {
        AlertDialog(
            onDismissRequest = onDismiss,
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Manual Prune", style = CwocDialogDefaults.titleStyle) },
            text = {
                Text(
                    "Pruning will permanently remove old snapshots based on your retention policy. This cannot be undone."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onConfirm()
                    },
                    colors = CwocDialogDefaults.dangerButtonColors()
                ) {
                    Text("Prune")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ============================================================
// Section: Restic Backup — Remove Confirmation Dialog (Task 4.13)
// Validates: Requirements 6.7
// ============================================================

/**
 * Confirmation dialog for the "🔌 Remove" operation.
 *
 * Removes the backup configuration from CWOC but leaves all repository data
 * and snapshots on disk. Warns the user they will need the repository password
 * to reconnect in the future.
 *
 * @param showDialog Whether the dialog is currently visible
 * @param onDismiss Called when the user cancels or dismisses the dialog
 * @param onConfirm Called when the user confirms the remove operation
 */
@Composable
fun BackupRemoveConfirmDialog(
    showDialog: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    if (showDialog) {
        AlertDialog(
            onDismissRequest = onDismiss,
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Remove Backup Configuration", style = CwocDialogDefaults.titleStyle) },
            text = {
                Text(
                    "This removes the backup configuration from CWOC but leaves all repository data and snapshots on disk.\n\nYou will need the repository password to reconnect to this backup target in the future."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onConfirm()
                    }
                ) {
                    Text("Remove")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ============================================================
// Section: Restic Backup — Remove & Delete Confirmation Dialog (Task 4.13)
// Validates: Requirements 6.8
// ============================================================

/**
 * Destructive confirmation dialog for the "💀 Remove & Delete" operation.
 *
 * Permanently deletes the backup configuration AND all repository data including
 * every snapshot. Uses danger-styled confirm button to emphasize irreversibility.
 *
 * @param showDialog Whether the dialog is currently visible
 * @param onDismiss Called when the user cancels or dismisses the dialog
 * @param onConfirm Called when the user confirms the destructive delete operation
 */
@Composable
fun BackupRemoveAndDeleteConfirmDialog(
    showDialog: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    if (showDialog) {
        AlertDialog(
            onDismissRequest = onDismiss,
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("⚠️ Permanently Delete Everything", style = CwocDialogDefaults.titleStyle) },
            text = {
                Text(
                    "This will PERMANENTLY DELETE the backup configuration AND all repository data including every snapshot.\n\nAll backup data will be irrevocably destroyed. There is no undo.\n\nThis cannot be recovered."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onConfirm()
                    },
                    colors = CwocDialogDefaults.dangerButtonColors()
                ) {
                    Text("Delete Everything")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ============================================================
// Section: Restic Backup — Restore Flow (Task 4.10)
// Validates: Requirements 6.4
// ============================================================

/**
 * Restore flow composable for the backup target modal.
 * Triggered by the "♻️ Restore" button — loads snapshot list and displays a selectable list.
 * On snapshot tap: shows a destructive confirmation dialog with the EXACT same warning text as web.
 * On confirm: calls POST /api/backup/restore via the ViewModel.
 *
 * @param snapshots The loaded snapshots (null = not loaded yet, empty = no snapshots)
 * @param settingsViewModel The SettingsViewModel for calling restoreBackupSnapshot
 * @param targetId The backup target ID for the restore API call
 * @param targetName The backup target name displayed in the confirmation dialog
 *
 * Validates: Requirements 6.4
 */
@Composable
fun BackupRestoreFlow(
    snapshots: List<BackupSnapshotDto>?,
    settingsViewModel: SettingsViewModel,
    targetId: String,
    targetName: String
) {
    // State for which snapshot the user tapped (triggers confirmation dialog)
    var selectedSnapshot by remember { mutableStateOf<BackupSnapshotDto?>(null) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Header
        Text(
            text = "Select a snapshot to restore:",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        // Snapshot list or loading/empty state
        when {
            snapshots == null -> {
                // Not loaded yet — show loading
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Loading snapshots…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            snapshots.isEmpty() -> {
                Text(
                    text = "No snapshots available.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            else -> {
                // Render each snapshot as a clickable row
                snapshots.forEach { snapshot ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedSnapshot = snapshot },
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = snapshot.short_id ?: snapshot.id.take(8),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                                Text(
                                    text = settingsViewModel.formatBackupRelativeTime(snapshot.time),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = "›",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }

    // Destructive confirmation dialog — shown when a snapshot is tapped
    if (selectedSnapshot != null) {
        val snapshot = selectedSnapshot!!

        // Format the snapshot date for display
        val formattedSnapshotDate = settingsViewModel.formatBackupDateTime(snapshot.time)

        // Format today's date
        val todayFormatted = remember {
            try {
                val today = LocalDate.now()
                val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.getDefault())
                today.format(formatter)
            } catch (_: Exception) {
                "today"
            }
        }

        AlertDialog(
            onDismissRequest = { selectedSnapshot = null },
            title = {
                Text(
                    text = "⚠️ THIS WILL PERMANENTLY DESTROY ALL EXISTING DATA",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Restore details
                    Text(
                        text = "Restoring from: $targetName\n" +
                                "Snapshot: ${snapshot.short_id ?: snapshot.id.take(8)} ($formattedSnapshotDate)\n" +
                                "Current date: $todayFormatted",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    // Warning text — EXACT match to web
                    Text(
                        text = "All current data, settings, and configurations for all users will be permanently and irrevocably lost. There is no undo.",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.error
                    )

                    // Tip
                    Text(
                        text = "\uD83D\uDCA1 Consider clicking Backup Now and Download first to create a safety copy of your current data.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val snapshotId = snapshot.id
                        selectedSnapshot = null
                        settingsViewModel.restoreBackupSnapshot(snapshotId, targetId)
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    )
                ) {
                    Text(
                        text = "Restore — Delete All Current Data",
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedSnapshot = null }) {
                    Text("Cancel")
                }
            },
            containerColor = CwocDialogDefaults.containerColor,
            titleContentColor = CwocDialogDefaults.titleContentColor,
            textContentColor = CwocDialogDefaults.textContentColor
        )
    }
}
