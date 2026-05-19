package com.cwoc.app.ui.screens.help

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.ui.components.MarkdownRenderer

/**
 * Help screen with two states: topic list view and topic detail view.
 * Topic list shows a scrollable list of clickable cards.
 * Topic detail shows a TopAppBar with back arrow + title, and body rendered with MarkdownRenderer.
 * BackHandler navigates from detail back to list before exiting the screen.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HelpScreen(
    onNavigateBack: () -> Unit,
    viewModel: HelpViewModel = hiltViewModel()
) {
    val topics by viewModel.topics.collectAsState()
    val selectedTopic by viewModel.selectedTopic.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    // BackHandler: if viewing a topic detail, go back to list; otherwise exit screen
    BackHandler(enabled = true) {
        if (selectedTopic != null) {
            viewModel.goBack()
        } else {
            onNavigateBack()
        }
    }

    val currentTopic = selectedTopic

    if (currentTopic != null) {
        // ─── Topic Detail View ──────────────────────────────────────────────
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = currentTopic.title,
                            maxLines = 1
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { viewModel.goBack() }) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back to topics"
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                MarkdownRenderer(
                    markdown = currentTopic.content,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    } else {
        // ─── Topic List View ────────────────────────────────────────────────
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Help") },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back"
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            }
        ) { paddingValues ->
            when {
                isLoading -> {
                    HelpLoadingState()
                }
                topics.isEmpty() -> {
                    HelpErrorState()
                }
                else -> {
                    val filteredTopics = if (searchQuery.isBlank()) topics
                        else topics.filter { topic ->
                            topic.title.contains(searchQuery, ignoreCase = true) ||
                            topic.content.contains(searchQuery, ignoreCase = true)
                        }
                    HelpTopicList(
                        topics = filteredTopics,
                        searchQuery = searchQuery,
                        onSearchChange = { searchQuery = it },
                        onTopicClick = { slug -> viewModel.selectTopic(slug) },
                        modifier = Modifier.padding(paddingValues)
                    )
                }
            }
        }
    }
}

// ─── Topic List ─────────────────────────────────────────────────────────────────

@Composable
private fun HelpTopicList(
    topics: List<HelpTopic>,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onTopicClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Spacer(modifier = Modifier.height(8.dp))
            // Search bar matching web's help-search-bar
            androidx.compose.material3.OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchChange,
                placeholder = { Text("Search help topics...") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        if (topics.isEmpty() && searchQuery.isNotBlank()) {
            item {
                Text(
                    text = "No topics match \"$searchQuery\"",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 16.dp)
                )
            }
        }

        items(topics, key = { it.slug }) { topic ->
            HelpTopicCard(
                topic = topic,
                onClick = { onTopicClick(topic.slug) }
            )
        }

        item { Spacer(modifier = Modifier.height(8.dp)) }
    }
}

@Composable
private fun HelpTopicCard(
    topic: HelpTopic,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Text(
            text = topic.title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(16.dp)
        )
    }
}

// ─── Loading State ──────────────────────────────────────────────────────────────

@Composable
private fun HelpLoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
            color = MaterialTheme.colorScheme.primary
        )
    }
}

// ─── Error State ────────────────────────────────────────────────────────────────

@Composable
private fun HelpErrorState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Unable to load help",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Check your connection and try again",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
