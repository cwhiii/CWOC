# E — Editor Dates (6 items: E1–E6)

## Status: COMPLETE — all 6 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/DateZone.kt`

---

## E1 — Due date "Complete" checkbox missing ✅ COMPLETE (3/3 sub-items)

1. ✅ "Complete" checkbox appears in Due Only mode below the due date field
2. ✅ Checking it calls `onStatusChange("Complete")`, unchecking calls `onStatusChange("ToDo")`
3. ✅ `status` and `onStatusChange` parameters added to DateZone signature

## E2 — Point in Time "Now" button missing ✅ COMPLETE (3/3 sub-items)

1. ✅ "⏱ Now" TextButton below the Point in Time date/time field
2. ✅ Sets point-in-time to `LocalDateTime.now()` formatted as ISO string
3. ✅ One-tap to set current date and time simultaneously

## E3 — All Day toggle not in zone header ✅ COMPLETE (3/3 sub-items)

1. ✅ All Day Switch moved to zone header `trailingContent` — visible without expanding
2. ✅ Quick access from header bar without scrolling into zone body
3. ✅ Only shown when date mode has date fields (not Perpetual/None)

## E4 — Repeat checkbox not in dates zone header ✅ COMPLETE (4/4 sub-items)

1. ✅ "🔁 Repeat" Switch toggle now inside the Dates zone body (after timezone)
2. ✅ Shows current recurrence rule text when active
3. ✅ Visible without scrolling to a separate RecurrenceZone
4. ✅ `recurrenceRule` and `onRecurrenceToggle` parameters added to DateZone

## E5 — Timezone abbreviation labels on date fields ✅ COMPLETE (3/3 sub-items)

1. ✅ Timezone abbreviation (e.g., "EST", "PST") displayed next to each date field label
2. ✅ Computed from selected timezone using `TimeZone.getDisplayName(SHORT)`
3. ✅ `timezoneAbbr` parameter added to `DateTimeField`, passed from computed `tzAbbr`

## E6 — Timezone suggestion from geocoded location ✅ COMPLETE (3/3 sub-items)

1. ✅ `suggestedTimezone` parameter on DateZone — accepts timezone from location geocoding
2. ✅ "📍 Use [timezone] (from location)" button when suggestion differs from current
3. ✅ Clicking applies the suggested timezone via `onTimezoneChange`
