package com.cwoc.app.ui.screens.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TasksUiState(
    val isLoading: Boolean = true,
    val tasks: List<ChitEntity> = emptyList(),
    val error: String? = null
) {
    /** Tasks grouped by status for display. */
    val groupedTasks: Map<String, List<ChitEntity>>
        get() = tasks.groupBy { it.status ?: "Unknown" }
}

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val chitRepository: ChitRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            chitRepository.getTaskChits().collect { tasks ->
                _uiState.update {
                    it.copy(isLoading = false, tasks = tasks)
                }
            }
        }
    }
}
