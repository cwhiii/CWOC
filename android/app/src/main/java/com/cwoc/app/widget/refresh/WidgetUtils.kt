package com.cwoc.app.widget.refresh

import android.graphics.Color

/**
 * Utility functions for widget display calculations and formatting.
 */
object WidgetUtils {

    /**
     * Truncates a title string to the given character limit.
     * Returns the original string if its length is ≤ limit,
     * otherwise returns the first (limit - 1) characters followed by "…" (Unicode ellipsis).
     */
    fun truncateTitle(text: String, limit: Int): String {
        return if (text.length <= limit) {
            text
        } else {
            text.take(limit - 1) + "\u2026"
        }
    }

    /**
     * Calculates Holeman Simplified Time (HST) from hours, minutes, and seconds.
     *
     * HST = (hours×3600 + minutes×60 + seconds) / 86400 × 100
     *
     * @return A Pair of:
     *   - First: formatted string "XX.XXX sd" with exactly 3 decimal places
     *   - Second: progress fraction (0.0–1.0), the raw day fraction before ×100
     */
    fun calculateHst(hours: Int, minutes: Int, seconds: Int): Pair<String, Float> {
        val totalSeconds = hours * 3600 + minutes * 60 + seconds
        val dayFraction = totalSeconds.toFloat() / 86400f
        val hstValue = dayFraction * 100f
        val formatted = String.format("%.3f sd", hstValue)
        return Pair(formatted, dayFraction)
    }

    /**
     * Formats a countdown from seconds remaining into a human-readable string.
     *
     * - "Xd Yh" when secondsRemaining > 86400 (more than 24 hours)
     * - "Xh Ym" when secondsRemaining is between 3600 and 86400 (1–24 hours)
     * - "Xm" when secondsRemaining < 3600 (less than 1 hour)
     */
    fun formatCountdown(secondsRemaining: Long): String {
        return when {
            secondsRemaining > 86400 -> {
                val days = (secondsRemaining / 86400).toInt()
                val hours = ((secondsRemaining % 86400) / 3600).toInt()
                "${days}d ${hours}h"
            }
            secondsRemaining >= 3600 -> {
                val hours = (secondsRemaining / 3600).toInt()
                val minutes = ((secondsRemaining % 3600) / 60).toInt()
                "${hours}h ${minutes}m"
            }
            else -> {
                val minutes = (secondsRemaining / 60).toInt()
                "${minutes}m"
            }
        }
    }

    /**
     * Resolves an HST color from hue, saturation, and tone values.
     * Returns the computed Android color int, or [defaultColor] if any input is null.
     *
     * HST color model:
     * - hue: 0–360 degrees
     * - saturation: 0.0–1.0
     * - tone: 0.0–1.0 (maps to lightness/value)
     */
    fun resolveHstColor(hue: Float?, saturation: Float?, tone: Float?, defaultColor: Int): Int {
        if (hue == null || saturation == null || tone == null) {
            return defaultColor
        }
        // Convert HST (hue/saturation/tone) to Android color using HSV model
        // tone maps to the value component in HSV
        val hsv = floatArrayOf(hue, saturation, tone)
        return Color.HSVToColor(hsv)
    }
}
