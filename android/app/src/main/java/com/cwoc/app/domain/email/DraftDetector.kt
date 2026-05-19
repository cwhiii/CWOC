package com.cwoc.app.domain.email

import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Pure function: finds existing reply/forward drafts by matching
 * emailInReplyTo or normalized subject.
 *
 * Used to prevent duplicate drafts when the user initiates a Reply or Forward
 * action on a message that already has a draft in progress.
 */
object DraftDetector {

    // Prefixes to strip when normalizing subjects for forward matching.
    // Handles Re:, Fwd:, Fw: (case-insensitive), with optional spaces.
    private val SUBJECT_PREFIX_REGEX = Regex("^\\s*(Re|Fwd|Fw)\\s*:\\s*", RegexOption.IGNORE_CASE)

    /**
     * Finds an existing reply draft for the given original message.
     *
     * A reply draft is identified by having its emailInReplyTo field match
     * the original message's Message-ID.
     *
     * @param drafts List of draft chits to search through.
     * @param originalMessageId The Message-ID of the message being replied to. Null returns null.
     * @return The first matching draft, or null if no reply draft exists.
     */
    fun findExistingReply(drafts: List<ChitEntity>, originalMessageId: String?): ChitEntity? {
        if (originalMessageId.isNullOrBlank()) return null
        return drafts.firstOrNull { it.emailInReplyTo == originalMessageId }
    }

    /**
     * Finds an existing forward draft for the given original subject.
     *
     * A forward draft is identified by having a normalized subject that matches
     * the normalized original subject. Normalization strips "Re:", "Fwd:", "Fw:"
     * prefixes (case-insensitive, repeated) and trims whitespace.
     *
     * @param drafts List of draft chits to search through.
     * @param originalSubject The subject of the message being forwarded. Null returns null.
     * @return The first matching draft, or null if no forward draft exists.
     */
    fun findExistingForward(drafts: List<ChitEntity>, originalSubject: String?): ChitEntity? {
        if (originalSubject.isNullOrBlank()) return null
        val normalizedOriginal = normalizeSubject(originalSubject)
        if (normalizedOriginal.isBlank()) return null
        return drafts.firstOrNull { draft ->
            val draftSubject = draft.emailSubject ?: return@firstOrNull false
            normalizeSubject(draftSubject) == normalizedOriginal
        }
    }

    /**
     * Normalizes a subject line by repeatedly stripping Re:/Fwd:/Fw: prefixes
     * and trimming whitespace.
     */
    private fun normalizeSubject(subject: String): String {
        var normalized = subject.trim()
        var previous: String
        do {
            previous = normalized
            normalized = SUBJECT_PREFIX_REGEX.replace(normalized, "").trim()
        } while (normalized != previous)
        return normalized
    }
}
