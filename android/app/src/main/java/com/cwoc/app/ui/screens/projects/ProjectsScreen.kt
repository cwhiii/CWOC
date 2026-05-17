package com.cwoc.app.ui.screens.projects

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Projects/Kanban view — displays project master chits with expandable Kanban boards.
 */
@Composable
fun ProjectsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProjectsViewModel = hiltViewModel()
) {
    val projects by viewModel.projects.collectAsState()
    val expandedIds by viewModel.expandedProjects.collectAsState()

    if (projects.isEmpty()) {
        EmptyProjectsState(modifier)
    } else {
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            items(projects, key = { it.project.id }) { projectWithChildren ->
                ProjectCard(
                    project = projectWithChildren,
                    isExpanded = projectWithChildren.project.id in expandedIds,
                    onToggleExpand = { viewModel.toggleExpanded(projectWithChildren.project.id) },
                    onChildTap = { chitId -> onNavigateToEditor(chitId) }
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun ProjectCard(
    project: ProjectWithChildren,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onChildTap: (String) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Project header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = project.project.title ?: "Untitled Project",
                    style = MaterialTheme.typography.titleSmall,
                    color = Color(0xFF6B4E31),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = Color(0xFF6B4E31)
                )
            }

            // Kanban board (expanded)
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                KanbanBoard(
                    columns = project.children,
                    onChildTap = onChildTap
                )
            }
        }
    }
}

@Composable
private fun KanbanBoard(
    columns: Map<KanbanStatus, List<ChitEntity>>,
    onChildTap: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        KanbanStatus.entries.forEach { status ->
            val chits = columns[status] ?: emptyList()
            KanbanColumnView(
                status = status,
                chits = chits,
                onChildTap = onChildTap
            )
        }
    }
}

@Composable
private fun KanbanColumnView(
    status: KanbanStatus,
    chits: List<ChitEntity>,
    onChildTap: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFEDE0D0))
            .padding(8.dp)
    ) {
        // Column header with count badge
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = status.displayName,
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6B4E31),
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.width(4.dp))
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF6B4E31)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${chits.size}",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Child chit cards
        chits.forEach { chit ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp)
                    .clickable { onChildTap(chit.id) },
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFAF0))
            ) {
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF1A1208),
                    modifier = Modifier.padding(6.dp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        if (chits.isEmpty()) {
            Text(
                text = "—",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFAA9977),
                modifier = Modifier.padding(4.dp)
            )
        }
    }
}

@Composable
private fun EmptyProjectsState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No projects yet",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Create a project chit with child chits to see them here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
