package com.cwoc.app.ui.screens.alerts

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.ui.viewmodel.FilterSortViewModel

/**
 * Alerts screen — displays four modes via FilterChip toggle row:
 * "📋 Chits", "🛎️ Independent", "🔔 Notifs", "📢 Reminders"
 *
 * Persists selected mode to SharedPreferences via AlertsViewModel.
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
    settingsRepository: SettingsRepository? = null
) {
    val selectedMode by viewModel.selectedMode.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    // Pull-to-refresh state
    val pullToRefreshState = rememberPullToRefreshState()

    if (pullToRefreshState.isRefreshing) {
        LaunchedEffect(true) {
            viewModel.refresh()
        }
    }

    // End the pull-to-refresh indicator when ViewModel finishes refreshing
    LaunchedEffect(isRefreshing) {
        if (!isRefreshing && pullToRefreshState.isRefreshing) {
            pullToRefreshState.endRefresh()
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        // ─── Mode Toggle Row ────────────────────────────────────────────────
        ModeToggleRow(
            selectedMode = selectedMode,
            onModeSelected = { viewModel.setMode(it) }
        )

        // ─── Content Area with Pull-to-Refresh ──────────────────────────────
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
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
}

/**
 * Horizontal row of four FilterChips for mode selection.
 * Scrollable if content overflows on narrow screens.
 * Exactly one chip is selected at all times.
 */
@Composable
private fun ModeToggleRow(
    selectedMode: String,
    onModeSelected: (String) -> Unit
) {
    val modes = listOf(
        "list" to "📋 Chits",
        "independent" to "🛎️ Independent",
        "notifications" to "🔔 Notifs",
        "reminders" to "📢 Reminders"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        modes.forEach { (modeValue, label) ->
            FilterChip(
                selected = selectedMode == modeValue,
                onClick = { onModeSelected(modeValue) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Color(0xFF6B4E31),
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}
