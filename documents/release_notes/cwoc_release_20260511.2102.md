## 20260511.2102

Editor logo and audit log buttons now go through the CWOC unsaved-changes modal instead of triggering the browser's native "Leave site?" dialog. Added `_cwocSkipBeforeUnload` to all modal navigation paths so the browser dialog never double-fires. Fixed ESC handler on the unsaved-changes modal to use capture phase. Added hover tooltip on the notification direction dropdown when no date mode is active: "Add a time to this chit for additional timing options."
