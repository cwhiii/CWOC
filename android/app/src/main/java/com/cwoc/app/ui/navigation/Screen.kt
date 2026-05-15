package com.cwoc.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Task
import androidx.compose.material.icons.filled.Notes
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Sealed class defining all navigation routes in the app.
 */
sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Tasks : Screen("tasks")
    data object Notes : Screen("notes")
    data object Calendar : Screen("calendar")
    data object Checklists : Screen("checklists")
    data object Alarms : Screen("alarms")
    data object Projects : Screen("projects")
}

/**
 * Bottom navigation tab definitions matching the C CAPTN view order.
 */
data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Calendar, "Calendar", Icons.Default.CalendarMonth),
    BottomNavItem(Screen.Checklists, "Checklists", Icons.Default.Checklist),
    BottomNavItem(Screen.Alarms, "Alarms", Icons.Default.Alarm),
    BottomNavItem(Screen.Projects, "Projects", Icons.Default.AccountTree),
    BottomNavItem(Screen.Tasks, "Tasks", Icons.Default.Task),
    BottomNavItem(Screen.Notes, "Notes", Icons.Default.Notes)
)
