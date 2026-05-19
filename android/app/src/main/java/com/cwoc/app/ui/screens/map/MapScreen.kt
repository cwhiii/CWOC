package com.cwoc.app.ui.screens.map

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.mylocation.GpsMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay

/**
 * Map screen — displays chit and/or contact location markers on OpenStreetMap via osmdroid.
 * Supports three modes: Chits, People, Both via FilterChip toggle row.
 */
@Composable
fun MapScreen(
    onNavigateToEditor: (String) -> Unit,
    onNavigateToContact: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: MapViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val markers by viewModel.markers.collectAsState()
    val bounds by viewModel.bounds.collectAsState()
    val mapMode by viewModel.mapMode.collectAsState()
    val allPeople by viewModel.allPeople.collectAsState()
    // T2: Default map position from settings
    val defaultLat by viewModel.defaultLat.collectAsState()
    val defaultLon by viewModel.defaultLon.collectAsState()
    val defaultZoom by viewModel.defaultZoom.collectAsState()

    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasLocationPermission = granted
    }

    // Configure osmdroid
    LaunchedEffect(Unit) {
        Configuration.getInstance().apply {
            userAgentValue = "CWOC-Android/1.0"
            osmdroidTileCache = context.cacheDir.resolve("osmdroid").also { it.mkdirs() }
            tileFileSystemCacheMaxBytes = 100L * 1024 * 1024 // 100MB
        }
    }

    Column(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        // ─── Mode Toggle FilterChips ────────────────────────────────────────
        MapModeToggle(
            currentMode = mapMode,
            allPeople = allPeople,
            onModeSelected = { viewModel.setMapMode(it) },
            onAllPeopleToggled = { viewModel.setAllPeople(it) }
        )

        // ─── Map Content ────────────────────────────────────────────────────
        Box(modifier = Modifier.fillMaxSize()) {
            if (markers.isEmpty()) {
                EmptyMapState(mapMode = mapMode)
            } else {
                // osmdroid MapView wrapped in AndroidView
                var mapView by remember { mutableStateOf<MapView?>(null) }

                AndroidView(
                    factory = { ctx ->
                        MapView(ctx).apply {
                            setTileSource(TileSourceFactory.MAPNIK)
                            setMultiTouchControls(true)
                            // T2: Use default position from settings
                            controller.setZoom(defaultZoom)
                            controller.setCenter(GeoPoint(defaultLat, defaultLon))

                            // Add my-location overlay if permission granted
                            if (hasLocationPermission) {
                                val locationOverlay = MyLocationNewOverlay(
                                    GpsMyLocationProvider(ctx), this
                                )
                                locationOverlay.enableMyLocation()
                                overlays.add(locationOverlay)
                            }

                            mapView = this
                        }
                    },
                    update = { view ->
                        // Clear existing markers and re-add
                        view.overlays.removeAll { it is Marker }

                        markers.forEach { chitMarker ->
                            val marker = Marker(view).apply {
                                position = chitMarker.geoPoint
                                title = chitMarker.title
                                snippet = chitMarker.type ?: ""
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                                setOnMarkerClickListener { _, _ ->
                                    if (chitMarker.type == "contact") {
                                        onNavigateToContact(chitMarker.chitId)
                                    } else {
                                        onNavigateToEditor(chitMarker.chitId)
                                    }
                                    true
                                }
                            }
                            view.overlays.add(marker)
                        }

                        // Fit bounds
                        bounds?.let { bb ->
                            view.post {
                                view.zoomToBoundingBox(bb, true, 50)
                            }
                        }

                        view.invalidate()
                    },
                    modifier = Modifier.fillMaxSize()
                )

                // Dispose map lifecycle
                DisposableEffect(Unit) {
                    onDispose {
                        mapView?.onDetach()
                    }
                }

                // My Location FAB
                if (hasLocationPermission) {
                    FloatingActionButton(
                        onClick = {
                            mapView?.let { view ->
                                val locationOverlay = view.overlays
                                    .filterIsInstance<MyLocationNewOverlay>()
                                    .firstOrNull()
                                locationOverlay?.myLocation?.let { loc ->
                                    view.controller.animateTo(loc)
                                }
                            }
                        },
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(16.dp),
                        containerColor = Color(0xFF6B4E31)
                    ) {
                        Icon(
                            Icons.Default.MyLocation,
                            contentDescription = "My Location",
                            tint = Color.White
                        )
                    }
                } else {
                    // Request permission button
                    FloatingActionButton(
                        onClick = {
                            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        },
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(16.dp),
                        containerColor = Color(0xFF6B4E31)
                    ) {
                        Icon(
                            Icons.Default.MyLocation,
                            contentDescription = "Enable Location",
                            tint = Color.White
                        )
                    }
                }
            }
        }
    }
}

// ─── Mode Toggle Row ────────────────────────────────────────────────────────────

@Composable
private fun MapModeToggle(
    currentMode: MapMode,
    allPeople: Boolean,
    onModeSelected: (MapMode) -> Unit,
    onAllPeopleToggled: (Boolean) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            MapMode.entries.forEach { mode ->
                FilterChip(
                    selected = currentMode == mode,
                    onClick = { onModeSelected(mode) },
                    label = { Text(mode.label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFF6B4E31),
                        selectedLabelColor = Color.White
                    )
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // "All People" checkbox — visible when People or Both mode is active
            if (currentMode == MapMode.PEOPLE || currentMode == MapMode.BOTH) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = allPeople,
                        onCheckedChange = { onAllPeopleToggled(it) },
                        colors = CheckboxDefaults.colors(
                            checkedColor = Color(0xFF6B4E31)
                        )
                    )
                    Text(
                        text = "All People",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6B4E31)
                    )
                }
            }
        }
    }
}

// ─── Empty State ────────────────────────────────────────────────────────────────

@Composable
private fun EmptyMapState(mapMode: MapMode = MapMode.CHITS) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        val (title, subtitle) = when (mapMode) {
            MapMode.CHITS -> "No locations to display" to "Add locations to your chits to see them on the map."
            MapMode.PEOPLE -> "No contacts with addresses" to "Add addresses to your contacts to see them on the map."
            MapMode.BOTH -> "No locations to display" to "Add locations to chits or addresses to contacts to see them on the map."
        }
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31),
            modifier = Modifier.padding(top = 120.dp)
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355),
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
