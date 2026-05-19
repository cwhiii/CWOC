package com.cwoc.app.ui.navigation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.components.CollapsibleSection
import com.cwoc.app.ui.components.SidebarCompactButton
import com.cwoc.app.ui.viewmodel.SidebarState

// Colors matching the web sidebar theme
private val BrownBackground = Color(0xFF8B5A2B)
private val ParchmentText = Color(0xFFFFF8E1)
private val ActiveIvory = Color(0xFFFFFFF0)
private val ActiveDarkBrown = Color(0xFF3B1F0A)
private val BorderBrown = Color(0xFF5A3F2A)
private val HeaderBrown = Color(0xFF4A3728)

/**
 * Sidebar drawer content matching the web sidebar layout.
 * Two-region layout: scrollable content + bottom pinned section.
 * Navigation buttons close the sidebar; filter/sort/mode changes do NOT.
 */
@Composable
fun SidebarContent(
    onNavigate: (Screen) -> Unit,
    onNewChit: () -> Unit,
    onClose: () -> Unit,
    selectedTab: CCaptnTab? = null,
    isAdmin: Boolean = true,
    emailFolder: String = "inbox",
    onEmailFolderChange: (String) -> Unit = {},
    emailAccounts: List<String> = emptyList(),
    selectedAccounts: List<String> = emptyList(),
    onAccountToggle: (String) -> Unit = {},
    unreadAtTop: Boolean = false,
    onUnreadAtTopChange: (Boolean) -> Unit = {},
    onCheckMail: () -> Unit = {},
    sidebarState: SidebarState = SidebarState(),
    onTodayClick: () -> Unit = {},
    onPrevPeriod: () -> Unit = {},
    onNextPeriod: () -> Unit = {},
    onPeriodChange: (String) -> Unit = {},
    onMonthModeChange: (String) -> Unit = {},
    onProjectsViewModeChange: (String) -> Unit = {},
    onAlarmsViewModeChange: (String) -> Unit = {},
    onTasksViewModeChange: (String) -> Unit = {},
    onHabitsWindowChange: (Int) -> Unit = {},
    onHabitsIncludeRulesChange: (Boolean) -> Unit = {},
    onIndicatorsRangeChange: (String) -> Unit = {},
    onIndicatorsCustomRange: (String?, String?) -> Unit = { _, _ -> },
    onIndicatorsVisibleGraphsChange: (Set<String>) -> Unit = {},
    filterContent: @Composable () -> Unit = {},
    sortContent: @Composable () -> Unit = {},
    onClockClick: () -> Unit = {},
    onCalculatorClick: () -> Unit = {},
    onReferenceClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.navigationBarsPadding()) {
        // ═══════════════════════════════════════════════════════════════════
        // SCROLLABLE REGION
        // ═══════════════════════════════════════════════════════════════════
        val scrollState = rememberScrollState()
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(horizontal = 12.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // ─── 1. Close Button ─────────────────────────────────────────
            Button(
                onClick = onClose,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BrownBackground,
                    contentColor = ParchmentText
                ),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("⇤ Hide Sidebar", fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ─── 2. Create Chit Button ───────────────────────────────────
            Button(
                onClick = {
                    onNewChit()
                    onClose()
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BrownBackground,
                    contentColor = ParchmentText
                ),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("✚ New Chit", fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ─── 3. Email Controls (conditional) ─────────────────────────
            if (selectedTab == CCaptnTab.Email) {
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = onCheckMail,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = BrownBackground, contentColor = ParchmentText),
                    shape = RoundedCornerShape(4.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) { Text("📬 Check Mail", fontSize = 14.sp) }

                Spacer(modifier = Modifier.height(8.dp))

                if (emailAccounts.isNotEmpty()) {
                    EmailAccountPills(accounts = emailAccounts, selectedAccounts = selectedAccounts, onAccountToggle = onAccountToggle)
                    Spacer(modifier = Modifier.height(8.dp))
                }

                CollapsibleSection(title = "Folder", initiallyExpanded = true) {
                    val folders = listOf("inbox" to "Inbox", "sent" to "Sent", "drafts" to "Drafts", "scheduled" to "Scheduled", "trash" to "Trash")
                    folders.forEach { (value, label) ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = emailFolder == value, onClick = { onEmailFolderChange(value) })
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = label, fontSize = 13.sp, color = HeaderBrown)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Checkbox(checked = unreadAtTop, onCheckedChange = onUnreadAtTopChange)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Unread at top", fontSize = 13.sp, color = HeaderBrown)
                }

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── 4. Date Navigation (always visible) ─────────────────────
            Button(
                onClick = onTodayClick,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BrownBackground, contentColor = ParchmentText),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) { Text("📅 Today", fontSize = 14.sp) }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedButton(
                    onClick = onPrevPeriod,
                    border = BorderStroke(1.dp, BorderBrown),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(4.dp)
                ) { Text("◄", fontSize = 14.sp, color = HeaderBrown) }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = sidebarState.yearDisplay, fontSize = 11.sp, color = HeaderBrown.copy(alpha = 0.7f))
                    Text(text = sidebarState.dateRangeDisplay, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = HeaderBrown)
                }

                OutlinedButton(
                    onClick = onNextPeriod,
                    border = BorderStroke(1.dp, BorderBrown),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(4.dp)
                ) { Text("►", fontSize = 14.sp, color = HeaderBrown) }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(8.dp))

            // ─── 5. Order (Sort) ─────────────────────────────────────────
            sortContent()

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(8.dp))

            // ─── 6. Time Period Dropdown ─────────────────────────────────
            TimePeriodDropdown(currentPeriod = sidebarState.currentPeriod, onPeriodChange = onPeriodChange)

            Spacer(modifier = Modifier.height(8.dp))

            // ─── 7. Calendar Options (Calendar tab + Month period) ────────
            if (selectedTab == CCaptnTab.Calendar && sidebarState.currentPeriod == "Month") {
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                CollapsibleSection(title = "Options", initiallyExpanded = true) {
                    Text(text = "Month Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        ViewModeButton(text = "Compress", isActive = sidebarState.monthMode == "compress", onClick = { onMonthModeChange("compress") }, modifier = Modifier.weight(1f))
                        ViewModeButton(text = "Scroll", isActive = sidebarState.monthMode == "scroll", onClick = { onMonthModeChange("scroll") }, modifier = Modifier.weight(1f))
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── 8. Projects View Mode (Projects tab) ────────────────────
            if (selectedTab == CCaptnTab.Projects) {
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "View Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    ViewModeButton(text = "📋 List", isActive = sidebarState.projectsViewMode == "list", onClick = { onProjectsViewModeChange("list") }, modifier = Modifier.weight(1f))
                    ViewModeButton(text = "📊 Kanban", isActive = sidebarState.projectsViewMode == "kanban", onClick = { onProjectsViewModeChange("kanban") }, modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── 9. Alarms View Mode (Alarms tab) ────────────────────────
            if (selectedTab == CCaptnTab.Alarms) {
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "View Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        ViewModeButton(text = "📋 Chits", isActive = sidebarState.alarmsViewMode == "list", onClick = { onAlarmsViewModeChange("list") }, modifier = Modifier.weight(1f))
                        ViewModeButton(text = "🛎️ Independent", isActive = sidebarState.alarmsViewMode == "independent", onClick = { onAlarmsViewModeChange("independent") }, modifier = Modifier.weight(1f))
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        ViewModeButton(text = "🔔 Notifs", isActive = sidebarState.alarmsViewMode == "notifications", onClick = { onAlarmsViewModeChange("notifications") }, modifier = Modifier.weight(1f))
                        ViewModeButton(text = "📢 Reminders", isActive = sidebarState.alarmsViewMode == "reminders", onClick = { onAlarmsViewModeChange("reminders") }, modifier = Modifier.weight(1f))
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── 10. Tasks View Mode (Tasks tab) ──────────────────────────
            if (selectedTab == CCaptnTab.Tasks) {
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "View Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    ViewModeButton(text = "📋 Tasks", isActive = sidebarState.tasksViewMode == "tasks", onClick = { onTasksViewModeChange("tasks") }, modifier = Modifier.weight(1f))
                    ViewModeButton(text = "🎯 Habits", isActive = sidebarState.tasksViewMode == "habits", onClick = { onTasksViewModeChange("habits") }, modifier = Modifier.weight(1f))
                    ViewModeButton(text = "📌 Assigned", isActive = sidebarState.tasksViewMode == "assigned", onClick = { onTasksViewModeChange("assigned") }, modifier = Modifier.weight(1f))
                }
                if (sidebarState.tasksViewMode == "habits") {
                    Spacer(modifier = Modifier.height(8.dp))
                    HabitsSuccessWindowDropdown(currentWindow = sidebarState.habitsSuccessWindow, onWindowChange = onHabitsWindowChange)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        Checkbox(checked = sidebarState.habitsIncludeRules, onCheckedChange = onHabitsIncludeRulesChange)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Include Rule Habits", fontSize = 13.sp, color = HeaderBrown)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── 11. Indicators Controls (Indicators tab) ─────────────────
            if (selectedTab == CCaptnTab.Indicators) {
                HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Time Range", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    listOf("day" to "Day", "week" to "Week", "month" to "Month", "year" to "Year", "all" to "All").forEach { (value, label) ->
                        ViewModeButton(text = label, isActive = sidebarState.indicatorsRange == value, onClick = { onIndicatorsRangeChange(value) }, modifier = Modifier.weight(1f))
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Custom Range", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
                var customStart by remember { mutableStateOf(sidebarState.indicatorsCustomStart ?: "") }
                var customEnd by remember { mutableStateOf(sidebarState.indicatorsCustomEnd ?: "") }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextField(value = customStart, onValueChange = { customStart = it }, placeholder = { Text("Start", fontSize = 11.sp) }, singleLine = true, modifier = Modifier.weight(1f))
                    TextField(value = customEnd, onValueChange = { customEnd = it }, placeholder = { Text("End", fontSize = 11.sp) }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedButton(onClick = { onIndicatorsCustomRange(customStart.ifBlank { null }, customEnd.ifBlank { null }) }, border = BorderStroke(1.dp, BorderBrown), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), shape = RoundedCornerShape(4.dp)) {
                        Text("Go", fontSize = 12.sp, color = HeaderBrown)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                CollapsibleSection(title = "Show Graphs", initiallyExpanded = true) {
                    val graphOptions = listOf("mood" to "Mood", "energy" to "Energy", "sleep" to "Sleep", "exercise" to "Exercise", "productivity" to "Productivity")
                    graphOptions.forEach { (value, label) ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Checkbox(checked = value in sidebarState.indicatorsVisibleGraphs, onCheckedChange = { checked ->
                                val newSet = if (checked) sidebarState.indicatorsVisibleGraphs + value else sidebarState.indicatorsVisibleGraphs - value
                                onIndicatorsVisibleGraphsChange(newSet)
                            })
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = label, fontSize = 13.sp, color = HeaderBrown)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── 12. Filters ──────────────────────────────────────────────
            HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(8.dp))
            CollapsibleSection(title = "🔍 Filters", initiallyExpanded = false) {
                filterContent()
            }
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(8.dp))

            // ─── 13. Quick Access Buttons ─────────────────────────────────
            Button(
                onClick = { onNavigate(Screen.Contacts); onClose() },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BrownBackground, contentColor = ParchmentText),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) { Text("👥 People", fontSize = 14.sp) }
            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SidebarCompactButton(text = "🗺️ Maps", onClick = { onNavigate(Screen.Map); onClose() }, modifier = Modifier.weight(1f))
                SidebarCompactButton(text = "🌤️ Weather", onClick = { onNavigate(Screen.Weather); onClose() }, modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SidebarCompactButton(text = "🕐 Clock", onClick = onClockClick, modifier = Modifier.weight(1f))
                SidebarCompactButton(text = "📺 Kiosk", onClick = { onClose() }, modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SidebarCompactButton(text = "🧮 Calc", onClick = onCalculatorClick, modifier = Modifier.weight(1f))
                SidebarCompactButton(text = "🤖 Rules", onClick = { onNavigate(Screen.RulesManager); onClose() }, modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = BorderBrown.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(8.dp))

            // ─── 14. Trash & Custom Objects ───────────────────────────────
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SidebarCompactButton(text = "🗑️ Trash", onClick = { onNavigate(Screen.Trash); onClose() }, modifier = Modifier.weight(1f))
                SidebarCompactButton(text = "🧩 Custom", onClick = { onNavigate(Screen.CustomObjects); onClose() }, modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        // ═══════════════════════════════════════════════════════════════════
        // BOTTOM PINNED SECTION (non-scrolling)
        // ═══════════════════════════════════════════════════════════════════
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            HorizontalDivider(color = BorderBrown.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { onNavigate(Screen.Settings); onClose() },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BrownBackground, contentColor = ParchmentText),
                shape = RoundedCornerShape(4.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) { Text("⚙️ Settings", fontSize = 14.sp) }

            Spacer(modifier = Modifier.height(4.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SidebarCompactButton(text = "📖 Reference", onClick = onReferenceClick, modifier = Modifier.weight(1f))
                SidebarCompactButton(text = "📘 Help", onClick = { onNavigate(Screen.Help); onClose() }, modifier = Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "v${com.cwoc.app.BuildConfig.VERSION_NAME}",
                fontSize = 10.sp,
                color = HeaderBrown.copy(alpha = 0.5f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIVATE HELPER COMPOSABLES
// ═══════════════════════════════════════════════════════════════════════════

@Composable
private fun ViewModeButton(
    text: String,
    isActive: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor = if (isActive) ActiveIvory else BrownBackground
    val contentColor = if (isActive) ActiveDarkBrown else ParchmentText
    val border = if (isActive) BorderStroke(1.dp, ActiveDarkBrown) else BorderStroke(1.dp, BorderBrown)

    Button(
        onClick = onClick,
        modifier = modifier.height(36.dp),
        colors = ButtonDefaults.buttonColors(containerColor = containerColor, contentColor = contentColor),
        border = border,
        shape = RoundedCornerShape(4.dp),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(text = text, fontSize = 11.sp, fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal, maxLines = 1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimePeriodDropdown(currentPeriod: String, onPeriodChange: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val periods = listOf("Itinerary" to "Itinerary", "Day" to "Day", "Work" to "Work Hours", "Week" to "Week", "SevenDay" to "X Days", "Month" to "Month", "Year" to "Year")
    val currentLabel = periods.firstOrNull { it.first == currentPeriod }?.second ?: currentPeriod

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = "Time Period", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
            TextField(value = currentLabel, onValueChange = {}, readOnly = true, singleLine = true, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }, colors = ExposedDropdownMenuDefaults.textFieldColors(), modifier = Modifier.menuAnchor().fillMaxWidth())
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                periods.forEach { (value, label) ->
                    DropdownMenuItem(text = { Text(label) }, onClick = { onPeriodChange(value); expanded = false }, contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HabitsSuccessWindowDropdown(currentWindow: Int, onWindowChange: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val options = listOf(7 to "Last 7 days", 30 to "Last 30 days", 90 to "Last 90 days", -1 to "All time")
    val currentLabel = options.firstOrNull { it.first == currentWindow }?.second ?: "$currentWindow days"

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = "Success Window", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HeaderBrown, modifier = Modifier.padding(bottom = 4.dp))
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
            TextField(value = currentLabel, onValueChange = {}, readOnly = true, singleLine = true, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }, colors = ExposedDropdownMenuDefaults.textFieldColors(), modifier = Modifier.menuAnchor().fillMaxWidth())
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (value, label) ->
                    DropdownMenuItem(text = { Text(label) }, onClick = { onWindowChange(value); expanded = false }, contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EmailAccountPills(accounts: List<String>, selectedAccounts: List<String>, onAccountToggle: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
        accounts.forEach { account ->
            val isSelected = account in selectedAccounts
            val containerColor = if (isSelected) ActiveIvory else BrownBackground
            val contentColor = if (isSelected) ActiveDarkBrown else ParchmentText
            val border = if (isSelected) BorderStroke(1.dp, ActiveDarkBrown) else BorderStroke(1.dp, BorderBrown)
            Button(
                onClick = { onAccountToggle(account) },
                colors = ButtonDefaults.buttonColors(containerColor = containerColor, contentColor = contentColor),
                border = border,
                shape = RoundedCornerShape(16.dp),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                modifier = Modifier.height(30.dp)
            ) { Text(text = account, fontSize = 11.sp, maxLines = 1) }
        }
    }
}
