# Habits

CWOC supports explicit habit tracking via an opt-in model. Any chit can become a habit, with its own goal/progress system, charts, reset periods, and a dedicated Habits view in the [Tasks view](/frontend/html/help.html#views).

## Habit Toggle

The **🎯 Habit** button lives in the Task zone header (visible even when the zone is collapsed). Clicking it toggles habit mode on and off. When you enable habit mode:

- **Auto-enables Repeat** — If the chit doesn't already have a recurrence rule, Repeat is automatically turned on with a default of Daily
- **Locks Repeat** — While habit is active, the Repeat checkbox is locked on (turn off the habit first to disable Repeat)
- **Reveals habit controls** — A Goal input and progress display (X / Y) appear on a dedicated row. A separate "📅 Calendar" row shows the "Show on calendar" toggle
- **Forces All Day** — Habits are always all-day events. The "📅 All Day" button shows active and is disabled while habit is on
- **Shows 🎯 icon** — Habit chits display the 🎯 target icon instead of the 🔁 repeat icon everywhere: editor title bar, calendar events, quick-edit modal, and tooltips
- **Auto-tags** — The system automatically adds `Habits` and `Habits/[title]` tags to the chit
- **Auto-enable from Habits mode** — Creating a new chit from the [Tasks view](/frontend/html/help.html#views) while in Habits mode auto-enables habit mode on the new chit

## Date Options for Habits

When habit mode is active, the Dates zone offers three radio options (the "None" option is hidden):

- **🗓️ Start/End** — Set a start and end date range for the habit
- **⏳ Due** — "Do X times before date Y." Translates to start = now, end = the due date
- **♾️ Perpetual** — Starts now, continues forever with no end date. This is a radio option in the date mode selector, not a separate checkbox

## Goal and Progress

Each habit has a **Goal** (how many completions per period you're aiming for, minimum 1) and a **Progress** count (how many you've done this period). When progress reaches the goal, the chit is automatically marked Complete. Progress is capped at the goal value and can never exceed it.

## Habits Zone (Editor)

The [chit editor](/editor) includes a **🎯 Habits** collapsible zone (visible only when habit mode is on). It contains three collapsible sections:

- **Settings** — Goal per cycle (Day/Week/Month/Year), Reset period (checkbox to enable, then number + unit), Show on calendar views toggle, Show overall % in view toggle
- **Charts** — Three canvas-based charts: completion over time (bar chart), success rate trend (line chart), and streak timeline. Charts update when you edit past period counts. The time range matches your Success Rate Window setting
- **History** — Past periods in a 2-column layout with [−] X/Y [+] counter widgets for retroactive editing of completion counts

A counter widget also appears in the zone header for quick increment/decrement without expanding the zone.

## Reset Period (Cooldown)

Each habit can have an optional **Reset Period** — a cooldown after completing one unit. Enable it with the "Enable reset" checkbox, then set "Every [X] [Day(s)/Week(s)]". The available units are limited to one level smaller than the cycle (e.g., a Weekly cycle can only use Day(s) for reset; a Monthly cycle can use Day(s) or Week(s)). When the reset period is active (you've already incremented within the current reset window), the + button or checkbox is disabled and the habit moves to the **😌 Out of Mind** section.

## Switching to Habits Mode

When the [Tasks view](/frontend/html/help.html#views) is active, the sidebar shows a View Mode section with three buttons: **📋 Tasks**, **🎯 Habits**, and **📌 Assigned**. Click "Habits" to enter Habits mode. Your selection is remembered across sessions. Only chits explicitly marked as habits appear here — not all recurring chits.

## Habits View Sections

The Habits view organizes habits into three sections:

- **🔜 On Deck** — Habits ready to be worked on, sorted by urgency (least time per remaining action first)
- **😌 Out of Mind** — Habits with an active reset period (recently completed, waiting for cooldown). Shows "☐ Too soon to complete again. Resets on [date]."
- **✅ Accomplished** — Completed habits for the current cycle. Shows "✅ Complete for this cycle. (Next cycle starts [date].)"

Habits animate with a fade-out when moving between sections.

## Habit Cards

Each habit appears as a card showing:

- **Title** — With a period label (e.g., "Week of May 5"). Double-click or long-press to open in the editor
- **Metric boxes** — Four inline metrics:
  - 📊 **Progress** — X/Y each [unit] with [−] [+] buttons
  - 🎯 **Cycle %** — Percentage of the way to the goal this period
  - 📈 **Overall %** — Percentage of past cycles where the goal was fully met (hideable per-habit)
  - 🔥 **Streak** — Consecutive completed periods walking backward; broken-off periods are neutral
- **Note preview** — Rendered markdown on the right side of the card (7-line max)

## Per-Habit Options

- **Show overall % in view** — Default on. When unchecked, the Overall % metric box is hidden from the habit card
- **Show on calendar views** — When off, the habit is hidden from all calendar views but still appears in the Habits view. Default for new habits is controlled by [Settings](/frontend/html/settings.html) → Habits
- **Reset period** — Optional cooldown (see above)
- **Perpetual mode** — Via the ♾️ Perpetual date radio option

## Period Rollover

Habits reset automatically at period boundaries. When a new period starts (e.g., a new day for daily habits, a new week for weekly), the system snapshots the previous period's progress into the recurrence exceptions history, resets progress to 0, and clears the Complete status. Rollover is evaluated lazily — when you open the Habits view or the editor, not via a background process.

## Habit Icon

Habit chits use the 🎯 icon (replacing 🔁) everywhere: calendar chits, visual indicators, editor title bar, and quick-edit modal.

## Sidebar Filter

The sidebar's Show section includes a **"🎯 Hide Habits"** checkbox that filters habits from all views when checked.

## Settings

The Settings page includes a Habits section with:

- **Success rate window** — Controls the rolling time window for success rate and chart calculations:
  - **Last 7 days** — Only periods in the past week
  - **Last 30 days** — Past month (default)
  - **Last 90 days** — Past quarter
  - **All time** — Every period since habit tracking started
- **Default: show habits on calendar** — Toggle controlling the default value of "Show on calendar" for newly created habits

---

**See also:** [Views](/frontend/html/help.html#views) · [Chit Editor](/editor) · [Cron Triggers & Habit Rules](/frontend/html/help.html#cron-triggers) · [Settings](/frontend/html/settings.html)
