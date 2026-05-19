# Android vs Mobile Browser — Function-by-Function Parity Verification

Every view, zone, page, modal, and cross-cutting behavior that needs exhaustive side-by-side verification against the mobile browser.

**Process:** For each item, read every function that runs on it in the web code, compare against what the Android app does, document discrepancies, and fix them. Only then mark the "Code Verified" column. The "User Verified" column is marked by the user after hands-on testing.


---


## Verification Spec — What "Code Verified" Means

### The Standard

For a line item to be marked ✅ in the "Code Verified" column, **every single function** that runs on that screen/zone/modal in the mobile browser must have a corresponding implementation in the Android app that produces the same result. Not "the important ones." Not "the core functionality." Not "the critical path." **Every. Single. One.**

There is no such thing as "the most important functions" or "the vital parts." A screen with 47 functions where 46 work correctly and 1 is missing is **not functional**. It is broken. It stays ⬜ until all 47 are confirmed working identically.

### The Process

For each line item:

1. **Read the web code.** Open every JS file that runs on that screen in the mobile browser. Read every function. Understand what it does, what it renders, what interactions it supports, what API calls it makes, what state it manages, what animations it plays, what edge cases it handles.

2. **Read the Android code.** Open the corresponding Kotlin/Compose files. Find the equivalent of every web function. If there is no equivalent, that's a gap.

3. **Compare function by function.** For each web function, confirm:
   - Does the Android app have code that does the same thing?
   - Does it produce the same visual result?
   - Does it handle the same interactions (tap, long-press, swipe, drag)?
   - Does it call the same API endpoints with the same parameters?
   - Does it handle the same edge cases (empty state, error state, loading state)?
   - Does it respect the same settings and preferences?
   - Does it render with the same layout, spacing, colors, fonts, and theme?

4. **Document every discrepancy.** If a function is missing, partially implemented, or behaves differently, write it down. Do not skip it. Do not say "close enough." Do not say "minor difference." If it's different, it's a gap.

5. **Fix every discrepancy.** Implement the missing function. Fix the broken behavior. Match the layout. Only after ALL discrepancies for a line item are resolved does it get marked ✅.

### What Counts as a Function

Everything. Including but not limited to:

- Render functions (what gets drawn on screen)
- Event handlers (tap, long-press, swipe, drag, double-tap, keyboard)
- State management (what data is tracked, how it changes)
- API calls (fetch, save, delete, sync)
- Animations (fade, slide, scale, color transitions)
- Empty states (what shows when there's no data)
- Error states (what shows when something fails)
- Loading states (what shows while waiting)
- Settings integration (respecting user preferences)
- Filter/sort logic (how items are ordered and filtered)
- Navigation (where taps take you, back behavior, deep links)
- Accessibility (labels, roles, touch targets)
- Responsive behavior (how layout adapts to screen size)
- Gesture handling (swipe thresholds, drag physics, long-press timing)
- Context menus (long-press menus, action sheets)
- Undo/redo (countdown bars, restore actions)
- Clipboard operations (copy, paste)
- Sharing (share sheets, QR codes, export)
- Sound/vibration (alarm sounds, haptic feedback)
- Background behavior (timers running, alarms checking, sync polling)

### What Does NOT Count as Done

- "The main functionality works" — if secondary functions are missing, it's not done.
- "It looks similar" — similar is not identical. Match the layout.
- "The data displays correctly" — if interactions are missing, it's not done.
- "It works for the common case" — if edge cases are unhandled, it's not done.
- "The spec said to do X" — the spec is not the source of truth. The running mobile browser is the source of truth. If the spec missed something that the browser does, the browser wins.
- "That feature isn't important" — you don't get to decide what's important. Everything is important. Everything must work.
- "It's a minor visual difference" — there are no minor differences. Match it exactly.
- "That's an enhancement we can add later" — no. It's a missing function. It stays ⬜ until it's there.

### The Source of Truth

The source of truth is **the mobile browser running the web app at the same viewport width as the Android phone**. Not the desktop browser. Not the spec documents. Not the task lists. Not the gap analysis. The actual running mobile browser.

If the mobile browser does something and the Android app doesn't, the Android app is wrong. Period. No exceptions. No prioritization. No "we'll get to it later."

### What "User Verified" Means

The user opens both the Android app and the mobile browser side by side. They interact with every feature on that screen. They confirm that every button, every gesture, every display, every animation, every state, every edge case behaves identically. If anything is different — anything at all — it goes back to ⬜ in both columns and the discrepancy is documented and fixed.


---

## Dashboard Views

| # | Item | Code Verified | User Verified |
|---|------|:---:|:---:|
| 1 | Calendar — Day | ✅ | ⬜ |
| 2 | Calendar — Week | ✅ | ⬜ |
| 3 | Calendar — Work Hours | ✅ | ⬜ |
| 4 | Calendar — X-Day/SevenDay | ✅ | ⬜ |
| 5 | Calendar — Month | ✅ | ⬜ |
| 6 | Calendar — Year | ✅ | ⬜ |
| 7 | Calendar — Itinerary | ✅ | ⬜ |
| 8 | Tasks (all 3 sub-modes: Tasks, Habits, Assigned) | ✅ | ⬜ |
| 9 | Checklists | ✅ | ⬜ |
| 10 | Notes | ✅ | ⬜ |
| 11 | Notebook (combined Notes+Checklists) | ✅ | ⬜ |
| 12 | Projects (Kanban + List sub-modes) | ✅ | ⬜ |
| 13 | Alerts (all 4 sub-modes: Independent, List, Notifications, Reminders) | ✅ | ⬜ |
| 14 | Indicators (all 3 sub-modes: Charts, Calendar, Log) | ✅ | ⬜ |
| 15 | Email (all 6 folders + bundles + thread expansion + compose) | ✅ | ⬜ |
| 16 | Search | ✅ | ⬜ |
| 17 | Omni View (all 12 configurable sections) | ✅ | ⬜ |

## Editor Zones

| # | Item | Code Verified | User Verified |
|---|------|:---:|:---:|
| 18 | Header (title, status, priority, pin, archive) | ✅ | ⬜ |
| 19 | Dates & Times | ✅ | ⬜ |
| 20 | Tags | ✅ | ⬜ |
| 21 | People | ✅ | ⬜ |
| 22 | Location | ✅ | ⬜ |
| 23 | Notes | ✅ | ⬜ |
| 24 | Alerts | ✅ | ⬜ |
| 25 | Color | ✅ | ⬜ |
| 26 | Health Indicators | ✅ | ⬜ |
| 27 | Checklist | ✅ | ⬜ |
| 28 | Projects | ✅ | ⬜ |
| 29 | Email Compose | ✅ | ⬜ |
| 30 | Attachments | ✅ | ⬜ |
| 31 | Recurrence (inline in Dates on web) | ✅ | ⬜ |
| 32 | Habits | ✅ | ⬜ |
| 33 | Mobile zone navigation (one-zone-at-a-time with prev/next) | ✅ | ⬜ |

## Standalone Pages

| # | Item | Code Verified | User Verified |
|---|------|:---:|:---:|
| 34 | Settings — General tab | ✅ | ⬜ |
| 35 | Settings — Views tab | ✅ | ⬜ |
| 36 | Settings — Collections tab | ✅ | ⬜ |
| 37 | Settings — Email tab | ✅ | ⬜ |
| 38 | Settings — Administration tab | ✅ | ⬜ |
| 39 | People / Contact List | ✅ | ⬜ |
| 40 | Contact Editor | ✅ | ⬜ |
| 41 | Contact Trash | ✅ | ⬜ |
| 42 | Trash | ✅ | ⬜ |
| 43 | Weather | ✅ | ⬜ |
| 44 | Maps (all 3 modes: Chits, People, Both) | ✅ | ⬜ |
| 45 | Help | ✅ | ⬜ |
| 46 | Audit Log | ✅ | ⬜ |
| 47 | Attachments Browser | ✅ | ⬜ |
| 48 | Rules Manager | ✅ | ⬜ |
| 49 | Rule Editor | ✅ | ⬜ |
| 50 | Custom Objects Editor | ✅ | ⬜ |
| 51 | User Admin | ✅ | ⬜ |
| 52 | Admin Chits | ✅ | ⬜ |
| 53 | Kiosk | ✅ | ⬜ |
| 54 | Notifications | ✅ | ⬜ |
| 55 | Login | ✅ | ⬜ |

## Modals & Overlays

| # | Item | Code Verified | User Verified |
|---|------|:---:|:---:|
| 56 | Clock Modal | ✅ | ⬜ |
| 57 | Weather Modal | ✅ | ⬜ |
| 58 | Quick-Edit Modal | ✅ | ⬜ |
| 59 | Alert/Timer Done Modal | ✅ | ⬜ |
| 60 | QR Code Modal | ✅ | ⬜ |
| 61 | Omni Layout Modal | ✅ | ⬜ |
| 62 | Arrange Views Modal | ✅ | ⬜ |
| 63 | Calculator | ✅ | ⬜ |
| 64 | Release Notes Modal | ✅ | ⬜ |
| 65 | Tag Create/Edit Modal | ✅ | ⬜ |
| 66 | Recurring Edit Modal | ✅ | ⬜ |
| 67 | Project Quick Menu | ✅ | ⬜ |
| 68 | Bundle Edit/Create Modals | ✅ | ⬜ |
| 69 | Email Expand Modal | ✅ | ⬜ |
| 70 | Image View Modal | ✅ | ⬜ |
| 71 | Attachment Preview Modal | ✅ | ⬜ |

## Cross-Cutting Behaviors

| # | Item | Code Verified | User Verified |
|---|------|:---:|:---:|
| 72 | Card rendering (tags, color, progress, people, indicators, map thumbnails, sharing badges) | ✅ | ⬜ |
| 73 | Sidebar / navigation drawer | ✅ | ⬜ |
| 74 | Profile menu (avatar, switch user, logout) | ✅ | ⬜ |
| 75 | Parchment theme / Lora font (applied consistently everywhere) | ✅ | ⬜ |
| 76 | Filters & sort (all filter types, manual drag sort, active filter badge) | ✅ | ⬜ |
| 77 | Widgets (Calendar, Tasks, Quick-Add, Refresh) | ✅ | ⬜ |
| 78 | Unit conversion system | ✅ | ⬜ |


---
