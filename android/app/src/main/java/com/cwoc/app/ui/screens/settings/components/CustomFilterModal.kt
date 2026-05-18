package com.cwoc.app.ui.screens.settings.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocSurface
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown

// ============================================================
// Data Classes
// ============================================================

/**
 * Represents a custom filter configuration for a specific view.
 * Stores all filter/sort/display settings that can be customized per-view.
 */
data class CustomViewFilter(
    val filterText: String = "",
    val sortField: String? = null,
    val sortDirection: String = "asc",
    val statuses: List<String> = emptyList(),
    val priorities: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val people: List<String> = emptyList(),
    val project: String? = null,
    val displayToggles: Map<String, Boolean> = emptyMap()
)

/**
 * Simple data class representing a tag available for filter selection.
 */
data class TagItem(
    val id: String,
    val name: String
)

/**
 * Simple data class representing a contact available for filter selection.
 */
data class ContactItem(
    val id: String,
    val name: String
)

/**
 * Simple data class representing a project available for filter selection.
 */
data class ProjectItem(
    val id: String,
    val name: String
)

// ============================================================
// Constants
// ============================================================

private val SORT_FIELD_OPTIONS = listOf(
    "Title", "Due Date", "Start Date", "Created", "Modified",
    "Priority", "Status", "Manual", "Random", "Upcoming"
)

private val STATUS_OPTIONS = listOf(
    "ToDo", "In Progress", "Blocked", "Complete", "Rejected"
)

private val PRIORITY_OPTIONS = listOf(
    "Low", "Medium", "High"
)

private val DISPLAY_TOGGLE_OPTIONS = listOf(
    "Pinned", "Archived", "Snoozed", "Unmarked", "Past-Due",
    "Complete", "Declined", "Habits", "Email Received",
    "Email Sent", "Shared with me", "Shared by me"
)

// ============================================================
// CustomFilterModal Composable
// ============================================================

/**
 * Full-screen dialog for per-view custom filter configuration.
 * Allows the user to set filter text, sort field/direction, status/priority/tag/people/project
 * multi-selects, and display toggle checkboxes.
 *
 * @param viewName The name of the view being configured (e.g., "Calendar", "Tasks")
 * @param currentFilter The current filter state for this view, or null if using defaults
 * @param availableTags List of tags available for selection
 * @param availableContacts List of contacts available for selection
 * @param availableProjects List of projects available for selection
 * @param onDone Callback with the filter result; null means reset to defaults
 * @param onCancel Callback when the user cancels without saving
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun CustomFilterModal(
    viewName: String,
    currentFilter: CustomViewFilter?,
    availableTags: List<TagItem>,
    availableContacts: List<ContactItem>,
    availableProjects: List<ProjectItem>,
    onDone: (CustomViewFilter?) -> Unit,
    onCancel: () -> Unit
) {
    // Local mutable state initialized from currentFilter or defaults
    var filterText by remember { mutableStateOf(currentFilter?.filterText ?: "") }
    var sortField by remember { mutableStateOf(currentFilter?.sortField) }
    var sortDirection by remember { mutableStateOf(currentFilter?.sortDirection ?: "asc") }
    var selectedStatuses by remember { mutableStateOf(currentFilter?.statuses ?: emptyList()) }
    var selectedPriorities by remember { mutableStateOf(currentFilter?.priorities ?: emptyList()) }
    var selectedTags by remember { mutableStateOf(currentFilter?.tags ?: emptyList()) }
    var selectedPeople by remember { mutableStateOf(currentFilter?.people ?: emptyList()) }
    var selectedProject by remember { mutableStateOf(currentFilter?.project) }
    var displayToggles by remember {
        mutableStateOf(currentFilter?.displayToggles ?: emptyMap())
    }

    Dialog(
        onDismissRequest = onCancel,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "$viewName — Custom Filters & Sort",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onCancel) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel")
                        }
                    },
                    actions = {
                        TextButton(onClick = {
                            // Reset all fields to defaults
                            filterText = ""
                            sortField = null
                            sortDirection = "asc"
                            selectedStatuses = emptyList()
                            selectedPriorities = emptyList()
                            selectedTags = emptyList()
                            selectedPeople = emptyList()
                            selectedProject = null
                            displayToggles = emptyMap()
                        }) {
                            Text("Reset", color = CwocPrimary)
                        }
                        TextButton(onClick = {
                            val filter = CustomViewFilter(
                                filterText = filterText,
                                sortField = sortField,
                                sortDirection = sortDirection,
                                statuses = selectedStatuses,
                                priorities = selectedPriorities,
                                tags = selectedTags,
                                people = selectedPeople,
                                project = selectedProject,
                                displayToggles = displayToggles
                            )
                            // If filter matches system defaults, return null to remove the entry
                            if (isDefaultFilter(filter)) {
                                onDone(null)
                            } else {
                                onDone(filter)
                            }
                        }) {
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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                // --- Filter Text Group ---
                FilterGroup(title = "Filter Text", defaultExpanded = true) {
                    OutlinedTextField(
                        value = filterText,
                        onValueChange = { filterText = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search text...") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CwocPrimary,
                            unfocusedBorderColor = Color(0xFFC9B896)
                        )
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- Sort Group ---
                FilterGroup(title = "Sort", defaultExpanded = true) {
                    // Sort field dropdown
                    SortFieldDropdown(
                        selectedField = sortField,
                        onFieldSelected = { sortField = it }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    // Sort direction toggle
                    SortDirectionToggle(
                        direction = sortDirection,
                        onDirectionChanged = { sortDirection = it }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- Status Group ---
                FilterGroup(title = "Status", defaultExpanded = false) {
                    MultiSelectChipGroup(
                        options = STATUS_OPTIONS,
                        selectedOptions = selectedStatuses,
                        onSelectionChanged = { selectedStatuses = it }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- Priority Group ---
                FilterGroup(title = "Priority", defaultExpanded = false) {
                    MultiSelectChipGroup(
                        options = PRIORITY_OPTIONS,
                        selectedOptions = selectedPriorities,
                        onSelectionChanged = { selectedPriorities = it }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- Tags Group ---
                FilterGroup(title = "Tags", defaultExpanded = false) {
                    if (availableTags.isEmpty()) {
                        Text(
                            text = "No tags available",
                            fontSize = 13.sp,
                            color = Color(0xFF8B7355)
                        )
                    } else {
                        MultiSelectChipGroup(
                            options = availableTags.map { it.name },
                            selectedOptions = selectedTags,
                            onSelectionChanged = { selectedTags = it }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- People Group ---
                FilterGroup(title = "People", defaultExpanded = false) {
                    if (availableContacts.isEmpty()) {
                        Text(
                            text = "No contacts available",
                            fontSize = 13.sp,
                            color = Color(0xFF8B7355)
                        )
                    } else {
                        MultiSelectChipGroup(
                            options = availableContacts.map { it.name },
                            selectedOptions = selectedPeople,
                            onSelectionChanged = { selectedPeople = it }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- Project Group ---
                FilterGroup(title = "Project", defaultExpanded = false) {
                    ProjectSingleSelect(
                        availableProjects = availableProjects,
                        selectedProject = selectedProject,
                        onProjectSelected = { selectedProject = it }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- Display Group ---
                FilterGroup(title = "Display", defaultExpanded = false) {
                    DisplayTogglesGroup(
                        toggles = displayToggles,
                        onTogglesChanged = { displayToggles = it }
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

// ============================================================
// Helper: Check if filter matches system defaults
// ============================================================

private fun isDefaultFilter(filter: CustomViewFilter): Boolean {
    return filter.filterText.isEmpty() &&
            filter.sortField == null &&
            filter.sortDirection == "asc" &&
            filter.statuses.isEmpty() &&
            filter.priorities.isEmpty() &&
            filter.tags.isEmpty() &&
            filter.people.isEmpty() &&
            filter.project == null &&
            (filter.displayToggles.isEmpty() || filter.displayToggles.values.all { !it })
}

// ============================================================
// FilterGroup — Collapsible section within the modal
// ============================================================

@Composable
private fun FilterGroup(
    title: String,
    defaultExpanded: Boolean = true,
    content: @Composable () -> Unit
) {
    var expanded by remember { mutableStateOf(defaultExpanded) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, Color(0xFFC9B896), RoundedCornerShape(8.dp))
            .background(Color(0xFFFDF8F0))
    ) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = CwocZoneHeaderBrown,
                modifier = Modifier.weight(1f)
            )
            Icon(
                imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = if (expanded) "Collapse" else "Expand",
                tint = CwocZoneHeaderBrown,
                modifier = Modifier.size(20.dp)
            )
        }

        // Content
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                content()
            }
        }
    }
}

// ============================================================
// SortFieldDropdown
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SortFieldDropdown(
    selectedField: String?,
    onFieldSelected: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val displayText = selectedField ?: "None (default)"

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = displayText,
            onValueChange = {},
            readOnly = true,
            label = { Text("Sort Field") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = CwocPrimary,
                unfocusedBorderColor = Color(0xFFC9B896)
            )
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            // "None" option to clear sort
            DropdownMenuItem(
                text = { Text("None (default)") },
                onClick = {
                    onFieldSelected(null)
                    expanded = false
                }
            )
            SORT_FIELD_OPTIONS.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onFieldSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ============================================================
// SortDirectionToggle
// ============================================================

@Composable
private fun SortDirectionToggle(
    direction: String,
    onDirectionChanged: (String) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "Direction:",
            fontSize = 13.sp,
            color = Color(0xFF4A3728),
            modifier = Modifier.padding(end = 12.dp)
        )
        // Asc button
        val ascSelected = direction == "asc"
        val descSelected = direction == "desc"

        Button(
            onClick = { onDirectionChanged("asc") },
            colors = ButtonDefaults.buttonColors(
                containerColor = if (ascSelected) CwocPrimary else Color.Transparent,
                contentColor = if (ascSelected) Color.White else CwocPrimary
            ),
            modifier = Modifier
                .border(
                    1.dp,
                    if (ascSelected) CwocPrimary else Color(0xFFC9B896),
                    RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)
                )
                .clip(RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp))
        ) {
            Text("Asc ↑", fontSize = 13.sp)
        }

        Button(
            onClick = { onDirectionChanged("desc") },
            colors = ButtonDefaults.buttonColors(
                containerColor = if (descSelected) CwocPrimary else Color.Transparent,
                contentColor = if (descSelected) Color.White else CwocPrimary
            ),
            modifier = Modifier
                .border(
                    1.dp,
                    if (descSelected) CwocPrimary else Color(0xFFC9B896),
                    RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp)
                )
                .clip(RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp))
        ) {
            Text("Desc ↓", fontSize = 13.sp)
        }
    }
}

// ============================================================
// MultiSelectChipGroup
// ============================================================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MultiSelectChipGroup(
    options: List<String>,
    selectedOptions: List<String>,
    onSelectionChanged: (List<String>) -> Unit
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        options.forEach { option ->
            val isSelected = option in selectedOptions
            FilterChip(
                selected = isSelected,
                onClick = {
                    val newSelection = if (isSelected) {
                        selectedOptions - option
                    } else {
                        selectedOptions + option
                    }
                    onSelectionChanged(newSelection)
                },
                label = { Text(option, fontSize = 12.sp) },
                leadingIcon = if (isSelected) {
                    {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                } else null,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CwocPrimary.copy(alpha = 0.15f),
                    selectedLabelColor = CwocPrimary,
                    selectedLeadingIconColor = CwocPrimary
                )
            )
        }
    }
}

// ============================================================
// ProjectSingleSelect
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectSingleSelect(
    availableProjects: List<ProjectItem>,
    selectedProject: String?,
    onProjectSelected: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val displayText = if (selectedProject != null) {
        availableProjects.find { it.id == selectedProject || it.name == selectedProject }?.name
            ?: selectedProject
    } else {
        "None"
    }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = displayText,
            onValueChange = {},
            readOnly = true,
            label = { Text("Project") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = CwocPrimary,
                unfocusedBorderColor = Color(0xFFC9B896)
            )
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            // "None" option to clear project selection
            DropdownMenuItem(
                text = { Text("None") },
                onClick = {
                    onProjectSelected(null)
                    expanded = false
                }
            )
            availableProjects.forEach { project ->
                DropdownMenuItem(
                    text = { Text(project.name) },
                    onClick = {
                        onProjectSelected(project.name)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ============================================================
// DisplayTogglesGroup
// ============================================================

@Composable
private fun DisplayTogglesGroup(
    toggles: Map<String, Boolean>,
    onTogglesChanged: (Map<String, Boolean>) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        DISPLAY_TOGGLE_OPTIONS.forEach { option ->
            val isChecked = toggles[option] ?: false
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        val newToggles = toggles.toMutableMap()
                        newToggles[option] = !isChecked
                        onTogglesChanged(newToggles)
                    }
                    .padding(vertical = 2.dp)
            ) {
                Checkbox(
                    checked = isChecked,
                    onCheckedChange = { checked ->
                        val newToggles = toggles.toMutableMap()
                        newToggles[option] = checked
                        onTogglesChanged(newToggles)
                    },
                    colors = CheckboxDefaults.colors(
                        checkedColor = CwocPrimary,
                        uncheckedColor = Color(0xFF8B7355)
                    )
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = option,
                    fontSize = 14.sp,
                    color = Color(0xFF1A1208)
                )
            }
        }
    }
}
