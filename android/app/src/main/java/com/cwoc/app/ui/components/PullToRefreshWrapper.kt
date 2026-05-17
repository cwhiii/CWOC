package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll

/**
 * Pull-to-refresh wrapper composable.
 * Wraps any list content and triggers a sync pull on pull-down gesture.
 *
 * @param onRefresh Suspend function to call when refresh is triggered (typically SyncEngine.performSync)
 * @param modifier Modifier for the container
 * @param content The list content to wrap
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PullToRefreshListScreen(
    onRefresh: suspend () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val state = rememberPullToRefreshState()

    if (state.isRefreshing) {
        LaunchedEffect(true) {
            try {
                onRefresh()
            } finally {
                state.endRefresh()
            }
        }
    }

    Box(
        modifier = modifier.nestedScroll(state.nestedScrollConnection)
    ) {
        content()

        PullToRefreshContainer(
            state = state,
            modifier = Modifier.align(Alignment.TopCenter)
        )
    }
}
