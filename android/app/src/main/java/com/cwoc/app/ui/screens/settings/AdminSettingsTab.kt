package com.cwoc.app.ui.screens.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
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
import com.cwoc.app.ui.screens.settings.components.CollapsibleSection
import com.cwoc.app.ui.screens.settings.components.UpgradeModal
import com.cwoc.app.ui.screens.settings.components.UpgradeModalMode
import com.cwoc.app.ui.components.ReleaseNotesDialog
import com.cwoc.app.data.remote.CwocApiService
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import org.json.JSONArray


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
    isAdmin: Boolean = true
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

        HorizontalDivider()

        // ============================================================
        // Section: Kiosk (Task 30.1)
        // Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5
        // ============================================================
        KioskSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            onNavigateToKiosk = onNavigateToKiosk
        )

        HorizontalDivider()

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
        DataManagementSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            onNavigateToAuditLog = onNavigateToAuditLog,
            onNavigateToTrash = onNavigateToTrash,
            onNavigateToCustomObjects = onNavigateToCustomObjects
        )

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
            onUpdateSetting = onUpdateSetting,
            settingsViewModel = settingsViewModel
        )

        HorizontalDivider()

        // Section: Version & Updates
        // Validates: Requirements 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8
        VersionUpdatesSection(
            apiService = apiService,
            serverUrl = settingsState.serverUrl,
            authToken = authToken,
            isAdmin = isAdmin,
            timeFormat = settingsState.timeFormat
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
        "Never" to "never"
    )

    // Find the display label for the current stored value
    val currentSessionLabel = sessionLifetimeOptions
        .firstOrNull { it.second == settingsState.sessionLifetime }?.first ?: "24 hours"

    CollapsibleSection(
        title = "🔧 Administration",
        sectionId = "administration"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Manage Users button — Validates: Requirement 22.1
            Button(
                onClick = onNavigateToUserAdmin,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF6B4E31)
                )
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
                }
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
                }
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
                        .fillMaxWidth()
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
        defaultExpanded = true
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
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF6B4E31)
                )
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
    var showImportModeDialog by remember { mutableStateOf(false) }
    var importModeTarget by remember { mutableStateOf("") } // "chit", "user", "calendar", "google_tasks", "google_keep"
    var showReplaceConfirm by remember { mutableStateOf(false) }
    var showPurgeConfirm1 by remember { mutableStateOf(false) }
    var showPurgeConfirm2 by remember { mutableStateOf(false) }
    var importError by remember { mutableStateOf<String?>(null) }
    var selectedImportUser by remember { mutableStateOf("") } // For calendar import user selection

    CollapsibleSection(
        title = "💾 Data Management",
        sectionId = "admin_data_management"
    ) {
            Column(
                modifier = Modifier.padding(start = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // ── Export / Import: Chit Data (Req 24.1) ──
                Text(
                    text = "Chit Data",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { /* TODO: GET /api/export/chits → share sheet / file-save picker */ },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF6B4E31)
                        )
                    ) {
                        Text("📤 Export")
                    }
                    OutlinedButton(
                        onClick = {
                            importModeTarget = "chit"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("📥 Import")
                    }
                }

                // ── Export / Import: User Data (Req 24.2) ──
                Text(
                    text = "User Data",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { /* TODO: GET /api/export/users → share sheet / file-save picker */ },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF6B4E31)
                        )
                    ) {
                        Text("📤 Export")
                    }
                    OutlinedButton(
                        onClick = {
                            importModeTarget = "user"
                            showImportModeDialog = true
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("📥 Import")
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // ── Calendar Import (.ics) with user selection (Req 24.3) ──
                Text(
                    text = "Calendar Import (.ics)",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                // User selection dropdown for calendar import
                SettingsDropdown(
                    label = "Import as user",
                    value = selectedImportUser,
                    options = listOf("Current User"), // TODO: Populate from user list
                    onValueChange = { selectedImportUser = it }
                )
                OutlinedButton(
                    onClick = {
                        importModeTarget = "calendar"
                        showImportModeDialog = true
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📅 Import Calendar (.ics)")
                }

                Spacer(modifier = Modifier.height(4.dp))

                // ── Import Google Tasks (.json) (Req 24.4) ──
                OutlinedButton(
                    onClick = {
                        importModeTarget = "google_tasks"
                        showImportModeDialog = true
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📋 Import Google Tasks (.json)")
                }

                // ── Import Google Keep (.json) (Req 24.5) ──
                OutlinedButton(
                    onClick = {
                        importModeTarget = "google_keep"
                        showImportModeDialog = true
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📝 Import Google Keep (.json)")
                }

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                // ── Import Batches (Req 24.6) ──
                ImportBatchesSubsection()

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                // ── Navigation Buttons (Req 24.7, 24.8, 24.9) ──
                Text(
                    text = "Navigation",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                OutlinedButton(
                    onClick = onNavigateToAuditLog,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📜 Audit Log")
                }
                OutlinedButton(
                    onClick = onNavigateToTrash,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("🗑️ Trash")
                }
                OutlinedButton(
                    onClick = onNavigateToCustomObjects,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("🧩 Custom Objects")
                }

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                // ── Audit Log Limits (Req 24.10) ──
                AuditLogLimitsSubsection(
                    settingsState = settingsState,
                    onUpdateSetting = onUpdateSetting
                )

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                // ── Attachment Limits (Req 24.11) ──
                AttachmentLimitsSubsection(
                    settingsState = settingsState,
                    onUpdateSetting = onUpdateSetting
                )

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(12.dp))

                // ── Purge All Data (Req 24.16) ──
                Button(
                    onClick = { showPurgeConfirm1 = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
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

    // ── Import Mode Dialog (Req 24.12) ──
    if (showImportModeDialog) {
        AlertDialog(
            onDismissRequest = {
                showImportModeDialog = false
                importModeTarget = ""
            },
            title = { Text("Import Mode") },
            text = { Text("How would you like to import this data?") },
            confirmButton = {
                TextButton(onClick = {
                    showImportModeDialog = false
                    // "Add to existing" mode — proceed to file selection
                    // TODO: Open file picker with importModeTarget type, mode = "add"
                    importModeTarget = ""
                }) { Text("Add to existing") }
            },
            dismissButton = {
                Column {
                    TextButton(onClick = {
                        showImportModeDialog = false
                        showReplaceConfirm = true
                    }) { Text("Replace all data", color = MaterialTheme.colorScheme.error) }
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
            title = { Text("⚠️ Replace All Data") },
            text = { Text("This will REPLACE all existing data with the imported data. This action cannot be undone. Are you sure you want to proceed?") },
            confirmButton = {
                TextButton(onClick = {
                    showReplaceConfirm = false
                    // TODO: Open file picker with importModeTarget type, mode = "replace"
                    importModeTarget = ""
                }) { Text("Replace", color = MaterialTheme.colorScheme.error) }
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
            title = { Text("⚠️ Purge All Data") },
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
            title = { Text("🚨 Final Confirmation") },
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
        Text(
            text = "Import Batches",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

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
        Text(
            text = "Audit Log Limits",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

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
                    (settingsState.auditLogMaxDays.toIntOrNull()?.let { it < 1 || it > 9999 } ?: true)
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
                    (settingsState.auditLogMaxMb.toIntOrNull()?.let { it < 1 || it > 99999 } ?: true)
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
        Text(
            text = "Attachment Limits",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

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
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF6B4E31)
                )
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
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF6B4E31)
                )
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
                    modifier = Modifier.fillMaxWidth()
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
                        modifier = Modifier.weight(1f)
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
                    }
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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF6B4E31),
                        disabledContainerColor = Color(0xFF6B4E31).copy(alpha = 0.5f)
                    )
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

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

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
                        modifier = Modifier.weight(1f)
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
                title = { Text("Regenerate Webhook Secret?") },
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
// Section: Version & Updates (Task 17.4)
// ============================================================

@Composable
private fun VersionUpdatesSection(
    apiService: CwocApiService?,
    serverUrl: String,
    authToken: String,
    isAdmin: Boolean,
    timeFormat: String = "12hour"
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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF6B4E31)
                    )
                ) {
                    Text("⬆️ Upgrade")
                }

                // --- Show Log button (Req 28.6) ---
                OutlinedButton(
                    onClick = {
                        upgradeModalMode = UpgradeModalMode.VIEW_LOG
                        showUpgradeModal = true
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("📄 Show Log")
                }

                // --- Restart CWOC button (Req 28.7) — admin only ---
                if (isAdmin) {
                    Button(
                        onClick = { showRestartConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isRestarting,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
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
    if (showReleaseNotes) {
        ReleaseNotesDialog(
            serverUrl = serverUrl.ifEmpty { "http://192.168.1.111:3333" },
            authToken = authToken,
            onDismiss = { showReleaseNotes = false }
        )
    }

    // --- Restart Confirmation Dialog (Req 28.7) ---
    if (showRestartConfirm) {
        AlertDialog(
            onDismissRequest = { showRestartConfirm = false },
            title = { Text("⚠️ Restart CWOC") },
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
                    }
                ) {
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
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF6B4E31)
                )
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
                        modifier = Modifier.weight(1f)
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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF6B4E31),
                        disabledContainerColor = Color(0xFF6B4E31).copy(alpha = 0.5f)
                    )
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
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF2D5A1E),
                            disabledContainerColor = Color(0xFF2D5A1E).copy(alpha = 0.4f)
                        )
                    ) {
                        Text("▶️ Connect")
                    }

                    OutlinedButton(
                        onClick = { settingsViewModel.disconnectTailscale() },
                        enabled = canDisconnect && !tailscaleState.isLoading,
                        modifier = Modifier.weight(1f)
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
                singleLine = true
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
