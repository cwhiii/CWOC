# Requirements Document

## Introduction

This spec covers Android parity for Web Function Index items 27–62, spanning three functional blocks: Calendar Drag & Snap (month-view drag, all-day drag, snap grid overlay), Editor Prerequisites (rich display, chit picker, inline status, auto-block, override warning), and Send-Content / Send-Item (copy/move notes or checklist to another chit, per-item quick popup with recent chits, spawn-new-chit). The definition of "complete" is: an end user should not be able to tell if they're using the Android app or the mobile browser version — identical behavior.

## Glossary

- **Chit**: The core data record in CWOC — a flexible item that can serve as a task, note, calendar event, alarm, checklist, or project.
- **Month_View**: The calendar view displaying a grid of day cells for an entire month.
- **All_Day_Row**: The horizontal row at the top of a week/day calendar view showing events marked as all-day.
- **Snap_Grid**: A visual overlay of horizontal lines drawn at snap-interval increments during drag operations, helping users see where events will land.
- **Snap_Minutes**: The user-configured interval (in minutes) to which dragged events snap (loaded from settings as `calendar_snap`).
- **Prerequisites_Zone**: The section of the chit editor that displays and manages prerequisite chits.
- **Auto_Block**: Logic that automatically sets a chit's status to "Blocked" when any prerequisite is not Complete, and reverts to "ToDo" when all prerequisites become Complete.
- **Chit_Picker**: A searchable modal allowing multi-select of chits with checkmarks, used for adding prerequisites.
- **Send_Content**: The feature allowing copy or move of an entire notes field or checklist from one chit to another.
- **Send_Item**: The feature allowing copy or move of a single checklist item (plus its children) to another chit or a new chit.
- **Undo_Bar**: A countdown bar (8 seconds) shown after send operations, allowing the user to reverse the action.
- **Undo_Toast**: A brief countdown notification (8 seconds) with an Undo button, used for send-item move operations.
- **Quick_Popup**: A small popup anchored near a checklist item showing the 3 most recently modified chits for fast send-item targeting.
- **Viewer_Role**: A permission level on shared chits that prevents editing; drag operations are blocked for viewer-role chits.
- **Contrast_Color**: A computed text color (dark or light) chosen based on background luminance to ensure readability.
- **Circular_Dependency**: A state where chit A requires chit B which (directly or transitively) requires chit A, forming an invalid loop.

## Requirements

### Requirement 1: Month View Drag to Reschedule

**User Story:** As a user, I want to long-press-and-drag a chit event from one day cell to another in the month calendar view, so that I can quickly reschedule it without opening the editor.

#### Acceptance Criteria

1. WHEN a user initiates a long-press-and-drag on a chit event chip in the Month_View, THE Month_View SHALL begin a drag operation, reducing the dragged element's opacity to 0.4.
2. WHILE a drag operation is active, THE Month_View SHALL highlight valid drop-target day cells as the user's finger moves over them.
3. WHEN the user drops a chit onto a target day cell, THE Month_View SHALL compute the day difference between the source date and the target date.
4. WHEN a non-recurring chit is dropped on a target day, THE Month_View SHALL shift the chit's `due_datetime` (for due-only chits) or both `start_datetime` and `end_datetime` (for start/end chits) by the computed day difference, preserving the original time-of-day and duration.
5. WHEN a non-recurring chit is dropped, THE Month_View SHALL save the updated chit via `PUT /api/chits/{id}` and refresh the calendar display.
6. WHEN a recurring virtual instance is dropped on a target day, THE Month_View SHALL show a recurring-drag modal with options: "This instance only," "All in series," and "All following," matching the same modal used in week-view drag.
7. IF the chit has viewer-role permissions (`_isViewerRole`), THEN THE Month_View SHALL prevent drag initiation on that chit.
8. IF the chit is a birthday event, THEN THE Month_View SHALL prevent drag initiation on that chit.

### Requirement 2: All-Day Row Drag to Reschedule

**User Story:** As a user, I want to long-press-and-drag an all-day event between day columns in the week/day view's all-day row, so that I can reschedule all-day events quickly.

#### Acceptance Criteria

1. WHEN a user initiates a long-press-and-drag on an all-day event in the All_Day_Row, THE All_Day_Row SHALL begin a drag operation, reducing the dragged element's opacity to 0.4.
2. WHILE a drag operation is active, THE All_Day_Row SHALL calculate the target day column based on the user's horizontal finger position relative to the row width and number of visible day columns.
3. WHEN the user drops an all-day event onto a target day column, THE All_Day_Row SHALL compute the day difference and shift the chit's dates by that difference.
4. WHEN an all-day event is dropped, THE All_Day_Row SHALL save the updated chit via `PUT /api/chits/{id}` and refresh the calendar display.
5. IF the chit has viewer-role permissions, THEN THE All_Day_Row SHALL prevent drag initiation on that chit.
6. IF the chit is a birthday event, THEN THE All_Day_Row SHALL prevent drag initiation on that chit.

### Requirement 3: Snap Grid Visual Overlay

**User Story:** As a user, I want to see faint horizontal grid lines at snap intervals during calendar drag operations, so that I can visually predict where my event will land.

#### Acceptance Criteria

1. WHEN a drag operation begins its first actual movement (not on initial touch), THE Snap_Grid SHALL appear as a semi-transparent overlay covering the full day height (1440 logical units representing minutes).
2. THE Snap_Grid SHALL draw a horizontal line every Snap_Minutes minutes, styled as a 1px line with color `rgba(139, 90, 43, 0.15)`.
3. THE Snap_Grid SHALL display time labels at every hour boundary, or at every snap interval if Snap_Minutes is 30 or greater, styled at font-size 0.65em with color `rgba(139, 90, 43, 0.35)`.
4. WHEN the drag operation ends (finger lifted), THE Snap_Grid SHALL be removed from the display.
5. IF Snap_Minutes is 1 or less (no snapping), THEN THE Snap_Grid SHALL not be shown.
6. WHEN the user drags an event across day columns, THE Snap_Grid SHALL reposition to the new target column.

### Requirement 4: Prerequisites Zone Rich Display

**User Story:** As a user, I want to see my prerequisite chits displayed with their title, color, and status instead of raw IDs, so that I can understand my dependencies at a glance.

#### Acceptance Criteria

1. WHEN the chit editor loads a chit with prerequisites, THE Prerequisites_Zone SHALL fetch full chit data for each prerequisite ID via `GET /api/chits`.
2. THE Prerequisites_Zone SHALL render each prerequisite as a list item showing: the chit's color as full background, the chit's title as text, an inline status indicator, and a remove button.
3. THE Prerequisites_Zone SHALL compute text color using Contrast_Color logic: if background luminance (0.299*R + 0.587*G + 0.114*B)/255 exceeds 0.55, use dark text (`#1a1208`); otherwise use light text (`#fffaf0`).
4. IF a prerequisite chit has been deleted (not found in the fetched data), THEN THE Prerequisites_Zone SHALL display "(deleted)" for that entry.
5. IF a prerequisite chit has no color or color is "transparent", THEN THE Prerequisites_Zone SHALL use `#e8dcc8` as the default background.
6. WHEN a user double-taps a prerequisite item, THE Prerequisites_Zone SHALL navigate to that prerequisite's editor, showing the standard Save/Discard/Cancel dialog if unsaved changes exist.

### Requirement 5: Prerequisite Chit Picker

**User Story:** As a user, I want a searchable chit picker to add prerequisites, so that I don't have to manually type chit IDs.

#### Acceptance Criteria

1. WHEN the user taps "Add Prerequisite," THE Prerequisites_Zone SHALL open a Chit_Picker modal with multi-select checkmarks.
2. THE Chit_Picker SHALL exclude the current chit and all project master chits from the selectable list.
3. THE Chit_Picker SHALL show already-selected prerequisites as disabled (non-selectable) entries.
4. WHEN the user selects a chit, THE Chit_Picker SHALL perform a circular dependency check via `POST /api/chits/check-prerequisites` with `{chit_id, prerequisite_id}`.
5. IF the circular dependency check returns `{circular: true}`, THEN THE Chit_Picker SHALL show an error toast "Cannot add: would create a circular dependency" and prevent the selection.
6. WHEN the user confirms the selection, THE Prerequisites_Zone SHALL warn (via toast) about any selected chits that have no status, stating they "can never unblock."
7. WHEN prerequisites are added, THE Prerequisites_Zone SHALL mark the editor as having unsaved changes and re-evaluate auto-block logic.

### Requirement 6: Prerequisite Inline Status Change

**User Story:** As a user, I want to change a prerequisite's status directly from the prerequisites list without opening its editor, so that I can quickly unblock my work.

#### Acceptance Criteria

1. THE Prerequisites_Zone SHALL display an inline status dropdown for each prerequisite with options: — (none), ToDo, In Progress, Blocked, Complete.
2. WHEN the user changes a prerequisite's status via the dropdown, THE Prerequisites_Zone SHALL save the new status via `PATCH /api/chits/{id}/fields` with `{status: newValue}`.
3. WHEN the status update succeeds, THE Prerequisites_Zone SHALL update the local cache, show an info toast "Prerequisite status updated," re-evaluate auto-block logic, and re-evaluate auto-complete checklist logic.
4. IF the status update fails, THEN THE Prerequisites_Zone SHALL show an error toast "Failed to update prerequisite status."

### Requirement 7: Prerequisite Auto-Block Logic

**User Story:** As a user, I want my chit to automatically become "Blocked" when any prerequisite is incomplete, and automatically revert to "ToDo" when all prerequisites are complete, so that my status always reflects reality.

#### Acceptance Criteria

1. WHEN any prerequisite's status is not "Complete" and the current chit's status is not already "Blocked," THE Auto_Block SHALL set the current chit's status to "Blocked," show an info toast "Status set to Blocked — prerequisites incomplete," and mark the editor as having unsaved changes.
2. WHEN all prerequisites' statuses become "Complete" and the current chit's status is "Blocked" due to auto-block, THE Auto_Block SHALL set the current chit's status to "ToDo," show an info toast "All prerequisites complete — status set to To Do," and mark the editor as having unsaved changes.
3. WHEN all prerequisites are removed and the current chit's status is "Blocked" due to auto-block, THE Auto_Block SHALL set the current chit's status to "ToDo," show an info toast "Prerequisites cleared — status set to To Do," and mark the editor as having unsaved changes.
4. THE Auto_Block SHALL track whether the current blocked state was caused by auto-block (via a flag `_prereqAutoBlocked`) to distinguish from manual blocking.

### Requirement 8: Prerequisite Status Override Warning

**User Story:** As a user, I want to be warned when I manually change my chit's status away from "Blocked" while prerequisites are incomplete, so that I understand the implications.

#### Acceptance Criteria

1. WHEN the user manually changes the chit's status and prerequisites exist with incomplete statuses, THE Prerequisites_Zone SHALL show a confirmation dialog: "This chit has incomplete prerequisites. Changing status away from 'Blocked' may cause inconsistency. Proceed anyway?"
2. IF the user confirms the override, THEN THE Prerequisites_Zone SHALL set `_prereqAutoBlocked = false`, disabling further auto-block for this editing session.
3. IF the user cancels the override, THEN THE Prerequisites_Zone SHALL revert the status dropdown to its previous value.
4. WHEN the user changes status TO "Blocked" (regardless of prerequisites), THE Prerequisites_Zone SHALL allow the change without warning.
5. WHEN no prerequisites exist or all prerequisites are complete, THE Prerequisites_Zone SHALL allow any status change without warning.

### Requirement 9: Send Notes Content

**User Story:** As a user, I want to copy or move my chit's notes content to another chit, so that I can reorganize my information across chits.

#### Acceptance Criteria

1. THE Send_Content feature SHALL provide a "Send to..." button in the Notes zone header.
2. WHEN the user taps "Send to..." for notes, THE Send_Content SHALL validate that notes content exists; IF notes are empty, THEN it SHALL show an info toast "No notes content to send" and not open the modal.
3. WHEN the modal opens, THE Send_Content SHALL display a search input with debounced search-as-you-type (300ms delay), a "Go" button, operator help text (&&, ||, !, (), #tag), and a table of chits with radio-select showing Title, Due, and Status columns.
4. THE Send_Content SHALL search via `GET /api/chits/search?q={term}` and exclude the current chit and deleted chits from results.
5. WHEN no search term is entered, THE Send_Content SHALL display all available chits sorted alphabetically, excluding the current chit.
6. THE Send_Content modal footer SHALL show: the selected chit's name, a Cancel button, a Copy (📋) button, and a Move (📤) button. Copy and Move buttons SHALL be disabled until a chit is selected.
7. WHEN the user taps Copy, THE Send_Content SHALL append the source notes to the target chit's note field separated by a double newline, without clearing the source.
8. WHEN the user taps Move, THE Send_Content SHALL append the source notes to the target chit's note field separated by a double newline, AND clear the source notes field.
9. WHEN ESC is pressed with text in the search field, THE Send_Content SHALL clear the search field and reset the list. WHEN ESC is pressed with an empty search field, THE Send_Content SHALL close the modal.
10. WHEN the user taps outside the modal overlay, THE Send_Content SHALL close the modal.

### Requirement 10: Send Checklist Content

**User Story:** As a user, I want to copy or move my chit's entire checklist to another chit, so that I can reorganize checklist items across chits.

#### Acceptance Criteria

1. THE Send_Content feature SHALL provide a "Send to Chit" action in the checklist zone menu.
2. WHEN the user taps "Send to Chit" for checklist, THE Send_Content SHALL validate that checklist items exist; IF the checklist is empty, THEN it SHALL show an info toast "No checklist items to send" and not open the modal.
3. WHEN Copy is executed for checklist, THE Send_Content SHALL append all checklist items to the target chit's checklist with new unique IDs, levels normalized so the minimum level becomes 0, and parent IDs remapped to the new IDs.
4. WHEN Move is executed for checklist, THE Send_Content SHALL append items to the target (same as copy) AND clear the source checklist.
5. THE Send_Content SHALL save the target chit via `PUT /api/chits/{id}` after appending content.

### Requirement 11: Send Content Undo Bar

**User Story:** As a user, I want an undo option after sending content, so that I can reverse accidental sends.

#### Acceptance Criteria

1. WHEN a send-content operation completes successfully, THE Undo_Bar SHALL appear below the zone header showing: an action label ("📤 Copied/Moved notes/checklist → {target title}"), an Undo button, and a countdown progress bar.
2. THE Undo_Bar SHALL auto-dismiss after 8 seconds with a visible progress bar shrinking from 100% to 0%.
3. WHEN the user taps Undo within the countdown, THE Undo_Bar SHALL restore the target chit's original content (notes or checklist) via `PUT /api/chits/{id}`.
4. WHEN Undo is executed for a Move operation, THE Undo_Bar SHALL also restore the source content (notes field or checklist items) to their original state.
5. WHEN Undo completes successfully, THE Undo_Bar SHALL show a success toast "Undone!" and dismiss itself.

### Requirement 12: Send Item Quick Popup

**User Story:** As a user, I want a quick popup near each checklist item showing my 3 most recently edited chits, so that I can send items to common targets without searching.

#### Acceptance Criteria

1. WHEN the user taps the send icon on a checklist item, THE Quick_Popup SHALL appear anchored near the tapped element (positioned from the right to prevent overflow).
2. THE Quick_Popup SHALL display: a "New Chit" option at the top, the 3 most recently modified chits (sorted by `modified_datetime` descending, titles truncated to 30 characters), and a "Search..." button at the bottom.
3. Each recent chit row SHALL show the chit title, a Copy (📋) button, and a Move (📤) button.
4. THE Quick_Popup SHALL pre-fetch the chit list in the background with a 2-minute cache TTL, so the popup opens instantly.
5. WHEN the user taps outside the popup, THE Quick_Popup SHALL close.
6. WHEN the user taps ESC, THE Quick_Popup SHALL close.
7. IF the popup would overflow the bottom of the screen, THEN THE Quick_Popup SHALL reposition upward to remain fully visible.

### Requirement 13: Send Item New Chit (Spawn)

**User Story:** As a user, I want to create a brand new chit from a checklist item, so that I can promote items into their own standalone chits.

#### Acceptance Criteria

1. WHEN the user taps "New Chit" in the Quick_Popup, THE Quick_Popup SHALL reveal Move and Copy buttons for the new-chit action.
2. WHEN the user taps Move for new chit, THE Send_Item SHALL store the item and its children (with levels demoted so the item becomes level 0 and new unique IDs) in temporary storage, remove the items from the source checklist, and navigate to the editor with a prefill parameter.
3. WHEN the user taps Copy for new chit, THE Send_Item SHALL store the item and its children in temporary storage (without removing from source) and navigate to the editor with a prefill parameter.
4. IF the current chit has unsaved changes before navigation, THEN THE Send_Item SHALL show the standard Save/Discard/Cancel dialog. Save saves then navigates; Discard discards then navigates; Cancel stays on the current page and removes the prefill data.

### Requirement 14: Send Item to Existing Chit

**User Story:** As a user, I want to copy or move a checklist item (and its children) to an existing chit, so that I can reorganize individual items.

#### Acceptance Criteria

1. WHEN the user taps Copy on a recent chit or search result, THE Send_Item SHALL append the item and all its children to the target chit's checklist with new unique IDs, levels demoted so the sent item becomes level 0, and parent IDs remapped.
2. WHEN the user taps Move on a recent chit or search result, THE Send_Item SHALL append items to the target (same as copy) AND remove the item and its children from the source checklist.
3. THE Send_Item SHALL save the target chit via `PUT /api/chits/{id}` after appending items.
4. WHEN a Copy completes, THE Send_Item SHALL show a success toast "Copied {N} item(s) to '{target title}'."
5. WHEN a Move completes, THE Send_Item SHALL show an Undo_Toast with 8-second countdown. Tapping Undo SHALL restore items to the source checklist at their original position and remove them from the target chit.
6. WHEN Undo is executed, THE Send_Item SHALL restore items to the source at the original index position and save the target chit with items removed.

### Requirement 15: Send Item Search Modal

**User Story:** As a user, I want a full search modal for send-item when my target isn't in the recent chits list, so that I can find any chit to send to.

#### Acceptance Criteria

1. WHEN the user taps "Search..." in the Quick_Popup, THE Send_Item SHALL close the popup and open a full search modal with the same layout as the send-content modal (search input, Go button, operator help, radio-select table with Title/Due/Status columns).
2. THE search modal SHALL include a "New" button in the footer that expands to reveal Move and Copy buttons for spawning a new chit.
3. THE search modal footer SHALL show: New button group, selected chit name, Cancel, Copy (📋), and Move (📤) buttons.
4. WHEN the user presses Enter with a chit selected, THE Send_Item SHALL execute a Move (default action) to the selected chit.
5. WHEN ESC is pressed with text in the search field, THE Send_Item SHALL clear the search. WHEN ESC is pressed with an empty search field, THE Send_Item SHALL close the modal.
6. THE search modal SHALL use `GET /api/chits/search?q={term}` for searching, excluding the current chit and deleted chits.

### Requirement 16: Send Item Visual Feedback

**User Story:** As a user, I want visual feedback when an item is added to a target chit's checklist, so that I have confirmation the action succeeded.

#### Acceptance Criteria

1. WHEN a checklist item is successfully sent (copy or move) to a target chit, THE Send_Item SHALL display a brief arrow animation (flash) on the checklist zone as visual confirmation.
2. THE arrow animation SHALL use CSS class-based transitions (add class, remove after animation completes) rather than inline style manipulation.
