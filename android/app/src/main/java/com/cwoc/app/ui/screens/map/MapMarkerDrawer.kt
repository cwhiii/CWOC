package com.cwoc.app.ui.screens.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import kotlin.math.cos
import kotlin.math.sin

/**
 * MapMarkerDrawer — Generates custom Bitmap/Drawable marker icons for the osmdroid map.
 *
 * Marker types:
 * - Chit markers: colored rounded-square (28×28dp equivalent, 6dp corner radius)
 * - Contact markers: colored circle (20dp diameter, matching Leaflet circleMarker radius=10)
 * - Saved location markers: gold star icon
 * - Overdue chit markers: red border/glow effect on the rounded-square
 *
 * Dimensions match the Mobile_Web implementation:
 * - Chit: 28×28px with border-radius:6px, border:2px solid #fff
 * - Contact: circleMarker radius:10, weight:2, fillOpacity:0.6
 * - Saved: gold star ⭐
 */
object MapMarkerDrawer {

    // ─── Marker Sizes (dp) ──────────────────────────────────────────────────

    private const val CHIT_SIZE_DP = 32f       // Slightly larger than web's 28px for touch targets
    private const val CONTACT_SIZE_DP = 28f    // Circle diameter (web uses radius=10 → 20px, scaled up for touch)
    private const val SAVED_SIZE_DP = 32f      // Star icon size
    private const val HIGHLIGHT_SIZE_DP = 44f  // Larger size for focus highlight marker
    private const val BORDER_WIDTH_DP = 2f     // Standard border width
    private const val OVERDUE_BORDER_DP = 3f   // Overdue red border width
    private const val CORNER_RADIUS_DP = 6f    // Rounded-square corner radius

    // ─── Colors ─────────────────────────────────────────────────────────────

    private const val OVERDUE_BORDER_COLOR = 0xFFF44336.toInt()  // Red
    private const val OVERDUE_GLOW_COLOR = 0x44F44336            // Semi-transparent red glow
    private const val DEFAULT_BORDER_COLOR = 0xFFFFFFFF.toInt()  // White border
    private const val SAVED_GOLD_COLOR = 0xFFFFD700.toInt()      // Gold for saved locations
    private const val SAVED_BORDER_COLOR = 0xFFB8860B.toInt()    // Dark goldenrod border
    private const val HIGHLIGHT_COLOR = 0xFFFF5722.toInt()       // Bright orange for focus highlight
    private const val HIGHLIGHT_GLOW_COLOR = 0x66FF5722          // Semi-transparent orange glow
    private const val HIGHLIGHT_BORDER_COLOR = 0xFFFFFFFF.toInt() // White border for highlight

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Creates a marker drawable based on the ChitMarker type and properties.
     * Dispatches to the appropriate drawing method based on marker type.
     */
    fun createMarkerDrawable(context: Context, marker: ChitMarker): Drawable {
        return when (marker.type) {
            "contact" -> createContactMarkerDrawable(context, marker.color)
            "saved" -> createSavedLocationDrawable(context)
            else -> createChitMarkerDrawable(context, marker.color, marker.isOverdue)
        }
    }

    /**
     * Creates a chit marker as a colored rounded-square icon.
     * Matches web's .maps-chit-marker: 28×28px, border-radius:6px, border:2px solid #fff,
     * background-color with 0.85 opacity, box-shadow.
     */
    fun createChitMarkerDrawable(context: Context, color: Int, isOverdue: Boolean = false): Drawable {
        val density = context.resources.displayMetrics.density
        val size = (CHIT_SIZE_DP * density).toInt()
        val borderWidth = BORDER_WIDTH_DP * density
        val cornerRadius = CORNER_RADIUS_DP * density

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // If overdue, draw a red glow/shadow behind the marker
        if (isOverdue) {
            val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                this.color = OVERDUE_GLOW_COLOR
                style = Paint.Style.FILL
            }
            val glowInset = 1f * density
            val glowRect = RectF(glowInset, glowInset, size - glowInset, size - glowInset)
            canvas.drawRoundRect(glowRect, cornerRadius + 2f, cornerRadius + 2f, glowPaint)
        }

        // Draw the filled rounded-square body with semi-transparent color (0.85 alpha)
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = applyAlpha(color, 0.85f)
            style = Paint.Style.FILL
            // Add shadow for depth (matches web's box-shadow: 0 1px 4px rgba(0,0,0,0.4))
            setShadowLayer(4f * density, 0f, 1f * density, 0x66000000)
        }
        val inset = borderWidth + (if (isOverdue) 1f * density else 0f)
        val fillRect = RectF(inset, inset, size - inset, size - inset)
        canvas.drawRoundRect(fillRect, cornerRadius, cornerRadius, fillPaint)

        // Draw border
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = if (isOverdue) OVERDUE_BORDER_COLOR else DEFAULT_BORDER_COLOR
            style = Paint.Style.STROKE
            strokeWidth = if (isOverdue) OVERDUE_BORDER_DP * density else borderWidth
        }
        val borderInset = borderPaint.strokeWidth / 2f + (if (isOverdue) 1f * density else 0f)
        val borderRect = RectF(borderInset, borderInset, size - borderInset, size - borderInset)
        canvas.drawRoundRect(borderRect, cornerRadius, cornerRadius, borderPaint)

        return BitmapDrawable(context.resources, bitmap)
    }

    /**
     * Creates a contact marker as a colored circle icon.
     * Matches web's L.circleMarker: radius:10, fillColor:color, weight:2, fillOpacity:0.6.
     */
    fun createContactMarkerDrawable(context: Context, color: Int): Drawable {
        val density = context.resources.displayMetrics.density
        val size = (CONTACT_SIZE_DP * density).toInt()
        val borderWidth = BORDER_WIDTH_DP * density

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val cx = size / 2f
        val cy = size / 2f
        val radius = (size / 2f) - borderWidth

        // Draw filled circle with semi-transparent color (0.6 opacity, matching web's fillOpacity)
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = applyAlpha(color, 0.6f)
            style = Paint.Style.FILL
            setShadowLayer(3f * density, 0f, 1f * density, 0x44000000)
        }
        canvas.drawCircle(cx, cy, radius, fillPaint)

        // Draw border ring (same color as fill, full opacity, matching web's weight:2, opacity:1)
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = borderWidth
        }
        canvas.drawCircle(cx, cy, radius, borderPaint)

        return BitmapDrawable(context.resources, bitmap)
    }

    /**
     * Creates a saved location marker as a gold star icon.
     * Matches the web's ⭐ prefix on saved location markers.
     */
    fun createSavedLocationDrawable(context: Context): Drawable {
        val density = context.resources.displayMetrics.density
        val size = (SAVED_SIZE_DP * density).toInt()

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val cx = size / 2f
        val cy = size / 2f
        val outerRadius = (size / 2f) - (3f * density) // Leave room for border
        val innerRadius = outerRadius * 0.4f

        // Draw star path
        val starPath = createStarPath(cx, cy, outerRadius, innerRadius, 5)

        // Fill with gold color
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = SAVED_GOLD_COLOR
            style = Paint.Style.FILL
            setShadowLayer(3f * density, 0f, 1f * density, 0x66000000)
        }
        canvas.drawPath(starPath, fillPaint)

        // Draw dark goldenrod border
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = SAVED_BORDER_COLOR
            style = Paint.Style.STROKE
            strokeWidth = 1.5f * density
        }
        canvas.drawPath(starPath, borderPaint)

        return BitmapDrawable(context.resources, bitmap)
    }

    /**
     * Creates a distinct highlight marker for focus mode.
     * Larger than standard markers with a bright orange fill, white border, and pulsing glow effect.
     * Visually distinct from all other marker types to draw attention to the focused location.
     */
    fun createHighlightMarkerDrawable(context: Context): Drawable {
        val density = context.resources.displayMetrics.density
        val size = (HIGHLIGHT_SIZE_DP * density).toInt()
        val borderWidth = 3f * density
        val cornerRadius = 8f * density

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Draw outer glow ring (pulsing effect simulated by larger semi-transparent circle)
        val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = HIGHLIGHT_GLOW_COLOR
            style = Paint.Style.FILL
        }
        val cx = size / 2f
        val cy = size / 2f
        canvas.drawCircle(cx, cy, size / 2f - 1f * density, glowPaint)

        // Draw inner filled circle with bright orange
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = HIGHLIGHT_COLOR
            style = Paint.Style.FILL
            setShadowLayer(6f * density, 0f, 2f * density, 0x88000000.toInt())
        }
        val innerRadius = (size / 2f) - (5f * density)
        canvas.drawCircle(cx, cy, innerRadius, fillPaint)

        // Draw white border ring
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = HIGHLIGHT_BORDER_COLOR
            style = Paint.Style.STROKE
            strokeWidth = borderWidth
        }
        canvas.drawCircle(cx, cy, innerRadius, borderPaint)

        // Draw a small inner dot for pin-point precision
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = 0xFFFFFFFF.toInt()
            style = Paint.Style.FILL
        }
        canvas.drawCircle(cx, cy, 3f * density, dotPaint)

        return BitmapDrawable(context.resources, bitmap)
    }

    // ─── Private Helpers ────────────────────────────────────────────────────

    /**
     * Creates a star-shaped Path with the given number of points.
     */
    private fun createStarPath(
        cx: Float,
        cy: Float,
        outerRadius: Float,
        innerRadius: Float,
        points: Int
    ): Path {
        val path = Path()
        val angleStep = Math.PI / points
        // Start from top (rotate -90 degrees)
        val startAngle = -Math.PI / 2

        for (i in 0 until points * 2) {
            val radius = if (i % 2 == 0) outerRadius else innerRadius
            val angle = startAngle + i * angleStep
            val x = cx + (radius * cos(angle)).toFloat()
            val y = cy + (radius * sin(angle)).toFloat()
            if (i == 0) {
                path.moveTo(x, y)
            } else {
                path.lineTo(x, y)
            }
        }
        path.close()
        return path
    }

    /**
     * Applies an alpha multiplier to an ARGB color int.
     * The color's existing alpha is multiplied by the given factor.
     */
    private fun applyAlpha(color: Int, alpha: Float): Int {
        val a = ((color ushr 24) * alpha).toInt().coerceIn(0, 255)
        return (a shl 24) or (color and 0x00FFFFFF)
    }
}
