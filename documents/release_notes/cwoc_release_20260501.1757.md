# Release 20260501.1757

Added vibration debug mode to diagnose why haptic feedback isn't working on Android Firefox. Enable by running `window._cwocVibrateDebug = true` in the browser console, then trigger a long-press — a green-on-black debug overlay will show whether the Vibration API exists, what's being called, and what it returns.
