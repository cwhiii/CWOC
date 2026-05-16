package com.cwoc.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Edit
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
    BottomNavItem(Screen.Calendar, "Calendar", Icons.Default.DateRange),
    BottomNavItem(Screen.Checklists, "Checklists", Icons.Default.Done),
    BottomNavItem(Screen.Alarms, "Alarms", Icons.Default.Notifications),
    BottomNavItem(Screen.Projects, "Projects", Icons.Default.Star),
    BottomNavItem(Screen.Tasks, "Tasks", Icons.Default.List),
    BottomNavItem(Screen.Notes, "Notes", Icons.Default.Edit)
)
