package com.cwoc.app.ui.screens.useradmin

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

// ─── Data Models ────────────────────────────────────────────────────────────────

data class UserItem(
    val id: String,
    val username: String,
    @SerializedName("display_name") val displayName: String?,
    val email: String?,
    @SerializedName("is_admin") val isAdmin: Boolean,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("created_datetime") val createdDatetime: String?,
    @SerializedName("profile_image_url") val profileImageUrl: String?
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class UserAdminViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _users = MutableStateFlow<List<UserItem>>(emptyList())
    val users: StateFlow<List<UserItem>> = _users.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    /** The current logged-in user's ID (used to prevent self-deactivation). */
    val currentUserId: String
        get() = prefs.getString("user_id", "") ?: ""

    init {
        loadUsers()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadUsers() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchUsers()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun createUser(
        username: String,
        displayName: String,
        password: String,
        email: String,
        isAdmin: Boolean
    ) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = postCreateUser(username, displayName, password, email, isAdmin)
                if (success) {
                    _actionMessage.value = "User created successfully"
                    loadUsers()
                }
            } catch (e: Exception) {
                _error.value = "Failed to create user: ${e.message}"
            }
        }
    }

    fun updateUser(
        userId: String,
        username: String,
        displayName: String,
        email: String,
        isAdmin: Boolean
    ) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = putUpdateUser(userId, username, displayName, email, isAdmin)
                if (success) {
                    _actionMessage.value = "User updated successfully"
                    loadUsers()
                }
            } catch (e: Exception) {
                _error.value = "Failed to update user: ${e.message}"
            }
        }
    }

    fun deactivateUser(userId: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = putDeactivateUser(userId)
                if (success) {
                    _actionMessage.value = "User deactivated"
                    loadUsers()
                }
            } catch (e: Exception) {
                _error.value = "Failed to deactivate user: ${e.message}"
            }
        }
    }

    fun reactivateUser(userId: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = putReactivateUser(userId)
                if (success) {
                    _actionMessage.value = "User reactivated"
                    loadUsers()
                }
            } catch (e: Exception) {
                _error.value = "Failed to reactivate user: ${e.message}"
            }
        }
    }

    fun resetPassword(userId: String, newPassword: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = putResetPassword(userId, newPassword)
                if (success) {
                    _actionMessage.value = "Password reset successfully"
                }
            } catch (e: Exception) {
                _error.value = "Failed to reset password: ${e.message}"
            }
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    // ─── Private Network Calls ──────────────────────────────────────────────

    private suspend fun fetchUsers() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val url = serverUrl.trimEnd('/') + "/api/users"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<UserItem>>() {}.type
                        val userList: List<UserItem> = gson.fromJson(body, listType)
                        _users.value = userList
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load users (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    private suspend fun postCreateUser(
        username: String,
        displayName: String,
        password: String,
        email: String,
        isAdmin: Boolean
    ): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val json = gson.toJson(mapOf(
                "username" to username,
                "display_name" to displayName,
                "password" to password,
                "email" to email,
                "is_admin" to isAdmin
            ))

            val url = serverUrl.trimEnd('/') + "/api/users"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).post(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to create user (${response.code})"
                return@withContext false
            }
            true
        }
    }

    private suspend fun putUpdateUser(
        userId: String,
        username: String,
        displayName: String,
        email: String,
        isAdmin: Boolean
    ): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val json = gson.toJson(mapOf(
                "username" to username,
                "display_name" to displayName,
                "email" to email,
                "is_admin" to isAdmin
            ))

            val url = serverUrl.trimEnd('/') + "/api/users/$userId"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).put(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to update user (${response.code})"
                return@withContext false
            }
            true
        }
    }

    private suspend fun putDeactivateUser(userId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val url = serverUrl.trimEnd('/') + "/api/users/$userId/deactivate"
            val requestBody = "".toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).put(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                val body = response.body?.string() ?: ""
                _error.value = if (body.contains("last admin", ignoreCase = true)) {
                    "Cannot deactivate the last admin user"
                } else {
                    "Failed to deactivate user (${response.code})"
                }
                return@withContext false
            }
            true
        }
    }

    private suspend fun putReactivateUser(userId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val url = serverUrl.trimEnd('/') + "/api/users/$userId/reactivate"
            val requestBody = "".toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).put(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to reactivate user (${response.code})"
                return@withContext false
            }
            true
        }
    }

    private suspend fun putResetPassword(userId: String, newPassword: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val json = gson.toJson(mapOf("new_password" to newPassword))
            val url = serverUrl.trimEnd('/') + "/api/users/$userId/reset-password"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).put(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to reset password (${response.code})"
                return@withContext false
            }
            true
        }
    }
}
