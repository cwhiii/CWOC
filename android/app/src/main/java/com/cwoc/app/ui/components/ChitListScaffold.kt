package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.sync.SyncState

/**
 * Shared scaffold layout used by Tasks, Notes, and Notebook screens.
 *
 * Previously rendered its own TopAppBar with the view title, but that created
 * a redundant title block below the main header. Now simply passes content
 * through with zero padding — the main activity header already shows the
 * current view name via the Views button.
 *
 * The FAB is handled by the outer Scaffold in MainActivity.
 *
 * Validates: Requirements 2.1, 11.1
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChitListScaffold(
    title: String,
    syncState: SyncState,
    onFabClick: () -> Unit,
    modifier: Modifier = Modifier,
    onFabLongPress: (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    // No TopAppBar — the main activity header already shows the view name.
    // Just pass content through with zero padding (FAB is handled by the outer Scaffold).
    content(PaddingValues(0.dp))
}
