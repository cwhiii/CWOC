package com.cwoc.app.ui.screens.weather

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import com.cwoc.app.ui.components.CwocPagePanel
import com.cwoc.app.ui.theme.CwocButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Weather screen displaying forecasts for all saved locations as a horizontal scrollable table.
 * TopAppBar with "Weather" title and back navigation.
 * Period filter chip row with prev/next navigation and date range label.
 * Horizontal table with date columns and location rows, each showing weather icon, temps, precip.
 * Supports drag-to-reorder location rows, day block tap navigation, and event highlighting.
 * Loading spinner and error state with retry button.
 * Pull-to-refresh support.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.1, 12.2, 12.3, 12.4, 12.5
 */

private val ParchmentBrown = Color(0xFF6B4E31)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeatherScreen(
    onNavigateBack: () -> Unit,
    onNavigateToCalendarDate: (String) -> Unit = {},
    viewModel: WeatherViewModel = hiltViewModel()
) {
    val forecasts by viewModel.forecasts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val period by viewModel.period.collectAsState()
    val periodOffset by viewModel.periodOffset.collectAsState()
    val periodLabel by viewModel.periodLabel.collectAsState()
    val tempUnit by viewModel.tempUnit.collectAsState()
    val precipUnit by viewModel.precipUnit.collectAsState()
    val weekStartDay by viewModel.weekStartDay.collectAsState()
    val rowOrder by viewModel.rowOrder.collectAsState()
    val chits by viewModel.chits.collectAsState()
    val cityForecasts by viewModel.cityForecasts.collectAsState()

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Weather") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    com.cwoc.app.ui.components.TopBarProfileAvatar()
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        CwocPagePanel(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(8.dp)
        ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // ─── Period Filter Chip Row ──────────────────────────────────────────
            WeatherPeriodFilter(
                period = period,
                periodLabel = periodLabel,
                onPeriodSelected = { viewModel.setPeriod(it) },
                onPrevPeriod = { viewModel.prevPeriod() },
                onNextPeriod = { viewModel.nextPeriod() }
            )

            // ─── Main Content ───────────────────────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxSize()
                .nestedScroll(pullToRefreshState.nestedScrollConnection)
        ) {
            when {
                isLoading -> {
                    WeatherLoadingState()
                }
                error != null -> {
                    WeatherErrorState(
                        errorMessage = error!!,
                        onRetry = { viewModel.refresh() }
                    )
                }
                forecasts.isEmpty() -> {
                    WeatherEmptyState()
                }
                else -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                    ) {
                        WeatherHorizontalTable(
                            forecasts = forecasts,
                            cityForecasts = cityForecasts,
                            chits = chits,
                            period = period,
                            periodOffset = periodOffset,
                            weekStartDay = weekStartDay,
                            tempUnit = tempUnit,
                            precipUnit = precipUnit,
                            rowOrder = rowOrder,
                            onDayClick = { dateStr -> onNavigateToCalendarDate(dateStr) },
                            onReorder = { from, to -> viewModel.reorderRows(from, to) }
                        )
                    }
                }
            }

            PullToRefreshContainer(
                state = pullToRefreshState,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
        } // end Column
        }
    }
}

// ─── Period Filter Chip Row ─────────────────────────────────────────────────────

/**
 * Period filter chip row with prev/next navigation arrows and date range label.
 * Matches the MapScreen's period filter pattern with ParchmentBrown selected color.
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */
@Composable
private fun WeatherPeriodFilter(
    period: WeatherPeriod,
    periodLabel: String,
    onPeriodSelected: (WeatherPeriod) -> Unit,
    onPrevPeriod: () -> Unit,
    onNextPeriod: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // Period chips + prev/next navigation
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Prev button (not shown for FORECAST_MAX or ONE_HOUR which don't support offset navigation)
            if (period != WeatherPeriod.FORECAST_MAX && period != WeatherPeriod.ONE_HOUR) {
                IconButton(onClick = onPrevPeriod, modifier = Modifier.size(32.dp)) {
                    Text("◀", style = MaterialTheme.typography.bodyMedium)
                }
            }

            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                WeatherPeriod.entries.forEach { p ->
                    FilterChip(
                        selected = period == p,
                        onClick = { onPeriodSelected(p) },
                        label = { Text(p.label, style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ParchmentBrown,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            // Next button (not shown for FORECAST_MAX or ONE_HOUR which don't support offset navigation)
            if (period != WeatherPeriod.FORECAST_MAX && period != WeatherPeriod.ONE_HOUR) {
                IconButton(onClick = onNextPeriod, modifier = Modifier.size(32.dp)) {
                    Text("▶", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // Period date range label
        if (period != WeatherPeriod.FORECAST_MAX) {
            Text(
                text = periodLabel,
                style = MaterialTheme.typography.labelSmall,
                color = ParchmentBrown,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
            )
        }
    }
}

@Composable
private fun WeatherLoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun WeatherErrorState(
    errorMessage: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Unable to load weather",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 32.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRetry, colors = CwocButtonDefaults.outsetColors(), border = CwocButtonDefaults.outsetBorder, shape = CwocButtonDefaults.outsetShape) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun WeatherEmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No weather data",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Add saved locations to see forecasts",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
