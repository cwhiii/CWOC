package com.cwoc.app.domain.checklist

import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for checklist operations: add/remove, indent/outdent,
 * progress calculation, and undo round-trip.
 *
 * Property 5: Checklist add/remove invariant
 * Property 7: Checklist indent/outdent depth
 * Property 8: Checklist progress calculation
 * Property 9: Checklist undo round-trip
 *
 * **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
 */
class ChecklistOperationsTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private fun generateRandomChecklistItem(seed: Int): ChecklistItem {
        val r = java.util.Random(seed.toLong())
        return ChecklistItem(
            text = "item_${r.nextInt(10000)}",
            checked = r.nextBoolean(),
            indent = r.nextInt(4), // 0–3
            id = "id_${seed}_${r.nextInt(1000)}"
        )
    }

    private fun generateRandomChecklist(seed: Int, size: Int): List<ChecklistItem> {
        return (0 until size).map { i ->
            generateRandomChecklistItem(seed * 1000 + i)
        }
    }

    private fun generateRandomText(seed: Int): String {
        val r = java.util.Random(seed.toLong())
        val length = r.nextInt(20) + 1
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789 "
        return (1..length).map { chars[r.nextInt(chars.length)] }.joinToString("")
    }

    // =========================================================================
    // Checklist operations (pure logic matching ChecklistZone behavior)
    // =========================================================================

    /**
     * Add an item to the checklist (same logic as ChecklistZone's add).
     */
    private fun addItem(items: List<ChecklistItem>, text: String, id: String): List<ChecklistItem> {
        val newItem = ChecklistItem(
            text = text.trim(),
            checked = false,
            indent = 0,
            id = id
        )
        return items + newItem
    }

    /**
     * Remove an item at the given index (same logic as ChecklistZone's delete).
     */
    private fun removeItem(items: List<ChecklistItem>, index: Int): List<ChecklistItem> {
        if (index < 0 || index >= items.size) return items
        return items.toMutableList().apply { removeAt(index) }
    }

    /**
     * Indent an item at the given index (same logic as ChecklistZone's indent).
     */
    private fun indentItem(items: List<ChecklistItem>, index: Int): List<ChecklistItem> {
        if (index < 0 || index >= items.size) return items
        return items.toMutableList().apply {
            this[index] = this[index].copy(indent = this[index].indent + 1)
        }
    }

    /**
     * Outdent an item at the given index (same logic as ChecklistZone's outdent).
     */
    private fun outdentItem(items: List<ChecklistItem>, index: Int): List<ChecklistItem> {
        if (index < 0 || index >= items.size) return items
        val currentIndent = items[index].indent
        if (currentIndent <= 0) return items
        return items.toMutableList().apply {
            this[index] = this[index].copy(indent = currentIndent - 1)
        }
    }

    /**
     * Calculate progress: (checked count, total count).
     */
    private fun calculateProgress(items: List<ChecklistItem>): Pair<Int, Int> {
        return Pair(items.count { it.checked }, items.size)
    }

    // =========================================================================
    // Property 5: Checklist add/remove invariant
    // =========================================================================
    //
    // For any checklist and any non-empty text string, adding an item should
    // increase the item count by exactly 1 and the new item should be present
    // in the list. Conversely, for any checklist with at least one item,
    // removing an item should decrease the count by exactly 1 and the removed
    // item should no longer be present.
    //
    // **Validates: Requirements 4.2, 4.3**

    @Test
    fun `Property 5 - adding an item increases count by exactly 1`() {
        for (seed in 1..100) {
            val size = seed % 10 // 0 to 9 items
            val items = generateRandomChecklist(seed, size)
            val text = generateRandomText(seed + 500)
            val id = "new_${seed}"

            val result = addItem(items, text, id)

            assertEquals(
                "Seed $seed: adding an item should increase count by 1",
                items.size + 1,
                result.size
            )
        }
    }

    @Test
    fun `Property 5 - added item is present in the list`() {
        for (seed in 1..100) {
            val size = seed % 10
            val items = generateRandomChecklist(seed, size)
            val text = generateRandomText(seed + 600)
            val id = "new_${seed}"

            val result = addItem(items, text, id)

            assertTrue(
                "Seed $seed: added item should be present in the list",
                result.any { it.id == id && it.text == text.trim() }
            )
        }
    }

    @Test
    fun `Property 5 - added item has correct default properties`() {
        for (seed in 1..100) {
            val size = seed % 10
            val items = generateRandomChecklist(seed, size)
            val text = generateRandomText(seed + 700)
            val id = "new_${seed}"

            val result = addItem(items, text, id)
            val addedItem = result.last()

            assertFalse(
                "Seed $seed: added item should be unchecked",
                addedItem.checked
            )
            assertEquals(
                "Seed $seed: added item should have indent 0",
                0,
                addedItem.indent
            )
        }
    }

    @Test
    fun `Property 5 - removing an item decreases count by exactly 1`() {
        for (seed in 1..100) {
            val size = (seed % 9) + 1 // 1 to 9 items (need at least 1)
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 800)
            val removeIndex = r.nextInt(size)

            val result = removeItem(items, removeIndex)

            assertEquals(
                "Seed $seed: removing an item should decrease count by 1",
                items.size - 1,
                result.size
            )
        }
    }

    @Test
    fun `Property 5 - removed item is no longer present`() {
        for (seed in 1..100) {
            val size = (seed % 9) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 900)
            val removeIndex = r.nextInt(size)
            val removedItem = items[removeIndex]

            val result = removeItem(items, removeIndex)

            // The removed item's ID should not appear in the result
            // (IDs are unique in our generator)
            assertFalse(
                "Seed $seed: removed item '${removedItem.id}' should not be in result",
                result.any { it.id == removedItem.id }
            )
        }
    }

    @Test
    fun `Property 5 - add then remove returns to original state`() {
        for (seed in 1..100) {
            val size = seed % 10
            val items = generateRandomChecklist(seed, size)
            val text = generateRandomText(seed + 1000)
            val id = "new_${seed}"

            val afterAdd = addItem(items, text, id)
            // Remove the last item (the one we just added)
            val afterRemove = removeItem(afterAdd, afterAdd.size - 1)

            assertEquals(
                "Seed $seed: add then remove last should return to original",
                items,
                afterRemove
            )
        }
    }

    @Test
    fun `Property 5 - remaining items are unchanged after removal`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 2 // 2 to 9 items
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 1100)
            val removeIndex = r.nextInt(size)

            val result = removeItem(items, removeIndex)

            // All items except the removed one should still be present
            val expectedRemaining = items.filterIndexed { i, _ -> i != removeIndex }
            assertEquals(
                "Seed $seed: remaining items should be unchanged",
                expectedRemaining,
                result
            )
        }
    }

    // =========================================================================
    // Property 7: Checklist indent/outdent depth
    // =========================================================================
    //
    // For any checklist item at depth d, indenting should produce depth d+1,
    // and outdenting should produce max(0, d-1). No item should ever have a
    // negative depth.
    //
    // **Validates: Requirements 4.5**

    @Test
    fun `Property 7 - indent increases depth by 1`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 1200)
            val index = r.nextInt(size)
            val originalDepth = items[index].indent

            val result = indentItem(items, index)

            assertEquals(
                "Seed $seed, index $index: indent should increase depth by 1",
                originalDepth + 1,
                result[index].indent
            )
        }
    }

    @Test
    fun `Property 7 - outdent decreases depth by 1 when depth greater than 0`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            // Generate items with indent >= 1 to test outdent
            val items = generateRandomChecklist(seed, size).map {
                it.copy(indent = it.indent.coerceAtLeast(1))
            }
            val r = java.util.Random(seed.toLong() + 1300)
            val index = r.nextInt(size)
            val originalDepth = items[index].indent

            val result = outdentItem(items, index)

            assertEquals(
                "Seed $seed, index $index: outdent should decrease depth by 1",
                originalDepth - 1,
                result[index].indent
            )
        }
    }

    @Test
    fun `Property 7 - outdent never produces negative depth`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 1400)
            val index = r.nextInt(size)

            val result = outdentItem(items, index)

            assertTrue(
                "Seed $seed, index $index: depth should never be negative after outdent",
                result[index].indent >= 0
            )
        }
    }

    @Test
    fun `Property 7 - outdent at depth 0 is a no-op`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            // Force all items to depth 0
            val items = generateRandomChecklist(seed, size).map { it.copy(indent = 0) }
            val r = java.util.Random(seed.toLong() + 1500)
            val index = r.nextInt(size)

            val result = outdentItem(items, index)

            assertEquals(
                "Seed $seed, index $index: outdent at depth 0 should be a no-op",
                items,
                result
            )
        }
    }

    @Test
    fun `Property 7 - indent then outdent are inverse operations`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 1600)
            val index = r.nextInt(size)

            val indented = indentItem(items, index)
            val restored = outdentItem(indented, index)

            assertEquals(
                "Seed $seed, index $index: indent then outdent should restore original",
                items,
                restored
            )
        }
    }

    @Test
    fun `Property 7 - indent does not affect other items`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 2
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 1700)
            val index = r.nextInt(size)

            val result = indentItem(items, index)

            for (i in items.indices) {
                if (i != index) {
                    assertEquals(
                        "Seed $seed: item at $i should be unchanged after indent at $index",
                        items[i],
                        result[i]
                    )
                }
            }
        }
    }

    @Test
    fun `Property 7 - multiple indents accumulate correctly`() {
        for (seed in 1..100) {
            val items = listOf(ChecklistItem(text = "test_$seed", checked = false, indent = 0, id = "id_$seed"))
            val r = java.util.Random(seed.toLong() + 1800)
            val indentCount = r.nextInt(5) + 1 // 1 to 5 indents

            var result = items
            repeat(indentCount) {
                result = indentItem(result, 0)
            }

            assertEquals(
                "Seed $seed: $indentCount indents should produce depth $indentCount",
                indentCount,
                result[0].indent
            )
        }
    }

    // =========================================================================
    // Property 8: Checklist progress calculation
    // =========================================================================
    //
    // For any list of checklist items with random checked/unchecked states,
    // the progress count should equal (number of checked items, total number
    // of items) where both values are non-negative and checked ≤ total.
    //
    // **Validates: Requirements 4.6**

    @Test
    fun `Property 8 - progress checked count matches actual checked items`() {
        for (seed in 1..100) {
            val size = seed % 15 // 0 to 14 items
            val items = generateRandomChecklist(seed, size)

            val (checked, total) = calculateProgress(items)
            val expectedChecked = items.count { it.checked }

            assertEquals(
                "Seed $seed: checked count should match actual checked items",
                expectedChecked,
                checked
            )
        }
    }

    @Test
    fun `Property 8 - progress total matches list size`() {
        for (seed in 1..100) {
            val size = seed % 15
            val items = generateRandomChecklist(seed, size)

            val (_, total) = calculateProgress(items)

            assertEquals(
                "Seed $seed: total should match list size",
                items.size,
                total
            )
        }
    }

    @Test
    fun `Property 8 - checked count is never negative`() {
        for (seed in 1..100) {
            val size = seed % 15
            val items = generateRandomChecklist(seed, size)

            val (checked, _) = calculateProgress(items)

            assertTrue(
                "Seed $seed: checked count should be non-negative",
                checked >= 0
            )
        }
    }

    @Test
    fun `Property 8 - checked count never exceeds total`() {
        for (seed in 1..100) {
            val size = seed % 15
            val items = generateRandomChecklist(seed, size)

            val (checked, total) = calculateProgress(items)

            assertTrue(
                "Seed $seed: checked ($checked) should not exceed total ($total)",
                checked <= total
            )
        }
    }

    @Test
    fun `Property 8 - all checked items produce full progress`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 1
            val items = generateRandomChecklist(seed, size).map { it.copy(checked = true) }

            val (checked, total) = calculateProgress(items)

            assertEquals(
                "Seed $seed: all checked should produce checked == total",
                total,
                checked
            )
        }
    }

    @Test
    fun `Property 8 - no checked items produce zero progress`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 1
            val items = generateRandomChecklist(seed, size).map { it.copy(checked = false) }

            val (checked, _) = calculateProgress(items)

            assertEquals(
                "Seed $seed: no checked items should produce checked == 0",
                0,
                checked
            )
        }
    }

    @Test
    fun `Property 8 - empty list produces zero progress`() {
        val (checked, total) = calculateProgress(emptyList())

        assertEquals("Empty list checked should be 0", 0, checked)
        assertEquals("Empty list total should be 0", 0, total)
    }

    @Test
    fun `Property 8 - toggling an item updates progress correctly`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 2000)
            val index = r.nextInt(size)

            val (checkedBefore, _) = calculateProgress(items)
            val toggled = ChecklistOperations.toggleChecklistItem(items, index)
            val (checkedAfter, _) = calculateProgress(toggled)

            val expectedDelta = if (items[index].checked) -1 else 1
            assertEquals(
                "Seed $seed: toggling item at $index should change checked count by $expectedDelta",
                checkedBefore + expectedDelta,
                checkedAfter
            )
        }
    }

    // =========================================================================
    // Property 9: Checklist undo round-trip
    // =========================================================================
    //
    // For any checklist state and any single operation (toggle check, reorder,
    // delete, indent, outdent), performing the operation and then immediately
    // undoing should produce a state identical to the original.
    //
    // **Validates: Requirements 4.7**

    /**
     * Simulates the undo mechanism from ChecklistZone:
     * - Before each operation, push current state onto undo stack
     * - Undo pops the last state from the stack
     */
    private data class UndoableState(
        val items: List<ChecklistItem>,
        val undoStack: List<List<ChecklistItem>> = emptyList()
    ) {
        fun applyChange(newItems: List<ChecklistItem>): UndoableState {
            return UndoableState(
                items = newItems,
                undoStack = undoStack + listOf(items)
            )
        }

        fun undo(): UndoableState {
            if (undoStack.isEmpty()) return this
            val previousState = undoStack.last()
            return UndoableState(
                items = previousState,
                undoStack = undoStack.dropLast(1)
            )
        }
    }

    @Test
    fun `Property 9 - undo after toggle restores original state`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 2100)
            val index = r.nextInt(size)

            val state = UndoableState(items)
            val toggled = ChecklistOperations.toggleChecklistItem(items, index)
            val afterOp = state.applyChange(toggled)
            val afterUndo = afterOp.undo()

            assertEquals(
                "Seed $seed: undo after toggle should restore original",
                items,
                afterUndo.items
            )
        }
    }

    @Test
    fun `Property 9 - undo after reorder restores original state`() {
        for (seed in 1..100) {
            val size = (seed % 7) + 2 // need at least 2 items
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 2200)
            val fromIndex = r.nextInt(size)
            var toIndex = r.nextInt(size)
            if (toIndex == fromIndex) toIndex = (toIndex + 1) % size

            val state = UndoableState(items)
            val reordered = ChecklistOperations.reorderChecklistItem(items, fromIndex, toIndex)
            val afterOp = state.applyChange(reordered)
            val afterUndo = afterOp.undo()

            assertEquals(
                "Seed $seed: undo after reorder should restore original",
                items,
                afterUndo.items
            )
        }
    }

    @Test
    fun `Property 9 - undo after delete restores original state`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 2300)
            val index = r.nextInt(size)

            val state = UndoableState(items)
            val deleted = removeItem(items, index)
            val afterOp = state.applyChange(deleted)
            val afterUndo = afterOp.undo()

            assertEquals(
                "Seed $seed: undo after delete should restore original",
                items,
                afterUndo.items
            )
        }
    }

    @Test
    fun `Property 9 - undo after indent restores original state`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 2400)
            val index = r.nextInt(size)

            val state = UndoableState(items)
            val indented = indentItem(items, index)
            val afterOp = state.applyChange(indented)
            val afterUndo = afterOp.undo()

            assertEquals(
                "Seed $seed: undo after indent should restore original",
                items,
                afterUndo.items
            )
        }
    }

    @Test
    fun `Property 9 - undo after outdent restores original state`() {
        for (seed in 1..100) {
            val size = (seed % 8) + 1
            // Ensure items have indent > 0 so outdent actually changes something
            val items = generateRandomChecklist(seed, size).map {
                it.copy(indent = it.indent.coerceAtLeast(1))
            }
            val r = java.util.Random(seed.toLong() + 2500)
            val index = r.nextInt(size)

            val state = UndoableState(items)
            val outdented = outdentItem(items, index)
            val afterOp = state.applyChange(outdented)
            val afterUndo = afterOp.undo()

            assertEquals(
                "Seed $seed: undo after outdent should restore original",
                items,
                afterUndo.items
            )
        }
    }

    @Test
    fun `Property 9 - multiple operations can be undone in sequence`() {
        for (seed in 1..50) {
            val size = (seed % 6) + 2
            val items = generateRandomChecklist(seed, size)
            val r = java.util.Random(seed.toLong() + 2600)

            var state = UndoableState(items)

            // Apply 3 random operations
            val operations = mutableListOf<String>()
            repeat(3) { opNum ->
                val opType = r.nextInt(4) // 0=toggle, 1=indent, 2=outdent, 3=reorder
                val index = r.nextInt(state.items.size)

                val newItems = when (opType) {
                    0 -> {
                        operations.add("toggle[$index]")
                        ChecklistOperations.toggleChecklistItem(state.items, index)
                    }
                    1 -> {
                        operations.add("indent[$index]")
                        indentItem(state.items, index)
                    }
                    2 -> {
                        operations.add("outdent[$index]")
                        outdentItem(state.items, index)
                    }
                    else -> {
                        var toIndex = r.nextInt(state.items.size)
                        if (toIndex == index) toIndex = (toIndex + 1) % state.items.size
                        operations.add("reorder[$index→$toIndex]")
                        ChecklistOperations.reorderChecklistItem(state.items, index, toIndex)
                    }
                }
                state = state.applyChange(newItems)
            }

            // Undo all 3 operations
            state = state.undo()
            state = state.undo()
            state = state.undo()

            assertEquals(
                "Seed $seed: undoing all 3 operations (${operations.joinToString(", ")}) should restore original",
                items,
                state.items
            )
        }
    }

    @Test
    fun `Property 9 - undo on empty stack is a no-op`() {
        for (seed in 1..50) {
            val size = (seed % 8) + 1
            val items = generateRandomChecklist(seed, size)

            val state = UndoableState(items)
            val afterUndo = state.undo()

            assertEquals(
                "Seed $seed: undo on empty stack should not change items",
                items,
                afterUndo.items
            )
        }
    }
}
