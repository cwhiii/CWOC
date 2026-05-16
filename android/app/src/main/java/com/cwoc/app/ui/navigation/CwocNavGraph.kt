package com.cwoc.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.cwoc.app.ui.screens.calendar.CalendarScreen
import com.cwoc.app.ui.screens.debug.DebugScreen
import com.cwoc.app.ui.screens.login.LoginScreen
import com.cwoc.app.ui.screens.notes.NotesScreen
import com.cwoc.app.ui.screens.placeholder.PlaceholderScreen
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
            TasksScreen()
        }

        composable(Screen.Notes.route) {
            NotesScreen()
        }

        composable(Screen.Calendar.route) {
            CalendarScreen()
        }

        composable(Screen.Checklists.route) {
            PlaceholderScreen(title = "Checklists")
        }

        composable(Screen.Alarms.route) {
            PlaceholderScreen(title = "Alarms")
        }

        composable(Screen.Projects.route) {
            PlaceholderScreen(title = "Projects")
        }
    }
}
