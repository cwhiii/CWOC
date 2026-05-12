# Requirements Document

## Introduction

Port the chit editor's mobile zone navigation system to the contact/people editor. On mobile viewports (≤768px), the contact editor transforms from a multi-column grid into a single-zone-at-a-time view with swipe navigation, a sticky zone header, a zone list overlay, and an actions sidebar — matching the behavior already implemented in `editor-mobile-zones.js` for the chit editor.

## Glossary

- **Contact_Editor**: The contact/people editor page (`contact-editor.html`) used for creating and editing contacts and user profiles.
- **Mobile_Zone_Mode**: The single-zone-at-a-time navigation mode activated on viewports ≤768px wide.
- **Zone**: A collapsible section of the contact editor containing related fields (e.g., Name, Phone & Email, Notes).
- **Sticky_Header**: A fixed navigation bar at the top of the viewport showing the current zone name, counter, and hamburger buttons for the actions sidebar and zone list.
- **Zone_List**: A slide-in panel from the right side showing all available zones with icons, labels, active state, and empty state indicators.
- **Actions_Sidebar**: A slide-in panel from the left side containing the editor's action buttons (Save, Exit, Delete, QR, Audit) organized in sections.
- **Swipe_Gesture**: A horizontal touch movement exceeding 50px within 500ms used to trigger navigation actions.
- **Contact_Mobile_Zones_Module**: The new JavaScript file (`contact-editor-mobile-zones.js`) implementing mobile zone navigation for the contact editor.

## Requirements

### Requirement 1: Mobile Zone Mode Activation

**User Story:** As a mobile user, I want the contact editor to automatically switch to single-zone navigation when my viewport is ≤768px, so that I can focus on one section at a time without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the contact editor loads on a viewport ≤768px wide, THE Contact_Mobile_Zones_Module SHALL activate Mobile_Zone_Mode within 200ms of DOMContentLoaded.
2. WHEN the viewport is resized from above 768px to at or below 768px, THE Contact_Mobile_Zones_Module SHALL activate Mobile_Zone_Mode.
3. WHEN the viewport is resized from at or below 768px to above 768px, THE Contact_Mobile_Zones_Module SHALL deactivate Mobile_Zone_Mode and restore the normal multi-column grid layout.
4. WHILE Mobile_Zone_Mode is active, THE Contact_Editor SHALL display only one zone at a time with all other zones hidden.
5. WHILE Mobile_Zone_Mode is active, THE Contact_Editor SHALL hide the header row (`.header-row`) and footer (`.author-info`).

### Requirement 2: Zone Registry and Ordering

**User Story:** As a mobile user, I want to navigate through all contact editor zones in a logical order, so that I can efficiently fill in or review contact information.

#### Acceptance Criteria

1. THE Contact_Mobile_Zones_Module SHALL define a zone registry containing all contact editor zones in this order: Profile Image, Name, Security, Phone & Email, Context, Notes, Tags, Social & Web, Color.
2. WHERE the contact editor is in profile mode, THE Contact_Mobile_Zones_Module SHALL include the Account zone (before Name) and the Password zone (after Color) in the zone registry.
3. WHEN a zone is hidden by application logic (e.g., Account and Password zones in non-profile mode), THE Contact_Mobile_Zones_Module SHALL exclude that zone from the visible zone list.
4. THE Contact_Mobile_Zones_Module SHALL start on the Name zone when Mobile_Zone_Mode activates.

### Requirement 3: Sticky Zone Navigation Header

**User Story:** As a mobile user, I want a persistent header showing which zone I'm viewing and providing quick access to the zone list and actions, so that I always know my position and can navigate efficiently.

#### Acceptance Criteria

1. WHILE Mobile_Zone_Mode is active, THE Contact_Mobile_Zones_Module SHALL display a sticky header at the top of the viewport.
2. THE Sticky_Header SHALL display the contact's display name (or "New Contact" for new contacts) in the center.
3. THE Sticky_Header SHALL display a zone counter (e.g., "3/9") showing the current zone position relative to total visible zones.
4. THE Sticky_Header SHALL display a left hamburger button that opens the Actions_Sidebar when tapped.
5. THE Sticky_Header SHALL display a right button labeled with the current zone name that opens the Zone_List when tapped.
6. WHEN the contact has a color assigned, THE Sticky_Header SHALL use that color as its background with contrasting text color.

### Requirement 4: Zone Navigation via Swipe on Header

**User Story:** As a mobile user, I want to swipe left or right on the zone header to move between zones, so that I can quickly navigate without opening the zone list.

#### Acceptance Criteria

1. WHEN the user performs a Swipe_Gesture to the left on the Sticky_Header, THE Contact_Mobile_Zones_Module SHALL navigate to the next zone.
2. WHEN the user performs a Swipe_Gesture to the right on the Sticky_Header, THE Contact_Mobile_Zones_Module SHALL navigate to the previous zone.
3. WHEN the user is on the last zone and swipes left on the Sticky_Header, THE Contact_Mobile_Zones_Module SHALL wrap around to the first zone.
4. WHEN the user is on the first zone and swipes right on the Sticky_Header, THE Contact_Mobile_Zones_Module SHALL wrap around to the last zone.

### Requirement 5: Zone Navigation via Swipe on Body

**User Story:** As a mobile user, I want to swipe on the zone body to access the zone list or actions sidebar, so that I have quick gesture-based access to navigation and actions.

#### Acceptance Criteria

1. WHEN the user performs a Swipe_Gesture to the left on the zone body area, THE Contact_Mobile_Zones_Module SHALL open the Zone_List overlay from the right.
2. WHEN the user performs a Swipe_Gesture to the right on the zone body area, THE Contact_Mobile_Zones_Module SHALL open the Actions_Sidebar from the left.
3. IF a swipe gesture starts from a focused input field, THEN THE Contact_Mobile_Zones_Module SHALL blur the active element before opening the overlay.
4. WHILE the Zone_List or Actions_Sidebar is open, THE Contact_Mobile_Zones_Module SHALL ignore body swipe gestures.

### Requirement 6: Zone List Overlay

**User Story:** As a mobile user, I want a zone list panel showing all available zones with their status, so that I can jump directly to any zone.

#### Acceptance Criteria

1. WHEN the Zone_List is opened, THE Contact_Mobile_Zones_Module SHALL display a slide-in panel from the right side of the viewport.
2. THE Zone_List SHALL display each visible zone with its icon and label.
3. THE Zone_List SHALL highlight the currently active zone with a distinct visual style.
4. THE Zone_List SHALL display zones that have no content with a greyed-out (reduced opacity) style.
5. WHEN the user taps a zone in the Zone_List, THE Contact_Mobile_Zones_Module SHALL navigate to that zone and close the Zone_List.
6. WHEN the user taps the backdrop or the close button, THE Contact_Mobile_Zones_Module SHALL close the Zone_List.

### Requirement 7: Actions Sidebar

**User Story:** As a mobile user, I want an actions sidebar with save, exit, and delete buttons, so that I can perform editor actions without needing the hidden header bar.

#### Acceptance Criteria

1. WHEN the Actions_Sidebar is opened, THE Contact_Mobile_Zones_Module SHALL display a slide-in panel from the left side of the viewport.
2. THE Actions_Sidebar SHALL include all visible header buttons (Save & Stay, Save & Exit, Exit, Favorite, QR, Audit, Delete) organized in logical sections.
3. THE Actions_Sidebar SHALL place Save and Exit buttons in the top section.
4. THE Actions_Sidebar SHALL place the Delete button in a bottom section separated by a spacer.
5. WHEN the user taps a button in the Actions_Sidebar, THE Contact_Mobile_Zones_Module SHALL close the sidebar and execute the corresponding action.
6. WHEN the user taps the backdrop or the close button, THE Contact_Mobile_Zones_Module SHALL close the Actions_Sidebar.

### Requirement 8: Zone Empty State Detection

**User Story:** As a mobile user, I want to see which zones have content and which are empty in the zone list, so that I can prioritize which zones to fill in.

#### Acceptance Criteria

1. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Name zone by checking if the given name field is empty.
2. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Phone & Email zone by checking if there are no phone, email, address, or date entries.
3. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Notes zone by checking if the notes textarea is empty.
4. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Tags zone by checking if no tags are present.
5. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Social & Web zone by checking if there are no X handles, websites, or call sign entries.
6. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Color zone by checking if no color hex value is set.
7. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Security zone by checking if Signal is not enabled and PGP key is empty.
8. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Context zone by checking if organization and social context fields are empty.

### Requirement 9: Profile Image Zone on Mobile

**User Story:** As a mobile user, I want the profile image area to be a navigable zone in mobile mode, so that I can view and edit the contact photo in the same single-zone pattern.

#### Acceptance Criteria

1. THE Contact_Mobile_Zones_Module SHALL treat the profile image area as the first zone in the navigation order.
2. WHEN the Profile Image zone is active, THE Contact_Mobile_Zones_Module SHALL display the profile image area full-width with upload, view, and remove controls accessible.
3. THE Contact_Mobile_Zones_Module SHALL detect empty state for the Profile Image zone by checking if no image is currently set.

### Requirement 10: Deactivation and State Restoration

**User Story:** As a user who rotates my device or resizes my browser, I want the editor to cleanly restore the multi-column layout when leaving mobile mode, so that no zones are left hidden or mispositioned.

#### Acceptance Criteria

1. WHEN Mobile_Zone_Mode is deactivated, THE Contact_Mobile_Zones_Module SHALL restore visibility of all zone containers.
2. WHEN Mobile_Zone_Mode is deactivated, THE Contact_Mobile_Zones_Module SHALL restore the header row and footer visibility.
3. WHEN Mobile_Zone_Mode is deactivated, THE Contact_Mobile_Zones_Module SHALL hide the Sticky_Header.
4. WHEN Mobile_Zone_Mode is deactivated, THE Contact_Mobile_Zones_Module SHALL close any open Zone_List or Actions_Sidebar overlays.
5. WHEN Mobile_Zone_Mode is deactivated, THE Contact_Mobile_Zones_Module SHALL preserve the collapsed/expanded state of zones that were collapsed before activation.

### Requirement 11: CSS Reuse and Shared Styling

**User Story:** As a developer, I want the contact editor mobile zones to reuse the existing CSS classes from the chit editor's mobile zone system, so that the visual appearance is consistent and code is not duplicated.

#### Acceptance Criteria

1. THE Contact_Mobile_Zones_Module SHALL reuse the existing CSS classes defined in `editor.css` for the mobile zone navigation header (`.mobile-zone-nav-header`), zone list (`.mobile-zone-list-*`), and actions sidebar (`.mobile-actions-sidebar-*`).
2. IF the existing CSS classes are in `editor.css` (chit-editor-specific), THEN THE developer SHALL move the shared mobile zone CSS to `shared-editor.css` so both editors can use them.
3. THE Contact_Editor SHALL apply the `mobile-zone-mode` body class when Mobile_Zone_Mode is active, enabling the shared CSS rules.

### Requirement 12: Module Structure and Integration

**User Story:** As a developer, I want the contact editor mobile zones implemented as a separate JS file following the same pattern as the chit editor, so that the code is modular and maintainable.

#### Acceptance Criteria

1. THE Contact_Mobile_Zones_Module SHALL be implemented in a new file at `src/frontend/js/pages/contact-editor-mobile-zones.js`.
2. THE Contact_Editor HTML SHALL load the new module via a `<script>` tag after `contact-editor.js`.
3. THE Contact_Mobile_Zones_Module SHALL expose an `initContactMobileZoneNav()` function that is called from the contact editor's initialization code.
4. THE Contact_Mobile_Zones_Module SHALL not interfere with the existing `initMobileActionsModal()` behavior — the old modal is superseded by the new zone-based navigation on mobile.
