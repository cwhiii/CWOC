# Requirements Document

## Introduction

Global Chit Search adds a dedicated, cross-category search view to the CWOC dashboard. Today the sidebar "Search" input filters chits only within the active C CAPTN tab. Global Chit Search introduces a new tab (magnifying glass icon, last in the tab bar) that opens a purpose-built search view. The view searches ALL field values across ALL chits regardless of category, displays matching chits with the matched field name and highlighted match text, and coexists with the existing sidebar filters. As part of this feature, the sidebar and header labels currently reading "Search" are renamed to "Filter by Words" to clarify the distinction between per-tab filtering and global search.

## Glossary

- **Dashboard**: The main CWOC page (`index.html`) containing the sidebar, header, tab bar, and chit list area.
- **Search_View**: The new view rendered in the chit list area when the Global Search tab is active.
- **Search_Tab**: The new magnifying glass tab button appended as the last item in the C CAPTN tab bar.
- **Search_Input**: The text input field at the top of the Search_View where the user types a search query.
- **Go_Button**: The button next to the Search_Input that triggers the global search.
- **Result_Card**: A single search result entry displaying the chit title, matched field name, and highlighted match excerpt.
- **Sidebar_Filters**: The existing sidebar filter controls (Status, Priority, Tags, People, Show) that narrow displayed chits.
- **Filter_By_Words_Input**: The existing sidebar text input, currently labeled "Search", renamed to "Filter by Words".
- **Chit_Field**: Any stored property of a chit (title, note, tags, status, priority, severity, location, people, checklist item text, start_datetime, end_datetime, due_datetime, color, alerts, recurrence_rule, etc.).
- **Match_Highlight**: A visual treatment (e.g., `<mark>` tag or background color) applied to the portion of text that matches the search query.
- **Search_API**: A new backend endpoint that performs the global full-text search across all chit fields and returns matching chits with match metadata.

## Requirements

### Requirement 1: Search Tab in Tab Bar

**User Story:** As a user, I want a magnifying glass icon tab at the end of the C CAPTN tab bar, so that I can quickly access the global search view.

#### Acceptance Criteria

1. THE Dashboard SHALL display the Search_Tab as the last tab in the C CAPTN tab bar, after the Notes tab.
2. THE Search_Tab SHALL display a magnifying glass icon (Font Awesome `fa-search`) and the label "Global Search" consistent in size and style with the existing tab icons.
3. WHEN the user clicks the Search_Tab, THE Dashboard SHALL activate the Search_View in the chit list area and visually highlight the Search_Tab as the active tab.
4. WHEN the Search_Tab is active, THE Dashboard SHALL hide the Period selector and date navigation controls in the sidebar (same behavior as non-Calendar tabs).
5. WHEN the Search_Tab is active, THE Dashboard SHALL show the Order controls in the sidebar.
6. WHEN the user presses the "G" key (outside of text inputs), THE Dashboard SHALL activate the Search_Tab (hotkey "G" for Global Search).

### Requirement 2: Search View Layout

**User Story:** As a user, I want a clean search view with a text input and Go button, so that I can enter and execute global searches.

#### Acceptance Criteria

1. WHEN the Search_Tab is active and no search has been executed, THE Search_View SHALL display only the Search_Input and the Go_Button at the top of the chit list area, with the remaining area empty.
2. THE Search_Input SHALL be a text input field spanning most of the width of the chit list area, styled consistently with the CWOC parchment aesthetic (Courier New font, brown border, parchment background).
3. THE Go_Button SHALL appear immediately to the right of the Search_Input, styled as a standard CWOC action button.
4. THE Search_Input SHALL receive keyboard focus automatically when the Search_View is first displayed.
5. WHEN the user presses the Enter key while the Search_Input is focused, THE Search_View SHALL execute the search (same as clicking the Go_Button).

### Requirement 3: Global Search Execution

**User Story:** As a user, I want to search all fields of all chits at once, so that I can find any chit regardless of which tab it belongs to.

#### Acceptance Criteria

1. WHEN the user clicks the Go_Button or presses Enter in the Search_Input, THE Search_API SHALL search all Chit_Field values across all non-deleted chits for the entered query text.
2. THE Search_API SHALL perform case-insensitive matching.
3. THE Search_API SHALL match both whole words and partial words (substring matching).
4. THE Search_API SHALL search across all stored chit fields including: title, note, tags (each tag name), status, priority, severity, location, people (each person name), checklist items (each item text), start_datetime, end_datetime, due_datetime, created_datetime, modified_datetime, color, and alert descriptions.
5. IF the Search_Input is empty when the user clicks the Go_Button, THEN THE Search_View SHALL not execute a search and SHALL display no results.
6. THE Search_API SHALL return, for each matching chit, the chit data along with a list of field names that matched the query.

### Requirement 4: Search Results Display

**User Story:** As a user, I want to see matching chits with the matched field highlighted, so that I can understand why each result was returned.

#### Acceptance Criteria

1. WHEN the Search_API returns results, THE Search_View SHALL display one Result_Card per matching chit.
2. THE Result_Card SHALL display the chit title, styled consistently with chit cards in other views (using the chit's color as background when present).
3. THE Result_Card SHALL display the name of each Chit_Field that matched the query, along with the field value or a relevant excerpt of the field value.
4. THE Match_Highlight SHALL visually distinguish the matching portion of text within each displayed field value using a contrasting background color (e.g., yellow or gold highlight).
5. WHEN a chit matches on multiple fields, THE Result_Card SHALL display all matching fields with their highlighted excerpts.
6. WHEN the user clicks a Result_Card, THE Dashboard SHALL open that chit in the editor page (same navigation behavior as clicking a chit card in other views).
7. WHEN no chits match the search query, THE Search_View SHALL display an empty-state message indicating no results were found.

### Requirement 5: Sidebar Filters in Search View

**User Story:** As a user, I want the sidebar filters to remain functional during global search, so that I can narrow search results by status, tags, priority, or other criteria.

#### Acceptance Criteria

1. WHILE the Search_Tab is active, THE Sidebar_Filters (Status, Priority, Tags, People, Show/Archive) SHALL remain visible and functional.
2. WHEN Sidebar_Filters are applied while the Search_Tab is active, THE Search_View SHALL display only those search results that also pass the active sidebar filter criteria.
3. WHILE the Search_Tab is active, THE Filter_By_Words_Input in the sidebar SHALL remain visible but SHALL operate independently from the Search_Input (the sidebar filter applies additional text filtering on top of search results).

### Requirement 6: Rename Search to Filter by Words

**User Story:** As a user, I want the sidebar label to say "Filter by Words" instead of "Search", so that the distinction between per-tab filtering and global search is clear.

#### Acceptance Criteria

1. THE Dashboard SHALL display the label "Filter by Words" on the sidebar filter input instead of "Search".
2. THE Dashboard SHALL display the hotkey hint "D" for the Filter_By_Words_Input.
3. WHEN the hotkey panel for Filters is displayed, THE Dashboard SHALL show "Filter by Words" instead of "Search Words" in the panel option label.
4. THE Filter_By_Words_Input placeholder text SHALL read "Filter Chits..." (unchanged).
5. THE help page and reference overlay SHALL reflect the updated "Filter by Words" label wherever the old "Search" label appeared in the context of the sidebar filter.
6. WHEN the user presses the "D" key while in the Filter hotkey submenu, THE Dashboard SHALL focus the Filter_By_Words_Input (replacing the previous "W" hotkey).

### Requirement 7: Search API Endpoint

**User Story:** As a developer, I want a backend API endpoint for global search, so that the search logic runs server-side and can efficiently query all chit fields.

#### Acceptance Criteria

1. THE Search_API SHALL be accessible at `GET /api/chits/search` with a query parameter `q` containing the search text.
2. WHEN the `q` parameter is provided, THE Search_API SHALL return a JSON array of objects, each containing the full chit data and a `matched_fields` array listing the field names that matched.
3. THE Search_API SHALL exclude soft-deleted chits (where `deleted` is true) from results.
4. IF the `q` parameter is missing or empty, THEN THE Search_API SHALL return an empty array.
5. THE Search_API SHALL search JSON-serialized fields (tags, people, checklist, alerts) by deserializing them and checking individual values within.
6. THE Search_API SHALL complete the search and return results within a reasonable time for databases containing up to 1000 chits.
