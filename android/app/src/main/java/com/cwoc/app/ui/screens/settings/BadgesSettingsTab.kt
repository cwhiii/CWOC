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
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

// Built-in badge detectors
private val BUILT_IN_DETECTORS = listOf(
    BadgeDetector("Tracking Numbers", "tracking_number", "\\b(1Z|94|92|93|96)\\w+\\b", "📦", true, builtIn = true),
    BadgeDetector("Order Confirmations", "order_confirmation", "(?i)(order|confirmation)\\s*#?\\s*\\w+", "🛒", true, builtIn = true),
    BadgeDetector("Flight Info", "flight_info", "(?i)(flight|boarding)\\s*(pass)?\\s*#?\\s*\\w+", "✈️", true, builtIn = true),
    BadgeDetector("Calendar Invites", "calendar_invite", "(?i)(invite|calendar|event|rsvp)", "📅", true, builtIn = true),
    BadgeDetector("Shipping Updates", "shipping_update", "(?i)(shipped|delivered|in transit|out for delivery)", "🚚", true, builtIn = true)
)

/**
 * Badges Settings tab with display settings, built-in detectors,
 * and custom detector CRUD.
 *
 * Validates: Requirements 4.3
 */
@Composable
fun BadgesSettingsTab(
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
        // Display Settings
        BadgeDisplaySection(
            maxBadgesPerEmail = settingsState.badgeMaxPerEmail,
            onMaxBadgesChanged = { onUpdateSetting("badge_max_per_email", it) }
        )

        HorizontalDivider()

        // Built-in Detectors
        BuiltInDetectorsSection(
            detectorsJson = settingsState.badgeDetectors,
            onDetectorsChanged = { onUpdateSetting("badge_detectors", it) }
        )

        HorizontalDivider()

        // Custom Detectors
        CustomDetectorsSection(
            detectorsJson = settingsState.badgeDetectors,
            onDetectorsChanged = { onUpdateSetting("badge_detectors", it) }
        )
    }
}

// ============================================================
// Display Settings Section
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BadgeDisplaySection(
    maxBadgesPerEmail: String,
    onMaxBadgesChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }

    Column {
        BadgeCollapsibleHeader(
            title = "🏷️ Display Settings",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                BadgeDropdown(
                    label = "Max Badges Per Email",
                    value = maxBadgesPerEmail,
                    options = listOf("1" to "1", "2" to "2", "3" to "3", "5" to "5", "10" to "10"),
                    onValueChanged = onMaxBadgesChanged
                )
            }
        }
    }
}

// ============================================================
// Built-in Detectors Section
// ============================================================

@Composable
private fun BuiltInDetectorsSection(
    detectorsJson: String,
    onDetectorsChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    val allDetectors = remember(detectorsJson) { parseBadgeDetectorsJson(detectorsJson) }

    Column {
        BadgeCollapsibleHeader(
            title = "🔍 Built-in Detectors",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                BUILT_IN_DETECTORS.forEach { builtIn ->
                    val current = allDetectors.find { it.id == builtIn.id }
                    val isEnabled = current?.enabled ?: builtIn.enabled

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
                            Text(
                                text = builtIn.icon,
                                style = MaterialTheme.typography.titleMedium
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = builtIn.name,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f)
                            )
                            Switch(
                                checked = isEnabled,
                                onCheckedChange = { newEnabled ->
                                    val updated = updateDetectorEnabled(allDetectors, builtIn.id, newEnabled, builtIn)
                                    onDetectorsChanged(serializeBadgeDetectorsJson(updated))
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// Custom Detectors Section
// ============================================================

@Composable
private fun CustomDetectorsSection(
    detectorsJson: String,
    onDetectorsChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }
    var showDeleteConfirm by remember { mutableStateOf<Int?>(null) }

    val allDetectors = remember(detectorsJson) { parseBadgeDetectorsJson(detectorsJson) }
    val customDetectors = allDetectors.filter { !it.builtIn }

    Column {
        BadgeCollapsibleHeader(
            title = "✨ Custom Detectors",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (customDetectors.isEmpty()) {
                    Text(
                        text = "No custom detectors. Add one to detect patterns in emails.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    customDetectors.forEachIndexed { index, detector ->
                        CustomDetectorCard(
                            detector = detector,
                            onEdit = { editingIndex = index },
                            onDelete = { showDeleteConfirm = index },
                            onToggle = { newEnabled ->
                                val globalIndex = allDetectors.indexOf(detector)
                                if (globalIndex >= 0) {
                                    val updated = allDetectors.toMutableList()
                                    updated[globalIndex] = detector.copy(enabled = newEnabled)
                                    onDetectorsChanged(serializeBadgeDetectorsJson(updated))
                                }
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Detector")
                }
            }
        }
    }

    // Add Detector Dialog
    if (showAddDialog) {
        DetectorEditDialog(
            title = "Add Custom Detector",
            detector = BadgeDetector("", "", "", "🔖", true, builtIn = false),
            onDismiss = { showAddDialog = false },
            onConfirm = { detector ->
                val newId = "custom_${System.currentTimeMillis()}"
                val newDetector = detector.copy(id = newId)
                val updated = allDetectors + newDetector
                onDetectorsChanged(serializeBadgeDetectorsJson(updated))
                showAddDialog = false
            }
        )
    }

    // Edit Detector Dialog
    editingIndex?.let { index ->
        val detector = customDetectors[index]
        DetectorEditDialog(
            title = "Edit Detector",
            detector = detector,
            onDismiss = { editingIndex = null },
            onConfirm = { updatedDetector ->
                val globalIndex = allDetectors.indexOf(detector)
                if (globalIndex >= 0) {
                    val updated = allDetectors.toMutableList()
                    updated[globalIndex] = updatedDetector
                    onDetectorsChanged(serializeBadgeDetectorsJson(updated))
                }
                editingIndex = null
            }
        )
    }

    // Delete Confirmation
    showDeleteConfirm?.let { index ->
        val detector = customDetectors[index]
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            title = { Text("Delete Detector") },
            text = { Text("Remove \"${detector.name}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    val globalIndex = allDetectors.indexOf(detector)
                    if (globalIndex >= 0) {
                        val updated = allDetectors.toMutableList()
                        updated.removeAt(globalIndex)
                        onDetectorsChanged(serializeBadgeDetectorsJson(updated))
                    }
                    showDeleteConfirm = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun CustomDetectorCard(
    detector: BadgeDetector,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggle: (Boolean) -> Unit
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
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = detector.icon, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = detector.name, style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium)
                Text(text = detector.pattern, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(checked = detector.enabled, onCheckedChange = onToggle)
            IconButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = "Edit")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun DetectorEditDialog(
    title: String,
    detector: BadgeDetector,
    onDismiss: () -> Unit,
    onConfirm: (BadgeDetector) -> Unit
) {
    var name by remember { mutableStateOf(detector.name) }
    var pattern by remember { mutableStateOf(detector.pattern) }
    var icon by remember { mutableStateOf(detector.icon) }
    var enabled by remember { mutableStateOf(detector.enabled) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it },
                    label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = pattern, onValueChange = { pattern = it },
                    label = { Text("Regex Pattern") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = icon, onValueChange = { icon = it },
                    label = { Text("Icon (emoji)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Enabled", modifier = Modifier.weight(1f))
                    Switch(checked = enabled, onCheckedChange = { enabled = it })
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(detector.copy(name = name, pattern = pattern, icon = icon, enabled = enabled)) },
                enabled = name.isNotBlank() && pattern.isNotBlank()
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

// ============================================================
// Shared Components
// ============================================================

@Composable
private fun BadgeCollapsibleHeader(
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
private fun BadgeDropdown(
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

private data class BadgeDetector(
    val name: String,
    val id: String,
    val pattern: String,
    val icon: String,
    val enabled: Boolean,
    val builtIn: Boolean = false
)

// ============================================================
// JSON Parsing & Serialization
// ============================================================

private fun parseBadgeDetectorsJson(json: String): List<BadgeDetector> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            BadgeDetector(
                name = obj.optString("name", ""),
                id = obj.optString("id", ""),
                pattern = obj.optString("pattern", ""),
                icon = obj.optString("icon", "🔖"),
                enabled = obj.optBoolean("enabled", true),
                builtIn = obj.optBoolean("built_in", false)
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun serializeBadgeDetectorsJson(detectors: List<BadgeDetector>): String {
    val array = JSONArray()
    detectors.forEach { detector ->
        val obj = JSONObject()
        obj.put("name", detector.name)
        obj.put("id", detector.id)
        obj.put("pattern", detector.pattern)
        obj.put("icon", detector.icon)
        obj.put("enabled", detector.enabled)
        obj.put("built_in", detector.builtIn)
        array.put(obj)
    }
    return array.toString()
}

private fun updateDetectorEnabled(
    allDetectors: List<BadgeDetector>,
    detectorId: String,
    enabled: Boolean,
    fallback: BadgeDetector
): List<BadgeDetector> {
    val existing = allDetectors.find { it.id == detectorId }
    return if (existing != null) {
        allDetectors.map { if (it.id == detectorId) it.copy(enabled = enabled) else it }
    } else {
        allDetectors + fallback.copy(enabled = enabled)
    }
}
