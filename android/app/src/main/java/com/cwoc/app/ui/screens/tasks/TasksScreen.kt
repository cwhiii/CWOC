package com.cwoc.app.ui.screens.tasks

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.util.DateUtils

/**
 * Tasks screen displaying chits grouped by status (ToDo, In Progress, Blocked, Complete).
 */
@Composable
fun TasksScreen(
    viewModel: TasksViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    when {
        uiState.isLoading -> {
            TasksLoadingSkeleton()
        }
        uiState.tasks.isEmpty() -> {
            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                TasksEmptyState()
            }
        }
        else -> {
            TasksList(groupedTasks = uiState.groupedTasks)
        }
    }
}

@Composable
private fun TasksList(groupedTasks: Map<String, List<ChitEntity>>) {
    val statusOrder = listOf("ToDo", "In Progress", "Blocked", "Complete")

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        statusOrder.forEach { status ->
            val tasks = groupedTasks[status]
            if (!tasks.isNullOrEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = statusColor(status),
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                items(tasks, key = { it.id }) { task ->
                    TaskCard(task = task)
                }
            }
        }

        // Show any tasks with unexpected status values
        groupedTasks.forEach { (status, tasks) ->
            if (status !in statusOrder) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                items(tasks, key = { it.id }) { task ->
                    TaskCard(task = task)
                }
            }
        }
    }
}

@Composable
private fun TaskCard(task: ChitEntity) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = task.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (task.priority != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    PriorityBadge(priority = task.priority)
                }
            }

            if (task.dueDatetime != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Due: ${DateUtils.formatDisplayDate(task.dueDatetime)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
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

@Composable
private fun TasksLoadingSkeleton() {
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

@Composable
private fun TasksEmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No Tasks",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Tasks will appear here after syncing",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
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
