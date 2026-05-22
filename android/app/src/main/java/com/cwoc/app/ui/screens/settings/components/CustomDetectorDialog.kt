package com.cwoc.app.ui.screens.settings.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocDialogDefaults
import androidx.compose.material3.Button
import com.cwoc.app.ui.theme.CwocInputDefaults

/**
 * Data class representing a custom badge detector with all fields
 * matching the web implementation's custom detector object.
 */
data class CustomDetectorData(
    val id: String = "",
    val name: String = "",
    val category: String = "Custom",
    val keywords: List<String> = emptyList(),
    val regex: String = "",
    val url: String = "",
    val label: String = "View",
    val icon: String = "/static/tracking/order.svg",
    val priority: Int = 50,
    val enabled: Boolean = true
)

/**
 * Category options for the custom detector dropdown.
 */
private val CATEGORY_OPTIONS = listOf(
    "Custom",
    "Tracking",
    "Orders",
    "Travel",
    "Finance",
    "Social",
    "Other"
)

/**
 * Label options for the custom detector dropdown.
 */
private val LABEL_OPTIONS = listOf(
    "View",
    "Track",
    "Open",
    "Details",
    "Status",
    "Info"
)

/**
 * Dialog for creating or editing a custom badge detector.
 * Fields: name (required), category (dropdown), keywords (comma-separated),
 * regex (required, validated), URL template (required, must contain {code}), label (dropdown).
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomDetectorDialog(
    title: String,
    detector: CustomDetectorData,
    onDismiss: () -> Unit,
    onConfirm: (CustomDetectorData) -> Unit
) {
    var name by remember { mutableStateOf(detector.name) }
    var category by remember { mutableStateOf(detector.category) }
    var keywordsText by remember { mutableStateOf(detector.keywords.joinToString(", ")) }
    var regex by remember { mutableStateOf(detector.regex) }
    var url by remember { mutableStateOf(detector.url) }
    var label by remember { mutableStateOf(detector.label) }
    var enabled by remember { mutableStateOf(detector.enabled) }

    // Validation error states
    var nameError by remember { mutableStateOf<String?>(null) }
    var regexError by remember { mutableStateOf<String?>(null) }
    var urlError by remember { mutableStateOf<String?>(null) }

    // Dropdown expanded states
    var categoryExpanded by remember { mutableStateOf(false) }
    var labelExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = CwocDialogDefaults.borderModifier,
        containerColor = CwocDialogDefaults.containerColor,
        title = { Text(title, style = CwocDialogDefaults.titleStyle) },
        text = {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Name field (required)
                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        nameError = null
                    },
                    label = { Text("Name *") },
                    singleLine = true,
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Category dropdown
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
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = categoryExpanded,
                        onDismissRequest = { categoryExpanded = false }
                    ) {
                        CATEGORY_OPTIONS.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = {
                                    category = option
                                    categoryExpanded = false
                                }
                            )
                        }
                    }
                }

                // Keywords field (comma-separated)
                OutlinedTextField(
                    value = keywordsText,
                    onValueChange = { keywordsText = it },
                    label = { Text("Keywords (comma-separated)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Regex field (required, validated)
                OutlinedTextField(
                    value = regex,
                    onValueChange = {
                        regex = it
                        regexError = null
                    },
                    label = { Text("Regex Pattern *") },
                    singleLine = true,
                    isError = regexError != null,
                    supportingText = regexError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // URL template field (required, must contain {code})
                OutlinedTextField(
                    value = url,
                    onValueChange = {
                        url = it
                        urlError = null
                    },
                    label = { Text("URL Template *") },
                    singleLine = true,
                    isError = urlError != null,
                    supportingText = urlError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    placeholder = { Text("https://example.com/track/{code}") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Label dropdown
                ExposedDropdownMenuBox(
                    expanded = labelExpanded,
                    onExpandedChange = { labelExpanded = !labelExpanded }
                ) {
                    OutlinedTextField(
                        value = label,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Label") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = labelExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = labelExpanded,
                        onDismissRequest = { labelExpanded = false }
                    ) {
                        LABEL_OPTIONS.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = {
                                    label = option
                                    labelExpanded = false
                                }
                            )
                        }
                    }
                }

                // Enabled toggle
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Enabled", modifier = Modifier.weight(1f))
                    Switch(checked = enabled, onCheckedChange = { enabled = it })
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    // Validate
                    var hasError = false

                    if (name.isBlank()) {
                        nameError = "Name is required"
                        hasError = true
                    }

                    if (regex.isBlank()) {
                        regexError = "Regex is required"
                        hasError = true
                    } else {
                        try {
                            Regex(regex)
                        } catch (e: Exception) {
                            regexError = "Invalid regex: ${e.message}"
                            hasError = true
                        }
                    }

                    if (url.isBlank()) {
                        urlError = "URL template is required"
                        hasError = true
                    } else if (!url.contains("{code}")) {
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
                                name = name,
                                category = category,
                                keywords = keywords,
                                regex = regex,
                                url = url,
                                label = label,
                                enabled = enabled
                            )
                        )
                    }
                },
                colors = CwocDialogDefaults.confirmButtonColors()
            ) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
