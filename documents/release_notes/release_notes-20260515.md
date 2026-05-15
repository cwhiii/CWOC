## 20260515.0821

Fixed visual indicators for health/custom object data: renamed "❤️ Health" to "❤️ Indicators" in settings, fixed field name mismatch (health_indicators → health_data) that prevented the icon from ever showing, and added a new "📊 Custom Data" indicator for non-indicator custom zone data. The two icons now split based on whether data belongs to the Indicators zone or user-created custom zones.

## 20260515.0803

Added cross-tab data sharing with leader election. Open tabs now share chit data via BroadcastChannel — only one tab (the "leader") fetches from the API, and broadcasts to all others. When the leader tab closes, another tab automatically takes over via Web Locks. Eliminates redundant API calls when multiple tabs are open.

## 20260515.0756

Added "Default View" setting (Settings → Views tab) that lets you choose which dashboard view loads on fresh site entry. Options: Calendar, Checklists, Tasks, Projects, Notes, Email, Indicators, Alerts, or Omni. Does not override view restoration when returning from the editor or other pages.

## 20260515.0754

Email draft discard no longer deletes the entire chit. When you activate email on a regular chit and then discard the draft, it just clears the email fields and hides the zone — the chit itself is untouched. If the chit is part of an email thread, the zone stays visible (collapsed) so the thread remains accessible.

## 20260515.0709

Removed the redundant CWOC logo from the top of the Omni View content area (it already appears in the sidebar header).

## 20260515.0706

Settings Display Options box reordered: Arrange Views moved to the top, Visual Indicators moved to the bottom, and the Reset Sort Order button now has a clearer explanation of what it does.

## 20260515.0638

Converted the timezone picker in the chit editor from an inline element to a modal. After selection, only the abbreviation shows next to the time; hovering reveals all timezone name forms (abbreviation, full name, IANA identifier) in a tooltip.

## 20260515.0652

Fixed 500 error on settings save — added missing database migration for default_timezone and timezone_override columns on the settings table.

## 20260515.0631

Fixed auth middleware returning false 401 errors on settings save (and potentially other POST endpoints) when a database lock prevented the non-critical last_active_datetime update from committing.

## 20260515.0627

Arrange Views modal in Settings now shows Omni as a special fixed item always pinned to the far left — non-draggable, visually distinct (dark brown with lock icon), indicating it's always the first view.

## 20260515.0802

Multi-select drag: grab any selected item's drag handle to move all selected items as a block (preserves relative levels). Shift+click only activates when an anchor exists (Ctrl+click first to set anchor, then Shift+click to extend range). Drag handle stays active and highlighted teal on selected items in multi-select mode.

## 20260515.0741

Checklist multi-select overhaul: strip is wider (18px) with ⋮ icon (✓ when selected) for clear affordance; Ctrl+click anywhere on item row selects/deselects; Shift+click does file-manager range select (clears and sets range from anchor); plain click does nothing in multi-select mode (only Ctrl toggles); dragging selected items moves them all as a unit; drag handle and text pointer-events disabled in mode.

## 20260515.0728

Checklist multi-select now fully disables editing, drag, and checkbox toggling when active. Shift+click works like a file manager (clears previous selection, selects range from anchor to clicked item). Ctrl+click inverts a single item. Plain click toggles when in mode. Anchor stays put on Shift operations.

## 20260515.0644

Checklist multi-select polish: wider strip (12px) with visible border cue; items become non-editable objects when in multi-select mode (pointer-events disabled on text); ESC clears selection and exits mode; Ctrl/Cmd+click anywhere on item row enters multi-select; Shift+click toggles range; plain click toggles when already in mode. Sped up done animation (250ms strike + 200ms fade).

## 20260515.0640

Checklist send-item UX: quick popup "New Chit" is now a line item in the recents list — click to expand into Move/Copy buttons. Search modal "New" button moved to far left of footer with same expand behavior. Italic hotkey uses `_text_` (CWOC markdown). Send/delete buttons now work on first click while editing an item (mousedown instead of click).

## 20260515.0625

Checklist improvements: markdown hotkeys (Ctrl+B/I/K/E, Ctrl+Shift+X) work while editing items; empty items no longer vanish on indent/blur/navigation; checkbox animation (strikethrough → fade → done); multi-select with right-edge strip, Ctrl+click, Shift+click range select, and batch toolbar (check/delete/move/indent/outdent); Move to New buttons repositioned to left; send-item chit list pre-cached for instant loading; Enter key defaults to Move in send-item search modal; undo toast for moved items.

## 20260515.0808

Omni View reminders: changed normalized color to muted brick red (#d4605a) for better contrast against terracotta notes. Fixed "mark complete" — now uses PATCH endpoint with proper undo countdown bar. Redesigned reminder cards to match Chrono layout (📌 icon left, time, title, time-until badge with negative time support, complete button right). Moved "Default View" setting from Views tab to General → Display Options. Reordered view options to match C CAPTN order.

## 20260515.0746

Omni View reminders redesigned to match Chrono card layout: pushpin icon on left, time column, title, time-until badge (shows negative time for past reminders), and complete button on the right. Added warm amber as the normalized color for reminders. Editor Options menu now uses pushpin icon for the reminder toggle. Made the "Omni" header word look subtly button-like with a light background and bottom border.

## 20260515.0731

Added "Mark as Reminder" / "Remove Reminder" toggle to the chit editor Options menu. This lets you manually flag any chit as a reminder (sets `notification: true`) so it appears in the Omni View Reminders section. The flag persists independently of notification alerts.

## 20260515.0624

Omni View Reminders section now shows all pinned reminders in addition to today's reminders. Pinned reminders display a bookmark icon (clickable to unpin) and show their date instead of time.

## 20260515.0618

Redesigned timezone picker in the chit editor — replaced the "Set timezone" link with inline timezone abbreviation labels (e.g., "MST", "PST") at the end of each date row. Clicking the abbreviation opens the picker. Added common timezone abbreviation entries to the datalist, and address geocoding support (type a city/address, it auto-detects the timezone via Nominatim + coordinate lookup).

## 20260515.0621

Omni View now displays the main CWOC logo centered at the top of the view.

## 20260515.0617

Fixed modals (cwocConfirm, cwocPromptModal, cwocUnsavedModal) rendering as unstyled divs at the bottom of the page on the dashboard and editor — the `.cwoc-overlay` CSS class was only defined in `shared-page.css` which those pages don't load. Added the rule to `shared-editor.css` which is loaded everywhere.

## 20260515.0615

Dynamic favicons on the dashboard — the browser tab icon now changes to match the active view's tab icon (Calendar, Checklists, Tasks, Projects, Notes, Alerts, Email, Indicators) when switching views.
