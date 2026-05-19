package com.cwoc.app.ui.screens.email

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.domain.email.DateGroup
import com.cwoc.app.ui.components.UndoToast

/**
 * Email client screen — displays email inbox with folder navigation, threading,
 * bundle toolbar, account filter pills, date group headers, pagination,
 * check mail with sync animation, unread-at-top toggle, and undo toast.
 *
 * This is the main integration composable that wires together all email list
 * view components created in tasks 7.1-7.10.
 *
 * Validates: Requirements 13.1-13.6, 14.1-14.6, 15.1-15.3, 16.1-16.3,
 *            32.1-32.6, 34.1-34.3, 35.1-35.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailScreen(
    onNavigateToEditor: (String) -> Unit = {},
    onNavigateToEmailSettings: () -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: EmailViewModel = hiltViewModel(),
    bundleViewModel: BundleViewModel = hiltViewModel(),
    sidebarStateViewModel: com.cwoc.app.ui.viewmodel.SidebarStateViewModel? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val senderImageUrls by viewModel.senderImageUrls.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Get serverUrl and authToken from SharedPreferences for contact avatar loading
    val context = androidx.compose.ui.platform.LocalContext.current
    val prefs = remember { context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE) }
    val serverUrl = remember { prefs.getString("server_url", "") ?: "" }
    val authToken = remember { prefs.getString("auth_token", "") ?: "" }

    // Observe email folder from sidebar state and sync to ViewModel
    val sidebarEmailFolder = sidebarStateViewModel?.state?.collectAsState()?.value?.emailFolder
    androidx.compose.runtime.LaunchedEffect(sidebarEmailFolder) {
        if (sidebarEmailFolder != null && sidebarEmailFolder != uiState.currentFolder) {
            viewModel.setFolder(sidebarEmailFolder)
        }
    }

    // Debug logging
    android.util.Log.d("CWOC_EMAIL", "EmailScreen composing, isLoading=${uiState.isLoading}, threads=${uiState.threads.size}")

    // Context menu state for long-press on email cards
    var contextMenuThreadId by remember { mutableStateOf<String?>(null) }

    // Tag picker modal state
    var showTagPicker by remember { mutableStateOf(false) }

    // Bundle modal state
    var showCreateBundleModal by remember { mutableStateOf(false) }
    var editingBundle by remember { mutableStateOf<BundleDto?>(null) }

    // Bundle picker dialog state (for "Add to Bundle" context menu action)
    var bundlePickerThreadId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        modifier = modifier,
        topBar = {
            // Sticky BundleToolbar with BulkActionsBar (Row 1) and Bundle Tabs (Row 2)
            BundleToolbar(
                bundleViewModel = bundleViewModel,
                currentFolder = uiState.currentFolder,
                isMultiPlacement = false, // Controlled by settings
                isMultiSelectMode = uiState.isMultiSelectMode,
                selectedCount = uiState.selectedIds.size,
                totalCount = uiState.threads.size,
                onSelectAll = { viewModel.selectAll() },
                onDeselectAll = { viewModel.exitMultiSelect() },
                onArchiveSelected = {
                    viewModel.bulkArchive { success, failed ->
                        // Toast handled by ViewModel or could show snackbar
                    }
                },
                onTagSelected = { showTagPicker = true },
                onToggleReadSelected = { viewModel.bulkToggleRead() },
                onDeleteSelected = {
                    viewModel.bulkDelete { success, failed ->
                        // Toast handled by ViewModel or could show snackbar
                    }
                },
                onEditBundle = { bundle -> editingBundle = bundle }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToEditor("new") },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Compose email"
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // ─── Account Filter Pills ────────────────────────────────────
                AccountFilterPills(
                    accounts = uiState.accounts,
                    onToggleAccount = { accountId -> viewModel.toggleAccountFilter(accountId) },
                    onNavigateToEmailSettings = onNavigateToEmailSettings
                )

                // ─── Check Mail Button + Unread-at-Top Toggle Row ────────────
                CheckMailAndToggleRow(
                    isSyncing = uiState.syncingAccounts.isNotEmpty(),
                    unreadAtTop = uiState.unreadAtTop,
                    onCheckMail = { viewModel.triggerSync() },
                    onToggleUnreadAtTop = { viewModel.toggleUnreadAtTop() }
                )

                // ─── Content Area ────────────────────────────────────────────
                when {
                    uiState.isLoading -> {
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
                    uiState.threads.isEmpty() -> {
                        // ─── Empty State with Context ────────────────────────
                        EmptyStateWithContext(
                            currentFolder = uiState.currentFolder,
                            accounts = uiState.accounts
                        )
                    }
                    else -> {
                        // ─── Email Thread List with Date Group Headers ────────
                        EmailListWithDateGroups(
                            threads = uiState.threads,
                            groupByDate = uiState.groupByDate,
                            isMultiSelectMode = uiState.isMultiSelectMode,
                            selectedIds = uiState.selectedIds,
                            paginateEnabled = uiState.paginateEnabled,
                            totalThreadCount = uiState.totalThreadCount,
                            displayedCount = uiState.threads.size,
                            contextMenuThreadId = contextMenuThreadId,
                            senderImageUrls = senderImageUrls,
                            serverUrl = serverUrl,
                            authToken = authToken,
                            onTapThread = { thread ->
                                onNavigateToEditor(thread.latestMessage.id)
                            },
                            onLongPressThread = { thread ->
                                if (!uiState.isMultiSelectMode) {
                                    contextMenuThreadId = thread.id
                                } else {
                                    viewModel.toggleSelection(thread.latestMessage.id)
                                }
                            },
                            onToggleSelection = { thread ->
                                viewModel.toggleSelection(thread.latestMessage.id)
                            },
                            onTogglePin = { thread ->
                                viewModel.togglePin(thread.latestMessage.id)
                            },
                            onArchiveThread = { thread ->
                                viewModel.archiveWithUndo(
                                    thread.latestMessage.id,
                                    thread.subject
                                )
                            },
                            onDeleteThread = { thread ->
                                viewModel.deleteWithUndo(
                                    thread.latestMessage.id,
                                    thread.subject
                                )
                            },
                            onToggleReadThread = { thread ->
                                viewModel.toggleReadState(thread.latestMessage.id)
                            },
                            onAddToBundle = { thread ->
                                bundlePickerThreadId = thread.latestMessage.id
                            },
                            onDismissContextMenu = { contextMenuThreadId = null },
                            onLoadMore = { viewModel.loadMore() },
                            onEnterMultiSelect = { thread ->
                                viewModel.enterMultiSelect(thread.latestMessage.id)
                            }
                        )
                    }
                }
            }

            // ─── Undo Toast Overlay ──────────────────────────────────────────
            val undoAction = uiState.undoAction
            if (undoAction != null) {
                val message = when (undoAction.type) {
                    UndoType.ARCHIVE -> "Archived: ${undoAction.subject}"
                    UndoType.DELETE -> "Deleted: ${undoAction.subject}"
                }
                UndoToast(
                    message = message,
                    onUndo = { viewModel.cancelUndo() },
                    onExpire = { /* Countdown expired — action already executed by ViewModel */ },
                    durationMs = undoAction.durationMs
                )
            }
        }
    }

    // ─── Tag Picker Modal ────────────────────────────────────────────────────
    if (showTagPicker) {
        val tagTree by viewModel.tagTree.collectAsState()
        TagPickerModal(
            emailCount = uiState.selectedIds.size,
            allTags = tagTree,
            initialSelectedTags = emptyList(),
            onApply = { selectedTags ->
                viewModel.bulkApplyTags(selectedTags)
                showTagPicker = false
                viewModel.exitMultiSelect()
            },
            onDismiss = { showTagPicker = false }
        )
    }

    // ─── Create Bundle Modal ─────────────────────────────────────────────────
    if (showCreateBundleModal) {
        CreateBundleModal(
            onDismiss = { showCreateBundleModal = false },
            onDefineRule = { name, description, color, showInOmni ->
                bundleViewModel.createBundle(name, description, color, showInOmni)
                showCreateBundleModal = false
            }
        )
    }

    // ─── Edit Bundle Modal ───────────────────────────────────────────────────
    editingBundle?.let { bundle ->
        EditBundleModal(
            bundle = bundle,
            onDismiss = { editingBundle = null },
            onSave = { name, description, color, showInOmni ->
                bundleViewModel.updateBundle(
                    id = bundle.id,
                    name = name,
                    description = description,
                    color = color,
                    showInOmni = showInOmni
                )
                editingBundle = null
            },
            onDelete = {
                bundleViewModel.deleteBundle(bundle.id)
                editingBundle = null
            },
            onChangeRules = {
                // Navigate to rule editor — for now just dismiss
                editingBundle = null
            }
        )
    }

    // ─── Bundle Picker Dialog (Add to Bundle from context menu) ──────────────
    bundlePickerThreadId?.let { chitId ->
        val bundleState by bundleViewModel.uiState.collectAsState()
        val currentBundleId = viewModel.getCurrentBundleId(chitId, bundleState.bundles)

        BundlePickerDialog(
            bundles = bundleState.bundles,
            currentBundleId = currentBundleId,
            onSelectBundle = { selectedBundleId ->
                val selectedBundle = bundleState.bundles.find { it.id == selectedBundleId }
                if (selectedBundle != null) {
                    viewModel.addEmailToBundle(
                        chitId = chitId,
                        bundleId = selectedBundleId,
                        bundleName = selectedBundle.name ?: "Unnamed"
                    )
                }
                bundlePickerThreadId = null
            },
            onDismiss = { bundlePickerThreadId = null }
        )
    }
}

// ─── Check Mail Button + Unread-at-Top Toggle ────────────────────────────────────

/**
 * Row containing the Check Mail button with sync animation and the
 * Unread-at-top toggle switch.
 *
 * Validates: Requirements 32.1-32.3, 34.1-34.3
 */
@Composable
private fun CheckMailAndToggleRow(
    isSyncing: Boolean,
    unreadAtTop: Boolean,
    onCheckMail: () -> Unit,
    onToggleUnreadAtTop: () -> Unit
) {
    // Sync icon rotation animation
    val rotation by animateFloatAsState(
        targetValue = if (isSyncing) 360f else 0f,
        animationSpec = if (isSyncing) {
            tween(durationMillis = 1000, easing = LinearEasing)
        } else {
            tween(durationMillis = 0)
        },
        label = "syncRotation"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Check Mail button
        TextButton(
            onClick = onCheckMail,
            enabled = !isSyncing
        ) {
            Icon(
                imageVector = Icons.Default.Sync,
                contentDescription = "Check Mail",
                modifier = Modifier
                    .size(18.dp)
                    .then(
                        if (isSyncing) Modifier.rotate(rotation) else Modifier
                    ),
                tint = if (isSyncing) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = if (isSyncing) "Syncing..." else "Check Mail",
                style = MaterialTheme.typography.labelMedium,
                color = if (isSyncing) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }

        // Unread-at-top toggle
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Unread first",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(6.dp))
            Switch(
                checked = unreadAtTop,
                onCheckedChange = { onToggleUnreadAtTop() },
                modifier = Modifier.height(24.dp),
                colors = SwitchDefaults.colors(
                    checkedThumbColor = MaterialTheme.colorScheme.primary,
                    checkedTrackColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }
}

// ─── Empty State with Context ────────────────────────────────────────────────────

/**
 * Informative empty state that reflects the current folder and active account filters.
 * Shows folder name, active account names, and a contextual suggestion.
 *
 * Validates: Requirements 16.1, 16.2, 16.3
 */
@Composable
private fun EmptyStateWithContext(
    currentFolder: String,
    accounts: List<EmailAccountInfo>
) {
    val folderDisplayName = when (currentFolder) {
        "inbox" -> "Inbox"
        "sent" -> "Sent"
        "drafts" -> "Drafts"
        "scheduled" -> "Scheduled"
        "trash" -> "Trash"
        "archived" -> "Archive"
        else -> currentFolder.replaceFirstChar { it.uppercase() }
    }

    // Active account names for context (Req 16.2)
    val activeAccountNames = accounts
        .filter { it.isActive }
        .map { it.nickname }

    val accountContext = if (activeAccountNames.isNotEmpty() && activeAccountNames.size < accounts.size) {
        activeAccountNames.joinToString(", ")
    } else {
        null
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            // Main message (Req 16.1)
            val mainMessage = if (accountContext != null) {
                "No emails in $accountContext $folderDisplayName."
            } else {
                "No emails in $folderDisplayName."
            }

            Text(
                text = mainMessage,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Contextual suggestion (Req 16.3)
            val suggestion = when (currentFolder) {
                "inbox" -> "Tap + to compose a new email"
                "drafts" -> "Your draft emails will appear here"
                "sent" -> "Sent emails will appear here"
                "scheduled" -> "Scheduled emails will appear here"
                "trash" -> "Deleted emails will appear here"
                "archived" -> "Archived emails will appear here"
                else -> "Tap + to compose a new email"
            }

            Text(
                text = suggestion,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center
            )
        }
    }
}

// ─── Email List with Date Group Headers ──────────────────────────────────────────

/**
 * LazyColumn rendering the email list with date group headers, EmailCardEnhanced
 * for each thread, context menus, and a pagination "Load More" button at the bottom.
 *
 * Validates: Requirements 14.1-14.6, 15.1-15.3
 */
@Composable
private fun EmailListWithDateGroups(
    threads: List<EmailThread>,
    groupByDate: Boolean,
    isMultiSelectMode: Boolean,
    selectedIds: Set<String>,
    paginateEnabled: Boolean,
    totalThreadCount: Int,
    displayedCount: Int,
    contextMenuThreadId: String?,
    senderImageUrls: Map<String, String?> = emptyMap(),
    serverUrl: String = "",
    authToken: String = "",
    onTapThread: (EmailThread) -> Unit,
    onLongPressThread: (EmailThread) -> Unit,
    onToggleSelection: (EmailThread) -> Unit,
    onTogglePin: (EmailThread) -> Unit,
    onArchiveThread: (EmailThread) -> Unit,
    onDeleteThread: (EmailThread) -> Unit,
    onToggleReadThread: (EmailThread) -> Unit,
    onAddToBundle: (EmailThread) -> Unit,
    onDismissContextMenu: () -> Unit,
    onLoadMore: () -> Unit,
    onEnterMultiSelect: (EmailThread) -> Unit
) {
    // Group threads by date group if enabled
    val groupedThreads: Map<DateGroup?, List<EmailThread>> = if (groupByDate) {
        threads.groupBy { it.dateGroup }
    } else {
        mapOf(null to threads)
    }

    // Ordered date groups
    val orderedGroups = if (groupByDate) {
        listOf(DateGroup.TODAY, DateGroup.YESTERDAY, DateGroup.LAST_WEEK, DateGroup.OLDER)
            .filter { group -> groupedThreads.containsKey(group) }
    } else {
        listOf(null)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        orderedGroups.forEach { dateGroup ->
            val groupThreads = groupedThreads[dateGroup] ?: return@forEach

            // Date group header (Req 14.1-14.5)
            if (dateGroup != null && groupByDate) {
                item(key = "header_${dateGroup.name}") {
                    DateGroupHeader(dateGroup = dateGroup)
                }
            }

            // Email cards for this group
            items(groupThreads, key = { it.id }) { thread ->
                Box {
                    // Swipe gestures: right → archive, left → delete (matching web)
                    com.cwoc.app.ui.components.swipe.SwipeToAction(
                        onArchive = { onArchiveThread(thread) },
                        onSnooze = { onDeleteThread(thread) } // Left swipe = delete for email
                    ) {
                        // Resolve sender image URL from the cached map
                        val senderEmail = remember(thread.latestMessage.emailFrom) {
                            extractSenderEmailForAvatar(thread.latestMessage.emailFrom)
                        }
                        val senderImageUrl = senderImageUrls[senderEmail]

                        EmailCardEnhanced(
                            thread = thread,
                            isMultiSelectMode = isMultiSelectMode,
                            isSelected = selectedIds.contains(thread.latestMessage.id),
                            senderImageUrl = senderImageUrl,
                            serverUrl = serverUrl,
                            authToken = authToken,
                            onTap = { onTapThread(thread) },
                            onLongPress = {
                                if (!isMultiSelectMode) {
                                    // Show context menu on long-press (Req 9.1)
                                    // Also enters multi-select mode (Req 2.1)
                                    onEnterMultiSelect(thread)
                                } else {
                                    onLongPressThread(thread)
                                }
                            },
                            onToggleSelection = { onToggleSelection(thread) },
                            onTogglePin = { onTogglePin(thread) }
                        )
                    }

                    // Context menu for this thread (shown on long-press when not in multi-select)
                    if (contextMenuThreadId == thread.id) {
                        EmailContextMenu(
                            expanded = true,
                            onDismiss = onDismissContextMenu,
                            isRead = thread.latestMessage.emailRead == true,
                            isPinned = thread.isPinned,
                            onArchive = { onArchiveThread(thread) },
                            onDelete = { onDeleteThread(thread) },
                            onToggleRead = { onToggleReadThread(thread) },
                            onPin = { onTogglePin(thread) },
                            onOpenInEditor = { onTapThread(thread) },
                            onAddToBundle = { onAddToBundle(thread) }
                        )
                    }
                }
            }
        }

        // ─── Pagination: "Load More" Button ─────────────────────────────
        if (paginateEnabled && totalThreadCount > displayedCount) {
            item(key = "load_more") {
                val remaining = totalThreadCount - displayedCount
                LoadMoreButton(
                    remaining = remaining,
                    onLoadMore = onLoadMore
                )
            }
        }
    }
}

// ─── Date Group Header ───────────────────────────────────────────────────────────

/**
 * Section header divider showing the temporal group name.
 * Displayed between date groups in the email list.
 *
 * Validates: Requirements 14.2, 14.3, 14.4, 14.5
 */
@Composable
private fun DateGroupHeader(dateGroup: DateGroup) {
    val label = when (dateGroup) {
        DateGroup.TODAY -> "Today"
        DateGroup.YESTERDAY -> "Yesterday"
        DateGroup.LAST_WEEK -> "Last Week"
        DateGroup.OLDER -> "Older"
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        color = Color.Transparent
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 6.dp),
            fontSize = 13.sp
        )
    }
}

// ─── Load More Button ────────────────────────────────────────────────────────────

/**
 * Pagination button displayed at the bottom of the email list when more threads
 * exist beyond the current page. Shows the count of remaining threads.
 *
 * Validates: Requirements 15.2, 15.3
 */
@Composable
private fun LoadMoreButton(
    remaining: Int,
    onLoadMore: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Button(
            onClick = onLoadMore,
            shape = RoundedCornerShape(20.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        ) {
            Text(
                text = "Load More ($remaining remaining)",
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

/**
 * Extracts the email address from a "From" field for avatar lookup.
 * Handles formats like "John Doe <john@example.com>" → "john@example.com"
 * or plain "john@example.com" → "john@example.com"
 */
private fun extractSenderEmailForAvatar(emailFrom: String?): String {
    if (emailFrom.isNullOrBlank()) return ""
    val angleBracketStart = emailFrom.indexOf('<')
    val angleBracketEnd = emailFrom.indexOf('>')
    return if (angleBracketStart >= 0 && angleBracketEnd > angleBracketStart) {
        emailFrom.substring(angleBracketStart + 1, angleBracketEnd).trim()
    } else {
        emailFrom.trim()
    }
}
