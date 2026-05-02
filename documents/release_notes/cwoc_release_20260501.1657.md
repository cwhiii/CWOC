# Release 20260501.1657

Kiosk now remembers its tag configuration. Navigating to `/kiosk` with no query parameters automatically loads the saved tag list from Settings. A new public endpoint `GET /api/kiosk/config` returns the saved tags without requiring authentication. The URL is updated via `history.replaceState` so bookmarks and refreshes work correctly.
