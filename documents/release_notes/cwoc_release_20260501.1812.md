# Release 20260501.1812

Removed vibration debug overlay. Kept the `_cwocVibrate()` helper with longer durations (200ms) for browsers that do support the Vibration API (Chrome Android, Samsung Internet, etc.). Firefox for Android removed `navigator.vibrate` entirely starting in version 129 — no workaround is possible on that browser.
