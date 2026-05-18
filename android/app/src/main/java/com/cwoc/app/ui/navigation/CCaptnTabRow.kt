package com.cwoc.app.ui.navigation

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Notes
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Task
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import org.json.JSONArray

/**
 * The C CAPTN view tabs: Calendar, Checklists, Alarms, Projects, Tasks, Notes, Indicators.
 * Each tab maps to an existing Screen route string.
 * Icons match the web's tab strip (fa-calendar, fa-list-check, fa-bell, fa-folder, fa-tasks, fa-sticky-note, fa-chart-line).
 */
enum class CCaptnTab(val label: String, val route: String, val icon: ImageVector) {
    Calendar("Calendar", "calendar", Icons.Default.CalendarMonth),
    Checklists("Checklists", "checklists", Icons.Default.Checklist),
    Alarms("Alerts", "alarms", Icons.Default.Alarm),
    Projects("Projects", "projects", Icons.Default.Folder),
    Tasks("Tasks", "tasks", Icons.Default.Task),
    Notes("Notes", "notes", Icons.Default.Notes),
    Indicators("Indicators", "indicators", Icons.Default.ShowChart),
    Email("Email", "email", Icons.Default.Email)
}

/**
 * A scrollable tab row displaying the C CAPTN view tabs with icons and underline.
 * Matches the web's tab strip style: brown active color, underline indicator, icons + labels.
 * Shows item counts next to each tab label when provided (B11).
 * Respects the view_order setting to reorder and hide tabs (Task 37).
 *
 * @param tabCounts Optional map of CCaptnTab → item count. When provided, shows "(N)" next to label.
 * @param viewOrder Optional view_order setting value. Supports comma-separated or JSON array format.
 *                  When provided, tabs are reordered and hidden tabs are filtered out.
 */
@Composable
fun CCaptnTabRow(
    selectedTab: CCaptnTab,
    onTabSelected: (CCaptnTab) -> Unit,
    modifier: Modifier = Modifier,
    tabCounts: Map<CCaptnTab, Int>? = null,
    viewOrder: String? = null
) {
    // Determine visible tabs based on view_order setting
    val tabs = remember(viewOrder) {
        getOrderedVisibleTabs(viewOrder)
    }

    val selectedIndex = tabs.indexOf(selectedTab).coerceAtLeast(0)

    ScrollableTabRow(
        selectedTabIndex = selectedIndex,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = CwocZoneHeaderBrown,
        edgePadding = 8.dp,
        indicator = { tabPositions ->
            if (selectedIndex < tabPositions.size) {
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedIndex]),
                    color = CwocZoneHeaderBrown
                )
            }
        }
    ) {
        tabs.forEach { tab ->
            val isSelected = tab == selectedTab
            val count = tabCounts?.get(tab)
            val labelText = if (count != null && count > 0) "${tab.label} ($count)" else tab.label
            Tab(
                selected = isSelected,
                onClick = { onTabSelected(tab) },
                text = {
                    Text(
                        text = labelText,
                        style = MaterialTheme.typography.labelMedium,
                        color = if (isSelected) CwocZoneHeaderBrown
                                else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                icon = {
                    Icon(
                        imageVector = tab.icon,
                        contentDescription = tab.label,
                        modifier = Modifier.size(18.dp),
                        tint = if (isSelected) CwocZoneHeaderBrown
                               else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            )
        }
    }
}

/**
 * Parses the view_order setting and returns an ordered list of visible CCaptnTab entries.
 * Supports both comma-separated format and JSON array format.
 * Falls back to all tabs in default order if parsing fails.
 */
private fun getOrderedVisibleTabs(viewOrder: String?): List<CCaptnTab> {
    if (viewOrder.isNullOrBlank()) {
        return CCaptnTab.entries.toList()
    }

    // Try JSON array format: [{"id":"Calendar","visible":true,"position":0}, ...]
    if (viewOrder.trimStart().startsWith("[")) {
        return try {
            val jsonArray = JSONArray(viewOrder)
            val result = mutableListOf<CCaptnTab>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.getString("id")
                val visible = obj.optBoolean("visible", true)
                if (visible) {
                    val tab = CCaptnTab.entries.find { it.name == id }
                    if (tab != null) {
                        result.add(tab)
                    }
                }
            }
            // If result is empty (all hidden), fall back to default
            result.ifEmpty { CCaptnTab.entries.toList() }
        } catch (_: Exception) {
            CCaptnTab.entries.toList()
        }
    }

    // Comma-separated format: "Calendar,Checklists,Alarms,Projects,Tasks,Notes"
    val ids = viewOrder.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    val result = mutableListOf<CCaptnTab>()
    for (id in ids) {
        val tab = CCaptnTab.entries.find { it.name == id }
        if (tab != null) {
            result.add(tab)
        }
    }
    return result.ifEmpty { CCaptnTab.entries.toList() }
}
