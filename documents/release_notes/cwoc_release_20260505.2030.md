# CWOC Release 20260505.2030 — Thread Grouping Fix

Fixed email thread grouping on the dashboard not displaying. The issue was twofold: (1) processing order — replies were processed before their parents, so In-Reply-To lookups failed; now processes oldest-first to build the thread map correctly. (2) CSS pseudo-elements were clipped by the scroll container's overflow; switched to box-shadow technique for the stacked parchment layers which works within overflow contexts. Also syncs the threaded toggle checkbox state when switching to the Email tab.
