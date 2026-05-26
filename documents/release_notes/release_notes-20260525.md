## cwoc_server-20260525_1642 / cwoc_app-20260525_1642

Fixed checklist not showing in editor overview zone on mobile web and Android app. Mobile web: the overview panel was rendering before chit data loaded from the API, so the checklist container was empty — now re-renders the overview after data loads. Android app: the overview now parses checklist JSON and shows actual item text (incomplete items with counts) instead of just "Checklist items" static text.

## cwoc_server-20260525_1952

Fixed editor opening to wrong zone on mobile/app — when opening a chit from any dashboard view, it now always starts on Overview instead of restoring the last-viewed zone from sessionStorage. Zone restore is now limited to actual page refreshes only (detected via Navigation Timing API).

## cwoc_server-20260525_1636

Fixed checklist overview in mobile/app editor — items were showing empty drag-handle bars with no text. The selector was looking for a non-existent `.checklist-item-text` class and falling back to the drag handle span instead of the actual `.checklist-text` element.

## cwoc_server-20260525_1623 / cwoc_app-20260525_1623

Habit weekly day-of-week selection — when a habit's frequency is set to "Week", the custom recurrence block now appears automatically showing day-of-week checkboxes (Su–Sa). This lets you set a habit to recur on specific days (e.g., every Wednesday) without manually selecting "Custom…". Works on web, mobile web, and Android app.

## cwoc_server-20260525_1419

Reverted mobile web Email Zone Notes Parity changes — the implementation broke scrolling, button interactions, and layout on mobile. Restored original email zone behavior (zone-header buttons visible, proper body height, no auto-grow). Fixed pre-existing bug where the formatting toolbar (Bold/Italic/etc.) was incorrectly shown on received/sent emails on mobile.

## cwoc_server-20260525_1321 / cwoc_app-20260525_1321

Email Zone Notes Parity — complete feature. The Email zone on both Android app and mobile web now follows the Notes zone's bottom-pinned toolbar pattern: body fills available space, a pinned toolbar provides formatting (Bold, Italic, Strikethrough, Link, Heading, Bullet, Numbered, Blockquote/Code), undo/redo, preview toggle, and email-specific actions in a compact overflow menu. Desktop web (>768px) is unchanged.

## cwoc_server-20260525_1313

Hide email zone-header action buttons (Send, Reply, Forward, Discard, Undo, Redo, Render, PGP, Options, Send Later, Expand) on mobile (≤768px) — these actions are now in the mobile bottom toolbar. Only the Email activate/deactivate toggle remains in the zone header on mobile. Desktop unchanged.

## cwoc_server-20260525_1311 / cwoc_app-20260525_1311

Status, severity, and priority now display on chit cards across all views (Tasks, Notes, Checklists, Alarms, Projects, Timeline, Trash, Search) on all platforms (web, mobile, Android app). Fields are only shown when non-blank.

## cwoc_server-20260525_1248

Added 2px perimeter padding to all view containers (matching email view's .email-scroll-wrap) — just the outer edge, not inter-item spacing.

## cwoc_server-20260525_1156

Made .chit-list and all view containers fully transparent with zero padding. No background image, no border — spacing comes only from card margins or parent padding.

## cwoc_server-20260525_0840

Drag handle dots on checklist cards now inherit the card's contrast text color instead of using a hardcoded brown. They match the text color on any background.

## cwoc_server-20260525_0838

Fixed the massive gap between drag handles and checkboxes on checklist items in the dashboard. The CSS rule `.checklist-view .chit-card ul[data-chit-id] li span { flex: 1 }` was applying to ALL spans in the li — including the drag handle span — causing both the drag handle and text span to split the row 50/50. Changed selector to `li span:last-child` so only the text span expands.
