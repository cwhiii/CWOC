package com.cwoc.app.domain.email

import androidx.compose.ui.graphics.Color

/**
 * Computes WCAG-compliant contrast-safe text colors for any background color.
 *
 * Uses the WCAG 2.1 relative luminance formula with linearized sRGB values
 * to determine whether black or white text provides at least 4.5:1 contrast ratio
 * against a given background.
 *
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
object ContrastColor {

    private val Black = Color(0xFF000000)
    private val White = Color(0xFFFFFFFF)

    /**
     * Returns black or white text color for best WCAG contrast against the given background.
     *
     * Chooses the color that provides the higher contrast ratio against [backgroundColor].
     * Both black and white will always meet or exceed 4.5:1 for most backgrounds;
     * this picks whichever is higher.
     *
     * @param backgroundColor The background color to compute text color for
     * @return [Color.Black] or [Color.White] depending on which provides better contrast
     */
    fun forBackground(backgroundColor: Color): Color {
        val contrastWithWhite = contrastRatio(White, backgroundColor)
        val contrastWithBlack = contrastRatio(Black, backgroundColor)
        return if (contrastWithBlack >= contrastWithWhite) Black else White
    }

    /**
     * Computes the WCAG 2.1 contrast ratio between two colors.
     *
     * The contrast ratio is defined as (L1 + 0.05) / (L2 + 0.05) where L1 is the
     * relative luminance of the lighter color and L2 is the relative luminance of
     * the darker color. The result ranges from 1:1 (identical) to 21:1 (black/white).
     *
     * @param fg Foreground color
     * @param bg Background color
     * @return Contrast ratio as a Double (minimum 1.0, maximum 21.0)
     */
    fun contrastRatio(fg: Color, bg: Color): Double {
        val lum1 = relativeLuminance(fg)
        val lum2 = relativeLuminance(bg)
        val lighter = maxOf(lum1, lum2)
        val darker = minOf(lum1, lum2)
        return (lighter + 0.05) / (darker + 0.05)
    }

    /**
     * Computes the WCAG relative luminance of a color.
     *
     * Formula: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
     * where R, G, B are linearized sRGB values.
     *
     * @param color The color to compute luminance for
     * @return Relative luminance value between 0.0 (black) and 1.0 (white)
     */
    private fun relativeLuminance(color: Color): Double {
        val r = linearize(color.red.toDouble())
        val g = linearize(color.green.toDouble())
        val b = linearize(color.blue.toDouble())
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    /**
     * Linearizes an sRGB channel value.
     *
     * For values <= 0.03928, the linear value is sRGB / 12.92.
     * For values > 0.03928, the linear value is ((sRGB + 0.055) / 1.055) ^ 2.4.
     *
     * @param srgb The sRGB channel value (0.0 to 1.0)
     * @return The linearized channel value
     */
    private fun linearize(srgb: Double): Double {
        return if (srgb <= 0.03928) {
            srgb / 12.92
        } else {
            Math.pow((srgb + 0.055) / 1.055, 2.4)
        }
    }
}
