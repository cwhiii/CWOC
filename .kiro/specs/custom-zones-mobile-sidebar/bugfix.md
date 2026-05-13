# Bugfix Requirements Document

## Introduction

Custom zones (dynamically rendered zone panels for user-defined custom objects) appear at the bottom of every zone on mobile instead of being integrated into the mobile sidebar/toggle system. On mobile (≤768px), the chit editor uses a single-zone-at-a-time view where zones are hidden by default and only shown when selected from the zone list sidebar. Custom zones bypass this system entirely — they are always visible, appended at the end of `.main-zones-grid`, breaking the mobile UX.

The root cause is that `_loadCustomZones()` appends custom zone panels to the grid but never registers them in `_mobileZoneOrder`, so the mobile zone navigation system (`editor-mobile-zones.js`) has no awareness of them. They are never hidden by `_mobileShowZone()`, never appear in the zone list overlay, and cannot be navigated to via swipe.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN custom zones are loaded on mobile (≤768px) THEN the system renders them at the bottom of `.main-zones-grid` and they remain permanently visible regardless of which zone is active

1.2 WHEN the user opens the zone list sidebar on mobile THEN the system does not show custom zones as selectable entries in the zone list

1.3 WHEN the user swipes through zones on mobile THEN the system never navigates to custom zone panels (they are unreachable via swipe)

1.4 WHEN `_mobileShowZone()` hides all zone containers THEN the system does not hide custom zone panels because they are not registered in `_mobileZoneOrder`

### Expected Behavior (Correct)

2.1 WHEN custom zones are loaded on mobile (≤768px) THEN the system SHALL register each custom zone panel in the mobile zone navigation system so it is hidden by default and only shown when selected

2.2 WHEN the user opens the zone list sidebar on mobile THEN the system SHALL display each custom zone as a selectable entry (with its name and icon) in the zone list

2.3 WHEN the user swipes through zones on mobile THEN the system SHALL include custom zones in the swipe navigation order (after the last built-in zone)

2.4 WHEN `_mobileShowZone()` hides all zone containers THEN the system SHALL also hide custom zone panels, showing only the active one

### Unchanged Behavior (Regression Prevention)

3.1 WHEN custom zones are loaded on desktop (>768px) THEN the system SHALL CONTINUE TO render them in `.main-zones-grid` as visible collapsible panels

3.2 WHEN the mobile zone system navigates between built-in zones THEN the system SHALL CONTINUE TO show/hide built-in zones correctly without interference from custom zone registration

3.3 WHEN no custom zones exist for the user THEN the system SHALL CONTINUE TO operate the mobile zone system with only built-in zones

3.4 WHEN custom zones have no visible objects (all filtered by conditional_display) THEN the system SHALL CONTINUE TO skip rendering those zones and not register empty zones in the mobile system
