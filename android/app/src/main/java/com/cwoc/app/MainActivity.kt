package com.cwoc.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cwoc.app.data.repository.AuthEvent
import com.cwoc.app.data.repository.AuthRepository
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.SyncWorker
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.ui.components.ProfileMenu
import com.cwoc.app.ui.components.ClockModal
import com.cwoc.app.ui.components.CalculatorSheet
import com.cwoc.app.ui.navigation.CCaptnTab
import com.cwoc.app.ui.navigation.CCaptnTabRow
import com.cwoc.app.ui.navigation.CwocNavGraph
import com.cwoc.app.ui.navigation.RightEdgeSwipeDetector
import com.cwoc.app.ui.navigation.Screen
import com.cwoc.app.ui.navigation.SidebarContent
import com.cwoc.app.ui.navigation.ViewsPanel
import com.cwoc.app.ui.navigation.getOrderedVisibleTabs
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

    private val sidebarStateViewModel: com.cwoc.app.ui.viewmodel.SidebarStateViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CwocApp(
                authRepository = authRepository,
                filterSortViewModel = filterSortViewModel,
                notificationBadgeViewModel = notificationBadgeViewModel,
                emailBadgeViewModel = emailBadgeViewModel,
                chitRepository = chitRepository,
                settingsRepository = settingsRepository,
                sidebarStateViewModel = sidebarStateViewModel
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
    settingsRepository: SettingsRepository,
    sidebarStateViewModel: com.cwoc.app.ui.viewmodel.SidebarStateViewModel
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

    // Settings for profile menu (username) and view order
    val settingsFlow = remember { settingsRepository.settings }
    val currentSettings by settingsFlow.collectAsState(initial = null)
    val currentUsername = currentSettings?.username
    val viewOrder = currentSettings?.viewOrder

    // Ordered visible tabs based on view_order setting (used for tab row, swipe, and views panel)
    val orderedTabs = remember(viewOrder) {
        getOrderedVisibleTabs(viewOrder)
    }

    // Track selected C CAPTN tab
    var selectedTab by remember { mutableStateOf(CCaptnTab.Tasks) }

    // Views panel state (right-swipe panel)
    var viewsPanelOpen by remember { mutableStateOf(false) }

    // Sidebar state
    val sidebarState by sidebarStateViewModel.state.collectAsState()

    // Dialog states
    var showClockDialog by remember { mutableStateOf(false) }
    var showCalculatorSheet by remember { mutableStateOf(false) }
    var showReferenceDialog by remember { mutableStateOf(false) }

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
        Screen.Email.route,
        Screen.OmniView.route
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
                        },
                        sidebarState = sidebarState,
                        onTodayClick = { sidebarStateViewModel.goToToday() },
                        onPrevPeriod = { sidebarStateViewModel.previousPeriod() },
                        onNextPeriod = { sidebarStateViewModel.nextPeriod() },
                        onPeriodChange = { sidebarStateViewModel.setPeriod(it) },
                        onMonthModeChange = { sidebarStateViewModel.setMonthMode(it) },
                        onProjectsViewModeChange = { sidebarStateViewModel.setProjectsViewMode(it) },
                        onAlarmsViewModeChange = { sidebarStateViewModel.setAlarmsViewMode(it) },
                        onTasksViewModeChange = { sidebarStateViewModel.setTasksViewMode(it) },
                        onHabitsWindowChange = { sidebarStateViewModel.setHabitsSuccessWindow(it) },
                        onHabitsIncludeRulesChange = { sidebarStateViewModel.setHabitsIncludeRules(it) },
                        onIndicatorsRangeChange = { sidebarStateViewModel.setIndicatorsRange(it) },
                        onIndicatorsCustomRange = { s, e -> sidebarStateViewModel.setIndicatorsCustomRange(s, e) },
                        onIndicatorsVisibleGraphsChange = { sidebarStateViewModel.setIndicatorsVisibleGraphs(it) },
                        onClockClick = { showClockDialog = true },
                        onCalculatorClick = { showCalculatorSheet = true },
                        onReferenceClick = { showReferenceDialog = true }
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
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    // "Omni" is tappable — navigates directly to Omni view
                                    Text(
                                        text = "Omni",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        modifier = Modifier.clickable {
                                            selectedTab = CCaptnTab.Omni
                                            navController.navigate(Screen.OmniView.route) {
                                                popUpTo(navController.graph.startDestinationId) {
                                                    saveState = true
                                                }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                    Text(
                                        text = " Chits",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
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
                                // Profile menu (avatar + dropdown with logout/switch user)
                                ProfileMenu(
                                    username = currentUsername,
                                    displayName = null,
                                    onLogout = {
                                        authRepository.clearToken()
                                        navController.navigate(Screen.Login.route) {
                                            popUpTo(0) { inclusive = true }
                                        }
                                    },
                                    onSwitchUser = {
                                        authRepository.clearToken()
                                        navController.navigate(Screen.Login.route) {
                                            popUpTo(0) { inclusive = true }
                                        }
                                    }
                                )

                                // Views button — shows current tab name, opens views panel
                                androidx.compose.material3.TextButton(
                                    onClick = { viewsPanelOpen = true }
                                ) {
                                    Text(
                                        text = "☰ ${selectedTab.label}",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = CwocHeaderBg
                            )
                        )
                    }
                ) { innerPadding ->
                    Column(modifier = Modifier.padding(innerPadding)) {
                        // C CAPTN tab row with swipe-to-change-tab gesture
                        // Swipe left → next tab, swipe right → previous tab
                        // Matches mobile web behavior on the header area
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .pointerInput(selectedTab, orderedTabs) {
                                    detectHorizontalDragGestures { _, dragAmount ->
                                        val curIdx = orderedTabs.indexOf(selectedTab)
                                        if (dragAmount < -60f) {
                                            // Swipe left → next tab
                                            val nextIdx = if (curIdx >= orderedTabs.size - 1) 0 else curIdx + 1
                                            val nextTab = orderedTabs[nextIdx]
                                            selectedTab = nextTab
                                            navController.navigate(nextTab.route) {
                                                popUpTo(navController.graph.startDestinationId) {
                                                    saveState = true
                                                }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        } else if (dragAmount > 60f) {
                                            // Swipe right → previous tab
                                            val prevIdx = if (curIdx <= 0) orderedTabs.size - 1 else curIdx - 1
                                            val prevTab = orderedTabs[prevIdx]
                                            selectedTab = prevTab
                                            navController.navigate(prevTab.route) {
                                                popUpTo(navController.graph.startDestinationId) {
                                                    saveState = true
                                                }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    }
                                }
                        ) {
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
                                    .filterValues { it > 0 },
                                viewOrder = viewOrder
                            )
                        }

                        // Main content area with right-edge swipe detector
                        Box(modifier = Modifier.weight(1f)) {
                            RightEdgeSwipeDetector(
                                onOpenPanel = { viewsPanelOpen = true }
                            ) {
                                CwocNavGraph(
                                    navController = navController,
                                    isAuthenticated = isAuthenticated,
                                    modifier = Modifier.fillMaxSize(),
                                    filterSortViewModel = filterSortViewModel,
                                    chitRepository = chitRepository
                                )
                            }

                            // Views panel overlay (slides in from right)
                            ViewsPanel(
                                isOpen = viewsPanelOpen,
                                currentRoute = currentRoute,
                                onNavigate = { route ->
                                    navController.navigate(route) {
                                        popUpTo(navController.graph.startDestinationId) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                onDismiss = { viewsPanelOpen = false },
                                orderedMainTabs = orderedTabs
                            )
                        }
                    }
                }
                } // ParchmentBackground
            }
        } else {
            // Full-screen pages: Login, Editor, Settings, Contacts, Trash, Help, Weather, etc.
            // No drawer, no top bar, no C CAPTN tabs
            ParchmentBackground {
                Box(modifier = Modifier.systemBarsPadding()) {
                    CwocNavGraph(
                        navController = navController,
                        isAuthenticated = isAuthenticated,
                        filterSortViewModel = filterSortViewModel,
                        chitRepository = chitRepository
                    )
                }
            }
        }

        // ── Dialogs triggered from sidebar ───────────────────────────────
        if (showClockDialog) {
            val clockTimezones = try {
                val json = currentSettings?.activeClocks
                if (json != null) {
                    val arr = org.json.JSONArray(json)
                    (0 until arr.length()).map { arr.getString(it) }
                } else emptyList()
            } catch (_: Exception) { emptyList() }
            ClockModal(
                timezones = clockTimezones,
                onDismiss = { showClockDialog = false }
            )
        }

        if (showCalculatorSheet) {
            CalculatorSheet(
                onDismiss = { showCalculatorSheet = false },
                onInsert = { /* no-op from sidebar context */ }
            )
        }

        if (showReferenceDialog) {
            com.cwoc.app.ui.components.ReferenceDialog(
                onDismiss = { showReferenceDialog = false }
            )
        }
    }
}
