package com.cwoc.app.ui.screens.help

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.CwocApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// ─── Models ─────────────────────────────────────────────────────────────────────

/**
 * Represents a single help documentation topic.
 * Slug is the filename without .md extension, title is derived from the first H1 heading
 * or formatted from the slug, and content is the raw markdown.
 */
data class HelpTopic(
    val slug: String,
    val title: String,
    val content: String
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class HelpViewModel @Inject constructor(
    private val apiService: CwocApiService
) : ViewModel() {

    private val _topics = MutableStateFlow<List<HelpTopic>>(emptyList())
    val topics: StateFlow<List<HelpTopic>> = _topics.asStateFlow()

    private val _selectedTopic = MutableStateFlow<HelpTopic?>(null)
    val selectedTopic: StateFlow<HelpTopic?> = _selectedTopic.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadTopics()
    }

    /**
     * Fetches the topic list from /api/docs and loads content for each topic.
     * The index endpoint returns filenames; we derive slugs and titles from them,
     * then fetch each topic's content individually.
     */
    private fun loadTopics() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val response = apiService.getDocsIndex()
                if (response.isSuccessful) {
                    val docsIndex = response.body()
                    val files = docsIndex?.files ?: emptyList()

                    // Build topic list from filenames — fetch content for each
                    val loadedTopics = files.mapNotNull { filename ->
                        val slug = filename.removeSuffix(".md")
                        try {
                            val contentResponse = apiService.getDocContent(slug)
                            if (contentResponse.isSuccessful) {
                                val body = contentResponse.body()
                                val content = body?.content ?: ""
                                val title = extractTitle(content, slug)
                                HelpTopic(slug = slug, title = title, content = content)
                            } else {
                                // If individual fetch fails, still include with empty content
                                val title = formatSlugAsTitle(slug)
                                HelpTopic(slug = slug, title = title, content = "")
                            }
                        } catch (_: Exception) {
                            val title = formatSlugAsTitle(slug)
                            HelpTopic(slug = slug, title = title, content = "")
                        }
                    }

                    _topics.value = loadedTopics
                }
            } catch (_: Exception) {
                // Network error — topics remain empty, UI shows error state
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Selects a topic by slug for detail display.
     */
    fun selectTopic(slug: String) {
        _selectedTopic.value = _topics.value.find { it.slug == slug }
    }

    /**
     * Clears the selected topic, returning to the topic list view.
     */
    fun goBack() {
        _selectedTopic.value = null
    }

    /**
     * Extracts the title from the first H1 heading in the markdown content.
     * Falls back to formatting the slug as a title if no H1 is found.
     */
    private fun extractTitle(content: String, slug: String): String {
        val lines = content.lines()
        for (line in lines) {
            if (line.startsWith("# ")) {
                return line.removePrefix("# ").trim()
            }
        }
        return formatSlugAsTitle(slug)
    }

    /**
     * Converts a slug like "ntfy-notifications" to "Ntfy Notifications".
     */
    private fun formatSlugAsTitle(slug: String): String {
        return slug.split("-").joinToString(" ") { word ->
            word.replaceFirstChar { it.uppercase() }
        }
    }
}
