# Requirements Document

## Introduction

Phase 5 of the CWOC Android app: Pixel-Perfect & Gesture-Identical UI Replication. The goal is to make the native Android app visually and behaviorally indistinguishable from the mobile browser version of the web app. The standard: screenshot the mobile browser, screenshot the native app — they must be indistinguishable. This phase covers navigation replication (removing the bottom tab bar, adding swipe panels), exact string/icon/label matching, pixel-level layout fidelity across every screen, gesture-for-gesture interaction parity, a complete page-by-page audit, and behavioral edge case alignment.

## Glossary

- **App**: The CWOC Android application (Kotlin, Jetpack Compose)
- **Web_App**: The CWOC web application as rendered in a mobile browser at 480px viewport width
- **C_CAPTN_Panel**: The right-swipe overlay panel containing the six C CAPTN view tabs (Calendar, Checklists, Alarms, Projects, Tasks, Notes)
- **Menu_Panel**: The left-swipe overlay panel containing the sidebar/options menu (filters, sort, date range, settings links)
- **Design_Token**: A CSS variable value from the web app (color, spacing, font size, border radius, shadow) that defines the visual specification
- **Gesture_Threshold**: The minimum swipe distance (in dp) and velocity (in dp/s) required to trigger a panel open or swipe action
- **Font_Awesome_Icon**: An icon from the Font Awesome 6 icon set used in the web app, to be replicated exactly in the native app
- **Chit_Card**: The visual card component representing a single chit in any list view
- **Quick_Edit_Modal**: The modal overlay triggered by long-press on a chit card for inline field editing
- **Overlay_Backdrop**: The semi-transparent dark background (rgba(0,0,0,0.4)) shown behind panels and modals
- **Spring_Back_Animation**: The elastic return animation when a swipe gesture is cancelled before reaching the trigger threshold
- **ESC_Chain**: The priority order in which back-button presses dismiss overlays (innermost modal first, then panels, then page navigation)
- **Dirty_Tracking**: The system that detects unsaved changes in the editor by comparing current field values to their last-saved state
- **Parchment_Theme**: The 1940s-inspired visual theme using Lora font, brown tones, and parchment textures

## Requirements

### Requirement 1: Remove Bottom Navigation Bar

**User Story:** As a user, I want the native app to have no bottom tab bar, so that the navigation matches the mobile web app exactly.

#### Acceptance Criteria

1. THE App SHALL NOT display a bottom navigation bar on any screen.
2. WHEN the App launches after login, THE App SHALL display the Tasks view (or last-active C CAPTN view) as the default screen without any bottom tab bar.
3. THE App SHALL provide access to all C CAPTN views exclusively through the C_CAPTN_Panel (right-swipe gesture or Views button).

### Requirement 2: Right-Swipe C CAPTN Panel

**User Story:** As a user, I want to swipe from the right edge to open the C CAPTN view tabs, so that view switching matches the mobile web app's interaction pattern.

#### Acceptance Criteria

1. WHEN the user swipes from the right edge of the screen toward the left, THE App SHALL open the C_CAPTN_Panel as a full-height overlay sliding in from the right.
2. THE C_CAPTN_Panel SHALL display tabs in this exact order: Calendar, Checklists, Alarms, Projects, Tasks, Notes.
3. THE C_CAPTN_Panel SHALL use the label "Alarms" (not "Alerts") for the alarms tab.
4. THE C_CAPTN_Panel SHALL display the same icons as the Web_App for each tab, using Font_Awesome_Icon equivalents where Material icons do not match.
5. THE C_CAPTN_Panel SHALL display an Overlay_Backdrop behind the panel with opacity matching the Web_App (rgba(0,0,0,0.4)).
6. WHEN the user taps a tab in the C_CAPTN_Panel, THE App SHALL navigate to that view and close the panel.
7. WHEN the user taps the Overlay_Backdrop, THE App SHALL close the C_CAPTN_Panel without navigating.
8. THE C_CAPTN_Panel open animation SHALL complete in the same duration as the Web_App's panel slide animation.
9. THE App SHALL also provide a "Views" button in the header (matching the Web_App's mobile-views-btn) that opens the C_CAPTN_Panel on tap.

### Requirement 3: Left-Swipe Menu Panel

**User Story:** As a user, I want to swipe from the left edge to open the menu/options panel, so that sidebar access matches the mobile web app exactly.

#### Acceptance Criteria

1. WHEN the user swipes from the left edge of the screen toward the right, THE App SHALL open the Menu_Panel as a full-height overlay sliding in from the left.
2. THE Menu_Panel SHALL contain the same items in the same order as the Web_App's mobile sidebar: filters, sort controls, date range, tag tree, and navigation links.
3. THE Menu_Panel SHALL display an Overlay_Backdrop behind the panel with opacity matching the Web_App.
4. WHEN the user taps the Overlay_Backdrop, THE App SHALL close the Menu_Panel.
5. THE Menu_Panel open animation SHALL match the Web_App's sidebar slide animation in duration and easing.
6. THE App SHALL also provide a hamburger menu button in the header (matching the Web_App's mobile-hamburger) that opens the Menu_Panel on tap.
7. THE Menu_Panel SHALL use the same background as the Web_App sidebar (parchment texture with var(--sidebar-bg) color #e0d4b5).

### Requirement 4: Gesture Thresholds and Animations

**User Story:** As a user, I want swipe gestures to feel identical to the mobile web app, so that muscle memory transfers between platforms.

#### Acceptance Criteria

1. THE App SHALL require a minimum horizontal swipe distance of 50dp to trigger panel opening (matching the Web_App's touch threshold).
2. THE App SHALL require a minimum swipe velocity of 200dp/s as an alternative trigger (fast flick opens panel even with short distance).
3. WHEN a swipe gesture is cancelled (finger lifted before threshold), THE App SHALL play a Spring_Back_Animation returning the panel to its closed position.
4. THE Spring_Back_Animation SHALL use a spring damping ratio and stiffness that produces motion visually identical to the Web_App's CSS transition spring-back.
5. WHEN the user performs the system back gesture or presses the back button, THE App SHALL close the topmost open panel or modal before navigating backward.
6. THE App SHALL prevent panel opening when a modal or overlay is already displayed.

### Requirement 5: String and Label Exactness

**User Story:** As a user, I want every piece of text in the native app to match the web app character for character, so that the experience is identical.

#### Acceptance Criteria

1. THE App SHALL use the exact same screen titles as the Web_App for every page (e.g., "Settings", "People", "Weather", "Trash", "Audit Log", "Help").
2. THE App SHALL use the exact same tab labels as the Web_App: "Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes".
3. THE App SHALL use the exact same button text as the Web_App for all action buttons (e.g., "Quick Edit", "Save", "Cancel", "Delete", "Restore", "Purge").
4. THE App SHALL use the exact same placeholder text as the Web_App in all input fields.
5. THE App SHALL use the exact same empty state messages as the Web_App (e.g., "No events today", "All caught up!").
6. THE App SHALL use the exact same error messages and toast messages as the Web_App.
7. THE App SHALL use the exact same modal titles, body text, and button labels as the Web_App for all confirmation dialogs.

### Requirement 6: Icon Exactness

**User Story:** As a user, I want every icon in the native app to match the web app exactly, so that visual recognition is identical.

#### Acceptance Criteria

1. THE App SHALL bundle Font Awesome 6 icon assets for all icons where Material Design icons do not provide an exact visual match to the Web_App.
2. THE App SHALL render each icon at the same size (in dp equivalent to the Web_App's px/em values) as the Web_App.
3. THE App SHALL render each icon in the same color as the Web_App at the same position relative to its label or container.
4. WHEN the Web_App uses a specific Font Awesome icon class (e.g., fa-bell, fa-calendar, fa-check), THE App SHALL use the same glyph from the bundled Font Awesome 6 font or equivalent SVG asset.
5. THE App SHALL match the Web_App's icon spacing (gap between icon and adjacent text) exactly.

### Requirement 7: Layout Fidelity — Design Tokens

**User Story:** As a user, I want the native app's spacing, colors, and typography to match the web app exactly, so that screens are visually indistinguishable.

#### Acceptance Criteria

1. THE App SHALL use the exact color values from the Web_App's CSS variables: --parchment-light (#fdf5e6), --parchment-medium (#faebd7), --parchment-dark (#fff8dc), --aged-brown-dark (#4a2c2a), --aged-brown-medium (#8b4513), --aged-brown-light (#a0522d), --header-bg (#e0d4b5).
2. THE App SHALL use the Lora font family for all text, matching the Web_App's font-family declaration.
3. THE App SHALL use a base font size of 16sp (matching the Web_App's 16px base), with all relative sizes scaled proportionally.
4. THE App SHALL use the same border-radius values as the Web_App (10dp for panels matching 10px, 4dp for buttons matching 4px).
5. THE App SHALL use the same box-shadow/elevation values as the Web_App (e.g., 4dp elevation matching "0 4px 8px rgba(0,0,0,0.3)").
6. THE App SHALL use the same padding and margin values as the Web_App's mobile breakpoint CSS (converted from px to dp at 1:1 ratio for mdpi baseline).
7. THE App SHALL use the same line-height ratios as the Web_App for all text styles.

### Requirement 8: Chit Card Layout Fidelity

**User Story:** As a user, I want chit cards in the native app to look identical to the web app, so that I cannot distinguish which platform I am using.

#### Acceptance Criteria

1. THE App SHALL render Chit_Card components with the same height, internal padding (10dp matching 10px), and margin (4dp vertical) as the Web_App's mobile layout.
2. THE App SHALL render chit card titles with the same font size, weight, and truncation behavior (word-break, no ellipsis on mobile) as the Web_App.
3. THE App SHALL render chit card metadata (dates, tags, people chips) in the same position, font size (0.78em equivalent), and wrapping behavior as the Web_App.
4. THE App SHALL render visual indicators (color stripe, badges, status icons) in the same positions and sizes as the Web_App.
5. THE App SHALL render note previews with the same max-height (4.5em equivalent), overflow hidden behavior, and expand toggle as the Web_App.
6. THE App SHALL render inline checklists within cards with the same indentation (8dp padding-left), font size (0.9em), and item height (36dp min) as the Web_App.

### Requirement 9: Calendar View Layout Fidelity

**User Story:** As a user, I want calendar views in the native app to look identical to the web app across all view types.

#### Acceptance Criteria

1. THE App SHALL render month view cells with the same min-height (50dp), max-height (80dp), font size (0.7em equivalent), and padding (2dp) as the Web_App's mobile layout.
2. THE App SHALL render week view hour blocks with the same font size (0.7em equivalent) and day column padding (2dp) as the Web_App.
3. THE App SHALL render timed events with the same min-height (30dp), padding (2dp 4dp), font size (0.65em equivalent), and line-height (1.2) as the Web_App.
4. THE App SHALL render all-day events with the same single-line truncation, max-height (1.4em), padding (1px 3px), and font size (0.7em equivalent) as the Web_App.
5. THE App SHALL render multi-day event bars with the same visual appearance (spanning across day columns) as the Web_App.
6. THE App SHALL support pinch-zoom on calendar views with the same zoom levels and snap points as the Web_App.
7. THE App SHALL render drag handles on calendar events with the same appearance as the Web_App.

### Requirement 10: Editor Layout Fidelity

**User Story:** As a user, I want the chit editor in the native app to look identical to the web app in every zone state.

#### Acceptance Criteria

1. THE App SHALL render editor zones in the same order as the Web_App: Dates & Times, Tags, People, Location, Notes, Alerts, Color, Health Indicators.
2. THE App SHALL render zone toggle animations (expand/collapse) with the same duration and easing as the Web_App.
3. THE App SHALL render all form fields (text inputs, date pickers, dropdowns) at the same sizes and positions as the Web_App.
4. THE App SHALL render the color picker with the same swatch layout, swatch size (30dp diameter), and selection indicator as the Web_App.
5. THE App SHALL render action buttons (Save, Cancel, Delete) at the same positions with the same sizing as the Web_App.
6. THE App SHALL render the editor header with the same layout (title field, back button, action buttons) as the Web_App.

### Requirement 11: Secondary Pages Layout Fidelity

**User Story:** As a user, I want all secondary pages (Settings, People, Weather, Trash, Audit Log, Help) to look identical to the web app.

#### Acceptance Criteria

1. THE App SHALL render the Settings page with the same tab layout, section ordering, toggle appearance, and input field styling as the Web_App.
2. THE App SHALL render the People page with the same list layout, avatar sizing, and contact card appearance as the Web_App.
3. THE App SHALL render the Trash page with the same layout and restore/purge button placement as the Web_App.
4. THE App SHALL render the Audit Log page with the same table/list appearance as the Web_App.
5. THE App SHALL render the Help page with the same navigation structure and content rendering as the Web_App.
6. THE App SHALL render the Weather page with the same layout and data presentation as the Web_App.
7. THE App SHALL render all secondary pages with the shared page panel styling: linear-gradient background (#fff8e1 to #f5e6cc), 2px solid #8b5a2b border, 10dp border-radius, and box-shadow matching the Web_App.

### Requirement 12: Tap Interaction Fidelity

**User Story:** As a user, I want tap interactions in the native app to feel identical to the web app.

#### Acceptance Criteria

1. THE App SHALL render tap targets at the same size and hit area as the Web_App (minimum 44dp matching the Web_App's 44px touch targets).
2. THE App SHALL provide tap feedback that visually matches the Web_App's tap highlight (brief color overlay, not Material ripple, unless the Web_App uses a ripple-like effect).
3. WHEN the user taps a chit card, THE App SHALL navigate to the editor with the same behavior as the Web_App (immediate navigation, no delay).
4. THE App SHALL match the Web_App's tap-to-toggle behavior for checkboxes, toggles, and interactive elements.

### Requirement 13: Long-Press Interaction Fidelity

**User Story:** As a user, I want long-press interactions in the native app to behave identically to the web app.

#### Acceptance Criteria

1. WHEN the user long-presses a Chit_Card, THE App SHALL trigger the Quick_Edit_Modal after the same delay threshold as the Web_App.
2. THE App SHALL provide the same visual feedback during long-press (subtle scale or highlight) as the Web_App.
3. THE Quick_Edit_Modal SHALL display the same fields, layout, and button labels as the Web_App's quick-edit modal.
4. THE Quick_Edit_Modal SHALL be dismissible by tapping outside, swiping down, or pressing back — matching the Web_App's dismiss behavior.

### Requirement 14: Drag-and-Drop Interaction Fidelity

**User Story:** As a user, I want drag-and-drop in the native app to look and feel identical to the web app.

#### Acceptance Criteria

1. THE App SHALL initiate drag-and-drop with the same gesture as the Web_App (long-press on drag handle or item).
2. WHILE dragging, THE App SHALL display a drag ghost with the same appearance (elevated card with slight scale increase) as the Web_App.
3. WHILE dragging, THE App SHALL highlight valid drop zones with the same visual indicator as the Web_App.
4. WHEN a drag-and-drop completes, THE App SHALL animate the item settling into its new position with the same animation as the Web_App.
5. THE App SHALL support drag-to-reorder for checklists, Kanban cards, and manual sort order — matching the Web_App's behavior in each context.

### Requirement 15: Swipe Actions on Cards

**User Story:** As a user, I want swipe actions on list items to match the web app's behavior exactly.

#### Acceptance Criteria

1. WHEN the user swipes a Chit_Card to the right, THE App SHALL reveal action buttons with the same colors and icons as the Web_App (green/checkmark for archive).
2. WHEN the user swipes a Chit_Card to the left, THE App SHALL reveal action buttons with the same colors and icons as the Web_App (orange/clock for snooze).
3. THE App SHALL use the same reveal distance before action buttons become fully visible as the Web_App.
4. THE App SHALL use the same swipe threshold to auto-complete the action (vs spring back) as the Web_App.
5. WHEN a swipe action completes, THE App SHALL display an undo toast matching the Web_App's undo countdown bar (bottom-center, 5-second countdown).

### Requirement 16: Pull-to-Refresh Fidelity

**User Story:** As a user, I want pull-to-refresh to look and behave identically to the web app's refresh mechanism.

#### Acceptance Criteria

1. WHEN the user pulls down at the top of a list, THE App SHALL trigger a refresh after the same pull distance as the Web_App's trigger threshold.
2. THE App SHALL display a refresh indicator that matches the Web_App's refresh visual (spinner style, position, color).
3. WHEN the refresh completes, THE App SHALL dismiss the indicator with the same animation as the Web_App.

### Requirement 17: Scroll and Overscroll Behavior

**User Story:** As a user, I want scrolling in the native app to feel identical to the web app.

#### Acceptance Criteria

1. THE App SHALL use the same scroll momentum behavior as the Web_App (matching CSS overscroll-behavior: contain where specified).
2. THE App SHALL render sticky headers (date headers in calendar, section headers) with the same sticky behavior as the Web_App.
3. THE App SHALL match the Web_App's overscroll visual effect (or lack thereof where overscroll-behavior: contain is used).

### Requirement 18: Modal Interaction Fidelity

**User Story:** As a user, I want modals in the native app to look and behave identically to the web app.

#### Acceptance Criteria

1. THE App SHALL render all modals with the same dimensions, padding, border, and background as the Web_App (full-width minus 16dp on mobile, #fffaf0 background, #8b5a2b border).
2. THE App SHALL dismiss modals on tap-outside (Overlay_Backdrop tap) matching the Web_App's behavior.
3. THE App SHALL dismiss modals on swipe-down gesture matching the Web_App's behavior (where applicable).
4. THE App SHALL dismiss modals on back-button press matching the Web_App's ESC behavior.
5. THE App SHALL render modal buttons with the same minimum touch target (44dp) as the Web_App.
6. THE App SHALL render confirmation modals (delete, unsaved changes) with the same title, body text, and button labels as the Web_App.

### Requirement 19: Checklist Interaction Fidelity

**User Story:** As a user, I want checklist interactions in the native app to match the web app exactly.

#### Acceptance Criteria

1. WHEN the user taps a checklist item, THE App SHALL toggle its checked state with the same visual feedback as the Web_App.
2. WHEN the user drags a checklist item, THE App SHALL reorder it with the same drag handle appearance and drop animation as the Web_App.
3. THE App SHALL support indent/outdent gestures for checklist items matching the Web_App's behavior.
4. WHEN a checklist action is performed, THE App SHALL provide the same undo capability as the Web_App.

### Requirement 20: Back Button / ESC Chain Fidelity

**User Story:** As a user, I want the back button to behave identically to the web app's ESC key, closing overlays in the correct priority order.

#### Acceptance Criteria

1. WHEN the user presses back while a modal is open, THE App SHALL close only the topmost modal without triggering any other navigation or action.
2. WHEN the user presses back while a panel (C_CAPTN_Panel or Menu_Panel) is open but no modal is showing, THE App SHALL close the panel.
3. WHEN the user presses back with no overlays open, THE App SHALL check for unsaved changes (if in editor) and show the unsaved-changes modal if dirty.
4. WHEN the user presses back with no overlays and no unsaved changes, THE App SHALL navigate to the previous screen.
5. THE App SHALL follow this exact priority chain: close QR modal → close tag modal → close delete confirm → close unsaved-changes modal → close panel → navigate back.
6. A single back press SHALL trigger exactly one action in the chain — never two simultaneous actions.

### Requirement 21: Unsaved Changes and Dirty Tracking Fidelity

**User Story:** As a user, I want unsaved changes detection to trigger at the same moments as the web app.

#### Acceptance Criteria

1. THE App SHALL detect dirty state on the same fields and at the same moments as the Web_App's Dirty_Tracking system.
2. WHEN the user attempts to leave the editor with unsaved changes, THE App SHALL display the same Save/Discard/Cancel modal as the Web_App.
3. THE App SHALL use the same modal text and button labels as the Web_App's unsaved-changes dialog.

### Requirement 22: Search Result and Highlighting Fidelity

**User Story:** As a user, I want search results in the native app to display identically to the web app.

#### Acceptance Criteria

1. WHEN the user searches, THE App SHALL return results in the same order as the Web_App for identical queries.
2. THE App SHALL highlight matching terms in search results with the same visual treatment (background color, text weight) as the Web_App.
3. THE App SHALL display search result cards with the same layout and information density as the Web_App.

### Requirement 23: Tag Tree Rendering Fidelity

**User Story:** As a user, I want the tag tree in the native app to render identically to the web app.

#### Acceptance Criteria

1. THE App SHALL render the tag tree with the same nesting indentation, expand/collapse icons, and spacing as the Web_App.
2. THE App SHALL match the Web_App's tag tree expand/collapse animation.
3. THE App SHALL render tag chips (in cards and editor) with the same appearance (size, color, border-radius) as the Web_App.

### Requirement 24: Date/Time and Recurrence Formatting Fidelity

**User Story:** As a user, I want dates, times, and recurrence descriptions to display identically to the web app.

#### Acceptance Criteria

1. THE App SHALL format dates using the same format strings as the Web_App (respecting the user's time format setting: 12h/24h).
2. THE App SHALL format relative time displays (e.g., "2 days ago", "in 3 hours") identically to the Web_App.
3. THE App SHALL format recurrence descriptions (e.g., "Every Monday and Wednesday", "Monthly on the 2nd Tuesday") identically to the Web_App's shared-recurrence.js output.

### Requirement 25: Toast and Feedback Fidelity

**User Story:** As a user, I want toasts and feedback messages in the native app to look and behave identically to the web app.

#### Acceptance Criteria

1. THE App SHALL render success toasts with the same position (top-center), duration, and styling as the Web_App's cwocToast.
2. THE App SHALL render undo countdown toasts with the same position (bottom-center), countdown bar, and "Undo" button as the Web_App's cwocUndoToast.
3. THE App SHALL render error toasts with the same styling and duration as the Web_App.
4. THE App SHALL auto-dismiss toasts after the same duration as the Web_App.

### Requirement 26: Loading and Error State Fidelity

**User Story:** As a user, I want loading and error states in the native app to look identical to the web app.

#### Acceptance Criteria

1. THE App SHALL render loading states (spinners, skeleton screens) with the same appearance and position as the Web_App.
2. THE App SHALL render error states with the same message text, icon, and layout as the Web_App.
3. THE App SHALL render empty states with the same message text and visual treatment as the Web_App.

### Requirement 27: Markdown Rendering Fidelity

**User Story:** As a user, I want markdown content in notes to render identically to the web app.

#### Acceptance Criteria

1. THE App SHALL render markdown in note fields producing the same visual output as the Web_App's marked.js rendering.
2. THE App SHALL render code blocks, headings, lists, links, bold, italic, and images with the same styling as the Web_App.
3. THE App SHALL constrain rendered markdown images to max-width 100% matching the Web_App's behavior.

### Requirement 28: Sort Order and Filter Persistence Fidelity

**User Story:** As a user, I want sort order and filter state to persist identically to the web app.

#### Acceptance Criteria

1. THE App SHALL persist sort order selections across sessions using the same persistence mechanism as the Web_App (stored in settings).
2. THE App SHALL apply filter combinations producing identical result sets to the Web_App for the same data.
3. THE App SHALL persist filter state within a session when switching between views, matching the Web_App's behavior.

### Requirement 29: Header Bar Layout Fidelity

**User Story:** As a user, I want the app header to look identical to the web app's mobile header.

#### Acceptance Criteria

1. THE App SHALL render a fixed header bar at the top matching the Web_App's mobile header: compact height, row layout, 4px 8px padding.
2. THE App SHALL display the CWOC logo at 32dp × 32dp matching the Web_App's mobile logo size.
3. THE App SHALL display the hamburger menu button (32dp × 32dp, brown background #8b5a2b, white icon) matching the Web_App's mobile-hamburger.
4. THE App SHALL display the page title with the same font size (1em equivalent) and inline positioning as the Web_App.
5. THE App SHALL display the Views button matching the Web_App's mobile-views-btn appearance and position.
6. THE App SHALL display the profile image/menu at 32dp × 32dp matching the Web_App's cwoc-profile-img.
