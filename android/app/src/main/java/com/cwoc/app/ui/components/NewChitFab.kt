package com.cwoc.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.cwoc.app.R
import kotlin.math.cos
import kotlin.math.sin

/**
 * Regular hexagon shape with points at top and bottom (flat sides left/right).
 * All sides equal length, all interior angles 120°.
 */
private val HexagonShape = object : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val path = Path()
        val cx = size.width / 2f
        val cy = size.height / 2f
        val radius = minOf(cx, cy)

        // Start at top point, go clockwise
        for (i in 0 until 6) {
            val angleDeg = -90.0 + i * 60.0
            val angleRad = Math.toRadians(angleDeg)
            val x = cx + radius * cos(angleRad).toFloat()
            val y = cy + radius * sin(angleRad).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        return Outline.Generic(path)
    }
}

/**
 * Shared FAB for creating new chits.
 *
 * - Tap: navigates to the chit editor (new chit)
 * - Long-press: opens the Quick Alert sheet (same as right-click on web)
 *
 * Uses a Surface + pointerInput instead of FloatingActionButton to avoid
 * the internal clickable modifier consuming touch events before detectTapGestures.
 *
 * Shape: regular hexagon with points at top and bottom.
 * Icon: create_new.png (same image as the web sidebar used to have).
 */
@Composable
fun NewChitFab(
    onTap: () -> Unit,
    onLongPress: (() -> Unit)? = null
) {
    Surface(
        modifier = Modifier
            .padding(bottom = 16.dp)
            .size(64.dp)
            .pointerInput(onTap, onLongPress) {
                detectTapGestures(
                    onTap = { onTap() },
                    onLongPress = { onLongPress?.invoke() }
                )
            },
        shape = HexagonShape,
        color = MaterialTheme.colorScheme.primary,
        shadowElevation = 6.dp,
        tonalElevation = 6.dp
    ) {
        Box(contentAlignment = Alignment.Center) {
            Image(
                painter = painterResource(id = R.drawable.create_new),
                contentDescription = "Create new chit",
                modifier = Modifier.size(32.dp)
            )
        }
    }
}
