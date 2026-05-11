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

## UX Decisions (Decide Before Building)

1. **Display policy**: Show times in the chit's timezone, the user's local timezone, or both? Travel apps often show "event timezone" with a small "(3pm your time)" annotation.
2. **Default behavior**: Should the timezone picker be hidden by default and only shown when the user explicitly wants a non-local timezone? Keeps the common case simple.
3. **Location integration**: Auto-suggest timezone from the chit's location? Already have geocoding — just need a timezone lookup from coordinates (free APIs exist, or a static shapefile approach).
4. **Existing chits**: Assume they're all in the user's default timezone? Or prompt to confirm?

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

1. User default timezone setting (settings table + settings page UI)
2. `timezone` column on chits + migration
3. Editor timezone picker (hidden by default, expandable)
4. Display conversion in dashboard/calendar using `Intl.DateTimeFormat`
5. Timezone indicator on chit cards when non-local
6. ICS export with VTIMEZONE support
7. Recurrence expansion in correct timezone
8. Alert/alarm scheduling with timezone awareness
9. Location-based timezone auto-suggestion (optional enhancement)
