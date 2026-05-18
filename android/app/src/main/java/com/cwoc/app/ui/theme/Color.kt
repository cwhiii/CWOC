package com.cwoc.app.ui.theme

import androidx.compose.ui.graphics.Color

// CWOC Parchment Theme Colors — matched to web CSS variables
// Source: src/frontend/css/dashboard/styles-variables.css + shared-page.css

val CwocPrimary = Color(0xFF8B5A2B)          // --btn-bg: #8b5a2b — primary actions, active elements
val CwocOnPrimary = Color(0xFFFFFFFF)        // White — text/icons on primary
val CwocPrimaryContainer = Color(0xFF6B4E31) // --sidebar-border / zone header: #6b4e31
val CwocOnPrimaryContainer = Color(0xFFFFFFFF)

val CwocSecondary = Color(0xFF5C4A3A)        // Dark brown — secondary elements
val CwocOnSecondary = Color(0xFFFFFFFF)
val CwocSecondaryContainer = Color(0xFFFAEBD7) // --parchment-medium: #faebd7
val CwocOnSecondaryContainer = Color(0xFF1A1208)

val CwocTertiary = Color(0xFF4A6741)         // Muted green — tertiary accent
val CwocOnTertiary = Color(0xFFFFFFFF)
val CwocTertiaryContainer = Color(0xFFC8E6C0)
val CwocOnTertiaryContainer = Color(0xFF1A1208)

val CwocBackground = Color(0xFFFDF5E6)       // --parchment-light: #fdf5e6 — page background
val CwocOnBackground = Color(0xFF1A1208)     // Near-black — text on background

val CwocSurface = Color(0xFFFFFAF0)          // #fffaf0 — card/surface background (floral white)
val CwocOnSurface = Color(0xFF1A1208)        // Near-black — text on surface
val CwocOnSurfaceVariant = Color(0xFF5C4A3A) // Dark brown — secondary text

val CwocSurfaceVariant = Color(0xFFF5E6D3)   // #f5e6d3 — slightly darker parchment for containers
val CwocOutline = Color(0xFF6B4E31)          // #6b4e31 — borders, zone headers
val CwocOutlineVariant = Color(0xFFC9B896)   // #c9b896 — gold dividers

val CwocError = Color(0xFFB22222)            // Firebrick — error states
val CwocOnError = Color(0xFFFFFFFF)          // White — text/icons on error
val CwocErrorContainer = Color(0xFFFFDAD6)
val CwocOnErrorContainer = Color(0xFF410002)

val CwocInverseSurface = Color(0xFF1A1208)
val CwocInverseOnSurface = Color(0xFFFFFAF0)
val CwocInversePrimary = Color(0xFFD4A574)   // Light brown for inverse contexts

val CwocSurfaceTint = Color(0xFF8B5A2B)
val CwocScrim = Color(0xFF000000)

// Additional named colors for direct use in components
val CwocZoneHeaderBrown = Color(0xFF6B4E31)  // Zone header background color
val CwocGoldDivider = Color(0xFFC9B896)      // Gold divider color
val CwocButtonBorder = Color(0xFF5A3F2A)     // --btn-border: #5a3f2a
val CwocButtonHover = Color(0xFF6B4E31)      // --btn-hover: #6b4e31
val CwocHeaderBg = Color(0xFFE0D4B5)         // --header-bg: #e0d4b5
val CwocAgedBrownDark = Color(0xFF4A2C2A)    // --aged-brown-dark: #4a2c2a
val CwocAgedBrownMedium = Color(0xFF8B4513)  // --aged-brown-medium: #8b4513
val CwocAgedBrownLight = Color(0xFFA0522D)   // --aged-brown-light: #a0522d
