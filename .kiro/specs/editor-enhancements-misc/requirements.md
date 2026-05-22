# Requirements Document

## Introduction

This feature achieves parity between the CWOC Android app and the web app for all Editor Enhancements and Miscellaneous capabilities. It covers custom objects zone management in settings, attachment multi-select and bulk delete, checklist clipboard operations (paste-as-items and copy-incomplete), inline markdown rendering in checklist items, automatic list continuation in the notes editor, indicator chart drag-to-reorder, RSVP status extraction and declined-chit filtering, project context menu with move-child-to-project, save-and-stay in the contact editor, and attachment grid chit title display. The scope encompasses 19 web functions (W156–W157, W189, W223–W229, W240–W243, W247–W248, W405, W603, W901) that are currently missing or partially implemented on Android.

## Glossary

- **App**: The CWOC Android mobile application built with Kotlin, Jetpack Compose, Room, and Hilt
- **Chit**: A flexible record in CWOC that can serve as a task, note, calendar event, alarm, checklist, or project
- **Custom_Objects_Screen**: The Android Compose screen for managing custom object definitions and their zone assignments
- **Custom_Objects_ViewModel**: The ViewModel responsible for CRUD operations on custom objects and zones
- **Attachments_Screen**: The Android Compose screen displaying all file attachments in a grid layout
- **Attachments_ViewModel**: The ViewModel managing attachment listing, multi-select, and bulk operations
- **Checklist_Zone**: The ChecklistZoneV2 composable in the chit editor for managing checklist items
- **Checklist_Zone_ViewModel**: The state holder managing checklist items, undo/redo, and inline editing
- **Notes_Zone**: The notes editing area in the chit editor (multiline text field)
- **Indicators_Screen**: The Android Compose screen displaying health indicator charts
- **Indicators_ViewModel**: The ViewModel managing indicator data, chart rendering, and chart selection
- **RSVP_Status**: A user's response status for a shared chit (invited, accepted, declined, tentative)
- **Projects_View**: The Android screen displaying project master chits with Kanban boards
- **Contact_Editor_Screen**: The Android Compose screen for creating/editing contacts
- **Contact_Editor_ViewModel**: The ViewModel managing contact form state and persistence
- **Markdown_Renderer**: The component responsible for rendering markdown content as styled Compose text
- **Clipboard_Manager**: Android system service for reading/writing clipboard content

## Requirements

### Requirement 1: Custom Objects Zone Management (Re-verification)

**User Story:** As a user, I want to create, rename, delete, and reorder custom object zones in Settings, so that I can organize my custom objects into logical groups displayed in the chit editor.

#### Acceptance Criteria

1. WHEN the user taps "Add Zone" in the Custom_Objects_Screen, THE App SHALL display a text input dialog and create a new zone with the entered name upon confirmation
2. WHEN the user long-presses a zone header, THE App SHALL display options to rename or delete the zone
3. WHEN the user confirms zone deletion, THE App SHALL remove the zone and unassign all objects from it (objects become unzoned, not deleted)
4. WHEN the user drags a custom object into a zone, THE App SHALL assign that object to the zone and persist the assignment to the server via the settings API
5. WHEN the user drags objects within a zone, THE App SHALL reorder the objects and persist the new order
6. WHEN the user renames a zone, THE App SHALL update the zone name in the local database and sync to the server
7. IF the Custom_Objects_ViewModel already implements all of `createZone`, `renameZone`, `deleteZone`, `addObjectToZone`, `removeObjectFromZone`, and `reorderZoneObjects` with working UI, THEN this requirement is already satisfied and requires only verification (no new code)

### Requirement 2: Attachment Multi-Select and Bulk Delete (Re-verification)

**User Story:** As a user, I want to select multiple attachments and delete them in bulk, so that I can efficiently manage my file attachments.

#### Acceptance Criteria

1. WHEN the user long-presses an attachment card, THE App SHALL enter multi-select mode, selecting the long-pressed item and displaying a selection count in the toolbar
2. WHILE in multi-select mode, WHEN the user taps additional attachment cards, THE App SHALL toggle their selection state and update the selection count
3. WHILE in multi-select mode, WHEN the user taps a "Delete Selected" action, THE App SHALL display a confirmation dialog showing the count of selected items
4. WHEN the user confirms bulk deletion, THE App SHALL delete all selected attachments from the server and remove them from the grid display
5. WHEN the user taps the back button or a "Cancel" action while in multi-select mode, THE App SHALL exit multi-select mode and clear all selections
6. IF the Attachments_ViewModel already implements `enterMultiSelectMode`, `toggleSelection`, `exitMultiSelectMode`, and `bulkDelete` with working UI, THEN this requirement is already satisfied and requires only verification (no new code)

### Requirement 3: Checklist Clipboard Operations

**User Story:** As a user, I want to paste multiple lines from my clipboard as checklist items and copy incomplete items to my clipboard, so that I can efficiently bulk-add and share checklist content.

#### Acceptance Criteria

1. WHEN the user taps a "Paste as Items" action in the checklist zone menu, THE App SHALL read the system clipboard text content
2. THE App SHALL split the clipboard text by newlines and create one checklist item per non-empty line, stripping markdown list markers (`- `, `* `, `1. `), checkbox markers (`- [x] `, `- [ ] `), and detecting indent level (4 spaces or 1 tab = 1 level)
3. WHEN clipboard text contains markdown checkbox markers (`- [x]` or `- [X]`), THE App SHALL set the corresponding checklist item's checked state to true; items with `- [ ]` or no checkbox marker SHALL be unchecked
4. THE App SHALL assign parent relationships based on indent levels: an item at level N is a child of the nearest preceding item at level N-1
5. AFTER pasting items, THE App SHALL display an undo toast showing the count of pasted items (e.g., "📋 Pasted 5 items") with an Undo action that reverts to the pre-paste state
6. IF the clipboard is empty or contains only whitespace, THEN THE App SHALL take no action (no toast, no items added)
7. IF clipboard access is denied by the system, THEN THE App SHALL display a toast indicating "Clipboard access denied"
8. WHEN the user taps a "Copy Incomplete" action in the checklist zone menu, THE App SHALL copy all unchecked checklist items to the clipboard as markdown checklist lines formatted as `- [ ] text` with 2-space indentation per nesting level
9. AFTER copying incomplete items, THE App SHALL display a toast showing the count (e.g., "📋 Copied 3 items")
10. IF there are no incomplete (unchecked) items, THEN THE App SHALL display a toast "No incomplete items to copy" and not modify the clipboard

### Requirement 4: Checklist Item Inline Markdown Rendering

**User Story:** As a user, I want my checklist items to render inline markdown formatting (bold, italic, strikethrough, code, links), so that checklist items are visually rich rather than showing raw syntax.

#### Acceptance Criteria

1. WHEN displaying a checklist item's text in the Checklist_Zone (non-editing mode), THE App SHALL render inline markdown: **bold**, *italic*, ~~strikethrough~~, `inline code`, and [links](url)
2. THE App SHALL use the existing Markdown_Renderer or an equivalent inline-only renderer to process checklist item text
3. WHEN a checklist item contains a rendered link, THE App SHALL make the link tappable and open it in the system browser
4. WHEN the user taps a checklist item to edit it, THE App SHALL display the raw markdown text in the edit field (not the rendered version)
5. WHEN the user finishes editing a checklist item, THE App SHALL re-render the inline markdown in the display text
6. THE App SHALL NOT render block-level markdown (headers, code blocks, blockquotes, horizontal rules) within checklist items — only inline formatting
7. THE App SHALL render checklist item markdown identically in all locations where checklist items appear: the editor checklist zone, dashboard checklist cards, Omni View checklist previews, and notebook view

### Requirement 5: Notes Automatic List Continuation

**User Story:** As a user, I want pressing Enter while on a list line in the notes editor to automatically continue the list, so that writing markdown lists is fluid and efficient.

#### Acceptance Criteria

1. WHEN the user presses Enter while the cursor is on a line starting with an unordered list marker (`- `, `* `, `+ `), THE App SHALL insert a new line with the same list marker prefix
2. WHEN the user presses Enter while the cursor is on a line starting with an ordered list marker (`1. `, `2) `, etc.), THE App SHALL insert a new line with the next sequential number and the same delimiter style
3. WHEN the user presses Enter while the cursor is on a line starting with a checkbox marker (`- [ ] `, `- [x] `, `* [ ] `), THE App SHALL insert a new line with an unchecked checkbox marker (`- [ ] `)
4. WHEN the user presses Enter while the cursor is on a line starting with a blockquote marker (`> `), THE App SHALL insert a new line with the same blockquote prefix
5. WHEN the user presses Enter on a list line that contains ONLY the list prefix (no content after the marker), THE App SHALL remove the empty prefix from the current line instead of continuing the list (this ends the list)
6. THE App SHALL preserve the indentation level of the current line when continuing the list (leading spaces/tabs are replicated)
7. WHEN continuing an ordered list, THE App SHALL renumber subsequent ordered list items if they exist below the insertion point

### Requirement 6: Indicator Chart Drag-to-Reorder

**User Story:** As a user, I want to drag indicator charts to reorder them, so that I can arrange my health indicator charts in my preferred viewing order.

#### Acceptance Criteria

1. WHEN the user long-presses an indicator chart card in the Indicators_Screen, THE App SHALL enter drag mode with the card visually lifted (elevation increase, slight opacity reduction)
2. WHILE dragging, THE App SHALL show a drop indicator (line or gap) between other chart cards as the user moves the dragged card over them
3. WHEN the user releases the dragged card over a valid drop position, THE App SHALL reorder the charts to reflect the new position
4. THE App SHALL persist the custom chart order to local storage (SharedPreferences key `cwoc_indicators_chart_order`) as a JSON array of indicator keys
5. WHEN the Indicators_Screen loads, THE App SHALL restore the saved chart order from SharedPreferences and display charts in that order
6. IF no saved order exists, THE App SHALL display charts in the default order (as returned by the indicators data)
7. THE App SHALL support both drag gesture (long-press + move) for reordering on mobile

### Requirement 7: RSVP Status Extraction and Declined Chit Filtering

**User Story:** As a user, I want shared chits I've declined to be visually distinguished or hidden from views, so that I can focus on chits I've accepted or not yet responded to.

#### Acceptance Criteria

1. THE App SHALL provide a utility function that extracts the current user's RSVP status from a chit's `shares` JSON array by matching the current user's ID against share entries
2. IF the current user is found in the shares array, THE function SHALL return their `rsvp_status` value (defaulting to "invited" if the field is null/empty)
3. IF the current user is not found in the shares array OR is the chit owner, THE function SHALL return null (owners don't have RSVP status)
4. THE App SHALL provide a utility function that returns true if the current user has declined a shared chit (RSVP status equals "declined") and false otherwise
5. WHEN the "Show Declined" filter toggle is OFF in the sidebar, THE App SHALL exclude chits where `_isDeclinedByCurrentUser` returns true from all view listings (Calendar, Tasks, Notes, Checklists, Projects, Omni)
6. WHEN a declined chit appears in a view (filter is ON), THE App SHALL display it with reduced opacity (0.5) to visually distinguish it from accepted/pending chits

### Requirement 8: Project Context Menu and Move Child to Project

**User Story:** As a user, I want a context menu on projects with quick actions including moving a child chit to a different project, so that I can manage project membership without opening the full editor.

#### Acceptance Criteria

1. WHEN the user long-presses a project card in the Projects view, THE App SHALL display a context menu with options: "Create New Child Chit", "Open in Editor", "Quick Edit", "Pin/Unpin", "Archive/Unarchive", and snooze options
2. WHEN the user selects "Create New Child Chit", THE App SHALL navigate to the chit editor with the new chit pre-configured as a child of the selected project
3. WHEN the user selects "Open in Editor", THE App SHALL navigate to the chit editor for the project master chit
4. WHEN the user long-presses a child chit card within a project's Kanban board, THE App SHALL include a "Move to Project" option in the context menu
5. WHEN the user selects "Move to Project", THE App SHALL display a list of all other project master chits (excluding the current parent project)
6. WHEN the user selects a target project from the list, THE App SHALL remove the child chit from the current project's `child_chits` array, add it to the target project's `child_chits` array, save both projects to the server, and refresh the Kanban display
7. IF the move operation fails (network error, server error), THEN THE App SHALL display an error toast and revert the local state to the pre-move configuration

### Requirement 9: Contact Editor Save and Stay

**User Story:** As a user, I want a "Save" option in the contact editor that saves my changes without navigating away, so that I can continue editing after saving my progress.

#### Acceptance Criteria

1. THE Contact_Editor_Screen SHALL provide two distinct save actions: "Save" (save and stay) and "Save & Exit" (save and navigate back)
2. WHEN the user taps "Save" (save and stay), THE App SHALL persist the contact to the server via the API, display a success toast ("Contact saved"), clear the dirty/unsaved state, and remain on the contact editor screen
3. WHEN the user taps "Save & Exit", THE App SHALL persist the contact to the server via the API and navigate back to the contacts list (existing behavior)
4. AFTER a successful "Save and Stay", THE App SHALL reset the unsaved-changes tracking so that navigating away no longer triggers an unsaved-changes warning
5. IF the save operation fails, THEN THE App SHALL display an error toast indicating the failure and retain the user on the editor with their changes intact (regardless of which save action was used)
6. THE App SHALL display both save options in the top app bar or bottom action area, clearly distinguishable (e.g., "Save" icon vs "Save & Exit" icon with labels)

### Requirement 10: Attachment Grid Chit Title Display

**User Story:** As a user, I want each attachment card in the attachments grid to show the parent chit's title, so that I can identify which chit an attachment belongs to without opening it.

#### Acceptance Criteria

1. WHEN displaying attachment cards in the Attachments_Screen grid, THE App SHALL show the parent chit's title on each card as a tappable text element
2. THE App SHALL retrieve the parent chit title either from the API response (if the `/api/attachments` endpoint includes it) or by joining against the local chits database
3. WHEN the user taps the chit title on an attachment card, THE App SHALL navigate to the chit editor for that parent chit
4. THE chit title SHALL be displayed below the filename and file size, styled as a secondary text element with a distinct color (e.g., steel-blue #4682B4) to indicate it is tappable
5. IF the parent chit has been deleted (soft-deleted), THE App SHALL display the title in a muted/strikethrough style and disable the tap-to-navigate action
6. IF the parent chit title is unavailable (orphaned attachment), THE App SHALL display "Unknown chit" as placeholder text
