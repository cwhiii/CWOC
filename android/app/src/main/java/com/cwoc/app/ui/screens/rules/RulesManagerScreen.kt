package com.cwoc.app.ui.screens.rules

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RulesManagerScreen(
    onNavigateBack: () -> Unit,
    onNavigateToEditor: (ruleId: String) -> Unit,
    viewModel: RulesManagerViewModel = hiltViewModel()
) {
    val rules by viewModel.rules.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()
    val confirmations by viewModel.confirmations.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    var showDeleteConfirm by remember { mutableStateOf<RuleItem?>(null) }

    // Show snackbar for action messages
    LaunchedEffect(actionMessage) {
        actionMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearActionMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rules Manager") },
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
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToEditor("new") },
                containerColor = ParchmentBrown,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "New Rule")
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                isLoading -> LoadingState()
                error != null -> ErrorState(
                    message = error!!,
                    onRetry = { viewModel.loadRules() }
                )
                rules.isEmpty() -> EmptyState()
                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Pending confirmations section
                        if (confirmations.isNotEmpty()) {
                            item {
                                Text(
                                    text = "⚠️ Pending Confirmations (${confirmations.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFE65100),
                                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                )
                            }
                            items(confirmations, key = { it.id }) { confirmation ->
                                ConfirmationCard(
                                    confirmation = confirmation,
                                    onAccept = { viewModel.acceptConfirmation(confirmation.id) },
                                    onDismiss = { viewModel.dismissConfirmation(confirmation.id) }
                                )
                            }
                            item {
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }

                        item { Spacer(modifier = Modifier.height(4.dp)) }
                        items(rules, key = { it.id }) { rule ->
                            RuleCard(
                                rule = rule,
                                onToggle = { viewModel.toggleRule(rule.id) },
                                onClick = { onNavigateToEditor(rule.id) },
                                onDelete = { showDeleteConfirm = rule }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(80.dp)) }
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    showDeleteConfirm?.let { rule ->
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            title = { Text("Delete Rule") },
            text = { Text("Delete rule \"${rule.name}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteRule(rule.id)
                    showDeleteConfirm = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ─── Rule Card ──────────────────────────────────────────────────────────────────

@Composable
private fun RuleCard(
    rule: RuleItem,
    onToggle: () -> Unit,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = rule.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = ParchmentText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    // Bundle badge
                    if (rule.name.startsWith("Bundle: ")) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("📦", style = MaterialTheme.typography.bodySmall)
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                // Trigger + Priority row
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = getTriggerSummary(rule),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    rule.priority?.let { p ->
                        Text(
                            text = "P$p",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = ParchmentBrown
                        )
                    }
                }
                // Last run + run count
                if (rule.lastRunDatetime != null || (rule.runCount ?: 0) > 0) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        rule.lastRunDatetime?.let { dt ->
                            Text(
                                text = "Last: ${dt.take(16).replace("T", " ")}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if ((rule.runCount ?: 0) > 0) {
                            Text(
                                text = "Runs: ${rule.runCount}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            // Delete button
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Text("🗑️", style = MaterialTheme.typography.bodyMedium)
            }
            Switch(
                checked = rule.enabled,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = ParchmentBrown
                )
            )
        }
    }
}

// ─── Helper ─────────────────────────────────────────────────────────────────────

private fun getTriggerSummary(rule: RuleItem): String {
    return when (rule.triggerType) {
        "cron" -> {
            val cron = rule.triggerConfig?.get("cron") as? String
            if (cron != null) "Cron: $cron" else "Scheduled"
        }
        "event" -> {
            val eventType = rule.triggerConfig?.get("event_type") as? String
            if (eventType != null) "Event: $eventType" else "Event-triggered"
        }
        "chit_created" -> "Chit Created"
        "chit_updated" -> "Chit Updated"
        "email_received" -> "Email Received"
        "contact_created" -> "Contact Created"
        "contact_updated" -> "Contact Updated"
        "scheduled" -> "Scheduled"
        "manual" -> "Manual trigger"
        else -> rule.triggerType ?: "No trigger"
    }
}

// ─── Confirmation Card ──────────────────────────────────────────────────────────

@Composable
private fun ConfirmationCard(
    confirmation: RuleConfirmation,
    onAccept: () -> Unit,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFF3E0) // Light orange background
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "🤖 ${confirmation.ruleName}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = ParchmentText
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = confirmation.actionDescription,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onAccept,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32))
                ) {
                    Text("✅ Accept")
                }
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828))
                ) {
                    Text("❌ Dismiss")
                }
            }
        }
    }
}

// ─── State Composables ──────────────────────────────────────────────────────────

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = ParchmentBrown)
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No rules found",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Create a new rule with the + button",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
