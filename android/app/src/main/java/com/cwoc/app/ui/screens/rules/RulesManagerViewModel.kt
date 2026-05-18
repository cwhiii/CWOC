package com.cwoc.app.ui.screens.rules

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

data class RuleItem(
    val id: String,
    val name: String,
    val description: String?,
    @SerializedName("trigger_type") val triggerType: String?,
    @SerializedName("trigger_config") val triggerConfig: Map<String, Any>?,
    @SerializedName("action_type") val actionType: String?,
    @SerializedName("action_config") val actionConfig: Map<String, Any>?,
    val enabled: Boolean,
    val priority: Int?,
    @SerializedName("owner_id") val ownerId: String?,
    @SerializedName("created_datetime") val createdDatetime: String?,
    @SerializedName("modified_datetime") val modifiedDatetime: String?,
    @SerializedName("schedule_config") val scheduleConfig: Map<String, Any>?,
    @SerializedName("is_habit") val isHabit: Boolean?
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class RulesManagerViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _rules = MutableStateFlow<List<RuleItem>>(emptyList())
    val rules: StateFlow<List<RuleItem>> = _rules.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    init {
        loadRules()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadRules() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchRules()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleRule(ruleId: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = patchToggleRule(ruleId)
                if (success) {
                    // Update local state optimistically
                    _rules.value = _rules.value.map { rule ->
                        if (rule.id == ruleId) rule.copy(enabled = !rule.enabled) else rule
                    }
                }
            } catch (e: Exception) {
                _error.value = "Failed to toggle rule: ${e.message}"
            }
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    // ─── Private Network Calls ──────────────────────────────────────────────

    private suspend fun fetchRules() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val url = serverUrl.trimEnd('/') + "/api/rules"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<RuleItem>>() {}.type
                        val ruleList: List<RuleItem> = gson.fromJson(body, listType)
                        _rules.value = ruleList
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load rules (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    private suspend fun patchToggleRule(ruleId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val url = serverUrl.trimEnd('/') + "/api/rules/$ruleId/toggle"
            val requestBody = "".toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).patch(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to toggle rule (${response.code})"
                return@withContext false
            }
            true
        }
    }
}
