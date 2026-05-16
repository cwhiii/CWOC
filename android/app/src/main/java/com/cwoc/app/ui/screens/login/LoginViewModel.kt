package com.cwoc.app.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.repository.AuthRepository
import com.cwoc.app.data.repository.AuthResult
import com.cwoc.app.data.repository.SyncResult
import com.cwoc.app.data.sync.SyncEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val serverUrl: String = "",
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val syncEngine: SyncEngine
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        // Pre-populate server URL from last successful login
        val lastUrl = authRepository.getLastServerUrl()
        if (lastUrl != null) {
            _uiState.update { it.copy(serverUrl = lastUrl) }
        }
    }

    fun onServerUrlChanged(url: String) {
        _uiState.update { it.copy(serverUrl = url, error = null) }
    }

    fun onUsernameChanged(username: String) {
        _uiState.update { it.copy(username = username, error = null) }
    }

    fun onPasswordChanged(password: String) {
        _uiState.update { it.copy(password = password, error = null) }
    }

    fun login() {
        val state = _uiState.value

        // Validate server URL
        if (!isValidServerUrl(state.serverUrl)) {
            _uiState.update { it.copy(error = "Please enter a valid server URL (e.g., http://192.168.1.111:3333)") }
            return
        }

        if (state.username.isBlank()) {
            _uiState.update { it.copy(error = "Username is required") }
            return
        }

        if (state.password.isBlank()) {
            _uiState.update { it.copy(error = "Password is required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val result = authRepository.login(
                serverUrl = state.serverUrl.trimEnd('/'),
                username = state.username,
                password = state.password
            )

            when (result) {
                is AuthResult.Success -> {
                    syncEngine.reportLog("Login success: user=${state.username}", "info")
                    // Trigger initial sync after successful login
                    val syncResult = syncEngine.performSync(since = 0)
                    android.util.Log.d("CWOC_LOGIN", "Sync result: $syncResult")
                    when (syncResult) {
                        is SyncResult.Success -> {
                            android.util.Log.d("CWOC_LOGIN", "Sync success! server_version=${syncResult.serverVersion}")
                            _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                        }
                        is SyncResult.Error -> {
                            android.util.Log.e("CWOC_LOGIN", "Sync error: ${syncResult.code} ${syncResult.message}")
                            // Still navigate — sync can retry later
                            _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                        }
                        is SyncResult.NetworkError -> {
                            android.util.Log.e("CWOC_LOGIN", "Sync network error: ${syncResult.message}")
                            // Still navigate — sync can retry later
                            _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                        }
                    }
                }
                is AuthResult.InvalidCredentials -> {
                    syncEngine.reportLog("Login failed: invalid credentials for user=${state.username}", "error")
                    _uiState.update { it.copy(isLoading = false, error = "Invalid username or password") }
                }
                is AuthResult.NetworkError -> {
                    syncEngine.reportLog("Login failed: network error reaching ${state.serverUrl}", "error")
                    _uiState.update { it.copy(isLoading = false, error = "Cannot reach server. Check the URL and your connection.") }
                }
                is AuthResult.Error -> {
                    syncEngine.reportLog("Login failed: ${result.message}", "error")
                    _uiState.update { it.copy(isLoading = false, error = result.message) }
                }
            }
        }
    }

    private fun isValidServerUrl(url: String): Boolean {
        if (url.isBlank()) return false
        return url.startsWith("http://") || url.startsWith("https://")
    }
}
