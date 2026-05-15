# Timezone Support for Dated Chits

## Current State

Chits store dates/times as naive strings with no timezone info. The backend stores them in SQLite text columns, and the frontend renders them using the browser's local time. Everything implicitly assumes one timezone — wherever the user happens to be.

---

## Data Model Changes

- Add a `timezone` field to chits (e.g., `"America/Denver"`, `"Europe/London"`). Optional string column — null means "use the user's default timezone."
- Add a user-level **default timezone** setting in the settings table, so you're not picking a timezone on every single chit.
- Migration: new nullable `timezone` column on the chits table. Existing chits treated as the user's default timezone.

---

## Backend Changes

### migrations.py
- New migration adding the `timezone` column (nullable text, with existence check).

### models.py
- Add `timezone: Optional[str] = None` to the Chit Pydantic model.

### Routes (chits.py)
- Pass timezone through on create/update.

### ics_serializer.py
- Emit `VTIMEZONE` components and use `DTSTART;TZID=...` instead of naive datetimes.
- This is the most complex backend piece — ICS timezone handling is notoriously fiddly.

### Recurrence Engine
- Expand occurrences in the chit's timezone, not UTC.
- Daylight saving transitions make this tricky (e.g., a 2:30 AM alarm on the day clocks spring forward).

### schedulers.py (Alerts/Alarms)
- Fire alerts at the correct wall-clock time for the chit's timezone.

### Python stdlib support
- Use `zoneinfo` module (Python 3.9+) for backend conversions. No external library needed.

---

## Frontend Changes

### Editor (Dates Zone)
- Timezone picker in the dates zone.
- Could be a searchable dropdown of IANA timezone names, or a "detect from location" approach if the chit has a location set.
- `Intl.supportedValuesOf('timeZone')` provides the full IANA timezone list natively — no library needed.

### Dashboard / Calendar
- Display times converted to the user's local timezone (or the chit's timezone — UX decision).
- Show a small indicator when a chit is in a different timezone than the user's default.

### Shared Utilities
- Helper to format a datetime string + timezone into the user's local time.
- Browser's `Intl.DateTimeFormat` with `timeZone` option handles this natively.

### Recurrence Display
- "Every Tuesday at 9am Pacific" needs to show correctly for someone viewing in Eastern.

---

## UX Decisions (DECIDED)

1. **Display policy**: Show times in the **user's current local timezone only** — no annotation, no dual display. Simple and clean.
2. **Timezone picker**: **Hidden by default** in the editor dates zone. User clicks a "Set timezone" link to reveal it. Common case stays uncluttered.
3. **Location integration**: **Suggestion prompt** — when a chit's location is in a different timezone, show something like "This location is in America/Denver — use it?" User can accept or dismiss.
4. **Existing chits**: Assume they're all in the user's default timezone. No migration prompt needed.

---

## Core Concept: Floating vs. Anchored

This is the fundamental model that drives everything:

### Floating chits (no timezone set)
- Time "floats" with the user. "Take meds at 8am" fires at 8am wherever you are.
- Stored as naive time. Displayed and triggered relative to the user's current timezone.
- This is the default for most chits — daily routines, generic reminders, etc.

### Anchored chits (timezone explicitly set)
- Time is locked to a specific timezone. "Meeting at noon in San Diego" is always noon Pacific.
- Stored with an explicit IANA timezone. Displayed converted to the user's current local time, but fires at the correct absolute moment.
- Use case: travel events, meetings in other cities, anything where the *place* determines the time.

### How the user's "current timezone" is determined
1. **Browser auto-detection** (default) — `Intl.DateTimeFormat().resolvedOptions().timeZone` gives the device's current timezone. When you fly to Denver, your laptop/phone shifts automatically.
2. **Manual override** — A "Current timezone" setting the user can set explicitly. Useful for: VPN masking real location, previewing schedule in a future travel timezone, or devices that report wrong timezone.
3. **Precedence**: Manual override (if set) → browser detection (fallback).

### Smart behavior
- When a chit has a **location** in a different timezone than the user's current timezone, CWOC prompts: "This location is in America/Denver — use it?" Accepting anchors the chit.
- The timezone picker pre-selects the detected timezone from location when available.
- Alarms/alerts on **anchored** chits fire at the correct wall-clock time in the chit's timezone (absolute moment). Alarms on **floating** chits fire at the wall-clock time in the user's current timezone.
- Calendar display always converts anchored chit times to the user's current local time — so you see "when do I need to be ready" not "what time is it there."

---

## What You Don't Need

- No external JS libraries — `Intl.DateTimeFormat` and `Intl.supportedValuesOf('timeZone')` handle display and timezone list.
- No Python library beyond stdlib `zoneinfo` (Python 3.9+) for backend conversions.
- No build tools or npm packages.

---

## Complexity Estimate

| Scope | Effort | Notes |
|-------|--------|-------|
| **Minimal** (store timezone, display in editor, convert on display) | Medium — a day or two | Browser `Intl` API does the heavy lifting |
| **Full** (ICS VTIMEZONE, recurrence+DST, location auto-detect, calendar conversions) | Significantly more | Recurrence + DST interaction is where real complexity lives |

---

## Implementation Order (Suggested)

1. User default timezone setting + "current timezone" override (settings table + settings page UI)
2. `timezone` column on chits + migration
3. Frontend timezone detection helper (override → browser fallback)
4. Editor timezone picker (hidden by default, expandable)
5. Location-based timezone suggestion prompt (geocode → timezone lookup)
6. Display conversion in dashboard/calendar using `Intl.DateTimeFormat`
7. Alert/alarm scheduling: floating (fire at local wall-clock) vs anchored (fire at absolute moment)
8. Recurrence expansion in correct timezone (anchored chits expand in their TZ)
9. ICS export with VTIMEZONE support
