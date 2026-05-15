package com.cwoc.app.ui.screens.notes

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

data class NotesUiState(
    val isLoading: Boolean = true,
    val notes: List<ChitEntity> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val chitRepository: ChitRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotesUiState())
    val uiState: StateFlow<NotesUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            chitRepository.getNoteChits().collect { notes ->
                _uiState.update {
                    it.copy(isLoading = false, notes = notes)
                }
            }
        }
    }
}
