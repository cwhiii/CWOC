# Requirements Document

## Introduction

Threaded "Nests" allow users to attach any non-email chit to an existing email thread. A nested chit appears inline within the email thread view alongside regular email messages, distinguished by a special nest icon. This bridges the gap between email conversations and other CWOC content (tasks, notes, checklists, etc.) by letting users associate related chits directly with the email thread they pertain to.

The feature adds a nest button to the chit editor title row (alongside pin, owner chip, and email button). Clicking the nest button associates the chit with an email thread. When active, the button turns blue (matching the existing active-button pattern) and displays the first 15 characters of the thread's subject line. The nested chit then appears as another entry in the email thread's expanded view, both in the Email tab and in the editor's expanded thread display.

A nested chit is sorted within the thread by its due date or start date. If it has neither, it appears as the first item below the thread's top-level email. Critically, a nested chit never appears as the topmost visible card of a collapsed thread (that's always a real email), and never appears independently in the email inbox — it only shows up inside its thread.

### Architectural Decisions & Rationale

#### Decision 1: Thread Reference Stored on the Chit

A nested chit stores a reference to the email thread it belongs to via a `nest_thread_id` field — the `id` of any email chit in the target thread. The threading system already groups emails by message IDs, references, and subject-line fallback, so referencing any single chit in the thread is sufficient to locate the full thread.

**Why:** This avoids creating a separate junction table. A chit can only be nested into one thread at a time, making a single field on the chit the simplest and most consistent approach. It also means nests participate in the existing chit CRUD lifecycle with no extra cleanup logic.

#### Decision 2: Nests Appear in Thread Grouping via Frontend Injection

The `_emailGroupByThread()` function currently only processes email chits. For nests, the frontend fetches nested chits separately and injects them into the appropriate thread's message list before rendering. This keeps the core threading algorithm unchanged.

**Why:** The threading algorithm relies on email-specific headers (Message-ID, In-Reply-To, References). Non-email chits don't have these headers, so they can't participate in the algorithm directly. Injecting them after grouping is cleaner and avoids polluting the threading logic.

#### Decision 3: Nest Button in Title Row

The nest button lives in the editor title row's `pinned-archived-group` div, after the owner chip and before the email button. It follows the same `status-icon-button` pattern as the pin button.

**Why:** The title row already contains contextual action buttons. Adding the nest button here keeps it discoverable without cluttering zone headers. The blue active state matches the existing pin button pattern.

---

## Glossary

- **Nest**: A non-email chit that has been associated with an email thread via the `nest_thread_id` field. The chit appears inline in the thread view alongside email messages.
- **Nest_Button**: A button in the chit editor title row that toggles the nest association. When active, it displays blue and shows the first 15 characters of the associated thread's subject.
- **Nest_Icon**: A visual indicator (bird nest or similar icon) displayed on nested chits when they appear in the email thread view, distinguishing them from regular email messages.
- **Thread_Subject**: The email subject line of the thread a chit is nested into, used for display in the nest button label (truncated to 15 characters).
- **Nest_Thread_ID**: A field on the chit storing the `id` of an email chit in the target thread. This reference links the non-email chit to the email thread.
- **Thread_Picker**: A UI component (modal or dropdown) that lets the user select which email thread to nest the chit into.
- **Editor_Title_Row**: The label row in the chit editor containing the title input, pin button, recurrence icon, owner chip, and email button.

---

## Requirements

### Requirement 1: Nest Data Model

**User Story:** As a CWOC user, I want my nest associations stored persistently on the chit, so that the link between a chit and an email thread survives page reloads and server restarts.

#### Acceptance Criteria

1. THE Backend SHALL store a `nest_thread_id` field on the chits table as an optional TEXT column (NULL by default) referencing the id of an email chit in the target thread
2. THE Backend SHALL add the `nest_thread_id` column via an inline migration in `migrations.py` with a column-existence check, following the existing CWOC migration pattern
3. THE Chit model in `models.py` SHALL include `nest_thread_id` as an Optional[str] field defaulting to None
4. WHEN a chit has a non-null `nest_thread_id`, THE Backend SHALL validate on save that the referenced chit exists and is an email chit (has a non-null `email_message_id` or `email_status`)
5. WHEN the referenced email chit is permanently deleted, THE Backend SHALL set `nest_thread_id` to NULL on any chits that reference it

### Requirement 2: Nest Button in Editor Title Row

**User Story:** As a CWOC user, I want a nest button in the chit editor title row, so that I can quickly associate any chit with an email thread without navigating away from the editor.

#### Acceptance Criteria

1. THE Editor_Title_Row SHALL display a Nest_Button after the owner chip and before the email quick-activate button, using the `status-icon-button` class pattern
2. THE Nest_Button SHALL use a nest icon (Font Awesome or similar) that is visually distinct and recognizable
3. WHILE the chit has no nest association (nest_thread_id is null), THE Nest_Button SHALL appear in its default inactive state (muted brown, matching other inactive title row buttons)
4. WHILE the chit has an active nest association, THE Nest_Button SHALL appear in the active blue color matching the existing active button pattern (same blue as the pinned button when active)
5. WHILE the chit has an active nest association, THE Nest_Button SHALL display the first 15 characters of the Thread_Subject as a label next to the icon
6. IF the Thread_Subject is shorter than 15 characters, THEN THE Nest_Button SHALL display the full subject without truncation
7. THE Nest_Button SHALL NOT appear on chits that are themselves email chits (chits with a non-null `email_message_id` or `email_status`), since email chits already belong to threads natively

### Requirement 3: Thread Selection

**User Story:** As a CWOC user, I want to pick which email thread to nest my chit into, so that I can associate it with the correct conversation.

#### Acceptance Criteria

1. WHEN the user clicks the Nest_Button while the chit has no nest association, THE Editor SHALL open a Thread_Picker showing recent email threads
2. THE Thread_Picker SHALL display threads as a scrollable list, each entry showing the thread subject and the most recent message date
3. THE Thread_Picker SHALL include a search/filter input at the top that filters threads by subject text
4. THE Thread_Picker SHALL be styled as a CWOC modal (parchment background, brown border, Lora font) following the existing modal pattern
5. WHEN the user selects a thread from the Thread_Picker, THE Editor SHALL set the chit's `nest_thread_id` to the id of the most recent email chit in that thread and mark the editor as dirty
6. THE Thread_Picker SHALL be dismissible via the Escape key, following the CWOC ESC priority chain
7. THE Thread_Picker SHALL be mobile-friendly with touch-scrollable list and appropriately sized tap targets

### Requirement 4: Nest Toggle and Removal

**User Story:** As a CWOC user, I want to remove a nest association by clicking the active nest button, so that I can un-nest a chit from a thread if I associated it by mistake.

#### Acceptance Criteria

1. WHEN the user clicks the Nest_Button while the chit has an active nest association, THE Editor SHALL remove the nest association by setting `nest_thread_id` to null and mark the editor as dirty
2. WHEN the nest association is removed, THE Nest_Button SHALL return to its inactive state (muted color, no subject label)
3. THE nest association change SHALL only be persisted when the user saves the chit (following the existing editor dirty-state pattern)

### Requirement 5: Nested Chits in Email Thread View

**User Story:** As a CWOC user, I want nested chits to appear inline in the email thread view, so that I can see all related content (emails and associated chits) together in one place.

#### Acceptance Criteria

1. WHEN an email thread is expanded in the Email tab, THE Email_Tab SHALL include any non-email chits whose `nest_thread_id` references a chit in that thread
2. THE nested chit SHALL be sorted within the thread by its `due_date` if present, then by `start_datetime` if present, then placed as the first item after the thread's top-level email (the one displaying subject/sender) if neither date exists
3. A nested chit SHALL NEVER appear as the topmost/visible card of a collapsed thread — the thread's top card must always be an actual email chit showing subject, sender, and date
4. A nested chit SHALL NEVER appear independently in the email inbox list — it only appears within its associated thread's expanded view
5. THE nested chit entry SHALL display a Nest_Icon to visually distinguish it from regular email messages in the thread
6. THE nested chit entry SHALL display the chit's title, and a brief preview of its content (first line of note, or checklist summary, or status)
7. WHEN the user clicks on a nested chit entry in the thread view, THE Email_Tab SHALL navigate to the chit editor for that chit (same behavior as clicking an email navigates to its editor)
8. THE nested chit entry SHALL use the same card styling as email messages in the thread but with the Nest_Icon replacing the email-specific indicators (read/unread dot, reply arrow)
9. THE thread message count badge SHALL include nested chits in its total count

### Requirement 6: Nested Chits in Editor Thread Display

**User Story:** As a CWOC user, I want to see nested chits when viewing a thread from within the editor, so that the expanded thread view in the email zone also shows associated non-email content.

#### Acceptance Criteria

1. WHEN the email zone displays a thread's messages in the editor expanded view, THE Editor SHALL include nested chits in the thread message list
2. THE nested chit entries in the editor thread view SHALL use the same Nest_Icon and display format as in the Email tab thread view
3. WHEN the user clicks a nested chit entry in the editor thread view, THE Editor SHALL navigate to that chit's editor page

### Requirement 7: Backend API Support

**User Story:** As a developer, I want the existing chit CRUD endpoints to handle the nest_thread_id field, so that the frontend can save and retrieve nest associations through standard chit operations.

#### Acceptance Criteria

1. THE GET `/api/chits` endpoint SHALL include `nest_thread_id` in the chit response payload when the field is non-null
2. THE PUT `/api/chits/{id}` endpoint SHALL accept `nest_thread_id` in the request body and persist it to the database
3. THE GET `/api/email/thread/{chit_id}` endpoint SHALL include nested chits (chits with `nest_thread_id` referencing any chit in the thread) in its response, with a `is_nest` boolean flag set to true
4. THE Backend SHALL expose a GET `/api/email/threads/recent` endpoint that returns the 20 most recent email threads (subject and latest date) for use by the Thread_Picker
5. THE GET `/api/email/threads/recent` endpoint SHALL accept an optional `q` query parameter to filter threads by subject text (case-insensitive substring match)

### Requirement 8: Nest Visual Styling

**User Story:** As a CWOC user, I want the nest button and nested chit indicators to match the CWOC parchment aesthetic, so that the feature feels visually integrated with the rest of the application.

#### Acceptance Criteria

1. THE Nest_Button active state SHALL use the same blue color as other active editor buttons (matching the pinned button active color)
2. THE Nest_Button subject label SHALL be displayed in a smaller font size adjacent to the icon, truncated with an ellipsis if the container is too narrow
3. THE Nest_Icon in thread views SHALL be visually distinct from email indicators, using a nest or bird-related icon from Font Awesome or a custom SVG
4. THE nested chit card in thread views SHALL have a subtle left border or background tint to differentiate it from email message cards while maintaining the parchment theme
5. THE Thread_Picker modal SHALL follow the standard CWOC modal styling (parchment background #fffaf0, brown border #6b4e31, Lora font)
6. THE Nest_Button and all nest-related UI elements SHALL be mobile-friendly with appropriate touch target sizes (minimum 44px)

