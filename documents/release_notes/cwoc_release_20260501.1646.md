# Release 20260501.1646

Kiosk view is now tag-based instead of user-based. Select tags in Settings → Kiosk to control which chits appear. Any chit with a matching tag (case-insensitive) is included regardless of owner. The URL parameter changed from `?users=` to `?tags=TagName1,TagName2`. The old "Share" tag requirement is removed — any selected tags work. The settings UI shows all tags with color swatches and checkboxes.
