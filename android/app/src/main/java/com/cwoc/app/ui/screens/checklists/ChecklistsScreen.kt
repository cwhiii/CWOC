package com.cwoc.app.ui.screens.checklists

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.domain.checklist.ChecklistItem
import com.cwoc.app.domain.checklist.ChecklistOperations

/**
 * Checklists view — displays all chits with checklist data.
 * Each chit is shown as a card with its nested checklist items.
 * Tap an item to toggle its checked state.
 */
@Composable
fun ChecklistsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ChecklistsViewModel = hiltViewModel()
) {
    val chits by viewModel.checklistChits.collectAsState()

    if (chits.isEmpty()) {
        EmptyChecklistsState(modifier)
    } else {
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            items(chits, key = { it.id }) { chit ->
                ChecklistChitCard(
                    chit = chit,
                    onToggleItem = { index -> viewModel.toggleItem(chit.id, index) },
                    onCardTap = { onNavigateToEditor(chit.id) }
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun ChecklistChitCard(
    chit: ChitEntity,
    onToggleItem: (Int) -> Unit,
    onCardTap: () -> Unit
) {
    val items = ChecklistOperations.parseChecklist(chit.checklist)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFF5E6D3)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Chit title — tap to open editor
            Text(
                text = chit.title ?: "Untitled",
                style = MaterialTheme.typography.titleSmall,
                color = Color(0xFF6B4E31),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onCardTap() }
                    .padding(bottom = 8.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            // Checklist items
            items.forEachIndexed { index, item ->
                ChecklistItemRow(
                    item = item,
                    onToggle = { onToggleItem(index) }
                )
            }
        }
    }
}

@Composable
private fun ChecklistItemRow(
    item: ChecklistItem,
    onToggle: () -> Unit
) {
    val indentDp = ChecklistOperations.indentationDp(item.indent)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = indentDp.dp)
            .clickable { onToggle() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = item.checked,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(
                checkedColor = Color(0xFF6B4E31),
                uncheckedColor = Color(0xFF8B7355)
            )
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = item.text,
            style = MaterialTheme.typography.bodyMedium,
            textDecoration = if (item.checked) TextDecoration.LineThrough else TextDecoration.None,
            color = if (item.checked) Color(0xFF8B7355) else Color(0xFF1A1208),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun EmptyChecklistsState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No checklists yet",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Create a chit with checklist items to see them here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
