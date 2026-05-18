# Phase 9: Polish & Remaining Items

## Problem
Several smaller features and UI elements are missing that complete the parity picture.

## Tasks

### 9.1 Calculator
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/CalculatorSheet.kt`

The web has a floating calculator popover (F4 hotkey). On Android, implement as a bottom sheet.

**Implementation:**
- Bottom sheet with:
  - Display area (expression + result)
  - Number pad (0-9, decimal point)
  - Operators (+, -, ×, ÷)
  - Clear, Backspace, Equals
  - "Insert" button (inserts result into the currently focused text field in the editor)
- Accessible from: Editor overflow menu → "Calculator", or a FAB action

**Features:**
- Correct operator precedence (×/÷ before +/-)
- Live result preview as user types
- Insert result into active editor field (notes, title, etc.)
- Persists expression between open/close (within same session)

**Web reference:** `src/frontend/js/shared/shared-calculator.js`

### 9.2 Omni Layout Configuration Modal
**File:** Already specified in Phase 7 (7.5) but listing here for completeness.

### 9.3 Arrange Views / Tab Order Modal
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/ArrangeViewsDialog.kt`

The web lets users reorder and hide tabs via a modal in Settings.

**Implementation:**
- Dialog/bottom sheet showing all C CAPTN tabs + Email + Indicators
- Each row: drag handle, tab icon + name, visibility toggle (eye icon)
- Drag to reorder
- Save persists to settings (`view_order` field)
- The `CCaptnTabRow` reads `view_order` from settings and renders tabs in that order, hiding disabled ones

**Access:** Settings → Views tab → "Arrange Views" button

**Web reference:** `src/frontend/js/pages/settings.js` (arrange views modal)

### 9.4 Trash — Email Filter
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/trash/TrashScreen.kt`

The web trash page supports `?filter=email` to show only deleted emails.

**Implementation:**
- Add a FilterChip row at top: "All" | "Emails Only"
- When "Emails Only" is selected, filter to chits where email_message_id or email_status is not null
- Update page title to "Email Trash" when filtered

### 9.5 Alert Modal (Full-Screen Alarm)
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/alerts/AlarmFiredActivity.kt`

When an alarm fires, the web shows a full-screen modal with the alarm details and snooze options. On Android, this should be a full-screen intent activity (shows over lock screen).

**Implementation:**
- Full-screen Activity (not a composable within the main nav)
- Shows: alarm title, time, description
- Buttons: Dismiss, Snooze (5min, 10min, 15min, 30min, 1hr)
- Plays alarm sound (from notification channel)
- Vibrates
- Shows over lock screen (use `setShowWhenLocked`, `setTurnScreenOn`)

**Note:** This uses Android's full-screen notification intent pattern, not navigation compose.

### 9.6 Timer Done Modal
Similar to 9.5 but for timer completion:
- Shows: "Timer Complete" + timer name
- Buttons: Dismiss, Restart
- Plays completion sound

### 9.7 Weather Modal (Quick Weather from Dashboard)
On the web, Shift+W shows a weather modal without leaving the dashboard. On Android, the Weather page serves this purpose (accessible from sidebar). However, add a quick-access option:

**Implementation:**
- Long-press the weather indicator in the Omni View HST bar → show a bottom sheet with current weather for all saved locations
- This is a lighter-weight alternative to navigating to the full Weather page

### 9.8 Month View Compress/Scroll Toggle
Already specified in Phase 2 (2.5) but listing here as a reminder.

### 9.9 Contact Editor — Vault Toggle Visibility
Ensure the Vault toggle (shared contact across users) is visible and functional in the contact editor, matching the web's behavior where it defaults based on the `default_share_contacts` setting.

### 9.10 Help Screen — Verify All 41 Topics Load
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/help/HelpScreen.kt`

Verify the Help screen:
- Fetches all help topics from `GET /api/docs`
- Renders markdown content correctly
- Has a table of contents / topic list
- Supports deep-linking (navigating directly to a specific topic)
- All 41 topics are accessible and render properly

### 9.11 Kiosk Mode (Optional — Confirm with User)
The web has a Kiosk page for display-only mode (e.g., on a wall-mounted tablet). This might make sense on Android for tablet use.

**If implementing:**
- Full-screen mode (hide status bar, nav bar)
- Shows: current time (large), today's events, weather, upcoming tasks
- No interaction except tap to exit kiosk mode
- Accessible from: Settings → Admin → Tools → "Kiosk Mode" button

**If skipping:** Remove the web's kiosk references from parity requirements (it's arguably a tablet-specific feature).

## Verification
- [ ] Calculator bottom sheet works with correct math and insert-to-field
- [ ] Arrange Views dialog allows reorder/hide tabs, persists to settings
- [ ] Tab row respects saved view_order
- [ ] Trash shows "All" | "Emails Only" filter
- [ ] Full-screen alarm activity shows over lock screen with snooze options
- [ ] Timer completion shows full-screen with dismiss/restart
- [ ] Help screen loads all 41 topics with proper markdown rendering
- [ ] Vault toggle works in contact editor
- [ ] All remaining items from the parity audit are addressed
