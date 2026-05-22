package com.cwoc.app.ui.screens.map

import android.graphics.Point
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.Canvas as ComposeCanvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

private val HighlightGold = Color(0xFFFFD700)
private val HighlightGoldAlpha = Color(0x66FFD700)

/**
 * HighlightMarker composable — renders a gold pulsing circle overlay at the highlight GeoPoint
 * with a popup showing the address text on the osmdroid MapView.
 *
 * The pulsing animation uses InfiniteTransition with scale 1.0→1.3→1.0.
 * Auto-removal after 8 seconds is controlled by the ViewModel's focusState.highlightVisible.
 *
 * This composable manages two things:
 * 1. An osmdroid Marker overlay on the MapView for the address popup (info window)
 * 2. A Compose Canvas overlay that draws the pulsing gold circle at the marker's screen position
 */
@Composable
fun HighlightMarker(
    mapView: MapView?,
    geoPoint: GeoPoint,
    address: String,
    visible: Boolean,
    modifier: Modifier = Modifier
) {
    if (!visible || mapView == null) return

    // ─── Pulsing Animation ──────────────────────────────────────────────────
    val infiniteTransition = rememberInfiniteTransition(label = "highlightPulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.3f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    // ─── osmdroid Marker for popup ──────────────────────────────────────────
    val highlightMarker = remember(geoPoint, address) {
        Marker(mapView).apply {
            position = geoPoint
            title = address
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
            // Don't show default marker icon — we draw our own pulsing circle via Compose Canvas
            icon = null
        }
    }

    // Add/remove the osmdroid marker overlay
    DisposableEffect(highlightMarker) {
        mapView.overlays.add(highlightMarker)
        // Show the info window (popup) with the address
        highlightMarker.showInfoWindow()
        mapView.invalidate()
        onDispose {
            highlightMarker.closeInfoWindow()
            mapView.overlays.remove(highlightMarker)
            mapView.invalidate()
        }
    }

    // ─── Screen position tracking ───────────────────────────────────────────
    var screenPoint by remember { mutableStateOf<Point?>(null) }

    // Periodically update the screen position of the GeoPoint (handles map panning)
    LaunchedEffect(geoPoint, visible) {
        while (visible) {
            mapView.projection?.let { projection ->
                val point = Point()
                projection.toPixels(geoPoint, point)
                screenPoint = point
            }
            delay(16L) // ~60fps refresh for smooth tracking
        }
    }

    // ─── Compose Canvas overlay for pulsing gold circle ─────────────────────
    val density = LocalDensity.current
    val baseRadiusPx = with(density) { 20.dp.toPx() }

    screenPoint?.let { point ->
        ComposeCanvas(modifier = modifier.fillMaxSize()) {
            val centerX = point.x.toFloat()
            val centerY = point.y.toFloat()
            val animatedRadius = baseRadiusPx * scale

            // Outer glow circle (semi-transparent)
            drawCircle(
                color = HighlightGoldAlpha,
                radius = animatedRadius,
                center = Offset(centerX, centerY)
            )

            // Inner solid circle
            drawCircle(
                color = HighlightGold,
                radius = baseRadiusPx * 0.5f,
                center = Offset(centerX, centerY)
            )

            // Ring outline
            drawCircle(
                color = HighlightGold,
                radius = animatedRadius,
                center = Offset(centerX, centerY),
                style = Stroke(width = 3f)
            )
        }
    }
}
