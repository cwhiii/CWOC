package com.cwoc.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.ui.screens.alerts.AlertsScreen
import com.cwoc.app.ui.screens.attachments.AttachmentsScreen
import com.cwoc.app.ui.screens.auditlog.AuditLogScreen
import com.cwoc.app.ui.screens.customobjects.CustomObjectsScreen
import com.cwoc.app.ui.screens.rules.RuleEditorScreen
import com.cwoc.app.ui.screens.rules.RulesManagerScreen
import com.cwoc.app.ui.screens.useradmin.UserAdminScreen
import com.cwoc.app.ui.screens.adminchits.AdminChitsScreen
import com.cwoc.app.ui.screens.calendar.CalendarScreen
import com.cwoc.app.ui.screens.checklists.ChecklistsScreen
import com.cwoc.app.ui.screens.editor.ChitEditorScreen
import com.cwoc.app.ui.screens.indicators.IndicatorsScreen
import com.cwoc.app.ui.screens.login.LoginScreen
import com.cwoc.app.ui.screens.notes.NotesScreen
import com.cwoc.app.ui.screens.projects.ProjectsScreen
import com.cwoc.app.ui.screens.settings.SettingsScreen
import com.cwoc.app.ui.screens.tasks.TasksScreen
import com.cwoc.app.ui.screens.trash.TrashScreen
import com.cwoc.app.ui.screens.weather.WeatherScreen
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel

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
    modifier: Modifier = Modifier,
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null,
    sidebarStateViewModel: SidebarStateViewModel? = null,
    settingsRepository: SettingsRepository? = null
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

        composable(Screen.Tasks.route) {
            TasksScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                filterSortViewModel = filterSortViewModel,
                chitRepository = chitRepository,
                sidebarStateViewModel = sidebarStateViewModel
            )
        }

        composable(Screen.Notes.route) {
            NotesScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                filterSortViewModel = filterSortViewModel,
                chitRepository = chitRepository
            )
        }

        composable(Screen.Notebook.route) {
            com.cwoc.app.ui.screens.notebook.NotebookScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                filterSortViewModel = filterSortViewModel,
                chitRepository = chitRepository
            )
        }

        composable(Screen.Calendar.route) {
            CalendarScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                onNavigateToNewChitWithPrefill = { start, end ->
                    navController.navigate(Screen.Editor.createRouteWithPrefill(start, end))
                },
                sidebarStateViewModel = sidebarStateViewModel
            )
        }

        composable(Screen.Checklists.route) {
            ChecklistsScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                filterSortViewModel = filterSortViewModel,
                chitRepository = chitRepository
            )
        }

        composable(Screen.Alarms.route) {
            AlertsScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                filterSortViewModel = filterSortViewModel,
                chitRepository = chitRepository,
                settingsRepository = settingsRepository
            )
        }

        composable(Screen.Projects.route) {
            ProjectsScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                filterSortViewModel = filterSortViewModel,
                chitRepository = chitRepository,
                sidebarStateViewModel = sidebarStateViewModel
            )
        }

        composable(Screen.Indicators.route) {
            IndicatorsScreen(
                sidebarStateViewModel = sidebarStateViewModel
            )
        }

        composable(Screen.Contacts.route) {
            com.cwoc.app.ui.screens.contacts.ContactListScreen(
                onNavigateToContact = { contactId ->
                    navController.navigate(Screen.ContactEditor.createRoute(contactId))
                },
                onNavigateToTrash = {
                    navController.navigate(Screen.ContactTrash.route)
                },
                onNavigateToProfile = { userId ->
                    navController.navigate(Screen.ContactEditor.createProfileRoute(userId))
                }
            )
        }

        composable(Screen.ContactTrash.route) {
            com.cwoc.app.ui.screens.contacts.ContactTrashScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.ContactEditor.route,
            arguments = listOf(
                navArgument("contactId") { type = NavType.StringType },
                navArgument("userId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val contactId = backStackEntry.arguments?.getString("contactId") ?: return@composable
            val userId = backStackEntry.arguments?.getString("userId")
            com.cwoc.app.ui.screens.contacts.ContactEditorScreen(
                contactId = contactId,
                userId = userId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Map.route) {
            com.cwoc.app.ui.screens.map.MapScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                onNavigateToContact = { contactId ->
                    navController.navigate(Screen.ContactEditor.createRoute(contactId))
                }
            )
        }

        composable(
            route = Screen.Settings.ROUTE_WITH_ARGS,
            arguments = listOf(
                navArgument("tab") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
                navArgument("section") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val deepLinkTab = backStackEntry.arguments?.getString("tab")
            val deepLinkSection = backStackEntry.arguments?.getString("section")
            SettingsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToAdminChits = {
                    navController.navigate(Screen.AdminChits.route)
                },
                onNavigateToUserAdmin = {
                    navController.navigate(Screen.UserAdmin.route)
                },
                onNavigateToAttachments = {
                    navController.navigate(Screen.Attachments.route)
                },
                onNavigateToAuditLog = {
                    navController.navigate(Screen.AuditLog.route)
                },
                onNavigateToTrash = {
                    navController.navigate(Screen.Trash.route)
                },
                onNavigateToCustomObjects = {
                    navController.navigate(Screen.CustomObjects.route)
                },
                onNavigateToKiosk = { selectedTags ->
                    navController.navigate(Screen.Kiosk.createRoute(selectedTags))
                },
                deepLinkTab = deepLinkTab,
                deepLinkSection = deepLinkSection
            )
        }

        composable(Screen.Trash.route) {
            TrashScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Weather.route) {
            WeatherScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.OmniView.route) {
            com.cwoc.app.ui.screens.omni.OmniViewScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                onNavigateToWeather = {
                    navController.navigate(Screen.Weather.route)
                }
            )
        }

        composable(Screen.Search.route) {
            com.cwoc.app.ui.screens.search.SearchScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.Help.route) {
            com.cwoc.app.ui.screens.help.HelpScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Notifications.route) {
            com.cwoc.app.ui.screens.notifications.NotificationsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.AuditLog.route,
            arguments = listOf(
                navArgument("entityType") { type = NavType.StringType; defaultValue = "" },
                navArgument("entityId") { type = NavType.StringType; defaultValue = "" }
            )
        ) { backStackEntry ->
            val entityType = backStackEntry.arguments?.getString("entityType") ?: ""
            val entityId = backStackEntry.arguments?.getString("entityId") ?: ""
            AuditLogScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                initialEntityType = entityType.ifBlank { null },
                initialEntityId = entityId.ifBlank { null }
            )
        }

        composable(Screen.CustomObjects.route) {
            CustomObjectsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.UserAdmin.route) {
            UserAdminScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.AdminChits.route) {
            AdminChitsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                }
            )
        }

        composable(Screen.RulesManager.route) {
            RulesManagerScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToEditor = { ruleId ->
                    navController.navigate(Screen.RuleEditor.createRoute(ruleId))
                }
            )
        }

        composable(
            route = Screen.RuleEditor.route,
            arguments = listOf(navArgument("ruleId") { type = NavType.StringType })
        ) { backStackEntry ->
            val ruleId = backStackEntry.arguments?.getString("ruleId") ?: return@composable
            RuleEditorScreen(
                ruleId = ruleId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Email.route) {
            com.cwoc.app.ui.screens.email.EmailScreen(
                onNavigateToEditor = { chitId ->
                    navController.navigate(Screen.Editor.createRoute(chitId))
                },
                sidebarStateViewModel = sidebarStateViewModel
            )
        }

        composable(Screen.Attachments.route) {
            AttachmentsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Kiosk.route,
            arguments = listOf(
                navArgument("tags") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val tagsParam = backStackEntry.arguments?.getString("tags")
            val selectedTags = tagsParam?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            // TODO: Replace with KioskScreen composable when implemented
            com.cwoc.app.ui.screens.kiosk.KioskScreen(
                selectedTags = selectedTags,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Editor.route,
            arguments = listOf(
                navArgument("chitId") { type = NavType.StringType },
                navArgument("start") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
                navArgument("end") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val chitId = backStackEntry.arguments?.getString("chitId") ?: return@composable
            ChitEditorScreen(
                chitId = chitId,
                onNavigateBack = { navController.popBackStack() },
                chitRepository = chitRepository
            )
        }
    }
}
