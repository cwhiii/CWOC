package com.cwoc.app.ui.screens.editor

import com.cwoc.app.data.remote.IndicatorObject

/**
 * Represents a custom zone with its metadata and associated objects.
 * Used by CustomZonePanel to render zone-specific input fields.
 */
data class CustomZoneState(
    val zoneId: String,
    val name: String,
    val objects: List<IndicatorObject>
)
