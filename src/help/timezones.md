# Timezones

- [Floating vs Anchored](#floating-vs-anchored)
- [Timezone Picker](#timezone-picker)
- [Location Suggestions](#location-suggestions)
- [Settings](#settings)
- [Time Display](#time-display)
- [ICS Export](#ics-export)


Every chit in CWOC is either **floating** or **anchored** to a specific timezone. This determines how its times are interpreted and displayed.

## Floating vs Anchored

**Floating chits** (the default) have no timezone set. Their times move with you — "8:00 AM" means 8:00 AM wherever you are. If you fly from Denver to London, a floating chit at 8:00 AM still shows 8:00 AM. Most chits should stay floating: morning routines, daily tasks, reminders tied to your personal schedule.

**Anchored chits** have a specific IANA timezone stored (e.g., "America/Los_Angeles"). Their times are locked to that timezone and displayed converted to your current local time. A noon meeting anchored to Pacific time shows as 1:00 PM if you're in Mountain time, or 8:00 PM if you're in London. Use anchored chits for travel events, meetings with people in other timezones, or anything tied to a specific location's clock.

| Type | Timezone field | Behavior |
|------|---------------|----------|
| Floating | Empty (null) | Times shown as-is — they follow you |
| Anchored | IANA timezone (e.g., "America/Denver") | Times converted to your current local time |

## Timezone Picker

The timezone picker is a modal dialog in the [chit editor](/editor). Each date row (Start/End, Due, Point in Time) shows a small **timezone abbreviation label** at its end — like "MST", "PST", or "EST".

**Understanding the abbreviation label:**

- **Muted/faded** — The chit is floating. The abbreviation shows your current assumed timezone (e.g., if you're in Mountain time during winter, you'll see a faded "MST"). This is informational — it tells you what timezone is being assumed for this chit.
- **Full opacity** — The chit is anchored. The abbreviation shows the chit's explicit timezone.

The abbreviation is always based on **today's date**, so it reflects the current DST state (MST in winter, MDT in summer).

**Hover tooltip:** Hovering over the abbreviation label shows all forms of the timezone name — the abbreviation (e.g., "MST"), the full name (e.g., "Mountain Standard Time"), and the IANA identifier (e.g., "America/Denver").

**To anchor a chit:**

1. Set a date mode other than "None" in the [editor](/editor) Dates & Times zone
2. Click the **timezone abbreviation** at the end of any date row
3. The timezone picker modal opens — search by IANA name (e.g., "America/Denver"), common abbreviation (e.g., "MST"), or enter an address/city name
4. Select a timezone from the dropdown, or type a place name and press Enter to auto-detect the timezone via geocoding
5. The modal auto-closes once a valid timezone is selected

**Address geocoding:** If you type something that isn't a recognized timezone (like "San Diego" or "123 Main St, Portland"), CWOC will attempt to geocode it and automatically determine the correct timezone for that location.

**Modal controls:**
- **Clear (floating)** — Removes the timezone and reverts the chit to floating
- **Cancel** — Closes the modal without making changes
- **ESC** or clicking outside the modal also cancels

**To revert to floating**, open the timezone picker modal and click "Clear (floating)". The chit returns to floating and the abbreviation label reverts to the muted style showing your current timezone.

## Location Suggestions

When you set a location on a chit and the geocoded timezone differs from your current timezone, CWOC displays a suggestion prompt:

> 📍 This location is in **America/Los_Angeles**. Set timezone?  [Accept] [Dismiss]

- **Accept** — Sets the chit's timezone to the detected value (anchors it)
- **Dismiss** — Leaves the chit floating, hides the prompt

The suggestion only appears when:
- The chit doesn't already have an explicit timezone set
- The location's timezone differs from your current timezone
- Geocoding completed successfully

This makes it easy to anchor travel events without manually searching for the timezone.

## Settings

Configure your timezone preferences in [Settings → General](/frontend/html/settings.html#general):

**Default Timezone** — Your home timezone. Pre-populated with your browser's detected timezone on first use. Used as a fallback when browser detection is unavailable.

**Current Timezone Override** — Manually set your current timezone to something other than what your browser reports. Useful when your device timezone doesn't match where you actually are (e.g., traveling with a laptop still set to home time). Clear this field to return to automatic browser detection.

**Resolution order:** CWOC determines your current timezone using this precedence:

1. Current Timezone Override (if set)
2. Browser-detected timezone (via your device/OS settings)
3. Default Timezone (stored fallback)
4. UTC (last resort)

## Time Display

All times on the dashboard and calendar are shown in your current local timezone:

- **Floating chits** — Times displayed as-is (no conversion needed, they're already in your timezone by definition)
- **Anchored chits** — Times converted from the chit's stored timezone to your current timezone

If an anchored chit has an unrecognized timezone (rare — usually from data corruption), its time is displayed unconverted with a ⚠️ warning indicator.

When your current timezone changes (you update the override in [Settings → General](/frontend/html/settings.html#general), or your browser detects a new timezone), all displayed anchored chit times re-render automatically without a page reload.

**Recurring chits** with a timezone preserve their wall-clock time across daylight saving transitions. A "daily at 9:00 AM Pacific" chit stays at 9:00 AM Pacific whether it's PST or PDT. See [Recurrence](/frontend/html/help.html#recurrence) for more details.

## ICS Export

When exporting chits to ICS format (via [Settings → Data Management](/frontend/html/settings.html#data-management)):

- **Anchored chits** include full timezone information (`VTIMEZONE` component + `TZID` on date properties), so other calendar apps display them at the correct time
- **Floating chits** export as naive local times (no timezone annotation), matching the iCalendar spec for floating events
- **All-day chits** export as date-only values without time or timezone components

This ensures imported events display correctly in Google Calendar, Apple Calendar, Outlook, and other standards-compliant calendar applications.

---

**See also:** [Chit Editor](/editor) · [Recurrence](/frontend/html/help.html#recurrence) · [Settings → General](/frontend/html/settings.html#general) · [Calendar](/frontend/html/help.html#calendar) · [Data Management](/frontend/html/help.html#data-management)
