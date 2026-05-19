package com.cwoc.app.ui.screens.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle

/** System tags that should not be displayed in search result cards. */
private val SEARCH_SYSTEM_TAGS = setOf(
    "Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"
)

/**
 * Search screen with auto-focused search field in the TopAppBar,
 * results displayed as chit cards with highlighted matching terms,
 * and a back button to return to the previous screen.
 *
 * Validates: Requirements 8.1, 8.6, 8.7
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    onNavigateBack: () -> Unit,
    onNavigateToEditor: (String) -> Unit,
    viewModel: SearchViewModel = hiltViewModel()
) {
    val query by viewModel.query.collectAsState()
    val results by viewModel.results.collectAsState()
    val focusRequester = remember { FocusRequester() }

    // Auto-focus the search field when the screen opens
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TextField(
                        value = query,
                        onValueChange = { viewModel.onQueryChange(it) },
                        placeholder = {
                            Text(
                                text = "Search chits...",
                                style = MaterialTheme.typography.bodyLarge
                            )
                        },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent
                        ),
                        textStyle = MaterialTheme.typography.bodyLarge
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        when {
            query.isBlank() -> {
                // Initial state — show search hints
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(horizontal = 16.dp, vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Search by title, notes, tags, people, location, or email",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    // Search operators hint
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "Search Tips",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF6B4E31)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Operators: && (AND) · || (OR) · ! (NOT)\n" +
                                    "#tag — filter by tag\n" +
                                    "field::value — search specific field\n\n" +
                                    "Fields: title, note, location, status, priority,\n" +
                                    "people, checklist, subject, from, to, cc, bcc,\n" +
                                    "body, due, start, end, assigned",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF4A3520),
                                lineHeight = 18.sp
                            )
                        }
                    }
                }
            }
            results.isEmpty() -> {
                // Query entered but no results
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No results",
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            else -> {
                // Display results with filter row
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Filter chips row
                    val statusFilter by viewModel.statusFilter.collectAsState()
                    val priorityFilter by viewModel.priorityFilter.collectAsState()
                    val emailFilter by viewModel.emailFilter.collectAsState()

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // Status filter chip
                        var showStatusMenu by remember { mutableStateOf(false) }
                        Box {
                            FilterChip(
                                selected = statusFilter.isNotBlank(),
                                onClick = { showStatusMenu = true },
                                label = { Text(if (statusFilter.isBlank()) "Status" else statusFilter, fontSize = 12.sp) }
                            )
                            DropdownMenu(expanded = showStatusMenu, onDismissRequest = { showStatusMenu = false }) {
                                DropdownMenuItem(text = { Text("Any") }, onClick = { viewModel.setStatusFilter(""); showStatusMenu = false })
                                listOf("ToDo", "In Progress", "Blocked", "Complete").forEach { s ->
                                    DropdownMenuItem(text = { Text(s) }, onClick = { viewModel.setStatusFilter(s); showStatusMenu = false })
                                }
                            }
                        }

                        // Priority filter chip
                        var showPriorityMenu by remember { mutableStateOf(false) }
                        Box {
                            FilterChip(
                                selected = priorityFilter.isNotBlank(),
                                onClick = { showPriorityMenu = true },
                                label = { Text(if (priorityFilter.isBlank()) "Priority" else priorityFilter, fontSize = 12.sp) }
                            )
                            DropdownMenu(expanded = showPriorityMenu, onDismissRequest = { showPriorityMenu = false }) {
                                DropdownMenuItem(text = { Text("Any") }, onClick = { viewModel.setPriorityFilter(""); showPriorityMenu = false })
                                listOf("Critical", "High", "Medium", "Low").forEach { p ->
                                    DropdownMenuItem(text = { Text(p) }, onClick = { viewModel.setPriorityFilter(p); showPriorityMenu = false })
                                }
                            }
                        }

                        // Email filter chip
                        var showEmailMenu by remember { mutableStateOf(false) }
                        Box {
                            FilterChip(
                                selected = emailFilter != "no_email",
                                onClick = { showEmailMenu = true },
                                label = { Text(when (emailFilter) { "all" -> "All"; "only_email" -> "Emails Only"; else -> "No Email" }, fontSize = 12.sp) }
                            )
                            DropdownMenu(expanded = showEmailMenu, onDismissRequest = { showEmailMenu = false }) {
                                DropdownMenuItem(text = { Text("Exclude Emails") }, onClick = { viewModel.setEmailFilter("no_email"); showEmailMenu = false })
                                DropdownMenuItem(text = { Text("All") }, onClick = { viewModel.setEmailFilter("all"); showEmailMenu = false })
                                DropdownMenuItem(text = { Text("Only Emails") }, onClick = { viewModel.setEmailFilter("only_email"); showEmailMenu = false })
                            }
                        }
                    }

                    // Results count
                    Text(
                        text = "${results.size} result${if (results.size != 1) "s" else ""}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                    )

                    // Results list
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(4.dp)) }
                        items(results, key = { it.chitId }) { result ->
                            SearchResultCard(
                                result = result,
                                onClick = { onNavigateToEditor(result.chitId) }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                    }
                }
            }
        }
    }
}

/**
 * A card displaying a single search result with highlighted matching terms.
 */
@Composable
private fun SearchResultCard(
    result: SearchResult,
    onClick: () -> Unit
) {
    val chit = result.chit

    // Full background color matching web's applyChitColors(card, chitColor(chit))
    val cardBgColor = remember(chit.color) { CwocChitCardStyle.resolveChitBgColor(chit.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = cardBgColor
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Title with highlights
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val titleText = chit.title ?: "Untitled"
                val titleRanges = result.highlightRanges["title"].orEmpty()

                Text(
                    text = buildHighlightedText(titleText, titleRanges),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = cardTextColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (chit.priority != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    PriorityBadge(priority = chit.priority)
                }
            }

            // Note snippet with highlights (show first 100 chars)
            if (chit.note != null && chit.note.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                val noteSnippet = chit.note.take(100).let {
                    if (chit.note.length > 100) "$it..." else it
                }
                val noteRanges = result.highlightRanges["note"].orEmpty()
                    .filter { it.first < noteSnippet.length }
                    .map { IntRange(it.first, minOf(it.last, noteSnippet.length - 1)) }

                Text(
                    text = buildHighlightedText(noteSnippet, noteRanges),
                    style = MaterialTheme.typography.bodySmall,
                    color = cardTextColor.copy(alpha = 0.7f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Status and tags row
            val userTags = chit.tags?.filter { tag ->
                tag !in SEARCH_SYSTEM_TAGS &&
                    !tag.startsWith("CWOC_System/", ignoreCase = true)
            }
            if (chit.status != null || !userTags.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (chit.status != null) {
                        Text(
                            text = chit.status,
                            style = MaterialTheme.typography.labelSmall,
                            color = statusColor(chit.status)
                        )
                    }
                    if (!userTags.isNullOrEmpty()) {
                        Text(
                            text = userTags.joinToString(", ") { "#$it" },
                            style = MaterialTheme.typography.labelSmall,
                            color = cardTextColor.copy(alpha = 0.7f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Matched fields indicator
            if (result.matchedFields.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Matched: ${result.matchedFields.joinToString(", ")}",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.6f)
                )
            }
        }
    }
}

/**
 * Builds an AnnotatedString with yellow background highlights at the specified ranges.
 */
@Composable
private fun buildHighlightedText(
    text: String,
    highlightRanges: List<IntRange>
) = buildAnnotatedString {
    if (highlightRanges.isEmpty()) {
        append(text)
        return@buildAnnotatedString
    }

    var currentIndex = 0
    val sortedRanges = highlightRanges
        .filter { it.first >= 0 && it.last < text.length && it.first <= it.last }
        .sortedBy { it.first }

    for (range in sortedRanges) {
        // Append text before this highlight
        if (currentIndex < range.first) {
            append(text.substring(currentIndex, range.first))
        }
        // Append highlighted text
        withStyle(SpanStyle(background = Color.Yellow)) {
            append(text.substring(range.first, range.last + 1))
        }
        currentIndex = range.last + 1
    }
    // Append remaining text after last highlight
    if (currentIndex < text.length) {
        append(text.substring(currentIndex))
    }
}

@Composable
private fun PriorityBadge(priority: String) {
    val color = when (priority) {
        "Critical" -> Color(0xFFB22222)
        "High" -> Color(0xFFD2691E)
        "Medium" -> Color(0xFF8B6914)
        "Low" -> Color(0xFF4A6741)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Text(
        text = priority,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        fontWeight = FontWeight.Bold
    )
}

private fun statusColor(status: String): Color {
    return when (status) {
        "ToDo" -> Color(0xFF6B4E31)
        "In Progress" -> Color(0xFF1565C0)
        "Blocked" -> Color(0xFFB22222)
        "Complete" -> Color(0xFF4A6741)
        else -> Color(0xFF5C4A3A)
    }
}
