package com.cwoc.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
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
import kotlinx.coroutines.launch
import java.time.LocalTime
import kotlin.math.abs
import kotlin.math.roundToInt

// ─── Colors ──────────────────────────────────────────────────────────────────
private val ModalBg = Color(0xFFFFFAF0)
private val ModalBorder = Color(0xFF6B4E31)
private val HeaderText = Color(0xFF3A2A14)
private val DrumItemColor = Color(0xFF6B4E31)
private val HighlightBg = Color(0x1A8B5A2B)
private val HighlightBorder = Color(0x4D8B5A2B)
private val CancelBg = Color(0xFFF5E6CC)
private val CancelText = Color(0xFF6B4E31)
private val NowBg = Color(0xFFE8DCC8)
private val NowText = Color(0xFF3A2A14)
private val SetBg = Color(0xFF6B4E31)
private val SetText = Color(0xFFFFF8E1)
private val SetBorder = Color(0xFF4A3520)
private val FadeMaskColor = Color(0xFFFFFAF0)
private val OverlayBg = Color(0x80000000)
private val InputCaret = Color(0xFF6B4E31)
private val InputFocusBg = Color(0xE6FFFAF0)

private val SlideDownEasing = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)

/**
 * Drum roller time picker.
 *
 * - Constant scroll speed: 1 item per [itemHeightPx] of drag.
 * - "Fine" checkbox toggles between snap-interval minutes and all 60 minutes.
 * - Tap center value to type directly.
 * - Honors 24h/12h setting via [is24Hour].
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
    val itemHeightDp = if (isSmallScreen) 40 else 48
    val visibleCount = 5
    val drumHeightDp = itemHeightDp * visibleCount

    var selectedHour by remember { mutableIntStateOf(initialHour.coerceIn(0, 23)) }
    var selectedMinute by remember { mutableIntStateOf(initialMinute.coerceIn(0, 59)) }
    var selectedAmPm by remember { mutableIntStateOf(if (initialHour >= 12) 1 else 0) }
    var fineMode by remember { mutableStateOf(false) }
    var editingDrum by remember { mutableStateOf<String?>(null) }

    val overlayAlpha = remember { Animatable(0f) }
    val slideOffset = remember { Animatable(-1f) }
    LaunchedEffect(Unit) {
        launch { overlayAlpha.animateTo(1f, tween(200)) }
        launch { slideOffset.animateTo(0f, tween(300, easing = SlideDownEasing)) }
    }

    val effectiveStep = minuteStep.coerceIn(1, 60)
    val snappedMinuteItems = remember(effectiveStep) {
        (0 until 60 step effectiveStep).toList()
    }
    val allMinuteItems = remember { (0..59).toList() }
    val currentMinuteItems = if (fineMode) allMinuteItems else snappedMinuteItems

    // Hour items: 0-23 for 24h, 1-12 for 12h
    val hourItems = remember(is24Hour) {
        if (is24Hour) (0..23).toList() else (1..12).toList()
    }

    fun toDisplayHour(h24: Int): Int = if (is24Hour) h24 else when {
        h24 == 0 -> 12; h24 > 12 -> h24 - 12; else -> h24
    }
    fun to24Hour(displayH: Int, amPm: Int): Int = if (is24Hour) displayH else when {
        displayH == 12 && amPm == 0 -> 0
        displayH == 12 && amPm == 1 -> 12
        amPm == 1 -> displayH + 12
        else -> displayH
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
    ) {
        Box(
            modifier = Modifier.fillMaxSize().alpha(overlayAlpha.value).background(OverlayBg)
                .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { onDismiss() },
            contentAlignment = Alignment.TopCenter
        ) {
            Box(
                modifier = Modifier.fillMaxWidth().widthIn(max = 400.dp)
                    .graphicsLayer { translationY = slideOffset.value * -size.height }
                    .shadow(20.dp, RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
                    .background(ModalBg, RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
                    .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) {
                        // Tap on modal background clears editing mode (returns to scroll)
                        editingDrum = null
                    }
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(12.dp, 16.dp, 12.dp, 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Select Time", fontFamily = LoraFontFamily, fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold, color = HeaderText,
                        textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 12.dp))

                    // Drum container
                    Box(
                        modifier = Modifier.height(drumHeightDp.dp).widthIn(max = 320.dp).fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        // Highlight bar
                        Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
                            .height(itemHeightDp.dp)
                            .background(HighlightBg, RoundedCornerShape(6.dp))
                            .border(1.5.dp, HighlightBorder, RoundedCornerShape(6.dp)))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Hour drum
                            DrumColumn(
                                items = hourItems,
                                selectedIndex = hourItems.indexOf(toDisplayHour(selectedHour)).coerceAtLeast(0),
                                onSelectedIndexChanged = { idx ->
                                    selectedHour = to24Hour(hourItems[idx], selectedAmPm)
                                },
                                itemHeightDp = itemHeightDp, drumHeightDp = drumHeightDp,
                                isSmallScreen = isSmallScreen,
                                formatItem = { if (is24Hour) String.format("%02d", it) else it.toString() },
                                isEditing = editingDrum == "hour",
                                onCenterTap = { editingDrum = "hour" },
                                maxFirstDigit = if (is24Hour) 2 else 1,
                                onEditCommit = { text ->
                                    val num = text.toIntOrNull() ?: run { editingDrum = null; return@DrumColumn }
                                    if (is24Hour && num in 0..23) selectedHour = num
                                    else if (!is24Hour && num in 1..12) selectedHour = to24Hour(num, selectedAmPm)
                                    // Advance to minute drum
                                    editingDrum = "minute"
                                },
                                onEditCancel = { editingDrum = null },
                                modifier = Modifier.weight(1f)
                            )

                            Text(":", fontFamily = LoraFontFamily, fontSize = 28.sp,
                                fontWeight = FontWeight.Bold, color = HeaderText,
                                modifier = Modifier.padding(horizontal = 2.dp))

                            // Minute drum
                            DrumColumn(
                                items = currentMinuteItems,
                                selectedIndex = currentMinuteItems.indexOf(selectedMinute).let { idx ->
                                    if (idx >= 0) idx else currentMinuteItems.indices.minByOrNull { abs(currentMinuteItems[it] - selectedMinute) } ?: 0
                                },
                                onSelectedIndexChanged = { idx -> selectedMinute = currentMinuteItems[idx] },
                                itemHeightDp = itemHeightDp, drumHeightDp = drumHeightDp,
                                isSmallScreen = isSmallScreen,
                                formatItem = { String.format("%02d", it) },
                                isEditing = editingDrum == "minute",
                                onCenterTap = { editingDrum = "minute" },
                                maxFirstDigit = 5,
                                onEditCommit = { text ->
                                    editingDrum = null
                                    val num = text.toIntOrNull() ?: return@DrumColumn
                                    if (num in 0..59) {
                                        selectedMinute = num
                                        if (!snappedMinuteItems.contains(num)) fineMode = true
                                    }
                                },
                                onEditCancel = { editingDrum = null },
                                modifier = Modifier.weight(1f)
                            )

                            // AM/PM drum (12h only)
                            if (!is24Hour) {
                                Spacer(Modifier.width(8.dp))
                                DrumColumn(
                                    items = listOf(0, 1),
                                    selectedIndex = selectedAmPm,
                                    onSelectedIndexChanged = { idx ->
                                        selectedAmPm = idx
                                        selectedHour = to24Hour(toDisplayHour(selectedHour), idx)
                                    },
                                    itemHeightDp = itemHeightDp, drumHeightDp = drumHeightDp,
                                    isSmallScreen = isSmallScreen,
                                    formatItem = { if (it == 0) "AM" else "PM" },
                                    isEditing = false,
                                    onCenterTap = {
                                        selectedAmPm = if (selectedAmPm == 0) 1 else 0
                                        selectedHour = to24Hour(toDisplayHour(selectedHour), selectedAmPm)
                                    },
                                    onEditCommit = {}, onEditCancel = {},
                                    modifier = Modifier.weight(0.8f)
                                )
                            }
                        }

                        // Fade masks
                        Box(modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter).height(60.dp)
                            .background(Brush.verticalGradient(listOf(FadeMaskColor, FadeMaskColor.copy(alpha = 0f)))))
                        Box(modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter).height(60.dp)
                            .background(Brush.verticalGradient(listOf(FadeMaskColor.copy(alpha = 0f), FadeMaskColor))))
                    }

                    // Snap/All toggle (only show if step > 1)
                    if (effectiveStep > 1) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val snapActive = !fineMode
                            val allActive = fineMode
                            val pillShape = RoundedCornerShape(20.dp)
                            Row(
                                modifier = Modifier
                                    .border(1.5.dp, ModalBorder, pillShape)
                                    .background(CancelBg, pillShape)
                                    .padding(2.dp),
                                horizontalArrangement = Arrangement.Center
                            ) {
                                // Snap option
                                Box(
                                    modifier = Modifier
                                        .background(
                                            if (snapActive) SetBg else Color.Transparent,
                                            RoundedCornerShape(18.dp)
                                        )
                                        .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) {
                                            fineMode = false
                                            // Snap to nearest interval
                                            val nearest = snappedMinuteItems.minByOrNull { abs(it - selectedMinute) } ?: selectedMinute
                                            selectedMinute = nearest
                                        }
                                        .padding(horizontal = 16.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        "Snap", fontFamily = LoraFontFamily,
                                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                                        color = if (snapActive) SetText else CancelText
                                    )
                                }
                                // All option
                                Box(
                                    modifier = Modifier
                                        .background(
                                            if (allActive) SetBg else Color.Transparent,
                                            RoundedCornerShape(18.dp)
                                        )
                                        .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) {
                                            fineMode = true
                                        }
                                        .padding(horizontal = 16.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        "All", fontFamily = LoraFontFamily,
                                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                                        color = if (allActive) SetText else CancelText
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    // Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        DrumRollerButton("Cancel", CancelBg, CancelText, CancelText, onDismiss, Modifier.weight(1f))
                        DrumRollerButton("Now", NowBg, NowText, CancelText, {
                            val now = LocalTime.now()
                            val snapped = if (effectiveStep > 1 && !fineMode) {
                                ((now.minute + effectiveStep / 2) / effectiveStep) * effectiveStep
                            } else now.minute
                            val adjMin = if (snapped >= 60) 0 else snapped
                            val adjHour = if (snapped >= 60) (now.hour + 1) % 24 else now.hour
                            selectedHour = adjHour; selectedMinute = adjMin
                            selectedAmPm = if (adjHour >= 12) 1 else 0
                            editingDrum = null
                        }, Modifier.weight(1f))
                        DrumRollerButton("Set", SetBg, SetText, SetBorder, { onTimeSelected(selectedHour, selectedMinute) }, Modifier.weight(1f))
                    }
                }
                Box(modifier = Modifier.fillMaxWidth().height(3.dp).align(Alignment.BottomCenter).background(ModalBorder))
            }
        }
    }
}


// ─── Drum Column (constant speed scroll) ─────────────────────────────────────

@Composable
private fun DrumColumn(
    items: List<Int>,
    selectedIndex: Int,
    onSelectedIndexChanged: (Int) -> Unit,
    itemHeightDp: Int,
    drumHeightDp: Int,
    isSmallScreen: Boolean,
    formatItem: (Int) -> String,
    isEditing: Boolean = false,
    onCenterTap: () -> Unit = {},
    onEditCommit: (String) -> Unit = {},
    onEditCancel: () -> Unit = {},
    maxFirstDigit: Int = 9,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val itemHeightPx = with(density) { itemHeightDp.dp.toPx() }
    val coroutineScope = rememberCoroutineScope()

    // scrollOffset: pixels dragged from center. Positive = dragged down = earlier items.
    val scrollOffset = remember { Animatable(0f) }
    var currentIndex by remember { mutableIntStateOf(selectedIndex) }

    // Sync external changes (e.g. "Now" button)
    LaunchedEffect(selectedIndex) {
        if (currentIndex != selectedIndex) {
            currentIndex = selectedIndex
            scrollOffset.snapTo(0f)
        }
    }

    val halfVisible = drumHeightDp / itemHeightDp / 2

    Box(
        modifier = modifier
            .height(drumHeightDp.dp)
            .clipToBounds()
            .then(if (!isEditing) Modifier.pointerInput(items.size) {
                detectVerticalDragGestures(
                    onDragEnd = {
                        // Snap: figure out which item is closest to center
                        val offsetInItems = -(scrollOffset.value / itemHeightPx)
                        val snappedOffset = offsetInItems.roundToInt()
                        val newIndex = (currentIndex + snappedOffset).coerceIn(0, items.size - 1)
                        currentIndex = newIndex
                        onSelectedIndexChanged(newIndex)
                        coroutineScope.launch { scrollOffset.animateTo(0f, tween(150)) }
                    },
                    onDragCancel = {
                        coroutineScope.launch { scrollOffset.animateTo(0f, tween(150)) }
                    },
                    onVerticalDrag = { change, dragAmount ->
                        change.consume()
                        // Constant speed: direct 1:1 mapping of drag to offset
                        val newOffset = scrollOffset.value + dragAmount
                        // Clamp so you can't scroll past first/last item
                        val maxOffset = currentIndex * itemHeightPx
                        val minOffset = -(items.size - 1 - currentIndex) * itemHeightPx
                        coroutineScope.launch {
                            scrollOffset.snapTo(newOffset.coerceIn(minOffset, maxOffset))
                        }
                    }
                )
            } else Modifier),
        contentAlignment = Alignment.Center
    ) {
        if (isEditing) {
            // Inline text input
            val focusRequester = remember { FocusRequester() }
            var textValue by remember {
                mutableStateOf(TextFieldValue(
                    text = formatItem(items[currentIndex]),
                    selection = TextRange(0, formatItem(items[currentIndex]).length)
                ))
            }
            LaunchedEffect(Unit) { focusRequester.requestFocus() }

            BasicTextField(
                value = textValue,
                onValueChange = { nv ->
                    val filtered = nv.text.filter { it.isDigit() }.take(2)
                    textValue = TextFieldValue(filtered, TextRange(filtered.length))
                    if (filtered.length == 2) {
                        onEditCommit(filtered)
                    } else if (filtered.length == 1) {
                        val d = filtered[0].digitToInt()
                        if (d > maxFirstDigit) {
                            // Single digit that can't start a valid 2-digit value — pad with 0 and commit
                            onEditCommit("0$filtered")
                        }
                    }
                },
                modifier = Modifier.width(56.dp).height(itemHeightDp.dp)
                    .focusRequester(focusRequester)
                    .background(InputFocusBg, RoundedCornerShape(4.dp))
                    .border(2.dp, InputCaret, RoundedCornerShape(4.dp)),
                textStyle = TextStyle(
                    fontFamily = LoraFontFamily,
                    fontSize = if (isSmallScreen) 24.sp else 28.sp,
                    fontWeight = FontWeight.Bold, color = DrumItemColor,
                    textAlign = TextAlign.Center
                ),
                cursorBrush = SolidColor(InputCaret),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onEditCommit(textValue.text) }),
                decorationBox = { inner ->
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { inner() }
                }
            )
        } else {
            // Render items around center
            val offsetInItems = scrollOffset.value / itemHeightPx
            // The fractional item offset
            val fracOffset = scrollOffset.value % itemHeightPx

            for (i in -halfVisible - 1..halfVisible + 1) {
                val itemIndex = currentIndex - offsetInItems.roundToInt() + i
                if (itemIndex < 0 || itemIndex >= items.size) continue

                val yPx = i * itemHeightPx + fracOffset - (offsetInItems - offsetInItems.roundToInt()) * itemHeightPx
                // Skip items that are fully outside the drum
                if (abs(yPx) > (halfVisible + 1) * itemHeightPx) continue

                val distFromCenter = abs(yPx) / itemHeightPx
                val itemAlpha = (1f - distFromCenter * 0.3f).coerceIn(0.15f, 1f)
                val isCenter = abs(yPx) < itemHeightPx * 0.5f

                val fontSize = if (isCenter) {
                    if (isSmallScreen) 24.sp else 28.sp
                } else {
                    if (isSmallScreen) 17.sp else 20.sp
                }

                Box(
                    modifier = Modifier.height(itemHeightDp.dp).fillMaxWidth()
                        .graphicsLayer { translationY = yPx; alpha = itemAlpha }
                        .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) {
                            if (isCenter) onCenterTap()
                            else {
                                currentIndex = itemIndex
                                onSelectedIndexChanged(itemIndex)
                                coroutineScope.launch { scrollOffset.animateTo(0f, tween(150)) }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = formatItem(items[itemIndex]),
                        fontFamily = LoraFontFamily, fontSize = fontSize,
                        fontWeight = if (isCenter) FontWeight.Bold else FontWeight.Normal,
                        color = DrumItemColor, textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}


// ─── Button ──────────────────────────────────────────────────────────────────

@Composable
private fun DrumRollerButton(
    text: String, backgroundColor: Color, textColor: Color,
    borderColor: Color, onClick: () -> Unit, modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    Box(
        modifier = modifier.height(42.dp)
            .graphicsLayer { if (isPressed) { scaleX = 0.96f; scaleY = 0.96f } }
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .border(1.5.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(interactionSource = interactionSource, indication = null) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(text, fontFamily = LoraFontFamily, fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold, color = textColor, textAlign = TextAlign.Center)
    }
}
