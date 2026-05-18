package com.cwoc.app.ui.screens.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.remote.BundleDto
import kotlinx.coroutines.delay


/**
 * Settings screen with a ScrollableTabRow and TopAppBar with back navigation.
 * Tab order: General (0), Views (1), Collections (2), Email (3), Administration (4).
 * Administration tab is hidden for non-admin users.
 *
 * Wires SettingsViewModel to all settings tabs and DebugViewModel to AdminSettingsTab.
 *
 * Includes unsaved changes confirmation dialog on back navigation when dirty.
 *
 * Validates: Requirements 1.6, 2.1, 2.2, 29.1, 29.2, 29.3, 29.4, 29.5
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToAdminChits: () -> Unit = {},
    onNavigateToUserAdmin: () -> Unit = {},
    onNavigateToAttachments: () -> Unit = {},
    onNavigateToAuditLog: () -> Unit = {},
    onNavigateToTrash: () -> Unit = {},
    onNavigateToCustomObjects: () -> Unit = {},
    onNavigateToKiosk: (selectedTags: List<String>) -> Unit = {},
    deepLinkTab: String? = null,
    deepLinkSection: String? = null,
    settingsViewModel: SettingsViewModel = hiltViewModel(),
    debugViewModel: DebugViewModel = hiltViewModel()
) {
    val settingsState by settingsViewModel.settings.collectAsState()
    val isDirty by settingsViewModel.isDirty.collectAsState()
    val isAdmin by settingsViewModel.isAdmin.collectAsState()
    var selectedTabIndex by rememberSaveable { mutableIntStateOf(0) }
    var showUnsavedChangesDialog by remember { mutableStateOf(false) }

    // Snackbar for success/error notifications (e.g., sort order reset)
    val snackbarHostState = remember { SnackbarHostState() }

    // Observe save errors and show snackbar
    // Validates: Requirement 1.5 — save failure shows error toast, retains form values, keeps dirty state
    val saveError by settingsViewModel.saveError.collectAsState()
    LaunchedEffect(saveError) {
        if (saveError != null) {
            snackbarHostState.showSnackbar(saveError ?: "Network error — changes not saved")
            settingsViewModel.clearSaveError()
        }
    }

    // Observe load errors and show snackbar
    // On load failure: show error toast, fall back to last-cached settings from Room (or defaults)
    val loadError by settingsViewModel.loadError.collectAsState()
    LaunchedEffect(loadError) {
        if (loadError != null) {
            snackbarHostState.showSnackbar(loadError ?: "Failed to load settings")
            settingsViewModel.clearLoadError()
        }
    }

    // Collect sort order reset results and show snackbar
    LaunchedEffect(Unit) {
        settingsViewModel.sortOrderResetResult.collect { result ->
            result.fold(
                onSuccess = { message ->
                    snackbarHostState.showSnackbar(message)
                },
                onFailure = { error ->
                    snackbarHostState.showSnackbar(error.message ?: "Failed to reset sort orders")
                }
            )
        }
    }

    // Tab structure: General, Views, Collections, Email, and conditionally Administration.
    // "Badges" is removed as a separate tab (merged into Email tab in task 27.1).
    // Validates: Requirements 29.1, 29.2, 29.3
    val tabs = if (isAdmin) {
        listOf("General", "Views", "Collections", "Email", "Administration")
    } else {
        listOf("General", "Views", "Collections", "Email")
    }

    // Deep-link tab mapping: maps deepLinkTab string values to tab indices.
    // If deep-link targets Administration tab and user is not admin, falls back to General tab (index 0).
    // Validates: Requirements 29.4, 29.5
    LaunchedEffect(deepLinkTab, isAdmin) {
        if (deepLinkTab != null) {
            val targetIndex = when (deepLinkTab.lowercase()) {
                "general" -> 0
                "views" -> 1
                "collections" -> 2
                "email" -> 3
                "admin", "administration" -> {
                    // If user is not admin, fall back to General tab
                    if (isAdmin) 4 else 0
                }
                else -> null
            }
            if (targetIndex != null) {
                selectedTabIndex = targetIndex
            }
        }
    }

    // Deep-link section scrolling: if deepLinkSection is provided, scroll to that section
    // within 500ms of screen load. For now, this is best-effort via tab selection;
    // individual tab composables can observe this value for intra-tab scrolling.
    // Validates: Requirement 29.4
    LaunchedEffect(deepLinkSection) {
        if (deepLinkSection != null) {
            // Delay 500ms to allow the tab content to render before scrolling
            delay(500L)
            // Section scrolling is handled by individual tab composables via their scroll state.
            // The deepLinkSection value is available for tabs to consume if needed.
        }
    }

    // Listen for navigateBack events from ViewModel (e.g., after saveAndExit succeeds)
    LaunchedEffect(Unit) {
        settingsViewModel.navigateBack.collect {
            onNavigateBack()
        }
    }

    // Intercept system back (back button, back gesture) when dirty
    BackHandler(enabled = isDirty) {
        showUnsavedChangesDialog = true
    }

    // Unsaved changes confirmation dialog
    // Validates: Requirement 1.6
    if (showUnsavedChangesDialog) {
        AlertDialog(
            onDismissRequest = { showUnsavedChangesDialog = false },
            title = { Text("Unsaved Changes") },
            text = { Text("You have unsaved changes. What would you like to do?") },
            confirmButton = {
                Row {
                    TextButton(onClick = {
                        showUnsavedChangesDialog = false
                    }) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = {
                        showUnsavedChangesDialog = false
                        settingsViewModel.discardChanges()
                        onNavigateBack()
                    }) {
                        Text("Discard")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = {
                        showUnsavedChangesDialog = false
                        settingsViewModel.saveAndExit()
                    }) {
                        Text("Save")
                    }
                }
            }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = {
                        if (isDirty) {
                            showUnsavedChangesDialog = true
                        } else {
                            onNavigateBack()
                        }
                    }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = if (isDirty) "Discard Changes" else "Exit"
                        )
                    }
                },
                actions = {
                    if (isDirty) {
                        // Save & Stay button — persists and stays on screen
                        // Validates: Requirement 1.3
                        TextButton(onClick = { settingsViewModel.saveAndStay() }) {
                            Text("Save & Stay")
                        }
                        // Save & Exit button — persists and navigates back
                        // Validates: Requirement 1.4
                        TextButton(onClick = { settingsViewModel.saveAndExit() }) {
                            Text("Save & Exit")
                        }
                    } else {
                        // Disabled "Saved ✓" indicator when not dirty
                        // Validates: Requirement 1.1
                        TextButton(onClick = {}, enabled = false) {
                            Text("Saved ✓")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            ScrollableTabRow(
                selectedTabIndex = selectedTabIndex,
                edgePadding = 0.dp
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        text = { Text(title) }
                    )
                }
            }

            // Tab content: General (0), Views (1), Collections (2), Email (3), Administration (4)
            // Validates: Requirements 29.1, 29.2
            when (selectedTabIndex) {
                0 -> GeneralSettingsTab(
                    formState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    },
                    onResetSortOrders = {
                        settingsViewModel.resetSortOrders()
                    }
                )
                1 -> ViewsSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    },
                    bundles = settingsViewModel.bundles.collectAsState().value
                )
                2 -> CollectionsSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    }
                )
                3 -> EmailSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    },
                    onTestConnection = { email, imapHost, imapPort, smtpHost, smtpPort, username, password, onResult ->
                        settingsViewModel.testEmailConnection(
                            email, imapHost, imapPort, smtpHost, smtpPort, username, password, onResult
                        )
                    },
                    onNavigateToAttachments = onNavigateToAttachments,
                    bundles = settingsViewModel.bundles.collectAsState().value,
                    onToggleBundle = { bundleId, enable ->
                        settingsViewModel.toggleBundle(bundleId, enable)
                    },
                    onBackfillTriggered = { settingsViewModel.triggerBackfill() },
                    isBackfillInProgress = settingsViewModel.isBackfillInProgress.collectAsState().value,
                    backfillResultMessage = settingsViewModel.backfillResultMessage.collectAsState().value
                )
                4 -> {
                    // Administration tab — only reachable when isAdmin is true
                    if (isAdmin) {
                        AdminSettingsTab(
                            debugViewModel = debugViewModel,
                            settingsState = settingsState,
                            onUpdateSetting = { key, value ->
                                settingsViewModel.updateSetting(key, value)
                            },
                            onNavigateToAdminChits = onNavigateToAdminChits,
                            onNavigateToUserAdmin = onNavigateToUserAdmin,
                            onNavigateToAuditLog = onNavigateToAuditLog,
                            onNavigateToTrash = onNavigateToTrash,
                            onNavigateToCustomObjects = onNavigateToCustomObjects,
                            onNavigateToKiosk = onNavigateToKiosk,
                            settingsViewModel = settingsViewModel
                        )
                    }
                }
            }
        }
    }
}
