# Requirements Document

## Introduction

This feature achieves parity between the CWOC Android app and the web app for all Search, Filters, and Omni View capabilities. It covers saved searches, search result snippets with field-level matching, Omni View filter locking, Omni View section deduplication, per-tab custom view filter defaults, quick-edit modal enhancements, chit link resolution in rendered markdown, section collapse persistence, and HST bar interactions. The scope encompasses 25 web functions (W109, W129–W134, W170–W175, W203–W207, W233–W235, W632–W633, W682, W879) that are currently missing or partially implemented on Android.

## Glossary

- **App**: The CWOC Android mobile application built with Kotlin, Jetpack Compose, Room, and Hilt
- **Chit**: A flexible record in CWOC that can serve as a task, note, calendar event, alarm, checklist, or project
- **Search_Screen**: The Android Compose screen that accepts a text query and displays matching chits
- **Search_ViewModel**: The ViewModel responsible for executing search queries and managing search state
- **Saved_Search**: A user-defined search query string persisted locally for quick reuse
- **Search_Snippet**: A text excerpt showing context around a matched search term within a chit field
- **Omni_View**: The Android screen that displays chits organized into priority-ordered sections (Reminders, Email, Chrono, On Deck, Soon, Pinned Notes, Pinned Checklists)
- **Omni_ViewModel**: The ViewModel responsible for filtering and organizing chits into Omni View sections
- **Filter_Lock**: A mechanism that persists the current filter state as defaults that auto-apply when entering Omni View
- **Deduplication_Engine**: Logic that assigns each chit to exactly one Omni View section based on priority order
- **PlacedIds_Set**: A Set of chit IDs tracking which chits have already been assigned to a section
- **Custom_View_Filters**: Per-tab filter configurations stored in settings that define default filters for each view tab
- **Filter_Sort_ViewModel**: The ViewModel managing filter and sort state across views
- **Quick_Edit_Menu**: The context menu (ChitActionMenu) shown on long-press of a chit card
- **Markdown_Renderer**: The component responsible for rendering markdown content as styled Compose text
- **Chit_Link**: A `[[title]]` pattern in markdown content that references another chit by title
- **HST_Bar**: The Horizontal Space-Time bar composable displayed at the top of Omni View
- **Section_Collapse_State**: The expanded/collapsed state of each Omni View section
- **Recent_Tags_Manager**: The existing component that tracks recently applied tags for quick access

## Requirements

### Requirement 1: Save Search Queries

**User Story:** As a user, I want to save frequently used search queries, so that I can quickly re-execute them without retyping.

#### Acceptance Criteria

1. WHEN the user taps a "Save Search" action while the search field contains at least one non-whitespace character, THE App SHALL persist the trimmed query string (maximum 200 characters) as a Saved_Search in the local Room database
2. WHEN the user opens the Search_Screen, THE App SHALL display all Saved_Searches as tappable chips above the search results area, ordered by most recently saved first
3. WHEN the user taps a Saved_Search chip, THE App SHALL populate the search field with the saved query and execute the search
4. WHEN the user long-presses a Saved_Search chip, THE App SHALL display a delete confirmation and remove the Saved_Search upon confirmation
5. IF the user attempts to save a query that matches an existing Saved_Search (case-insensitive, after trimming), THEN THE App SHALL display a toast indicating the search is already saved
6. IF the search field is empty or contains only whitespace, THEN THE App SHALL disable or hide the "Save Search" action

### Requirement 2: Search Result Snippets

**User Story:** As a user, I want to see text snippets showing where my search term matched within each result, so that I can quickly identify relevant chits without opening them.

#### Acceptance Criteria

1. WHEN search results are displayed, THE App SHALL show a text snippet surrounding the first occurrence of the search term within each matching field of the result chit
2. THE App SHALL display the snippet with ellipsis characters (…) prepended when text precedes the snippet window and appended when text follows the snippet window, with the matched term visually highlighted using bold styling (HTML `<strong>` tags or equivalent)
3. THE App SHALL extract a snippet window of no more than 50 characters total, centered on the first match position within the field text, with a minimum of 15 characters before the match start
4. WHEN a search term matches in a chit field, THE App SHALL display a labeled row indicating the field name (e.g., title, note, location, tags, people, checklist) followed by the highlighted snippet for that field
5. THE App SHALL search across all chit text fields including: title, note, location, tags, people, checklist item text, status, priority, email subject, email body, email from, email to, email cc, email bcc, and assigned_to
6. WHEN a search term matches in multiple fields of the same chit, THE App SHALL display a separate snippet row for each matched field, excluding the synthetic full_text field from display
7. IF the field text is shorter than 50 characters and contains no match, THEN THE App SHALL display the full field text truncated at 50 characters with a trailing ellipsis

### Requirement 3: Omni View Filter Locking

**User Story:** As a user, I want to lock filter defaults for the Omni View, so that it always opens with my preferred filters pre-applied.

#### Acceptance Criteria

1. WHEN the user taps a "Lock Filters" action in the Omni View, THE App SHALL persist the current filter state (statuses, tags, priorities, people, and text search) as the locked defaults in the `omni_locked_filters` setting via POST to the settings API
2. WHEN the user navigates to the Omni View and a non-empty `omni_locked_filters` setting exists, THE App SHALL automatically apply the locked filter state to the sidebar filter UI controls (status checkboxes, tag selection, priority checkboxes, people selection, and search field) and render the filtered results within 1 second of view entry
3. WHEN locked filters are active, THE App SHALL display a lock indicator (🔒) adjacent to the search/filter area in the Omni View toolbar
4. WHEN the user taps an "Unlock Filters" action, THE App SHALL clear the `omni_locked_filters` setting by saving an empty value to the server, remove the lock indicator, and reset the sidebar filters to the default unfiltered state
5. WHILE locked filters are active, THE App SHALL reflect the locked filter state in the filter sidebar UI controls so that each filter control (status, tags, priorities, people, text) shows the locked values as selected
6. THE App SHALL sync the `omni_locked_filters` setting with the server so the lock state is consistent across platforms
7. IF the `omni_locked_filters` setting contains malformed or unparseable JSON, THEN THE App SHALL treat the setting as empty (no locked filters), clear the indicator, and log the parse error to the console
8. IF the settings API request to save or clear locked filters fails, THEN THE App SHALL display an error toast indicating the operation failed and retain the previous lock state without modifying the local filter UI

### Requirement 4: Omni View Section Deduplication

**User Story:** As a user, I want each chit to appear in only one Omni View section, so that the view is not cluttered with duplicate entries.

#### Acceptance Criteria

1. THE Deduplication_Engine SHALL assign each chit to at most one Omni View section, evaluating sections in priority order: Reminders → Email → Chrono → On Deck → Soon → Pinned Notes → Pinned Checklists
2. WHEN a chit qualifies for multiple sections, THE Deduplication_Engine SHALL place the chit in the highest-priority section and exclude it from all lower-priority sections
3. THE Deduplication_Engine SHALL maintain a set of assigned chit IDs and SHALL exclude any chit whose ID is already in that set from subsequent section evaluations
4. WHEN processing each section in priority order, THE Deduplication_Engine SHALL skip any chit whose ID has already been assigned to a higher-priority section
5. IF a chit does not qualify for any section (not a reminder, not an email, has no relevant dates within the current week, and is not pinned), THEN THE Deduplication_Engine SHALL omit that chit from the Omni View entirely
6. THE Deduplication_Engine SHALL exclude completed chits (status = "Complete") and archived chits from section assignment before evaluating priority order
7. WHEN collecting all displayed chit IDs across all Omni View sections, THE Deduplication_Engine SHALL produce a set with zero duplicates (each chit ID appears in exactly one section)

### Requirement 5: Custom View Filters (Per-Tab Defaults)

**User Story:** As a user, I want my configured default filters to auto-apply when switching tabs, so that each view opens with my preferred filter state.

#### Acceptance Criteria

1. WHEN the user switches to a tab that has a non-empty entry in the `custom_view_filters` setting, THE Filter_Sort_ViewModel SHALL apply that tab's saved filter state to the active filters, setting statuses, priorities, tags, people, project, search text, sort field/direction, and display toggles (pinned, archived, snoozed, unmarked, past-due, complete, declined, habits, email-received, email-sent, shared-with-me, shared-by-me) to the stored values
2. WHEN the user taps "Reset Filters" on a tab that has a non-empty entry in `custom_view_filters`, THE Filter_Sort_ViewModel SHALL re-apply that tab's saved custom default filter state rather than clearing all filters to system defaults
3. WHEN a tab has no entry or an empty entry in `custom_view_filters`, THE Filter_Sort_ViewModel SHALL apply system defaults: statuses set to Any, priorities set to Any, tags cleared, people cleared, project cleared, search text cleared, sort cleared, show-pinned on, show-archived off, show-snoozed off, show-unmarked on, show-past-due on, show-complete on, show-declined on, show-habits on, show-email-received off, show-email-sent off, sharing filters off
4. WHEN the app loads settings from SettingsEntity at startup, THE App SHALL parse the `custom_view_filters` JSON string into a map keyed by tab name (e.g., "Calendar", "Tasks", "Notes", "Checklists", "Alarms", "Projects", "Omni"), and if parsing fails due to malformed JSON, SHALL fall back to an empty map (no custom filters for any tab)
5. WHEN custom view filters are applied on tab switch, THE App SHALL update the filter sidebar UI controls (checkboxes, dropdowns, search field, sort selectors, display toggles) to visually reflect the applied filter values
6. IF the `custom_view_filters` entry for a tab contains filter references that no longer exist (e.g., a deleted tag or removed contact), THEN THE Filter_Sort_ViewModel SHALL skip the invalid filter values and apply only the remaining valid values

### Requirement 6: Quick Edit Modal Enhancements

**User Story:** As a user, I want to change a chit's status and priority directly from the long-press menu, so that I can make quick edits without opening the full editor.

#### Acceptance Criteria

1. WHEN the user long-presses a chit card and selects "Quick Edit" from the context menu, THE Quick_Edit_Menu SHALL display an inline status dropdown showing all available statuses (ToDo, In Progress, Blocked, Complete, Rejected) regardless of whether the chit currently has a status value set
2. WHEN the user selects a status from the inline dropdown and taps "Save Changes", THE App SHALL update the chit's status within 2 seconds and refresh the card display to reflect the new status
3. WHEN the user long-presses a chit card and selects "Quick Edit" from the context menu, THE Quick_Edit_Menu SHALL display an inline priority dropdown showing all available priorities (None, Low, Medium, High) regardless of whether the chit currently has a priority value set
4. WHEN the user selects a priority from the inline dropdown and taps "Save Changes", THE App SHALL update the chit's priority within 2 seconds and refresh the card display to reflect the new priority
5. WHEN the user saves status or priority changes via the Quick_Edit_Menu, THE App SHALL persist the changes to the local database and send the update to the server via the existing PUT /api/chits/{id} endpoint
6. IF the server request to persist a status or priority change fails, THEN THE App SHALL display an error toast indicating the save failed and retain the user's selected values in the dropdown so the user can retry without re-entering
7. WHEN the user selects "None" (empty value) from the status or priority dropdown and saves, THE App SHALL clear that field on the chit (set to null) and refresh the card display accordingly

### Requirement 7: Resolve Chit Links in Rendered Markdown

**User Story:** As a user, I want `[[title]]` patterns in my notes to render as clickable links to the referenced chit, so that I can navigate between related chits directly from rendered content.

#### Acceptance Criteria

1. WHEN rendering markdown content that contains `[[title]]` patterns, THE Markdown_Renderer SHALL replace each pattern with a clickable link styled with steel-blue color (#4682B4) and underline text decoration
2. THE Markdown_Renderer SHALL resolve `[[title]]` by performing a case-insensitive, whitespace-trimmed title lookup against all chits in the local Room database, and IF multiple chits match the same title, THEN THE Markdown_Renderer SHALL link to the first match found
3. WHEN the user taps a resolved chit link, THE App SHALL navigate to the editor screen for the matched chit
4. IF a `[[title]]` pattern does not match any existing chit title, THEN THE Markdown_Renderer SHALL render the link text without underline and without click handling, using a muted color distinct from resolved links (not steel-blue)
5. THE Markdown_Renderer SHALL handle up to 50 `[[title]]` patterns within the same content block, resolving each independently
6. IF a `[[title]]` pattern is empty (i.e., `[[]]` or contains only whitespace), THEN THE Markdown_Renderer SHALL render the raw text unchanged without attempting resolution
7. THE Markdown_Renderer SHALL NOT resolve `[[title]]` patterns that appear inside fenced code blocks or inline code spans

### Requirement 8: Omni View Section Collapse Persistence

**User Story:** As a user, I want my expanded/collapsed section states in Omni View to persist across app restarts, so that I don't have to re-collapse sections every time I open the app.

#### Acceptance Criteria

1. WHEN the user collapses or expands an Omni View section, THE App SHALL persist the updated Section_Collapse_State to local storage (SharedPreferences) within 1 second of the toggle action
2. WHEN the Omni View loads, THE App SHALL restore each section's collapsed/expanded state from the persisted Section_Collapse_State before displaying the section list to the user
3. IF no persisted collapse state exists for a section, THEN THE App SHALL default that section to the expanded state
4. THE App SHALL persist collapse state independently for each Omni View section (Reminders, Email, Chrono, On Deck, Soon, Pinned Notes, Pinned Checklists) such that toggling one section does not alter the persisted state of any other section
5. IF the persistence write to SharedPreferences fails, THEN THE App SHALL retain the user's toggle action in the current session view without reverting the visual state

### Requirement 9: HST Bar Weather Modal Interaction

**User Story:** As a user, I want to tap the HST bar to open the weather modal, so that I can quickly check weather information from the Omni View.

#### Acceptance Criteria

1. WHEN the user taps the HST_Bar in the Omni View and the tap target is the bar background, fill element, or time overlay (not a chit icon or weather icon marker), THE App SHALL open the weather information modal as an overlay positioned center-screen with a semi-transparent backdrop
2. WHEN the weather modal is open, THE App SHALL display current weather data for the user's default saved location including: a weather condition icon, a text description of conditions, the high and low temperature with the user's configured unit (°F or °C), precipitation amount (if any), wind speed (if above threshold), and a temperature range bar
3. IF weather data is unavailable due to network failure, missing location configuration, or empty API response, THEN THE App SHALL display an error message within the modal body indicating the specific failure reason (location not found, weather service unreachable, no saved locations configured, or data unavailable for the given address)
4. WHEN the user taps outside the weather modal overlay or presses the back button, THE App SHALL close the weather modal and return focus to the Omni View

### Requirement 10: Recent Tags Verification

**User Story:** As a user, I want recently applied tags to appear as quick-access chips in the tag picker, so that I can rapidly re-apply common tags.

#### Acceptance Criteria

1. WHEN the user applies a tag to a chit, THE Recent_Tags_Manager SHALL record that tag as the most recent entry, moving it to the front of the list if it already exists (no duplicates)
2. WHEN the tag picker is opened, THE App SHALL display recent tags as tappable chips in a dedicated "Recent" section positioned above the full tag list and after any favorite tags
3. THE Recent_Tags_Manager SHALL maintain a bounded list of at most 5 recent tags ordered most-recent-first, persisted to user settings so the list survives across sessions
4. WHEN the user taps a recent tag chip that is not already applied to the current chit, THE App SHALL apply that tag to the current chit
5. WHEN the user taps a recent tag chip that is already applied to the current chit, THE App SHALL remove that tag from the current chit

