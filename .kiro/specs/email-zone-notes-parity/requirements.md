# Requirements Document

## Introduction

The Email zone in the chit editor currently uses a different interaction pattern than the Notes zone — large inline action buttons, no formatting toolbar, no undo/redo, and no bottom-pinned toolbar. This feature brings the Email zone's body editing experience in line with the Notes zone's established philosophy: content fills the space, a bottom-pinned toolbar provides formatting and actions, and email-specific operations live in a compact overflow menu. This applies to the Android app and mobile web browser platforms only; desktop web retains its current zone-header button layout.

## Glossary

- **Email_Zone**: The email compose/view section within the chit editor that handles draft composition, received email display, and sent email display
- **Notes_Zone**: The existing notes editing section in the chit editor that uses a bottom-pinned toolbar with formatting buttons, undo/redo, preview toggle, and a data overflow menu
- **Bottom_Toolbar**: A horizontally-arranged row of icon buttons pinned to the bottom of the zone (above the keyboard when open), containing the overflow menu, preview toggle, undo/redo, and scrollable formatting buttons
- **Overflow_Menu**: The vertical three-dot (⋮) menu button that opens a dropdown containing context-dependent actions (send, reply, forward, archive, discard, copy, download)
- **Address_Header**: The fixed section above the email body containing From, To, CC/BCC, and Subject fields
- **Preview_Toggle**: A single button that switches between edit mode (raw markdown textarea) and rendered view (formatted output)
- **Formatting_Toolbar**: The horizontally scrollable set of formatting buttons (Bold, Italic, Strikethrough, Link, Heading, Bullet, Numbered, Blockquote/Code)
- **App**: The Android native application built with Jetpack Compose
- **Mobile**: The mobile web browser version of the frontend (viewport ≤768px)

## Requirements

### Requirement 1: Bottom-Pinned Toolbar for Email Body

**User Story:** As a user composing or reading emails on a mobile device, I want a bottom-pinned toolbar on the email zone body, so that I always have quick access to formatting and actions without scrolling.

#### Acceptance Criteria

1. WHEN the Email_Zone is expanded, THE Bottom_Toolbar SHALL be displayed pinned to the bottom of the zone, below the email body area; WHEN the Email_Zone is collapsed, THE Bottom_Toolbar SHALL be hidden
2. WHILE the on-screen keyboard is open on the App, THE Bottom_Toolbar SHALL remain visible above the keyboard using imePadding and navigationBarsPadding
3. WHILE the on-screen keyboard is open on Mobile, THE Bottom_Toolbar SHALL remain visible above the keyboard by tracking visualViewport resize events
4. THE Bottom_Toolbar SHALL display buttons in this fixed order: Overflow_Menu, Preview_Toggle, Undo, Redo, followed by a scrollable Formatting_Toolbar section
5. THE Bottom_Toolbar SHALL use the same visual styling, icon sizes, and spacing as the Notes_Zone bottom toolbar
6. WHILE the Bottom_Toolbar is displayed, THE email body area SHALL scroll independently above the toolbar so that the toolbar remains fixed in place regardless of body content length

### Requirement 2: Scrollable Formatting Toolbar

**User Story:** As a user composing an email on a mobile device, I want the same markdown formatting buttons available in Notes, so that I can format email body text without switching to a different tool.

#### Acceptance Criteria

1. WHILE the Email_Zone is in edit mode (draft status), THE Formatting_Toolbar SHALL display these buttons in a horizontally scrollable row: Bold, Italic, Strikethrough, Link, Heading dropdown (H1/H2/H3), Bullet List, Numbered List, Blockquote/Code dropdown
2. THE Formatting_Toolbar SHALL apply markdown formatting to the email body text using the same logic as the Notes_Zone (wrap selection, insert at cursor, line-prefix operations)
3. WHEN the email body has no text selection and a formatting button is tapped, THE Formatting_Toolbar SHALL insert the formatting delimiters at the current cursor position within the body field
4. WHEN the email body has a text selection and a formatting button is tapped, THE Formatting_Toolbar SHALL wrap the selected text with the markdown delimiters for that button (** for Bold, * for Italic, ~~ for Strikethrough, []() for Link, # prefix for Heading, - prefix for Bullet List, 1. prefix for Numbered List, > prefix for Blockquote, ``` for Code)
5. WHILE the Email_Zone is in preview mode or displaying a received/sent email, THE Formatting_Toolbar SHALL be hidden
6. WHEN the Heading dropdown button is tapped, THE Formatting_Toolbar SHALL display a popup menu above the toolbar with H1, H2, and H3 options, and WHEN an option is selected, THE Formatting_Toolbar SHALL apply the corresponding heading prefix (# , ## , or ### ) to the current line
7. WHEN the Blockquote/Code dropdown button is tapped, THE Formatting_Toolbar SHALL display a popup menu above the toolbar with Blockquote and Code options, and WHEN an option is selected, THE Formatting_Toolbar SHALL apply the corresponding formatting (> line-prefix for Blockquote, ``` wrap for Code)
8. WHILE the cursor is not positioned within the email body field, THE Formatting_Toolbar buttons SHALL appear disabled and SHALL NOT perform any formatting action when tapped

### Requirement 3: Undo and Redo for Email Body

**User Story:** As a user composing an email, I want undo and redo buttons in the toolbar, so that I can quickly reverse or reapply edits to the email body.

#### Acceptance Criteria

1. THE Bottom_Toolbar SHALL include an Undo button and a Redo button positioned after the Preview_Toggle
2. WHEN the Undo button is tapped and the undo stack is not empty, THE Email_Zone SHALL revert the email body text and cursor position to the previous state
3. WHEN the Redo button is tapped and the redo stack is not empty, THE Email_Zone SHALL restore the email body text and cursor position to the next state
4. WHILE the undo stack is empty, THE Undo button SHALL appear visually dimmed and SHALL NOT respond to taps
5. WHILE the redo stack is empty, THE Redo button SHALL appear visually dimmed and SHALL NOT respond to taps
6. WHEN the email body content changes and at least 500 milliseconds have elapsed since the last recorded state or a whitespace-delimited word boundary is crossed, THE Email_Zone SHALL push the previous state (text content and cursor position) onto the undo stack (maximum 50 entries, oldest discarded first) and clear the redo stack
7. WHEN the Email_Zone switches from preview mode back to edit mode, THE Email_Zone SHALL preserve the undo and redo stacks so that prior edit history remains available

### Requirement 4: Preview/Edit Toggle for Email Body

**User Story:** As a user, I want a single toggle button to switch between editing and previewing the email body, so that I can see how my markdown will render without leaving the zone.

#### Acceptance Criteria

1. WHEN the Preview_Toggle is tapped in draft edit mode, THE Email_Zone SHALL switch to preview mode displaying the rendered markdown
2. WHEN the Preview_Toggle is tapped in draft preview mode, THE Email_Zone SHALL switch back to edit mode displaying the raw markdown textarea with all prior edits preserved
3. WHEN the Preview_Toggle is tapped for a received or sent email, THE Email_Zone SHALL toggle between the HTML rendered view and the plain text view
4. WHILE in preview mode, THE Bottom_Toolbar SHALL show only the Overflow_Menu button and an Edit button (same pattern as Notes_Zone preview toolbar)
5. WHILE in edit mode, THE Bottom_Toolbar SHALL show the full toolbar (Overflow_Menu, Preview_Toggle, Undo, Redo, and Formatting_Toolbar)

### Requirement 5: Email Actions in Overflow Menu

**User Story:** As a user on a mobile device, I want email-specific actions (Send, Reply, Forward, Archive, Discard) in a compact overflow menu, so that the toolbar stays uncluttered and consistent with the Notes zone pattern.

#### Acceptance Criteria

1. WHILE the Email_Zone is expanded on App or Mobile, THE Email_Zone SHALL NOT display inline action buttons (Send, Send Later, Send & Archive, Reply, Forward, Archive, Discard) as large Button composables or zone-header buttons, and SHALL provide these actions exclusively through the Overflow_Menu
2. WHEN the Overflow_Menu is tapped in draft mode, THE Email_Zone SHALL display a dropdown containing these items in order: Send, Send Later, Send & Archive, PGP Encrypt toggle (showing current on/off state), Copy body, and Discard draft
3. WHEN the Overflow_Menu is tapped in received mode, THE Email_Zone SHALL display a dropdown containing these items in order: Reply, Forward, Archive, Copy body, Download, and Add sender to contacts
4. WHEN the Overflow_Menu is tapped in sent mode, THE Email_Zone SHALL display a dropdown containing these items in order: Forward, Copy body, and Download
5. IF the To field is empty when the draft-mode Overflow_Menu is displayed, THEN THE Email_Zone SHALL render the Send, Send Later, and Send & Archive menu items in a disabled state that prevents tapping
6. WHEN the Discard draft menu item is tapped, THE Email_Zone SHALL display a confirmation dialog with confirm and cancel options; IF the user selects cancel, THEN THE Email_Zone SHALL dismiss the dialog and retain the draft unchanged
7. WHEN the user taps outside the open Overflow_Menu dropdown, THE Email_Zone SHALL dismiss the dropdown without executing any action

### Requirement 6: Email Body Fills Remaining Space

**User Story:** As a user composing an email, I want the body text area to fill all available vertical space between the address fields and the toolbar, so that I have maximum editing room on small screens.

#### Acceptance Criteria

1. THE Email_Zone body text area on the App SHALL use Modifier.weight(1f) to fill all remaining vertical space between the Address_Header and the Bottom_Toolbar
2. THE Email_Zone body text area on Mobile SHALL use auto-grow behavior (same as the Notes zone textarea) with a minimum height of 200px, expanding with content while filling available viewport space between the Address_Header and the Bottom_Toolbar
3. THE Address_Header (From, To, CC/BCC, Subject fields) SHALL remain in a scrollable section above the body that occupies only the height needed by its content, not consuming body space regardless of how few fields are populated
4. WHILE the email body content exceeds the visible area on the App, THE Email_Zone body text area SHALL be independently scrollable within its weighted space without affecting the Address_Header or Bottom_Toolbar positions

### Requirement 7: Address Header Stays Above Body

**User Story:** As a user composing an email, I want the address fields (From, To, CC/BCC, Subject) to remain visible above the body as a compact header section, so that I can always see who the email is addressed to.

#### Acceptance Criteria

1. THE Address_Header SHALL be positioned above the email body area and below the zone collapse header
2. THE Address_Header SHALL contain the From field, To field (with chip input and autocomplete), CC/BCC toggle with collapsible fields, and Subject field
3. WHILE the Address_Header content exceeds 40% of the available zone height, THE Address_Header SHALL become independently scrollable without affecting the body scroll position
4. THE Address_Header fields SHALL retain their existing behavior: From dropdown, To chip field with autocomplete, CC/BCC collapsible toggle, and Subject text input
5. WHILE the Email_Zone is displaying a received or sent email, THE Address_Header SHALL display all address and subject fields as read-only text

### Requirement 8: Desktop Web Unchanged

**User Story:** As a desktop web user, I want the email zone to keep its current zone-header button layout, so that the established desktop interaction pattern is preserved.

#### Acceptance Criteria

1. WHILE the viewport width exceeds 768px on the web platform, THE Email_Zone SHALL continue to display action buttons (Send, Reply, Forward, etc.) in the zone-header area
2. WHILE the viewport width exceeds 768px on the web platform, THE Email_Zone SHALL continue to display the inline format toolbar above the body textarea
3. WHILE the viewport width exceeds 768px on the web platform, THE Email_Zone SHALL NOT display a bottom-pinned toolbar

### Requirement 9: Received Email Preview Replaces Filter Chips (App)

**User Story:** As a user viewing a received email on the app, I want the HTML/Text toggle to be the Preview button in the toolbar instead of separate filter chips, so that the interaction is consistent with the Notes zone pattern.

#### Acceptance Criteria

1. WHEN viewing a received email on the App, THE Email_Zone SHALL NOT display FilterChip components for HTML/Text toggling
2. WHEN viewing a received email on the App, THE Preview_Toggle button in the Bottom_Toolbar SHALL toggle between the HTML rendered view and the plain text view
3. THE Preview_Toggle SHALL default to showing the HTML rendered view when HTML content is available for received emails
4. IF a received email contains only plain text content (no HTML), THEN THE Preview_Toggle button SHALL be hidden and the Email_Zone SHALL display the plain text view directly

### Requirement 10: Shared Formatting Logic

**User Story:** As a developer, I want the formatting logic (bold, italic, link, heading, list, blockquote, code) to be shared between the Notes zone and Email zone, so that behavior is identical and maintenance is reduced.

#### Acceptance Criteria

1. THE App SHALL use shared formatting utility functions for both the Notes_Zone and Email_Zone (wrap formatting, link formatting, heading formatting, line-prefix formatting, blockquote formatting)
2. THE Mobile web SHALL reuse the existing shared formatting functions between the Notes zone and Email zone bottom toolbars
3. WHEN a formatting button is tapped in the Email_Zone, THE formatting result SHALL produce the same markdown delimiters and cursor position as tapping the same button in the Notes_Zone given the same body text and selection state
