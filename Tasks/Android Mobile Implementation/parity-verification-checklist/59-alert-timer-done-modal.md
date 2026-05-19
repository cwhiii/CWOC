# Alert/Timer Done Modal

**Category:** Modals & Overlays
**Item #:** 59
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (shared-alarms.js)
- [ ] _sharedShowAlertModal(opts) — Creates and shows a full-screen blocking alert modal when an alarm/timer fires; blocks all keyboard input except ESC and Tab
- [ ] _sharedDismissModal(overlay, opts) — Fades out and removes the alert modal overlay; restores body scroll/touch

### Modal Display Elements
- [ ] Full-screen overlay — Fixed position, dark background (rgba 0,0,0,0.7), z-index 100000, blocks scroll and touch
- [ ] Parchment-themed modal card — Background image, #8b4513 border, rounded corners, gold box-shadow glow
- [ ] Gold progress bar — Decorative bar at top of modal (gradient from gold to brown)
- [ ] Icon display — Large emoji (3em): 🔔 for alarms, ⏱️ for timers
- [ ] Title text — Bold, 1.5em, shows chit title or alarm name
- [ ] Subtitle text — Shows time and optional alarm name, or "Time's up!" for timers

### Buttons
- [ ] "📝 Go to Chit" button — (shown when opts.chitId exists) Stops audio, dismisses modal, persists dismiss, syncs, navigates to /editor?id={chitId}
- [ ] "🛎️ Go to Alerts" button — (shown when no chitId, i.e. independent alarms) Stops audio, dismisses, navigates to /?tab=Alarms with independent view mode
- [ ] "✕ Dismiss" button — Primary styled (brown bg, light text); stops all audio, dismisses modal, persists dismiss state, syncs dismissal
- [ ] "💤 Snooze" button — (shown when opts.showSnooze is true) Stops audio, dismisses modal, persists snooze with configurable duration, syncs snooze, re-renders alarm containers

### Audio Control
- [ ] _sharedPlayAlarm — Plays alarm sound (looping)
- [ ] _sharedStopAlarm — Stops alarm audio
- [ ] _sharedPlayTimer — Plays timer sound (looping)
- [ ] _sharedStopTimer — Stops timer audio
- [ ] Audio unlock on click — First click on modal attempts to resume paused looping audio (iOS/Android unlock)

### Keyboard Handling
- [ ] ESC key — Dismisses the modal (stops audio, persists dismiss, syncs)
- [ ] Tab key — Allowed through for accessibility (focus cycling between buttons)
- [ ] All other keys — Blocked (preventDefault + stopImmediatePropagation) while modal is open

### Navigation Safety
- [ ] _safeNavigate(url) — Checks for unsaved changes (editor page or CwocSaveSystem) before navigating; shows confirm dialog if dirty

### Persistence & Sync
- [ ] _sharedPersistDismiss(key) — Persists that an alarm was dismissed (prevents re-firing)
- [ ] _sharedPersistSnooze(key, untilTs) — Persists snooze state with expiry timestamp
- [ ] _sharedGetSnoozeMs() — Returns snooze duration in milliseconds (from settings)
- [ ] syncSend('alert_dismissed', {...}) — Syncs dismissal to other devices
- [ ] syncSend('alert_snoozed', {...}) — Syncs snooze to other devices

### Trigger Sources
- [ ] Chit-attached alarms — Fires when alarm time matches current time (checked every second)
- [ ] Independent alarms — Standalone alarms not attached to any chit
- [ ] Snoozed alarm re-fire — Fires again when snooze period expires
- [ ] Timer completion — Fires when countdown timer reaches zero
- [ ] Cross-device sync — syncOn('alarm_fired') and syncOn('timer_fired') show modal on receiving device

### Browser Notification (companion)
- [ ] _sharedBrowserNotif — Shows OS-level notification alongside the modal (if permission granted)
- [ ] Notification click — Focuses window and navigates to chit editor or alarms view

### Body Lock
- [ ] document.body overflow hidden — Prevents background scrolling while modal is open
- [ ] document.body touchAction none — Prevents touch interactions with background
- [ ] Restored on dismiss — Only when no other alert modals remain open

### State
- [ ] overlay._snoozeKey — Stored on overlay element for reference
- [ ] overlay._triggerKey — Stored on overlay element for reference
- [ ] overlay._blockKeys — Reference to keyboard blocking handler for cleanup
- [ ] data-cwoc-alert attribute — Marks overlay for detection of multiple stacked alerts
