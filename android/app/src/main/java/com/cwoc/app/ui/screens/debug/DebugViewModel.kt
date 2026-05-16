package com.cwoc.app.ui.screens.debug

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.repository.SyncResult
import com.cwoc.app.data.sync.SyncEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DebugUiState(
    val isLoading: Boolean = true,
    val isSyncing: Boolean = false,
    val totalChits: Int = 0,
    val taskCount: Int = 0,
    val noteCount: Int = 0,
    val calendarCount: Int = 0,
    val syncStatus: String? = null,
    val highWaterMark: Int? = null,
    val lastSyncedAt: String? = null,
    val lastSyncResult: String? = null,
    val sampleChits: List<Pair<String?, String?>> = emptyList()
)

@HiltViewModel
class DebugViewModel @Inject constructor(
    private val chitDao: ChitDao,
    private val syncMetadataDao: SyncMetadataDao,
    private val syncEngine: SyncEngine
) : ViewModel() {

    private val _uiState = MutableStateFlow(DebugUiState())
    val uiState: StateFlow<DebugUiState> = _uiState.asStateFlow()

    init {
        loadDebugInfo()
    }

    fun syncNow() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, lastSyncResult = null) }

            val meta = syncMetadataDao.getMetadata()
            val since = meta?.highWaterMark ?: 0

            val result = syncEngine.performSync(since)
            val resultText = when (result) {
                is SyncResult.Success -> "Success (version=${result.serverVersion})"
                is SyncResult.Error -> "Error: ${result.code} ${result.message}"
                is SyncResult.NetworkError -> "Network error: ${result.message}"
            }

            _uiState.update { it.copy(isSyncing = false, lastSyncResult = resultText) }
            loadDebugInfo()
        }
    }

    fun fullResync() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, lastSyncResult = null) }

            val result = syncEngine.performSync(since = 0)
            val resultText = when (result) {
                is SyncResult.Success -> "Full resync success (version=${result.serverVersion})"
                is SyncResult.Error -> "Error: ${result.code} ${result.message}"
                is SyncResult.NetworkError -> "Network error: ${result.message}"
            }

            _uiState.update { it.copy(isSyncing = false, lastSyncResult = resultText) }
            loadDebugInfo()
        }
    }

    private fun loadDebugInfo() {
        viewModelScope.launch {
            val total = chitDao.getCount()
            val tasks = chitDao.getTaskChits().first()
            val notes = chitDao.getNoteChits().first()
            val calendar = chitDao.getCalendarChits().first()

            // Get first 5 chits for sample display
            val samples = chitDao.getFirstFive().map { Pair(it.title, it.status) }

            // Sync metadata
            val meta = syncMetadataDao.getMetadata()

            _uiState.update {
                it.copy(
                    isLoading = false,
                    totalChits = total,
                    taskCount = tasks.size,
                    noteCount = notes.size,
                    calendarCount = calendar.size,
                    syncStatus = meta?.syncStatus,
                    highWaterMark = meta?.highWaterMark,
                    lastSyncedAt = meta?.lastSyncTimestamp,
                    sampleChits = samples
                )
            }
        }
    }
}
