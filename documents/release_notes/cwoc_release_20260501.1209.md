# Release 20260501.1209

Fixed dashboard view state not surviving page refresh. The root cause was that `_restoreUIState()` prioritized a stale `localStorage` snapshot (written on every tab switch by `storePreviousState()`) over the fresh `sessionStorage` snapshot (written on every render by `displayChits()`). Rewrote the restore logic to always prefer `sessionStorage` for tab/view/period recovery, falling back to `localStorage` only for richer filter state on editor return. Refreshing now reliably returns to the same tab, calendar mode, and period.
