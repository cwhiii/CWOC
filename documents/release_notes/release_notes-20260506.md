# 20260506 Highlights

- Email attachment handling improvements (inline thumbnails, auto-zone)
- Email compose/reply polish and ESC handling fixes

---

## 20260506.2151

Email inbox: moved attachment thumbnails inline within the content row, positioned between the body preview and the hover quick controls. They now sit to the left of where the quick controls appear on hover, so no overlap.

## 20260506.2146

Email inbox view: kept the thumbnail attachment row (right-aligned with 10em right padding to avoid hover action overlap), removed the inline attachment chips. Full filenames shown on thumbnails.

## 20260506.2144

Fixed: ESC in email expand modal now uses stopImmediatePropagation to prevent the editor's ESC handler from also firing and closing the chit. Removed duplicate attachment display in email inbox view (kept only inline chips). Removed auto-open of Attachments zone that was causing side effects.

## 20260506.2139

Email small editor: no longer shows attachments inline. Instead, auto-opens the Attachments zone and marks email-origin attachments with a left border and ✉ indicator.

## 20260506.2138

Email small editor: attachment bar now shows just compact filename pills (no thumbnails/icons) since the full Attachments zone is right there. The expand modal still shows full thumbnails.

## 20260506.2136

Email editor expand view: attachments now show image thumbnails at the bottom with full filenames (no truncation). Non-image attachments show file type icons with full names. Dashboard inline attachment chips also show full filenames.

## 20260506.2127

Fixed: attachments being wiped by double-encoding. When a chit with attachments was updated via PUT (archive, pin toggle, bulk tag, etc.), serialize_json_field() was calling json.dumps() on an already-serialized JSON string, corrupting the data. Fixed serialize_json_field to detect and pass through valid JSON strings. Added a startup migration to repair any already-corrupted attachment fields in the database.

## 20260506.2103

Restored the full attachment thumbnail row below email cards (image previews, file icons with names). The inline attachment chips in the content row are also still present. If attachments still don't appear, the issue is in the data — the attachments field may be null/empty for those chits in the database.

## 20260506.2058

No code changes — the attachment issue was caused by the _projectsViewMode undefined error (fixed in previous version) which threw during initialization and prevented fetchChits from ever running. With the split files restored, initialization completes and attachments display correctly in both inbox and editor.

## 20260506.2055

Fixed: restored split view files (main-views-tasks/habits/notes/projects/alarms/indicators.js) to index.html — they contain state variables and code that main-views.js depends on. The previous removal caused _projectsViewMode undefined error breaking all views.

## 20260506.2051

Email view: inline tag chips now show the full tag path (e.g. "super/more") instead of just the leaf name.

## 20260506.2050

Fixed: removed stale split file script tags from index.html (main-views-tasks/habits/notes/projects/alarms/indicators.js) that were causing duplicate function definitions. All code remains in main-views.js. This resolves the _restoreViewModeButtons undefined error and potential attachment display issues caused by script loading conflicts.

## 20260506.2046

Email view: moved inline tag chips to sit after the subject (before attachments and preview) so they don't obscure attachment icons.

## 20260506.2037

Email view: added clickable pin icon between the contact avatar and content row — shows empty bookmark by default, filled when pinned, click to toggle. Attachment icons now appear inline at the start of the body preview area (max 2 shown, overflow shows "+N"). Up to 3 non-system tag chips display at the end of the preview area with proper tag colors. All hidden on mobile to keep cards compact.

## 20260506.2034

Codebase modularity split: `main-views.js` (5,137 lines → 7 files) and `routes/chits.py` (2,733 lines → 3 files). No functional changes — pure refactoring for maintainability.

## 20260506.2016

Email view: pinned messages now sort to the top (above unread, above newest), with a bookmark icon indicator. Body preview text now collapses all whitespace (tabs, newlines, multiple spaces) into single spaces so actual content is visible. Email card content is now vertically centered within each row.

## 20260506.2012

Checklist progress counts now only show the ✓/☑ symbol when all items are complete. Incomplete checklists display as (3/5) instead of (3/5 ✓). Applied across all views: dashboard chit headers, project list/kanban child counts, aggregate project counts, grandchild counts, editor project zone, and the live inline updater. The Checklists view title strikethrough also now correctly ignores empty items.

## 20260506.2008

Kanban project view: child chit titles are now struck through when in the Complete column. Grandchild titles get the same treatment. The checklist count numbers and other indicators remain un-struck.

## 20260506.1944

Checklist progress counts (X/Y ✓) now exclude empty items across all views — dashboard chit headers, project list/kanban child counts, aggregate project counts, grandchild counts, editor project zone, and the inline progress updater.

## 20260506.1939

Eliminated all browser `alert()`, `confirm()`, and `prompt()` calls across the entire frontend. Replaced with `cwocToast` for notifications/errors, `cwocConfirm` for confirmations, and a new `cwocPromptModal` for text input — all using the parchment theme. Added "Create New Child Chit" button (+) on project headers in both list and kanban dashboard views, and a "Create New" button in the editor Projects zone. Added steering rule prohibiting system dialogs.

## 20260506.1930

Replaced Font Awesome heartbeat icon with the new Indicators.png image on the dashboard Indicators tab.

## 20260506.1925

Replaced Font Awesome envelope icons with the new email.png image on the dashboard Email tab, the editor's email activate buttons, and the settings Email section header.

## 20260506.1919

Fixed mode selector button styling to use ivory background with dark brown text (#3b1f0a) when active, matching the active view tab coloring.

## 20260506.1917

Added a "Projects" settings section with toggles to show/hide child chit completion count and aggregate checklist progress on project master cards. Both default to disabled.

## 20260506.1913

Project master cards now show inline progress text matching child chit style: completed/total child chits plus aggregate checklist progress across all children (e.g. "(3/7 ✓, 12/20 ☑)"). Removed the bubble badge in favor of the same inline text format used on child cards.

## 20260506.1911

Updated project master chit count badge to show completed/total child chits (e.g. "3/7") instead of just the total count, giving a quick progress overview on both list and kanban views.

## 20260506.1842

## Release 20260506.1842

Fixed paginate email setting not persisting. The `paginate_email` field was missing from the settings save endpoint's INSERT OR REPLACE statement, so it was being reset to NULL on every save. Now properly included in both the settings dict and the SQL INSERT.

## 20260506.1841

Added autocomplete and recipient chips (To/CC/BCC) to the large email expand modal, matching the small editor's contact lookup and chip UI. Added child chit count badge to project master cards in both list and kanban views. Updated all view mode selector buttons (Tasks/Habits/Assigned, List/Kanban, Chits/Independent, Indicators) to use a dark background with light text when selected for better visibility. Added email expand modal to the editor ESC chain safety check.

## 20260506.1835

## Release 20260506.1835

Added per-user "Paginate Emails" setting (Settings → Email → Display). When enabled, the email dashboard view renders only 50 messages at a time with an explicit "Load More (N remaining)" button at the bottom. Disabled by default — all emails render at once as before.

## 20260506.1819

## 20260506.1819

Four quality-of-life improvements:

1. **Scroll to source zone** — Opening a chit from any dashboard view (Tasks, Checklists, Notes, etc.) now auto-scrolls the editor to the relevant zone.
2. **Email attachment thumbnails** — Email cards in the dashboard now show small clickable attachment previews (image thumbnails or file-type icons) that open in a new tab.
3. **Download raw email** — The expanded email view for received emails now has a "Raw" button that re-fetches the original .eml file from IMAP for download.
4. **Checklist send-to cache** — The "Send item to..." popup now caches the chit list for 30 seconds, eliminating redundant API calls when sending multiple items.

## 20260506.1814

Fixed garbage `&zwnj;` entities appearing in email preview body text. Added comprehensive HTML entity decoding (including zero-width invisible characters) to both the frontend strip function and backend `_strip_html_tags()`.

## 20260506.1813

## Release 20260506.1813

Email chip and autocomplete refinements: autocomplete now filters out people already added to the current field (no duplicates within To, CC, or BCC); chips for known contacts/users show their profile image and background color with contrasting text; hovering a chip shows the actual email address as a tooltip; the field value reader now properly counts chips for send validation (fixes "no recipients" error when recipients are only in chips); subject label changed from "Subj:" to "Subject:"; add-contact button also appears in the fullscreen expand modal for received emails.

## 20260506.1812

Replaced the email "Unread at top" checkbox and "Group threads" checkbox with a single Newest/Unread toggle switch. Threading is now always on; the toggle switches sort order between newest-first and unread-first.

## 20260506.1806

Fixed "Unread at top" toggle to correctly sort threads with unread messages to the top (previously only worked in flat view). Removed the "Group threads" toggle — email is now always displayed in threaded view.

## 20260506.1803

## Release 20260506.1803

Email editor overhaul: autocomplete now supports arrow key navigation and Enter to select; valid emails wrap into chips (teal for known contacts/users, neutral for plain addresses); added Subject field in the small email zone that auto-syncs to the title; undo-send countdown now shows on the dashboard email view after navigating away from the editor; threaded emails are 30% taller; sender profile images are slightly larger (34px) with a dark brown border; added "+" button on From field for received emails to create a new contact pre-filled with the sender's email; contact editor now accepts prefill_email and prefill_name URL params.

## 20260506.1751

## Release 20260506.1751

Email sender image lookup now checks both contacts and users. The `/api/auth/switchable-users` endpoint now returns email addresses so the frontend can match sender emails to user profile images in addition to contact photos.

## 20260506.1739

## Release 20260506.1739

Email view improvements: contact photos now show in the checkbox area (checkbox appears on hover), threaded emails are 20% taller for visual distinction, "Unread at top" sort toggle added to sidebar, undo-send countdown bar (7s) before emails actually send, error toasts now include a "Go to Settings" button for email configuration issues, save/exit buttons properly update after send completes, and email autocomplete dropdowns fixed (were clipped by zone-container overflow).

## 20260506.1630

Added checklist progress count (X/Y ✓) to project master headers in both list and kanban views. Project headers now also show an inline note snippet (first line of markdown, truncated to fit the single line) after the title and count.

## 20260506.1629

Checklist "send item" popup now shows "Copy to New" and "Move to New" buttons. Both trigger the standard Save/Discard/Cancel modal before navigating away, ensuring no unsaved changes are lost.

## 20260506.1626

Checklist "send item" popup now has "Copy to New" and "Move to New" buttons that save the current chit first, then open a fresh editor pre-populated with the selected checklist items.

## 20260506.1624

Added checklist progress count (X/Y ✓) to child chits in the Projects view — visible in dashboard list mode, kanban mode, and the editor project zone.

## 20260506.1620

Upgraded kanban within-column reorder to use the "stain movement" style from the Notes view — a dashed placeholder appears at the drop position and existing cards shift out of the way, making it easy to see exactly where the card will land. The original card is fully hidden during drag (no ghost), leaving only the placeholder visible. On mobile touch, the card floats under the finger while the placeholder moves through the column. Applied to both the dashboard kanban view and the editor's Projects zone.

## 20260506.1619

Added "New Chit" button to the checklist item send popup — when right-clicking a checklist item, you can now spawn a brand new chit pre-populated with that item (and its children) in addition to sending to existing chits or searching.

## 20260506.1505

Codebase cleanup: split oversized JS files into focused modules for faster code generation and easier maintenance.

- **settings.js** (5,416 lines → 7 files): settings-email.js, settings-data.js, settings-sharing.js, settings-integrations.js, settings-version.js, settings-views.js, and a slimmed-down settings.js core (~1,593 lines)
- **shared.js** (3,864 lines → 5 files): shared-mobile.js, shared-weather.js, shared-alarms.js, shared-habits.js, and a slimmed-down shared.js coordinator (~1,794 lines)
- Updated all HTML pages to load the new scripts in the correct order
