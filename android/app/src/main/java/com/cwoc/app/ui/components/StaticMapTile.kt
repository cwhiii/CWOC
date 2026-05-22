package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.tan

/**
 * A static map tile composable that renders an OpenStreetMap tile image
 * for a given latitude/longitude at zoom level 14, with a pin overlay centered on the tile.
 *
 * Shows a map-marker placeholder icon while loading or on error.
 *
 * Uses Mercator projection to compute tile x/y coordinates:
 * - x = floor((lon + 180) / 360 * 2^14)
 * - y = floor((1 - ln(tan(lat_rad) + 1/cos(lat_rad)) / π) / 2 * 2^14)
 *
 * @param lat Latitude of the location
 * @param lon Longitude of the location
 * @param modifier Modifier for the composable
 * @param sizeDp Size of the tile in dp (width × height)
 */
@Composable
fun StaticMapTile(
    lat: Double,
    lon: Double,
    modifier: Modifier = Modifier,
    sizeDp: DpSize = DpSize(90.dp, 60.dp)
) {
    val tileUrl = remember(lat, lon) {
        computeTileUrl(lat, lon, zoom = 14)
    }

    Box(
        modifier = modifier
            .width(sizeDp.width)
            .height(sizeDp.height)
            .clip(RoundedCornerShape(4.dp)),
        contentAlignment = Alignment.Center
    ) {
        SubcomposeAsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(tileUrl)
                .crossfade(true)
                .build(),
            contentDescription = "Map tile",
            modifier = Modifier
                .width(sizeDp.width)
                .height(sizeDp.height)
                .clip(RoundedCornerShape(4.dp)),
            contentScale = ContentScale.Crop,
            loading = {
                MapMarkerPlaceholder(sizeDp)
            },
            error = {
                MapMarkerPlaceholder(sizeDp)
            }
        )

        // Pin overlay — small red circle centered on the tile
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(Color(0xFFD32F2F))
        )
    }
}

/**
 * Placeholder shown while the tile is loading or if loading fails.
 * Displays a map-marker icon centered in a muted background.
 */
@Composable
private fun MapMarkerPlaceholder(sizeDp: DpSize) {
    Box(
        modifier = Modifier
            .width(sizeDp.width)
            .height(sizeDp.height)
            .background(Color(0xFFE8E0D4)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.LocationOn,
            contentDescription = "Location placeholder",
            tint = Color(0xFF6B4E31),
            modifier = Modifier.size(24.dp)
        )
    }
}

/**
 * Computes the OSM tile URL for a given lat/lon at the specified zoom level
 * using Mercator projection.
 *
 * @param lat Latitude in degrees [-85.05, 85.05]
 * @param lon Longitude in degrees [-180, 180]
 * @param zoom Zoom level (default 14)
 * @return The tile URL string
 */
fun computeTileUrl(lat: Double, lon: Double, zoom: Int = 14): String {
    val n = 2.0.pow(zoom.toDouble())
    val tileX = floor((lon + 180.0) / 360.0 * n).toInt()
    val latRad = Math.toRadians(lat)
    val tileY = floor((1.0 - ln(tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n).toInt()
    return "https://tile.openstreetmap.org/$zoom/$tileX/$tileY.png"
}
