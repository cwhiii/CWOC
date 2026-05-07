# Requirements Document

## Introduction

Email Bundles adds Google Inbox-style bundle categorization to CWOC's Email tab. A bundle is a virtual sub-inbox that groups emails by user-defined rules. Bundles appear as tabs in a permanent toolbar at the top of the Email tab view area. The toolbar also contains bulk action controls (archive, tag, mark read/unread) that are always visible but greyed out until emails are selected via checkboxes.

The feature integrates with the existing Rules Engine — each bundle is backed by one or more rules with trigger_type "email_received" that classify incoming emails into the bundle. Two default bundles ship out of the box: "From Contacts" (emails from senders in the user's contacts list) and "Everything Else" (a catch-all that cannot be removed). Users can create additional bundles via a "+" button that opens a modal for naming and describing the bundle, then links to the Rules Engine for defining classification rules.

Bundles can be enabled or disabled in a setting on the settings page in a few bucks called inboxes/email/. Even if they're disabled the other tool bar with a gray out check box control buttons stays in place.

### Architectural Decisions & Rationale

#### Decision 1: Bundles as a Lightweight Data Model (Not Full Rules)

Bundles are stored as their own records in a `bundles` table, each referencing one or more rules by ID. This keeps the bundle concept (name, description, display order, default status) separate from the rule logic. A bundle is essentially metadata that groups rules together for display purposes.

**Why:** Bundles need properties that rules don't have (display order as tabs, descriptions for tooltips, "cannot be removed" flag). Storing these as rule metadata would pollute the rules model. A separate lightweight table is cleaner.

#### Decision 2: Classification at Sync Time

When emails are synced (via Check Mail), the Rules Engine already evaluates "email_received" rules. Bundle classification piggybacks on this — a bundle rule's action assigns a bundle tag (e.g., `CWOC_System/Bundle/From Contacts`) to the email chit. The Email tab then filters by these tags to populate bundle views.

**Why:** This reuses the existing Rules Engine trigger/evaluation infrastructure with zero new evaluation logic. Bundle membership is just a tag, which integrates with CWOC's existing tag-based filtering.

#### Decision 3: "Everything Else" as Computed, Not Tagged

The "Everything Else" bundle doesn't use a tag. Instead, it displays all inbox emails that don't have ANY bundle tag. This ensures every email appears somewhere without requiring a catch-all rule that could conflict with user rules.

**Why:** A catch-all rule would need to run after all other bundle rules and would be fragile. Computing "Everything Else" as "inbox emails minus those with bundle tags" is simpler and always correct.

#### Decision 4: Permanent Toolbar Replaces Dynamic Bulk Bar

The current Email tab shows a bulk actions bar only when items are selected. This feature replaces that with a permanent two-row toolbar: Row 1 has bulk action controls (always visible, greyed out when nothing selected), Row 2 has bundle tabs. This matches the Google Inbox UX pattern.

**Why:** The user explicitly requested a permanent toolbar with greyed-out controls. This provides better discoverability of bulk actions and makes bundle navigation always accessible.

---

## Glossary

- **Bundle**: A named virtual sub-inbox that groups email chits by rule-based classification. Displayed as a tab in the Email tab toolbar. Each bundle has a name, description, display order, and one or more associated rules.
- **Bundle_Toolbar**: A permanent two-row toolbar at the top of the Email tab view area. Row 1 contains bulk action controls (select all, archive, tag, mark read/unread). Row 2 contains bundle tabs.
- **Bundle_Tab**: A clickable tab in the second row of the Bundle_Toolbar representing a single bundle. Shows the bundle name; hovering shows the description as a tooltip.
- **Bundle_Tag**: A system tag in the format `CWOC_System/Bundle/{bundle_name}` assigned to email chits by bundle rules to classify them into a bundle.
- **Bundle_Rule**: A rule in the Rules Engine with trigger_type "email_received" whose action assigns a Bundle_Tag to matching emails. Each bundle must have at least one associated rule.
- **Bundle_Modal**: A modal dialog for creating new bundles, with fields for name and description, and a button to navigate to the Rules Engine to define the bundle's classification rule.
- **Default_Bundle**: One of the two bundles that ship out of the box: "From Contacts" and "Everything Else".
- **Everything_Else_Bundle**: A special default bundle that displays all inbox emails not classified into any other bundle. This bundle cannot be removed or renamed.
- **From_Contacts_Bundle**: A default bundle that displays emails from senders whose email address matches an entry in the user's contacts list.

---

## Requirements

### Requirement 1: Bundle Data Model and Storage

**User Story:** As a CWOC user, I want my email bundles stored persistently in the database, so that my bundle configuration survives server restarts and is available whenever I use the app.

#### Acceptance Criteria

1. THE Backend SHALL store each Bundle in a SQLite `bundles` table with columns: id (TEXT PRIMARY KEY), owner_id (TEXT), name (TEXT), description (TEXT), display_order (INTEGER DEFAULT 0), is_default (BOOLEAN DEFAULT 0), removable (BOOLEAN DEFAULT 1), created_datetime (TEXT), modified_datetime (TEXT)
2. THE Backend SHALL create the `bundles` table via an inline migration in `migrations.py` with column-existence checks, following the existing CWOC migration pattern
3. THE Backend SHALL scope all bundle queries by owner_id so that each user can only read, update, and delete bundles owned by that user
4. THE Backend SHALL store a `bundle_rules` junction table with columns: id (TEXT PRIMARY KEY), bundle_id (TEXT), rule_id (TEXT), owner_id (TEXT), created_datetime (TEXT) to associate bundles with their classification rules
5. THE Backend SHALL create the `bundle_rules` junction table via the same migration function

### Requirement 2: Default Bundles Initialization

**User Story:** As a CWOC user, I want two default bundles ("From Contacts" and "Everything Else") created automatically, so that I have useful email categorization out of the box without manual setup.

#### Acceptance Criteria

1. WHEN a user's bundles are queried and no bundles exist for that user, THE Backend SHALL automatically create two default bundles: "From Contacts" (display_order 0, is_default true, removable true) and "Everything Else" (display_order 1, is_default true, removable false)
2. THE Backend SHALL create a default rule for the "From Contacts" bundle with trigger_type "email_received" and a condition that checks whether the sender's email address matches any email address in the user's contacts list
3. THE Everything_Else_Bundle SHALL have removable set to false, preventing deletion via the API or UI
4. THE Everything_Else_Bundle SHALL NOT have an associated rule — its contents are computed as all inbox emails that do not carry any Bundle_Tag
5. THE From_Contacts_Bundle SHALL have a description of "Emails from people in your contacts list"
6. THE Everything_Else_Bundle SHALL have a description of "Emails not matched by any other bundle"

### Requirement 3: Bundle Classification via Rules Engine

**User Story:** As a CWOC user, I want bundles to classify emails using the existing Rules Engine, so that I can leverage the full power of condition trees (AND/OR groups, field matching, regex) to define which emails belong in each bundle.

#### Acceptance Criteria

1. WHEN a new email is synced via IMAP, THE Rules_Engine SHALL evaluate all enabled bundle rules (trigger_type "email_received") and assign the appropriate Bundle_Tag to matching emails
2. THE Bundle_Rule action type SHALL be "add_tag" with the tag value set to `CWOC_System/Bundle/{bundle_name}` where bundle_name matches the associated bundle's name
3. WHEN multiple bundle rules match a single email AND the `bundles_multi_placement` setting is enabled, THE Backend SHALL assign all matching Bundle_Tags so that an email can appear in multiple bundles
4. WHEN multiple bundle rules match a single email AND the `bundles_multi_placement` setting is disabled (default), THE Backend SHALL evaluate bundles in display_order and assign ONLY the first matching Bundle_Tag (leftmost/highest-priority bundle wins)
5. THE From_Contacts_Bundle rule SHALL use a condition that resolves the sender's email address against the user's contacts list, returning true if the sender matches any contact email
6. WHEN a bundle is renamed, THE Backend SHALL update the Bundle_Tag on all existing email chits that carry the old tag to reflect the new bundle name
7. WHEN a bundle is deleted, THE Backend SHALL remove the Bundle_Tag from all email chits that carry it and delete the associated bundle rules

### Requirement 4: Bundle Toolbar — Permanent Action Controls

**User Story:** As a CWOC user, I want a permanent toolbar at the top of the Email tab with bulk action controls always visible, so that I can see available actions at a glance and use them immediately when I select emails.

#### Acceptance Criteria

1. THE Email_Tab SHALL display a permanent Bundle_Toolbar at the top of the view area, replacing the current dynamic bulk actions bar
2. THE Bundle_Toolbar first row SHALL contain: a "Select All" checkbox, an archive button, a tag button, and a mark read/unread toggle button
3. WHILE no email checkboxes are selected, THE Bundle_Toolbar action controls (archive, tag, mark read/unread) SHALL appear greyed out and be non-interactive
4. WHEN one or more email checkboxes are selected, THE Bundle_Toolbar action controls SHALL become active (full color, clickable) and display a count of selected items
5. THE Bundle_Toolbar SHALL remain fixed at the top of the email view area and not scroll with the email list
6. THE Bundle_Toolbar SHALL use the existing parchment theme with brown tones and Lora serif font, matching the CWOC visual aesthetic
7. THE Bundle_Toolbar SHALL be mobile-friendly, with controls wrapping appropriately on small screens

### Requirement 5: Bundle Toolbar — Bundle Tabs

**User Story:** As a CWOC user, I want bundle tabs in the toolbar so that I can quickly switch between different email categories without navigating away from the Email tab.

#### Acceptance Criteria

1. THE Bundle_Toolbar second row SHALL display all user bundles as clickable tabs, ordered by display_order ascending
2. WHEN the user clicks a Bundle_Tab, THE Email_Tab SHALL filter the email list to show only emails classified in that bundle
3. WHEN the "Everything Else" Bundle_Tab is active, THE Email_Tab SHALL display all inbox emails that do not carry any Bundle_Tag
4. THE active Bundle_Tab SHALL be visually distinguished from inactive tabs (darker background, underline, or similar indicator)
5. WHEN the user hovers over a Bundle_Tab, THE Bundle_Tab SHALL display the bundle's description as a tooltip
6. THE Bundle_Toolbar second row SHALL include a "+" button after the last bundle tab for creating new bundles
7. THE Bundle_Tabs SHALL be horizontally scrollable on mobile when there are more tabs than fit the screen width
8. THE Bundle_Tabs SHALL display an unread count badge on each tab showing the number of unread emails in that bundle

### Requirement 6: Bundle Creation Modal

**User Story:** As a CWOC user, I want to create new bundles via a simple modal, so that I can organize my email into custom categories without leaving the Email tab.

#### Acceptance Criteria

1. WHEN the user clicks the "+" button in the Bundle_Toolbar, THE Bundle_Modal SHALL open as a centered overlay following the CWOC modal pattern (parchment background, brown border, Lora font)
2. THE Bundle_Modal SHALL contain: a text input for the bundle name (required), a textarea for the description (optional), and a "Define Rule" button
3. WHEN the user clicks "Define Rule", THE Bundle_Modal SHALL navigate to the Rule Editor page with the trigger type pre-set to "email_received" and a return URL parameter so the user can navigate back to the Email tab after saving the rule
4. THE Bundle_Modal SHALL validate that the bundle name is non-empty and not a duplicate of an existing bundle name before allowing creation
5. THE Bundle_Modal SHALL have "Cancel" and "Create" buttons following the standard CWOC modal button pattern
6. IF the user attempts to create a bundle without defining at least one rule, THEN THE Bundle_Modal SHALL display a validation message indicating that all bundles must have at least one rule
7. THE Bundle_Modal SHALL be dismissible via the Escape key, following the CWOC ESC priority chain

### Requirement 7: Bundle Management

**User Story:** As a CWOC user, I want to edit, reorder, and delete my bundles, so that I can keep my email organization current as my needs change.

#### Acceptance Criteria

1. WHEN the user right-clicks (or long-presses on mobile) a Bundle_Tab, THE Email_Tab SHALL show a context menu with options: Edit, Reorder, and Delete
2. WHEN the user selects "Edit" from the context menu, THE Bundle_Modal SHALL open pre-populated with the bundle's current name and description
3. WHEN the user selects "Delete" from the context menu, THE Email_Tab SHALL show a confirmation prompt before deleting the bundle
4. IF the user attempts to delete the Everything_Else_Bundle, THEN THE Email_Tab SHALL display a message indicating that this bundle cannot be removed
5. WHEN a bundle is deleted, THE Backend SHALL remove the Bundle_Tag from all classified emails and delete the associated bundle rules
6. THE user SHALL be able to reorder bundle tabs via drag-and-drop, with the new order persisted to the database
7. WHEN the user edits a bundle name, THE Backend SHALL update the Bundle_Tag on all existing classified emails to reflect the new name

### Requirement 8: Bundle CRUD API

**User Story:** As a developer, I want REST API endpoints for managing bundles, so that the frontend can create, read, update, and delete bundles through standard HTTP calls.

#### Acceptance Criteria

1. THE Backend SHALL expose a GET `/api/bundles` endpoint that returns all bundles owned by the authenticated user, sorted by display_order ascending, including the associated rule IDs for each bundle
2. THE Backend SHALL expose a POST `/api/bundles` endpoint that creates a new bundle with a generated UUID, sets owner_id to the authenticated user, and returns the created bundle
3. THE Backend SHALL expose a PUT `/api/bundles/{bundle_id}` endpoint that updates an existing bundle's name, description, or display_order if owned by the authenticated user
4. THE Backend SHALL expose a DELETE `/api/bundles/{bundle_id}` endpoint that deletes a bundle if owned by the authenticated user and the bundle has removable set to true
5. THE Backend SHALL expose a PUT `/api/bundles/reorder` endpoint that accepts an ordered list of bundle IDs and updates their display_order values to match the new order
6. THE Backend SHALL expose a POST `/api/bundles/{bundle_id}/rules` endpoint that associates an existing rule with a bundle
7. THE Backend SHALL expose a DELETE `/api/bundles/{bundle_id}/rules/{rule_id}` endpoint that removes a rule association from a bundle
8. IF a bundle CRUD operation targets a bundle not owned by the authenticated user, THEN THE Backend SHALL return HTTP 404 to avoid leaking the existence of other users' bundles
9. IF a DELETE request targets a bundle with removable set to false, THEN THE Backend SHALL return HTTP 403 with a message indicating the bundle cannot be removed

### Requirement 9: Bundle Email Filtering

**User Story:** As a CWOC user, I want the email list to show only emails belonging to the selected bundle, so that I can focus on one category of email at a time.

#### Acceptance Criteria

1. WHEN a Bundle_Tab is active, THE Email_Tab SHALL filter the displayed emails to only those carrying the corresponding Bundle_Tag in their tags list
2. WHEN the Everything_Else_Bundle tab is active, THE Email_Tab SHALL display emails that are in the inbox sub-filter, not archived, and do not carry any Bundle_Tag (tags matching the pattern `CWOC_System/Bundle/*`)
3. THE Bundle filtering SHALL compose with the existing email sub-filter (Inbox, Sent, Drafts, Trash, Archived) — bundle tabs only apply when the Inbox sub-filter is active
4. WHEN the sub-filter is not "Inbox", THE Bundle_Tabs SHALL be visually dimmed and non-interactive, since bundles only categorize inbox emails
5. THE Email_Tab SHALL remember the last active bundle tab and restore it when returning to the Email tab
6. THE email count displayed on each Bundle_Tab badge SHALL update in real-time as emails are archived, deleted, or reclassified

### Requirement 10: Bundle Tag Namespace

**User Story:** As a developer, I want bundle tags to use a reserved namespace, so that they don't conflict with user-created tags and are managed exclusively by the bundle system.

#### Acceptance Criteria

1. THE Backend SHALL use the tag format `CWOC_System/Bundle/{bundle_name}` for all bundle classification tags
2. THE existing reserved tag namespace enforcement (CWOC_System/ prefix protection) SHALL prevent users from manually creating or assigning bundle tags
3. WHEN a bundle rule fires and assigns a Bundle_Tag, THE Backend SHALL add the tag using the same mechanism as other rule actions (add_tag action type)
4. THE Backend SHALL strip any user-submitted tags matching the pattern `CWOC_System/Bundle/*` from chit create and update requests, consistent with existing CWOC_System/ tag protection

### Requirement 12: Multi-Placement Setting

**User Story:** As a CWOC user, I want to control whether emails can appear in multiple bundles or only in the highest-priority (leftmost) matching bundle, so that I can choose between comprehensive categorization and a clean single-placement inbox.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a "Bundle Multi-Placement" toggle in the Email section, defaulting to disabled (single-placement mode)
2. WHEN multi-placement is disabled (default), THE classification engine SHALL evaluate bundle rules in display_order (left-to-right) and assign the email to ONLY the first matching bundle — once a match is found, no further bundle rules are evaluated for that email
3. WHEN multi-placement is enabled, THE classification engine SHALL evaluate ALL bundle rules and assign the email to every matching bundle (an email can appear in multiple bundle tabs)
4. THE Backend SHALL store the multi-placement setting as a boolean field `bundles_multi_placement` in the user's settings record (default: false)
5. THE Settings_Page SHALL display a brief explanation below the toggle: "When enabled, emails can appear in multiple bundles. When disabled, each email goes to the first matching bundle (left to right)."
6. WHEN the multi-placement setting is changed, THE Backend SHALL NOT retroactively reclassify existing emails — the new setting only applies to newly synced emails going forward
7. THE GET `/api/bundles` response SHALL include the current `bundles_multi_placement` setting value so the frontend knows which mode is active

---

### Requirement 11: Bundle Toolbar Styling

**User Story:** As a CWOC user, I want the bundle toolbar to match the 1940s parchment aesthetic of CWOC, so that the feature feels visually integrated with the rest of the application.

#### Acceptance Criteria

1. THE Bundle_Toolbar SHALL use CSS variables from `styles-variables.css` for colors, borders, and shadows
2. THE Bundle_Toolbar action controls SHALL use muted brown tones when greyed out and darker brown tones when active
3. THE Bundle_Tabs SHALL use a tab-bar style with the active tab having a darker parchment background and a bottom border accent
4. THE "+" button SHALL be styled as a subtle circular button matching the tab height, with a brown border and "+" icon
5. THE Bundle_Toolbar SHALL have a subtle bottom border or shadow to visually separate it from the email list below
6. THE unread count badges on Bundle_Tabs SHALL use a small circular indicator with a contrasting background color

