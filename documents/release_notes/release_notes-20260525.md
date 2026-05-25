## cwoc_server-20260525_1248

Added 2px perimeter padding to all view containers (matching email view's .email-scroll-wrap) — just the outer edge, not inter-item spacing.

## cwoc_server-20260525_1156

Made .chit-list and all view containers fully transparent with zero padding. No background image, no border — spacing comes only from card margins or parent padding.

## cwoc_server-20260525_0840

Drag handle dots on checklist cards now inherit the card's contrast text color instead of using a hardcoded brown. They match the text color on any background.

## cwoc_server-20260525_0838

Fixed the massive gap between drag handles and checkboxes on checklist items in the dashboard. The CSS rule `.checklist-view .chit-card ul[data-chit-id] li span { flex: 1 }` was applying to ALL spans in the li — including the drag handle span — causing both the drag handle and text span to split the row 50/50. Changed selector to `li span:last-child` so only the text span expands.
