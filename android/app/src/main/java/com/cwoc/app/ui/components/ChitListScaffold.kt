package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
 * - A content area for the screen's list content
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
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        modifier = modifier,
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
        floatingActionButton = {
            FloatingActionButton(
                onClick = onFabClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Create new chit"
                )
            }
        },
        content = content
    )
}
