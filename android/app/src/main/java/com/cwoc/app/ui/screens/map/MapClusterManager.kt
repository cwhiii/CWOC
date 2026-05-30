package com.cwoc.app.ui.screens.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import kotlin.math.cos
import kotlin.math.sin

/**
 * MapClusterManager — Custom marker clustering for osmdroid.
 *
 * Groups nearby markers at low zoom levels into cluster icons showing the count.
 * Cluster shapes match the Mobile_Web implementation:
 * - Chit-only clusters: rounded-square, amber/brown gradient
 * - People-only clusters: circle, teal gradient
 * - Mixed clusters: hexagon, purple gradient with "chitCount/contactCount" label
 *
 * On cluster tap, zooms the map to reveal individual markers within that cluster.
 *
 * Clustering algorithm:
 * - At each zoom level, compute a pixel-distance threshold
 * - Group markers whose projected screen positions are within that threshold
 * - Replace groups with a single cluster marker at the group centroid
 * - Individual markers outside any cluster are shown as-is
 */
object MapClusterManager {

    // ─── Configuration ──────────────────────────────────────────────────────

    /** Pixel radius within which markers are grouped into a cluster */
    private const val CLUSTER_RADIUS_PX = 80

    /** Minimum number of markers to form a cluster (2 = any overlap clusters) */
    private const val MIN_CLUSTER_SIZE = 2

    // ─── Cluster Icon Sizes (dp) ────────────────────────────────────────────

    private const val SMALL_SIZE_DP = 34f   // < 10 markers
    private const val MEDIUM_SIZE_DP = 44f  // 10-99 markers
    private const val LARGE_SIZE_DP = 54f   // 100+ markers

    // ─── Colors (matching web CSS) ──────────────────────────────────────────

    // Chit cluster: amber/brown gradient
    private const val CHIT_GRADIENT_START = 0xFFD4A373.toInt()  // #d4a373
    private const val CHIT_GRADIENT_END = 0xFF8B5A2B.toInt()    // #8b5a2b

    // People cluster: teal gradient
    private const val PEOPLE_GRADIENT_START = 0xFF00897B.toInt() // #00897b
    private const val PEOPLE_GRADIENT_END = 0xFF00695C.toInt()   // #00695c

    // Mixed cluster: purple gradient
    private const val MIXED_GRADIENT_START = 0xFF7B5EA7.toInt()  // #7b5ea7
    private const val MIXED_GRADIENT_END = 0xFF5A3D7A.toInt()    // #5a3d7a

    // Alert borders
    private const val BLOCKED_BORDER_COLOR = 0xFFF44336.toInt()  // Red
    private const val OVERDUE_BORDER_COLOR = 0xFFFF9800.toInt()  // Orange

    // ─── Data Classes ───────────────────────────────────────────────────────

    /**
     * Represents a cluster of markers grouped by proximity.
     */
    data class MarkerCluster(
        val markers: List<ChitMarker>,
        val centroid: GeoPoint,
        val chitCount: Int,
        val contactCount: Int,
        val hasBlocked: Boolean,
        val hasOverdue: Boolean
    ) {
        val totalCount: Int get() = markers.size
        val isChitOnly: Boolean get() = contactCount == 0 && chitCount > 0
        val isPeopleOnly: Boolean get() = chitCount == 0 && contactCount > 0
        val isMixed: Boolean get() = chitCount > 0 && contactCount > 0
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Computes clusters from the given markers based on the current map zoom level.
     * Returns a list of osmdroid Marker overlays (individual markers + cluster markers).
     *
     * @param context Android context for density calculations
     * @param mapView The osmdroid MapView (used for projection calculations)
     * @param chitMarkers All markers to cluster
     * @param onMarkerClick Callback when an individual marker is tapped
     * @param onClusterClick Callback when a cluster is tapped (receives the cluster's bounding box)
     * @param popupOpenMarkerId The chitId of the marker whose popup is currently open (tooltip hidden for this marker)
     */
    fun buildClusteredOverlays(
        context: Context,
        mapView: MapView,
        chitMarkers: List<ChitMarker>,
        onMarkerClick: (ChitMarker) -> Unit,
        onClusterClick: (BoundingBox) -> Unit,
        popupOpenMarkerId: String? = null
    ): List<Marker> {
        if (chitMarkers.isEmpty()) return emptyList()

        val clusters = computeClusters(mapView, chitMarkers)
        val result = mutableListOf<Marker>()

        for (cluster in clusters) {
            if (cluster.totalCount == 1) {
                // Single marker — render as individual styled marker with permanent tooltip
                val chitMarker = cluster.markers[0]
                val marker = Marker(mapView).apply {
                    position = chitMarker.geoPoint
                    title = chitMarker.title
                    snippet = chitMarker.type ?: ""
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    icon = MapMarkerDrawer.createMarkerDrawable(context, chitMarker)
                    setOnMarkerClickListener { _, _ ->
                        onMarkerClick(chitMarker)
                        true
                    }
                }

                // Attach permanent tooltip (title label above marker)
                val tooltipTitle = chitMarker.title.take(30) // Truncate long titles
                if (tooltipTitle.isNotBlank()) {
                    val tooltip = MarkerTooltipInfoWindow(mapView, tooltipTitle)
                    marker.infoWindow = tooltip

                    // Show tooltip unless popup is open for this marker
                    if (popupOpenMarkerId != chitMarker.chitId) {
                        marker.showInfoWindow()
                    }
                }

                result.add(marker)
            } else {
                // Cluster marker — render as cluster icon (no tooltip for clusters)
                val clusterIcon = createClusterDrawable(context, cluster)
                val marker = Marker(mapView).apply {
                    position = cluster.centroid
                    title = "${cluster.totalCount} markers"
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    icon = clusterIcon
                    // No tooltip for cluster markers
                    infoWindow = null
                    setOnMarkerClickListener { _, _ ->
                        val bounds = computeClusterBounds(cluster)
                        onClusterClick(bounds)
                        true
                    }
                }
                result.add(marker)
            }
        }

        return result
    }

    // ─── Clustering Algorithm ───────────────────────────────────────────────

    /**
     * Groups markers into clusters based on screen-space proximity.
     * Uses a simple greedy algorithm: iterate markers, assign each to the nearest
     * existing cluster within the radius threshold, or create a new cluster.
     */
    private fun computeClusters(mapView: MapView, markers: List<ChitMarker>): List<MarkerCluster> {
        val projection = mapView.projection
        val density = mapView.context.resources.displayMetrics.density
        val radiusPx = CLUSTER_RADIUS_PX * density

        // Project all markers to screen coordinates
        data class ProjectedMarker(
            val marker: ChitMarker,
            val screenX: Float,
            val screenY: Float
        )

        val projected = markers.map { m ->
            val point = projection.toPixels(m.geoPoint, null)
            ProjectedMarker(m, point.x.toFloat(), point.y.toFloat())
        }

        // Greedy clustering
        val assigned = BooleanArray(projected.size)
        val clusters = mutableListOf<MutableList<ProjectedMarker>>()

        for (i in projected.indices) {
            if (assigned[i]) continue

            val cluster = mutableListOf(projected[i])
            assigned[i] = true

            // Compute cluster center as running average
            var cx = projected[i].screenX
            var cy = projected[i].screenY

            for (j in i + 1 until projected.size) {
                if (assigned[j]) continue

                val dx = projected[j].screenX - cx
                val dy = projected[j].screenY - cy
                val dist = Math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()

                if (dist <= radiusPx) {
                    cluster.add(projected[j])
                    assigned[j] = true
                    // Update centroid
                    cx = cluster.sumOf { it.screenX.toDouble() }.toFloat() / cluster.size
                    cy = cluster.sumOf { it.screenY.toDouble() }.toFloat() / cluster.size
                }
            }

            clusters.add(cluster)
        }

        // Convert to MarkerCluster objects
        return clusters.map { group ->
            val groupMarkers = group.map { it.marker }

            // Compute geographic centroid
            val avgLat = groupMarkers.sumOf { it.geoPoint.latitude } / groupMarkers.size
            val avgLon = groupMarkers.sumOf { it.geoPoint.longitude } / groupMarkers.size

            // Count types
            var chitCount = 0
            var contactCount = 0
            var hasBlocked = false
            var hasOverdue = false

            for (m in groupMarkers) {
                when (m.type) {
                    "contact" -> contactCount++
                    "saved" -> {} // Saved locations don't count toward clustering types
                    else -> {
                        chitCount++
                        if (m.type == "Blocked") hasBlocked = true
                        if (m.isOverdue) hasOverdue = true
                    }
                }
            }

            MarkerCluster(
                markers = groupMarkers,
                centroid = GeoPoint(avgLat, avgLon),
                chitCount = chitCount,
                contactCount = contactCount,
                hasBlocked = hasBlocked,
                hasOverdue = hasOverdue
            )
        }
    }

    /**
     * Computes a bounding box that encompasses all markers in a cluster,
     * with padding so the zoom reveals them clearly.
     */
    private fun computeClusterBounds(cluster: MarkerCluster): BoundingBox {
        var north = -90.0
        var south = 90.0
        var east = -180.0
        var west = 180.0

        for (m in cluster.markers) {
            val lat = m.geoPoint.latitude
            val lon = m.geoPoint.longitude
            if (lat > north) north = lat
            if (lat < south) south = lat
            if (lon > east) east = lon
            if (lon < west) west = lon
        }

        // Add padding (10% of span, minimum 0.005 degrees)
        val latPad = maxOf((north - south) * 0.15, 0.005)
        val lonPad = maxOf((east - west) * 0.15, 0.005)

        return BoundingBox(
            north + latPad, east + lonPad,
            south - latPad, west - lonPad
        )
    }

    // ─── Cluster Icon Drawing ───────────────────────────────────────────────

    /**
     * Creates a cluster icon drawable based on the cluster composition.
     * - Chit-only: rounded-square with amber/brown gradient
     * - People-only: circle with teal gradient
     * - Mixed: hexagon with purple gradient, "chitCount/contactCount" label
     */
    private fun createClusterDrawable(context: Context, cluster: MarkerCluster): BitmapDrawable {
        val density = context.resources.displayMetrics.density
        val sizeDp = when {
            cluster.totalCount < 10 -> SMALL_SIZE_DP
            cluster.totalCount < 100 -> MEDIUM_SIZE_DP
            else -> LARGE_SIZE_DP
        }
        val size = (sizeDp * density).toInt()

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        when {
            cluster.isPeopleOnly -> drawPeopleCluster(canvas, size, density, cluster)
            cluster.isMixed -> drawMixedCluster(canvas, size, density, cluster)
            else -> drawChitCluster(canvas, size, density, cluster)
        }

        return BitmapDrawable(context.resources, bitmap)
    }

    /**
     * Draws a chit-only cluster: rounded-square with amber/brown gradient.
     */
    private fun drawChitCluster(canvas: Canvas, size: Int, density: Float, cluster: MarkerCluster) {
        val cornerRadius = 6f * density
        val rect = RectF(2f * density, 2f * density, size - 2f * density, size - 2f * density)

        // Gradient fill
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f, 0f, size.toFloat(), size.toFloat(),
                CHIT_GRADIENT_START, CHIT_GRADIENT_END,
                Shader.TileMode.CLAMP
            )
            style = Paint.Style.FILL
            setShadowLayer(4f * density, 0f, 2f * density, 0x59000000)
        }
        canvas.drawRoundRect(rect, cornerRadius, cornerRadius, fillPaint)

        // Alert border (blocked or overdue)
        if (cluster.hasBlocked || cluster.hasOverdue) {
            val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (cluster.hasBlocked) BLOCKED_BORDER_COLOR else OVERDUE_BORDER_COLOR
                style = Paint.Style.STROKE
                strokeWidth = 2f * density
            }
            val borderRect = RectF(
                3f * density, 3f * density,
                size - 3f * density, size - 3f * density
            )
            canvas.drawRoundRect(borderRect, cornerRadius, cornerRadius, borderPaint)
        }

        // Count text
        drawCountText(canvas, size, density, cluster.totalCount.toString())
    }

    /**
     * Draws a people-only cluster: circle with teal gradient.
     */
    private fun drawPeopleCluster(canvas: Canvas, size: Int, density: Float, cluster: MarkerCluster) {
        val cx = size / 2f
        val cy = size / 2f
        val radius = (size / 2f) - 2f * density

        // Gradient fill
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f, 0f, size.toFloat(), size.toFloat(),
                PEOPLE_GRADIENT_START, PEOPLE_GRADIENT_END,
                Shader.TileMode.CLAMP
            )
            style = Paint.Style.FILL
            setShadowLayer(4f * density, 0f, 2f * density, 0x59000000)
        }
        canvas.drawCircle(cx, cy, radius, fillPaint)

        // Count text
        drawCountText(canvas, size, density, cluster.totalCount.toString())
    }

    /**
     * Draws a mixed cluster: hexagon with purple gradient, "chitCount/contactCount" label.
     */
    private fun drawMixedCluster(canvas: Canvas, size: Int, density: Float, cluster: MarkerCluster) {
        val cx = size / 2f
        val cy = size / 2f
        val radius = (size / 2f) - 2f * density

        // Create hexagon path
        val hexPath = createHexagonPath(cx, cy, radius)

        // Gradient fill
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f, 0f, size.toFloat(), size.toFloat(),
                MIXED_GRADIENT_START, MIXED_GRADIENT_END,
                Shader.TileMode.CLAMP
            )
            style = Paint.Style.FILL
            setShadowLayer(4f * density, 0f, 2f * density, 0x59000000)
        }
        canvas.drawPath(hexPath, fillPaint)

        // Count text: "chitCount/contactCount"
        val label = "${cluster.chitCount}/${cluster.contactCount}"
        drawCountText(canvas, size, density, label, smallerFont = true)
    }

    /**
     * Draws centered white count text on the cluster icon.
     */
    private fun drawCountText(
        canvas: Canvas,
        size: Int,
        density: Float,
        text: String,
        smallerFont: Boolean = false
    ) {
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
            textSize = if (smallerFont) 11f * density else 13f * density
        }

        val cx = size / 2f
        val cy = size / 2f
        // Vertically center text
        val textBounds = Rect()
        textPaint.getTextBounds(text, 0, text.length, textBounds)
        val textY = cy + textBounds.height() / 2f

        canvas.drawText(text, cx, textY, textPaint)
    }

    /**
     * Creates a hexagon path centered at (cx, cy) with the given radius.
     * Points at top and bottom (flat sides on left/right).
     */
    private fun createHexagonPath(cx: Float, cy: Float, radius: Float): Path {
        val path = Path()
        // Start from top (matching web's clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%))
        val startAngle = -Math.PI / 2.0
        for (i in 0 until 6) {
            val angle = startAngle + i * (Math.PI / 3.0)
            val x = cx + (radius * cos(angle)).toFloat()
            val y = cy + (radius * sin(angle)).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        return path
    }
}
