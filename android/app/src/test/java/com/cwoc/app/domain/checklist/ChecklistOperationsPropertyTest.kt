package com.cwoc.app.domain.checklist

import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for ChecklistOperations.
 *
 * Property 2: Checklist toggle is an involution — toggling twice returns original state.
 * Property 3: Checklist indentation matches nesting depth — indent N → N × 24dp.
 * Property 4: Checklist reorder preserves all items — no items lost or duplicated.
 *
 * **Validates: Requirements 1.3, 1.4, 1.5**
 */
class ChecklistOperationsPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    /**
     * Generates a random ChecklistItem with varied field values.
     */
    private fun generateRandomChecklistItem(seed: Int): ChecklistItem {
        val r = java.util.Random(seed.toLong())
        return ChecklistItem(
            text = "item_${r.nextInt(10000)}",
            checked = r.nextBoolean(),
            indent = r.nextInt(3), // 0, 1, or 2
            id = "id_${seed}_${r.nextInt(1000)}"
        )
    }

    /**
     * Generates a random checklist of a given size.
     */
    private fun generateRandomChecklist(seed: Int, size: Int): List<ChecklistItem> {
        return (0 until size).map { i ->
            generateRandomChecklistItem(seed * 1000 + i)
        }
    }

    // =========================================================================
    // Property 2: Checklist toggle is an involution
    // =========================================================================
    //
    // For any checklist item, toggling its checked state twice SHALL return it
    // to its original checked state.
    //
    // **Validates: Requirements 1.3**

    /**
     * Property 2: Toggling any item twice returns the list to its original state.
     *
     * Tests across 100 randomly generated checklists of varying sizes that
     * toggle(toggle(items, i), i) == items for all valid indices.
     */
    @Test
    fun `Property 2 - toggle is an involution for all items`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 1 // 1 to 10 items
            val items = generateRandomChecklist(seed, size)

            for (index in items.indices) {
                val toggledOnce = ChecklistOperations.toggleChecklistItem(items, index)
                val toggledTwice = ChecklistOperations.toggleChecklistItem(toggledOnce, index)

                assertEquals(
                    "Seed $seed, index $index: double toggle should return original list",
                    items,
                    toggledTwice
                )
            }
        }
    }

    /**
     * Property 2: A single toggle flips the checked state.
     *
     * Verifies that toggling once actually changes the checked state (not a no-op).
     */
    @Test
    fun `Property 2 - single toggle flips checked state`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 1
            val items = generateRandomChecklist(seed, size)

            for (index in items.indices) {
                val toggled = ChecklistOperations.toggleChecklistItem(items, index)

                assertEquals(
                    "Seed $seed, index $index: toggled item should have opposite checked state",
                    !items[index].checked,
                    toggled[index].checked
                )

                // All other items should remain unchanged
                for (otherIndex in items.indices) {
                    if (otherIndex != index) {
                        assertEquals(
                            "Seed $seed, index $index: item at $otherIndex should be unchanged",
                            items[otherIndex],
                            toggled[otherIndex]
                        )
                    }
                }
            }
        }
    }

    /**
     * Property 2 (edge case): Toggle with out-of-bounds index returns original list.
     */
    @Test
    fun `Property 2 - toggle with invalid index returns original list`() {
        val items = generateRandomChecklist(1, 5)

        val resultNegative = ChecklistOperations.toggleChecklistItem(items, -1)
        assertEquals("Negative index should return original", items, resultNegative)

        val resultTooLarge = ChecklistOperations.toggleChecklistItem(items, items.size)
        assertEquals("Index == size should return original", items, resultTooLarge)

        val resultWayTooLarge = ChecklistOperations.toggleChecklistItem(items, 999)
        assertEquals("Large index should return original", items, resultWayTooLarge)
    }

    /**
     * Property 2 (edge case): Toggle on empty list returns empty list.
     */
    @Test
    fun `Property 2 - toggle on empty list returns empty list`() {
        val empty = emptyList<ChecklistItem>()
        val result = ChecklistOperations.toggleChecklistItem(empty, 0)
        assertEquals("Toggle on empty list should return empty", empty, result)
    }

    // =========================================================================
    // Property 3: Checklist indentation matches nesting depth
    // =========================================================================
    //
    // For any checklist item with nesting level N (0 ≤ N ≤ 2), the computed
    // indentation SHALL equal N × 24dp.
    //
    // **Validates: Requirements 1.4**

    /**
     * Property 3: indentationDp(N) == N * 24 for all valid nesting levels.
     *
     * Tests all valid indent levels (0, 1, 2) and beyond to verify the formula.
     */
    @Test
    fun `Property 3 - indentation equals indent times 24dp for all levels`() {
        // Test all valid levels
        for (level in 0..2) {
            assertEquals(
                "Level $level should produce ${level * 24}dp",
                level * 24,
                ChecklistOperations.indentationDp(level)
            )
        }

        // Test extended levels (the function supports any non-negative int)
        for (level in 0..10) {
            assertEquals(
                "Level $level should produce ${level * 24}dp",
                level * 24,
                ChecklistOperations.indentationDp(level)
            )
        }
    }

    /**
     * Property 3: indentationDp is monotonically increasing.
     *
     * For any two levels a < b, indentationDp(a) < indentationDp(b).
     */
    @Test
    fun `Property 3 - indentation is monotonically increasing`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val a = r.nextInt(10)
            val b = a + 1 + r.nextInt(5) // b > a

            assertTrue(
                "Seed $seed: indentation($a) should be less than indentation($b)",
                ChecklistOperations.indentationDp(a) < ChecklistOperations.indentationDp(b)
            )
        }
    }

    /**
     * Property 3: Negative indent levels are clamped to 0.
     */
    @Test
    fun `Property 3 - negative indent levels produce 0dp`() {
        for (negLevel in listOf(-1, -5, -100, Int.MIN_VALUE)) {
            assertEquals(
                "Negative level $negLevel should produce 0dp",
                0,
                ChecklistOperations.indentationDp(negLevel)
            )
        }
    }

    /**
     * Property 3: indentationDp matches actual item indent values in generated checklists.
     *
     * For any generated checklist item, its indent field produces the correct dp value.
     */
    @Test
    fun `Property 3 - generated checklist items have correct indentation`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 1
            val items = generateRandomChecklist(seed, size)

            for (item in items) {
                val expectedDp = item.indent.coerceAtLeast(0) * 24
                assertEquals(
                    "Seed $seed: item '${item.text}' with indent ${item.indent} should have ${expectedDp}dp",
                    expectedDp,
                    ChecklistOperations.indentationDp(item.indent)
                )
            }
        }
    }

    // =========================================================================
    // Property 4: Checklist reorder preserves all items
    // =========================================================================
    //
    // For any checklist and any valid source/destination index pair, reordering
    // SHALL produce a list containing exactly the same items (same IDs, same
    // checked states) in a different order, with the moved item at the
    // destination index.
    //
    // **Validates: Requirements 1.5**

    /**
     * Property 4: Reorder preserves all items (same set, no duplicates, no losses).
     *
     * Tests across 100 randomly generated checklists with random from/to indices.
     */
    @Test
    fun `Property 4 - reorder preserves all items`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 2 // 2 to 9 items (need at least 2 for reorder)
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 999)
            val fromIndex = r.nextInt(size)
            var toIndex = r.nextInt(size)
            // Ensure from != to for a meaningful reorder
            if (toIndex == fromIndex) toIndex = (toIndex + 1) % size

            val reordered = ChecklistOperations.reorderChecklistItem(items, fromIndex, toIndex)

            // Same size
            assertEquals(
                "Seed $seed: reordered list should have same size",
                items.size,
                reordered.size
            )

            // Same items (as a set by content)
            val originalSorted = items.sortedBy { it.id }
            val reorderedSorted = reordered.sortedBy { it.id }
            assertEquals(
                "Seed $seed: reordered list should contain exactly the same items",
                originalSorted,
                reorderedSorted
            )
        }
    }

    /**
     * Property 4: The moved item ends up at the destination index.
     */
    @Test
    fun `Property 4 - moved item is at destination index`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 2
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 777)
            val fromIndex = r.nextInt(size)
            var toIndex = r.nextInt(size)
            if (toIndex == fromIndex) toIndex = (toIndex + 1) % size

            val movedItem = items[fromIndex]
            val reordered = ChecklistOperations.reorderChecklistItem(items, fromIndex, toIndex)

            assertEquals(
                "Seed $seed: item moved from $fromIndex should be at $toIndex",
                movedItem,
                reordered[toIndex]
            )
        }
    }

    /**
     * Property 4: Reorder preserves checked states and text of all items.
     */
    @Test
    fun `Property 4 - reorder preserves checked states and text`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 2
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 555)
            val fromIndex = r.nextInt(size)
            var toIndex = r.nextInt(size)
            if (toIndex == fromIndex) toIndex = (toIndex + 1) % size

            val reordered = ChecklistOperations.reorderChecklistItem(items, fromIndex, toIndex)

            // Every original item's text and checked state must appear in the result
            val originalTextsAndStates = items.map { Pair(it.text, it.checked) }.toSet()
            val reorderedTextsAndStates = reordered.map { Pair(it.text, it.checked) }.toSet()

            assertEquals(
                "Seed $seed: all text/checked pairs should be preserved",
                originalTextsAndStates,
                reorderedTextsAndStates
            )
        }
    }

    /**
     * Property 4 (edge case): Reorder with same from and to index returns original list.
     */
    @Test
    fun `Property 4 - reorder with same indices returns original list`() {
        for (seed in 1..50) {
            val size = (seed % 8) + 2
            val items = generateRandomChecklist(seed, size)
            val index = seed % size

            val result = ChecklistOperations.reorderChecklistItem(items, index, index)
            assertEquals(
                "Seed $seed: reorder with same index should return original",
                items,
                result
            )
        }
    }

    /**
     * Property 4 (edge case): Reorder with invalid indices returns original list.
     */
    @Test
    fun `Property 4 - reorder with invalid indices returns original list`() {
        val items = generateRandomChecklist(1, 5)

        // Negative from
        assertEquals(items, ChecklistOperations.reorderChecklistItem(items, -1, 2))
        // From too large
        assertEquals(items, ChecklistOperations.reorderChecklistItem(items, 5, 2))
        // Negative to
        assertEquals(items, ChecklistOperations.reorderChecklistItem(items, 2, -1))
        // To too large
        assertEquals(items, ChecklistOperations.reorderChecklistItem(items, 2, 5))
    }

    /**
     * Property 4: Reorder is reversible — moving from A to B then from B to A
     * restores the original list.
     */
    @Test
    fun `Property 4 - reorder is reversible`() {
        for (seed in 1..50) {
            val size = (seed % 6) + 3 // 3 to 8 items
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 333)
            val fromIndex = r.nextInt(size)
            var toIndex = r.nextInt(size)
            if (toIndex == fromIndex) toIndex = (toIndex + 1) % size

            val reordered = ChecklistOperations.reorderChecklistItem(items, fromIndex, toIndex)
            val restored = ChecklistOperations.reorderChecklistItem(reordered, toIndex, fromIndex)

            assertEquals(
                "Seed $seed: reorder($fromIndex→$toIndex) then reorder($toIndex→$fromIndex) should restore original",
                items,
                restored
            )
        }
    }
}
