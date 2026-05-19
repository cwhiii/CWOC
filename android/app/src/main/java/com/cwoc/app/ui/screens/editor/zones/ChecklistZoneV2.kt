package com.cwoc.app.ui.screens.editor.zones

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.domain.checklist.ChecklistItemV2
import com.cwoc.app.domain.checklist.ChecklistOperationsV2
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// ── Theme Colors (matching web CSS variables) ────────────────────────────────
private val ParchmentLight = Color(0xFFFDF5E6)
private val BorderColor = Color(0xFF8B4513)
private val AccentTeal = Color(0xFF008080)
private val AgedBrownLight = Color(0xFFA0522D)
private val AgedBrownMedium = Color(0xFF8B5A2B)
private val TextColor = Color(0xFF4A2C2A)
private val PendingYellow = Color(0xFFB8860B)
private val DeleteIconColor = Color(0xFF999999)

/**
 * ChecklistZoneV2 — Complete rewrite of the checklist zone matching the mobile browser exactly.
 *
 * Features: non-collapsible zone, add-item input with flash arrow, drag reorder,
 * swipe indent/outdent, inline editing, multi-select, undo/redo, data menu,
 * auto-save, completed section with ghost parents, animations.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ChecklistZoneV2(
    checklistJson: String?,
    chitId: String?,
    isNewChit: Boolean,
    autoSaveEnabled: Boolean,
    onChecklistChange: (String?) -> Unit,
    onStatusChange: (String) -> Unit,
    noteText: String?,
    onNoteChange: (String?) -> Unit,
    autoCompleteEnabled: Boolean = false,
    currentStatus: String? = null,
    availableChits: List<Pair<String, String>> = emptyList(),
    onSendItemsToChit: ((targetChitId: String, items: List<ChecklistItemV2>) -> Unit)? = null
) {
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    val viewModel = remember(chitId) {
        ChecklistZoneViewModel(
            coroutineScope = coroutineScope,
            onChecklistChange = onChecklistChange,
            onMarkUnsaved = { /* parent handles this via onChecklistChange */ }
        ).also {
            it.chitId = chitId
            it.isNewChit = isNewChit
            it.autoSaveEnabled = autoSaveEnabled
        }
    }

    // Load items on first composition or when JSON changes externally
    LaunchedEffect(checklistJson) {
        if (viewModel.items.isEmpty() || checklistJson != ChecklistOperationsV2.serialize(viewModel.items)) {
            viewModel.loadItems(checklistJson)
        }
    }

    // Auto-complete evaluation
    LaunchedEffect(viewModel.items, autoCompleteEnabled, currentStatus) {
        if (!autoCompleteEnabled) return@LaunchedEffect
        val nonBlank = viewModel.items.filter { it.text.isNotBlank() }
        if (nonBlank.isEmpty()) return@LaunchedEffect
        val allChecked = nonBlank.all { it.checked }
        if (allChecked && currentStatus != "Complete") {
            onStatusChange("Complete")
        } else if (!allChecked && currentStatus == "Complete") {
            onStatusChange("ToDo")
        }
    }

    var showDataMenu by remember { mutableStateOf(false) }
    var showSendToChit by remember { mutableStateOf(false) }
    var sendToChitItemIds by remember { mutableStateOf<Set<String>?>(null) } // null = bulk (all items)

    Column(modifier = Modifier.fillMaxWidth()) {
        // ── Zone Header (non-collapsible) ────────────────────────────────────
        ChecklistZoneHeader(
            checkedCount = viewModel.checkedCount,
            totalCount = viewModel.totalCount,
            canUndo = viewModel.canUndo,
            canRedo = viewModel.canRedo,
            autoSaveState = viewModel.autoSaveState,
            onDataClick = { showDataMenu = true },
            onUndoClick = { viewModel.undo() },
            onRedoClick = { viewModel.redo() }
        )

        // ── Add Item Input ───────────────────────────────────────────────────
        ChecklistAddItemInput(
            text = viewModel.addItemInputText,
            onTextChange = { viewModel.addItemInputText = it },
            onAddItem = {
                viewModel.addItem(viewModel.addItemInputText.trim())
                viewModel.addItemInputText = ""
            }
        )

        Spacer(modifier = Modifier.height(4.dp))

        // ── Multi-Select Toolbar ─────────────────────────────────────────────
        if (viewModel.isMultiSelectActive) {
            ChecklistMultiSelectToolbar(
                selectedCount = viewModel.selectedIds.size,
                onSelectAll = { viewModel.selectAll() },
                onCheck = { viewModel.checkSelected() },
                onDelete = { viewModel.deleteSelected() },
                onMove = {
                    sendToChitItemIds = viewModel.selectedIds
                    showSendToChit = true
                },
                onIndent = { viewModel.indentSelected() },
                onOutdent = { viewModel.outdentSelected() },
                onClear = { viewModel.clearSelection() }
            )
            Spacer(modifier = Modifier.height(4.dp))
        }

        // ── Unchecked Items ──────────────────────────────────────────────────
        val unchecked = viewModel.uncheckedItems
        unchecked.forEach { item ->
            ChecklistItemRowV2(
                item = item,
                isSelected = item.id in viewModel.selectedIds,
                isMultiSelectActive = viewModel.isMultiSelectActive,
                isEditing = viewModel.editingItemId == item.id,
                isGhost = false,
                onToggleCheck = { viewModel.toggleCheck(item.id) },
                onTapText = {
                    if (!viewModel.isMultiSelectActive) {
                        viewModel.editingItemId = item.id
                    }
                },
                onTapSend = {
                    sendToChitItemIds = setOf(item.id)
                    showSendToChit = true
                },
                onTapDelete = { viewModel.deleteItem(item.id) },
                onTapStrip = { viewModel.toggleSelectItem(item.id) },
                onTextChange = { newText -> viewModel.updateItemText(item.id, newText) },
                onFinishEditing = { viewModel.editingItemId = null },
                onSplitItem = { cursorPos ->
                    val newId = viewModel.splitItem(item.id, cursorPos)
                    viewModel.editingItemId = newId
                },
                onIndent = { viewModel.indentSubtree(item.id) },
                onOutdent = { viewModel.outdentSubtree(item.id) }
            )
        }

        // ── Completed Section ────────────────────────────────────────────────
        if (viewModel.checkedItems.isNotEmpty()) {
            ChecklistCompletedSectionV2(
                items = viewModel.items,
                checkedItems = viewModel.checkedItems,
                selectedIds = viewModel.selectedIds,
                isMultiSelectActive = viewModel.isMultiSelectActive,
                onToggleCheck = { itemId -> viewModel.toggleCheck(itemId) },
                onTapDelete = { itemId -> viewModel.deleteItem(itemId) },
                onTapStrip = { itemId -> viewModel.toggleSelectItem(itemId) }
            )
        }
    }

    // ── Data Menu Bottom Sheet ───────────────────────────────────────────────
    if (showDataMenu) {
        ChecklistDataMenuSheet(
            hasCheckedItems = viewModel.checkedItems.isNotEmpty(),
            autoSaveActive = viewModel.autoSaveChitOverride ?: viewModel.autoSaveEnabled,
            onDismiss = { showDataMenu = false },
            onPasteAsItems = {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = clipboard.primaryClip
                val text = clip?.getItemAt(0)?.text?.toString()
                if (text != null) {
                    viewModel.pasteItems(text)
                }
                showDataMenu = false
            },
            onCopyIncomplete = {
                val markdown = viewModel.getIncompleteAsMarkdown()
                if (markdown != null) {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("checklist", markdown))
                }
                showDataMenu = false
            },
            onDeleteChecked = {
                viewModel.clearCheckedItems()
                showDataMenu = false
            },
            onDeleteUnchecked = {
                viewModel.clearUncheckedItems()
                showDataMenu = false
            },
            onCleanEmpty = {
                viewModel.cleanUpEmptyItems()
                showDataMenu = false
            },
            onMoveToNote = {
                val markdown = viewModel.moveChecklistToNote()
                val newNote = if (noteText.isNullOrBlank()) markdown
                else "${noteText.trimEnd()}\n\n$markdown"
                onNoteChange(newNote)
                showDataMenu = false
            },
            onSendToChit = {
                sendToChitItemIds = null // null = bulk send all
                showSendToChit = true
                showDataMenu = false
            },
            onPrint = {
                // Share checklist as formatted text via Android share intent
                val printText = ChecklistOperationsV2.itemsToMarkdown(viewModel.items)
                val sendIntent = android.content.Intent().apply {
                    action = android.content.Intent.ACTION_SEND
                    putExtra(android.content.Intent.EXTRA_TEXT, printText)
                    type = "text/plain"
                }
                val shareIntent = android.content.Intent.createChooser(sendIntent, "Print/Share Checklist")
                context.startActivity(shareIntent)
                showDataMenu = false
            },
            onToggleAutoSave = {
                viewModel.toggleAutoSaveOverride()
                showDataMenu = false
            }
        )
    }

    // ── Send-to-Chit Picker ──────────────────────────────────────────────────
    if (showSendToChit && availableChits.isNotEmpty()) {
        com.cwoc.app.ui.components.ChitPickerSheet(
            chits = availableChits,
            onChitSelected = { targetChitId ->
                val itemsToSend = if (sendToChitItemIds == null) {
                    // Bulk send: all items
                    viewModel.items
                } else {
                    // Specific items (per-item or multi-select)
                    val ids = sendToChitItemIds!!
                    val allToSend = mutableListOf<ChecklistItemV2>()
                    for (id in ids) {
                        allToSend.addAll(ChecklistOperationsV2.getSubtree(viewModel.items, id))
                    }
                    allToSend.distinctBy { it.id }
                }

                onSendItemsToChit?.invoke(targetChitId, itemsToSend)

                // Remove sent items from current checklist
                val sentIds = itemsToSend.map { it.id }.toSet()
                val remaining = viewModel.items.filter { it.id !in sentIds }
                viewModel.applyChange(remaining)

                // Clear multi-select if active
                if (viewModel.isMultiSelectActive) viewModel.clearSelection()

                showSendToChit = false
                sendToChitItemIds = null
            },
            onDismiss = {
                showSendToChit = false
                sendToChitItemIds = null
            },
            title = "Send to Chit"
        )
    }
}

// ── Zone Header ──────────────────────────────────────────────────────────────

@Composable
private fun ChecklistZoneHeader(
    checkedCount: Int,
    totalCount: Int,
    canUndo: Boolean,
    canRedo: Boolean,
    autoSaveState: AutoSaveState,
    onDataClick: () -> Unit,
    onUndoClick: () -> Unit,
    onRedoClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Title + count
        Text(
            text = "✅ Checklist",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = TextColor
        )
        if (totalCount > 0) {
            Text(
                text = " ($checkedCount / $totalCount)",
                fontSize = 13.sp,
                color = TextColor.copy(alpha = 0.8f)
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Data button
        TextButton(onClick = onDataClick) {
            Text("⋮ Data", fontSize = 13.sp, color = AgedBrownMedium)
        }

        // Auto-save indicator
        when (autoSaveState) {
            AutoSaveState.PENDING -> {
                Text(
                    text = "changes pending",
                    fontSize = 12.sp,
                    color = PendingYellow,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }
            AutoSaveState.SAVED -> {
                Text(
                    text = "✓ saved",
                    fontSize = 12.sp,
                    color = AccentTeal,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }
            else -> {}
        }

        Spacer(modifier = Modifier.weight(1f))

        // Undo button
        TextButton(
            onClick = onUndoClick,
            enabled = canUndo
        ) {
            Text(
                text = "↺",
                fontSize = 18.sp,
                color = if (canUndo) AgedBrownMedium else AgedBrownMedium.copy(alpha = 0.3f)
            )
        }

        // Redo button
        TextButton(
            onClick = onRedoClick,
            enabled = canRedo
        ) {
            Text(
                text = "↻",
                fontSize = 18.sp,
                color = if (canRedo) AgedBrownMedium else AgedBrownMedium.copy(alpha = 0.3f)
            )
        }

        // Zone indicator (decorative)
        Text(text = "🔽", fontSize = 14.sp, modifier = Modifier.padding(start = 4.dp))
    }
}

// ── Add Item Input with Flash Arrow ──────────────────────────────────────────

@Composable
private fun ChecklistAddItemInput(
    text: String,
    onTextChange: (String) -> Unit,
    onAddItem: () -> Unit
) {
    var showFlashArrow by remember { mutableStateOf(false) }
    val flashAlpha by animateFloatAsState(
        targetValue = if (showFlashArrow) 1f else 0f,
        animationSpec = tween(200),
        label = "flash-alpha"
    )
    val flashOffsetY by animateDpAsState(
        targetValue = if (showFlashArrow) 4.dp else 0.dp,
        animationSpec = tween(300),
        label = "flash-offset"
    )

    LaunchedEffect(showFlashArrow) {
        if (showFlashArrow) {
            delay(600)
            showFlashArrow = false
        }
    }

    var isFocused by remember { mutableStateOf(false) }
    val borderColor = if (isFocused) AccentTeal else BorderColor

    Box(modifier = Modifier.fillMaxWidth()) {
        BasicTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, borderColor, RoundedCornerShape(4.dp))
                .background(ParchmentLight, RoundedCornerShape(4.dp))
                .padding(8.dp),
            textStyle = TextStyle(
                fontSize = 16.sp,
                color = TextColor
            ),
            singleLine = true,
            cursorBrush = SolidColor(AccentTeal),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(
                onDone = {
                    if (text.isNotBlank()) {
                        onAddItem()
                        showFlashArrow = true
                    }
                }
            ),
            decorationBox = { innerTextField ->
                Box {
                    if (text.isEmpty()) {
                        Text(
                            text = "Add new item (Enter to add)",
                            color = TextColor.copy(alpha = 0.5f),
                            fontSize = 16.sp
                        )
                    }
                    innerTextField()
                }
            }
        )

        // Flash arrow
        if (flashAlpha > 0f) {
            Text(
                text = "↓",
                color = AccentTeal,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 10.dp)
                    .offset(y = flashOffsetY)
                    .alpha(flashAlpha)
            )
        }
    }
}

// ── Checklist Item Row V2 ────────────────────────────────────────────────────

@Composable
private fun ChecklistItemRowV2(
    item: ChecklistItemV2,
    isSelected: Boolean,
    isMultiSelectActive: Boolean,
    isEditing: Boolean,
    isGhost: Boolean,
    onToggleCheck: () -> Unit,
    onTapText: () -> Unit,
    onTapSend: () -> Unit,
    onTapDelete: () -> Unit,
    onTapStrip: () -> Unit,
    onTextChange: (String) -> Unit,
    onFinishEditing: () -> Unit,
    onSplitItem: (Int) -> Unit,
    onIndent: () -> Unit,
    onOutdent: () -> Unit
) {
    // Check animation state
    var isChecking by remember { mutableStateOf(false) }
    var isFading by remember { mutableStateOf(false) }

    val checkBgColor by animateColorAsState(
        targetValue = if (isChecking) Color(0x0F008000) else Color.Transparent,
        animationSpec = tween(100),
        label = "check-bg"
    )
    val fadeAlpha by animateFloatAsState(
        targetValue = if (isFading) 0f else 1f,
        animationSpec = tween(150),
        label = "fade-alpha"
    )
    val fadeOffsetX by animateDpAsState(
        targetValue = if (isFading) 10.dp else 0.dp,
        animationSpec = tween(150),
        label = "fade-offset"
    )

    // Delete animation state
    var isDeleting by remember { mutableStateOf(false) }
    val deleteBgColor by animateColorAsState(
        targetValue = if (isDeleting) Color.Red else Color.Transparent,
        animationSpec = tween(500),
        label = "delete-bg"
    )
    val deleteAlpha by animateFloatAsState(
        targetValue = if (isDeleting) 0f else 1f,
        animationSpec = tween(500),
        label = "delete-alpha"
    )

    val coroutineScope = rememberCoroutineScope()

    // Selected highlight
    val itemBg = when {
        isDeleting -> deleteBgColor
        isChecking -> checkBgColor
        isSelected -> AccentTeal.copy(alpha = 0.06f)
        else -> Color.Transparent
    }

    val itemModifier = Modifier
        .fillMaxWidth()
        .background(itemBg)
        .alpha(if (isDeleting) deleteAlpha else fadeAlpha)
        .offset(x = fadeOffsetX)
        .padding(start = (item.level * ChecklistOperationsV2.INDENT_DP_PER_LEVEL).dp)
        .then(
            if (isSelected) Modifier.border(1.dp, AccentTeal.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
            else Modifier
        )

    Row(
        modifier = itemModifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (!isGhost) {
            // Drag handle with swipe indent/outdent gesture
            Text(
                text = "⠿",
                fontSize = 20.sp,
                color = if (isSelected && isMultiSelectActive) AccentTeal
                    else AgedBrownLight.copy(alpha = 0.8f),
                modifier = Modifier
                    .padding(end = 6.dp)
                    .pointerInput(item.id) {
                        var totalDragX = 0f
                        var totalDragY = 0f
                        var swipeHandled = false

                        detectDragGestures(
                            onDragStart = { _ ->
                                totalDragX = 0f
                                totalDragY = 0f
                                swipeHandled = false
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                totalDragX += dragAmount.x
                                totalDragY += dragAmount.y

                                val threshold = 40.dp.toPx()
                                if (!swipeHandled && kotlin.math.abs(totalDragX) > threshold &&
                                    kotlin.math.abs(totalDragX) > kotlin.math.abs(totalDragY) * 2) {
                                    swipeHandled = true
                                    if (totalDragX > 0) onIndent() else onOutdent()
                                }
                            },
                            onDragEnd = {
                                // Vertical drag-to-reorder would go here
                                // For now, swipe indent/outdent is the primary gesture
                            },
                            onDragCancel = {}
                        )
                    }
            )
        } else {
            Spacer(modifier = Modifier.width(26.dp))
        }

        // Checkbox
        if (!isGhost) {
            Checkbox(
                checked = item.checked,
                onCheckedChange = {
                    if (!isMultiSelectActive) {
                        isChecking = true
                        coroutineScope.launch {
                            delay(100)
                            isFading = true
                            delay(150)
                            onToggleCheck()
                            isChecking = false
                            isFading = false
                        }
                    }
                },
                modifier = Modifier.size(24.dp)
            )
        } else {
            Spacer(modifier = Modifier.size(24.dp))
        }

        Spacer(modifier = Modifier.width(6.dp))

        // Text content (editing or display)
        Box(modifier = Modifier.weight(1f)) {
            if (isEditing && !isGhost) {
                // Inline editing TextField with keyboard shortcuts
                var editText by remember(item.id) { mutableStateOf(item.text) }
                BasicTextField(
                    value = editText,
                    onValueChange = { newText ->
                        // Detect Enter key press (newline inserted by soft keyboard)
                        if (newText.contains("\n") && !editText.contains("\n")) {
                            // Enter pressed — split item at the newline position
                            val nlIdx = newText.indexOf("\n")
                            val textBefore = newText.substring(0, nlIdx)
                            editText = textBefore
                            onTextChange(textBefore)
                            onSplitItem(nlIdx)
                        } else {
                            editText = newText
                            onTextChange(newText)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, AccentTeal, RoundedCornerShape(3.dp))
                        .padding(2.dp)
                        .onKeyEvent { keyEvent ->
                            if (keyEvent.type == KeyEventType.KeyDown) {
                                when (keyEvent.key) {
                                    Key.Tab -> {
                                        if (keyEvent.isShiftPressed) onOutdent() else onIndent()
                                        true
                                    }
                                    Key.Escape -> {
                                        editText = item.text // revert
                                        onTextChange(item.text)
                                        onFinishEditing()
                                        true
                                    }
                                    else -> false
                                }
                            } else false
                        },
                    textStyle = TextStyle(fontSize = 15.sp, color = TextColor),
                    cursorBrush = SolidColor(AccentTeal),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
                    keyboardActions = KeyboardActions(
                        onDone = { onFinishEditing() }
                    )
                )
            } else {
                // Markdown rendered text (tap to edit)
                val textDecoration = if (item.checked) TextDecoration.LineThrough else TextDecoration.None
                val textColor = when {
                    isGhost -> TextColor.copy(alpha = 0.5f)
                    item.checked -> AgedBrownMedium
                    else -> TextColor
                }
                Text(
                    text = item.text,
                    fontSize = 15.sp,
                    color = textColor,
                    textDecoration = textDecoration,
                    modifier = Modifier.clickable(enabled = !isGhost && !isMultiSelectActive) { onTapText() }
                )
            }
        }

        if (!isGhost) {
            // Send icon
            Text(
                text = "📤",
                fontSize = 14.sp,
                modifier = Modifier
                    .clickable { onTapSend() }
                    .padding(horizontal = 4.dp)
            )

            // Delete icon
            Text(
                text = "✕",
                fontSize = 14.sp,
                color = DeleteIconColor,
                modifier = Modifier
                    .clickable {
                        isDeleting = true
                        coroutineScope.launch {
                            delay(300)
                            onTapDelete()
                            isDeleting = false
                        }
                    }
                    .padding(horizontal = 4.dp)
            )

            // Select strip
            Box(
                modifier = Modifier
                    .size(width = 18.dp, height = 32.dp)
                    .background(
                        if (isSelected) AccentTeal else AccentTeal.copy(alpha = 0.04f)
                    )
                    .clickable { onTapStrip() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (isSelected) "✓" else "⋮",
                    fontSize = 12.sp,
                    color = if (isSelected) Color.White else AccentTeal.copy(alpha = 0.4f),
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}

// ── Completed Section ────────────────────────────────────────────────────────

@Composable
private fun ChecklistCompletedSectionV2(
    items: List<ChecklistItemV2>,
    checkedItems: List<ChecklistItemV2>,
    selectedIds: Set<String>,
    isMultiSelectActive: Boolean,
    onToggleCheck: (String) -> Unit,
    onTapDelete: (String) -> Unit,
    onTapStrip: (String) -> Unit
) {
    var isExpanded by remember { mutableStateOf(false) }
    val ghostParentIds = remember(items) { ChecklistOperationsV2.getGhostParents(items) }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Border top
        HorizontalDivider(
            color = AgedBrownLight,
            thickness = 1.dp,
            modifier = Modifier.padding(top = 6.dp)
        )

        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Completed",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextColor
            )
            Text(
                text = " (${checkedItems.size})",
                fontSize = 13.sp,
                color = TextColor.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = if (isExpanded) "▼" else "▶",
                fontSize = 12.sp,
                color = TextColor
            )
        }

        // Body (collapsed by default)
        if (isExpanded) {
            // Render items in list order: ghost parents + checked items
            items.forEach { item ->
                when {
                    item.checked -> {
                        ChecklistItemRowV2(
                            item = item,
                            isSelected = item.id in selectedIds,
                            isMultiSelectActive = isMultiSelectActive,
                            isEditing = false,
                            isGhost = false,
                            onToggleCheck = { onToggleCheck(item.id) },
                            onTapText = {},
                            onTapSend = {},
                            onTapDelete = { onTapDelete(item.id) },
                            onTapStrip = { onTapStrip(item.id) },
                            onTextChange = {},
                            onFinishEditing = {},
                            onSplitItem = {},
                            onIndent = {},
                            onOutdent = {}
                        )
                    }
                    item.id in ghostParentIds -> {
                        ChecklistItemRowV2(
                            item = item,
                            isSelected = false,
                            isMultiSelectActive = false,
                            isEditing = false,
                            isGhost = true,
                            onToggleCheck = {},
                            onTapText = {},
                            onTapSend = {},
                            onTapDelete = {},
                            onTapStrip = {},
                            onTextChange = {},
                            onFinishEditing = {},
                            onSplitItem = {},
                            onIndent = {},
                            onOutdent = {}
                        )
                    }
                }
            }
        }
    }
}

// ── Multi-Select Toolbar ─────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChecklistMultiSelectToolbar(
    selectedCount: Int,
    onSelectAll: () -> Unit,
    onCheck: () -> Unit,
    onDelete: () -> Unit,
    onMove: () -> Unit,
    onIndent: () -> Unit,
    onOutdent: () -> Unit,
    onClear: () -> Unit
) {
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .background(AccentTeal.copy(alpha = 0.08f), RoundedCornerShape(6.dp))
            .border(1.dp, AccentTeal.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "$selectedCount selected",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = AccentTeal,
            modifier = Modifier.padding(end = 4.dp)
        )
        ToolbarButton("All") { onSelectAll() }
        ToolbarButton("✓ Check") { onCheck() }
        ToolbarButton("🗑 Delete") { onDelete() }
        ToolbarButton("📤 Move") { onMove() }
        ToolbarButton("→") { onIndent() }
        ToolbarButton("←") { onOutdent() }
        ToolbarButton("✕") { onClear() }
    }
}

@Composable
private fun ToolbarButton(label: String, onClick: () -> Unit) {
    Text(
        text = label,
        fontSize = 12.sp,
        color = AgedBrownMedium,
        modifier = Modifier
            .background(ParchmentLight, RoundedCornerShape(4.dp))
            .border(1.dp, AgedBrownLight.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 3.dp)
    )
}

// ── Data Menu Bottom Sheet ───────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChecklistDataMenuSheet(
    hasCheckedItems: Boolean,
    autoSaveActive: Boolean,
    onDismiss: () -> Unit,
    onPasteAsItems: () -> Unit,
    onCopyIncomplete: () -> Unit,
    onDeleteChecked: () -> Unit,
    onDeleteUnchecked: () -> Unit,
    onCleanEmpty: () -> Unit,
    onMoveToNote: () -> Unit,
    onSendToChit: () -> Unit,
    onPrint: () -> Unit,
    onToggleAutoSave: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
        containerColor = ParchmentLight
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        ) {
            DataMenuItem(icon = "📋", label = "Paste as list items", onClick = onPasteAsItems)
            DataMenuItem(icon = "📋", label = "Copy incomplete to clipboard", onClick = onCopyIncomplete)
            if (hasCheckedItems) {
                DataMenuItem(icon = "☑️", label = "Delete checked items", onClick = onDeleteChecked)
            }
            DataMenuItem(icon = "☐", label = "Delete unchecked items", onClick = onDeleteUnchecked)
            DataMenuItem(icon = "🧹", label = "Clean up empty items", onClick = onCleanEmpty)
            DataMenuItem(icon = "→", label = "Move to note", onClick = onMoveToNote)
            DataMenuItem(icon = "📤", label = "Send to another chit", onClick = onSendToChit)
            DataMenuItem(icon = "🖨️", label = "Print checklist", onClick = onPrint)
            DataMenuItem(
                icon = "⚡",
                label = if (autoSaveActive) "Auto-save: On" else "Auto-save: Off",
                onClick = onToggleAutoSave
            )
        }
    }
}

@Composable
private fun DataMenuItem(icon: String, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = icon, fontSize = 16.sp, modifier = Modifier.width(28.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(text = label, fontSize = 15.sp, color = TextColor)
    }
}
