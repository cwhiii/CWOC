package com.cwoc.app.ui.screens.map

import android.widget.TextView
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.infowindow.InfoWindow
import com.cwoc.app.R

/**
 * MarkerTooltipInfoWindow — A custom osmdroid InfoWindow that renders a small permanent
 * title label above each marker, matching the Mobile_Web's .maps-title-tooltip appearance.
 *
 * Style: Lora-inspired serif font, 11sp, semi-transparent parchment background (#fff8e1 at 90%),
 * brown border (#8b5a2b), dark brown text (#2b1e0f), 4dp corner radius.
 *
 * Behavior:
 * - Shown permanently above each marker (opened immediately after marker is added)
 * - Hidden when a popup is open for that marker (to avoid visual overlap)
 * - Restored when the popup is closed
 *
 * Usage in MapClusterManager:
 *   val tooltip = MarkerTooltipInfoWindow(mapView, markerTitle)
 *   marker.infoWindow = tooltip
 *   tooltip.open(marker, marker.position, TOOLTIP_OFFSET_X, TOOLTIP_OFFSET_Y)
 */
class MarkerTooltipInfoWindow(
    mapView: MapView,
    private val tooltipText: String
) : InfoWindow(R.layout.marker_tooltip, mapView) {

    override fun onOpen(item: Any?) {
        val textView = mView?.findViewById<TextView>(R.id.tooltip_text)
        textView?.text = tooltipText
    }

    override fun onClose() {
        // No cleanup needed — the view is managed by osmdroid
    }

    companion object {
        /** Vertical offset (pixels) to position tooltip above the marker icon */
        const val TOOLTIP_OFFSET_Y = -20
        /** Horizontal offset — centered */
        const val TOOLTIP_OFFSET_X = 0
    }
}
