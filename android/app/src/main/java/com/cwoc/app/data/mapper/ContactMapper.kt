package com.cwoc.app.data.mapper

import com.cwoc.app.data.local.entity.ContactEntity

/**
 * Form state representing the editable fields of a contact in the editor UI.
 * Decoupled from ContactEntity to allow dirty comparison and UI-friendly defaults.
 *
 * Mirrors all user-editable fields from ContactEntity.
 */
data class ContactFormState(
    val id: String,
    val givenName: String = "",
    val surname: String = "",
    val middleNames: String = "",
    val prefix: String = "",
    val suffix: String = "",
    val nickname: String = "",
    val displayName: String = "",
    val phones: String = "",
    val emails: String = "",
    val addresses: String = "",
    val callSigns: String = "",
    val xHandles: String = "",
    val websites: String = "",
    val dates: String = "",
    val hasSignal: Boolean = false,
    val signalUsername: String = "",
    val pgpKey: String = "",
    val favorite: Boolean = false,
    val color: String = "",
    val organization: String = "",
    val socialContext: String = "",
    val imageUrl: String? = null,
    val notes: String = "",
    val tags: List<String> = emptyList(),
    val sharedToVault: Boolean = false,
    val isNew: Boolean = false
)

/**
 * Converts a ContactEntity to a ContactFormState for display in the editor.
 * Nullable entity fields are mapped to safe defaults (empty string, empty list, false).
 */
fun ContactEntity.toContactFormState(): ContactFormState {
    return ContactFormState(
        id = id,
        givenName = givenName,
        surname = surname ?: "",
        middleNames = middleNames ?: "",
        prefix = prefix ?: "",
        suffix = suffix ?: "",
        nickname = nickname ?: "",
        displayName = displayName ?: "",
        phones = phones ?: "",
        emails = emails ?: "",
        addresses = addresses ?: "",
        callSigns = callSigns ?: "",
        xHandles = xHandles ?: "",
        websites = websites ?: "",
        dates = dates ?: "",
        hasSignal = hasSignal,
        signalUsername = signalUsername ?: "",
        pgpKey = pgpKey ?: "",
        favorite = favorite,
        color = color ?: "",
        organization = organization ?: "",
        socialContext = socialContext ?: "",
        imageUrl = imageUrl,
        notes = notes ?: "",
        tags = tags ?: emptyList(),
        sharedToVault = sharedToVault,
        isNew = false
    )
}

/**
 * Converts a ContactFormState back to a ContactEntity for persistence.
 * Non-editable fields (sync metadata, timestamps) are preserved from the original entity
 * or use defaults for new contacts.
 *
 * @param originalEntity The existing entity (null for new contacts)
 * @param modifiedDatetime The current timestamp to set as modifiedDatetime
 * @param createdDatetime The creation timestamp (current time for new, original for existing)
 */
fun ContactFormState.toContactEntity(
    originalEntity: ContactEntity?,
    modifiedDatetime: String,
    createdDatetime: String?
): ContactEntity {
    return ContactEntity(
        id = id,
        givenName = givenName,
        surname = surname.ifBlank { null },
        middleNames = middleNames.ifBlank { null },
        prefix = prefix.ifBlank { null },
        suffix = suffix.ifBlank { null },
        nickname = nickname.ifBlank { null },
        displayName = displayName.ifBlank { null },
        phones = phones.ifBlank { null },
        emails = emails.ifBlank { null },
        addresses = addresses.ifBlank { null },
        callSigns = callSigns.ifBlank { null },
        xHandles = xHandles.ifBlank { null },
        websites = websites.ifBlank { null },
        dates = dates.ifBlank { null },
        hasSignal = hasSignal,
        signalUsername = signalUsername.ifBlank { null },
        pgpKey = pgpKey.ifBlank { null },
        favorite = favorite,
        color = color.ifBlank { null },
        organization = organization.ifBlank { null },
        socialContext = socialContext.ifBlank { null },
        imageUrl = imageUrl,
        notes = notes.ifBlank { null },
        tags = tags.ifEmpty { null },
        sharedToVault = sharedToVault,
        createdDatetime = createdDatetime,
        modifiedDatetime = modifiedDatetime,
        syncVersion = originalEntity?.syncVersion ?: 0,
        lastSyncedAt = originalEntity?.lastSyncedAt,
        isDirty = true,
        dirtyFields = "[]", // Will be set by DirtyTracker
        deleted = originalEntity?.deleted ?: false,
        hasUnviewedConflict = originalEntity?.hasUnviewedConflict ?: false,
        conflictFields = originalEntity?.conflictFields
    )
}

/**
 * Detects which fields changed between an original ContactEntity and the current form state.
 * Returns field names using camelCase (matching the entity field naming convention used
 * by the dirty tracker and push DTO).
 *
 * For new contacts (original == null), returns all non-default/non-empty fields as dirty.
 * For existing contacts, compares each editable field and returns those that differ.
 */
fun detectContactChangedFields(original: ContactEntity?, form: ContactFormState): Set<String> {
    if (original == null) {
        // New contact — all non-null/non-default fields are dirty
        return buildSet {
            if (form.givenName.isNotBlank()) add("givenName")
            if (form.surname.isNotBlank()) add("surname")
            if (form.middleNames.isNotBlank()) add("middleNames")
            if (form.prefix.isNotBlank()) add("prefix")
            if (form.suffix.isNotBlank()) add("suffix")
            if (form.nickname.isNotBlank()) add("nickname")
            if (form.displayName.isNotBlank()) add("displayName")
            if (form.phones.isNotBlank()) add("phones")
            if (form.emails.isNotBlank()) add("emails")
            if (form.addresses.isNotBlank()) add("addresses")
            if (form.callSigns.isNotBlank()) add("callSigns")
            if (form.xHandles.isNotBlank()) add("xHandles")
            if (form.websites.isNotBlank()) add("websites")
            if (form.dates.isNotBlank()) add("dates")
            if (form.hasSignal) add("hasSignal")
            if (form.signalUsername.isNotBlank()) add("signalUsername")
            if (form.pgpKey.isNotBlank()) add("pgpKey")
            if (form.favorite) add("favorite")
            if (form.color.isNotBlank()) add("color")
            if (form.organization.isNotBlank()) add("organization")
            if (form.socialContext.isNotBlank()) add("socialContext")
            if (form.imageUrl != null) add("imageUrl")
            if (form.notes.isNotBlank()) add("notes")
            if (form.tags.isNotEmpty()) add("tags")
            if (form.sharedToVault) add("sharedToVault")
        }
    }

    // Existing contact — compare field by field
    return buildSet {
        if (form.givenName != original.givenName) add("givenName")
        if (form.surname != (original.surname ?: "")) add("surname")
        if (form.middleNames != (original.middleNames ?: "")) add("middleNames")
        if (form.prefix != (original.prefix ?: "")) add("prefix")
        if (form.suffix != (original.suffix ?: "")) add("suffix")
        if (form.nickname != (original.nickname ?: "")) add("nickname")
        if (form.displayName != (original.displayName ?: "")) add("displayName")
        if (form.phones != (original.phones ?: "")) add("phones")
        if (form.emails != (original.emails ?: "")) add("emails")
        if (form.addresses != (original.addresses ?: "")) add("addresses")
        if (form.callSigns != (original.callSigns ?: "")) add("callSigns")
        if (form.xHandles != (original.xHandles ?: "")) add("xHandles")
        if (form.websites != (original.websites ?: "")) add("websites")
        if (form.dates != (original.dates ?: "")) add("dates")
        if (form.hasSignal != original.hasSignal) add("hasSignal")
        if (form.signalUsername != (original.signalUsername ?: "")) add("signalUsername")
        if (form.pgpKey != (original.pgpKey ?: "")) add("pgpKey")
        if (form.favorite != original.favorite) add("favorite")
        if (form.color != (original.color ?: "")) add("color")
        if (form.organization != (original.organization ?: "")) add("organization")
        if (form.socialContext != (original.socialContext ?: "")) add("socialContext")
        if (form.imageUrl != original.imageUrl) add("imageUrl")
        if (form.notes != (original.notes ?: "")) add("notes")
        if (form.tags != (original.tags ?: emptyList<String>())) add("tags")
        if (form.sharedToVault != original.sharedToVault) add("sharedToVault")
    }
}
