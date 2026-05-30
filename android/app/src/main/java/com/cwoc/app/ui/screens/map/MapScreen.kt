package com.cwoc.app.ui.screens.map

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.cwoc.app.ui.theme.CwocInputDefaults

private val ParchmentBrown = Color(0xFF6B4E31)

/**
 * Map screen — displays chit and/or contact location markers on OpenStreetMap via osmdroid.
 * Supports three modes: Chits, People, Both via FilterChip toggle row.
 * Includes: search/go-to, period filter, status filter, loading state,
 * Google Maps preference warning, mode persistence, fly-to animation.
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
    val isLoading by viewModel.isLoading.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val period by viewModel.period.collectAsState()
    val periodOffset by viewModel.periodOffset.collectAsState()
    val periodLabel by viewModel.periodLabel.collectAsState()
    val statusFilters by viewModel.statusFilters.collectAsState()
    val priorityFilters by viewModel.priorityFilters.collectAsState()
    val tagFilters by viewModel.tagFilters.collectAsState()
    val availableTags by viewModel.availableTags.collectAsState()
    val peopleFilters by viewModel.peopleFilters.collectAsState()
    val availablePeople by viewModel.availablePeople.collectAsState()
    val flyToPoint by viewModel.flyToPoint.collectAsState()
    val goToError by viewModel.goToError.collectAsState()
    val preferGoogleMaps by viewModel.preferGoogleMaps.collectAsState()
    val defaultLat by viewModel.defaultLat.collectAsState()
    val defaultLon by viewModel.defaultLon.collectAsState()
    val defaultZoom by viewModel.defaultZoom.collectAsState()
    val isFocusMode by viewModel.isFocusMode.collectAsState()
    val focusPoint by viewModel.focusPoint.collectAsState()

    // Marker popup state
    val selectedPopup by viewModel.selectedPopup.collectAsState()

    // People filter panel state
    val peopleSearchText by viewModel.peopleSearchText.collectAsState()
    val peopleFavoritesOnly by viewModel.peopleFavoritesOnly.collectAsState()
    val peopleSelectedTags by viewModel.peopleSelectedTags.collectAsState()
    val allContactTags by viewModel.allContactTags.collectAsState()

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
            tileFileSystemCacheMaxBytes = 100L * 1024 * 1024
        }
    }

    // Google Maps preference warning
    if (preferGoogleMaps) {
        Box(
            modifier = modifier.fillMaxSize().statusBarsPadding(),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.padding(32.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8E1))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("⚠️ Google Maps Preferred", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Your settings prefer Google Maps. The Android app uses OpenStreetMap. " +
                        "Disable \"Prefer Google Maps\" in Settings → Views → Map Settings to use this map.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
        return
    }

    Column(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        // ─── Mode Toggle FilterChips ────────────────────────────────────────
        MapModeToggle(
            currentMode = mapMode,
            allPeople = allPeople,
            onModeSelected = { viewModel.setMapMode(it) },
            onAllPeopleToggled = { viewModel.setAllPeople(it) }
        )

        // ─── Search / "Go to" Bar ──────────────────────────────────────────
        MapSearchBar(
            searchQuery = searchQuery,
            isSearching = isSearching,
            goToError = goToError,
            onSearchChange = { viewModel.setSearchQuery(it) },
            onGoTo = { viewModel.goToAddress(it) },
            onClearError = { viewModel.clearGoToError() }
        )

        // ─── Period + Status Filters ────────────────────────────────────────
        if (mapMode == MapMode.CHITS || mapMode == MapMode.BOTH) {
            MapFilters(
                period = period,
                periodLabel = periodLabel,
                statusFilters = statusFilters,
                priorityFilters = priorityFilters,
                onPeriodSelected = { viewModel.setPeriod(it) },
                onPrevPeriod = { viewModel.previousPeriod() },
                onNextPeriod = { viewModel.nextPeriod() },
                onStatusToggled = { viewModel.toggleStatusFilter(it) },
                onPriorityToggled = { viewModel.togglePriorityFilter(it) },
                onClearFilters = { viewModel.clearFilters() }
            )

            // ─── Tag Filter Chips ───────────────────────────────────────────
            if (availableTags.isNotEmpty()) {
                MapTagFilters(
                    availableTags = availableTags,
                    selectedTags = tagFilters,
                    onTagToggled = { viewModel.toggleTagFilter(it) }
                )
            }

            // ─── People Filter Chips ────────────────────────────────────────
            if (availablePeople.isNotEmpty()) {
                MapPeopleFilters(
                    availablePeople = availablePeople,
                    selectedPeople = peopleFilters,
                    onPersonToggled = { viewModel.togglePeopleFilter(it) }
                )
            }
        }

        // ─── People Filter Panel ────────────────────────────────────────────
        if (mapMode == MapMode.PEOPLE || mapMode == MapMode.BOTH) {
            PeopleFilterPanel(
                searchText = peopleSearchText,
                favoritesOnly = peopleFavoritesOnly,
                selectedTags = peopleSelectedTags,
                allTags = allContactTags,
                onSearchTextChanged = { viewModel.setPeopleSearchText(it) },
                onFavoritesToggled = { viewModel.setPeopleFavoritesOnly(it) },
                onTagToggled = { viewModel.togglePeopleTag(it) },
                onClearFilters = { viewModel.clearPeopleFilters() }
            )
        }

        // ─── Map Content ────────────────────────────────────────────────────
        Box(modifier = Modifier.fillMaxSize()) {
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = ParchmentBrown)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Loading map data…", style = MaterialTheme.typography.bodySmall, color = ParchmentBrown)
                    }
                }
            } else if (markers.isEmpty()) {
                EmptyMapState(mapMode = mapMode)
            } else {
                // osmdroid MapView wrapped in AndroidView
                var mapView by remember { mutableStateOf<MapView?>(null) }

                AndroidView(
                    factory = { ctx ->
                        MapView(ctx).apply {
                            setTileSource(TileSourceFactory.MAPNIK)
                            setMultiTouchControls(true)
                            controller.setZoom(defaultZoom)
                            controller.setCenter(GeoPoint(defaultLat, defaultLon))

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
                        // Clear existing markers and re-add with clustering
                        view.overlays.removeAll { it is Marker }

                        // Determine which marker's popup is currently open (to hide its tooltip)
                        val popupOpenId = when (val popup = selectedPopup) {
                            is MarkerPopupData.ChitPopup -> popup.chitId
                            is MarkerPopupData.ContactPopup -> popup.contactId
                            else -> null
                        }

                        // Use MapClusterManager to group nearby markers into clusters
                        val clusteredOverlays = MapClusterManager.buildClusteredOverlays(
                            context = context,
                            mapView = view,
                            chitMarkers = markers,
                            onMarkerClick = { chitMarker ->
                                // Show popup instead of navigating directly
                                viewModel.onMarkerTapped(chitMarker)
                            },
                            onClusterClick = { clusterBounds ->
                                // Zoom to reveal individual markers within the cluster
                                view.post {
                                    view.zoomToBoundingBox(clusterBounds, true, 50)
                                }
                            },
                            popupOpenMarkerId = popupOpenId
                        )

                        clusteredOverlays.forEach { marker ->
                            view.overlays.add(marker)
                        }

                        // Add distinct highlight marker at focus point (if in focus mode)
                        focusPoint?.let { point ->
                            val highlightMarker = Marker(view).apply {
                                position = point
                                title = "Focused Location"
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                                icon = MapMarkerDrawer.createHighlightMarkerDrawable(context)
                                setOnMarkerClickListener { _, _ -> true }
                            }
                            view.overlays.add(highlightMarker)
                        }

                        // Fit bounds — skip when in focus mode to maintain focus on target location
                        if (!isFocusMode) {
                            bounds?.let { bb ->
                                view.post {
                                    view.zoomToBoundingBox(bb, true, 50)
                                }
                            }
                        }

                        view.invalidate()
                    },
                    modifier = Modifier.fillMaxSize()
                )

                // Handle fly-to animation
                LaunchedEffect(flyToPoint) {
                    flyToPoint?.let { point ->
                        mapView?.controller?.animateTo(point, 14.0, 1200L)
                        viewModel.clearFlyTo()
                    }
                }

                // Dispose map lifecycle
                DisposableEffect(Unit) {
                    onDispose {
                        mapView?.onDetach()
                    }
                }

                // Map FABs (Home + My Location)
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalAlignment = Alignment.End
                ) {
                    // Home / Reset View FAB
                    FloatingActionButton(
                        onClick = {
                            mapView?.controller?.animateTo(
                                GeoPoint(defaultLat, defaultLon),
                                defaultZoom,
                                1200L
                            )
                        },
                        containerColor = ParchmentBrown
                    ) {
                        Icon(
                            Icons.Default.Home,
                            contentDescription = "Reset to default view",
                            tint = Color.White
                        )
                    }

                    // My Location FAB
                    FloatingActionButton(
                        onClick = {
                            if (hasLocationPermission) {
                                mapView?.let { view ->
                                    val locationOverlay = view.overlays
                                        .filterIsInstance<MyLocationNewOverlay>()
                                        .firstOrNull()
                                    locationOverlay?.myLocation?.let { loc ->
                                        view.controller.animateTo(loc)
                                    }
                                }
                            } else {
                                permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                            }
                        },
                        containerColor = ParchmentBrown
                    ) {
                        Icon(
                            Icons.Default.MyLocation,
                            contentDescription = if (hasLocationPermission) "My Location" else "Enable Location",
                            tint = Color.White
                        )
                    }
                }

                // ─── Marker Popup Overlay ────────────────────────────────────
                MarkerPopupOverlay(
                    popupData = selectedPopup,
                    onDismiss = { viewModel.dismissPopup() },
                    onOpenEditor = { chitId ->
                        viewModel.dismissPopup()
                        onNavigateToEditor(chitId)
                    },
                    onOpenContact = { contactId ->
                        viewModel.dismissPopup()
                        onNavigateToContact(contactId)
                    }
                )
            }
        }
    }
}

// ─── Search / "Go to" Bar ───────────────────────────────────────────────────────

@Composable
private fun MapSearchBar(
    searchQuery: String,
    isSearching: Boolean,
    goToError: String?,
    onSearchChange: (String) -> Unit,
    onGoTo: (String) -> Unit,
    onClearError: () -> Unit
) {
    var goToText by remember { mutableStateOf("") }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Filter search (filters visible markers by title/note/location)
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = { Text("Filter markers…", style = MaterialTheme.typography.bodySmall) },
            singleLine = true,
            modifier = Modifier.weight(1f),
            textStyle = MaterialTheme.typography.bodySmall,
            trailingIcon = {
                if (searchQuery.isNotBlank()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Default.Clear, "Clear", modifier = Modifier.size(18.dp))
                    }
                }
            },
            colors = CwocInputDefaults.outlinedColors()
        )

        // "Go to" field
        OutlinedTextField(
            value = goToText,
            onValueChange = { goToText = it; onClearError() },
            placeholder = { Text("Go to…", style = MaterialTheme.typography.bodySmall) },
            singleLine = true,
            modifier = Modifier.weight(0.8f),
            textStyle = MaterialTheme.typography.bodySmall,
            isError = goToError != null,
            trailingIcon = {
                if (isSearching) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(onClick = {
                        if (goToText.isNotBlank()) onGoTo(goToText)
                    }) {
                        Icon(Icons.Default.Search, "Go", modifier = Modifier.size(18.dp))
                    }
                }
            },
            colors = CwocInputDefaults.outlinedColors()
        )
    }
}

// ─── Period + Status Filters ────────────────────────────────────────────────────

@Composable
private fun MapFilters(
    period: MapPeriod,
    periodLabel: String,
    statusFilters: Set<String>,
    priorityFilters: Set<String>,
    onPeriodSelected: (MapPeriod) -> Unit,
    onPrevPeriod: () -> Unit,
    onNextPeriod: () -> Unit,
    onStatusToggled: (String) -> Unit,
    onPriorityToggled: (String) -> Unit,
    onClearFilters: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // Period chips + prev/next navigation
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Prev button (not shown for ALL or NEXT_HOUR which don't support offset navigation)
            if (period != MapPeriod.ALL && period != MapPeriod.NEXT_HOUR) {
                IconButton(onClick = onPrevPeriod, modifier = Modifier.size(32.dp)) {
                    Text("◀", style = MaterialTheme.typography.bodyMedium)
                }
            }

            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                MapPeriod.entries.forEach { p ->
                    FilterChip(
                        selected = period == p,
                        onClick = { onPeriodSelected(p) },
                        label = { Text(p.label, style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ParchmentBrown,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            // Next button (not shown for ALL or NEXT_HOUR which don't support offset navigation)
            if (period != MapPeriod.ALL && period != MapPeriod.NEXT_HOUR) {
                IconButton(onClick = onNextPeriod, modifier = Modifier.size(32.dp)) {
                    Text("▶", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // Period label (date range display)
        if (period != MapPeriod.ALL) {
            Text(
                text = periodLabel,
                style = MaterialTheme.typography.labelSmall,
                color = ParchmentBrown,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
        }

        // Status chips
        val statuses = listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            statuses.forEach { status ->
                FilterChip(
                    selected = status in statusFilters,
                    onClick = { onStatusToggled(status) },
                    label = { Text(status, style = MaterialTheme.typography.labelSmall) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ParchmentBrown,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        // Priority chips
        val priorities = listOf("Critical", "High", "Medium", "Low")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            priorities.forEach { priority ->
                FilterChip(
                    selected = priority in priorityFilters,
                    onClick = { onPriorityToggled(priority) },
                    label = { Text(priority, style = MaterialTheme.typography.labelSmall) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ParchmentBrown,
                        selectedLabelColor = Color.White
                    )
                )
            }
            if (statusFilters.isNotEmpty() || priorityFilters.isNotEmpty() || period != MapPeriod.ALL) {
                TextButton(onClick = onClearFilters) {
                    Text("Clear", style = MaterialTheme.typography.labelSmall, color = ParchmentBrown)
                }
            }
        }
    }
}

// ─── Tag Filter Chips ────────────────────────────────────────────────────────

@Composable
private fun MapTagFilters(
    availableTags: List<String>,
    selectedTags: Set<String>,
    onTagToggled: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = "Tags:",
            style = MaterialTheme.typography.labelSmall,
            color = ParchmentBrown,
            modifier = Modifier.align(Alignment.CenterVertically)
        )
        availableTags.forEach { tag ->
            val displayName = tag.substringAfterLast("/")
            FilterChip(
                selected = tag in selectedTags,
                onClick = { onTagToggled(tag) },
                label = { Text(displayName, style = MaterialTheme.typography.labelSmall) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ParchmentBrown,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

// ─── People Filter Chips (for chit filtering) ───────────────────────────────────

@Composable
private fun MapPeopleFilters(
    availablePeople: List<String>,
    selectedPeople: Set<String>,
    onPersonToggled: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = "People:",
            style = MaterialTheme.typography.labelSmall,
            color = ParchmentBrown,
            modifier = Modifier.align(Alignment.CenterVertically)
        )
        availablePeople.forEach { person ->
            FilterChip(
                selected = person in selectedPeople,
                onClick = { onPersonToggled(person) },
                label = { Text(person, style = MaterialTheme.typography.labelSmall) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ParchmentBrown,
                    selectedLabelColor = Color.White
                )
            )
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
                        selectedContainerColor = ParchmentBrown,
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
                            checkedColor = ParchmentBrown
                        )
                    )
                    Text(
                        text = "All People",
                        style = MaterialTheme.typography.bodySmall,
                        color = ParchmentBrown
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
            color = ParchmentBrown,
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
