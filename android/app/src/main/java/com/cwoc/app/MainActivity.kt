package com.cwoc.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cwoc.app.data.repository.AuthEvent
import com.cwoc.app.data.repository.AuthRepository
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.SyncWorker
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.ui.components.ProfileMenu
import com.cwoc.app.ui.navigation.CCaptnTab
import com.cwoc.app.ui.navigation.CCaptnTabRow
import com.cwoc.app.ui.navigation.CwocNavGraph
import com.cwoc.app.ui.navigation.Screen
import com.cwoc.app.ui.navigation.SidebarContent
import com.cwoc.app.ui.theme.CwocTheme
import com.cwoc.app.ui.theme.ParchmentBackground
import com.cwoc.app.ui.theme.CwocHeaderBg
import com.cwoc.app.ui.viewmodel.EmailBadgeViewModel
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.NotificationBadgeViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var chitRepository: ChitRepository

    @Inject
    lateinit var settingsRepository: SettingsRepository

    private val filterSortViewModel: FilterSortViewModel by viewModels()
    private val notificationBadgeViewModel: NotificationBadgeViewModel by viewModels()
    private val emailBadgeViewModel: EmailBadgeViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CwocApp(
                authRepository = authRepository,
                filterSortViewModel = filterSortViewModel,
                notificationBadgeViewModel = notificationBadgeViewModel,
                emailBadgeViewModel = emailBadgeViewModel,
                chitRepository = chitRepository,
                settingsRepository = settingsRepository
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CwocApp(
    authRepository: AuthRepository,
    filterSortViewModel: FilterSortViewModel,
    notificationBadgeViewModel: NotificationBadgeViewModel,
    emailBadgeViewModel: EmailBadgeViewModel,
    chitRepository: ChitRepository,
    settingsRepository: SettingsRepository
) {
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val context = LocalContext.current
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Notification badge unread count
    val unreadCount by notificationBadgeViewModel.unreadCount.collectAsState()

    // Email tab badge unread count
    val emailUnreadCount by emailBadgeViewModel.unreadCount.collectAsState()

    // Settings for profile menu (username)
    val settingsFlow = remember { settingsRepository.settings }
    val currentSettings by settingsFlow.collectAsState(initial = null)
    val currentUsername = currentSettings?.username

    // Track selected C CAPTN tab
    var selectedTab by remember { mutableStateOf(CCaptnTab.Tasks) }

    // Determine initial auth state
    val isAuthenticated = authRepository.isAuthenticated()

    // Listen for token revocation events and navigate to login
    LaunchedEffect(Unit) {
        authRepository.authEvents.collect { event ->
            when (event) {
                is AuthEvent.TokenRevoked -> {
                    snackbarHostState.showSnackbar("Session expired. Please log in again.")
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }
        }
    }

    // Enqueue SyncWorker periodic sync when navigating away from login
    LaunchedEffect(currentRoute) {
        if (currentRoute != null && currentRoute != Screen.Login.route) {
            SyncWorker.enqueue(context)
        }
    }

    // Sync selectedTab with current navigation route
    LaunchedEffect(currentRoute) {
        val matchingTab = CCaptnTab.entries.find { it.route == currentRoute }
        if (matchingTab != null) {
            selectedTab = matchingTab
        }
    }

    // Determine if we should show the main navigation chrome (drawer, top bar, tabs)
    // Only C CAPTN tab views get the full chrome. All other screens (Editor, Settings,
    // Contacts, Trash, Help, Weather, etc.) render full-screen without it.
    val cCaptnRoutes = setOf(
        Screen.Tasks.route,
        Screen.Notes.route,
        Screen.Calendar.route,
        Screen.Checklists.route,
        Screen.Alarms.route,
        Screen.Projects.route,
        Screen.Indicators.route,
        Screen.Email.route
    )
    val showNavChrome = currentRoute != null && currentRoute in cCaptnRoutes

    CwocTheme {
        // Single NavHost — chrome is conditionally shown based on current route
        if (showNavChrome) {
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    SidebarContent(
                        selectedTab = selectedTab,
                        onNavigate = { screen ->
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.startDestinationId) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        onNewChit = {
                            navController.navigate(Screen.Editor.createRoute(Screen.Editor.NEW_CHIT_ID))
                        },
                        onClose = {
                            scope.launch { drawerState.close() }
                        }
                    )
                }
            ) {
                ParchmentBackground {
                Scaffold(
                    containerColor = Color.Transparent,
                    snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                    topBar = {
                        TopAppBar(
                            title = {
                                Text(
                                    text = "CWOC  ${BuildConfig.VERSION_NAME}",
                                    style = MaterialTheme.typography.titleMedium
                                )
                            },
                            navigationIcon = {
                                IconButton(onClick = {
                                    scope.launch { drawerState.open() }
                                }) {
                                    Icon(
                                        imageVector = Icons.Default.Menu,
                                        contentDescription = "Open navigation drawer"
                                    )
                                }
                            },
                            actions = {
                                // Notification bell with badge
                                if (unreadCount > 0) {
                                    IconButton(onClick = {
                                        navController.navigate(Screen.Notifications.route) {
                                            popUpTo(navController.graph.startDestinationId) {
                                                saveState = true
                                            }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }) {
                                        BadgedBox(
                                            badge = {
                                                Badge {
                                                    Text(
                                                        text = if (unreadCount > 99) "99+" else unreadCount.toString()
                                                    )
                                                }
                                            }
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Notifications,
                                                contentDescription = "Notifications"
                                            )
                                        }
                                    }
                                } else {
                                    IconButton(onClick = {
                                        navController.navigate(Screen.Notifications.route) {
                                            popUpTo(navController.graph.startDestinationId) {
                                                saveState = true
                                            }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }) {
                                        Icon(
                                            imageVector = Icons.Default.Notifications,
                                            contentDescription = "Notifications"
                                        )
                                    }
                                }

                                // Search
                                IconButton(onClick = {
                                    navController.navigate(Screen.Search.route) {
                                        popUpTo(navController.graph.startDestinationId) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }) {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = "Search"
                                    )
                                }

                                // Profile menu (avatar + dropdown with logout/switch user)
                                ProfileMenu(
                                    username = currentUsername,
                                    displayName = null, // TODO: add display_name to settings sync
                                    onLogout = {
                                        authRepository.clearToken()
                                        navController.navigate(Screen.Login.route) {
                                            popUpTo(0) { inclusive = true }
                                        }
                                    },
                                    onSwitchUser = {
                                        // Navigate to login screen for switch user
                                        authRepository.clearToken()
                                        navController.navigate(Screen.Login.route) {
                                            popUpTo(0) { inclusive = true }
                                        }
                                    }
                                )
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = CwocHeaderBg
                            )
                        )
                    }
                ) { innerPadding ->
                    Column(modifier = Modifier.padding(innerPadding)) {
                        // C CAPTN tab row for view switching
                        CCaptnTabRow(
                            selectedTab = selectedTab,
                            onTabSelected = { tab ->
                                selectedTab = tab
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            tabCounts = mapOf(CCaptnTab.Email to emailUnreadCount)
                                .filterValues { it > 0 }
                        )

                        // Main content area
                        CwocNavGraph(
                            navController = navController,
                            isAuthenticated = isAuthenticated,
                            modifier = Modifier.weight(1f),
                            filterSortViewModel = filterSortViewModel,
                            chitRepository = chitRepository
                        )
                    }
                }
                } // ParchmentBackground
            }
        } else {
            // Full-screen pages: Login, Editor, Settings, Contacts, Trash, Help, Weather, etc.
            // No drawer, no top bar, no C CAPTN tabs
            ParchmentBackground {
                CwocNavGraph(
                    navController = navController,
                    isAuthenticated = isAuthenticated,
                    filterSortViewModel = filterSortViewModel,
                    chitRepository = chitRepository
                )
            }
        }
    }
}
