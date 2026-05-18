package com.cwoc.app.ui.screens.contacts

import android.content.SharedPreferences
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.mapper.ContactFormState
import com.cwoc.app.data.mapper.detectContactChangedFields
import com.cwoc.app.data.mapper.toContactEntity
import com.cwoc.app.data.mapper.toContactFormState
import com.cwoc.app.data.repository.ContactRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
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
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

// ─── Profile Data Model ─────────────────────────────────────────────────────────

data class UserProfile(
    val id: String? = null,
    val username: String? = null,
    @SerializedName("display_name") val displayName: String? = null,
    val email: String? = null,
    @SerializedName("given_name") val givenName: String? = null,
    val surname: String? = null,
    @SerializedName("middle_names") val middleNames: String? = null,
    val prefix: String? = null,
    val suffix: String? = null,
    val nickname: String? = null,
    val phones: String? = null,
    val addresses: String? = null,
    val organization: String? = null,
    @SerializedName("social_context") val socialContext: String? = null,
    val notes: String? = null,
    @SerializedName("profile_image_url") val profileImageUrl: String? = null
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Contact Editor screen.
 *
 * Handles both creating new contacts, editing existing ones, and viewing/editing user profiles.
 * Accepts a `contactId` via SavedStateHandle:
 *   - null or "new" → creation mode (generates a UUID)
 *   - "profile" with userId → profile mode (loads from API)
 *   - any other value → edit mode (loads existing entity from Room)
 *
 * Profile mode:
 *   - When userId is provided, fetches user profile from /api/auth/users/{userId}/profile
 *   - Read-only for other users' profiles, editable for self
 *   - Save calls PUT /api/auth/users/{userId}/profile
 *
 * On save (contact mode):
 *   - Detects changed fields via detectContactChangedFields()
 *   - Converts form to entity, persists via ContactRepository
 *   - Marks dirty via DirtyTracker.markContactDirty()
 *   - Triggers immediate push if online
 *
 * On delete:
 *   - Soft-deletes via ContactRepository.delete()
 */
@HiltViewModel
class ContactEditorViewModel @Inject constructor(
    private val contactRepository: ContactRepository,
    private val settingsRepository: SettingsRepository,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        const val NEW_CONTACT_ID = "new"
        const val PROFILE_CONTACT_ID = "profile"
    }

    private val contactId: String? = savedStateHandle.get<String>("contactId")
    private val userId: String? = savedStateHandle.get<String>("userId")
    private val prefillEmail: String? = savedStateHandle.get<String>("prefillEmail")
    private val prefillName: String? = savedStateHandle.get<String>("prefillName")
    private val isNew: Boolean = contactId == null || contactId == NEW_CONTACT_ID
    val isProfileMode: Boolean = userId != null

    /** Whether this is the current user's own profile (editable). */
    private val _isOwnProfile = MutableStateFlow(false)
    val isOwnProfile: StateFlow<Boolean> = _isOwnProfile.asStateFlow()

    /** Whether the form is read-only (other user's profile). */
    val isReadOnly: Boolean
        get() = isProfileMode && !_isOwnProfile.value

    /** The original entity loaded from Room (null for new contacts and profile mode). */
    private var originalEntity: ContactEntity? = null

    private val _formState = MutableStateFlow(
        ContactFormState(
            id = if (isNew && !isProfileMode) UUID.randomUUID().toString()
                 else contactId ?: "profile",
            isNew = isNew && !isProfileMode
        )
    )
    /** Current form state exposed to the UI. */
    val formState: StateFlow<ContactFormState> = _formState.asStateFlow()

    private val _isLoading = MutableStateFlow(!isNew || isProfileMode)
    /** True while loading an existing contact from Room or profile from API. */
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSaved = MutableStateFlow(false)
    /** Set to true after save, delete, or discard to trigger navigation back. */
    val isSaved: StateFlow<Boolean> = _isSaved.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    /** Custom colors from user settings for the color picker. */
    private val _customColors = MutableStateFlow<List<String>>(emptyList())
    val customColors: StateFlow<List<String>> = _customColors.asStateFlow()

    init {
        if (isProfileMode) {
            loadProfile()
        } else if (!isNew) {
            loadExistingContact()
        } else {
            // New contact — apply defaults
            applyNewContactDefaults()
        }
        loadCustomColors()
    }

    /**
     * Apply defaults for new contacts: vault setting, prefill from nav args.
     */
    private fun applyNewContactDefaults() {
        viewModelScope.launch {
            var form = _formState.value

            // Check default_share_contacts setting
            val settings = settingsRepository.get()
            if (settings?.defaultShareContacts == "1") {
                form = form.copy(sharedToVault = true)
            }

            // Prefill from navigation args
            if (!prefillEmail.isNullOrBlank()) {
                val emailJson = """[{"label":"Email","value":"$prefillEmail"}]"""
                form = form.copy(emails = emailJson)
            }
            if (!prefillName.isNullOrBlank()) {
                val parts = prefillName.trim().split("\\s+".toRegex())
                form = form.copy(
                    givenName = parts.firstOrNull() ?: "",
                    surname = if (parts.size > 1) parts.drop(1).joinToString(" ") else ""
                )
            }

            _formState.value = form
        }
    }

    // ─── Profile Mode Loading ───────────────────────────────────────────────

    /**
     * Loads a user profile from the API.
     */
    private fun loadProfile() {
        viewModelScope.launch {
            try {
                val currentUserId = prefs.getString("user_id", "") ?: ""
                _isOwnProfile.value = (userId == currentUserId)

                val profile = fetchUserProfile(userId!!)
                if (profile != null) {
                    _formState.value = ContactFormState(
                        id = profile.id ?: userId,
                        givenName = profile.givenName ?: "",
                        surname = profile.surname ?: "",
                        middleNames = profile.middleNames ?: "",
                        prefix = profile.prefix ?: "",
                        suffix = profile.suffix ?: "",
                        nickname = profile.nickname ?: "",
                        displayName = profile.displayName ?: "",
                        phones = profile.phones ?: "",
                        emails = profile.email ?: "",
                        addresses = profile.addresses ?: "",
                        organization = profile.organization ?: "",
                        socialContext = profile.socialContext ?: "",
                        notes = profile.notes ?: "",
                        imageUrl = profile.profileImageUrl,
                        isNew = false
                    )
                } else {
                    _error.value = "Failed to load profile"
                }
            } catch (e: Exception) {
                _error.value = "Error loading profile: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun fetchUserProfile(userId: String): UserProfile? {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) return@withContext null

                val url = serverUrl.trimEnd('/') + "/api/auth/users/$userId/profile"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        gson.fromJson(body, UserProfile::class.java)
                    } else null
                } else null
            } catch (_: Exception) {
                null
            }
        }
    }

    /**
     * Save profile changes to the API.
     */
    private fun saveProfile() {
        viewModelScope.launch {
            try {
                val form = _formState.value
                val success = putUserProfile(userId!!, form)
                if (success) {
                    _isSaved.value = true
                } else {
                    _error.value = "Failed to save profile"
                }
            } catch (e: Exception) {
                _error.value = "Error saving profile: ${e.message}"
            }
        }
    }

    private suspend fun putUserProfile(userId: String, form: ContactFormState): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) return@withContext false

                val profileData = mapOf(
                    "given_name" to form.givenName,
                    "surname" to form.surname,
                    "middle_names" to form.middleNames,
                    "prefix" to form.prefix,
                    "suffix" to form.suffix,
                    "nickname" to form.nickname,
                    "display_name" to form.displayName,
                    "phones" to form.phones,
                    "email" to form.emails,
                    "addresses" to form.addresses,
                    "organization" to form.organization,
                    "social_context" to form.socialContext,
                    "notes" to form.notes
                )

                val json = gson.toJson(profileData)
                val url = serverUrl.trimEnd('/') + "/api/auth/users/$userId/profile"
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).put(requestBody).build()
                val response = okHttpClient.newCall(request).execute()
                response.isSuccessful
            } catch (_: Exception) {
                false
            }
        }
    }

    // ─── Contact Mode Loading ───────────────────────────────────────────────

    /**
     * Loads an existing contact from Room and populates the form state.
     * Sets isLoading to false when complete.
     */
    private fun loadExistingContact() {
        viewModelScope.launch {
            val entity = contactRepository.getById(contactId!!)
            if (entity != null) {
                originalEntity = entity
                _formState.value = entity.toContactFormState()
            }
            _isLoading.value = false
        }
    }

    /**
     * Loads custom colors from user settings for the color picker.
     */
    private fun loadCustomColors() {
        viewModelScope.launch {
            val settings = settingsRepository.get()
            if (settings != null) {
                val colors = try {
                    settings.customColors?.let { json ->
                        gson.fromJson<List<String>>(json, object : TypeToken<List<String>>() {}.type)
                    } ?: emptyList()
                } catch (_: Exception) {
                    emptyList()
                }
                _customColors.value = colors
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Updates the form state. Called by the UI when any field changes.
     */
    fun updateForm(newState: ContactFormState) {
        _formState.value = newState
    }

    /**
     * Convenience method for updating a single field via a lambda.
     * Example: `viewModel.updateField { it.copy(givenName = "John") }`
     */
    fun updateField(updater: (ContactFormState) -> ContactFormState) {
        _formState.value = updater(_formState.value)
    }

    /**
     * Persists the current form state.
     * In profile mode: calls PUT /api/auth/users/{userId}/profile
     * In contact mode: persists via ContactRepository
     */
    fun save() {
        if (isProfileMode) {
            saveProfile()
            return
        }

        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            // Detect which fields changed
            val changedFields = detectContactChangedFields(originalEntity, form)

            // If editing an existing contact with no changes, just navigate back
            if (changedFields.isEmpty() && !isNew) {
                _isSaved.value = true
                return@launch
            }

            // Convert form state to entity for persistence
            val entity = form.toContactEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            if (isNew) {
                contactRepository.create(entity)
            } else {
                contactRepository.update(entity, changedFields)
            }

            // Signal navigation back
            _isSaved.value = true
        }
    }

    /**
     * Soft-deletes the contact via ContactRepository.
     * Not available in profile mode.
     */
    fun delete() {
        if (isProfileMode) return

        viewModelScope.launch {
            val id = _formState.value.id
            contactRepository.delete(id)

            // Signal navigation back
            _isSaved.value = true
        }
    }

    /**
     * Discards changes and navigates back without any DB writes.
     */
    fun discard() {
        _isSaved.value = true
    }
}
