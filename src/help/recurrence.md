# Recurrence

- [Supported Patterns](#supported-patterns)
- [Recurrence Options](#recurrence-options)
- [How It Works](#how-it-works)
- [Timezones & Recurrence](#timezones--recurrence)


Chits can repeat on a schedule. Enable recurrence in the Dates & Times zone of the [chit editor](/editor) by checking the **Repeat** checkbox.

## Supported Patterns

- **Daily** — Every N days
- **Weekly** — Every N weeks on specific days (Mon, Tue, etc.)
- **Monthly** — Every N months on a specific day of the month or day of the week (e.g., "2nd Tuesday")
- **Yearly** — Every N years on a specific date

## Recurrence Options

- **Interval** — How often (every 1, 2, 3... periods)
- **End condition** — Never, after N occurrences, or until a specific date
- **Exceptions** — Skip specific dates without breaking the pattern

## How It Works

Recurring chits expand into virtual instances on the calendar. Each instance can be individually edited (creating an exception) or the series can be edited as a whole. Completing a recurring task advances it to the next occurrence.

## Timezones & Recurrence

Recurring chits interact with [timezones](/frontend/html/help.html#timezones) depending on whether the chit is floating or anchored.

### Anchored Recurring Chits

An anchored recurring chit preserves its **wall-clock time** in the stored timezone across daylight saving transitions. A chit set to repeat daily at 9:00 AM Pacific stays at 9:00 AM Pacific year-round — whether that's PST (UTC−8) in winter or PDT (UTC−7) in summer. The converted time you see on your dashboard shifts by an hour at DST boundaries, but the event stays pinned to 9:00 AM in its home timezone.

### Floating Recurring Chits

A floating recurring chit expands in your current timezone (determined by your [timezone settings](/frontend/html/settings.html#general)). Since floating chits have no stored timezone, occurrences are always interpreted relative to wherever you are now. A floating "daily at 8:00 AM" chit shows 8:00 AM regardless of your location or DST status.

### DST Edge Cases

**Spring-forward gaps** — If an occurrence's wall-clock time falls in a DST gap (e.g., 2:30 AM when clocks skip from 2:00 AM to 3:00 AM), that occurrence shifts forward to the first valid instant after the gap (3:00 AM in this example).

**Fall-back ambiguity** — If an occurrence's wall-clock time is ambiguous because clocks fall back (e.g., 1:30 AM occurs twice), CWOC selects the first occurrence (the pre-transition instance).

### Sub-Daily Frequencies

Chits recurring at **hourly** or **minutely** intervals behave differently from daily-or-greater frequencies. Instead of preserving wall-clock time, they maintain **uniform elapsed-time intervals** between occurrences. An hourly chit always fires exactly 60 minutes apart in real time, even across a DST transition — so the wall-clock time may shift by an hour at the boundary, but the actual interval stays constant.

---

**See also:** [Chit Editor](/editor) · [Timezones](/frontend/html/help.html#timezones) · [Calendar](/frontend/html/help.html#calendar) · [Habits](/frontend/html/help.html#habits)
