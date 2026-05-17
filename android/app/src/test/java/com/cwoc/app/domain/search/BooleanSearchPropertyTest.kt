package com.cwoc.app.domain.search

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for the Boolean Search parser and evaluator.
 *
 * Property 20: Boolean AND semantics
 * Property 21: Boolean OR semantics
 * Property 22: Boolean NOT semantics
 * Property 23: Boolean search multi-field coverage
 *
 * **Validates: Requirements 11.2, 11.3, 11.4, 11.6**
 */
class BooleanSearchPropertyTest {

    private val parser = BooleanSearchParser()
    private val evaluator = BooleanSearchEvaluator()

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    /** Pool of terms to use in generated queries and chit fields. */
    private val termPool = listOf(
        "apple", "banana", "cherry", "date", "elderberry",
        "fig", "grape", "honeydew", "kiwi", "lemon",
        "mango", "nectarine", "orange", "papaya", "quince",
        "raspberry", "strawberry", "tangerine", "watermelon", "zucchini"
    )

    /** Generates a random term from the pool. */
    private fun randomTerm(r: java.util.Random = random): String =
        termPool[r.nextInt(termPool.size)]

    /** Generates a pair of distinct random terms. */
    private fun randomTermPair(r: java.util.Random = random): Pair<String, String> {
        val t1 = randomTerm(r)
        var t2 = randomTerm(r)
        while (t2 == t1) t2 = randomTerm(r)
        return t1 to t2
    }

    /**
     * Creates a minimal ChitEntity with specified searchable fields.
     * All other fields are set to null/default.
     */
    private fun makeChit(
        id: String = "chit-${random.nextInt(100000)}",
        title: String? = null,
        note: String? = null,
        tags: List<String>? = null,
        checklist: String? = null
    ): ChitEntity = ChitEntity(
        id = id,
        title = title,
        note = note,
        tags = tags,
        startDatetime = null,
        endDatetime = null,
        dueDatetime = null,
        pointInTime = null,
        completedDatetime = null,
        status = null,
        priority = null,
        severity = null,
        checklist = checklist,
        alarm = null,
        notification = null,
        recurrence = null,
        recurrenceId = null,
        recurrenceRule = null,
        recurrenceExceptions = null,
        location = null,
        color = null,
        people = null,
        pinned = false,
        archived = false,
        deleted = false,
        createdDatetime = null,
        modifiedDatetime = null,
        isProjectMaster = false,
        childChits = null,
        allDay = false,
        timezone = null,
        alerts = null,
        progressPercent = null,
        timeEstimate = null,
        weatherData = null,
        healthData = null,
        habit = false,
        habitGoal = null,
        habitSuccess = null,
        showOnCalendar = null,
        habitResetPeriod = null,
        habitLastActionDate = null,
        habitHideOverall = null,
        perpetual = false,
        shares = null,
        stealth = null,
        assignedTo = null,
        ownerId = null,
        hasUnviewedConflict = false,
        availability = null,
        snoozedUntil = null,
        prerequisites = null,
        syncVersion = 0,
        lastSyncedAt = null,
        isDirty = false,
        dirtyFields = "[]"
    )

    /** Helper: evaluates a query string against a chit. */
    private fun matches(query: String, chit: ChitEntity): Boolean {
        val node = parser.parse(query) ?: return false
        return evaluator.matches(chit, node)
    }

    // =========================================================================
    // Property 20: Boolean AND semantics
    // =========================================================================
    //
    // For any set of chits and any AND query with terms T1 and T2, every chit in
    // the result set SHALL contain both T1 and T2 in its searchable text, and
    // every chit NOT in the result set SHALL be missing at least one of T1 or T2.
    //
    // **Validates: Requirements 11.2**

    @Test
    fun `Property 20 - AND query returns only chits containing both terms`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val (t1, t2) = randomTermPair(r)

            // Generate chits with various combinations of terms
            val chits = listOf(
                makeChit(id = "both-$seed", title = "$t1 and $t2 together"),
                makeChit(id = "first-only-$seed", title = "only $t1 here"),
                makeChit(id = "second-only-$seed", title = "only $t2 here"),
                makeChit(id = "neither-$seed", title = "nothing relevant")
            )

            val query = "$t1 AND $t2"
            val node = parser.parse(query)!!

            for (chit in chits) {
                val result = evaluator.matches(chit, node)
                val text = evaluator.extractSearchableText(chit)
                val hasBoth = text.contains(t1) && text.contains(t2)

                assertEquals(
                    "Seed $seed, chit ${chit.id}: AND($t1, $t2) match=$result but hasBoth=$hasBoth",
                    hasBoth,
                    result
                )
            }
        }
    }

    @Test
    fun `Property 20 - implicit AND (space-separated) has same semantics as explicit AND`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val (t1, t2) = randomTermPair(r)

            val chit = makeChit(id = "test-$seed", title = "$t1 something $t2")

            val explicitResult = matches("$t1 AND $t2", chit)
            val implicitResult = matches("$t1 $t2", chit)

            assertEquals(
                "Seed $seed: implicit AND should equal explicit AND for '$t1 $t2'",
                explicitResult,
                implicitResult
            )
        }
    }

    @Test
    fun `Property 20 - AND with three terms requires all three present`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val t1 = termPool[r.nextInt(termPool.size)]
            var t2 = termPool[r.nextInt(termPool.size)]
            while (t2 == t1) t2 = termPool[r.nextInt(termPool.size)]
            var t3 = termPool[r.nextInt(termPool.size)]
            while (t3 == t1 || t3 == t2) t3 = termPool[r.nextInt(termPool.size)]

            val chitAll = makeChit(id = "all-$seed", title = "$t1 $t2 $t3")
            val chitTwo = makeChit(id = "two-$seed", title = "$t1 $t2 only")

            val query = "$t1 AND $t2 AND $t3"

            assertTrue(
                "Seed $seed: chit with all three terms should match '$query'",
                matches(query, chitAll)
            )
            assertFalse(
                "Seed $seed: chit missing one term should NOT match '$query'",
                matches(query, chitTwo)
            )
        }
    }

    // =========================================================================
    // Property 21: Boolean OR semantics
    // =========================================================================
    //
    // For any set of chits and any OR query with terms T1 and T2, every chit in
    // the result set SHALL contain at least one of T1 or T2, and every chit NOT
    // in the result set SHALL contain neither.
    //
    // **Validates: Requirements 11.3**

    @Test
    fun `Property 21 - OR query returns chits containing at least one term`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val (t1, t2) = randomTermPair(r)

            val chits = listOf(
                makeChit(id = "both-$seed", title = "$t1 and $t2"),
                makeChit(id = "first-$seed", title = "has $t1"),
                makeChit(id = "second-$seed", title = "has $t2"),
                makeChit(id = "neither-$seed", title = "nothing here")
            )

            val query = "$t1 OR $t2"
            val node = parser.parse(query)!!

            for (chit in chits) {
                val result = evaluator.matches(chit, node)
                val text = evaluator.extractSearchableText(chit)
                val hasEither = text.contains(t1) || text.contains(t2)

                assertEquals(
                    "Seed $seed, chit ${chit.id}: OR($t1, $t2) match=$result but hasEither=$hasEither",
                    hasEither,
                    result
                )
            }
        }
    }

    @Test
    fun `Property 21 - OR is commutative`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val (t1, t2) = randomTermPair(r)

            val chit = makeChit(id = "comm-$seed", title = "$t1 content")

            val result1 = matches("$t1 OR $t2", chit)
            val result2 = matches("$t2 OR $t1", chit)

            assertEquals(
                "Seed $seed: OR should be commutative for '$t1 OR $t2'",
                result1,
                result2
            )
        }
    }

    @Test
    fun `Property 21 - OR with neither term present returns false`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val (t1, t2) = randomTermPair(r)

            // Create a chit that definitely doesn't contain either term
            val chit = makeChit(id = "empty-$seed", title = "completely unrelated content xyz123")

            val result = matches("$t1 OR $t2", chit)

            assertFalse(
                "Seed $seed: OR($t1, $t2) should not match chit without either term",
                result
            )
        }
    }

    // =========================================================================
    // Property 22: Boolean NOT semantics
    // =========================================================================
    //
    // For any set of chits and any NOT query excluding term T, no chit in the
    // result set SHALL contain T in its searchable text.
    //
    // **Validates: Requirements 11.4**

    @Test
    fun `Property 22 - NOT excludes chits containing the negated term`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            val chitWith = makeChit(id = "with-$seed", title = "has $term in title")
            val chitWithout = makeChit(id = "without-$seed", title = "nothing relevant here xyz")

            // NOT as prefix "-"
            val queryPrefix = "xyz -$term"
            val nodePrefix = parser.parse(queryPrefix)!!

            // Chit containing the negated term should NOT match
            val textWith = evaluator.extractSearchableText(chitWith)
            if (textWith.contains(term)) {
                // Only assert if the term is actually present (it should be given our construction)
                assertFalse(
                    "Seed $seed: chit containing '$term' should be excluded by NOT",
                    evaluator.matches(chitWith, nodePrefix)
                )
            }
        }
    }

    @Test
    fun `Property 22 - NOT keyword excludes matching chits`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val (required, excluded) = randomTermPair(r)

            val chitBoth = makeChit(id = "both-$seed", title = "$required $excluded")
            val chitOnlyReq = makeChit(id = "req-$seed", title = "$required only")

            val query = "$required NOT $excluded"
            val node = parser.parse(query)!!

            // Chit with both terms: has required but also has excluded → should NOT match
            val textBoth = evaluator.extractSearchableText(chitBoth)
            if (textBoth.contains(required) && textBoth.contains(excluded)) {
                assertFalse(
                    "Seed $seed: chit with both '$required' and '$excluded' should not match '$query'",
                    evaluator.matches(chitBoth, node)
                )
            }

            // Chit with only required term: should match
            val textReq = evaluator.extractSearchableText(chitOnlyReq)
            if (textReq.contains(required) && !textReq.contains(excluded)) {
                assertTrue(
                    "Seed $seed: chit with '$required' but not '$excluded' should match '$query'",
                    evaluator.matches(chitOnlyReq, node)
                )
            }
        }
    }

    @Test
    fun `Property 22 - double NOT is equivalent to no NOT`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            val chit = makeChit(id = "dbl-$seed", title = "has $term here")

            // Parse "NOT NOT term" — should be equivalent to just "term"
            val doubleNotNode = SearchNode.Not(SearchNode.Not(SearchNode.Term(term)))
            val termNode = SearchNode.Term(term)

            val doubleNotResult = evaluator.matches(chit, doubleNotNode)
            val termResult = evaluator.matches(chit, termNode)

            assertEquals(
                "Seed $seed: NOT NOT '$term' should equal just '$term'",
                termResult,
                doubleNotResult
            )
        }
    }

    // =========================================================================
    // Property 23: Boolean search multi-field coverage
    // =========================================================================
    //
    // For any chit where a term appears in title, note, tags, or checklist text,
    // a search for that term SHALL include that chit in results.
    //
    // **Validates: Requirements 11.6**

    @Test
    fun `Property 23 - term in title is found`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            val chit = makeChit(id = "title-$seed", title = "contains $term word")

            assertTrue(
                "Seed $seed: term '$term' in title should be found",
                matches(term, chit)
            )
        }
    }

    @Test
    fun `Property 23 - term in note is found`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            val chit = makeChit(id = "note-$seed", note = "the note has $term in it")

            assertTrue(
                "Seed $seed: term '$term' in note should be found",
                matches(term, chit)
            )
        }
    }

    @Test
    fun `Property 23 - term in tags is found`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            val chit = makeChit(id = "tags-$seed", tags = listOf("unrelated", term, "other"))

            assertTrue(
                "Seed $seed: term '$term' in tags should be found",
                matches(term, chit)
            )
        }
    }

    @Test
    fun `Property 23 - term in checklist text is found`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            val checklistJson = """[{"text":"buy $term","done":false},{"text":"other item","done":true}]"""
            val chit = makeChit(id = "checklist-$seed", checklist = checklistJson)

            assertTrue(
                "Seed $seed: term '$term' in checklist text should be found",
                matches(term, chit)
            )
        }
    }

    @Test
    fun `Property 23 - term not present in any field is not found`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)

            // Create a chit with content that definitely doesn't contain the term
            val chit = makeChit(
                id = "absent-$seed",
                title = "xyz123 unrelated",
                note = "abc456 nothing",
                tags = listOf("tag1", "tag2"),
                checklist = """[{"text":"item one","done":false}]"""
            )

            val text = evaluator.extractSearchableText(chit)
            if (!text.contains(term)) {
                assertFalse(
                    "Seed $seed: term '$term' not in any field should not match",
                    matches(term, chit)
                )
            }
        }
    }

    @Test
    fun `Property 23 - search is case-insensitive across all fields`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val term = randomTerm(r)
            val upperTerm = term.uppercase()

            // Put the uppercase version in the chit
            val chitTitle = makeChit(id = "case-title-$seed", title = "Has ${upperTerm} Here")
            val chitNote = makeChit(id = "case-note-$seed", note = "Note with ${upperTerm}")
            val chitTag = makeChit(id = "case-tag-$seed", tags = listOf(upperTerm))

            // Search with lowercase should still find it
            assertTrue(
                "Seed $seed: case-insensitive search for '$term' should find '$upperTerm' in title",
                matches(term, chitTitle)
            )
            assertTrue(
                "Seed $seed: case-insensitive search for '$term' should find '$upperTerm' in note",
                matches(term, chitNote)
            )
            assertTrue(
                "Seed $seed: case-insensitive search for '$term' should find '$upperTerm' in tags",
                matches(term, chitTag)
            )
        }
    }

    // =========================================================================
    // Combined operator tests (validates interaction of AND/OR/NOT)
    // =========================================================================

    @Test
    fun `Property 20+21 - AND has higher precedence than OR`() {
        // "a OR b AND c" should be parsed as "a OR (b AND c)"
        for (seed in 1..30) {
            val r = java.util.Random(seed.toLong())
            val t1 = termPool[r.nextInt(termPool.size)]
            var t2 = termPool[r.nextInt(termPool.size)]
            while (t2 == t1) t2 = termPool[r.nextInt(termPool.size)]
            var t3 = termPool[r.nextInt(termPool.size)]
            while (t3 == t1 || t3 == t2) t3 = termPool[r.nextInt(termPool.size)]

            // Chit with only t1 should match "t1 OR t2 AND t3" (because t1 satisfies the OR)
            val chitT1Only = makeChit(id = "prec-$seed", title = "$t1 only")

            val text = evaluator.extractSearchableText(chitT1Only)
            if (text.contains(t1) && !text.contains(t2) && !text.contains(t3)) {
                assertTrue(
                    "Seed $seed: '$t1 OR $t2 AND $t3' should match chit with only '$t1' (OR precedence)",
                    matches("$t1 OR $t2 AND $t3", chitT1Only)
                )
            }
        }
    }

    @Test
    fun `Property 20+22 - parenthesized grouping overrides precedence`() {
        for (seed in 1..30) {
            val r = java.util.Random(seed.toLong())
            val (t1, t2) = randomTermPair(r)

            // "(t1 OR t2) AND t1" — chit with only t2 should NOT match (needs t1 for the AND)
            val chitT2Only = makeChit(id = "paren-$seed", title = "$t2 only here")

            val text = evaluator.extractSearchableText(chitT2Only)
            if (text.contains(t2) && !text.contains(t1)) {
                assertFalse(
                    "Seed $seed: '($t1 OR $t2) AND $t1' should NOT match chit with only '$t2'",
                    matches("($t1 OR $t2) AND $t1", chitT2Only)
                )
            }
        }
    }
}
