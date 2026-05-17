package com.cwoc.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.cwoc.app.ui.screens.alerts.AlertsScreen
import com.cwoc.app.ui.screens.calendar.CalendarScreen
import com.cwoc.app.ui.screens.checklists.ChecklistsScreen
import com.cwoc.app.ui.screens.debug.DebugScreen
import com.cwoc.app.ui.screens.editor.ChitEditorScreen
import com.cwoc.app.ui.screens.indicators.IndicatorsScreen
import com.cwoc.app.ui.screens.login.LoginScreen
import com.cwoc.app.ui.screens.notes.NotesScreen
import com.cwoc.app.ui.screens.projects.ProjectsScreen
import com.cwoc.app.ui.screens.tasks.TasksScreen

/**
 * Main navigation graph for the CWOC app.
 *
 * @param navController The NavHostController managing navigation state
 * @param isAuthenticated Whether the user is currently authenticated
 * @param modifier Modifier applied to the NavHost (e.g., for Scaffold padding)
 */
@Composable
fun CwocNavGraph(
    navController: NavHostController,
    isAuthenticated: Boolean,
    modifier: Modifier = Modifier
) {
    val startDestination = if (isAuthenticated) Screen.Tasks.route else Screen.Login.route

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Tasks.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Debug.route) {
            DebugScreen()
        }

        composable(Screen.Tasks.route) {
            TasksScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.Notes.route) {
            NotesScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.Calendar.route) {
            CalendarScreen()
        }

        composable(Screen.Checklists.route) {
            ChecklistsScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.Alarms.route) {
            AlertsScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.Projects.route) {
            ProjectsScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.Indicators.route) {
            IndicatorsScreen()
        }

        composable(Screen.Contacts.route) {
            com.cwoc.app.ui.screens.contacts.ContactListScreen(
                onNavigateToContact = { /* TODO: contact editor */ }
            )
        }

        composable(Screen.Map.route) {
            com.cwoc.app.ui.screens.map.MapScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(
            route = Screen.Editor.route,
            arguments = listOf(navArgument("chitId") { type = NavType.StringType })
        ) { backStackEntry ->
            val chitId = backStackEntry.arguments?.getString("chitId") ?: return@composable
            ChitEditorScreen(
                chitId = chitId,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
