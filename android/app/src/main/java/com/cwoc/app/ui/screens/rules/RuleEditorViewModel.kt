package com.cwoc.app.ui.screens.rules

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
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

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class RuleEditorViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _isDeleted = MutableStateFlow(false)
    val isDeleted: StateFlow<Boolean> = _isDeleted.asStateFlow()

    // ─── Form State ─────────────────────────────────────────────────────────

    private val _name = MutableStateFlow("")
    val name: StateFlow<String> = _name.asStateFlow()

    private val _description = MutableStateFlow("")
    val description: StateFlow<String> = _description.asStateFlow()

    private val _triggerType = MutableStateFlow("manual")
    val triggerType: StateFlow<String> = _triggerType.asStateFlow()

    private val _cronExpression = MutableStateFlow("")
    val cronExpression: StateFlow<String> = _cronExpression.asStateFlow()

    private val _eventType = MutableStateFlow("chit_created")
    val eventType: StateFlow<String> = _eventType.asStateFlow()

    private val _actionType = MutableStateFlow("create_chit")
    val actionType: StateFlow<String> = _actionType.asStateFlow()

    private val _actionConfigJson = MutableStateFlow("")
    val actionConfigJson: StateFlow<String> = _actionConfigJson.asStateFlow()

    private val _enabled = MutableStateFlow(true)
    val enabled: StateFlow<Boolean> = _enabled.asStateFlow()

    private val _isHabit = MutableStateFlow(false)
    val isHabit: StateFlow<Boolean> = _isHabit.asStateFlow()

    private var _ruleId: String? = null
    val isNewRule: Boolean get() = _ruleId == null || _ruleId == "new"

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadRule(ruleId: String) {
        if (ruleId == "new") return
        _ruleId = ruleId
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchRule(ruleId)
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun setName(value: String) { _name.value = value }
    fun setDescription(value: String) { _description.value = value }
    fun setTriggerType(value: String) { _triggerType.value = value }
    fun setCronExpression(value: String) { _cronExpression.value = value }
    fun setEventType(value: String) { _eventType.value = value }
    fun setActionType(value: String) { _actionType.value = value }
    fun setActionConfigJson(value: String) { _actionConfigJson.value = value }
    fun setEnabled(value: Boolean) { _enabled.value = value }
    fun setIsHabit(value: Boolean) { _isHabit.value = value }

    fun saveRule(onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isSaving.value = true
            _error.value = null
            try {
                val success = if (isNewRule) {
                    postCreateRule()
                } else {
                    putUpdateRule(_ruleId!!)
                }
                if (success) {
                    _actionMessage.value = if (isNewRule) "Rule created" else "Rule updated"
                    onSuccess()
                }
            } catch (e: Exception) {
                _error.value = "Failed to save rule: ${e.message}"
            } finally {
                _isSaving.value = false
            }
        }
    }

    fun deleteRule(onSuccess: () -> Unit) {
        val ruleId = _ruleId ?: return
        viewModelScope.launch {
            _error.value = null
            try {
                val success = deleteRuleRequest(ruleId)
                if (success) {
                    _isDeleted.value = true
                    onSuccess()
                }
            } catch (e: Exception) {
                _error.value = "Failed to delete rule: ${e.message}"
            }
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    // ─── Private Network Calls ──────────────────────────────────────────────

    private suspend fun fetchRule(ruleId: String) {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val url = serverUrl.trimEnd('/') + "/api/rules/$ruleId"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val rule: RuleItem = gson.fromJson(body, RuleItem::class.java)
                        populateForm(rule)
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load rule (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    private fun populateForm(rule: RuleItem) {
        _name.value = rule.name
        _description.value = rule.description ?: ""
        _triggerType.value = rule.triggerType ?: "manual"
        _enabled.value = rule.enabled
        _isHabit.value = rule.isHabit ?: false
        _actionType.value = rule.actionType ?: "create_chit"

        // Parse trigger config
        when (rule.triggerType) {
            "cron" -> {
                _cronExpression.value = (rule.triggerConfig?.get("cron") as? String) ?: ""
            }
            "event" -> {
                _eventType.value = (rule.triggerConfig?.get("event_type") as? String) ?: "chit_created"
            }
        }

        // Action config as JSON string
        if (rule.actionConfig != null) {
            _actionConfigJson.value = gson.toJson(rule.actionConfig)
        }
    }

    private fun buildRequestBody(): String {
        val triggerConfig: Map<String, Any>? = when (_triggerType.value) {
            "cron" -> mapOf("cron" to _cronExpression.value)
            "event" -> mapOf("event_type" to _eventType.value)
            else -> null
        }

        val scheduleConfig: Map<String, Any>? = when (_triggerType.value) {
            "cron" -> mapOf("cron" to _cronExpression.value)
            else -> null
        }

        val actionConfig: Map<String, Any>? = if (_actionConfigJson.value.isNotBlank()) {
            try {
                val mapType = object : TypeToken<Map<String, Any>>() {}.type
                gson.fromJson(_actionConfigJson.value, mapType)
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }

        val body = mutableMapOf<String, Any?>(
            "name" to _name.value,
            "description" to _description.value,
            "trigger_type" to _triggerType.value,
            "trigger_config" to triggerConfig,
            "action_type" to _actionType.value,
            "action_config" to actionConfig,
            "enabled" to _enabled.value,
            "schedule_config" to scheduleConfig,
            "is_habit" to _isHabit.value
        )

        return gson.toJson(body)
    }

    private suspend fun postCreateRule(): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val json = buildRequestBody()
            val url = serverUrl.trimEnd('/') + "/api/rules"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).post(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to create rule (${response.code})"
                return@withContext false
            }
            true
        }
    }

    private suspend fun putUpdateRule(ruleId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val json = buildRequestBody()
            val url = serverUrl.trimEnd('/') + "/api/rules/$ruleId"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).put(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to update rule (${response.code})"
                return@withContext false
            }
            true
        }
    }

    private suspend fun deleteRuleRequest(ruleId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val url = serverUrl.trimEnd('/') + "/api/rules/$ruleId"
            val request = Request.Builder().url(url).delete().build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to delete rule (${response.code})"
                return@withContext false
            }
            true
        }
    }
}
