## CWOC Release 20260501.1150

Added all 18 property-based tests for the sharing overhaul feature. Tests cover the permission engine (assignment grants manager, manager soft-delete, stealth preservation), notification system (creation completeness, ordering, RSVP sync), chit route permissions (manager persistence, self-only RSVP), invite/assign actions, notification count accuracy, dashboard sharing filters, tag sharing hierarchy and permissions, and people modal sorting/labeling. All tests use unittest with 120 randomized iterations per property — no external dependencies.
