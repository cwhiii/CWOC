package com.cwoc.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.FlingBehavior
import androidx.compose.foundation.gestures.ScrollScope
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.ui.theme.LoraFontFamily
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.time.LocalTime

// ─── Colors matching web spec Section 8 ──────────────────────────────────────
private val ModalBg = Color(0xFFFFFAF0)
private val ModalBorder = Color(0xFF6B4E31)
private val HeaderText = Color(0xFF3A2A14)
private val DrumItemColor = Color(0xFF6B4E31)
private val HighlightBg = Color(0x1A8B5A2B) // rgba(139, 90, 43, 0.1)
private val HighlightBorder = Color(0x4D8B5A2B) // rgba(139, 90, 43, 0.3)
private val InputText = Color(0xFF1A1208)
private val InputCaret = Color(0xFF6B4E31)
private val InputFocusBg = Color(0xCCFFFAF0) // rgba(255, 250, 240, 0.8)
private val CancelBg = Color(0xFFF5E6CC)
private val CancelText = Color(0xFF6B4E31)
private val NowBg = Color(0xFFE8DCC8)
private val NowText = Color(0xFF3A2A14)
private val SetBg = Color(0xFF6B4E31)
private val SetText = Color(0xFFFFF8E1)
private val SetBorder = Color(0xFF4A3520)
private val FadeMaskColor = Color(0xFFFFFAF0)
private val OverlayBg = Color(0x80000000) // rgba(0, 0, 0, 0.5)

// Slide-down animation easing: cubic-bezier(0.32, 0.72, 0, 1)
private val SlideDownEasing = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)

/**
 * Drum roller time picker matching the web's cwocTimePicker (Section 8 of spec).
 *
 * Interface: DrumRollerTimePicker(isOpen, initialTime, timeFormat, minuteStep, onTimeSet, onCancel)
 *
 * @param initialHour Initial hour (0-23)
 * @param initialMinute Initial minute (0-59)
 * @param is24Hour Whether to show 24-hour or 12-hour format
 * @param minuteStep Snap interval for minutes (default 5)
 * @param onDismiss Called when picker is dismissed without selection (Cancel/outside tap/Escape)
 * @param onTimeSelected Called with (hour24, minute) when user confirms (Set/Enter)
 */
@Composable
fun DrumRollerTimePicker(
    initialHour: Int = 12,
    initialMinute: Int = 0,
    is24Hour: Boolean = true,
    minuteStep: Int = 5,
    onDismiss: () -> Unit,
    onTimeSelected: (hour: Int, minute: Int) -> Unit
) {
    val configuration = LocalConfiguration.current
    val isSmallScreen = configuration.screenWidthDp <= 380
    val itemHeight = if (isSmallScreen) 36 else 40
    val drumHeight = if (isSmallScreen) 180 else 200

    // State
    var selectedHour by remember { mutableIntStateOf(initialHour) }
    var selectedMinute by remember { mutableIntStateOf(initialMinute) }
    var selectedAmPm by remember { mutableIntStateOf(if (initialHour >= 12) 1 else 0) }
    var isUserTyping by remember { mutableStateOf(false) }

    // For 12-hour display
    val displayHour = if (!is24Hour) {
        when {
            selectedHour == 0 -> 12
            selectedHour > 12 -> selectedHour - 12
            else -> selectedHour
        }
    } else selectedHour

    // Build minute items based on step
    val minuteItems = remember(minuteStep) {
        (0 until 60 step minuteStep.coerceIn(1, 60)).toList()
    }

    // Find the closest minute index for the initial value
    val initialMinuteIndex = remember(initialMinute, minuteItems) {
        // Find nearest snap value
        val nearest = minuteItems.minByOrNull { kotlin.math.abs(it - initialMinute) } ?: 0
        minuteItems.indexOf(nearest).coerceAtLeast(0)
    }

    // Input field values
    var hourInputValue by remember {
        mutableStateOf(
            TextFieldValue(
                text = if (is24Hour) String.format("%02d", initialHour) else displayHour.toString(),
                selection = TextRange(0, if (is24Hour) 2 else displayHour.toString().length)
            )
        )
    }
    var minuteInputValue by remember {
        mutableStateOf(
            TextFieldValue(
                text = String.format("%02d", initialMinute),
                selection = TextRange(0, 2)
            )
        )
    }
    var amPmInputValue by remember {
        mutableStateOf(
            TextFieldValue(
                text = if (initialHour >= 12) "PM" else "AM",
                selection = TextRange(0, 2)
            )
        )
    }

    // Focus requesters for input fields
    val hourFocusRequester = remember { FocusRequester() }
    val minuteFocusRequester = remember { FocusRequester() }
    val amPmFocusRequester = remember { FocusRequester() }

    // Drum list states
    val hourItems = if (is24Hour) (0..23).toList() else (1..12).toList()
    val hourInitialIndex = if (is24Hour) selectedHour else (displayHour - 1).coerceIn(0, 11)
    val hourListState = rememberLazyListState(initialFirstVisibleItemIndex = hourInitialIndex)
    val minuteListState = rememberLazyListState(initialFirstVisibleItemIndex = initialMinuteIndex)
    val amPmListState = rememberLazyListState(initialFirstVisibleItemIndex = selectedAmPm)

    val coroutineScope = rememberCoroutineScope()

    // Animation states
    val overlayAlpha = remember { Animatable(0f) }
    val slideOffset = remember { Animatable(-1f) } // -1 = off-screen top, 0 = in place

    // Run entrance animations
    LaunchedEffect(Unit) {
        // Fade in overlay (0.2s ease)
        launch { overlayAlpha.animateTo(1f, animationSpec = tween(200)) }
        // Slide down modal (0.3s cubic-bezier)
        launch { slideOffset.animateTo(0f, animationSpec = tween(300, easing = SlideDownEasing)) }
    }

    // Helper to confirm and close
    fun confirmAndClose() {
        onTimeSelected(selectedHour, selectedMinute)
    }

    // Helper to update inputs from drum scroll (unless user is typing)
    fun syncInputsFromDrums() {
        if (!isUserTyping) {
            hourInputValue = TextFieldValue(
                text = if (is24Hour) String.format("%02d", selectedHour) else displayHour.toString()
            )
            minuteInputValue = TextFieldValue(
                text = String.format("%02d", selectedMinute)
            )
            amPmInputValue = TextFieldValue(
                text = if (selectedAmPm == 0) "AM" else "PM"
            )
        }
    }

    // Sync drum scroll to inputs
    LaunchedEffect(hourListState) {
        snapshotFlow { hourListState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { firstVisible ->
                val actualIndex = firstVisible.coerceIn(0, hourItems.size - 1)
                if (is24Hour) {
                    selectedHour = hourItems[actualIndex]
                } else {
                    val h12 = hourItems[actualIndex]
                    selectedHour = if (selectedAmPm == 0) {
                        if (h12 == 12) 0 else h12
                    } else {
                        if (h12 == 12) 12 else h12 + 12
                    }
                }
                syncInputsFromDrums()
            }
    }

    LaunchedEffect(minuteListState) {
        snapshotFlow { minuteListState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { firstVisible ->
                val actualIndex = firstVisible.coerceIn(0, minuteItems.size - 1)
                selectedMinute = minuteItems[actualIndex]
                syncInputsFromDrums()
            }
    }

    LaunchedEffect(amPmListState) {
        if (!is24Hour) {
            snapshotFlow { amPmListState.firstVisibleItemIndex }
                .distinctUntilChanged()
                .collect { firstVisible ->
                    selectedAmPm = firstVisible.coerceIn(0, 1)
                    // Recalculate 24h hour
                    val h12 = if (selectedHour == 0) 12
                    else if (selectedHour > 12) selectedHour - 12
                    else selectedHour
                    selectedHour = if (selectedAmPm == 0) {
                        if (h12 == 12) 0 else h12
                    } else {
                        if (h12 == 12) 12 else h12 + 12
                    }
                    syncInputsFromDrums()
                }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        // Full-screen overlay with animated opacity
        Box(
            modifier = Modifier
                .fillMaxSize()
                .alpha(overlayAlpha.value)
                .background(OverlayBg)
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { onDismiss() },
            contentAlignment = Alignment.TopCenter
        ) {
            // Modal container with slide-down animation
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 400.dp)
                    .graphicsLayer {
                        translationY = slideOffset.value * -size.height
                    }
                    .shadow(
                        elevation = 20.dp,
                        shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp),
                        ambientColor = Color(0x33000000),
                        spotColor = Color(0x33000000)
                    )
                    .background(ModalBg, RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
                    .border(
                        width = 0.dp,
                        color = Color.Transparent,
                        shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp)
                    )
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { /* consume click to prevent closing */ }
                    .onPreviewKeyEvent { keyEvent ->
                        if (keyEvent.type == KeyEventType.KeyDown) {
                            when (keyEvent.key) {
                                Key.Escape, Key.Back -> {
                                    onDismiss()
                                    true
                                }
                                Key.Enter -> {
                                    confirmAndClose()
                                    true
                                }
                                else -> false
                            }
                        } else false
                    }
            ) {
                // Border-bottom 3dp solid #6b4e31
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Header: "Select Time"
                    Text(
                        text = "Select Time",
                        fontFamily = LoraFontFamily,
                        fontSize = 18.sp, // 1.1em equivalent
                        fontWeight = FontWeight.SemiBold,
                        color = HeaderText,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    // Drum container
                    Box(
                        modifier = Modifier
                            .height(drumHeight.dp)
                            .widthIn(max = 300.dp)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        // Highlight bar (z-index 1 equivalent)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp)
                                .height(itemHeight.dp)
                                .background(HighlightBg, RoundedCornerShape(6.dp))
                                .border(1.5.dp, HighlightBorder, RoundedCornerShape(6.dp))
                        )

                        // Drums row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Hour drum
                            DrumColumn(
                                items = hourItems,
                                initialIndex = hourInitialIndex,
                                listState = hourListState,
                                itemHeight = itemHeight,
                                drumHeight = drumHeight,
                                isSmallScreen = isSmallScreen,
                                formatItem = { item ->
                                    if (is24Hour) String.format("%02d", item)
                                    else item.toString()
                                },
                                modifier = Modifier.weight(1f)
                            )

                            // Colon separator
                            Text(
                                text = ":",
                                fontFamily = LoraFontFamily,
                                fontSize = 29.sp, // 1.8em
                                fontWeight = FontWeight.Bold,
                                color = HeaderText,
                                modifier = Modifier.padding(horizontal = 2.dp),
                                lineHeight = drumHeight.sp
                            )

                            // Minute drum
                            DrumColumn(
                                items = minuteItems,
                                initialIndex = initialMinuteIndex,
                                listState = minuteListState,
                                itemHeight = itemHeight,
                                drumHeight = drumHeight,
                                isSmallScreen = isSmallScreen,
                                formatItem = { item -> String.format("%02d", item) },
                                modifier = Modifier.weight(1f)
                            )

                            // AM/PM drum (12-hour only)
                            if (!is24Hour) {
                                Spacer(modifier = Modifier.width(8.dp))
                                DrumColumn(
                                    items = listOf(0, 1),
                                    initialIndex = selectedAmPm,
                                    listState = amPmListState,
                                    itemHeight = itemHeight,
                                    drumHeight = drumHeight,
                                    isSmallScreen = isSmallScreen,
                                    formatItem = { item -> if (item == 0) "AM" else "PM" },
                                    modifier = Modifier.weight(0.8f)
                                )
                            }
                        }

                        // Editable input overlay (z-index 10 equivalent, over highlight bar)
                        Row(
                            modifier = Modifier.align(Alignment.Center),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Hour input
                            OverwriteInput(
                                value = hourInputValue,
                                onValueChange = { newValue ->
                                    isUserTyping = true
                                    val result = validateHourInput(newValue.text, is24Hour)
                                    if (result != null) {
                                        hourInputValue = TextFieldValue(
                                            text = result.text,
                                            selection = TextRange(result.text.length)
                                        )
                                        if (result.complete) {
                                            val h = result.text.toIntOrNull() ?: 0
                                            if (is24Hour) {
                                                selectedHour = h
                                            } else {
                                                selectedHour = if (selectedAmPm == 0) {
                                                    if (h == 12) 0 else h
                                                } else {
                                                    if (h == 12) 12 else h + 12
                                                }
                                            }
                                            // Scroll drum to match
                                            coroutineScope.launch {
                                                val idx = if (is24Hour) h else (h - 1).coerceIn(0, 11)
                                                hourListState.animateScrollToItem(idx)
                                                delay(50)
                                                isUserTyping = false
                                            }
                                            // Advance focus to minute
                                            minuteFocusRequester.requestFocus()
                                        }
                                    }
                                },
                                focusRequester = hourFocusRequester,
                                onEnter = { confirmAndClose() },
                                onEscape = { onDismiss() },
                                modifier = Modifier.width(44.dp),
                                fontSize = 24.sp
                            )

                            // Input colon separator
                            Text(
                                text = ":",
                                fontFamily = LoraFontFamily,
                                fontSize = 24.sp, // 1.5em
                                fontWeight = FontWeight.Bold,
                                color = InputText
                            )

                            // Minute input
                            OverwriteInput(
                                value = minuteInputValue,
                                onValueChange = { newValue ->
                                    isUserTyping = true
                                    val result = validateMinuteInput(newValue.text)
                                    if (result != null) {
                                        minuteInputValue = TextFieldValue(
                                            text = result.text,
                                            selection = TextRange(result.text.length)
                                        )
                                        if (result.complete) {
                                            val m = result.text.toIntOrNull() ?: 0
                                            selectedMinute = m
                                            // Scroll drum to nearest snap
                                            coroutineScope.launch {
                                                val nearestSnap = minuteItems.minByOrNull {
                                                    kotlin.math.abs(it - m)
                                                } ?: 0
                                                val idx = minuteItems.indexOf(nearestSnap)
                                                    .coerceAtLeast(0)
                                                minuteListState.animateScrollToItem(idx)
                                                delay(50)
                                                isUserTyping = false
                                            }
                                            // Advance focus to AM/PM if 12h
                                            if (!is24Hour) {
                                                amPmFocusRequester.requestFocus()
                                            }
                                        }
                                    }
                                },
                                focusRequester = minuteFocusRequester,
                                onEnter = { confirmAndClose() },
                                onEscape = { onDismiss() },
                                modifier = Modifier.width(44.dp),
                                fontSize = 24.sp
                            )

                            // AM/PM input (12-hour only)
                            if (!is24Hour) {
                                Spacer(modifier = Modifier.width(4.dp))
                                AmPmInput(
                                    value = amPmInputValue,
                                    onValueChange = { newValue ->
                                        val text = newValue.text.uppercase()
                                        when {
                                            text.startsWith("A") -> {
                                                amPmInputValue = TextFieldValue("AM")
                                                selectedAmPm = 0
                                                val h12 = displayHour
                                                selectedHour = if (h12 == 12) 0 else h12
                                                coroutineScope.launch {
                                                    amPmListState.animateScrollToItem(0)
                                                }
                                            }
                                            text.startsWith("P") -> {
                                                amPmInputValue = TextFieldValue("PM")
                                                selectedAmPm = 1
                                                val h12 = displayHour
                                                selectedHour = if (h12 == 12) 12 else h12 + 12
                                                coroutineScope.launch {
                                                    amPmListState.animateScrollToItem(1)
                                                }
                                            }
                                        }
                                    },
                                    focusRequester = amPmFocusRequester,
                                    onEnter = { confirmAndClose() },
                                    onEscape = { onDismiss() }
                                )
                            }
                        }

                        // Fade masks (top and bottom, non-interactive)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.TopCenter)
                                .height(60.dp)
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(FadeMaskColor, FadeMaskColor.copy(alpha = 0f))
                                    )
                                )
                                .clickable(enabled = false, onClick = {})
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.BottomCenter)
                                .height(60.dp)
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(FadeMaskColor.copy(alpha = 0f), FadeMaskColor)
                                    )
                                )
                                .clickable(enabled = false, onClick = {})
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Buttons row: flex row, gap 10dp, margin-top 16dp, padding 0 8dp
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Cancel button
                        DrumRollerButton(
                            text = "Cancel",
                            backgroundColor = CancelBg,
                            textColor = CancelText,
                            borderColor = CancelText,
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f)
                        )
                        // Now button
                        DrumRollerButton(
                            text = "Now",
                            backgroundColor = NowBg,
                            textColor = NowText,
                            borderColor = CancelText,
                            onClick = {
                                val now = LocalTime.now()
                                val snappedMinute = ((now.minute + minuteStep / 2) / minuteStep) * minuteStep
                                val adjustedMinute = if (snappedMinute >= 60) 0 else snappedMinute
                                val adjustedHour = if (snappedMinute >= 60) (now.hour + 1) % 24 else now.hour
                                selectedHour = adjustedHour
                                selectedMinute = adjustedMinute
                                selectedAmPm = if (adjustedHour >= 12) 1 else 0
                                // Update inputs
                                val dh = if (!is24Hour) {
                                    when {
                                        adjustedHour == 0 -> 12
                                        adjustedHour > 12 -> adjustedHour - 12
                                        else -> adjustedHour
                                    }
                                } else adjustedHour
                                hourInputValue = TextFieldValue(
                                    text = if (is24Hour) String.format("%02d", adjustedHour) else dh.toString()
                                )
                                minuteInputValue = TextFieldValue(
                                    text = String.format("%02d", adjustedMinute)
                                )
                                amPmInputValue = TextFieldValue(
                                    text = if (adjustedHour >= 12) "PM" else "AM"
                                )
                                // Scroll drums
                                coroutineScope.launch {
                                    val hIdx = if (is24Hour) adjustedHour else (dh - 1).coerceIn(0, 11)
                                    hourListState.animateScrollToItem(hIdx)
                                    val mIdx = minuteItems.indexOf(adjustedMinute).coerceAtLeast(0)
                                    minuteListState.animateScrollToItem(mIdx)
                                    if (!is24Hour) {
                                        amPmListState.animateScrollToItem(selectedAmPm)
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f)
                        )
                        // Set button
                        DrumRollerButton(
                            text = "Set",
                            backgroundColor = SetBg,
                            textColor = SetText,
                            borderColor = SetBorder,
                            onClick = { confirmAndClose() },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Border-bottom line (3dp solid #6b4e31)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .align(Alignment.BottomCenter)
                        .background(ModalBorder)
                )
            }
        }
    }
}


// ─── Drum Column (scrollable snap list) ──────────────────────────────────────

@Composable
private fun DrumColumn(
    items: List<Int>,
    initialIndex: Int,
    listState: LazyListState,
    itemHeight: Int,
    drumHeight: Int,
    isSmallScreen: Boolean,
    formatItem: (Int) -> String,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    // 2 padding items at top and bottom for centering
    val paddedItems = listOf(-1, -1) + items.indices.toList() + listOf(-1, -1)

    // Scroll to initial position
    LaunchedEffect(Unit) {
        listState.scrollToItem(initialIndex)
    }

    LazyColumn(
        state = listState,
        modifier = modifier.height(drumHeight.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        flingBehavior = rememberSnapFlingBehavior(listState)
    ) {
        items(paddedItems.size) { index ->
            val paddedItem = paddedItems[index]
            val isSelected = index == listState.firstVisibleItemIndex + 2
            val isPadding = paddedItem == -1

            Box(
                modifier = Modifier
                    .height(itemHeight.dp)
                    .fillMaxWidth()
                    .alpha(if (isPadding) 0f else if (isSelected) 1f else 0.4f)
                    .clickable(enabled = !isPadding) {
                        coroutineScope.launch {
                            listState.animateScrollToItem(index - 2)
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                if (!isPadding) {
                    val actualIndex = paddedItem
                    val itemFontSize = if (isSelected) {
                        if (isSmallScreen) 22.sp else 26.sp // 1.4em / 1.6em
                    } else {
                        if (isSmallScreen) 19.sp else 22.sp // 1.2em / 1.4em
                    }
                    Text(
                        text = formatItem(items[actualIndex]),
                        fontFamily = LoraFontFamily,
                        fontSize = itemFontSize,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        // Selected item color is transparent (hidden behind input overlay)
                        color = if (isSelected) Color.Transparent else DrumItemColor,
                        textAlign = TextAlign.Center,
                        modifier = if (isSelected) {
                            Modifier.graphicsLayer(scaleX = 1.05f, scaleY = 1.05f)
                        } else Modifier
                    )
                }
            }
        }
    }
}


// ─── Snap Fling Behavior ─────────────────────────────────────────────────────

@Composable
private fun rememberSnapFlingBehavior(
    listState: LazyListState
): FlingBehavior {
    val coroutineScope = rememberCoroutineScope()
    return remember {
        object : FlingBehavior {
            override suspend fun ScrollScope.performFling(initialVelocity: Float): Float {
                val currentIndex = listState.firstVisibleItemIndex
                val offset = listState.firstVisibleItemScrollOffset
                val itemHeightPx = listState.layoutInfo.visibleItemsInfo.firstOrNull()?.size ?: 1
                val targetIndex = if (offset > itemHeightPx / 2) {
                    currentIndex + 1
                } else {
                    currentIndex
                }
                coroutineScope.launch {
                    listState.animateScrollToItem(targetIndex)
                }
                return 0f
            }
        }
    }
}

// ─── Overwrite-Mode Input Field ──────────────────────────────────────────────

private data class InputValidationResult(val text: String, val complete: Boolean)

private fun validateHourInput(text: String, is24Hour: Boolean): InputValidationResult? {
    if (text.isEmpty()) return InputValidationResult("", false)
    val digits = text.filter { it.isDigit() }
    if (digits.isEmpty()) return null

    if (digits.length == 1) {
        val d = digits[0].digitToInt()
        val maxFirst = if (is24Hour) 2 else 1
        return if (d <= maxFirst) {
            InputValidationResult(digits, false)
        } else {
            // Single digit that's already a valid complete hour
            val fullNum = d
            val max = if (is24Hour) 23 else 12
            val min = if (is24Hour) 0 else 1
            if (fullNum in min..max) {
                InputValidationResult(if (is24Hour) String.format("%02d", fullNum) else fullNum.toString(), true)
            } else null
        }
    }

    if (digits.length >= 2) {
        val twoDigit = digits.substring(0, 2)
        val num = twoDigit.toIntOrNull() ?: return null
        val max = if (is24Hour) 23 else 12
        val min = if (is24Hour) 0 else 1
        return if (num in min..max) {
            InputValidationResult(if (is24Hour) String.format("%02d", num) else num.toString(), true)
        } else null
    }
    return null
}

private fun validateMinuteInput(text: String): InputValidationResult? {
    if (text.isEmpty()) return InputValidationResult("", false)
    val digits = text.filter { it.isDigit() }
    if (digits.isEmpty()) return null

    if (digits.length == 1) {
        val d = digits[0].digitToInt()
        return if (d <= 5) {
            InputValidationResult(digits, false)
        } else {
            // Single digit > 5 means it's a complete minute (06-09 not valid as first digit)
            InputValidationResult(String.format("%02d", d), true)
        }
    }

    if (digits.length >= 2) {
        val twoDigit = digits.substring(0, 2)
        val num = twoDigit.toIntOrNull() ?: return null
        return if (num in 0..59) {
            InputValidationResult(String.format("%02d", num), true)
        } else null
    }
    return null
}

@Composable
private fun OverwriteInput(
    value: TextFieldValue,
    onValueChange: (TextFieldValue) -> Unit,
    focusRequester: FocusRequester,
    onEnter: () -> Unit,
    onEscape: () -> Unit,
    modifier: Modifier = Modifier,
    fontSize: androidx.compose.ui.unit.TextUnit = 24.sp
) {
    var isFocused by remember { mutableStateOf(false) }

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .focusRequester(focusRequester)
            .onFocusChanged { focusState ->
                isFocused = focusState.isFocused
                if (focusState.isFocused) {
                    // Select all on focus
                }
            }
            .background(
                if (isFocused) InputFocusBg else Color.Transparent,
                RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
            )
            .onPreviewKeyEvent { keyEvent ->
                if (keyEvent.type == KeyEventType.KeyDown) {
                    when (keyEvent.key) {
                        Key.Enter -> { onEnter(); true }
                        Key.Escape, Key.Back -> { onEscape(); true }
                        else -> false
                    }
                } else false
            },
        textStyle = TextStyle(
            fontFamily = LoraFontFamily,
            fontSize = fontSize,
            fontWeight = FontWeight.Bold,
            color = InputText,
            textAlign = TextAlign.Center
        ),
        cursorBrush = SolidColor(InputCaret),
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Number,
            imeAction = ImeAction.Next
        ),
        keyboardActions = KeyboardActions(
            onNext = { /* handled by validation logic */ }
        ),
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .height(40.dp)
                    .then(
                        if (isFocused) Modifier.border(
                            width = 2.dp,
                            color = InputCaret,
                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                        ).padding(bottom = 0.dp)
                        else Modifier.border(
                            width = 2.dp,
                            color = Color.Transparent,
                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                innerTextField()
            }
        }
    )
}

@Composable
private fun AmPmInput(
    value: TextFieldValue,
    onValueChange: (TextFieldValue) -> Unit,
    focusRequester: FocusRequester,
    onEnter: () -> Unit,
    onEscape: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .width(48.dp) // 2.4em
            .focusRequester(focusRequester)
            .onFocusChanged { isFocused = it.isFocused }
            .background(
                if (isFocused) InputFocusBg else Color.Transparent,
                RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
            )
            .onPreviewKeyEvent { keyEvent ->
                if (keyEvent.type == KeyEventType.KeyDown) {
                    when (keyEvent.key) {
                        Key.Enter -> { onEnter(); true }
                        Key.Escape, Key.Back -> { onEscape(); true }
                        else -> false
                    }
                } else false
            },
        textStyle = TextStyle(
            fontFamily = LoraFontFamily,
            fontSize = 19.sp, // 1.2em
            fontWeight = FontWeight.Bold,
            color = InputText,
            textAlign = TextAlign.Center
        ),
        cursorBrush = SolidColor(InputCaret),
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Text,
            imeAction = ImeAction.Done
        ),
        keyboardActions = KeyboardActions(
            onDone = { onEnter() }
        ),
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .height(40.dp)
                    .then(
                        if (isFocused) Modifier.border(
                            width = 2.dp,
                            color = InputCaret,
                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                        )
                        else Modifier.border(
                            width = 2.dp,
                            color = Color.Transparent,
                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                innerTextField()
            }
        }
    )
}

// ─── Button Component with pressed scale(0.96) ──────────────────────────────

@Composable
private fun DrumRollerButton(
    text: String,
    backgroundColor: Color,
    textColor: Color,
    borderColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    Box(
        modifier = modifier
            .height(42.dp)
            .graphicsLayer {
                if (isPressed) {
                    scaleX = 0.96f
                    scaleY = 0.96f
                }
            }
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .border(1.5.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(
                interactionSource = interactionSource,
                indication = null
            ) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontFamily = LoraFontFamily,
            fontSize = 15.sp, // 0.95em
            fontWeight = FontWeight.SemiBold,
            color = textColor,
            textAlign = TextAlign.Center
        )
    }
}
