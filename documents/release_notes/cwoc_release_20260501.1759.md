# Release 20260501.1759

Fixed mobile touch gesture model so drag and long-press use sequential timers instead of parallel. Drag activates at 250ms, then long-press timer starts — any movement after drag activates permanently cancels long-press. This prevents quick-edit from firing when the user is trying to drag.
