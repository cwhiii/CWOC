package com.cwoc.app.domain.tags

import com.cwoc.app.data.repository.SettingsRepository
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages the most-recently-used (MRU) tag list.
 * Maintains a list of up to 5 recently used tag paths, persists to settings
 * with a debounced save (1s delay) to avoid hammering the API on rapid tag usage.
 *
 * Validates: Requirements 9.1, 9.2, 9.5, 9.6
 */
@Singleton
class RecentTagsManager @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val gson: Gson
) {
    companion object {
        private const val MAX_RECENT_TAGS = 5
        private const val SAVE_DEBOUNCE_MS = 1000L
    }

    private val _recentTags = MutableStateFlow<List<String>>(emptyList())
    val recentTags: StateFlow<List<String>> = _recentTags.asStateFlow()

    private var loaded = false
    private var saveJob: Job? = null

    /**
     * Loads recent tags from settings on first access.
     * Safe to call multiple times — only loads once.
     */
    suspend fun loadIfNeeded() {
        if (loaded) return
        loaded = true
        val settings = settingsRepository.get()
        if (settings != null && !settings.recentTags.isNullOrBlank()) {
            try {
                val list: List<String> = gson.fromJson(
                    settings.recentTags,
                    object : TypeToken<List<String>>() {}.type
                ) ?: emptyList()
                _recentTags.value = list.take(MAX_RECENT_TAGS)
            } catch (_: Exception) {
                _recentTags.value = emptyList()
            }
        }
    }

    /**
     * Tracks a tag as recently used. Moves it to the front of the MRU list,
     * caps at 5, and triggers a debounced save to settings.
     *
     * @param path The full tag path (e.g. "Work/Projects/Alpha")
     * @param scope CoroutineScope to launch the debounced save in
     */
    fun trackTag(path: String, scope: CoroutineScope) {
        val current = _recentTags.value.toMutableList()
        current.remove(path)
        current.add(0, path)
        val updated = current.take(MAX_RECENT_TAGS)
        _recentTags.value = updated

        // Debounced save — cancel any pending save and schedule a new one
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(SAVE_DEBOUNCE_MS)
            persistToSettings(updated)
        }
    }

    /**
     * Returns the current recent tags list.
     */
    fun getRecentTags(): List<String> = _recentTags.value

    /**
     * Persists the recent tags list to settings via SettingsRepository.
     */
    private suspend fun persistToSettings(tags: List<String>) {
        val settings = settingsRepository.get() ?: return
        val updatedSettings = settings.copy(recentTags = gson.toJson(tags))
        settingsRepository.update(updatedSettings)
    }
}
