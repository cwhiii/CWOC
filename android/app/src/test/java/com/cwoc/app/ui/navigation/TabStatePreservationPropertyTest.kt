package com.cwoc.app.ui.navigation

import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for tab state preservation.
 *
 * Property 29: Tab state preservation round-trip — for any tab with a scroll
 * position and filter state, switching away to another tab and switching back
 * SHALL restore the original scroll position and filter state.
 *
 * The bottom navigation uses `saveState = true` and `restoreState = true` in
 * NavController.navigate(), which preserves each tab's back stack entry state
 * (including rememberSaveable values like scroll position and filter state).
 *
 * This test models the state preservation mechanism as a TabStateStore that
 * saves/restores per-tab state, validating the round-trip property across all
 * 6 C CAPTN tabs with randomized scroll positions and filter states.
 *
 * **Validates: Requirements 15.3**
 */
class TabStatePreservationPropertyTest {

    // =========================================================================
    // Domain Model (mirrors the real navigation state preservation)
    // =========================================================================

    /**
     * The 6 C CAPTN tabs in the bottom navigation bar.
     */
    enum class CaptainTab {
        CALENDAR, CHECKLISTS, ALARMS, PROJECTS, TASKS, NOTES
    }

    /**
     * Represents the saveable state for a single tab.
     * In the real app, these are preserved via rememberSaveable in each ViewModel.
     */
    data class TabState(
        val scrollPosition: Int,       // LazyColumn first visible item index
        val scrollOffset: Int,         // Pixel offset within the first visible item
        val filterQuery: String,       // Active search/filter text
        val filterTags: Set<String>,   // Active tag filters
        val sortOrder: SortOrder       // Current sort preference
    )

    enum class SortOrder { DATE_ASC, DATE_DESC, TITLE_ASC, TITLE_DESC, PRIORITY }

    /**
     * Models the navigation state store that preserves tab state across switches.
     * This mirrors what NavController does with saveState/restoreState.
     */
    class TabStateStore {
        private val savedStates = mutableMapOf<CaptainTab, TabState>()
        private var currentTab: CaptainTab = CaptainTab.TASKS
        private var currentState: TabState = DEFAULT_STATE

        companion object {
            val DEFAULT_STATE = TabState(
                scrollPosition = 0,
                scrollOffset = 0,
                filterQuery = "",
                filterTags = emptySet(),
                sortOrder = SortOrder.DATE_DESC
            )
        }

        /** Updates the current tab's in-memory state (simulates user scrolling/filtering). */
        fun updateCurrentState(state: TabState) {
            currentState = state
        }

        /** Gets the current tab's state. */
        fun getCurrentState(): TabState = currentState

        /** Gets the current active tab. */
        fun getCurrentTab(): CaptainTab = currentTab

        /**
         * Switches to a new tab, saving the current tab's state and restoring
         * the destination tab's previously saved state (or default if first visit).
         * This mirrors NavController.navigate() with saveState=true, restoreState=true.
         */
        fun switchTab(destination: CaptainTab) {
            if (destination == currentTab) return

            // Save current tab's state (saveState = true)
            savedStates[currentTab] = currentState

            // Restore destination tab's state (restoreState = true)
            currentState = savedStates[destination] ?: DEFAULT_STATE
            currentTab = destination
        }

        /** Returns the saved state for a tab (for test assertions). */
        fun getSavedState(tab: CaptainTab): TabState? = savedStates[tab]
    }

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val sortOrders = SortOrder.values()

    private val tagPool = listOf(
        "work", "personal", "urgent", "health", "finance",
        "family", "travel", "shopping", "project-alpha", "meeting",
        "deadline", "review", "followup", "idea", "reference"
    )

    private val filterQueryPool = listOf(
        "", "meeting", "urgent", "project", "review notes",
        "call", "buy", "fix", "schedule", "plan",
        "draft", "send", "check", "update", "prepare"
    )

    /**
     * Generates a random TabState with varied field values.
     */
    private fun generateRandomTabState(r: java.util.Random): TabState {
        val numTags = r.nextInt(4) // 0 to 3 tags
        val tags = (0 until numTags).map { tagPool[r.nextInt(tagPool.size)] }.toSet()

        return TabState(
            scrollPosition = r.nextInt(200),          // 0 to 199 items scrolled
            scrollOffset = r.nextInt(500),             // 0 to 499 pixel offset
            filterQuery = filterQueryPool[r.nextInt(filterQueryPool.size)],
            filterTags = tags,
            sortOrder = sortOrders[r.nextInt(sortOrders.size)]
        )
    }

    /**
     * Picks a random tab different from the given one.
     */
    private fun randomOtherTab(r: java.util.Random, exclude: CaptainTab): CaptainTab {
        val tabs = CaptainTab.values().filter { it != exclude }
        return tabs[r.nextInt(tabs.size)]
    }

    // =========================================================================
    // Property 29: Tab state preservation round-trip
    // =========================================================================
    //
    // For any tab with a scroll position and filter state, switching away to
    // another tab and switching back SHALL restore the original scroll position
    // and filter state.
    //
    // **Validates: Requirements 15.3**

    /**
     * Property 29: Single round-trip preserves state exactly.
     *
     * For 100 random scenarios: set state on a tab, switch away, switch back,
     * verify the state is identical.
     */
    @Test
    fun `Property 29 - switching away and back preserves tab state exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()

            // Pick a random starting tab
            val startTab = CaptainTab.values()[r.nextInt(CaptainTab.values().size)]
            store.switchTab(startTab)

            // Set a random state on the starting tab
            val originalState = generateRandomTabState(r)
            store.updateCurrentState(originalState)

            // Switch to a different tab
            val otherTab = randomOtherTab(r, startTab)
            store.switchTab(otherTab)

            // Verify we're on the other tab now
            assertEquals(
                "Seed $seed: should be on other tab after switch",
                otherTab,
                store.getCurrentTab()
            )

            // Switch back to the original tab
            store.switchTab(startTab)

            // Verify state is restored exactly
            val restoredState = store.getCurrentState()
            assertEquals(
                "Seed $seed: scroll position should be preserved after round-trip",
                originalState.scrollPosition,
                restoredState.scrollPosition
            )
            assertEquals(
                "Seed $seed: scroll offset should be preserved after round-trip",
                originalState.scrollOffset,
                restoredState.scrollOffset
            )
            assertEquals(
                "Seed $seed: filter query should be preserved after round-trip",
                originalState.filterQuery,
                restoredState.filterQuery
            )
            assertEquals(
                "Seed $seed: filter tags should be preserved after round-trip",
                originalState.filterTags,
                restoredState.filterTags
            )
            assertEquals(
                "Seed $seed: sort order should be preserved after round-trip",
                originalState.sortOrder,
                restoredState.sortOrder
            )
            assertEquals(
                "Seed $seed: entire state should be preserved after round-trip",
                originalState,
                restoredState
            )
        }
    }

    /**
     * Property 29: Multiple round-trips preserve state for all tabs independently.
     *
     * Sets unique state on each of the 6 tabs, then cycles through them all
     * and verifies each tab's state is preserved independently.
     */
    @Test
    fun `Property 29 - all 6 tabs preserve independent state across multiple switches`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()
            val expectedStates = mutableMapOf<CaptainTab, TabState>()

            // Set unique state on each tab
            for (tab in CaptainTab.values()) {
                store.switchTab(tab)
                val state = generateRandomTabState(r)
                store.updateCurrentState(state)
                expectedStates[tab] = state
            }

            // Now cycle through all tabs and verify each one's state
            for (tab in CaptainTab.values()) {
                store.switchTab(tab)
                val restored = store.getCurrentState()
                assertEquals(
                    "Seed $seed, tab $tab: state should be preserved after cycling through all tabs",
                    expectedStates[tab],
                    restored
                )
            }
        }
    }

    /**
     * Property 29: Rapid switching between two tabs preserves both states.
     *
     * Simulates a user rapidly toggling between two tabs multiple times.
     */
    @Test
    fun `Property 29 - rapid switching between two tabs preserves both states`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()

            // Pick two different tabs
            val tabA = CaptainTab.values()[r.nextInt(CaptainTab.values().size)]
            val tabB = randomOtherTab(r, tabA)

            // Set state on tab A
            store.switchTab(tabA)
            val stateA = generateRandomTabState(r)
            store.updateCurrentState(stateA)

            // Set state on tab B
            store.switchTab(tabB)
            val stateB = generateRandomTabState(r)
            store.updateCurrentState(stateB)

            // Rapidly switch back and forth multiple times
            val switches = 3 + r.nextInt(8) // 3 to 10 switches
            for (i in 0 until switches) {
                if (i % 2 == 0) store.switchTab(tabA) else store.switchTab(tabB)
            }

            // Verify both states are still correct
            store.switchTab(tabA)
            assertEquals(
                "Seed $seed: tab A ($tabA) state should survive rapid switching",
                stateA,
                store.getCurrentState()
            )

            store.switchTab(tabB)
            assertEquals(
                "Seed $seed: tab B ($tabB) state should survive rapid switching",
                stateB,
                store.getCurrentState()
            )
        }
    }

    /**
     * Property 29: State preservation works with extreme scroll positions.
     *
     * Tests boundary values for scroll position and offset.
     */
    @Test
    fun `Property 29 - extreme scroll positions are preserved`() {
        val extremeStates = listOf(
            TabState(0, 0, "", emptySet(), SortOrder.DATE_ASC),
            TabState(Int.MAX_VALUE, Int.MAX_VALUE, "", emptySet(), SortOrder.DATE_DESC),
            TabState(999999, 0, "very long filter query with spaces", setOf("tag1", "tag2", "tag3"), SortOrder.TITLE_ASC),
            TabState(0, 999999, "", setOf("a", "b", "c", "d", "e"), SortOrder.PRIORITY),
            TabState(50, 250, "x", setOf("single-tag"), SortOrder.TITLE_DESC)
        )

        for ((index, state) in extremeStates.withIndex()) {
            val store = TabStateStore()
            val tab = CaptainTab.values()[index % CaptainTab.values().size]
            val otherTab = randomOtherTab(java.util.Random(index.toLong()), tab)

            store.switchTab(tab)
            store.updateCurrentState(state)
            store.switchTab(otherTab)
            store.switchTab(tab)

            assertEquals(
                "Extreme state $index should be preserved after round-trip",
                state,
                store.getCurrentState()
            )
        }
    }

    /**
     * Property 29: Switching to the same tab (no-op) does not lose state.
     */
    @Test
    fun `Property 29 - switching to current tab is a no-op and preserves state`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()

            val tab = CaptainTab.values()[r.nextInt(CaptainTab.values().size)]
            store.switchTab(tab)

            val state = generateRandomTabState(r)
            store.updateCurrentState(state)

            // Switch to the same tab (should be a no-op)
            store.switchTab(tab)

            assertEquals(
                "Seed $seed: switching to same tab should not change state",
                state,
                store.getCurrentState()
            )
        }
    }

    /**
     * Property 29: State updated AFTER switching is preserved on next round-trip.
     *
     * Verifies that if a user scrolls/filters after arriving at a tab, that
     * new state is what gets preserved on the next switch away.
     */
    @Test
    fun `Property 29 - state updated after arriving at tab is preserved on next round-trip`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()

            val tabA = CaptainTab.values()[r.nextInt(CaptainTab.values().size)]
            val tabB = randomOtherTab(r, tabA)

            // Set initial state on tab A
            store.switchTab(tabA)
            val initialState = generateRandomTabState(r)
            store.updateCurrentState(initialState)

            // Switch to tab B
            store.switchTab(tabB)

            // Switch back to tab A — state should be restored
            store.switchTab(tabA)
            assertEquals(
                "Seed $seed: initial state should be restored",
                initialState,
                store.getCurrentState()
            )

            // Now update the state (user scrolls further, changes filter)
            val updatedState = generateRandomTabState(r)
            store.updateCurrentState(updatedState)

            // Switch away and back again
            store.switchTab(tabB)
            store.switchTab(tabA)

            // The UPDATED state should be preserved, not the initial one
            assertEquals(
                "Seed $seed: updated state should be preserved after second round-trip",
                updatedState,
                store.getCurrentState()
            )
        }
    }

    /**
     * Property 29: First visit to a tab starts with default state.
     *
     * Tabs that have never been visited should have the default state
     * (scroll at top, no filters).
     */
    @Test
    fun `Property 29 - first visit to a tab starts with default state`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()

            // Visit a random tab for the first time
            val tab = CaptainTab.values()[r.nextInt(CaptainTab.values().size)]
            store.switchTab(tab)

            assertEquals(
                "Seed $seed: first visit to tab $tab should have default state",
                TabStateStore.DEFAULT_STATE,
                store.getCurrentState()
            )
        }
    }

    /**
     * Property 29: Modifying one tab's state does not affect other tabs.
     *
     * State isolation — each tab's state is independent.
     */
    @Test
    fun `Property 29 - modifying one tab state does not affect other tabs`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val store = TabStateStore()
            val states = mutableMapOf<CaptainTab, TabState>()

            // Set state on all tabs
            for (tab in CaptainTab.values()) {
                store.switchTab(tab)
                val state = generateRandomTabState(r)
                store.updateCurrentState(state)
                states[tab] = state
            }

            // Now modify just one tab's state
            val modifiedTab = CaptainTab.values()[r.nextInt(CaptainTab.values().size)]
            store.switchTab(modifiedTab)
            val newState = generateRandomTabState(r)
            store.updateCurrentState(newState)
            states[modifiedTab] = newState

            // Verify all OTHER tabs still have their original state
            for (tab in CaptainTab.values()) {
                store.switchTab(tab)
                assertEquals(
                    "Seed $seed: tab $tab state should be ${if (tab == modifiedTab) "updated" else "unchanged"}",
                    states[tab],
                    store.getCurrentState()
                )
            }
        }
    }
}
