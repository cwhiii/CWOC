package com.cwoc.app.data.mapper

import com.cwoc.app.data.local.entity.ContactEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Builds vCard 3.0 strings from ContactEntity data.
 * Used for QR code generation and single-contact export.
 * Mirrors the web's contact-qr.js generateContactVCard() output.
 */
object VCardBuilder {

    /** Maximum QR code byte capacity at error correction level L */
    const val MAX_QR_BYTES = 2953

    private val gson = Gson()

    /**
     * Build a complete vCard 3.0 string from a ContactEntity.
     */
    fun build(contact: ContactEntity): String {
        val lines = mutableListOf<String>()
        lines.add("BEGIN:VCARD")
        lines.add("VERSION:3.0")

        // N property: surname;given;middle;prefix;suffix
        val surname = contact.surname ?: ""
        val givenName = contact.givenName
        val middleNames = contact.middleNames ?: ""
        val prefix = contact.prefix ?: ""
        val suffix = contact.suffix ?: ""
        lines.add("N:$surname;$givenName;$middleNames;$prefix;$suffix")

        // FN property
        val displayName = contact.displayName ?: listOfNotNull(
            contact.prefix, contact.givenName, contact.middleNames, contact.surname, contact.suffix
        ).filter { it.isNotBlank() }.joinToString(" ")
        if (displayName.isNotBlank()) {
            lines.add("FN:$displayName")
        }

        // Multi-value fields
        addMultiValue(lines, "TEL", contact.phones)
        addMultiValue(lines, "EMAIL", contact.emails)

        // ADR — put full address in street field
        parseMultiValue(contact.addresses)?.forEach { entry ->
            val value = entry["value"] as? String ?: return@forEach
            if (value.isBlank()) return@forEach
            val label = entry["label"] as? String
            val adrValue = ";;$value;;;;"
            if (!label.isNullOrBlank()) {
                lines.add("ADR;TYPE=$label:$adrValue")
            } else {
                lines.add("ADR:$adrValue")
            }
        }

        addMultiValue(lines, "URL", contact.websites)

        // X-SIGNAL
        if (contact.hasSignal) {
            lines.add("X-SIGNAL:true")
        }

        // X-PGP-KEY
        if (!contact.pgpKey.isNullOrBlank()) {
            lines.add("X-PGP-KEY:${contact.pgpKey}")
        }

        addMultiValue(lines, "X-CALLSIGN", contact.callSigns)
        addMultiValue(lines, "X-XHANDLE", contact.xHandles)

        // X-FAVORITE
        if (contact.favorite) {
            lines.add("X-FAVORITE:true")
        }

        // ORG
        if (!contact.organization.isNullOrBlank()) {
            lines.add("ORG:${contact.organization}")
        }

        // NICKNAME
        if (!contact.nickname.isNullOrBlank()) {
            lines.add("NICKNAME:${contact.nickname}")
        }

        // NOTE — remaining non-standard fields
        val extraNotes = mutableListOf<String>()
        if (!contact.socialContext.isNullOrBlank()) extraNotes.add("Social Context: ${contact.socialContext}")
        if (!contact.signalUsername.isNullOrBlank()) extraNotes.add("Signal: ${contact.signalUsername}")
        if (!contact.color.isNullOrBlank()) extraNotes.add("Color: ${contact.color}")
        if (extraNotes.isNotEmpty()) {
            lines.add("NOTE:${extraNotes.joinToString("\\n")}")
        }

        // BDAY — from first date entry with label "Birthday"
        parseMultiValue(contact.dates)?.forEach { entry ->
            val label = (entry["label"] as? String)?.lowercase() ?: ""
            val value = entry["value"] as? String ?: ""
            if (label == "birthday" && value.isNotBlank()) {
                lines.add("BDAY:$value")
                return@forEach
            }
        }

        lines.add("END:VCARD")
        return lines.joinToString("\r\n")
    }

    /**
     * Calculate the UTF-8 byte size of a vCard string.
     */
    fun byteSize(vcard: String): Int = vcard.toByteArray(Charsets.UTF_8).size

    /**
     * Check if a vCard fits within QR code capacity.
     */
    fun fitsInQr(vcard: String): Boolean = byteSize(vcard) <= MAX_QR_BYTES

    // ─── Private helpers ────────────────────────────────────────────────────

    private fun addMultiValue(lines: MutableList<String>, prop: String, json: String?) {
        parseMultiValue(json)?.forEach { entry ->
            val value = entry["value"] as? String ?: return@forEach
            if (value.isBlank()) return@forEach
            val label = entry["label"] as? String
            if (!label.isNullOrBlank()) {
                lines.add("$prop;TYPE=$label:$value")
            } else {
                lines.add("$prop:$value")
            }
        }
    }

    private fun parseMultiValue(json: String?): List<Map<String, Any?>>? {
        if (json.isNullOrBlank() || json == "[]") return null
        return try {
            val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
            gson.fromJson<List<Map<String, Any?>>>(json, type)
        } catch (_: Exception) {
            null
        }
    }
}
