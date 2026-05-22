package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

/**
 * Inline map preview composable that displays a static osmdroid MapView
 * centered on the given coordinates with a marker pin.
 *
 * Touch interactions are disabled — the map is display-only.
 * Fixed height 200dp, full width, with rounded corners.
 *
 * Uses DisposableEffect for proper MapView lifecycle management (onResume/onPause/onDetach).
 *
 * Validates: Requirements 2.1, 2.2
 */
@Composable
fun InlineMapPreview(
    lat: Double,
    lon: Double,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var mapViewRef by remember { mutableStateOf<MapView?>(null) }

    AndroidView(
        factory = { ctx ->
            MapView(ctx).apply {
                // Configure osmdroid
                Configuration.getInstance().apply {
                    userAgentValue = "CWOC-Android/1.0"
                    osmdroidTileCache = ctx.cacheDir.resolve("osmdroid").also { it.mkdirs() }
                }

                // Set tile source and zoom level 15
                setTileSource(TileSourceFactory.MAPNIK)
                controller.setZoom(15.0)
                controller.setCenter(GeoPoint(lat, lon))

                // Disable all touch interactions (display only)
                setMultiTouchControls(false)
                setBuiltInZoomControls(false)
                isHorizontalMapRepetitionEnabled = false
                isVerticalMapRepetitionEnabled = false

                // Intercept all touch events so the map doesn't respond to gestures
                setOnTouchListener { _, _ -> true }

                // Place marker at center point
                val marker = Marker(this)
                marker.position = GeoPoint(lat, lon)
                marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                marker.setOnMarkerClickListener { _, _ -> true } // consume click
                overlays.add(marker)

                mapViewRef = this
            }
        },
        update = { view ->
            // Update center and marker if coordinates change
            view.controller.setCenter(GeoPoint(lat, lon))
            view.overlays.removeAll { it is Marker }
            val marker = Marker(view)
            marker.position = GeoPoint(lat, lon)
            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            marker.setOnMarkerClickListener { _, _ -> true }
            view.overlays.add(marker)
            view.invalidate()
        },
        modifier = modifier
            .fillMaxWidth()
            .height(200.dp)
            .clip(RoundedCornerShape(8.dp))
    )

    // Proper lifecycle management for the MapView
    DisposableEffect(Unit) {
        mapViewRef?.onResume()
        onDispose {
            mapViewRef?.onPause()
            mapViewRef?.onDetach()
        }
    }
}
