package com.cwoc.app.ui.navigation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Notes
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Task
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.R
import com.cwoc.app.ui.theme.CwocIvory
import com.cwoc.app.ui.theme.CwocPrimary
import org.json.JSONArray

/**
 * The C CAPTN view tabs: Calendar, Checklists, Alarms, Projects, Tasks, Notes, Indicators.
 * Each tab maps to an existing Screen route string.
 * Icons: Material vector icons for inline use, plus drawable resource IDs matching the web's
 * tab strip PNG images (used in the views panel and header).
 * Omni uses the CWOC logo drawable instead of a Material icon.
 */
enum class CCaptnTab(val label: String, val route: String, val icon: ImageVector?, val drawableResId: Int?) {
    Calendar("Calendar", "calendar", Icons.Default.CalendarMonth, R.drawable.tab_calendar),
    Checklists("Checklists", "checklists", Icons.Default.Checklist, R.drawable.tab_checklists),
    Alarms("Alerts", "alarms", Icons.Default.Alarm, R.drawable.tab_alerts),
    Projects("Projects", "projects", Icons.Default.Folder, R.drawable.tab_projects),
    Tasks("Tasks", "tasks", Icons.Default.Task, R.drawable.tab_tasks),
    Notes("Notes", "notes", Icons.Default.Notes, R.drawable.tab_notes),
    Notebook("Notebook", "notebook", Icons.Default.Notes, R.drawable.tab_notes),
    Indicators("Indicators", "indicators", Icons.Default.ShowChart, R.drawable.tab_indicators),
    Email("Email", "email", Icons.Default.Email, R.drawable.tab_email),
    Omni("Omni", "omni", null, R.drawable.cwoc_logo),
    Search("Search", "search", Icons.Default.Search, null)
}

/**
 * A horizontally scrollable row of filled button tabs for the C CAPTN views.
 * Matches the web's tab strip style: brown filled buttons with ivory active state.
 * Icons are placed inline to the left of labels (18dp).
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

    val scrollState = rememberScrollState()

    Row(
        modifier = modifier
            .horizontalScroll(scrollState)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        tabs.forEach { tab ->
            val isSelected = tab == selectedTab
            val count = tabCounts?.get(tab)
            val labelText = if (count != null && count > 0) "${tab.label} ($count)" else tab.label

            val containerColor = if (isSelected) CwocIvory else CwocPrimary
            val contentColor = if (isSelected) Color(0xFF3B1F0A) else CwocIvory
            val border = BorderStroke(1.dp, Color(0xFF5A3F2A))

            Button(
                onClick = { onTabSelected(tab) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = containerColor,
                    contentColor = contentColor
                ),
                border = border,
                shape = RoundedCornerShape(6.dp),
                contentPadding = ButtonDefaults.ContentPadding
            ) {
                // Icon to the left of label (inline layout)
                if (tab == CCaptnTab.Omni) {
                    Image(
                        painter = painterResource(id = R.drawable.cwoc_logo),
                        contentDescription = tab.label,
                        modifier = Modifier.size(18.dp)
                    )
                } else {
                    Icon(
                        imageVector = tab.icon!!,
                        contentDescription = tab.label,
                        modifier = Modifier.size(18.dp),
                        tint = contentColor
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = labelText,
                    fontSize = 13.sp
                )
            }
        }
    }
}

/**
 * Parses the view_order setting and returns an ordered list of visible CCaptnTab entries.
 * Supports both comma-separated format and JSON array format.
 * Falls back to all tabs in default order if parsing fails.
 *
 * Rules enforced:
 * - Omni is always first (fixed, locked)
 * - Notes and Notebook are mutually exclusive (if both present, Notes wins)
 * - Search is NOT included here (it's pinned at the bottom of the ViewsPanel separately)
 */
fun getOrderedVisibleTabs(viewOrder: String?): List<CCaptnTab> {
    val rawResult = if (viewOrder.isNullOrBlank()) {
        // Default order when no setting exists
        listOf(
            CCaptnTab.Calendar, CCaptnTab.Checklists, CCaptnTab.Alarms,
            CCaptnTab.Projects, CCaptnTab.Tasks, CCaptnTab.Notes,
            CCaptnTab.Email, CCaptnTab.Indicators
        )
    } else if (viewOrder.trimStart().startsWith("[")) {
        // Try JSON array format: [{"id":"Calendar","visible":true,"position":0}, ...]
        // Also supports simple string array: ["Calendar","Checklists",...]
        try {
            val jsonArray = JSONArray(viewOrder)
            val result = mutableListOf<CCaptnTab>()
            for (i in 0 until jsonArray.length()) {
                // Try as object first, then as plain string
                val id = try {
                    val obj = jsonArray.getJSONObject(i)
                    val visible = obj.optBoolean("visible", true)
                    if (!visible) null else obj.getString("id")
                } catch (_: Exception) {
                    jsonArray.optString(i, null)
                }
                if (id != null) {
                    val tab = CCaptnTab.entries.find { it.name == id }
                    if (tab != null) {
                        result.add(tab)
                    }
                }
            }
            result.ifEmpty { CCaptnTab.entries.toList() }
        } catch (_: Exception) {
            CCaptnTab.entries.toList()
        }
    } else {
        // Comma-separated format: "Calendar,Checklists,Alarms,Projects,Tasks,Notes"
        val ids = viewOrder.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val result = mutableListOf<CCaptnTab>()
        for (id in ids) {
            val tab = CCaptnTab.entries.find { it.name == id }
            if (tab != null) {
                result.add(tab)
            }
        }
        result.ifEmpty { CCaptnTab.entries.toList() }
    }

    // Enforce rules:
    // 1. Omni always first
    val withoutOmni = rawResult.filter { it != CCaptnTab.Omni && it != CCaptnTab.Search }
    val finalList = mutableListOf(CCaptnTab.Omni)

    // 2. Notes/Notebook mutual exclusion — if both present, Notes wins (Notebook hidden)
    val hasNotes = withoutOmni.any { it == CCaptnTab.Notes }
    val hasNotebook = withoutOmni.any { it == CCaptnTab.Notebook }
    val filtered = if (hasNotes && hasNotebook) {
        withoutOmni.filter { it != CCaptnTab.Notebook }
    } else {
        withoutOmni
    }

    finalList.addAll(filtered)

    // 3. Search always last
    finalList.add(CCaptnTab.Search)

    return finalList
}
