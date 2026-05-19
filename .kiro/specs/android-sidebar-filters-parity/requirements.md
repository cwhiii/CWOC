# Requirements Document

## Introduction

This feature replaces the Android app's current `FilterPanel.kt` implementation with a new version that achieves exact visual and functional parity with the mobile web sidebar filter panel. The current Android filter panel uses Material3 default styling (FilterChips, Switch toggles), includes sections not present on web (Color, Date Range), and is missing several web features (text search, saved searches, project filter, "Any" toggle behavior, collapsible sub-groups, tag tree with colors/hierarchy, people chips with images/colors, per-group Clear buttons, and header-level Clear/Defaults buttons). The new implementation must match the web version identically in structure, behavior, and visual appearance.

## Glossary

- **Filter_Panel**: The Jetpack Compose UI component embedded within the sidebar's collapsible "🔍 Filters" section that provides all filtering controls for the chit list
- **Filter_State**: The in-memory data class (`FilterState.kt`) holding the current values of all filter dimensions
- **Any_Toggle**: A checkbox labeled "— Any" that represents "no filtering" for a multi-select group; mutually exclusive with specific option checkboxes
- **Collapsible_Sub_Group**: A filter category (Status, Priority, Tags, People, Project, Display) that can be individually expanded or collapsed by tapping its header label
- **Tag_Tree**: A hierarchical rendering of tags showing parent/child relationships, with colored badges, favorites (★) sorted first, and expand/collapse for parent nodes
- **People_Chip**: A styled chip representing a contact or system user, showing thumbnail image, name, favorite star, and the contact's assigned color as background
- **Clear_Button**: A per-group button that resets that filter group to its default state (Any checked, selections cleared)
- **Clear_All_Button**: A header-level button (✕ icon) that resets ALL filters, search text, and sort to system defaults; only visible when any filter is in a non-default state
- **Defaults_Button**: A header-level button (↺ icon) that resets filters to the current tab's custom view defaults; only visible when the tab has custom defaults configured
- **Saved_Searches**: Flex-wrap chips below the search text field showing previously saved search terms that can be tapped to apply
- **Parchment_Theme**: The app's visual theme using brown tones, Lora serif font, parchment background colors (#fffaf0, #f5e6cc), and brown borders (#6b4e31, #8b5a2b)

## Requirements

### Requirement 1: Collapsible Filter Sub-Groups

**User Story:** As a user, I want each filter category to be individually collapsible, so that I can focus on the filters I need without visual clutter.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render the following sub-groups in this exact order: Filter Text, Status, Priority, Tags, People, Project, Display
2. WHEN a collapsible sub-group header label is tapped, THE Filter_Panel SHALL toggle that sub-group between expanded and collapsed states
3. THE Filter_Panel SHALL render Status, Priority, Tags, People, Project, and Display sub-groups in the collapsed state by default
4. THE Filter_Panel SHALL render the Filter Text sub-group in the expanded state without an arrow indicator or tap-to-collapse affordance (always visible, not collapsible)
5. WHEN a sub-group is collapsed, THE Filter_Panel SHALL show only the header label with a "▶" arrow indicator
6. WHEN a sub-group is expanded, THE Filter_Panel SHALL show the header label with a "▼" arrow indicator and the group's content below it
7. WHEN the filter panel is closed and reopened within the same session, THE Filter_Panel SHALL reset all collapsible sub-groups to the collapsed default state

### Requirement 2: Filter Text Search and Saved Searches

**User Story:** As a user, I want a text input to filter chits by keyword and quick-access chips for saved searches, so that I can rapidly narrow down my chit list.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render a text input field with placeholder text "Filter Chits..." at the top of the filter body
2. WHEN the user types in the search field, THE Filter_Panel SHALL update `FilterState.searchText` on each keystroke and trigger a re-filter of the chit list within 100 milliseconds without requiring an "Apply" action
3. WHEN `FilterState.searchText` is non-empty, THE Filter_Panel SHALL match the query case-insensitively against the chit title and notes fields, showing only chits where at least one field contains the query substring
4. THE Filter_Panel SHALL render saved search chips below the text input in a horizontally-wrapping flex layout, displaying each chip label truncated to 15 characters with an ellipsis if longer
5. WHEN a saved search chip is tapped, THE Filter_Panel SHALL populate the search text field with that saved search term and trigger re-filtering
6. WHEN a saved search chip's delete icon is tapped, THE Filter_Panel SHALL remove that search from the persisted saved searches list and remove the chip from the display
7. IF the saved searches list is empty, THEN THE Filter_Panel SHALL hide the saved searches container (no empty space rendered)

### Requirement 3: Status Multi-Select with Any Toggle

**User Story:** As a user, I want to filter chits by status using checkboxes with an "Any" option, so that I can see all chits or only those with specific statuses.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render the Status group with checkboxes for: "— Any" (checked by default), "ToDo", "In Progress", "Blocked", "Complete", "Rejected"
2. WHEN the "— Any" checkbox is checked, THE Filter_Panel SHALL uncheck all specific status checkboxes and set `FilterState.statuses` to an empty set
3. WHEN any specific status checkbox is checked, THE Filter_Panel SHALL uncheck the "— Any" checkbox and add that status to `FilterState.statuses`
4. WHEN a specific status checkbox is unchecked while other specific statuses remain checked, THE Filter_Panel SHALL remove that status from `FilterState.statuses` and keep the "— Any" checkbox unchecked
5. WHEN the last remaining specific status checkbox is unchecked (no specific statuses remain checked), THE Filter_Panel SHALL automatically re-check the "— Any" checkbox and set `FilterState.statuses` to an empty set
6. THE Filter_Panel SHALL render a "Clear" button at the bottom of the Status group
7. WHEN the Status "Clear" button is tapped, THE Filter_Panel SHALL uncheck all specific checkboxes, re-check "— Any", and set `FilterState.statuses` to an empty set

### Requirement 4: Priority Multi-Select with Any Toggle

**User Story:** As a user, I want to filter chits by priority using checkboxes with an "Any" option, so that I can see all chits or only those with specific priorities.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render the Priority group with checkboxes in this order: "— Any" (checked by default), "Low", "Medium", "High"
2. WHEN the "— Any" checkbox is checked by the user, THE Filter_Panel SHALL uncheck all specific priority checkboxes and set `FilterState.priorities` to an empty set
3. IF the "— Any" checkbox is already checked and the user taps it, THEN THE Filter_Panel SHALL keep it checked and take no action (the "— Any" checkbox cannot be directly unchecked by the user)
4. WHEN any specific priority checkbox is checked, THE Filter_Panel SHALL uncheck the "— Any" checkbox and add that priority to `FilterState.priorities`
5. WHEN a specific priority checkbox is unchecked while other specific priorities remain checked, THE Filter_Panel SHALL remove that priority from `FilterState.priorities` and keep the "— Any" checkbox unchecked
6. WHEN the last remaining specific priority checkbox is unchecked (all specific checkboxes are now unchecked), THE Filter_Panel SHALL automatically re-check the "— Any" checkbox and set `FilterState.priorities` to an empty set
7. THE Filter_Panel SHALL render a "Clear" button at the bottom of the Priority group
8. WHEN the Priority "Clear" button is tapped, THE Filter_Panel SHALL uncheck all specific checkboxes, re-check "— Any", and set `FilterState.priorities` to an empty set

### Requirement 5: Tag Tree Filter with Colors, Favorites, Search, and Hierarchy

**User Story:** As a user, I want to filter chits by tags using a searchable, hierarchical tag tree with colored badges and favorites shown first, so that I can quickly find and select the tags I want.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render a "Select All / Select None" toggle button at the top of the Tags group, displaying "Select All" when fewer than all tags are selected and "Select None" when all tags are selected
2. THE Filter_Panel SHALL render a search input with placeholder "Search tags..." below the toggle button
3. WHEN the user types in the tag search input, THE Filter_Panel SHALL filter the visible tag rows to show only tags whose full path contains the search text (case-insensitive substring match), hiding non-matching rows and their empty parent containers
4. THE Filter_Panel SHALL render tags as a hierarchical tree using "/" as the path separator (e.g., "Work/Projects/CWOC"), with expand/collapse arrow controls for parent tags that have children
5. THE Filter_Panel SHALL sort tags at each tree level with favorites (★) shown first, then alphabetically (case-insensitive locale comparison) within each level
6. THE Filter_Panel SHALL display each tag with its assigned color as the background color on the tag label badge, falling back to a generated pastel color when no color is assigned
7. WHEN a tag row is tapped, THE Filter_Panel SHALL toggle that tag's selection state in `FilterState.tags`
8. THE Filter_Panel SHALL treat an empty tag selection (zero tags selected) as "show all" — chits are not filtered by tags when no tags are selected
9. WHEN the "Select All / Select None" toggle button is tapped and not all tags are selected, THE Filter_Panel SHALL select all tags; WHEN all tags are already selected, THE Filter_Panel SHALL deselect all tags (set `FilterState.tags` to empty)
10. WHEN applying the tag filter to chits, THE Filter_Panel SHALL match a chit if any of its tags equals a selected tag or is a descendant of a selected tag (i.e., chit tag starts with selectedTag + "/")
11. WHEN the user clears all tag selections (via clear action or deselect all), THE Filter_Panel SHALL set `FilterState.tags` to an empty set and stop applying tag-based filtering

### Requirement 6: People Chip Filter with Images, Colors, and Favorites

**User Story:** As a user, I want to filter chits by associated people using styled chips that show profile images, assigned colors, and favorites first, so that I can quickly identify and select people.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render a search input with placeholder "Search people..." at the top of the People group
2. WHEN the user types in the people search input, THE Filter_Panel SHALL filter the visible chips to show only people whose names contain the search text (case-insensitive)
3. THE Filter_Panel SHALL render each person as a chip showing: a circular thumbnail image (18dp diameter) if available, display name (with prefix stripped), and favorite star (★) prepended to the name if the person is marked as a favorite
4. IF a contact has no profile image, THEN THE Filter_Panel SHALL display a circular placeholder with a "?" character; IF a system user has no profile image, THEN THE Filter_Panel SHALL display a circular placeholder with a user icon
5. THE Filter_Panel SHALL use each person's assigned color as the chip background color, defaulting to tan (#d2b48c) when no color is assigned, and SHALL select chip text color (dark or light) based on background lightness for readable contrast
6. THE Filter_Panel SHALL render system user chips with a thicker dark brown border (2px solid #1a1208) to distinguish them from contact chips (1px border)
7. WHEN a person chip is selected, THE Filter_Panel SHALL style the chip with: outline 2px solid #4a2c2a, bold font weight, full opacity
8. WHEN a person chip is unselected, THE Filter_Panel SHALL style the chip with: opacity 0.7
9. THE Filter_Panel SHALL display a merged list of contacts and system users, with contacts sorted favorites-first then alphabetically, followed by system users sorted alphabetically, deduplicating by name (case-insensitive)
10. WHEN a person chip is tapped, THE Filter_Panel SHALL toggle that person's selection state in `FilterState.people`
11. THE Filter_Panel SHALL render a "Clear" button at the bottom of the People group
12. WHEN the People "Clear" button is tapped, THE Filter_Panel SHALL clear all people selections and set `FilterState.people` to an empty set
13. IF no contacts or system users exist, THEN THE Filter_Panel SHALL display a "No contacts or users" message in place of chips
14. IF the search input text matches no people names, THEN THE Filter_Panel SHALL display a "No matches" message in place of chips

### Requirement 7: Project Filter Dropdown

**User Story:** As a user, I want to filter chits by project using a dropdown, so that I can focus on chits belonging to a specific project or those with/without any project.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render the Project group with a dropdown select containing three static options: "—" (no filter, default), "Any (has a project)", "None (no project)"
2. WHEN chit data is loaded or refreshed, THE Filter_Panel SHALL populate the Project dropdown with all non-deleted project master chit titles, sorted alphabetically by title, appended below the three static options, displaying "(Untitled Project)" for any project master with an empty or null title
3. WHEN the user selects "—", THE Filter_Panel SHALL set `FilterState.projectFilter` to null (no project filtering applied, all chits shown)
4. WHEN the user selects "Any (has a project)", THE Filter_Panel SHALL set `FilterState.projectFilter` to "__any__" and the chit list SHALL show only chits that appear in any project master's `child_chits` list, plus project masters themselves
5. WHEN the user selects "None (no project)", THE Filter_Panel SHALL set `FilterState.projectFilter` to "__none__" and the chit list SHALL show only chits that do not appear in any project master's `child_chits` list and are not project masters
6. WHEN the user selects a specific project, THE Filter_Panel SHALL set `FilterState.projectFilter` to that project's ID and the chit list SHALL show only the selected project master and its `child_chits`
7. THE Filter_Panel SHALL render a "Clear" button at the bottom of the Project group
8. WHEN the Project "Clear" button is tapped, THE Filter_Panel SHALL reset the dropdown to "—" and set `FilterState.projectFilter` to null

### Requirement 8: Display Toggle Checkboxes

**User Story:** As a user, I want checkbox toggles for display options (pinned, archived, snoozed, etc.) matching the web layout with separators and emoji labels, so that I can control which categories of chits are visible.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render the Display group using Checkbox composables (not Switch toggles) for each display option, with each checkbox on its own row accompanied by its emoji and text label
2. THE Filter_Panel SHALL render display options in this exact order with these exact labels and default states:
   - 📌 Pinned (checked by default)
   - 📦 Archived (unchecked by default)
   - 😴 Snoozed (unchecked by default)
   - 📄 Unmarked (checked by default)
   - [dashed separator line]
   - ⏰ Past-Due (checked by default)
   - ✅ Complete (checked by default)
   - ✗ Declined (checked by default)
   - 🎯 Habits (checked by default)
   - 📨 Email (Received) (unchecked by default)
   - 📤 Email (Sent) (unchecked by default)
   - [dashed separator line]
   - 🔗 Shared with me (unchecked by default)
   - 📤 Shared by me (unchecked by default)
3. THE Filter_Panel SHALL render dashed separator lines between the three display option groups (pin/archive state, status/type visibility, sharing), where each separator is a horizontal dashed line spanning the full width of the display options area
4. WHEN any display checkbox is toggled, THE Filter_Panel SHALL update the corresponding `FilterState` boolean field and trigger re-filtering of the visible chit list within the same UI frame (no navigation or manual refresh required)
5. WHEN the user taps "Clear All Filters", THE Filter_Panel SHALL reset all display checkboxes to their default states as specified in criterion 2

### Requirement 9: Remove Non-Web Filter Sections

**User Story:** As a user, I want the Android filter panel to contain only the same filter sections as the web version, so that the experience is consistent across platforms.

#### Acceptance Criteria

1. THE Filter_Panel SHALL NOT render a "Color" filter section (this section does not exist on the web version)
2. THE Filter_Panel SHALL NOT render a "Date Range" filter section (this section does not exist on the web version)
3. THE Filter_State data class SHALL retain the `colors` and `dateRangeStart`/`dateRangeEnd` fields for backward compatibility, but the Filter_Panel SHALL NOT expose UI controls for them
4. WHEN the user taps "Clear All Filters", THE Filter_Panel SHALL reset the `colors` set to empty and `dateRangeStart`/`dateRangeEnd` to null, ensuring no hidden filter state persists without a UI control to clear it

### Requirement 10: Header-Level Clear and Defaults Buttons

**User Story:** As a user, I want Clear and Defaults buttons next to the Filters section header, so that I can quickly reset all filters or return to my tab's custom defaults.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render a "Clear" button (with ✕ icon) in a horizontal row adjacent to the "Filters" collapsible section header label
2. THE Filter_Panel SHALL display the "Clear" button only when at least one filter dimension is in a non-default state, where non-default means any of: a status checkbox selected, a priority checkbox selected, one or more tags selected, one or more people selected, search text non-empty, any display toggle changed from its system default, a sort field selected, a project filter selected, or a sharing filter enabled
3. WHEN the "Clear" button is tapped and the current tab has custom view defaults configured, THE Filter_Panel SHALL reset all filters to that tab's custom view default configuration (statuses, priorities, tags, people, display toggles, sort, project, and search text as defined in the custom view filter)
4. WHEN the "Clear" button is tapped and the current tab has no custom view defaults configured, THE Filter_Panel SHALL reset all filters to system defaults: statuses to Any, priorities to Any, tags cleared, people cleared, project cleared, search text cleared, sort cleared, show-pinned on, show-archived off, show-snoozed off, show-unmarked on, show-past-due on, show-complete on, show-declined on, show-habits on, show-email-received off, show-email-sent off, sharing filters off
5. THE Filter_Panel SHALL render a "Defaults" button (with ↺ icon) in the same horizontal row, positioned after the "Clear" button
6. THE Filter_Panel SHALL display the "Defaults" button only when the current tab has custom view defaults configured (a non-empty entry in the custom_view_filters setting for that tab) or has a legacy default filter text defined
7. WHEN the "Defaults" button is tapped, THE Filter_Panel SHALL apply the current tab's custom view default filter configuration, or if none exists, apply the legacy default filter text for that tab
8. WHEN either button is tapped, THE Filter_Panel SHALL refresh the displayed chit list to reflect the updated filter state

### Requirement 11: Immediate Filter Application

**User Story:** As a user, I want all filter changes to immediately update the chit list without needing to tap an "Apply" button, so that I get instant feedback on my filter selections.

#### Acceptance Criteria

1. WHEN any filter value changes (checkbox toggle, text input, dropdown selection, chip tap, tag selection), THE Filter_Panel SHALL invoke the `onFilterStateChanged` callback with the updated FilterState synchronously within the same user interaction handler
2. THE Filter_Panel SHALL NOT render an "Apply" or "Submit" button for filter changes
3. WHEN the filter state changes, THE chit list SHALL re-filter and re-render within the next Compose recomposition cycle (triggered by StateFlow collection)
4. WHEN a text input filter field value changes, THE Filter_Panel SHALL invoke the `onFilterStateChanged` callback after a debounce period of no more than 300 milliseconds of input inactivity to avoid excessive recomposition during rapid typing
5. WHEN the applied filters result in zero matching chits, THE chit list SHALL display an empty-state indicator informing the user that no chits match the current filters

### Requirement 12: Parchment Theme Visual Styling

**User Story:** As a user, I want the filter panel to use the parchment theme styling consistent with the rest of the app and the web version, so that the visual experience is cohesive.

#### Acceptance Criteria

1. THE Filter_Panel SHALL use parchment theme colors for backgrounds (#fffaf0, #f5e6cc), borders (#6b4e31, #8b5a2b), and text (#4a2c2a, #3b1f0a)
2. THE Filter_Panel SHALL render checkboxes with a parchment-colored fill (#fffaf0) and brown border (#6b4e31) in unchecked state, and a brown fill (#6b4e31) with a parchment-colored checkmark (#fffaf0) in checked state, rather than using default Material3 checkbox styling
3. THE Filter_Panel SHALL render sub-group header labels using the app's brown header color (#4A3728) with bold font weight (600 or higher)
4. THE Filter_Panel SHALL render "Clear" buttons with font-size 0.75em equivalent, padding of 3–4dp vertical and 8dp horizontal, a 1dp brown border (#6b4e31) at 30% opacity, border-radius of 3dp, brown text (#6b4e31), and transparent background matching the web `filter-clear-btn` class
5. THE Filter_Panel SHALL render the search text inputs with a 1dp brown border (#6b4e31), parchment background (#fffaf0), and brown text (#4a2c2a)
6. THE Filter_Panel SHALL use the Lora serif font family for all text elements (labels, buttons, and inputs) to match the app-wide parchment typography

### Requirement 13: FilterState Data Class Updates

**User Story:** As a developer, I want the FilterState data class to accurately reflect the web filter model (removing "Critical" priority, keeping backward-compatible fields), so that the data layer matches the web version.

#### Acceptance Criteria

1. THE Filter_State SHALL use priority values "Low", "Medium", "High" only, and THE Android_App FilterPanel SHALL present only these three priority options in the UI (removing "Critical" which does not exist in the web editor's priority dropdown)
2. THE Filter_State SHALL retain the `colors` field as `Set<String>`, the `dateRangeStart` field as `String?`, and the `dateRangeEnd` field as `String?` with their existing default values for backward compatibility
3. THE Filter_State SHALL retain the `searchText` field as `String` (default empty string) and `projectFilter` field as `String?` (default null) that already exist
4. THE Filter_State `activeFilterCount` property SHALL count a filter dimension as active when its value differs from the data class default: `searchText` is active when non-empty, `projectFilter` is active when non-null, `colors` is active when non-empty, `dateRangeStart` or `dateRangeEnd` is active when non-null, set-based filters (statuses, priorities, tags, people) are active when non-empty, and boolean toggles are active when they differ from their declared defaults
