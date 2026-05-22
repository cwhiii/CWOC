package com.cwoc.app.ui.screens.alerts

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel

/**
 * Alerts screen — displays four modes controlled by the sidebar:
 * "list" (Chits), "independent", "notifications", "reminders"
 *
 * Mode selection is driven by SidebarStateViewModel.alarmsViewMode.
 * When the sidebar mode changes, it syncs to AlertsViewModel which handles
 * data loading and persistence.
 *
 * Wraps content in pull-to-refresh calling viewModel.refresh().
 * Passes onNavigateToEditor through to all child composables.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AlertsViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null,
    settingsRepository: SettingsRepository? = null,
    sidebarStateViewModel: SidebarStateViewModel? = null
) {
    val selectedMode by viewModel.selectedMode.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    // Sync sidebar mode changes to AlertsViewModel
    val sidebarState = sidebarStateViewModel?.state?.collectAsState()
    val sidebarAlarmsMode = sidebarState?.value?.alarmsViewMode
    LaunchedEffect(sidebarAlarmsMode) {
        if (sidebarAlarmsMode != null && sidebarAlarmsMode != selectedMode) {
            viewModel.setMode(sidebarAlarmsMode)
        }
    }

    // Pull-to-refresh state
    val pullToRefreshState = rememberPullToRefreshState()

    if (pullToRefreshState.isRefreshing) {
        LaunchedEffect(true) {
            viewModel.refresh()
            pullToRefreshState.endRefresh()
        }
    }

    // End the pull-to-refresh indicator when ViewModel finishes refreshing
    LaunchedEffect(isRefreshing) {
        if (!isRefreshing && pullToRefreshState.isRefreshing) {
            pullToRefreshState.endRefresh()
        }
    }

    // ─── Content Area with Pull-to-Refresh ──────────────────────────────
    Box(
        modifier = modifier
            .fillMaxSize()
            .nestedScroll(pullToRefreshState.nestedScrollConnection)
    ) {
        // Crossfade between modes with 300ms animation
        Crossfade(
            targetState = selectedMode,
            animationSpec = tween(durationMillis = 300),
            label = "alerts_mode_crossfade"
        ) { mode ->
            when (mode) {
                "list" -> ChitAlertsListView(
                    viewModel = viewModel,
                    onNavigateToEditor = onNavigateToEditor,
                    filterSortViewModel = filterSortViewModel,
                    chitRepository = chitRepository
                )
                "independent" -> IndependentAlertsBoard(
                    viewModel = viewModel,
                    modifier = Modifier.fillMaxSize()
                )
                "notifications" -> NotificationsView(
                    viewModel = viewModel,
                    onNavigateToEditor = onNavigateToEditor
                )
                "reminders" -> {
                    if (settingsRepository != null) {
                        RemindersView(
                            viewModel = viewModel,
                            onNavigateToEditor = onNavigateToEditor,
                            settingsRepository = settingsRepository
                        )
                    } else {
                        // Fallback: render without settings (shouldn't happen in practice)
                        Box(modifier = Modifier.fillMaxSize())
                    }
                }
            }
        }

        // Pull-to-refresh indicator overlay
        PullToRefreshContainer(
            state = pullToRefreshState,
            modifier = Modifier.align(Alignment.TopCenter)
        )
    }
}
