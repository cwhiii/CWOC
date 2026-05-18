# Requirements Document

## Introduction

This document specifies the requirements for achieving full email client feature parity between the CWOC Android app and the CWOC web mobile email client. The Android app currently has basic email functionality (folder filtering, thread grouping, swipe actions, basic compose) but is missing approximately 77 specific features and behaviors that exist on the web. This spec covers: email list view enhancements, bundle system, bulk actions, controls/sync, compose/editor features, and email settings.

## Glossary

- **Email_List_View**: The scrollable list of email thread cards displayed in the Email tab
- **Email_Card**: A single row in the Email_List_View representing one email thread
- **Thread**: A group of related email messages linked by Message-ID/In-Reply-To/References headers or normalized subject matching
- **Bundle**: A category tab that filters inbox emails based on user-defined or auto-generated classification rules
- **Bundle_Toolbar**: The sticky two-row toolbar above the email list containing bulk actions (row 1) and bundle tabs (row 2)
- **Bulk_Actions_Bar**: Row 1 of the Bundle_Toolbar containing Select All, Archive, Tag, Read/Unread, Delete buttons
- **Check_Mail_Button**: A button that triggers email sync across all configured IMAP accounts
- **Account_Filter_Pill**: A toggleable pill button representing one configured email account for filtering
- **Compose_Zone**: The email composition area within the chit editor containing To/CC/BCC/Subject/Body fields
- **Recipient_Chip**: A styled pill element representing a resolved email recipient in To/CC/BCC fields
- **Autocomplete_Dropdown**: A floating list of contact suggestions shown while typing in recipient fields
- **Formatting_Toolbar**: A row of buttons for applying markdown formatting to the email body
- **Undo_Toast**: A bottom-positioned countdown notification with an Undo button that delays destructive actions
- **Smart_Link_Badge**: An auto-detected actionable badge on email cards (tracking numbers, flights, hotels, etc.)
- **PGP_Toggle**: A button that enables/disables PGP encryption for outgoing emails
- **Send_Later_Modal**: A date/time picker dialog for scheduling email delivery
- **Signature**: A markdown-formatted text block auto-appended to outgoing emails
- **Nested_Chit**: A non-email chit (task, note, checklist) attached to an email thread via nest_thread_id
- **Backfill**: A bulk sync operation that imports all historical emails from IMAP servers
- **Date_Group_Header**: A section divider in the email list showing temporal grouping (Today, Yesterday, Last Week, Older)

## Requirements

### Requirement 1: Contact Images on Email Cards

**User Story:** As a user, I want to see contact profile images on email cards, so that I can visually identify senders at a glance.

#### Acceptance Criteria

1. WHEN an email card is rendered, THE Email_Card SHALL display a circular avatar image for the sender using the contact's profile image URL
2. IF the sender has no profile image, THEN THE Email_Card SHALL display the first letter of the sender's display name as an initial inside a colored circle
3. WHEN the user long-presses an email card, THE Email_Card SHALL replace the contact image with a selection checkbox
4. WHILE an email card is in selected state, THE Email_Card SHALL display the checkbox instead of the contact image

### Requirement 2: Multi-Select Checkboxes

**User Story:** As a user, I want to select multiple emails via checkboxes, so that I can perform bulk actions on them.

#### Acceptance Criteria

1. WHEN the user long-presses an email card, THE Email_List_View SHALL enter multi-select mode and check that card
2. WHILE in multi-select mode, THE Email_List_View SHALL display checkboxes on all visible email cards in place of contact images
3. WHEN the user taps a checkbox, THE Email_List_View SHALL toggle the selection state of that email card
4. WHEN the user taps outside all checkboxes while in multi-select mode with zero selections, THE Email_List_View SHALL exit multi-select mode and restore contact images
5. WHILE in multi-select mode, THE Bulk_Actions_Bar SHALL display the count of selected emails as "N selected"

### Requirement 3: Pin Button

**User Story:** As a user, I want to pin important emails to the top of the list, so that I can quickly access them.

#### Acceptance Criteria

1. THE Email_Card SHALL display a bookmark icon button for pinning
2. WHEN the pin button is tapped on an unpinned email, THE Email_Card SHALL update the chit's pinned state to true via PUT /api/chits/{id} and display a solid bookmark icon
3. WHEN the pin button is tapped on a pinned email, THE Email_Card SHALL update the chit's pinned state to false and display an outline bookmark icon
4. WHILE emails are pinned, THE Email_List_View SHALL sort pinned emails above all unpinned emails

### Requirement 4: Status Badges

**User Story:** As a user, I want to see Draft and Sent badges on email cards, so that I can distinguish email states at a glance.

#### Acceptance Criteria

1. WHEN an email has email_status "draft", THE Email_Card SHALL display a "Draft" badge inline before the sender name
2. WHEN an email has email_status "sent", THE Email_Card SHALL display a "Sent" badge inline before the sender name
3. THE Email_Card SHALL style the Draft badge with a distinct visual treatment (e.g., amber/warning color)
4. THE Email_Card SHALL style the Sent badge with a distinct visual treatment (e.g., blue/info color)

### Requirement 5: Reply Indicator

**User Story:** As a user, I want to see which emails I have replied to, so that I can track my conversation participation.

#### Acceptance Criteria

1. WHEN an email thread contains a sent or draft chit with email_in_reply_to matching the displayed message's Message-ID, THE Email_Card SHALL display a reply icon indicator
2. WHEN no reply exists for the displayed message, THE Email_Card SHALL not display the reply indicator

### Requirement 6: Body Preview with Full Stripping

**User Story:** As a user, I want to see a clean text preview of email bodies on cards, so that I can scan content without opening emails.

#### Acceptance Criteria

1. THE Email_Card SHALL display a body preview extracted from the email body text
2. WHEN the email body contains HTML, THE Email_Card SHALL strip all HTML tags, style blocks, and script blocks before displaying the preview
3. WHEN the email body contains markdown formatting, THE Email_Card SHALL strip markdown syntax (bold markers, italic markers, link syntax) before displaying the preview
4. THE Email_Card SHALL remove raw URLs from the body preview text
5. THE Email_Card SHALL remove zero-width characters from the body preview text
6. THE Email_Card SHALL collapse multiple whitespace characters into single spaces in the preview
7. THE Email_Card SHALL truncate the body preview to 250 characters maximum
8. THE Email_Card SHALL display the preview in a single line with ellipsis overflow

### Requirement 7: Attachment Thumbnails

**User Story:** As a user, I want to see attachment previews on email cards, so that I can identify emails with attachments quickly.

#### Acceptance Criteria

1. WHEN an email has image attachments, THE Email_Card SHALL display thumbnail previews of those images inline
2. WHEN an email has non-image attachments, THE Email_Card SHALL display a file type icon and filename for each attachment
3. WHEN the user taps an attachment thumbnail, THE Email_Card SHALL open an attachment preview modal
4. WHEN the user long-presses an attachment thumbnail, THE Email_Card SHALL offer a context menu with "View" and "Download" options

### Requirement 8: Smart Link Badges

**User Story:** As a user, I want to see actionable badges for tracking numbers, flights, and other detected content, so that I can quickly access related services.

#### Acceptance Criteria

1. WHEN an email body contains a recognized tracking pattern (package, flight, hotel, rental, event, restaurant, transit, order), THE Email_Card SHALL display a Smart_Link_Badge for that category
2. THE Email_Card SHALL display at most the configured maximum number of badges per email (default 3)
3. THE Email_Card SHALL display at most one badge per category per email
4. WHEN the user taps a Smart_Link_Badge, THE Email_Card SHALL open the corresponding tracking URL in the device browser
5. THE Smart_Link_Badge SHALL display the carrier/service logo and a label identifying the detected content

### Requirement 9: Long-Press Action Menu

**User Story:** As a user, I want quick actions available via long-press on email cards, so that I can archive, delete, or mark emails without opening them.

#### Acceptance Criteria

1. WHEN the user long-presses an email card (and multi-select mode is not active), THE Email_Card SHALL display a context menu with Archive, Delete, and Mark Unread/Read options
2. WHEN the user selects Archive from the context menu, THE Email_Card SHALL archive the email with an Undo_Toast
3. WHEN the user selects Delete from the context menu, THE Email_Card SHALL soft-delete the email with an Undo_Toast
4. WHEN the user selects Mark Unread from the context menu, THE Email_Card SHALL toggle the email's read state

### Requirement 10: Tag Chips with Colors

**User Story:** As a user, I want to see colored tag chips on email cards, so that I can visually categorize emails.

#### Acceptance Criteria

1. THE Email_Card SHALL display up to 3 non-system tag chips on each email card
2. THE Email_Card SHALL apply each tag's configured color as the chip background
3. THE Email_Card SHALL compute a contrast-safe text color for each tag chip based on its background color
4. WHEN an email has more than 3 non-system tags, THE Email_Card SHALL display a "+N" overflow indicator showing the count of remaining tags
5. WHEN the user taps the overflow indicator, THE Email_Card SHALL display a tooltip listing all remaining tag names

### Requirement 11: Date Formatting

**User Story:** As a user, I want email dates formatted intelligently based on recency and my time format preference, so that I can quickly understand when emails arrived.

#### Acceptance Criteria

1. WHEN an email was received today, THE Email_Card SHALL display only the time (honoring the user's 12-hour or 24-hour time format setting)
2. WHEN an email was received yesterday, THE Email_Card SHALL display "Yesterday"
3. WHEN an email was received within the current year but not today or yesterday, THE Email_Card SHALL display the date as "Mon DD" (e.g., "May 18")
4. WHEN an email was received in a prior year, THE Email_Card SHALL display the date as "Mon DD, YYYY"

### Requirement 12: Custom Chit Colors on Email Cards

**User Story:** As a user, I want emails with custom colors to display those colors on their cards, so that my color-coding system is visible in the email list.

#### Acceptance Criteria

1. WHEN a chit has a custom color assigned, THE Email_Card SHALL apply that color as a background tint on the card
2. WHEN a chit has a custom color assigned, THE Email_Card SHALL compute and apply contrast-safe text colors for all text elements on that card
3. WHEN a chit has no custom color, THE Email_Card SHALL use the default card styling

### Requirement 13: Undo Toast for Archive and Delete

**User Story:** As a user, I want a countdown with undo capability before archive/delete actions complete, so that I can recover from accidental actions.

#### Acceptance Criteria

1. WHEN the user archives an email (via swipe or button), THE Email_List_View SHALL immediately hide the card and display an Undo_Toast with the message "Archived: {subject}"
2. WHEN the user deletes an email (via swipe or button), THE Email_List_View SHALL immediately hide the card and display an Undo_Toast with the message "Deleted: {subject}"
3. THE Undo_Toast SHALL display a countdown progress bar with configurable duration (from email_undo_send_delay setting, default 5 seconds)
4. WHEN the countdown expires, THE Undo_Toast SHALL execute the archive or delete API call
5. WHEN the user taps the Undo button before countdown expires, THE Email_List_View SHALL restore the card with a flash animation and cancel the action
6. WHEN a card is restored after undo, THE Email_Card SHALL briefly display a flash highlight animation

### Requirement 14: Date Group Headers

**User Story:** As a user, I want emails grouped by date with section headers, so that I can orient myself temporally in the email list.

#### Acceptance Criteria

1. WHEN the email_group_by setting is "date", THE Email_List_View SHALL display section headers dividing emails into temporal groups
2. THE Email_List_View SHALL display a "Today" header above emails received today
3. THE Email_List_View SHALL display a "Yesterday" header above emails received yesterday
4. THE Email_List_View SHALL display a "Last Week" header above emails received in the past 7 days (excluding today and yesterday)
5. THE Email_List_View SHALL display an "Older" header above all remaining emails
6. WHEN the email_group_by setting is "none", THE Email_List_View SHALL not display date group headers

### Requirement 15: Pagination

**User Story:** As a user, I want the email list to paginate after 50 threads, so that the app remains performant with large mailboxes.

#### Acceptance Criteria

1. WHEN the paginate_email setting is enabled, THE Email_List_View SHALL render only the first 50 threads initially
2. WHEN more than 50 threads exist and pagination is enabled, THE Email_List_View SHALL display a "Load More (N remaining)" button at the bottom of the list
3. WHEN the user taps the Load More button, THE Email_List_View SHALL load and display the next 50 threads appended to the list

### Requirement 16: Empty State with Context

**User Story:** As a user, I want informative empty states that reflect my current filters, so that I understand why no emails are shown.

#### Acceptance Criteria

1. WHEN no emails match the current folder filter, THE Email_List_View SHALL display "No emails in {folder}." centered in the content area
2. WHEN account filters are active and no emails match, THE Email_List_View SHALL include the active account names in the empty state message (e.g., "No emails in Personal, Work inbox.")
3. THE Email_List_View SHALL display a contextual suggestion in the empty state (e.g., "Tap + to compose a new email")

### Requirement 17: Thread Visual Indicators

**User Story:** As a user, I want visual indicators on threaded email cards, so that I can distinguish single emails from conversations.

#### Acceptance Criteria

1. WHEN a thread contains more than one message, THE Email_Card SHALL display a vertical ribbon bar on the left edge of the card
2. WHEN a thread contains more than one message, THE Email_Card SHALL display a thread count badge inline after the sender name showing the total message count
3. WHEN the user taps the thread count badge, THE Email_Card SHALL toggle the thread expansion state (expand or collapse)
4. THE thread count badge SHALL display a tooltip on long-press: "N messages in this thread"

### Requirement 18: Nested Chit Cards in Threads

**User Story:** As a user, I want to see non-email chits nested within email threads, so that I can view related tasks and notes in context.

#### Acceptance Criteria

1. WHEN a thread is expanded and contains nested chits (chits with nest_thread_id matching the thread), THE Email_List_View SHALL display those nested chits inline within the thread
2. THE nested chit card SHALL display a nest icon (dove/eggs image), the chit title, and a content preview
3. WHEN a nested chit has a due_date or start_datetime, THE nested chit card SHALL display that date
4. WHEN the user taps a nested chit card, THE Email_List_View SHALL navigate to that chit's editor
5. THE Email_List_View SHALL sort nested chits within a thread by due_date ascending, then start_datetime ascending, then after the top email if no dates exist
6. THE Email_List_View SHALL never display a nested chit as the topmost card of a collapsed thread

### Requirement 19: Bundle Tabs from API

**User Story:** As a user, I want real bundle tabs loaded from the API, so that I can filter my inbox by category.

#### Acceptance Criteria

1. WHEN the Email tab loads with the inbox folder selected, THE Bundle_Toolbar SHALL fetch bundles from GET /api/bundles and display them as tab buttons
2. THE Bundle_Toolbar SHALL display each bundle tab with its configured name
3. WHEN a bundle has a custom color, THE Bundle_Toolbar SHALL apply that color as the tab background
4. WHEN the user taps a bundle tab, THE Email_List_View SHALL filter to show only emails classified into that bundle
5. THE Bundle_Toolbar SHALL include a default "All" tab that shows all inbox emails without bundle filtering

### Requirement 20: Bundle Count Badges

**User Story:** As a user, I want to see unread/total counts on bundle tabs, so that I can prioritize which bundles to check.

#### Acceptance Criteria

1. WHEN the bundles_show_count setting is "both", THE Bundle_Toolbar SHALL display "unread/total" count on each tab (e.g., "3/12")
2. WHEN the bundles_show_count setting is "unread", THE Bundle_Toolbar SHALL display only the unread count on each tab
3. WHEN the bundles_show_count setting is "total", THE Bundle_Toolbar SHALL display only the total count on each tab
4. WHEN the bundles_show_count setting is "none", THE Bundle_Toolbar SHALL not display count badges on tabs
5. WHEN emails are read or new emails arrive, THE Bundle_Toolbar SHALL update the count badges in real-time

### Requirement 21: Bundle Priority Arrows

**User Story:** As a user, I want to see priority arrows between bundle tabs in single-placement mode, so that I understand the classification priority order.

#### Acceptance Criteria

1. WHILE multi-placement is disabled (single-placement mode), THE Bundle_Toolbar SHALL display arrow indicators between adjacent bundle tabs showing priority order
2. WHILE multi-placement is enabled, THE Bundle_Toolbar SHALL not display priority arrows between tabs

### Requirement 22: Bundle Context Menu

**User Story:** As a user, I want to manage bundles via a context menu, so that I can edit, disable, or delete bundles.

#### Acceptance Criteria

1. WHEN the user long-presses a bundle tab (500ms), THE Bundle_Toolbar SHALL display a context menu
2. THE context menu SHALL include an "Edit" option that opens the Edit Bundle modal
3. WHEN the bundle is an auto-bundle, THE context menu SHALL include a "Disable" option
4. WHEN the user selects Disable, THE Bundle_Toolbar SHALL hide the bundle and strip its tags from classified emails
5. WHEN the bundle is user-created, THE context menu SHALL include a "Delete" option
6. WHEN the user selects Delete, THE Bundle_Toolbar SHALL confirm then delete the bundle via DELETE /api/bundles/{id}
7. THE context menu SHALL not display a Delete option for the "Everything Else" bundle

### Requirement 23: Bundle Drag-to-Reorder

**User Story:** As a user, I want to reorder bundle tabs by dragging, so that I can arrange them by my priority.

#### Acceptance Criteria

1. WHEN the user long-presses and drags a bundle tab, THE Bundle_Toolbar SHALL enter reorder mode with visual drop indicators
2. WHILE dragging, THE Bundle_Toolbar SHALL display a border indicator on the drop target position
3. WHEN the user drops a tab in a new position, THE Bundle_Toolbar SHALL persist the new order via PUT /api/bundles/reorder
4. THE Bundle_Toolbar SHALL not allow reordering the "Everything Else" bundle in single-placement mode

### Requirement 24: Create Bundle Modal

**User Story:** As a user, I want to create new bundles with custom settings, so that I can organize my inbox into meaningful categories.

#### Acceptance Criteria

1. WHEN the user taps the "+" button at the end of the bundle tab row, THE Bundle_Toolbar SHALL display a Create Bundle modal
2. THE Create Bundle modal SHALL include a required Name text field
3. THE Create Bundle modal SHALL include an optional Description text area
4. THE Create Bundle modal SHALL include a Tab Color picker with color swatches and a "None" option
5. THE Create Bundle modal SHALL include a "Show in Omni View" checkbox
6. THE Create Bundle modal SHALL include "Cancel" and "Define Rule" action buttons
7. WHEN the user taps "Define Rule", THE Create Bundle modal SHALL save the bundle via POST /api/bundles and navigate to the Rule Editor

### Requirement 25: Edit Bundle Modal

**User Story:** As a user, I want to edit existing bundles, so that I can update their names, colors, and rules.

#### Acceptance Criteria

1. WHEN the user selects Edit from the bundle context menu, THE Bundle_Toolbar SHALL display an Edit Bundle modal pre-populated with the bundle's current values
2. THE Edit Bundle modal SHALL include the same fields as the Create Bundle modal (Name, Description, Tab Color, Show in Omni View)
3. THE Edit Bundle modal SHALL include a "Change Rules" button that navigates to the Rule Editor
4. THE Edit Bundle modal SHALL include a "Delete" button with confirmation
5. THE Edit Bundle modal SHALL include "Cancel" and "Save" action buttons
6. WHEN the user taps Save, THE Edit Bundle modal SHALL update the bundle via PUT /api/bundles/{id}

### Requirement 26: Bundle Dimmed State

**User Story:** As a user, I want bundle tabs to appear dimmed when not viewing the inbox, so that I understand they only apply to inbox filtering.

#### Acceptance Criteria

1. WHILE the current folder filter is not "inbox", THE Bundle_Toolbar SHALL dim all bundle tabs (reduced opacity) and make them non-interactive
2. WHILE the current folder filter is "inbox", THE Bundle_Toolbar SHALL display bundle tabs at full opacity and make them interactive

### Requirement 27: Select All Checkbox

**User Story:** As a user, I want a Select All checkbox in the toolbar, so that I can quickly select all visible emails for bulk actions.

#### Acceptance Criteria

1. THE Bulk_Actions_Bar SHALL display a Select All checkbox at the left position
2. WHEN the user taps the Select All checkbox while unchecked, THE Email_List_View SHALL select all visible email cards and enter multi-select mode
3. WHEN the user taps the Select All checkbox while checked, THE Email_List_View SHALL deselect all email cards
4. WHILE some but not all emails are selected, THE Select All checkbox SHALL display an indeterminate state

### Requirement 28: Bulk Archive

**User Story:** As a user, I want to archive multiple emails at once, so that I can clean up my inbox efficiently.

#### Acceptance Criteria

1. WHILE emails are selected, THE Bulk_Actions_Bar SHALL enable the Archive button (full opacity, clickable)
2. WHILE no emails are selected, THE Bulk_Actions_Bar SHALL disable the Archive button (reduced opacity, non-interactive)
3. WHEN the user taps the Archive button with emails selected, THE Bulk_Actions_Bar SHALL archive all selected emails by setting archived=true via PUT /api/chits/{id} for each
4. WHEN bulk archive completes, THE Bulk_Actions_Bar SHALL display a progress toast showing "N email(s) archived" or "N archived, M failed"
5. WHEN bulk archive completes, THE Email_List_View SHALL refresh the email list

### Requirement 29: Bulk Tag

**User Story:** As a user, I want to apply tags to multiple emails at once, so that I can organize emails in bulk.

#### Acceptance Criteria

1. WHILE emails are selected, THE Bulk_Actions_Bar SHALL enable the Tag button
2. WHEN the user taps the Tag button, THE Bulk_Actions_Bar SHALL display a full-screen tag picker modal with header "Tag N email(s)"
3. THE tag picker modal SHALL display the shared tag tree view with search functionality
4. WHEN the user selects tags and taps Apply, THE Bulk_Actions_Bar SHALL add the chosen tags to all selected emails
5. WHEN the user presses back or taps outside the modal, THE tag picker modal SHALL close without applying changes

### Requirement 30: Bulk Read/Unread Toggle

**User Story:** As a user, I want to toggle read/unread state on multiple emails at once, so that I can manage my unread count efficiently.

#### Acceptance Criteria

1. WHILE emails are selected, THE Bulk_Actions_Bar SHALL enable the Read/Unread button
2. WHEN the user taps the Read/Unread button, THE Bulk_Actions_Bar SHALL toggle the read state of all selected emails via PATCH /api/email/{id}/read
3. WHEN bulk read/unread completes, THE Email_List_View SHALL update the visual state of affected cards (add/remove unread styling)
4. WHEN bulk read/unread completes, THE Email_List_View SHALL update the unread badge count on the Email tab
5. WHEN bulk read/unread completes, THE Bundle_Toolbar SHALL update bundle tab count badges

### Requirement 31: Bulk Delete with Confirmation

**User Story:** As a user, I want to delete multiple emails with a confirmation step, so that I don't accidentally lose emails.

#### Acceptance Criteria

1. WHILE emails are selected, THE Bulk_Actions_Bar SHALL enable the Delete button with danger styling (red text/border)
2. WHEN the user taps the Delete button, THE Bulk_Actions_Bar SHALL display a confirmation dialog: "Delete N email(s)? They will be moved to Trash."
3. WHEN the user confirms deletion, THE Bulk_Actions_Bar SHALL soft-delete all selected emails via DELETE /api/chits/{id} for each
4. WHEN bulk delete completes, THE Bulk_Actions_Bar SHALL display a result toast
5. WHEN bulk delete completes, THE Email_List_View SHALL refresh the email list
6. WHEN the user cancels the confirmation, THE Bulk_Actions_Bar SHALL take no action and close the dialog

### Requirement 32: Check Mail Button with Sync Animation

**User Story:** As a user, I want a Check Mail button with visual feedback during sync, so that I know when email fetching is in progress.

#### Acceptance Criteria

1. THE Email_List_View SHALL display a Check Mail button with a sync/refresh icon
2. WHEN the user taps Check Mail, THE Check_Mail_Button SHALL trigger POST /api/email/sync
3. WHILE syncing is in progress, THE Check_Mail_Button SHALL display a spinning animation on the sync icon
4. WHILE syncing is in progress, THE Account_Filter_Pill for each account SHALL display a spinner indicator
5. WHEN sync completes successfully, THE Check_Mail_Button SHALL display a toast with the count of new emails per account
6. IF sync fails for an account, THEN THE Check_Mail_Button SHALL display a persistent error toast with options to open Email Settings, copy the error, or dismiss

### Requirement 33: Account Filter Pills

**User Story:** As a user, I want per-account filter pills, so that I can view emails from specific accounts only.

#### Acceptance Criteria

1. THE Email_List_View SHALL display one Account_Filter_Pill per configured email account (showing the account nickname)
2. THE Email_List_View SHALL start with all account pills in the active/selected state
3. WHEN the user taps an Account_Filter_Pill, THE Email_List_View SHALL toggle that account's filter state (active/inactive)
4. WHILE some accounts are deselected, THE Email_List_View SHALL show only emails from the selected accounts
5. IF an account fails sync, THEN THE Account_Filter_Pill SHALL display an error state (red color with warning icon prefix)
6. WHEN the user taps an error-state pill, THE Account_Filter_Pill SHALL display a detailed error toast with "Email Settings", "Copy Error", and "Dismiss" options
7. WHEN sync succeeds for an account, THE Account_Filter_Pill SHALL display a success indicator (green)
8. THE Account_Filter_Pill SHALL display the last sync time in a tooltip on long-press (e.g., "Last check: 10:32:15 AM May 18")

### Requirement 34: Unread-at-Top Toggle

**User Story:** As a user, I want to optionally sort unread emails to the top, so that I can prioritize unread messages.

#### Acceptance Criteria

1. THE Email_List_View SHALL display an "Unread at top" toggle control
2. WHEN the toggle is enabled, THE Email_List_View SHALL sort unread threads above read threads within each date group (still sorted by newest within each group)
3. WHEN the toggle is disabled, THE Email_List_View SHALL sort all threads by newest first regardless of read state (default behavior)

### Requirement 35: Auto-Check Mail Timer

**User Story:** As a user, I want emails to be checked automatically at configured intervals, so that I receive new emails without manual action.

#### Acceptance Criteria

1. WHEN the check_interval setting is not "manual", THE Email_List_View SHALL start a background timer that triggers email sync at the configured interval (5, 15, 30, or 60 minutes)
2. THE auto-check timer SHALL start 3 seconds after the Email tab loads
3. WHEN auto-check triggers, THE Email_List_View SHALL execute the same sync behavior as the manual Check Mail button (spinners, toasts, error handling)
4. WHEN the check_interval setting is "manual", THE Email_List_View SHALL not start any automatic sync timer

### Requirement 36: Contact Autocomplete

**User Story:** As a user, I want contact autocomplete in recipient fields, so that I can quickly address emails to known contacts.

#### Acceptance Criteria

1. WHEN the user types 2 or more characters in the To, CC, or BCC field, THE Compose_Zone SHALL display an Autocomplete_Dropdown with matching contacts
2. THE Autocomplete_Dropdown SHALL search contacts by both name and email address
3. THE Autocomplete_Dropdown SHALL display favorite contacts at the top of results
4. THE Autocomplete_Dropdown SHALL display at most 5 results
5. THE Autocomplete_Dropdown SHALL display each result with: star indicator (if favorite), display name, and email address
6. THE Autocomplete_Dropdown SHALL exclude contacts already added as recipient chips from the results
7. WHEN the user taps a result, THE Compose_Zone SHALL add that contact as a Recipient_Chip in the active field
8. WHEN the user presses Enter or types a comma, THE Compose_Zone SHALL chipify the current text input

### Requirement 37: Recipient Chips

**User Story:** As a user, I want styled recipient chips with contact images and colors, so that I can visually identify recipients.

#### Acceptance Criteria

1. WHEN a recipient is a known contact, THE Recipient_Chip SHALL display with a teal background tinted by the contact's color, the contact's profile image, and the contact's display name
2. WHEN a recipient is an unknown email address, THE Recipient_Chip SHALL display with a neutral parchment background and the email address as text
3. THE Recipient_Chip SHALL display a remove (✕) button
4. WHEN the user taps the remove button, THE Compose_Zone SHALL remove that recipient from the field
5. THE Recipient_Chip SHALL compute a contrast-safe text color based on its background color
6. WHEN the user blurs the recipient field with remaining valid email text, THE Compose_Zone SHALL chipify that text into a Recipient_Chip

### Requirement 38: Markdown Formatting Toolbar

**User Story:** As a user, I want a formatting toolbar for the email body, so that I can apply markdown formatting without memorizing syntax.

#### Acceptance Criteria

1. THE Compose_Zone SHALL display a Formatting_Toolbar above or below the body text area
2. THE Formatting_Toolbar SHALL include buttons for: Bold, Italic, Strikethrough, Link, Heading (H1/H2/H3 dropdown), Bullet List, Numbered List, Blockquote, Inline Code, and Horizontal Rule
3. WHEN the user taps Bold with text selected, THE Compose_Zone SHALL wrap the selection with ** markers
4. WHEN the user taps Italic with text selected, THE Compose_Zone SHALL wrap the selection with _ markers
5. WHEN the user taps Strikethrough with text selected, THE Compose_Zone SHALL wrap the selection with ~~ markers
6. WHEN the user taps Link with text selected, THE Compose_Zone SHALL wrap the selection as [text](url) format
7. WHEN the user taps a Heading option, THE Compose_Zone SHALL prefix the current line with the appropriate # markers
8. WHEN the user taps Bullet List, THE Compose_Zone SHALL prefix the current line with "- "
9. WHEN the user taps Numbered List, THE Compose_Zone SHALL prefix the current line with "1. "
10. WHEN the user taps Blockquote, THE Compose_Zone SHALL prefix the selected lines with "> "
11. WHEN the user taps Inline Code with text selected, THE Compose_Zone SHALL wrap the selection with backtick markers
12. WHEN the user taps Horizontal Rule, THE Compose_Zone SHALL insert "---" on a new line

### Requirement 39: Keyboard Shortcuts for Formatting

**User Story:** As a user with a physical keyboard, I want keyboard shortcuts for formatting, so that I can format text efficiently.

#### Acceptance Criteria

1. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+B by applying Bold formatting
2. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+I by applying Italic formatting
3. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+K by applying Link formatting
4. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+E by applying Inline Code formatting
5. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+Shift+X by applying Strikethrough formatting
6. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+Shift+8 by applying Bullet List formatting
7. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+Shift+7 by applying Numbered List formatting
8. WHILE the body textarea is focused, THE Compose_Zone SHALL respond to Ctrl+Shift+. by applying Blockquote formatting

### Requirement 40: Live Markdown Preview

**User Story:** As a user, I want a live preview of my markdown email body, so that I can see how the email will render before sending.

#### Acceptance Criteria

1. THE Compose_Zone SHALL display a rendered markdown preview below the body textarea
2. WHEN the user types in the body textarea, THE Compose_Zone SHALL update the preview with a 500ms debounce
3. THE preview SHALL render all standard markdown elements (headings, bold, italic, links, lists, blockquotes, code blocks, horizontal rules)

### Requirement 41: Render Toggle

**User Story:** As a user, I want to toggle between edit and rendered views, so that I can focus on either writing or previewing.

#### Acceptance Criteria

1. THE Compose_Zone SHALL display a Render toggle button (eye icon for "Render" / edit icon for "Edit")
2. WHEN the user taps the Render toggle while in edit mode, THE Compose_Zone SHALL hide the textarea and display only the rendered markdown view
3. WHEN the user taps the Render toggle while in render mode, THE Compose_Zone SHALL hide the rendered view and display the textarea for editing

### Requirement 42: Email Signature Auto-Apply

**User Story:** As a user, I want my configured signature automatically appended to new drafts, so that I don't have to add it manually each time.

#### Acceptance Criteria

1. WHEN a new email draft is created and the body is empty, THE Compose_Zone SHALL auto-append the configured email signature from settings
2. WHEN the user has no signature configured, THE Compose_Zone SHALL leave the body empty
3. THE Compose_Zone SHALL insert the signature as markdown text that will be converted to HTML on send

### Requirement 43: Subject and Title Sync

**User Story:** As a user, I want the email subject and chit title to stay synchronized, so that I don't have to maintain them separately.

#### Acceptance Criteria

1. WHEN the user edits the subject field, THE Compose_Zone SHALL update the chit title to match the subject value
2. WHEN the user edits the chit title and the subject is empty or matches the previous title, THE Compose_Zone SHALL update the subject to match the new title
3. THE Compose_Zone SHALL maintain bidirectional sync between subject and title fields

### Requirement 44: Undo-Send Flow

**User Story:** As a user, I want a countdown before emails are actually sent, so that I can cancel accidental sends.

#### Acceptance Criteria

1. WHEN the user taps Send, THE Compose_Zone SHALL save the draft and navigate to the Email list view
2. WHEN the Email list view loads with a pending send, THE Email_List_View SHALL display an Undo_Toast countdown (duration from email_undo_send_delay setting, default 5 seconds)
3. WHEN the countdown expires, THE Email_List_View SHALL execute POST /api/email/send/{chitId}
4. WHEN send succeeds, THE Email_List_View SHALL display "Email sent successfully." toast
5. WHEN the user taps Undo before countdown expires, THE Email_List_View SHALL display "Send cancelled." toast and take no further action
6. WHEN PGP encryption is enabled, THE Compose_Zone SHALL encrypt the body before saving the draft (prior to the undo-send countdown)

### Requirement 45: Send and Archive

**User Story:** As a user, I want to send a reply and archive the original email in one action, so that I can keep my inbox clean.

#### Acceptance Criteria

1. WHEN the email is a reply (has email_in_reply_to), THE Compose_Zone SHALL display a "Send & Archive" button alongside the Send button
2. WHEN the user taps Send & Archive, THE Compose_Zone SHALL execute the undo-send flow
3. WHEN the undo-send countdown expires for Send & Archive, THE Email_List_View SHALL send the email AND archive the original email via POST /api/email/archive-original with the In-Reply-To message ID

### Requirement 46: Send Later Modal

**User Story:** As a user, I want to schedule emails for later delivery, so that I can compose now and send at an optimal time.

#### Acceptance Criteria

1. WHEN the user taps Send Later, THE Compose_Zone SHALL display a Send_Later_Modal with date and time inputs
2. THE Send_Later_Modal SHALL set the minimum date to today
3. THE Send_Later_Modal SHALL default the time to the current time plus 1 hour
4. WHEN the user taps "Schedule", THE Send_Later_Modal SHALL save the chit and call POST /api/email/schedule/{chitId} with the selected ISO datetime
5. WHEN scheduling succeeds, THE Send_Later_Modal SHALL navigate to the Email list view with the Scheduled folder selected
6. WHEN the user taps Cancel, THE Send_Later_Modal SHALL close without scheduling

### Requirement 47: Scheduled Send Indicator

**User Story:** As a user, I want to see when an email is scheduled and be able to cancel it, so that I can manage my scheduled sends.

#### Acceptance Criteria

1. WHEN viewing a scheduled email in the editor, THE Compose_Zone SHALL display a "Scheduled: {datetime}" indicator badge
2. THE scheduled indicator SHALL include a "Cancel" button
3. WHEN the user taps Cancel on the scheduled indicator, THE Compose_Zone SHALL cancel the scheduled send via POST /api/email/schedule/{chitId} with cancel flag and remove the indicator

### Requirement 48: PGP Encryption Toggle

**User Story:** As a user, I want to encrypt outgoing emails with PGP when recipients have public keys, so that I can send secure communications.

#### Acceptance Criteria

1. WHEN composing a draft and at least one recipient has a PGP public key in their contact record, THE Compose_Zone SHALL display a PGP_Toggle button
2. WHEN the user taps the PGP_Toggle to enable encryption, THE Compose_Zone SHALL validate that ALL recipients have PGP keys on file
3. IF a recipient does not have a PGP key, THEN THE Compose_Zone SHALL display an error toast and not enable encryption
4. WHILE PGP is enabled, THE PGP_Toggle SHALL display a green lock icon with "PGP ✓" label
5. WHILE PGP is disabled, THE PGP_Toggle SHALL display an open lock icon with "PGP" label
6. WHEN a new recipient without a PGP key is added while PGP is enabled, THE Compose_Zone SHALL auto-disable PGP and display a toast explaining why
7. WHEN PGP is enabled and the user sends, THE Compose_Zone SHALL encrypt the body using all recipients' public keys before saving

### Requirement 49: PGP Decryption

**User Story:** As a user, I want to decrypt received PGP-encrypted emails, so that I can read secure messages.

#### Acceptance Criteria

1. WHEN viewing a received PGP-encrypted email, THE Compose_Zone SHALL display a banner: "This message is PGP encrypted." with a "Decrypt" button
2. WHEN the user taps Decrypt, THE Compose_Zone SHALL display a password modal asking for the account password
3. WHEN the user enters the password, THE Compose_Zone SHALL fetch the private PGP key via POST /api/auth/private-pgp-key
4. WHEN the private key is retrieved, THE Compose_Zone SHALL decrypt the message body and display it in-place as read-only text
5. WHEN decryption succeeds, THE Compose_Zone SHALL update the banner to "Message decrypted (view only — not saved)."
6. THE Compose_Zone SHALL never save the decrypted text — only the original ciphertext is persisted
7. WHEN the user navigates away from the decrypted email, THE Compose_Zone SHALL return to displaying the encrypted state

### Requirement 50: HTML Email Rendering

**User Story:** As a user, I want received HTML emails rendered properly, so that I can view formatted email content as intended.

#### Acceptance Criteria

1. WHEN viewing a received email with email_body_html content, THE Compose_Zone SHALL render the HTML in a sandboxed WebView
2. THE WebView SHALL sanitize HTML by removing forbidden tags (script, iframe, object, embed, form, input, button, select, textarea)
3. THE WebView SHALL force all links to open in the device browser (external navigation)
4. THE WebView SHALL auto-resize to fit the content height (within 200-800dp range)
5. THE Compose_Zone SHALL display an HTML/Text toggle pill allowing the user to switch between rendered HTML and plain text views
6. WHEN the user selects Text mode, THE Compose_Zone SHALL display the email_body_text in a read-only text view

### Requirement 51: External Content Blocking

**User Story:** As a user, I want external images blocked by default for privacy, so that tracking pixels and remote content don't load without my consent.

#### Acceptance Criteria

1. WHEN the email_external_content setting is "block", THE Compose_Zone SHALL replace all external image sources with transparent placeholders in the rendered HTML
2. WHEN external images are blocked, THE Compose_Zone SHALL display a banner: "External images blocked for privacy." with a "Load External Content" button
3. WHEN the user taps "Load External Content", THE Compose_Zone SHALL restore all original image sources and reload the WebView
4. WHEN the email_external_content setting is "allow", THE Compose_Zone SHALL load all external images without blocking
5. WHEN the email_external_content setting is "known_senders", THE Compose_Zone SHALL load external images only for emails from senders who are in the user's contacts

### Requirement 52: Read Receipt Checkbox

**User Story:** As a user, I want to optionally request read receipts on outgoing emails, so that I can know when recipients read my messages.

#### Acceptance Criteria

1. WHEN composing a draft email, THE Compose_Zone SHALL display a "Request read receipt" checkbox
2. WHEN the checkbox is checked, THE Compose_Zone SHALL set email_request_read_receipt to true on the chit, which adds a Disposition-Notification-To header on send
3. WHEN the checkbox is unchecked, THE Compose_Zone SHALL not request a read receipt

### Requirement 53: Download Raw .eml

**User Story:** As a user, I want to download the raw .eml file of received emails, so that I can archive or forward them outside the app.

#### Acceptance Criteria

1. WHEN viewing a received or sent email, THE Compose_Zone SHALL display a "Download Raw" button
2. WHEN the user taps Download Raw, THE Compose_Zone SHALL fetch the .eml file via GET /api/email/{chitId}/raw and save it to the device downloads folder
3. WHEN the download completes, THE Compose_Zone SHALL display a toast confirming the download

### Requirement 54: Add Sender as Contact

**User Story:** As a user, I want to quickly add an email sender as a contact, so that I can build my address book from received emails.

#### Acceptance Criteria

1. WHEN viewing a received email from a sender who is not in the user's contacts, THE Compose_Zone SHALL display an "Add Contact" button next to the From field
2. WHEN the user taps Add Contact, THE Compose_Zone SHALL navigate to the contact editor pre-populated with the sender's email address and display name
3. WHEN the sender is already a known contact, THE Compose_Zone SHALL not display the Add Contact button

### Requirement 55: Email Thread View in Editor

**User Story:** As a user, I want to see the full conversation thread when viewing an email in the editor, so that I have context for replies.

#### Acceptance Criteria

1. WHEN viewing an email that is part of a conversation (more than 1 related message), THE Compose_Zone SHALL display a "Thread (N messages)" section below the email body
2. WHEN the thread has 3 or fewer messages, THE Compose_Zone SHALL display a simple list showing sender, date, and body preview (100 chars) for each message
3. WHEN the thread has more than 3 messages, THE Compose_Zone SHALL display a collapsed "stacked" view showing the message count and "Expand" button
4. WHEN the user taps Expand on a stacked thread, THE Compose_Zone SHALL display the full scrollable list of all messages (max height 60% of viewport)
5. THE Compose_Zone SHALL highlight the current message in the thread list with a distinct border/background
6. WHEN the user taps another message in the thread list, THE Compose_Zone SHALL navigate to that email's editor
7. THE thread view SHALL display nested chits interspersed with email messages, showing nest icon, title, and content preview

### Requirement 56: Attachment Bar

**User Story:** As a user, I want to see and interact with email attachments in the editor, so that I can view and download attached files.

#### Acceptance Criteria

1. WHEN an email has attachments, THE Compose_Zone SHALL display an attachment bar at the bottom of the email body area
2. THE attachment bar SHALL display each attachment as a clickable chip showing: icon/thumbnail, filename, and file size
3. WHEN the user taps an attachment chip, THE Compose_Zone SHALL open an attachment preview modal
4. WHEN the user long-presses an attachment chip, THE Compose_Zone SHALL display a context menu with "View" and "Download" options
5. THE attachment bar SHALL display image attachments with actual thumbnail previews
6. THE attachment bar SHALL display non-image attachments with a file type icon

### Requirement 57: Email-Specific Save Buttons

**User Story:** As a user, I want email-appropriate save actions replacing the normal save buttons, so that I can send, save drafts, or send-and-archive.

#### Acceptance Criteria

1. WHEN the editor is in email mode with content, THE Compose_Zone SHALL hide the normal save buttons and display email-specific buttons
2. THE Compose_Zone SHALL always display a "Save Draft" button when email has any content
3. THE Compose_Zone SHALL display a "Send" button only when To, Subject, and Body all have content
4. WHEN the email is a reply, THE Compose_Zone SHALL display a "Send & Archive" button with the same visibility rules as Send
5. WHEN the user taps Save Draft, THE Compose_Zone SHALL save the chit without sending

### Requirement 58: Existing Draft Detection

**User Story:** As a user, I want the app to detect existing reply/forward drafts, so that I don't accidentally create duplicate drafts.

#### Acceptance Criteria

1. WHEN the user initiates a Reply action, THE Compose_Zone SHALL check for an existing draft with email_in_reply_to matching the original message's Message-ID
2. WHEN an existing reply draft is found, THE Compose_Zone SHALL navigate to that existing draft instead of creating a new one
3. WHEN the user initiates a Forward action, THE Compose_Zone SHALL check for an existing draft with a matching normalized subject
4. WHEN an existing forward draft is found, THE Compose_Zone SHALL navigate to that existing draft instead of creating a new one

### Requirement 59: Multi-Account Management

**User Story:** As a user, I want to manage multiple email accounts in settings, so that I can add, edit, test, and remove accounts.

#### Acceptance Criteria

1. THE Email Settings screen SHALL display a summary of configured accounts as pill chips showing each account's email address
2. THE Email Settings screen SHALL include a "Manage Accounts" button that opens an accounts modal
3. THE accounts modal SHALL display a list view showing all configured accounts (icon, nickname/email, server info)
4. WHEN the user taps an account in the list, THE accounts modal SHALL navigate to the edit view for that account
5. THE accounts modal SHALL include an "Add Account" button that opens a blank edit view
6. THE account edit view SHALL include fields for: Nickname, Email Address, Display Name, Username, Password (with visibility toggle), IMAP Host, IMAP Port, IMAP Security (SSL/TLS, STARTTLS, None), SMTP Host, SMTP Port, SMTP Security (STARTTLS, SSL/TLS, None)
7. THE account edit view SHALL include a "Back" button to return to the list view
8. THE account edit view SHALL include a "Delete" button with confirmation to remove the account

### Requirement 60: Test Connection

**User Story:** As a user, I want to test email account connectivity, so that I can verify my server settings are correct.

#### Acceptance Criteria

1. THE account edit view SHALL include a "Test Connection" button
2. WHEN the user taps Test Connection, THE account edit view SHALL test both IMAP and SMTP connectivity independently via POST /api/email/test-connection
3. WHEN both connections succeed, THE account edit view SHALL display "IMAP & SMTP connected" with a success indicator
4. WHEN a connection fails, THE account edit view SHALL display which connection failed (IMAP, SMTP, or both) with error details

### Requirement 61: Signature Editor

**User Story:** As a user, I want to edit my email signature with markdown and live preview, so that I can create a formatted signature.

#### Acceptance Criteria

1. THE Email Settings screen SHALL display the current signature as an inline preview with an "Edit Signature" button
2. WHEN the user taps Edit Signature, THE Email Settings screen SHALL display a signature editor modal
3. THE signature editor modal SHALL include a markdown textarea (top half) with keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K)
4. THE signature editor modal SHALL include a live-rendered markdown preview (bottom half) that updates with 500ms debounce
5. THE signature editor modal SHALL include "Done" and "Cancel" buttons
6. WHEN the user taps Done, THE signature editor modal SHALL save the signature to settings
7. WHEN the user taps Cancel or presses back, THE signature editor modal SHALL close without saving

### Requirement 62: Privacy Settings

**User Story:** As a user, I want to configure email privacy settings, so that I can control tracking protection and read receipts.

#### Acceptance Criteria

1. THE Email Settings screen SHALL include a "Block Tracking Pixels" checkbox (default: checked)
2. THE Email Settings screen SHALL include an "External Content" selector with options: "Allow", "Block", "Known Senders Only"
3. THE Email Settings screen SHALL include a "Read Receipts" selector with options: "Never", "Always", "Ask", "Contacts Only"
4. THE Email Settings screen SHALL include an "Undo Send Delay" number input (default: 5 seconds)
5. WHEN the user changes any privacy setting, THE Email Settings screen SHALL persist the change to the server settings

### Requirement 63: Display Settings

**User Story:** As a user, I want to configure email display preferences, so that I can customize how my email list appears.

#### Acceptance Criteria

1. THE Email Settings screen SHALL include a "Group By" selector with options: "Date" or "None"
2. THE Email Settings screen SHALL include a "Paginate Email" checkbox to enable/disable showing 50 per page with Load More
3. WHEN the user changes a display setting, THE Email Settings screen SHALL persist the change and the Email_List_View SHALL reflect the new setting on next load

### Requirement 64: Bundle Settings

**User Story:** As a user, I want to configure bundle behavior in settings, so that I can control how email categorization works.

#### Acceptance Criteria

1. THE Email Settings screen SHALL include a "Bundles Enabled" checkbox to show/hide bundle tabs
2. THE Email Settings screen SHALL include a "Multi-Placement" checkbox to allow emails in multiple bundles simultaneously
3. THE Email Settings screen SHALL include a "Show Count" selector with options: "Both", "Unread Only", "Total Only", "None"
4. THE Email Settings screen SHALL include auto-bundle toggle checkboxes for each auto-bundle (Newsletters, Receipts, Calendar Invites) showing name and description
5. WHEN the user toggles an auto-bundle off, THE Email Settings screen SHALL disable that auto-bundle via POST /api/bundles/{id}/disable

### Requirement 65: Backfill

**User Story:** As a user, I want to backfill all historical emails from my accounts, so that I can have my full email history in the app.

#### Acceptance Criteria

1. THE Email Settings screen SHALL include a "Backfill" button
2. WHEN the user taps Backfill, THE Email Settings screen SHALL call POST /api/email/backfill-estimate and display the estimated message count and size (e.g., "~N messages (~M MB)")
3. WHEN the estimate is displayed, THE Email Settings screen SHALL show a confirmation dialog asking the user to proceed
4. WHEN the user confirms, THE Email Settings screen SHALL trigger POST /api/email/sync with the backfill flag
5. WHEN backfill completes, THE Email Settings screen SHALL display a result toast: "N imported" or an error message
6. WHEN the user cancels the confirmation, THE Email Settings screen SHALL take no action
