package com.cwoc.app.ui.screens.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel


/**
 * Settings screen with a TabRow (General, Views, Admin) and TopAppBar with back navigation.
 * Wires SettingsViewModel to GeneralSettingsTab and ViewsSettingsTab,
 * and DebugViewModel to AdminSettingsTab.
 *
 * Validates: Requirements 2.1, 2.2
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToAdminChits: () -> Unit = {},
    settingsViewModel: SettingsViewModel = hiltViewModel(),
    debugViewModel: DebugViewModel = hiltViewModel()
) {
    val settingsState by settingsViewModel.settings.collectAsState()
    var selectedTabIndex by rememberSaveable { mutableIntStateOf(0) }

    val tabs = listOf("General", "Views", "Collections", "Email", "Badges", "Admin")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { settingsViewModel.save() }
            ) {
                Icon(
                    imageVector = Icons.Default.Save,
                    contentDescription = "Save settings"
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            TabRow(selectedTabIndex = selectedTabIndex) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        text = { Text(title) }
                    )
                }
            }

            when (selectedTabIndex) {
                0 -> GeneralSettingsTab(
                    formState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    }
                )
                1 -> ViewsSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    }
                )
                2 -> CollectionsSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    }
                )
                3 -> EmailSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    }
                )
                4 -> BadgesSettingsTab(
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    }
                )
                5 -> AdminSettingsTab(
                    debugViewModel = debugViewModel,
                    settingsState = settingsState,
                    onUpdateSetting = { key, value ->
                        settingsViewModel.updateSetting(key, value)
                    },
                    onNavigateToAdminChits = onNavigateToAdminChits
                )
            }
        }
    }
}

