# Visual Indicators

- [Indicator Types](#indicator-types)
- [Combine Alerts Toggle](#combine-alerts-toggle)
- [Calendar Views](#calendar-views)
- [Card Views](#card-views)
- ["If Space" Behavior](#if-space-behavior)


Visual indicators are small icons displayed alongside chit titles in all views to signal key properties. Configure their visibility in [Settings → Visual Indicators](/frontend/html/settings.html#visual-indicators). Each indicator has three visibility modes:

- **Always** — The indicator icon is always shown
- **Never** — The indicator icon is never shown
- **If Space** — Show the icon on card views and calendar day/week slots, but hide on month cells where space is tight

## Indicator Types

- 🔔 **Alarm** — Chit has alarm alerts
- 📢 **Notification** — Chit has notification alerts
- ⏱️ **Timer** — Chit has timer alerts
- ⏲️ **Stopwatch** — Chit has stopwatch alerts
- 🌤️ **Weather** — Chit has a location with weather data
- 👥 **People** — Chit has people assigned
- ❤️ **Health** — Chit has health indicator data

## Combine Alerts Toggle

The **Combine Alerts** checkbox in Visual Indicators switches between two display modes:

- **Combined mode** (checked) — A single 🛎️ icon represents all alert types. A "Combined Alerts" dropdown controls visibility (Always / Never / If Space).
- **Individual mode** (unchecked) — Separate icons appear per alert type, each with its own visibility dropdown: 🔔 Alarm, 📢 Notification, ⏱️ Timer, ⏲️ Stopwatch.

## Calendar Views

Calendar views (Week, Day, Month, Itinerary, Seven-Day, X-Day) always use combined mode for alerts since calendar cells are space-constrained. Weather, People, and Health indicators still respect their individual settings.

## Card Views

Checklists, Tasks, Notes, Alarms, and Projects views respect the Combine Alerts toggle — showing either one combined 🛎️ icon or individual per-type icons depending on the setting.

## "If Space" Behavior

When a visibility dropdown is set to "If Space," indicators always appear on card views and calendar day/week slots (sufficient room). On month cells, indicators may be hidden when the title would be truncated.

---

**See also:** [Settings](/frontend/html/settings.html) · [Chit Editor](/editor) · [Calendar](/frontend/html/help.html#calendar)
