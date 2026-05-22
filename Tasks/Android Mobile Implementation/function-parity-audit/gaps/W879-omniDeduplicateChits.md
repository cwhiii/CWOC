# W879: _omniDeduplicateChits(filteredChits)

## What the web function does
Assigns chits to Omni View sections in priority order, ensuring each chit appears in ONLY ONE section:
1. **Reminders** — chits with `notification` flag that are for today or pinned (highest priority)
2. **Email** — chits with `email_message_id` (from global chits, not filtered)
3. **Chrono** — time-anchored chits for today (habits evaluated for rollover, then calendar events)
4. **On Deck** — tasks that are In Progress or ToDo with no future date
5. **Soon** — chits with upcoming due dates (within 7 days)
6. **Pinned Notes** — pinned chits with notes content
7. **Pinned Checklists** — pinned chits with checklist content

Once a chit is placed in a higher-priority section, it's excluded from all subsequent sections via a `placedIds` Set. This prevents the same chit from appearing in multiple sections (e.g., a pinned task with a due date today won't show in both "Chrono" and "Pinned Notes").

## What exists on Android
- `OmniViewViewModel` has separate filter functions for each section:
  - `filterChronoAnchored()` — filters for today's time-anchored chits
  - `filterOnDeck()` — filters for in-progress/todo tasks
  - `filterSoon()` — filters for upcoming due dates
  - `filterReminders()` — filters for reminder chits
  - `filterPinnedNotes()` / `filterPinnedChecklists()` — filters for pinned items
  - `filterEmailChits()` — filters for email chits
- Each filter function operates independently on the full chit list

## What's missing
1. **No cross-section deduplication** — each section independently filters from the full chit list, so a chit can appear in multiple sections simultaneously
2. **No priority ordering** — sections don't "claim" chits in priority order
3. **Example of the problem**: A pinned task that's due today could appear in both "Chrono" (because it has a date today), "On Deck" (because it's In Progress), "Soon" (because it has a due date), AND "Pinned Notes" (because it's pinned with notes)
4. The web's `placedIds` Set pattern needs to be replicated — either by processing sections in order and excluding already-placed IDs, or by assigning each chit to its highest-priority section
