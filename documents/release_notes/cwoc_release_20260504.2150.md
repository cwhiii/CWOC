## v20260504.2150 — Fix "leave page" warning after saving contact

Fixed a pre-existing bug where the contact editor's `beforeunload` warning would fire after saving because `markSaved()` was only called after a 1500ms delay. Now the dirty flag is cleared immediately on successful save, preventing the spurious "leave page" confirmation dialog.
