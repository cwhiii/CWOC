# Release 20260501.1758

Checklist overhaul: Fixed Clear Checked button (was broken due to cwocConfirm being Promise-based, not callback-based; also click was being swallowed by zone header toggle). Replaced the Undo Delete button with an inline undo countdown bar that appears right in the checklist — shows a message, Undo button, and shrinking timer bar for 8 seconds. Same countdown pattern used for both single-item delete and Clear Checked. Dashboard checklist view now hides completed items (only unchecked items shown, count in header).
