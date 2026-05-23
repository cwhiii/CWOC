package com.cwoc.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.repository.AuthEvent
import com.cwoc.app.data.repository.AuthRepository
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.SyncEngine
import com.cwoc.app.data.sync.SyncWorker
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.ui.components.NewChitFab
import com.cwoc.app.ui.components.ProfileMenu
import com.cwoc.app.ui.components.ClockModal
import com.cwoc.app.ui.components.CalculatorSheet
import com.cwoc.app.ui.navigation.CCaptnTab
import com.cwoc.app.ui.navigation.FilterPanel

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
import com.cwoc.app.ui.viewmodel.ProfileMenuViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        private const val REQUEST_CODE_NOTIFICATIONS = 1001
    }

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var chitRepository: ChitRepository

    @Inject
    lateinit var settingsRepository: SettingsRepository

    @Inject
    lateinit var syncEngine: SyncEngine

    @Inject
    lateinit var syncMetadataDao: SyncMetadataDao

    @Inject
    lateinit var contactRepository: com.cwoc.app.data.repository.ContactRepository

    @Inject
    lateinit var standaloneAlertRepository: com.cwoc.app.data.repository.StandaloneAlertRepository

    private val filterSortViewModel: FilterSortViewModel by viewModels()
    private val notificationBadgeViewModel: NotificationBadgeViewModel by viewModels()
    private val emailBadgeViewModel: EmailBadgeViewModel by viewModels()
    private val profileMenuViewModel: ProfileMenuViewModel by viewModels()

    private val sidebarStateViewModel: com.cwoc.app.ui.viewmodel.SidebarStateViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Request POST_NOTIFICATIONS permission on Android 13+ (API 33+)
        // Without this, notifications are denied by default and will never appear.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this, Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    REQUEST_CODE_NOTIFICATIONS
                )
            }
        }

        setContent {
            CwocApp(
                authRepository = authRepository,
                filterSortViewModel = filterSortViewModel,
                notificationBadgeViewModel = notificationBadgeViewModel,
                emailBadgeViewModel = emailBadgeViewModel,
                profileMenuViewModel = profileMenuViewModel,
                chitRepository = chitRepository,
                settingsRepository = settingsRepository,
                sidebarStateViewModel = sidebarStateViewModel,
                syncEngine = syncEngine,
                syncMetadataDao = syncMetadataDao,
                contactRepository = contactRepository,
                standaloneAlertRepository = standaloneAlertRepository
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
    profileMenuViewModel: ProfileMenuViewModel,
    chitRepository: ChitRepository,
    settingsRepository: SettingsRepository,
    sidebarStateViewModel: com.cwoc.app.ui.viewmodel.SidebarStateViewModel,
    syncEngine: SyncEngine,
    syncMetadataDao: SyncMetadataDao,
    contactRepository: com.cwoc.app.data.repository.ContactRepository,
    standaloneAlertRepository: com.cwoc.app.data.repository.StandaloneAlertRepository
) {
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Notification badge unread count
    val unreadCount by notificationBadgeViewModel.unreadCount.collectAsState()

    // Email tab badge unread count
    val emailUnreadCount by emailBadgeViewModel.unreadCount.collectAsState()

    // Profile menu notifications (from server API, matching web behavior)
    val profileNotifications by profileMenuViewModel.notifications.collectAsState()
    val profileNotifCount by profileMenuViewModel.pendingCount.collectAsState()

    // User display name from AuthRepository
    val userDisplayName by authRepository.displayName.collectAsState()
    val currentUserId by authRepository.userId.collectAsState()
    val authUsername by authRepository.username.collectAsState()
    val userProfileImageUrl by authRepository.profileImageUrl.collectAsState()

    // Settings for profile menu (username) and view order
    val settingsFlow = remember { settingsRepository.settings }
    val currentSettings by settingsFlow.collectAsState(initial = null)
    val currentUsername = authUsername ?: currentSettings?.username
    val viewOrder = currentSettings?.viewOrder

    // Ordered visible tabs based on view_order setting (used for tab row, swipe, and views panel)
    val orderedTabs = remember(viewOrder) {
        getOrderedVisibleTabs(viewOrder)
    }

    // Track selected C CAPTN tab
    var selectedTab by remember { mutableStateOf(CCaptnTab.Tasks) }
    // Track whether we've already applied the landing view from settings
    var landingViewApplied by remember { mutableStateOf(false) }

    // Apply landing view from settings on first load
    LaunchedEffect(currentSettings?.landingView, currentSettings?.defaultView) {
        if (!landingViewApplied && currentSettings != null) {
            val landingView = currentSettings?.landingView ?: currentSettings?.defaultView ?: "Calendar"
            val targetTab = when (landingView) {
                "Omni" -> CCaptnTab.Omni
                "Calendar" -> CCaptnTab.Calendar
                "Checklists" -> CCaptnTab.Checklists
                "Alarms" -> CCaptnTab.Alarms
                "Projects" -> CCaptnTab.Projects
                "Tasks" -> CCaptnTab.Tasks
                "Notes" -> CCaptnTab.Notes
                "Email" -> CCaptnTab.Email
                "Indicators" -> CCaptnTab.Indicators
                else -> CCaptnTab.Calendar
            }
            if (targetTab != selectedTab) {
                selectedTab = targetTab
                navController.navigate(targetTab.route) {
                    popUpTo(navController.graph.startDestinationId) {
                        inclusive = true
                    }
                }
            }
            landingViewApplied = true
        }
    }

    // Views panel state (right-swipe panel)
    var viewsPanelOpen by remember { mutableStateOf(false) }

    // Sidebar state
    val sidebarState by sidebarStateViewModel.state.collectAsState()

    // Dialog states
    var showClockDialog by remember { mutableStateOf(false) }
    var showWeatherDialog by remember { mutableStateOf(false) }
    var showCalculatorSheet by remember { mutableStateOf(false) }
    var showReferenceDialog by remember { mutableStateOf(false) }
    var showQuickAlertSheet by remember { mutableStateOf(false) }

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

    // Fetch user profile (display name) on startup when authenticated
    LaunchedEffect(Unit) {
        if (authRepository.isAuthenticated()) {
            authRepository.fetchUserProfile()
            // Also refresh from prefs after a short delay — sync may have updated
            // the profile image URL in SharedPreferences from its own getMe() call
            kotlinx.coroutines.delay(3000)
            authRepository.refreshProfileFromPrefs()
        }
    }

    // Handle navigate_to intent extra from widgets and notifications
    val activity = context as? ComponentActivity
    LaunchedEffect(Unit) {
        val navigateTo = activity?.intent?.getStringExtra("navigate_to")
        if (navigateTo != null && authRepository.isAuthenticated()) {
            // Clear the extra so it doesn't re-trigger on config changes
            activity.intent.removeExtra("navigate_to")
            when {
                navigateTo.startsWith("editor/") -> {
                    navController.navigate(navigateTo)
                }
                navigateTo == "alerts" -> {
                    navController.navigate(Screen.Alarms.route)
                }
                navigateTo == "weather" -> {
                    navController.navigate(Screen.Weather.route)
                }
                navigateTo == "notifications" -> {
                    navController.navigate(Screen.Notifications.route)
                }
                navigateTo.startsWith("profile/") -> {
                    val uid = navigateTo.removePrefix("profile/")
                    navController.navigate(Screen.ContactEditor.createProfileRoute(uid))
                }
                navigateTo.startsWith("calendar/") -> {
                    navController.navigate(Screen.Calendar.route)
                }
                navigateTo.startsWith("project/") -> {
                    val projectId = navigateTo.removePrefix("project/")
                    navController.navigate(Screen.Editor.createRoute(projectId))
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
        Screen.OmniView.route,
        Screen.Notebook.route,
        Screen.Search.route,
        Screen.Contacts.route
    )
    val showNavChrome = currentRoute != null && currentRoute in cCaptnRoutes

    CwocTheme {
        if (currentRoute == null && isAuthenticated) {
            // Show CWOC logo on parchment while nav resolves
            ParchmentBackground {
                Image(
                    painter = painterResource(id = R.drawable.cwoc_logo),
                    contentDescription = "CWOC",
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxSize(0.5f),
                    contentScale = ContentScale.Fit
                )
            }
        } else if (showNavChrome) {
            // Dismiss keyboard whenever the drawer opens (covers swipe gesture too)
            LaunchedEffect(drawerState.currentValue) {
                if (drawerState.currentValue == DrawerValue.Open) {
                    focusManager.clearFocus()
                }
            }
            ModalNavigationDrawer(
                drawerState = drawerState,
                gesturesEnabled = !viewsPanelOpen,
                drawerContent = {
                    ModalDrawerSheet(
                        drawerContainerColor = Color(0xFFFDF5E6) // Parchment light
                    ) {
                    val currentFilterState by filterSortViewModel.filterState.collectAsState()
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
                        enabledPeriods = remember(currentSettings?.enabledPeriods) {
                            com.cwoc.app.domain.settings.PeriodFilterUtil.filterEnabledPeriods(
                                com.cwoc.app.domain.settings.PeriodFilterUtil.DISPLAY_ORDER,
                                currentSettings?.enabledPeriods
                            )
                        },
                        customDaysCount = currentSettings?.customDaysCount?.toIntOrNull() ?: 7,
                        emailFolder = sidebarState.emailFolder,
                        onEmailFolderChange = { sidebarStateViewModel.setEmailFolder(it) },
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
                        onIndicatorsModeChange = { sidebarStateViewModel.setIndicatorsMode(it) },
                        onClockClick = { showClockDialog = true },
                        onWeatherLongPress = { showWeatherDialog = true },
                        onCalculatorClick = { showCalculatorSheet = true },
                        onReferenceClick = { showReferenceDialog = true },
                        filterActiveCount = currentFilterState.activeFilterCount,
                        onClearFilters = { filterSortViewModel.clearFilters() },
                        filterContent = {
                            val filterState by filterSortViewModel.filterState.collectAsState()

                            // Parse tags from settings
                            val availableTags = remember(currentSettings?.tags) {
                                parseTagItemsFromSettings(currentSettings?.tags)
                            }

                            // Load contacts from repository as people items
                            val contacts by contactRepository.allContacts.collectAsState(initial = emptyList())
                            val availablePeople = remember(contacts) {
                                contacts.mapNotNull { c ->
                                    val name = c.displayName ?: c.givenName.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                                    com.cwoc.app.ui.navigation.filter.PersonItem(
                                        name = name,
                                        color = c.color,
                                        imageUrl = c.imageUrl,
                                        favorite = c.favorite,
                                        prefix = c.prefix,
                                        isSystemUser = false
                                    )
                                }
                            }

                            // Load project masters from chit repository
                            val projectChits by chitRepository.getProjectMasterChits().collectAsState(initial = emptyList())
                            val availableProjects = remember(projectChits) {
                                projectChits.map { chit ->
                                    com.cwoc.app.ui.navigation.filter.ProjectItem(
                                        id = chit.id,
                                        title = chit.title?.takeIf { it.isNotBlank() } ?: "(Untitled Project)"
                                    )
                                }.sortedBy { it.title.lowercase() }
                            }

                            // Load saved searches from SharedPreferences
                            val savedSearches = remember {
                                try {
                                    val json = context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
                                        .getString("saved_searches", null)
                                    if (json != null) {
                                        val arr = org.json.JSONArray(json)
                                        (0 until arr.length()).map { arr.getString(it) }
                                    } else emptyList()
                                } catch (_: Exception) { emptyList<String>() }
                            }

                            FilterPanel(
                                filterState = filterState,
                                onFilterStateChanged = { filterSortViewModel.updateFilter(it) },
                                availableTags = availableTags,
                                availablePeople = availablePeople,
                                availableProjects = availableProjects,
                                savedSearches = savedSearches,
                                onSavedSearchDelete = { search ->
                                    val prefs = context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
                                    val current = try {
                                        val json = prefs.getString("saved_searches", null)
                                        if (json != null) {
                                            val arr = org.json.JSONArray(json)
                                            (0 until arr.length()).map { arr.getString(it) }.toMutableList()
                                        } else mutableListOf()
                                    } catch (_: Exception) { mutableListOf() }
                                    current.remove(search)
                                    prefs.edit().putString("saved_searches", org.json.JSONArray(current).toString()).apply()
                                },
                                currentTab = selectedTab.route,
                                hasCustomDefaults = false,
                                onClearAll = { filterSortViewModel.clearFilters() },
                                onApplyDefaults = { filterSortViewModel.clearFilters() }
                            )
                        }
                    )
                    }
                }
            ) {
                ParchmentBackground {
                Scaffold(
                    containerColor = Color.Transparent,
                    snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                    floatingActionButton = {
                        NewChitFab(
                            onTap = { navController.navigate(Screen.Editor.createRoute(Screen.Editor.NEW_CHIT_ID, sourceTab = selectedTab.label)) },
                            onLongPress = { showQuickAlertSheet = true }
                        )
                    },
                    topBar = {
                        Box {
                        TopAppBar(
                            modifier = Modifier
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
                                },
                            title = { },
                            navigationIcon = {
                                // Hamburger + logo matching mobile web: [☰] [Logo]
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(start = 4.dp)
                                ) {
                                    // Hamburger button (brown bg, cream text, extreme left)
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .background(Color(0xFF8B5A2B), RoundedCornerShape(4.dp))
                                            .border(1.dp, Color(0xFF5A3F2A), RoundedCornerShape(4.dp))
                                            .clickable {
                                                scope.launch {
                                                    viewsPanelOpen = false
                                                    drawerState.open()
                                                }
                                                focusManager.clearFocus()
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "☰",
                                            color = Color(0xFFFFF8E1),
                                            fontSize = 16.sp,
                                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                                        )
                                    }
                                    // Omni logo (circular)
                                    Image(
                                        painter = painterResource(id = R.drawable.cwoc_logo),
                                        contentDescription = "C.W.'s Omni Chits Logo",
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clip(CircleShape)
                                            .border(1.dp, Color(0xFF5A3F2A), CircleShape)
                                            .clickable {
                                                scope.launch {
                                                    viewsPanelOpen = false
                                                    drawerState.open()
                                                }
                                                focusManager.clearFocus()
                                            },
                                        contentScale = ContentScale.Crop
                                    )
                                }
                            },
                            actions = {
                                // Right side: [view icon circle] [☰ square] — no text
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(end = 4.dp)
                                ) {
                                    // View icon (circular, matching logo style)
                                    if (selectedTab.drawableResId != null) {
                                        Image(
                                            painter = painterResource(id = selectedTab.drawableResId!!),
                                            contentDescription = selectedTab.label,
                                            modifier = Modifier
                                                .size(32.dp)
                                                .clip(CircleShape)
                                                .border(1.dp, Color(0xFF5A3F2A), CircleShape)
                                                .clickable {
                                                    scope.launch { drawerState.close() }
                                                    viewsPanelOpen = true
                                                    focusManager.clearFocus()
                                                }
                                        )
                                    }
                                    // Hamburger button (exact match of left hamburger)
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .background(Color(0xFF8B5A2B), RoundedCornerShape(4.dp))
                                            .border(1.dp, Color(0xFF5A3F2A), RoundedCornerShape(4.dp))
                                            .clickable {
                                                scope.launch { drawerState.close() }
                                                viewsPanelOpen = true
                                                focusManager.clearFocus()
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "☰",
                                            color = Color(0xFFFFF8E1),
                                            fontSize = 16.sp,
                                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.size(8.dp))
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = CwocHeaderBg
                            )
                        )
                        // Profile avatar overlay — centered horizontally, aligned with content row
                        Box(
                            modifier = Modifier
                                .matchParentSize(),
                            contentAlignment = Alignment.BottomCenter
                        ) {
                            Box(
                                modifier = Modifier
                                    .height(64.dp),  // Standard TopAppBar content height
                                contentAlignment = Alignment.Center
                            ) {
                                ProfileMenu(
                                username = currentUsername,
                                displayName = userDisplayName,
                                profileImageUrl = userProfileImageUrl,
                                serverUrl = authRepository.getLastServerUrl()?.trimEnd('/') ?: "",
                                authToken = authRepository.getToken() ?: "",
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
                                },
                                onViewProfile = {
                                    val uid = currentUserId
                                    if (uid != null) {
                                        navController.navigate(Screen.ContactEditor.createProfileRoute(uid))
                                    }
                                },
                                onViewNotifications = {
                                    navController.navigate(Screen.Notifications.route)
                                },
                                notificationCount = profileNotifCount,
                                notifications = profileNotifications,
                                onAcceptNotification = { id -> profileMenuViewModel.acceptNotification(id) },
                                onDeclineNotification = { id -> profileMenuViewModel.declineNotification(id) },
                                onDismissNotification = { id -> profileMenuViewModel.dismissNotification(id) },
                                onSnoozeNotification = { id -> profileMenuViewModel.snoozeNotification(id) },
                                onNavigateToChit = { chitId ->
                                    navController.navigate(Screen.Editor.createRoute(chitId))
                                }
                            )
                            }
                        }
                        }
                    }
                ) { innerPadding ->
                    // Pull-to-refresh wrapping the entire content area (tab row + views)
                    val pullToRefreshState = rememberPullToRefreshState()
                    if (pullToRefreshState.isRefreshing) {
                        LaunchedEffect(true) {
                            try {
                                val metadata = syncMetadataDao.getMetadata()
                                val since = metadata?.highWaterMark ?: 0
                                syncEngine.performSync(since)
                            } finally {
                                pullToRefreshState.endRefresh()
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .padding(innerPadding)
                            .nestedScroll(pullToRefreshState.nestedScrollConnection)
                    ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Main content area with right-edge swipe detector
                        Box(
                            modifier = Modifier
                                .weight(1f)
                        ) {
                            RightEdgeSwipeDetector(
                                onOpenPanel = {
                                    if (drawerState.currentValue == DrawerValue.Closed) {
                                        viewsPanelOpen = true
                                        focusManager.clearFocus()
                                    }
                                }
                            ) {
                                CwocNavGraph(
                                    navController = navController,
                                    isAuthenticated = isAuthenticated,
                                    modifier = Modifier.fillMaxSize(),
                                    filterSortViewModel = filterSortViewModel,
                                    chitRepository = chitRepository,
                                    sidebarStateViewModel = sidebarStateViewModel,
                                    settingsRepository = settingsRepository,
                                    onQuickAlert = { showQuickAlertSheet = true }
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

                    PullToRefreshContainer(
                        state = pullToRefreshState,
                        modifier = Modifier.align(Alignment.TopCenter)
                    )
                    } // Box (pull-to-refresh)
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
                    chitRepository = chitRepository,
                    sidebarStateViewModel = sidebarStateViewModel,
                    settingsRepository = settingsRepository,
                    onQuickAlert = { showQuickAlertSheet = true }
                )
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

        if (showWeatherDialog) {
            val weatherContext = androidx.compose.ui.platform.LocalContext.current
            val weatherPrefs = weatherContext.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
            val serverUrl = weatherPrefs.getString("server_url", "") ?: ""
            val authToken = weatherPrefs.getString("auth_token", "") ?: ""
            com.cwoc.app.ui.components.WeatherModal(
                savedLocations = currentSettings?.savedLocations,
                serverUrl = serverUrl.trimEnd('/'),
                authToken = authToken,
                onDismiss = { showWeatherDialog = false },
                onFullForecast = {
                    showWeatherDialog = false
                    navController.navigate(com.cwoc.app.ui.navigation.Screen.Weather.route)
                }
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

        // ── Quick Alert Sheet (FAB long-press) ───────────────────────────
        if (showQuickAlertSheet) {
            com.cwoc.app.ui.components.QuickAlertSheet(
                onDismiss = { showQuickAlertSheet = false },
                is24Hour = (currentSettings?.timeFormat == "24hour"),
                calendarSnap = currentSettings?.calendarSnap?.toIntOrNull() ?: 5,
                onSaveReminder = { reminderData ->
                    scope.launch {
                        val chitId = java.util.UUID.randomUUID().toString()
                        val pointInTime = "${reminderData.date}T${reminderData.time}:00"
                        val alertJson = com.google.gson.Gson().toJson(listOf(
                            mapOf(
                                "_type" to "notification",
                                "value" to 0,
                                "unit" to "minutes",
                                "atTarget" to true,
                                "afterTarget" to false,
                                "targetType" to "point"
                            )
                        ))
                        val now = java.time.Instant.now().toString()
                        val entity = com.cwoc.app.data.local.entity.ChitEntity(
                            id = chitId,
                            title = reminderData.title,
                            note = null,
                            tags = null,
                            startDatetime = null,
                            endDatetime = null,
                            dueDatetime = null,
                            pointInTime = pointInTime,
                            completedDatetime = null,
                            status = null,
                            priority = null,
                            severity = null,
                            checklist = null,
                            alarm = null,
                            notification = true,
                            recurrence = null,
                            recurrenceId = null,
                            recurrenceRule = null,
                            recurrenceExceptions = null,
                            location = null,
                            color = null,
                            people = null,
                            pinned = false,
                            archived = false,
                            deleted = false,
                            createdDatetime = now,
                            modifiedDatetime = now,
                            isProjectMaster = false,
                            childChits = null,
                            allDay = false,
                            timezone = null,
                            alerts = alertJson,
                            progressPercent = null,
                            timeEstimate = null,
                            weatherData = null,
                            healthData = null,
                            habit = false,
                            habitGoal = null,
                            habitSuccess = null,
                            showOnCalendar = null,
                            habitResetPeriod = null,
                            habitLastActionDate = null,
                            habitHideOverall = null,
                            perpetual = false,
                            shares = null,
                            stealth = null,
                            assignedTo = null,
                            ownerId = null,
                            hasUnviewedConflict = false,
                            availability = null,
                            snoozedUntil = null,
                            prerequisites = null,
                            syncVersion = 0,
                            lastSyncedAt = null
                        )
                        chitRepository.upsertAndSync(entity, setOf(
                            "title", "point_in_time", "notification", "alerts",
                            "created_datetime", "modified_datetime"
                        ))
                    }
                    showQuickAlertSheet = false
                },
                onSaveAlarm = { alarmData ->
                    scope.launch {
                        val data = mapOf<String, Any?>(
                            "time" to alarmData.time,
                            "days" to alarmData.days,
                            "enabled" to true
                        )
                        val result = standaloneAlertRepository.create(
                            type = "alarm",
                            name = alarmData.name.ifBlank { null },
                            data = data
                        )
                        result.onFailure { e ->
                            android.util.Log.e("CWOC_QUICK", "Quick alarm create FAILED: ${e.message}")
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                android.widget.Toast.makeText(context, "Alarm failed: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                    showQuickAlertSheet = false
                },
                onSaveTimer = { timerData ->
                    scope.launch {
                        val totalSeconds = timerData.hours * 3600 + timerData.minutes * 60 + timerData.seconds
                        val data = mapOf<String, Any?>(
                            "totalSeconds" to totalSeconds,
                            "loop" to timerData.loop
                        )
                        val result = standaloneAlertRepository.create(
                            type = "timer",
                            name = timerData.name.ifBlank { null },
                            data = data
                        )
                        result.onFailure { e ->
                            android.util.Log.e("CWOC_QUICK", "Quick timer create FAILED: ${e.message}")
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                android.widget.Toast.makeText(context, "Timer failed: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                    showQuickAlertSheet = false
                },
                onSaveStopwatch = { stopwatchData ->
                    scope.launch {
                        standaloneAlertRepository.create(
                            type = "stopwatch",
                            name = stopwatchData.name.ifBlank { null },
                            data = emptyMap()
                        )
                    }
                    showQuickAlertSheet = false
                },
                onCreateAndView = {
                    showQuickAlertSheet = false
                    navController.navigate(Screen.Alarms.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    }
}

/**
 * Parse tag items from the settings sharedTags JSON string.
 * Format: JSON array of objects with "name", "color", "favorite" fields.
 */
private fun parseTagItemsFromSettings(sharedTagsJson: String?): List<com.cwoc.app.ui.navigation.filter.TagItem> {
    if (sharedTagsJson.isNullOrBlank()) return emptyList()
    return try {
        val systemTags = setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")
        val arr = org.json.JSONArray(sharedTagsJson)
        (0 until arr.length()).mapNotNull { i ->
            val obj = arr.optJSONObject(i) ?: return@mapNotNull null
            val name = obj.optString("name", "").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            // Filter out system tags
            if (name in systemTags || name.startsWith("CWOC_System/", ignoreCase = true)) return@mapNotNull null
            com.cwoc.app.ui.navigation.filter.TagItem(
                name = name,
                color = obj.optString("color", "").takeIf { it.isNotBlank() },
                favorite = obj.optBoolean("favorite", false)
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}
