# CWOC Release 20260504.1634

Extracted hotkey dispatch into shared-hotkeys.js — a single file loaded by every page. Tab keys (C, H, A, P, T, N, E, I, G) and action keys (K, S, W, L, R) now work universally. On the dashboard they call filterChits() directly; on secondary pages (maps, weather, contacts, etc.) they navigate to the dashboard with the target tab pre-selected via cwoc_jump_tab. Change the key map once, it applies everywhere.
