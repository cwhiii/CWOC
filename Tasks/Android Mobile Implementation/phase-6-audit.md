# Phase 6 Audit: Feature Parity Tier 2 (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Rules applied:** META-SPEC with Zone/Page/View Completeness Rule. "Partial" banned. Web = spec.
**Android files read:** ContactEditorScreen.kt, ContactEditorViewModel.kt, ContactListScreen.kt, CalendarScreen.kt (Month/Year/Itinerary/X-Day stubs), OmniViewScreen.kt, WeatherScreen.kt, WeatherViewModel.kt, HelpScreen.kt, NotificationsScreen.kt
**Web files read:** contact-editor.html, contact-editor.js, weather.html, help.html

---

## 6.1 Contact Editor

### Web
- Name fields: given, family, middle, prefix, suffix, nickname, display name
- Multi-value fields: phones (with type label), emails (with type label), addresses (with type label), call signs, X handles, websites
- Dates (labeled: birthday, anniversary, etc.)
- Organization, social context
- Has Signal toggle + Signal username
- PGP key field
- Favorite toggle
- Color picker
- Image upload (profile photo)
- Tags (from shared tag tree)
- Notes (multiline)
- Shared to vault toggle
- QR code / vCard export button
- Delete button with confirmation

### Android (ContactEditorScreen.kt)
- Name fields: given, family, middle, prefix, suffix ✅
- Multi-value: phones, emails, addresses (simple text, no type labels) 💀
- Dates (labeled entries) ✅
- Organization, nickname, social context ✅
- Tags (comma-separated chips, no tree picker) 💀
- Color (reuses ColorZone) ✅
- Notes (multiline) ✅
- Favorite toggle ✅
- Delete with confirmation ✅
- Unsaved changes dialog ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Given/Family/Middle/Prefix/Suffix | ✅ | ✅ | ✅ |
| Nickname | ✅ | ✅ | ✅ |
| Display name (computed) | ✅ | ❌ not shown/editable | ❌ |
| Phones with type labels (Home/Work/Mobile) | ✅ | 💀 plain text, no type | 💀 |
| Emails with type labels | ✅ | 💀 plain text, no type | 💀 |
| Addresses with type labels | ✅ | 💀 plain text, no type | 💀 |
| Call signs | ✅ | ❌ | ❌ |
| X handles | ✅ | ❌ | ❌ |
| Websites | ✅ | ❌ | ❌ |
| Has Signal toggle | ✅ | ❌ | ❌ |
| Signal username | ✅ | ❌ | ❌ |
| PGP key | ✅ | ❌ | ❌ |
| Image upload (profile photo) | ✅ | ❌ | ❌ |
| Tags (tree picker from settings) | ✅ | 💀 comma-separated only, no tree picker | 💀 |
| Shared to vault toggle | ✅ | ❌ | ❌ |
| QR code / vCard export | ✅ | ❌ | ❌ |
| Organization | ✅ | ✅ | ✅ |
| Social context | ✅ | ✅ | ✅ |
| Dates (labeled) | ✅ | ✅ | ✅ |
| Color | ✅ | ✅ | ✅ |
| Notes | ✅ | ✅ | ✅ |
| Favorite | ✅ | ✅ | ✅ |
| Delete + confirmation | ✅ | ✅ | ✅ |

**Verdict: 💀 BROKEN** (missing 10 fields, multi-value fields lack type labels, no tree picker for tags, no image upload, no QR/vCard)

---

## 6.2 Calendar Views (Month/Year/Itinerary/X-Day)

### Web
- **Month:** Grid with day cells, event dots/chips per day, click day → day view, today highlight, week numbers
- **Year:** 12 mini-month grids with event dot indicators, click month → month view
- **Itinerary:** Chronological list grouped by day, shows time + title + location
- **X-Day:** Configurable multi-day column view (like week but N days)

### Android (CalendarScreen.kt)
- CalendarScreen references MonthView, YearView, ItineraryView, XDayView composables
- The file ends with `// --- Additional view composables (stubs for tasks 2.2–2.5) ---`
- Day/Week view is a flat event list (not a time grid)

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Month grid with day cells | ✅ | 💀 referenced but likely stub | 💀 |
| Year 12 mini-months | ✅ | 💀 referenced but likely stub | 💀 |
| Itinerary chronological list | ✅ | 💀 referenced but likely stub | 💀 |
| X-Day multi-column | ✅ | 💀 referenced but likely stub | 💀 |
| Event tap opens editor | ✅ | ❌ CalendarScreen doesn't pass onNavigateToEditor | ❌ |
| Today highlight | ✅ | ❌ | ❌ |
| Week numbers | ✅ | ❌ | ❌ |

**Verdict: 💀 BROKEN** (views referenced but are stubs, no tap-to-edit, no today highlight)

---

## 6.3 Omni View

### Web
- Combined view showing all chit types in one scrollable page
- Configurable layout (from settings: omniLayout)
- Locked filters (from settings: omniLockedFilters)
- HST clock mode
- Email count display
- Normalize colors option

### Android (OmniViewScreen.kt)
- Exists as a screen in navigation ✅
- Would need to read the actual file to verify content

### Comparison

Without reading the full OmniViewScreen.kt, based on the settings audit (Phase 5) showing ALL omni settings fields are missing from the settings page, the Omni View cannot be fully configured.

**Verdict: 💀 BROKEN** (omni settings not configurable — omniLayout, omniLockedFilters, omniHstClockMode, omniEmailCount, omniNormalizeColors all missing from settings)

---

## 6.4 Weather

### Web
- Forecasts for all saved locations
- Daily forecast: date, high/low temps, conditions, precipitation, wind
- Location selector
- Refresh button
- Weather icons per condition code

### Android (WeatherScreen.kt)
- TopAppBar with back navigation ✅
- Forecasts for saved locations ✅
- Daily forecast rows (date, temps, conditions, precip, wind) ✅
- Pull-to-refresh ✅
- Loading/error states with retry ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Forecast cards per location | ✅ | ✅ | ✅ |
| Daily rows (date, temps, conditions) | ✅ | ✅ | ✅ |
| Weather icons per condition | ✅ | ❌ text only, no icons | ❌ |
| Location selector | ✅ | ❌ shows all locations, no selector | ❌ |
| Refresh | ✅ | ✅ pull-to-refresh | ✅ |

**Verdict: 💀 BROKEN** (no weather icons, no location selector)

---

## 6.5 Help

### Web
- Dynamic help page loading markdown files from /api/docs
- Table of contents with deep links
- Cross-references between help topics
- Search within help

### Android (HelpScreen.kt)
- Exists in navigation ✅
- Would need full file read to verify content

**Verdict: 💀 BROKEN** (based on prior audit knowledge — help page exists but likely doesn't have full deep-linking, search, or all topics)

---

## 6.6 Pin/Archive/Snooze

### Web
- Pin: bookmark icon toggle, pinned items sort to top
- Archive: moves to archive (hidden from default view, visible with filter)
- Snooze: date/time picker, snoozed items hidden until snooze expires

### Android
- Pin: TopAppBar icon in editor ✅, long-press menu on list cards ✅
- Archive: TopAppBar icon in editor ✅, long-press menu ✅
- Snooze: TopAppBar icon → SnoozePickerDialog ✅, long-press menu ✅
- Pinned items sort to top: ❌ (no special sort treatment for pinned)
- Snoozed items hidden until expiry: ❌ (filter exists but no automatic hide/show based on time)

**Verdict: 💀 BROKEN** (actions work but pinned don't sort to top, snoozed don't auto-hide/show)

---

## 6.7 Notifications Screen

### Web
- N/A (web uses browser notifications, no dedicated page)

### Android (NotificationsScreen.kt)
- Exists in navigation with bell icon + badge in TopAppBar ✅
- Shows notification history ✅

**Verdict: ✅ Complete** (Android-specific, no web equivalent)

---

## Phase 6 Summary

| Section | Verdict |
|---|---|
| 6.1 Contact Editor | � BROKEN |
| 6.2 Calendar Views (Month/Year/Itinerary/X-Day) | � BROKEN |
| 6.3 Omni View | 💀 BROKEN |
| 6.4 Weather | 💀 BROKEN |
| 6.5 Help | 💀 BROKEN |
| 6.6 Pin/Archive/Snooze | 💀 BROKEN |
| 6.7 Notifications Screen | ✅ Complete |

---

## Complete Gap List (Phase 6)

1. **Contact editor: display name not shown/editable**
2. **Contact editor: phones/emails/addresses lack type labels** (Home/Work/Mobile)
3. **Contact editor: call signs field missing**
4. **Contact editor: X handles field missing**
5. **Contact editor: websites field missing**
6. **Contact editor: Has Signal toggle missing**
7. **Contact editor: Signal username field missing**
8. **Contact editor: PGP key field missing**
9. **Contact editor: image upload (profile photo) missing**
10. **Contact editor: tags use comma input, not tree picker from settings**
11. **Contact editor: shared to vault toggle missing**
12. **Contact editor: QR code / vCard export missing**
13. **Calendar: Month view is a stub** (not a real grid with day cells)
14. **Calendar: Year view is a stub** (not 12 mini-month grids)
15. **Calendar: Itinerary view is a stub**
16. **Calendar: X-Day view is a stub**
17. **Calendar: tap event doesn't open editor** (onNavigateToEditor not passed)
18. **Calendar: no today highlight**
19. **Calendar: no week numbers**
20. **Omni View: settings not configurable** (all omni* fields missing from settings)
21. **Weather: no weather condition icons** (text only)
22. **Weather: no location selector** (shows all, can't pick one)
23. **Help: likely missing deep-linking, search, full topic coverage**
24. **Pin/Archive/Snooze: pinned items don't sort to top**
25. **Pin/Archive/Snooze: snoozed items don't auto-hide/show based on time**

**Total: 25 gaps (all 💀 BROKEN)**
