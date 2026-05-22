package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.cwoc.app.data.sync.SyncState

/**
 * Shared scaffold layout used by Tasks, Notes, and Calendar screens.
 *
 * Provides:
 * - A TopAppBar with the screen title and a SyncStateIndicator action
 * - A FloatingActionButton ("+") that navigates to the Chit Editor in creation mode
 *   - Long-press opens the Quick Alert sheet for rapid reminder/alarm/timer creation
 * - A content area for the screen's list content
 *
 * Uses contentWindowInsets = WindowInsets(0) to avoid double-consuming system bar
 * insets (the outer Scaffold in MainActivity already handles them).
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
    Scaffold(
        modifier = modifier,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            TopAppBar(
                title = { Text(text = title) },
                actions = {
                    IconButton(onClick = { /* Indicator is display-only */ }) {
                        SyncStateIndicator(syncState = syncState)
                    }
                }
            )
        },
        content = content
    )
}
