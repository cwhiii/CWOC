# Mobile Zone Navigation

**Category:** Editor Zones
**Item #:** 33
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor-mobile-zones.js`

## Overview
On mobile (≤768px), transforms the editor into a single-zone-at-a-time view with swipe navigation, a sticky header, zone list overlay, and actions sidebar.

## Global State

- [ ] `_mobileZoneModeActive` — Boolean: whether mobile zone mode is active
- [ ] `_mobileCurrentZoneIdx` — Current zone index in mobile view
- [ ] `_mobileZoneHeaderEl` — The sticky zone header DOM element
- [ ] `_mobileZoneListEl` — The zone list overlay DOM element
- [ ] `_mobileZoneListBackdrop` — The zone list backdrop element

## Zone Registry

- [ ] `_mobileZoneOrder` — Ordered array of zone definitions:
  - [ ] titleZone (Overview) — 📋 isTitle: true
  - [ ] datesSection (Dates & Times) — 🗓️
  - [ ] taskSection (Task) — 📋
  - [ ] notesSection (Notes) — 📝
  - [ ] checklistSection (Checklist) — ☑️
  - [ ] tagsSection (Tags) — 🏷️
  - [ ] peopleSection (People) — 👥
  - [ ] locationSection (Location) — 📍
  - [ ] alertsSection (Alerts) — 🔔
  - [ ] projectsSection (Projects) — 📂
  - [ ] colorSection (Color) — 🎨
  - [ ] healthIndicatorsSection (Indicators) — ❤️
  - [ ] attachmentsSection (Attachments) — 📎
  - [ ] emailSection (Email) — ✉️
  - [ ] habitLogSection (Habits) — 🎯
  - [ ] Custom zones (dynamically registered)

## Tab → Zone Mapping

- [ ] `_mobileTabZoneMap` — Maps source tab to starting zone:
  - Calendar → datesSection
  - Checklists → checklistSection
  - Alarms → alertsSection
  - Projects → checklistSection
  - Tasks → taskSection
  - Notes → notesSection
  - Email → emailSection

## Core Navigation Functions

- [ ] `_getMobileVisibleZones()` — Filter zone order to only currently visible zones (excludes hidden-by-app-logic zones)
- [ ] `_isZoneEmpty(zoneInfo)` — Check if a zone has meaningful content (for greying out in zone list)
- [ ] `_getMobileStartZoneIdx()` — Determine starting zone based on source tab, URL params, or session storage
- [ ] `_mobileShowZone(idx)` — Show specific zone by index, hide all others, update header
- [ ] `_mobileNextZone()` — Navigate to next zone (wraps around)
- [ ] `_mobilePrevZone()` — Navigate to previous zone (wraps around)

## Zone Visibility Checks (_isZoneEmpty)

- [ ] titleZone — Empty if title field is empty
- [ ] datesSection — Empty if date mode is "none"
- [ ] taskSection — Empty if status is empty
- [ ] notesSection — Empty if note textarea is empty
- [ ] checklistSection — Empty if no checklist items
- [ ] tagsSection — Empty if no tags selected
- [ ] peopleSection — Empty if no people chips or text
- [ ] locationSection — Empty if location field is empty
- [ ] alertsSection — Empty if no alarms/timers/stopwatches/notifications
- [ ] projectsSection — Empty if no child chits
- [ ] colorSection — Empty if color is transparent
- [ ] healthIndicatorsSection — Empty if no indicator entries
- [ ] attachmentsSection — Empty if attachment count is 0
- [ ] emailSection — Empty if emailTo is empty
- [ ] habitLogSection — Empty if habit not enabled
- [ ] Custom zones — Empty if no indicator fields

## Sticky Zone Header

- [ ] `_createMobileZoneHeader()` — Create sticky header element with buttons and title
- [ ] `_updateMobileZoneHeader(zoneInfo, idx, total)` — Update header content (title, counter, zone name)
- [ ] `_applyMobileNavBarColor()` — Apply chit color as nav bar background with contrasting text
- [ ] Header structure:
  - [ ] Left button (☰) — Opens actions sidebar
  - [ ] Center title — Chit title (truncated) as `.mobile-zone-nav-chit-title`
  - [ ] Counter span — Shows "N/total" (e.g., "3/12")
  - [ ] Right button (☰ [Zone Name]) — Opens zone list overlay

## Zone List Overlay

- [ ] `_openMobileZoneList()` — Open the zone list sidebar/overlay
- [ ] `_closeMobileZoneList()` — Close the zone list
- [ ] `_updateMobileZoneListActive(activeId)` — Highlight current zone in list
- [ ] Zone list items — Each zone shown with icon, label, active state
- [ ] Click zone item — Navigate to that zone, close list
- [ ] Greyed-out zones — Zones with no content shown dimmed but still clickable
- [ ] Active zone highlight — Current zone has "active" class

## Actions Sidebar

- [ ] `_openMobileActionsSidebar()` — Open the actions/save sidebar
- [ ] Contains: Save, Save & Stay, Save & Exit, Cancel/Exit, Delete, Archive, Snooze buttons
- [ ] Unsaved indicator — Visual indicator on hamburger button when unsaved changes exist

## Overview Panel (Title Zone)

- [ ] `_renderMobileOverview(container)` — Render compact read-only summary of populated fields
- [ ] `_restoreMobileOverviewElements(container)` — Restore elements hidden by overview when navigating away
- [ ] Overview rows (tappable, navigate to zone):
  - [ ] Title row (✏️) — Shows chit title, tap to edit
  - [ ] Weather row (🌤️) — Shows weather summary if loaded
  - [ ] Dates row (🗓️) — Shows date/time summary
  - [ ] Notes row (📝) — Shows first 3 lines preview
  - [ ] Checklist row (☑️) — Shows incomplete items or "All N items complete"
  - [ ] Location row (📍) — Shows location text
  - [ ] Indicators row (❤️) — Shows "N indicators recorded"
  - [ ] Custom zone rows — Shows populated field values
- [ ] `_getOverviewDatesText()` — Get formatted dates text for overview (external)
- [ ] `_escHtml(text)` — Escape HTML for safe display (external)

## Title Zone Controls

- [ ] `_injectTitleZoneControls(titleContainer)` — Inject QR and Log buttons into title zone
- [ ] QR button clone — Opens QR code modal
- [ ] Audit Log button clone — Opens audit log
- [ ] Nest button clone — Opens nest modal (if visible)

## Swipe Gestures

- [ ] `_initMobileZoneSwipe()` — Initialize touch swipe listeners for zone navigation
- [ ] Swipe left on body — Navigate to next zone
- [ ] Swipe right on body — Navigate to previous zone
- [ ] Swipe threshold — Minimum horizontal distance to trigger
- [ ] Guard: `_mobileZoneModeActive` — Only process when active
- [ ] Guard: `window._touchDragActive` — Don't interfere with drag operations
- [ ] Guard: overlays open — Don't swipe when modals/overlays are visible
- [ ] Guard: text selection — Don't swipe when user is selecting text
- [ ] Guard: horizontal scroll — Don't swipe when element has horizontal scroll

## Activation / Deactivation

- [ ] `_activateMobileZoneMode()` — Activate mobile zone mode (≤768px)
- [ ] `_deactivateMobileZoneMode()` — Deactivate (restore desktop layout)
- [ ] `initMobileZoneNav()` — Entry point: check viewport, activate if mobile, listen for resize
- [ ] Body class — `mobile-zone-mode` added to body when active
- [ ] Resize listener — Activate/deactivate on viewport width change
- [ ] Session persistence — Current zone saved to sessionStorage per chit ID
- [ ] Email zone wait — If source tab is Email, poll until email zone is visible

## Unsaved Changes Indicator

- [ ] `_updateMobileUnsavedIndicator(hasUnsaved)` — Show/hide dot on hamburger button
- [ ] Visual indicator — Colored dot on the actions (left) hamburger button

## Zone Header Behavior

- [ ] `toggleZone()` override — In mobile mode, zone headers don't collapse/expand (no-op)
- [ ] All zones force-expanded — When showing a zone, it's always expanded
- [ ] Column management — Show parent column, hide other column
- [ ] Custom zone panels — Direct children of grid (no column wrapper), hide both columns

## Custom Zone Integration

- [ ] `_registerCustomZonesInMobileNav()` — Register custom zone panels in _mobileZoneOrder (external, in editor-custom-zones.js)
- [ ] Custom zones appear in zone list — Reachable via swipe and zone list
- [ ] Refresh on registration — If mobile mode active, refresh current view

## DOM Mutation Observer

- [ ] Observe zone-more-menu visibility — Detect when Data menus open (prevent swipe interference)

## Color Theming

- [ ] Nav bar background — Uses chit's color if set
- [ ] Contrasting text — `contrastColorForBg()` for readable text on colored background
- [ ] Button styling — Inverted colors (text color as background, bg color as text)
- [ ] Reset to default — Parchment theme when no color set
