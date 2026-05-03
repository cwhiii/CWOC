# Release 20260503.1122 — Hexagon Clusters, Header Border Fix

- **Mixed clusters**: Changed from square/circle to a hexagon shape with purple gradient, clearly distinguishing mixed chit+contact clusters from chit-only (square) and contact-only (circle) clusters. Shows "X/Y" count format.
- **Header border**: Fixed — header no longer shifts position when sidebar opens. Instead, the bottom border is clipped using a pseudo-element that starts at the sidebar's right edge (240px from left), so the header stays full-width but the border stops where the sidebar begins. Matches dashboard behavior.
- **Weather week lines**: Already using the week start day setting from user preferences. The `weekStartDay` is loaded from `settings.week_start_day` and passed to the table renderer which marks week-start dates for separator lines.
