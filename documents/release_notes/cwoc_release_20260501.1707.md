# CWOC Release 20260501.1707

Kiosk navigation now stays in the same tab throughout: opening the kiosk from Settings, clicking a chit from the kiosk, and exiting the editor all navigate in-place instead of opening new tabs. The editor detects when it was opened from the kiosk (via a `from` query param) and returns to the kiosk on save, cancel, or delete.
