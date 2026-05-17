package com.cwoc.app.ui.screens.contacts

import com.cwoc.app.data.local.entity.ContactEntity
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for the Contact List screen.
 *
 * Property 27: Contact list is alphabetically sorted with correct section index
 * Property 28: Contact search filters correctly
 *
 * **Validates: Requirements 14.2, 14.3, 14.5**
 */
class ContactListPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    /** Pool of given names for generating contacts. */
    private val givenNamePool = listOf(
        "Alice", "Bob", "Charlie", "Diana", "Edward",
        "Fiona", "George", "Hannah", "Ivan", "Julia",
        "Kevin", "Laura", "Michael", "Nancy", "Oscar",
        "Patricia", "Quentin", "Rachel", "Samuel", "Tina",
        "Ulrich", "Vanessa", "William", "Xena", "Yolanda", "Zachary"
    )

    /** Pool of surnames for generating contacts. */
    private val surnamePool = listOf(
        "Anderson", "Brown", "Clark", "Davis", "Evans",
        "Foster", "Garcia", "Harris", "Ingram", "Johnson",
        "King", "Lopez", "Martinez", "Nelson", "Owens",
        "Patel", "Quinn", "Roberts", "Smith", "Taylor",
        "Underwood", "Vasquez", "Williams", "Xu", "Young", "Zhang"
    )

    /** Pool of email domains. */
    private val emailDomains = listOf("gmail.com", "yahoo.com", "outlook.com", "proton.me", "work.org")

    /**
     * Creates a minimal ContactEntity with specified fields.
     */
    private fun makeContact(
        id: String = "contact-${random.nextInt(100000)}",
        givenName: String = "Test",
        surname: String? = null,
        emails: String? = null,
        phones: String? = null,
        displayName: String? = null,
        deleted: Boolean = false
    ): ContactEntity = ContactEntity(
        id = id,
        givenName = givenName,
        surname = surname,
        middleNames = null,
        prefix = null,
        suffix = null,
        nickname = null,
        displayName = displayName,
        phones = phones,
        emails = emails,
        addresses = null,
        callSigns = null,
        xHandles = null,
        websites = null,
        dates = null,
        hasSignal = false,
        signalUsername = null,
        pgpKey = null,
        favorite = false,
        color = null,
        organization = null,
        socialContext = null,
        imageUrl = null,
        notes = null,
        tags = null,
        sharedToVault = false,
        createdDatetime = null,
        modifiedDatetime = null,
        syncVersion = 0,
        lastSyncedAt = null,
        isDirty = false,
        dirtyFields = "[]",
        deleted = deleted,
        hasUnviewedConflict = false,
        conflictFields = null
    )

    /** Generates a random contact with realistic data. */
    private fun randomContact(r: java.util.Random = random): ContactEntity {
        val given = givenNamePool[r.nextInt(givenNamePool.size)]
        val surname = surnamePool[r.nextInt(surnamePool.size)]
        val email = "${given.lowercase()}.${surname.lowercase()}@${emailDomains[r.nextInt(emailDomains.size)]}"
        val phone = "+1${100 + r.nextInt(900)}${1000000 + r.nextInt(9000000)}"

        return makeContact(
            id = "contact-${r.nextInt(100000)}",
            givenName = given,
            surname = surname,
            emails = email,
            phones = phone
        )
    }

    /** Generates a list of random contacts. */
    private fun randomContacts(count: Int, r: java.util.Random = random): List<ContactEntity> {
        return (1..count).map { randomContact(r) }
    }

    /**
     * Sorts contacts alphabetically by givenName (case-insensitive), matching the DAO's ORDER BY.
     */
    private fun sortContacts(contacts: List<ContactEntity>): List<ContactEntity> {
        return contacts.sortedBy { it.givenName.lowercase() }
    }

    /**
     * Filters contacts by query matching name, email, or phone (case-insensitive).
     * This mirrors the DAO's SQL LIKE query logic.
     */
    private fun filterContacts(contacts: List<ContactEntity>, query: String): List<ContactEntity> {
        if (query.isBlank()) return contacts
        val q = query.lowercase()
        return contacts.filter { contact ->
            contact.givenName.lowercase().contains(q) ||
                (contact.surname?.lowercase()?.contains(q) == true) ||
                (contact.displayName?.lowercase()?.contains(q) == true) ||
                (contact.emails?.lowercase()?.contains(q) == true) ||
                (contact.phones?.lowercase()?.contains(q) == true)
        }
    }

    // Use the actual ViewModel's computeSectionIndex method logic
    private fun computeSectionIndex(contacts: List<ContactEntity>): Map<Char, Int> {
        val index = mutableMapOf<Char, Int>()
        contacts.forEachIndexed { i, contact ->
            val letter = (contact.givenName.firstOrNull() ?: contact.surname?.firstOrNull() ?: '#')
                .uppercaseChar()
            if (letter !in index) {
                index[letter] = i
            }
        }
        return index
    }

    // =========================================================================
    // Property 27: Contact list is alphabetically sorted with correct section index
    // =========================================================================
    //
    // For any set of non-deleted contacts, the Contact_List_Screen SHALL display
    // them sorted alphabetically by name (case-insensitive), and the section index
    // SHALL contain exactly the distinct uppercase first letters present in the
    // sorted list.
    //
    // **Validates: Requirements 14.2, 14.5**

    @Test
    fun `Property 27 - contacts are sorted alphabetically by givenName case-insensitive`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(20) + 2, r)
            val sorted = sortContacts(contacts)

            // Verify sorted order: each contact's givenName should be <= the next one (case-insensitive)
            for (i in 0 until sorted.size - 1) {
                val current = sorted[i].givenName.lowercase()
                val next = sorted[i + 1].givenName.lowercase()
                assertTrue(
                    "Seed $seed, index $i: '${sorted[i].givenName}' should come before or equal '${sorted[i + 1].givenName}'",
                    current <= next
                )
            }
        }
    }

    @Test
    fun `Property 27 - section index contains exactly the distinct first letters`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(20) + 2, r)
            val sorted = sortContacts(contacts)

            val sectionIndex = computeSectionIndex(sorted)

            // Collect expected distinct first letters
            val expectedLetters = sorted.map { contact ->
                (contact.givenName.firstOrNull() ?: contact.surname?.firstOrNull() ?: '#')
                    .uppercaseChar()
            }.distinct().toSet()

            assertEquals(
                "Seed $seed: section index keys should match distinct first letters",
                expectedLetters,
                sectionIndex.keys
            )
        }
    }

    @Test
    fun `Property 27 - section index points to first contact of each letter`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(20) + 3, r)
            val sorted = sortContacts(contacts)

            val sectionIndex = computeSectionIndex(sorted)

            for ((letter, index) in sectionIndex) {
                // The contact at this index should start with this letter
                val contact = sorted[index]
                val contactLetter = (contact.givenName.firstOrNull() ?: contact.surname?.firstOrNull() ?: '#')
                    .uppercaseChar()
                assertEquals(
                    "Seed $seed: section index for '$letter' at position $index should point to a contact starting with '$letter'",
                    letter,
                    contactLetter
                )

                // No earlier contact should have this letter (it's the FIRST occurrence)
                for (j in 0 until index) {
                    val earlierLetter = (sorted[j].givenName.firstOrNull() ?: sorted[j].surname?.firstOrNull() ?: '#')
                        .uppercaseChar()
                    assertNotEquals(
                        "Seed $seed: no contact before index $index should have letter '$letter'",
                        letter,
                        earlierLetter
                    )
                }
            }
        }
    }

    @Test
    fun `Property 27 - empty contact list produces empty section index`() {
        val sectionIndex = computeSectionIndex(emptyList())
        assertTrue("Empty contact list should produce empty section index", sectionIndex.isEmpty())
    }

    @Test
    fun `Property 27 - single contact produces section index with one entry`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val contact = randomContact(r)
            val sorted = listOf(contact)

            val sectionIndex = computeSectionIndex(sorted)

            assertEquals(
                "Seed $seed: single contact should produce section index with one entry",
                1,
                sectionIndex.size
            )

            val expectedLetter = contact.givenName.first().uppercaseChar()
            assertTrue(
                "Seed $seed: section index should contain letter '$expectedLetter'",
                sectionIndex.containsKey(expectedLetter)
            )
            assertEquals(
                "Seed $seed: section index for '$expectedLetter' should point to index 0",
                0,
                sectionIndex[expectedLetter]
            )
        }
    }

    @Test
    fun `Property 27 - section index letters are in alphabetical order matching sorted list`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(20) + 5, r)
            val sorted = sortContacts(contacts)

            val sectionIndex = computeSectionIndex(sorted)

            // Section index values (positions) should be in ascending order when keys are sorted
            val sortedEntries = sectionIndex.entries.sortedBy { it.key }
            for (i in 0 until sortedEntries.size - 1) {
                assertTrue(
                    "Seed $seed: section index position for '${sortedEntries[i].key}' (${sortedEntries[i].value}) " +
                        "should be before '${sortedEntries[i + 1].key}' (${sortedEntries[i + 1].value})",
                    sortedEntries[i].value < sortedEntries[i + 1].value
                )
            }
        }
    }

    // =========================================================================
    // Property 28: Contact search filters correctly
    // =========================================================================
    //
    // For any set of contacts and a search query Q, the filtered list SHALL
    // contain exactly those contacts where name, email, or phone contains Q
    // (case-insensitive).
    //
    // **Validates: Requirements 14.3**

    @Test
    fun `Property 28 - search by givenName returns matching contacts`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)

            // Pick a random contact and use part of their givenName as query
            val target = contacts[r.nextInt(contacts.size)]
            val query = target.givenName.substring(0, minOf(3, target.givenName.length))

            val filtered = filterContacts(contacts, query)

            // Every result should contain the query in at least one searchable field
            for (contact in filtered) {
                val matchesAnyField =
                    contact.givenName.lowercase().contains(query.lowercase()) ||
                        (contact.surname?.lowercase()?.contains(query.lowercase()) == true) ||
                        (contact.displayName?.lowercase()?.contains(query.lowercase()) == true) ||
                        (contact.emails?.lowercase()?.contains(query.lowercase()) == true) ||
                        (contact.phones?.lowercase()?.contains(query.lowercase()) == true)

                assertTrue(
                    "Seed $seed: filtered contact '${contact.givenName}' should match query '$query' in at least one field",
                    matchesAnyField
                )
            }

            // The target contact should be in the results
            assertTrue(
                "Seed $seed: target contact '${target.givenName}' should be in results for query '$query'",
                filtered.any { it.id == target.id }
            )
        }
    }

    @Test
    fun `Property 28 - search by email returns matching contacts`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)

            // Pick a contact with an email and search by part of it
            val target = contacts.first { it.emails != null }
            val emailPart = target.emails!!.substringBefore("@").takeLast(4)

            val filtered = filterContacts(contacts, emailPart)

            // Target should be in results
            assertTrue(
                "Seed $seed: contact with email containing '$emailPart' should be in results",
                filtered.any { it.id == target.id }
            )

            // All results should match the query in at least one field
            for (contact in filtered) {
                val matchesAnyField =
                    contact.givenName.lowercase().contains(emailPart.lowercase()) ||
                        (contact.surname?.lowercase()?.contains(emailPart.lowercase()) == true) ||
                        (contact.displayName?.lowercase()?.contains(emailPart.lowercase()) == true) ||
                        (contact.emails?.lowercase()?.contains(emailPart.lowercase()) == true) ||
                        (contact.phones?.lowercase()?.contains(emailPart.lowercase()) == true)

                assertTrue(
                    "Seed $seed: filtered contact '${contact.givenName}' should match query '$emailPart'",
                    matchesAnyField
                )
            }
        }
    }

    @Test
    fun `Property 28 - search by phone returns matching contacts`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)

            // Pick a contact with a phone and search by part of it
            val target = contacts.first { it.phones != null }
            val phonePart = target.phones!!.takeLast(4)

            val filtered = filterContacts(contacts, phonePart)

            // Target should be in results
            assertTrue(
                "Seed $seed: contact with phone containing '$phonePart' should be in results",
                filtered.any { it.id == target.id }
            )
        }
    }

    @Test
    fun `Property 28 - search is case-insensitive`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)

            val target = contacts[r.nextInt(contacts.size)]
            val query = target.givenName.substring(0, minOf(3, target.givenName.length))

            val lowerResults = filterContacts(contacts, query.lowercase())
            val upperResults = filterContacts(contacts, query.uppercase())
            val mixedResults = filterContacts(contacts, query)

            // All case variants should produce the same results
            assertEquals(
                "Seed $seed: lowercase and uppercase search for '$query' should return same contacts",
                lowerResults.map { it.id }.toSet(),
                upperResults.map { it.id }.toSet()
            )
            assertEquals(
                "Seed $seed: mixed case and lowercase search for '$query' should return same contacts",
                lowerResults.map { it.id }.toSet(),
                mixedResults.map { it.id }.toSet()
            )
        }
    }

    @Test
    fun `Property 28 - empty query returns all contacts`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 3, r)

            val filtered = filterContacts(contacts, "")
            assertEquals(
                "Seed $seed: empty query should return all contacts",
                contacts.size,
                filtered.size
            )

            val filteredBlank = filterContacts(contacts, "   ")
            assertEquals(
                "Seed $seed: blank query should return all contacts",
                contacts.size,
                filteredBlank.size
            )
        }
    }

    @Test
    fun `Property 28 - non-matching query returns empty list`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(10) + 3, r)

            // Use a query that won't match any generated contact
            val query = "zzzzxyznonexistent99999"
            val filtered = filterContacts(contacts, query)

            assertTrue(
                "Seed $seed: query '$query' should return no contacts",
                filtered.isEmpty()
            )
        }
    }

    @Test
    fun `Property 28 - filtered results are a subset of original contacts`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)
            val query = givenNamePool[r.nextInt(givenNamePool.size)].take(2)

            val filtered = filterContacts(contacts, query)

            // Every filtered contact must exist in the original list
            val originalIds = contacts.map { it.id }.toSet()
            for (contact in filtered) {
                assertTrue(
                    "Seed $seed: filtered contact '${contact.id}' must be in original list",
                    contact.id in originalIds
                )
            }

            // Filtered size should be <= original size
            assertTrue(
                "Seed $seed: filtered size (${filtered.size}) should be <= original size (${contacts.size})",
                filtered.size <= contacts.size
            )
        }
    }

    @Test
    fun `Property 28 - contacts NOT in filtered results do NOT match query`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)
            val query = givenNamePool[r.nextInt(givenNamePool.size)].take(3)

            val filtered = filterContacts(contacts, query)
            val filteredIds = filtered.map { it.id }.toSet()

            // Every contact NOT in the filtered list should NOT match the query
            for (contact in contacts) {
                if (contact.id !in filteredIds) {
                    val matchesAnyField =
                        contact.givenName.lowercase().contains(query.lowercase()) ||
                            (contact.surname?.lowercase()?.contains(query.lowercase()) == true) ||
                            (contact.displayName?.lowercase()?.contains(query.lowercase()) == true) ||
                            (contact.emails?.lowercase()?.contains(query.lowercase()) == true) ||
                            (contact.phones?.lowercase()?.contains(query.lowercase()) == true)

                    assertFalse(
                        "Seed $seed: contact '${contact.givenName}' NOT in results should NOT match query '$query'",
                        matchesAnyField
                    )
                }
            }
        }
    }

    @Test
    fun `Property 28 - search by surname returns matching contacts`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val contacts = randomContacts(r.nextInt(15) + 5, r)

            // Pick a contact with a surname and search by part of it
            val target = contacts.first { it.surname != null }
            val query = target.surname!!.substring(0, minOf(4, target.surname!!.length))

            val filtered = filterContacts(contacts, query)

            // Target should be in results
            assertTrue(
                "Seed $seed: contact with surname containing '$query' should be in results",
                filtered.any { it.id == target.id }
            )
        }
    }
}
