package com.cwoc.app.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.ui.components.CollapsibleSection
import com.cwoc.app.ui.navigation.filter.AnyToggleCheckboxGroup
import com.cwoc.app.ui.navigation.filter.DisplayToggleCheckboxes
import com.cwoc.app.ui.navigation.filter.FilterTextSection
import com.cwoc.app.ui.navigation.filter.PeopleChipFilter
import com.cwoc.app.ui.navigation.filter.PersonItem
import com.cwoc.app.ui.navigation.filter.ProjectFilterDropdown
import com.cwoc.app.ui.navigation.filter.ProjectItem
import com.cwoc.app.ui.navigation.filter.TagItem
import com.cwoc.app.ui.navigation.filter.TagTreeFilter

/**
 * Filter panel embedded in the SidebarContent's "🔍 Filters" collapsible section.
 * Achieves exact visual and functional parity with the mobile web sidebar filter panel.
 *
 * Structure (in order):
 *   1. Filter Text (always visible, not collapsible)
 *   2. Status (collapsible, starts collapsed)
 *   3. Priority (collapsible, starts collapsed)
 *   4. Tags (collapsible, starts collapsed)
 *   5. People (collapsible, starts collapsed)
 *   6. Project (collapsible, starts collapsed)
 *   7. Display (collapsible, starts collapsed)
 *
 * All filter changes immediately invoke onFilterStateChanged (no Apply button).
 * Color and Date Range sections are intentionally omitted (not on web).
 */
@Composable
fun FilterPanel(
    filterState: FilterState,
    onFilterStateChanged: (FilterState) -> Unit,
    availableTags: List<TagItem>,
    availablePeople: List<PersonItem>,
    availableProjects: List<ProjectItem>,
    savedSearches: List<String>,
    onSavedSearchDelete: (String) -> Unit,
    currentTab: String?,
    hasCustomDefaults: Boolean,
    onClearAll: () -> Unit,
    onApplyDefaults: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp)
    ) {
        // ─── 1. Filter Text (always visible) ─────────────────────────────
        FilterTextSection(
            searchText = filterState.searchText,
            onSearchTextChanged = { text ->
                onFilterStateChanged(filterState.copy(searchText = text))
            },
            savedSearches = savedSearches,
            onSavedSearchTap = { text ->
                onFilterStateChanged(filterState.copy(searchText = text))
            },
            onSavedSearchDelete = onSavedSearchDelete
        )

        Spacer(modifier = Modifier.height(8.dp))

        // ─── 2. Status (collapsible) ─────────────────────────────────────
        CollapsibleSection(title = "Status", initiallyExpanded = false) {
            AnyToggleCheckboxGroup(
                options = listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected"),
                selectedOptions = filterState.statuses,
                onSelectionChanged = { newStatuses ->
                    onFilterStateChanged(filterState.copy(statuses = newStatuses))
                },
                onClear = {
                    onFilterStateChanged(filterState.copy(statuses = emptySet()))
                }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ─── 3. Priority (collapsible) ───────────────────────────────────
        CollapsibleSection(title = "Priority", initiallyExpanded = false) {
            AnyToggleCheckboxGroup(
                options = listOf("Low", "Medium", "High"),
                selectedOptions = filterState.priorities,
                onSelectionChanged = { newPriorities ->
                    onFilterStateChanged(filterState.copy(priorities = newPriorities))
                },
                onClear = {
                    onFilterStateChanged(filterState.copy(priorities = emptySet()))
                }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ─── 4. Tags (collapsible) ───────────────────────────────────────
        CollapsibleSection(title = "Tags", initiallyExpanded = false) {
            TagTreeFilter(
                tags = availableTags,
                selectedTags = filterState.tags,
                onSelectionChanged = { newTags ->
                    onFilterStateChanged(filterState.copy(tags = newTags))
                },
                onClear = {
                    onFilterStateChanged(filterState.copy(tags = emptySet()))
                }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ─── 5. People (collapsible) ─────────────────────────────────────
        CollapsibleSection(title = "People", initiallyExpanded = false) {
            PeopleChipFilter(
                people = availablePeople,
                selectedPeople = filterState.people,
                onSelectionChanged = { newPeople ->
                    onFilterStateChanged(filterState.copy(people = newPeople))
                },
                onClear = {
                    onFilterStateChanged(filterState.copy(people = emptySet()))
                }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ─── 6. Project (collapsible) ────────────────────────────────────
        CollapsibleSection(title = "Project", initiallyExpanded = false) {
            ProjectFilterDropdown(
                projects = availableProjects,
                selectedProjectId = filterState.projectFilter,
                onSelectionChanged = { projectId ->
                    onFilterStateChanged(filterState.copy(projectFilter = projectId))
                },
                onClear = {
                    onFilterStateChanged(filterState.copy(projectFilter = null))
                }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ─── 7. Display (collapsible) ────────────────────────────────────
        CollapsibleSection(title = "Display", initiallyExpanded = false) {
            DisplayToggleCheckboxes(
                filterState = filterState,
                onFilterStateChanged = onFilterStateChanged
            )
        }
    }
}
