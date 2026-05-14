# Chit Editor

Collapsible zones: Title, Dates & Times, Task, Location, Tags, People, Notes, Checklist, Alerts, Health Indicators, Color, Projects, Habits. The 🎯 Habit button in the Task zone header toggles habit mode (see [Habits](habits.md)). An "📜 Audit Log" button at the bottom links to the filtered audit log for the current chit. 📱 QR button generates data or link QR codes.

When creating a new chit, only the zone relevant to the current view is expanded (e.g., Notes zone when coming from the Notes view). All other zones start collapsed. The title field is auto-focused. If you have a default saved location, it's auto-applied to new chits. Creating from the Indicators view auto-sets Point in Time to the current date/time and marks the chit Complete.

## Alerts Zone

Add notifications, alarms, timers, and stopwatches. Each alarm has a time, days, and optional "Delete chit after dismissal" checkbox — when checked, dismissing the alarm soft-deletes the chit.

Notifications fire relative to a chit's date/time fields. The first dropdown selects the direction: **At** (fires exactly at the target time), **Before**, **After**, or **Desktop** (fires next time the page is opened). For Before/After, a number and unit (minutes/hours/days/weeks) appear to set the offset. A target dropdown then shows the available reference points based on the active date mode: start/end for Start/End mode, due for Due mode, or point for Point in Time mode. For habit chits, a **Will Be Missed Within** option appears as the primary choice — set a number and unit to be notified when the habit goal hasn't been met and the cycle end is approaching (e.g., "will be missed within 2 hours"). This automatically suppresses when the goal is already met. The **Before** option is also available for habits, targeting "end of [day/week/month/year]" based on the habit's cycle frequency, with a "disable if done" checkbox to suppress when the goal is met.

**Weather Notifications:** When a chit has a location (and weather data has been fetched), the notification direction dropdown includes a **Weather Condition** option alongside Desktop, At, Before, and After. Select it to configure a weather-based alert: choose a condition (high above/below, low above/below, rain, snow, hail, or wind gusts over a threshold). Temperature thresholds use your configured unit system (°F or °C); wind uses mph or km/h. When the forecast for the chit's date meets the condition, a notification fires on the dashboard and in the editor.

Alarms trigger system notifications with sound on all platforms (macOS, Linux, Android) via the browser Notification API. On Android and Linux Firefox, the device will also vibrate. If sound cannot autoplay due to browser restrictions, a tap or keypress will unlock audio playback. Grant notification permission when prompted for full functionality.

## Independent Alerts Board

Switch to the **Independent** view mode in the Alarms tab sidebar to access a 3-column board for quick alarms, timers, and stopwatches that aren't connected to any chit. Click the **+** button in each column header to add a new item. Edit names, times, and durations inline — changes save automatically on blur. Delete items with the ❌ button. Timers and stopwatches have Start/Pause, Reset, and Lap controls just like in the chit editor. Timers and stopwatches start immediately when created — no save step needed.

## Task Zone

Status (ToDo, In Progress, Blocked, Complete, Rejected), Priority (High, Medium, Low), Severity (Critical, Major, Normal, Minor), and **Availability** (Busy, Free, or unset). The **🎯 Habit** button is always visible in the Task zone header (even when collapsed) — click it to toggle habit mode on/off. When a chit is shared with other users, an **Assignee** dropdown appears after Severity, listing only the users the chit is currently shared with. Removing a shared user from the People zone automatically updates the Assignee options.

The Availability field maps to the iCal TRANSP property for calendar exports: Busy = OPAQUE, Free = TRANSPARENT.

In the Tasks view, status is shown with matching icons: ● ToDo, ⟳ In Progress, ⊘ Blocked, ✓ Complete, ✕ Rejected.

## Prerequisites

Below the Assignee field in the Task zone, a **Prerequisites** section lets you select other chits that must be completed before this chit can proceed. Click **+ Add** to open a searchable picker showing all chits (those without a status are greyed out with a warning). Selected prerequisites appear as a colored list showing each prerequisite's title and current status.

- **Auto-blocking** — When any prerequisite is not "Complete", the chit's status is automatically set to "Blocked"
- **Auto-unblocking** — When the last incomplete prerequisite is marked Complete (or removed), the chit's status resets to "ToDo"
- **Manual override** — You can manually change status away from Blocked, but a warning confirms the override
- **Circular dependency protection** — The system prevents adding a prerequisite that would create a circular chain (A→B→A)
- **⛓️ indicator** — Chits with incomplete prerequisites show a ⛓️ chain icon on their cards in all views
- **Cascade** — When a chit is marked Complete, any chits that had it as their last incomplete prerequisite are automatically unblocked

## Checklist Zone

The checklist zone header includes a **Data** menu (⋮) with clipboard and management actions:

- **Paste as list items** — Reads your clipboard and creates each line as a new checklist item. Recognizes markdown checklist syntax (`- [ ]` / `- [x]`), bullet points, numbered lists, and plain lines. Indentation is preserved as nesting levels.
- **Copy incomplete to clipboard** — Copies all unchecked items to your clipboard as markdown checklist lines (`- [ ] item`), preserving indentation.
- **Delete checked/unchecked items** — Bulk remove completed or incomplete items.
- **Clean up empty items** — Remove items with no text.
- **Move to note** — Converts all checklist items to markdown in the Notes zone.
- **Send to another chit** — Transfer checklist items to a different chit.
- **Print checklist** — Open a print dialog for the checklist.
- **Auto-save toggle** — Enable/disable automatic saving on checklist changes.

Additionally, the header has **Undo/Redo** buttons (↺/↻) and the **🏁 Auto-Complete** cycle: Off → Auto-Complete (marks chit "Complete" when last item is checked) → Auto-Complete + Archive (also archives the chit) → Off.

## Notes Zone

The notes zone provides a **markdown editor** with a format toolbar and render toggle. Write in markdown and switch between edit and rendered views. The underlying data is standard markdown.

**Format Toolbar:** Above the editor, buttons for Bold, Italic, Strikethrough, Link, Headings (H1/H2/H3), Bullet List, Numbered List, Blockquote, Inline Code, and Horizontal Rule. On mobile, the toolbar scrolls horizontally.

**Keyboard Shortcuts:**

- `Ctrl+B` / `Cmd+B` — Bold
- `Ctrl+I` / `Cmd+I` — Italic
- `Ctrl+K` / `Cmd+K` — Link
- `Ctrl+E` / `Cmd+E` — Inline Code
- `Ctrl+Shift+X` / `Cmd+Shift+X` — Strikethrough
- `Ctrl+Z` / `Cmd+Z` — Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` — Redo

**Chit Link Autocomplete:** Type `[[` to trigger an autocomplete dropdown showing matching chit titles. Use Arrow keys to navigate, Enter to select, Escape to dismiss. The selected title is inserted as `[[title]]`.

**Expand to Modal:** Click the Expand button in the zone header to open a full-screen editing modal. Click "Done" to save changes back to the main editor.

The **← Checklist** button appends all checklist items to the notes as markdown checklist lines (`- [ ] item` / `- [x] item`). Both conversions are additive — they don't remove existing content from either zone.

Use `[[chit title]]` to link to other chits. In rendered mode, these become clickable links that open the referenced chit.

---

**See also:** [Chits](chits.md) · [Quick Edit](quick-edit.md) · [Recurrence](recurrence.md) · [Tags](tags.md) · [Habits](habits.md) · [Attachments](attachments.md)
