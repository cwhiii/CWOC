# Requirements Document

## Introduction

The Android app's Tasks view must achieve pixel-perfect visual and behavioral parity with the mobile browser version (≤480px viewport) as documented in `Tasks/mobile-browser-tasks-view-spec.md`. A user must not be able to distinguish whether they are viewing the native Android app or the mobile browser. This covers the page shell, header, Views panel, sidebar overlay, task card structure, touch gesture system, sorting, filtering, sub-modes, empty states, visual indicators, color system, animations, typography, accessibility, and data flow.

## Glossary

- **Tasks_View**: The Android Compose screen that renders the Tasks zone content area with task cards
- **Page_Shell**: The fixed header bar containing hamburger, logo, title, profile, and Views button
- **Views_Panel**: The slide-in panel from the right edge that provides tab navigation between zones
- **Sidebar**: The full-width overlay from the left edge containing filters, sort controls, mode toggle, and action buttons
- **Task_Card**: A Compose component rendering a single chit with header row, status controls, note preview, and optional map thumbnail
- **Status_Dropdown**: An interactive selector on each task card allowing the user to change chit status
- **Touch_Gesture_System**: The unified gesture handler implementing 400ms drag activation and 1200ms long-press detection
- **Sort_Controller**: The component managing sort field selection, direction toggle, and persistence
- **Filter_Controller**: The component managing status, priority, tag, people, project, text search, and display toggle filters
- **Mode_Toggle**: The three-button toggle in the sidebar switching between Tasks, Habits, and Assigned sub-modes
- **Quick_Edit_Modal**: The modal dialog triggered by long-press allowing rapid field editing without navigating to the editor
- **Drag_Placeholder**: A dashed-border visual element indicating the insertion point during drag-to-reorder
- **Manual_Order**: The user-defined card sequence persisted locally and to the server after drag-to-reorder
- **Parchment_Theme**: The 1940s-inspired visual theme using warm browns, parchment textures, and Lora serif font
- **Chit_Repository**: The local Room database and API layer providing chit data to the Tasks_View
- **Settings_Repository**: The repository providing user preferences including sort, filter, and display settings

## Requirements

### Requirement 1: Page Shell and Fixed Header

**User Story:** As a user, I want the Tasks view header to look and behave identically to the mobile browser version, so that the native app feels indistinguishable from the web.

#### Acceptance Criteria

1. THE Page_Shell SHALL render a fixed header bar at the top of the viewport with flex-row layout, 4px vertical padding, 8px horizontal padding, 4px gap between elements, and background color `#e0d4b5`
2. THE Page_Shell SHALL display elements in this exact order from left to right: hamburger button (32×32px, background `#8b5a2b`, white `☰` character, 4px border-radius, 1px solid `#5a3f2a` border), logo image (32×32px, the CWOC logo), title text ("Omni Chits" at 1em font-size), profile image button (32×32px avatar, pushed to the right via flex spacing), and Views button (padding 6px 12px, min-height 36px, background `#8b5a2b`, color `#fff8e1`, 3px border-radius, bold Lora font at 0.9em, displaying "☰ Tasks" text)
3. WHEN the user taps the hamburger button or the logo, THE Page_Shell SHALL call the sidebar toggle function to open or close the Sidebar
4. WHEN the user taps the Views button, THE Page_Shell SHALL open the Views_Panel
5. THE Page_Shell SHALL hide the desktop tab bar completely (equivalent to `display: none`)
6. THE Page_Shell SHALL hide the top bar date range display completely

### Requirement 2: Views Panel

**User Story:** As a user, I want a slide-in panel from the right that lets me switch between zones, so that I can navigate the app the same way I do in the mobile browser.

#### Acceptance Criteria

1. WHEN the Views_Panel is closed, THE Views_Panel SHALL be positioned off-screen to the right (260px beyond the right edge)
2. WHEN the Views_Panel is opened, THE Views_Panel SHALL animate to position right=0 over 250 milliseconds with ease timing, displaying at 240px width, full viewport height, with parchment background texture, a 2px solid `#8b4513` left border, and a box shadow of `-4px 0 16px rgba(0, 0, 0, 0.2)`
3. WHEN the Views_Panel is open, THE Views_Panel SHALL display a semi-transparent backdrop (rgba(0, 0, 0, 0.4)) covering the full viewport behind the panel, and tapping the backdrop SHALL close the panel
4. THE Views_Panel SHALL display a "Views" header (1.1em font, color `#4a2c2a`, centered, with a 1px solid `#a0522d` bottom border and 6px bottom padding)
5. THE Views_Panel SHALL display view options as a vertical list, each option showing a tab icon (1.8em height) and label text in a flex row with 8px gap, 10px 12px padding, 4px margin, 4px border-radius, bold Lora font at 1em, color `#4a2c2a`, background `#fdf5e6`, 1px solid `#a0522d` border, and minimum 44px height
6. THE Views_Panel SHALL visually distinguish the active tab option with ivory background, `#8b4513` border color, and 2px border width
7. THE Views_Panel SHALL list these tab options in order: Calendar, Checklists, Tasks, Projects, Notes, Email, Indicators, Alerts, Search
8. THE Views_Panel SHALL display a close button at the bottom (full width, 8px padding, bold text "⇤ Hide Sidebar", background `#a0522d`, color `#fff8e1`, 1px solid `#4a2c2a` border, 4px border-radius, minimum 44px height, Lora font)
9. WHEN the user swipes left from the right edge of the screen (within a 25px zone) with horizontal distance exceeding 40px and exceeding vertical distance, THE Views_Panel SHALL open, provided the Sidebar is not currently open
10. WHEN the user swipes right while the Views_Panel is open with horizontal distance exceeding 40px and exceeding vertical distance, THE Views_Panel SHALL close
11. WHEN the user taps a view option, THE Views_Panel SHALL navigate to the corresponding zone and close the panel

### Requirement 3: Sidebar Overlay

**User Story:** As a user, I want a full-width sidebar overlay with filters, sort controls, and mode toggle that matches the mobile browser version, so that I can control what tasks I see.

#### Acceptance Criteria

1. WHEN the Sidebar is closed, THE Sidebar SHALL be positioned off-screen to the left (110% of viewport width beyond the left edge)
2. WHEN the Sidebar is opened, THE Sidebar SHALL animate to position left=0 over 300 milliseconds with ease timing, displaying at 100% viewport width, full viewport height, with parchment background texture, flex column layout, and 10px padding
3. WHEN the Sidebar is open, THE Sidebar SHALL display a semi-transparent backdrop (rgba(0, 0, 0, 0.4)) behind the sidebar, and tapping the backdrop SHALL close the sidebar
4. THE Sidebar SHALL display a sticky close button at the top (full width, 10px padding, 10px bottom margin, background `#8b4513`, color `#fff8e1`, 1px solid `#5a3f2a` border, 3px border-radius, bold Lora font at 1em, minimum 44px height, text "⇤ Hide Sidebar")
5. THE Sidebar SHALL always start in the closed state on page load
6. WHEN the user swipes right from the left edge of the screen (within a 30px zone) with horizontal distance exceeding 50px and exceeding vertical distance, THE Sidebar SHALL open, provided the Views_Panel is not currently open
7. WHEN the user swipes left while the Sidebar is open with horizontal distance exceeding 50px and exceeding vertical distance, THE Sidebar SHALL close
8. WHILE the Tasks zone is active, THE Sidebar SHALL display these sections in order: Create Chit button (full-width action button), Mode_Toggle (Tasks/Habits/Assigned), Sort Controls (sort field dropdown and direction button), Filters Section (collapsible, containing all filter controls), and a bottom-pinned section with Settings, Help, Contacts, Clock, Weather, and Calculator buttons

### Requirement 4: Task Card Structure

**User Story:** As a user, I want each task card to display the exact same information layout as the mobile browser version, so that I can read and interact with tasks identically.

#### Acceptance Criteria

1. EACH Task_Card SHALL render as a full-width container with 4px vertical margin, 10px padding, 2px solid `#8b5a2b` border, 6px border-radius, Lora font family, 0.9em font-size, color `#2b1e0f`, 1.5 line-height, and background color from the chit's color setting (default `#fdf6e3`)
2. EACH Task_Card SHALL display a header row in column layout on mobile containing a left section (full width, flex row, bold 1em font, 0.4em gap) stacked above a meta section (full width, wrapped flex row, 4px gap, 0.78em font-size, 0.85 opacity)
3. THE Task_Card left section SHALL display these elements in order where applicable: pinned bookmark icon (0.85em, 0.7 opacity), archived icon (📦), snoozed icon (😴), timezone warning (⚠️), stealth icon (🥷), sub-chit project-diagram icon (0.75em, 0.6 opacity), visual indicator emojis (🛎️🔔📢⏱️⏲️👥❤️📊🎯🔁📎), weather indicator emoji, and title text as a tappable link with word-break wrapping
4. THE Task_Card meta section SHALL display these elements in order where applicable: priority text, due date (with overdue styling: background `#b22222`, bold, contrast text color, 1px 6px padding, 3px border-radius, prefixed "Past Due:"), start date, point-in-time date (📌 prefix), updated date, created date, colored tag chips (inline-block, 1px 6px padding, 4px border-radius, 0.75em font-size), RSVP indicators, shared icon (🔗), and assignee badge (📌 name, green italic)
5. THE Task_Card meta section SHALL NOT display the status field (status is shown only in the controls row below)
6. WHEN a sort field is active, THE Task_Card SHALL render the corresponding date or field value in bold with an appended sort direction arrow (▲ or ▼)

### Requirement 5: Task Card Controls Row

**User Story:** As a user, I want the status controls and note preview on each card to match the mobile browser layout, so that I can change status and read notes without opening the editor.

#### Acceptance Criteria

1. EACH Task_Card SHALL display a controls row below the header, rendered in column layout on mobile (stacked vertically with 6px gap), with background rgba(0, 0, 0, 0.04), 3px border-radius, 0.3em 0.5em padding
2. THE controls row SHALL display a status wrapper containing: a status icon (Font Awesome icon colored per status — ToDo: brown circle, In Progress: orange spinner, Blocked: red ban, Complete: green check-circle, Rejected: gray times-circle, all at 0.85em), a "Status:" text label, and a Status_Dropdown select element with minimum 36px height and 14px font-size
3. THE Status_Dropdown SHALL offer options: ToDo, In Progress, Blocked, Complete, Rejected
4. WHEN a chit has incomplete prerequisites, THE Status_Dropdown SHALL display the Blocked option text as "Blocked ⛓️"
5. WHEN the Status_Dropdown value is Blocked, THE Status_Dropdown SHALL display with the configured blocked border color background (default `#DAA520`), contrast text color, 2px solid border, and bold font
6. WHEN the Status_Dropdown value is Complete, THE Status_Dropdown SHALL display with 0.6 opacity
7. WHEN the Status_Dropdown value is Rejected, THE Status_Dropdown SHALL display with color `#9E9E9E` and 0.6 opacity
8. WHEN the chit is shared with viewer role, THE Status_Dropdown SHALL be disabled with title text "Read-only — shared chit"
9. WHEN the user changes the Status_Dropdown value, THE Task_Card SHALL send a PUT request to `/api/chits/{id}` with the updated status and refresh the task list on success
10. WHEN the chit has a non-empty note field, THE controls row SHALL display a note preview below the status wrapper showing rendered markdown (first 500 characters), with 0.75 opacity, max-height 4.5em (approximately 3 lines), 1.4em line-height, and overflow hidden
11. THE note preview SHALL include a "show more…" / "show less" toggle button (0.8em font, color `#8b5a2b`, italic, right-aligned) that expands or collapses the note content

### Requirement 6: Task Card Visual States

**User Story:** As a user, I want task cards to visually indicate their state (completed, archived, dragging) the same way the mobile browser does, so that I can quickly scan card status.

#### Acceptance Criteria

1. WHEN a chit has status Complete or Rejected, THE Task_Card SHALL render with 0.5 opacity
2. WHEN a chit is archived, THE Task_Card SHALL render with 0.45 opacity, increasing to 0.7 on hover or press
3. WHEN a chit has RSVP status Declined, THE Task_Card SHALL render with 0.35 opacity, increasing to 0.7 on hover or press
4. WHILE a Task_Card is being touch-dragged, THE Task_Card SHALL render with 0.7 opacity, scale 1.04 transform, box shadow `0 6px 24px rgba(107,66,38,0.45)`, 2px dashed `#a0522d` outline, and a pulsing outline animation alternating between `#a0522d` and `#d2691e` over 1 second
5. WHEN a Task_Card is tapped (pressed and released), THE Task_Card SHALL display a hover-equivalent state with border color `#a0522d` and box shadow `0 2px 8px rgba(107, 66, 38, 0.15)`

### Requirement 7: Map Thumbnail

**User Story:** As a user, I want to see map thumbnails on location-bearing tasks exactly as in the mobile browser, so that I can visually identify where tasks are located.

#### Acceptance Criteria

1. WHEN a chit has a non-default location and the `show_map_thumbnails` setting is not disabled, THE Task_Card SHALL display a map thumbnail below the controls row with 90px width, 60px height, 4px border-radius, 1px solid rgba(139, 90, 43, 0.3) border, 0.4em top margin, aligned to the right, background `#f5ebe0`
2. THE map thumbnail SHALL display an OpenStreetMap tile image with a pin overlay centered on the chit's location coordinates
3. WHEN the user double-taps the map thumbnail, THE Task_Card SHALL navigate to the maps view focused on that chit's location

### Requirement 8: Touch Gesture System

**User Story:** As a user, I want the same sequential touch gesture system as the mobile browser (400ms drag, 1200ms long-press), so that drag-to-reorder and quick-edit work identically.

#### Acceptance Criteria

1. WHEN the user touches a Task_Card and holds for 400 milliseconds without moving more than 10px, THE Touch_Gesture_System SHALL activate drag mode with a 30ms haptic vibration
2. WHEN the user moves their finger more than 10px within the first 400 milliseconds of touching a Task_Card, THE Touch_Gesture_System SHALL cancel all gesture detection and allow normal scrolling
3. WHILE drag mode is active and the user moves their finger, THE Touch_Gesture_System SHALL permanently cancel long-press detection for that touch sequence
4. WHEN the user holds a Task_Card perfectly still from the 400ms drag activation point until 1200ms total hold time, THE Touch_Gesture_System SHALL fire a long-press event with a double haptic vibration pattern (30ms vibrate, 50ms pause, 30ms vibrate) and cancel drag mode
5. WHEN drag mode activates, THE Touch_Gesture_System SHALL position the card fixed under the user's finger with 0.9 opacity and elevated shadow, insert a Drag_Placeholder (dashed 2px `#8b5a2b` border, 6px border-radius, rgba(139,90,43,0.08) background) at the card's original position, and prevent pull-to-refresh
6. WHILE dragging, THE Touch_Gesture_System SHALL move the card to follow the user's finger and reposition the Drag_Placeholder to the insertion point based on finger Y position relative to other cards
7. WHILE dragging and the user's finger is within 50px of the container top or bottom edge, THE Touch_Gesture_System SHALL auto-scroll the container at 8px per frame in the corresponding direction
8. WHEN the user lifts their finger after dragging, THE Touch_Gesture_System SHALL return the card to normal flow, remove the placeholder, read the new order from the card positions, save the manual order locally and to the server, switch sort to "manual", and re-render the view
9. WHEN a long-press fires on a non-viewer-role chit, THE Touch_Gesture_System SHALL open the Quick_Edit_Modal for that chit
10. WHEN a long-press fires on a viewer-role chit, THE Touch_Gesture_System SHALL take no action
11. FOR 300 milliseconds after any drag ends, THE Touch_Gesture_System SHALL suppress click and double-click events on Task_Card elements to prevent accidental navigation

### Requirement 9: Sorting

**User Story:** As a user, I want the same sort options and default sort behavior as the mobile browser, so that my tasks appear in the same order on both platforms.

#### Acceptance Criteria

1. WHEN no sort field is selected, THE Tasks_View SHALL sort tasks by status order: ToDo (1), In Progress (2), Blocked (3), empty/no status (4), Complete (5), Rejected (6)
2. THE Sort_Controller SHALL provide these sort field options in the sidebar dropdown: Title, Start Date, Due Date, Updated, Created, Status, Manual, Random, Upcoming
3. THE Sort_Controller SHALL display a direction toggle button showing ▲ (ascending) or ▼ (descending) that toggles between ascending and descending sort on tap
4. WHEN the sort field is Manual, Random, or Upcoming, THE Sort_Controller SHALL hide the direction toggle button
5. WHEN the user performs a drag-to-reorder, THE Sort_Controller SHALL automatically switch the sort field to "manual" and persist the preference
6. THE Sort_Controller SHALL persist sort preferences per-tab to local storage and to the server via `PUT /api/sort-preferences/Tasks`
7. WHEN the Tasks_View loads, THE Sort_Controller SHALL restore sort preferences from the server via `GET /api/sort-preferences` (server is source of truth), falling back to local storage if the server is unreachable

### Requirement 10: Filtering

**User Story:** As a user, I want the same filter controls and behavior as the mobile browser, so that I can narrow down my task list identically on both platforms.

#### Acceptance Criteria

1. THE Filter_Controller SHALL include a chit in the Tasks view if the chit has a status field (any value) OR a due_datetime field
2. THE Filter_Controller SHALL provide these filter controls in the sidebar: status multi-select checkboxes, priority multi-select checkboxes, tag filter (chip-based with search input, favorites shown first, colored dots matching tag colors, "Any Tag" and "Tagless" virtual buttons), people filter (chip-based with profile images), project filter dropdown, text search input filtering across title, notes, and tags
3. THE Filter_Controller SHALL provide these display toggle checkboxes: Show Pinned, Show Archived, Show Snoozed, Show Unmarked, Show Past Due, Show Complete, Show Declined, Show Habits, Highlight Overdue, Highlight Blocked, Shared With Me, Shared By Me
4. THE Filter_Controller SHALL provide a "Clear All Filters" button (background `#a0522d`, color `#fff8e1`, 0.85em font-size, 32px height) that resets all filter controls to defaults and re-renders the task list
5. THE Filter_Controller SHALL apply all active filters before rendering the task list, combining them with AND logic (a chit must pass all active filters to appear)

### Requirement 11: Sub-Modes (Tasks, Habits, Assigned)

**User Story:** As a user, I want the same three sub-mode toggle as the mobile browser, so that I can switch between Tasks, Habits, and Assigned views.

#### Acceptance Criteria

1. THE Mode_Toggle SHALL display three buttons in the sidebar labeled "📋 Tasks", "🎯 Habits", and "📌 Assigned", with the active button styled with ivory background and color `#3b1f0a`, and inactive buttons using default button styling
2. WHEN the user taps the Tasks button, THE Tasks_View SHALL render all chits with status or due_datetime using the standard task card layout
3. WHEN the user taps the Habits button, THE Tasks_View SHALL render habit-type chits with recurrence tracking using the habits renderer
4. WHEN the user taps the Assigned button, THE Tasks_View SHALL render only chits where assigned_to equals the current user's user_id, using the same card structure and default status sort as Tasks mode
5. THE Mode_Toggle SHALL persist the selected mode to local storage under key `cwoc_tasksViewMode`
6. WHEN the Tasks_View loads, THE Mode_Toggle SHALL restore the previously selected mode from local storage
7. WHEN the Assigned mode is active and no chits are assigned to the user, THE Tasks_View SHALL display the empty state "No chits assigned to you."

### Requirement 12: Empty State

**User Story:** As a user, I want to see the same empty state message and create button as the mobile browser when no tasks match my filters.

#### Acceptance Criteria

1. WHEN no tasks match the current filters in Tasks or Habits mode, THE Tasks_View SHALL display a centered empty state with 0.7 opacity, 2em top/bottom padding, 1em horizontal padding, containing the text "No tasks found." at 1.1em font-size with 0.8em bottom margin, and a "+ Create Chit" button that navigates to the editor
2. WHEN no tasks match in Assigned mode, THE Tasks_View SHALL display the empty state message "No chits assigned to you." with the same styling and a "+ Create Chit" button

### Requirement 13: Visual Indicators System

**User Story:** As a user, I want to see the same emoji indicators on task cards as the mobile browser, respecting display mode settings.

#### Acceptance Criteria

1. THE Task_Card SHALL display visual indicator emojis in the header left section from the indicator calculation function, showing: 🛎️ (combined alerts) or individual 🔔📢⏱️⏲️ based on the `visual_indicators.combine_alerts` setting, 👥 (people assigned, per `visual_indicators.people` setting), ❤️ (health indicator data, per `visual_indicators.indicators` setting), 📊 (custom data, per `visual_indicators.custom_data` setting), 🎯 (habit, always shown), 🔁 (recurrence rule, always shown), 📎 (attachments, always shown)
2. EACH indicator type SHALL respect its display mode setting: "always" shows in all contexts, "never" hides in all contexts, "space" shows in card context (which is always the context in Tasks view)
3. WHEN a chit has a location and the weather display mode allows it, THE Task_Card SHALL display a weather indicator emoji with a tooltip showing high/low temperatures and precipitation info, or ⏳ while loading or if data is stale

### Requirement 14: Color System and Parchment Theme

**User Story:** As a user, I want the Android Tasks view to use the exact same color palette and parchment theme as the mobile browser.

#### Acceptance Criteria

1. THE Tasks_View SHALL use these theme colors: parchment-light `#fdf5e6`, parchment-medium `#faebd7`, parchment-dark `#fff8dc`, aged-brown-dark `#4a2c2a`, aged-brown-medium `#8b4513`, aged-brown-light `#a0522d`, button-hover `#c4a484`, header-bg `#e0d4b5`, sidebar-bg `#e0d4b5`, btn-bg `#8b5a2b`, btn-border `#5a3f2a`, btn-hover `#6b4e31`
2. THE Task_Card SHALL apply per-chit background colors via the color application function, with default card color `#fdf6e3`, and automatically adjust text color for contrast
3. THE Status_Dropdown SHALL apply dynamic styling per status value: Blocked gets the configured blocked_border_color background (default `#DAA520`) with contrast text and bold font, Complete gets 0.6 opacity, Rejected gets color `#9E9E9E` and 0.6 opacity
4. THE Task_Card SHALL style overdue dates with background `#b22222`, auto-contrast text color, bold font, 1px 6px padding, and 3px border-radius

### Requirement 15: Animations and Transitions

**User Story:** As a user, I want the same animation timings and effects as the mobile browser, so that interactions feel identical.

#### Acceptance Criteria

1. THE Sidebar SHALL animate its position over 300 milliseconds with ease timing when opening or closing
2. THE Views_Panel SHALL animate its position over 250 milliseconds with ease timing when opening or closing
3. WHILE a Task_Card is being touch-dragged, THE Task_Card SHALL display a scale(1.04) transform with 150ms ease transition and a pulsing outline animation cycling between `#a0522d` and `#d2691e` over 1 second (the `cwoc-drag-pulse` keyframe pattern)
4. THE Sidebar filter sections SHALL animate collapse/expand with 200 milliseconds ease timing on opacity and blur

### Requirement 16: Typography

**User Story:** As a user, I want the same Lora serif font rendering as the mobile browser, so that text appearance is indistinguishable.

#### Acceptance Criteria

1. THE Tasks_View SHALL use the Lora variable font (weight range 400–700, normal and italic variants) as the primary font family, with Georgia and serif as fallbacks
2. THE Tasks_View SHALL load the Lora font from the bundled app assets (equivalent to the self-hosted `/static/fonts/lora/Lora-VariableFont_wght.ttf` on web)
3. THE Task_Card SHALL render title text in bold (weight 700), meta text at 0.78em, note preview at default weight with 1.4em line-height, and all text in color `#2b1e0f` unless overridden by card color contrast logic

### Requirement 17: Accessibility and Touch Targets

**User Story:** As a user, I want all interactive elements to meet the same minimum touch target sizes as the mobile browser, so that the app is equally usable.

#### Acceptance Criteria

1. THE Tasks_View SHALL render all interactive controls (selects, inputs, small buttons) with a minimum height of 36px
2. THE Tasks_View SHALL render all primary action buttons (sidebar buttons, view options, close buttons) with a minimum height of 44px
3. THE Status_Dropdown SHALL render with minimum 36px height and 14px font-size
4. THE Touch_Gesture_System SHALL use a 10px touch slop threshold (movement distance before a gesture is cancelled)

### Requirement 18: Data Flow and State Management

**User Story:** As a user, I want the Android app to load, display, and persist task data using the same API calls and state management patterns as the mobile browser.

#### Acceptance Criteria

1. WHEN the Tasks_View loads, THE Tasks_View SHALL fetch all chits from `GET /api/chits`, load settings from `GET /api/settings/default_user`, load sort preferences from `GET /api/sort-preferences`, and load manual sort orders from `GET /api/sort-orders`
2. WHEN the Tasks_View loads, THE Tasks_View SHALL compute prerequisite flags for all chits (marking `_hasIncompletePrereqs` true for chits with at least one prerequisite whose status is not Complete)
3. WHEN a status change is made, THE Tasks_View SHALL send `PUT /api/chits/{id}` with the updated chit data and refresh the full task list on success
4. WHEN a drag-to-reorder completes, THE Tasks_View SHALL save the new order to local storage and to the server via `PUT /api/sort-orders/Tasks`, set the sort field to "manual", and persist the sort preference via `PUT /api/sort-preferences/Tasks`
5. THE Tasks_View SHALL persist sort preferences both locally and to the server, treating the server as the source of truth (loaded on init via sort preferences API), with local storage as fallback when offline
6. THE Tasks_View SHALL persist filter state locally so that filters are restored when returning to the Tasks view

### Requirement 19: Main Content Layout

**User Story:** As a user, I want the task list content area to use the same layout and spacing as the mobile browser, so that card density and scrolling feel identical.

#### Acceptance Criteria

1. THE Tasks_View main content area SHALL use zero padding on the outer container, with the task list starting below the fixed header (approximately 50px from viewport top)
2. THE Tasks_View task list container SHALL fill the remaining viewport height (`100vh - 50px` equivalent) with vertical scrolling, contain-style overscroll behavior, and auto overflow
3. THE Tasks_View task list SHALL use 4px padding and 6px gap between task cards in a vertical flex column layout
4. THE Tasks_View main content area SHALL never shift horizontally when the sidebar opens (sidebar overlays, does not push content)

### Requirement 20: Shared Chit Behavior

**User Story:** As a user, I want shared chits to display the same visual indicators and interaction restrictions as the mobile browser.

#### Acceptance Criteria

1. WHEN a chit is shared with viewer role, THE Task_Card SHALL disable the Status_Dropdown with title "Read-only — shared chit" and suppress long-press quick-edit
2. THE Task_Card SHALL display shared chit indicators where applicable: shared icon (🔗) with tooltip showing owner and shared users, role badge, owner badge, RSVP indicators (✓ green for accepted, ✗ gray strikethrough for declined, ⏳ faded for invited), and RSVP action buttons (Accept/Decline) for non-owner shared chits
3. WHEN a chit has RSVP status Declined, THE Task_Card SHALL render with 0.35 opacity

### Requirement 21: Double-Tap Navigation

**User Story:** As a user, I want double-tap on a task card to navigate to the editor, matching the mobile browser behavior.

#### Acceptance Criteria

1. WHEN the user double-taps a Task_Card body (not on a link or control), THE Tasks_View SHALL navigate to the chit editor for that card's chit ID
2. WHEN the user double-taps a map thumbnail, THE Tasks_View SHALL navigate to the maps view focused on that chit's location
3. THE double-tap detection SHALL be suppressed for 300 milliseconds after any drag operation ends (post-drag click suppression)
