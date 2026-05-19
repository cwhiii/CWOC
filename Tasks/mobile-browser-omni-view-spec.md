# Mobile Browser — Omni View (Overview Zone): Complete Specification

This document describes every visual element, interaction, and behavior of the Omni View as rendered on a mobile browser (viewport ≤ 768px, with additional refinements at ≤ 480px). It is intended as a pixel-accurate reference for replicating this view on another platform.

---

## 1. Activation & Entry

### 1.1 How to Enter Omni View
- **Tap the word "Omni"** in the header title bar. The title reads "Omni Chits" — the word "Omni" is wrapped in a `<span id="omni-trigger" class="omni-header-btn">` and is independently tappable.
- **Via the Views panel:** The Omni View does NOT appear as a tab in the Views panel (it has no C CAPTN tab). It is only accessible by tapping the "Omni" word in the header.

### 1.2 Omni Trigger Button Styling
- **Display:** Inline within the `<h1>` title
- **Font:** Inherits Lora serif from the header
- **Background:** `rgba(107, 78, 49, 0.08)` (very subtle brown tint)
- **Border-bottom:** 2px solid `rgba(107, 78, 49, 0.25)` (subtle underline accent)
- **Padding:** 2px 8px
- **Border-radius:** 4px
- **Cursor:** pointer
- **Transition:** color 0.2s, background 0.2s, box-shadow 0.2s
- **On hover/tap:** Background darkens to `rgba(107, 78, 49, 0.15)`, border-bottom-color to `rgba(107, 78, 49, 0.5)`
- **On mobile (≤480px):** Gets `display: inline-flex; align-items: center; min-height: 44px; padding: 8px 4px;` for touch-friendly tap target

### 1.3 State on Entry
- No tab in the tab bar is highlighted (all `.tab` elements lose `.active` class)
- The mobile Views button label updates to "☰ Omni"
- Email pagination resets to page 0
- Sidebar filters are either cleared to a fresh state OR locked defaults are applied (see Section 10)
- The 🔒 "Lock Filters" button appears in the sidebar

---

## 2. Page Structure & Navigation (Mobile Context)

### 2.1 Fixed Header Bar
- Same as all dashboard views (see Tasks View spec Section 1.1)
- The "Omni" word in the title is the entry point — it remains tappable at all times regardless of which view is active

### 2.2 Views Panel
- Omni View does NOT appear as an option in the Views panel
- When Omni is active, no option in the Views panel is highlighted as "active"
- Selecting any view from the panel exits Omni View and switches to that tab

### 2.3 Sidebar (Filters & Controls)
- Same sidebar as other views, with one addition:
  - **🔒 Lock Filters button** — Only visible when Omni View is active. Appears in the filter section header row alongside Clear/Defaults buttons.
  - Styling: `background: #f5e6cc; border: 1px solid #8b4513; color: #6b4e31; border-radius: 4px; font-family: Lora, serif; font-size: 0.75em; padding: 4px 8px;`
  - Hover: `background: #8b4513; color: #fffaf0;`
  - Label: "🔒 Lock"
  - On tap: Saves current sidebar filter state as Omni View defaults (persisted to backend)
- **🔒 Locked indicator** — When locked defaults are active, a "🔒" span appears near the search input. `font-size: 0.9em; opacity: 0.85; cursor: help;` Title: "Omni View locked filter defaults active"
- **No view mode toggle** — Unlike Tasks view, there is no Tasks/Habits/Assigned sub-mode toggle for Omni View
- **No period selector** — The calendar period selector and date navigation arrows are hidden

---

## 3. Overall Layout (Mobile ≤ 768px)

### 3.1 Container Structure
```
#chit-list
  └── .omni-view
        ├── .omni-section.omni-section-full  (HST Bar)
        ├── .omni-section.omni-section-full  (Weather Bar)
        ├── .omni-grid  (single-column on mobile)
        │     ├── .omni-col.omni-col-left
        │     │     ├── .omni-section.omni-section-half (Chrono Anchored)
        │     │     ├── .omni-section.omni-section-half (Reminders)
        │     │     ├── .omni-section.omni-section-half (On Deck)
        │     │     ├── .omni-section.omni-section-half (Soon)
        │     │     └── .omni-section.omni-section-half (Email)
        │     └── .omni-col.omni-col-right
        │           ├── .omni-section.omni-section-half (Pinned Notes)
        │           └── .omni-section.omni-section-half (Pinned Checklists)
        └── (end)
```

### 3.2 Mobile Layout Behavior
- **`.omni-view`:** `width: 100%; padding: 0; background: transparent; display: flex; flex-direction: column; overflow-y: auto;` (on mobile, `overflow-y: auto` replaces the desktop `overflow: hidden`)
- **`.omni-grid`:** On mobile (≤768px): `grid-template-columns: 1fr; gap: 0; overflow: visible;` — collapses from two columns to a single column. All sections stack vertically.
- **`.omni-col`:** On mobile: `overflow: visible;` (no independent column scrolling — the entire view scrolls as one)
- **`.omni-section-full`:** `width: 100%; margin-bottom: 2px; padding: 0 10px; box-sizing: border-box;`
- **Scrollbar:** Hidden on all Omni View elements (`scrollbar-width: none; -ms-overflow-style: none; ::-webkit-scrollbar { display: none; }`)

### 3.3 Section Order (Default)
On mobile, all sections render in a single vertical stack in this order:
1. HST Bar (full-width)
2. Weather Bar (full-width)
3. Chrono Anchored (was left column)
4. Reminders (was left column)
5. On Deck (was left column)
6. Soon (was left column)
7. Email (was left column)
8. Pinned Notes (was right column)
9. Pinned Checklists (was right column)

The order is configurable via Settings → Omni View → Arrange Omni Layout. The user can reorder, hide, or change column assignment of any section.

### 3.4 Section Visibility
- Each section has a `hideWhenEmpty` flag (default: `true`)
- If `hideWhenEmpty` is true AND the section has no items, the entire section element gets `display: none`
- If `hideWhenEmpty` is false AND the section is empty, it shows an italic message: "No [section name] right now." (class `.omni-empty`)
- HST, Weather, HST+Weather, and HST Weather Strip sections are exempt from this logic (they self-manage visibility)

---

## 4. Section Headers

### 4.1 Appearance
- **CSS class:** `.omni-section-header`
- **Font:** Lora serif, bold, 1.1em on mobile (desktop: 1.5em)
- **Color:** `#1a1208` (dark brown text)
- **Background:** `rgba(90, 54, 24, 0.5)` (semi-transparent dark brown)
- **Border:** 2px solid `#8b4513`
- **Border-radius:** 20px (pill shape)
- **Padding:** 3px 8px on mobile (desktop: 4px 10px), padding-top: 6px
- **Margin-bottom:** 6px
- **Layout:** `display: flex; align-items: center; justify-content: center; gap: 6px;`
- **Content:** Icon emoji + section label text (e.g., "⏰ Chrono Anchored", "📢 Reminders")

### 4.2 Sections WITHOUT Headers
- HST Bar, Weather Bar, HST+Weather, HST Weather Strip — these are self-contained visual elements and do not render a section header

### 4.3 Section Icons & Labels
| Section ID | Icon | Label |
|-----------|------|-------|
| chrono | ⏰ | Chrono Anchored |
| reminders | 📢 | Reminders |
| ondeck | 🔜 | On Deck |
| soon | 🗓️ | Soon |
| email | 📧 | Email |
| pinned_notes | 📝 | Pinned Notes |
| pinned_checklists | ☑️ | Pinned Checklists |
| pinned_all | 📌 | Pinned |

---

## 5. HST Bar (Horizontal Strip Timeline)

### 5.1 Purpose
A full-width progress bar representing the 24-hour day. The fill gradient shows how much of the day has elapsed. Chit icons and weather icons are positioned at their scheduled times along the bar.

### 5.2 Visual Structure
```
┌─────────────────────────────────────────────────────────────┐
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ [time overlay]     🗓️  ☑️    ☀️        🌧️                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Bar Container (`.omni-hst-bar`)
- **Width:** 100%
- **Height:** 2em on mobile (desktop: 2.4em)
- **Background:** `#f5e6cc` (light parchment)
- **Border:** 2px solid `#8b4513`
- **Border-radius:** 6px
- **Overflow:** hidden
- **Box-shadow:** `inset 0 2px 4px rgba(0, 0, 0, 0.15)`
- **Box-sizing:** border-box
- **Max-width:** 100%

### 5.4 Fill Element (`.omni-hst-fill`)
- **Position:** absolute, top: 2px, left: 2px, bottom: 2px
- **Width:** Dynamically set to `(currentSeconds / 86400) * 100%` — updates every 1 second
- **Background:** `linear-gradient(90deg, #d4af37 0%, #c8965a 60%, #8b4513 100%)` (gold → brown gradient)
- **Border-radius:** 4px
- **Transition:** `width 1s linear`

### 5.5 Time Overlay (`.omni-hst-time-overlay`)
- **Position:** absolute, fills entire bar
- **Layout:** `display: flex; align-items: center; justify-content: flex-start; padding: 0 12px;`
- **Z-index:** 1
- **Pointer-events:** none (clicks pass through)
- **Font:** Lora serif, 1.1em, bold
- **Color:** `#4a2c2a`
- **Text-shadow:** `0 0 4px #fff8e1, 0 0 8px #fff8e1, 0 0 2px #fff8e1` (glow for readability over fill)
- **Letter-spacing:** 1px
- **Content depends on `omni_hst_clock_mode` setting:**
  - `'hst'` → Shows HST value: e.g., "45.832 sd" (percentage of day × 100, 3 decimal places)
  - `'system'` → Shows system time formatted per user's time format preference (12h/24h)
  - `'both'` (default) → Shows HST value: "45.832 sd"
- **Updates:** Every 1 second via interval

### 5.6 Chit Icons (`.omni-hst-chit-icon`)
- **Position:** absolute, `top: 50%; transform: translate(-50%, -50%);` — centered vertically
- **Left:** Calculated as `(hour * 3600 + minute * 60) / 86400 * 100%`
- **Font-size:** 0.85em on mobile (desktop: 1em)
- **Pointer-events:** auto (clickable)
- **Cursor:** pointer
- **Z-index:** 2
- **Text-shadow:** `0 0 3px #fff8e1, 0 0 6px #fff8e1` (glow)
- **Hover:** `transform: translate(-50%, -50%) scale(1.3)`
- **Icon types:**
  - Tasks (has status): ☑️
  - Events (no status): 🗓️
- **Tap action:** Opens Quick Edit Modal for that chit
- **Crowding detection:** If adjacent icons would be < 20px apart (based on bar width), ALL chit markers collapse to vertical lines instead of icons

### 5.7 Collapsed Lines (`.omni-hst-line`) — When Crowded
- **Position:** absolute, top: 4px, bottom: 4px
- **Width:** 2px (3px on hover)
- **Background:** `#4a2c2a` (dark brown), opacity 0.8 (1 on hover)
- **Transform:** `translateX(-50%)`
- **Pointer-events:** auto, cursor: pointer
- **Z-index:** 2
- **Tap action:** Same as icon — opens Quick Edit Modal

### 5.8 Weather Icons (`.omni-hst-weather-icon`)
- **Position:** absolute, `top: 50%; transform: translate(-50%, -50%);`
- **Left:** `(hour * 3600) / 86400 * 100%`
- **Font-size:** 0.65em on mobile (desktop: 1em)
- **Pointer-events:** auto, cursor: pointer
- **Z-index:** 1
- **Opacity:** 0.85 (1 on hover)
- **Hover:** `transform: translate(-50%, -50%) scale(1.3)`
- **Only shown for:** Hours that haven't passed yet (current hour and future), and only when the weather icon changes from the previous hour
- **Tooltip:** "[time] — [condition name]" (e.g., "2 PM — Partly Cloudy")
- **Tap action:** Opens the weather modal
- **Long-press (mobile):** Also opens the weather modal
- **Data source:** Open-Meteo hourly weather codes, cached in localStorage for 30 minutes

### 5.9 HST Mode Cycling
- **Tap the bar background** (not on an icon) to cycle through display modes:
  - `'chits'` → Only chit icons visible, weather icons hidden
  - `'both'` → Both chit and weather icons visible (default)
  - `'weather'` → Only weather icons visible, chit icons hidden
  - `'none'` → All icons hidden (just the fill bar + time)
- Mode is stored in the `_omniHSTMode` variable (not persisted — resets on page reload)

---

## 6. Weather Bar

### 6.1 Purpose
A compact strip showing current weather conditions for the user's default saved location. Tapping opens the full weather modal.

### 6.2 Visual Structure
```
┌──────────────────────────────────────────────────────────────┐
│  ☀️   [temp bar: ██████████░░░░░░]   Springfield, IL        │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Bar Container (`.omni-weather-bar`)
- **Layout:** `display: flex; align-items: center; gap: 8px;` (mobile: gap 8px, desktop: 12px)
- **Width:** 100%
- **Padding:** 8px 12px on mobile (desktop: 10px 16px)
- **Background:** `linear-gradient(135deg, #fff8e1, #f5e6cc)`
- **Border:** 2px solid `#8b4513`
- **Border-radius:** 6px
- **Box-shadow:** `inset 0 1px 3px rgba(0, 0, 0, 0.08)`
- **Font:** Lora serif
- **Box-sizing:** border-box
- **Max-width:** 100%
- **Overflow:** hidden
- **Cursor:** pointer
- **Hover:** Background shifts to `linear-gradient(135deg, #fff3e0, #ede0cc)`, adds outer shadow `0 2px 6px rgba(0, 0, 0, 0.1)`
- **Tap action:** Opens weather modal
- **Long-press (mobile):** Also opens weather modal

### 6.4 Weather Icon (`.omni-weather-icon`)
- **Font-size:** 1.3em on mobile (desktop: 1.6em)
- **Line-height:** 1
- **Flex-shrink:** 0
- **Content:** Weather condition emoji (☀️, 🌤️, ⛅, 🌧️, ❄️, etc.) from WMO weather code mapping

### 6.5 Temperature Bar (`.weather-modal-temp-bar`)
- Reuses the shared temperature bar component from the weather modal
- Shows a horizontal gradient bar with current temperature position marked
- **Flex:** 1, min-width: 80px

### 6.6 Location Label (`.omni-weather-location`)
- **Font-size:** 0.8em on mobile (desktop: 0.9em)
- **Color:** `#6b4e31`
- **Margin-left:** auto (pushes to right)
- **White-space:** nowrap
- **Overflow:** hidden, text-overflow: ellipsis
- **Max-width:** 120px on mobile (desktop: 200px)
- **Opacity:** 0.85
- **Content:** The label of the default saved location (or the address if no label)

### 6.7 Loading & Empty States
- **Loading:** "⏳ Loading weather…" (class `.omni-weather-loading`, font-size 0.9em, color `#6b4e31`, opacity 0.6)
- **No location configured:** "No location configured" (class `.omni-weather-empty`, font-size 0.9em, color `#6b4e31`, opacity 0.5, italic)
- **Weather unavailable:** "Weather unavailable" (same styling as empty)

---

## 7. Chrono Anchored Section

### 7.1 Purpose
Shows timed events happening today that haven't fully ended yet. Each card shows the event with a "time-until" badge indicating how soon it starts.

### 7.2 Data Selection (Deduplication Algorithm)
A chit appears in Chrono Anchored if:
- It has a `start_datetime` with a specific time (not all-day) AND the event spans today (start ≤ end of today AND end ≥ start of today)
- OR it has a `due_datetime` with a specific time (hour > 0 or minute > 0) that falls within today
- AND the event's end time has not passed (or it's a task with status)
- Past non-task events are excluded
- Each chit appears in exactly ONE section (strict deduplication)

### 7.3 Card Rendering
- Reuses `_buildItineraryEvent()` — same card structure as the Calendar Itinerary view
- **Card class:** `.itinerary-event`
- **Layout:** Flex row with time column + details
- **Styling:** `display: flex; align-items: center; padding: 8px 10px; border-radius: 5px; margin: 4px 0;`
- **On mobile:** `max-width: 100%; box-sizing: border-box; padding-left: 1.5em;`
- **Time column:** Shows formatted start time (auto-width on mobile, `min-width: 0; margin-right: 6px;`)
- **Background:** Chit's custom color (or `#fdf6e3` default), with auto-contrast text
- **Tap action:** Navigates to `/editor?id=[chitId]` (calls `storePreviousState()` first)

### 7.4 Time-Until Badge (`.omni-time-badge`)
- **Position:** Appended to the end of each card
- **Display:** inline-block
- **Margin-left:** 8px
- **Padding:** 2px 8px
- **Font-size:** 0.75em, bold
- **Color:** `#4a2c2a`
- **Background:** `#f5e6cc`
- **Border:** 1px solid `#c4a97d`
- **Border-radius:** 10px
- **Flex-shrink:** 0
- **White-space:** nowrap
- **Content format:**
  - Within 5 minutes: "now"
  - Under 60 minutes: "in Xm" (e.g., "in 23m")
  - Over 60 minutes: "in Xh Ym" (e.g., "in 2h 15m") or "in Xh" if minutes = 0
- **Updates:** Every 60 seconds via interval. When an event's end time passes, the card is removed from the DOM.
- **Data attribute:** `data-start-time="[ISO string]"` for the update interval to recalculate

### 7.5 Sort Order
- Sorted by start time ascending (earliest first)

---

## 8. Reminders Section

### 8.1 Purpose
Shows reminder chits (notification=true) that are either due today or pinned. Includes a complete button with undo functionality.

### 8.2 Data Selection
A chit appears in Reminders if:
- `notification === true` AND `status !== 'Complete'` AND `archived !== true`
- AND either: `point_in_time` falls within today, OR `pinned === true`

### 8.3 Card Structure
```
┌──────────────────────────────────────────────────────────────┐
│ 📌  [time]   [title]                    [time badge]  [✓]   │
└──────────────────────────────────────────────────────────────┘
```

### 8.4 Card Rendering (`.itinerary-event.reminder-card`)
- **Layout:** `display: flex; align-items: center; padding: 8px 10px; border-radius: 5px; margin: 4px 20px;`
- **Background:** Chit's custom color (or `#fdf6e3` default), with auto-contrast text
- **Cursor:** pointer

**Elements (left to right):**
1. **Icon:** 📌 emoji, font-size 1em, flex-shrink 0, margin-right 6px
2. **Time column:** Width 90px, margin-right 10px, flex-shrink 0, font-size 0.85em
   - If today's reminder: Shows formatted time (e.g., "2:30 PM")
   - If pinned (not today): Shows short date (e.g., "May 20")
   - If no point_in_time: Shows "—"
3. **Title:** Flex 1, overflow hidden, text-overflow ellipsis, white-space nowrap, bold, 1.05em
4. **Time-until badge:** Same `.omni-time-badge` as Chrono, but supports negative values:
   - Past: "-Xm" or "-Xh Ym" (with red border: `1px solid #b22222`, border-radius 3px, padding 1px 4px)
   - Future: "in Xm" or "in Xh Ym"
   - Within 5 min: "now"
5. **Complete button:** `<button class="email-hover-btn">` with `<i class="fas fa-check-circle">`, opacity 0.5, flex-shrink 0, margin-left 8px, no background/border, cursor pointer, font-size 1.1em

### 8.5 Complete Button Behavior
1. Tap the ✓ button
2. Card animates: `opacity: 0.3; transform: translateX(20px);` with 0.3s transition
3. Undo toast appears: "✓ [title]" with 5-second countdown
4. **If countdown expires:** PATCH `/api/chits/[id]/fields` with `{ status: 'Complete', archived: true }`. On success: card removed, chits refreshed. On failure: card restored, error toast.
5. **If Undo tapped:** Card restored to original opacity/position

### 8.6 Sort Order
- Today's reminders first (sorted by `point_in_time` ascending)
- Then pinned reminders (sorted by title alphabetically)

### 8.7 Interactions
- **Tap card body:** Navigates to `/editor?id=[chitId]` (calls `storePreviousState()` first)
- **Double-tap:** Same as single tap (navigates to editor)
- **Tap ✓ button:** Triggers complete flow (see 8.5)

---

## 9. On Deck Section

### 9.1 Purpose
Shows items that are actionable today but don't have a specific time: all-day events today, untimed tasks due today, and habits due today.

### 9.2 Data Selection
A chit appears in On Deck if:
- **All-day event today:** `all_day === true` AND `start_datetime` spans today
- **Untimed task due today:** Has `due_datetime` within today with no specific time (hour=0, minute=0)
- **Habit due today:** `habit === true`, not complete/rejected, `habit_success < habit_goal`, and days left in current cycle ≤ 1

### 9.3 Card Types

#### 9.3.1 Events & Tasks
- Rendered via `_buildItineraryEvent()` — same as Chrono Anchored cards
- Same styling and tap behavior

#### 9.3.2 Habit Cards
- Rendered via `_buildItineraryHabitCard()` — the shared habit card builder
- **Class:** `.habit-card`
- **On mobile:** `max-width: 100%; box-sizing: border-box; width: 100%; margin-left: 0; margin-right: 0; overflow: hidden;`
- Shows: habit title, progress (success/goal), streak badge
- **Streak badge (`.omni-streak-badge`):**
  - Only shown if streak > 0
  - Display: inline-block, margin-left 8px, padding 2px 8px
  - Font-size: 0.75em, bold
  - Color: `#8b4513`
  - Background: `linear-gradient(135deg, #fff3e0, #ffe0b2)`
  - Border: 1px solid `#d4a574`
  - Border-radius: 10px
  - Content: "🔥 [streak count]" (e.g., "🔥 7")
  - Streak = consecutive past periods where `habit_success >= habit_goal`

### 9.4 Card Spacing
- All cards: `margin: 4px 0` (universal 4px vertical spacing enforced by CSS)

---

## 10. Soon Section

### 10.1 Purpose
Shows items due this week but not today. Gives a preview of what's coming up in the next 7 days.

### 10.2 Data Selection
A chit appears in Soon if:
- Has `due_datetime` that falls after today but within 7 days from today
- OR is a habit where days left in cycle > 1 (not due today, but active)
- AND was not already placed in Chrono, On Deck, Reminders, or Email

### 10.3 Card Rendering
- Same card types as On Deck (events/tasks via `_buildItineraryEvent()`, habits via `_buildItineraryHabitCard()`)
- Each card gets an additional **due-date badge (`.omni-due-badge`)**

### 10.4 Due-Date Badge (`.omni-due-badge`)
- **Display:** inline-block
- **Margin-left:** 8px
- **Padding:** 2px 8px
- **Font-size:** 0.75em, bold
- **Color:** `#2e5a3a` (dark green)
- **Background:** `linear-gradient(135deg, #e8f5e9, #c8e6c9)` (light green gradient)
- **Border:** 1px solid `#81c784`
- **Border-radius:** 10px
- **Flex-shrink:** 0
- **White-space:** nowrap
- **Content format:**
  - Due today: "today"
  - Due tomorrow: "1 day"
  - Due in N days: "N days" (e.g., "3 days", "6 days")

### 10.5 Sort Order
- Sorted by due date ascending (soonest first)
- Habits sorted by `daysLeft` (fewest days remaining first)

---

## 11. Email Section

### 11.1 Purpose
Shows unread emails from Omni-enabled bundles, paginated with Previous/Next navigation.

### 11.2 Data Selection
An email chit appears in the Email section if:
- `email_message_id` is present (it's an email chit)
- `email_read === false` (unread)
- Its tags include a bundle tag (`CWOC_System/Bundle/[name]`) that matches an Omni-enabled bundle
- OR: If the catch-all bundle ("Everything Else") is Omni-enabled, emails with NO bundle tag are included
- **Important:** Email filtering uses the GLOBAL chits array, not the sidebar-filtered array. Sidebar filters do not exclude emails from this section.

### 11.3 Card Rendering
- Reuses `_buildEmailCard(chit, viSettings)` from the Email view
- Cards include built-in swipe handlers (swipe to archive/mark read)
- **Container class:** `.omni-email-cards` — `display: flex; flex-direction: column; gap: 4px;`

### 11.4 Pagination
- **Page size:** Configurable via Settings → Omni View → "Emails to show" (options: 3, 5, 10, 15, 20; default: 3)
- **Pagination row (`.omni-email-pagination`):**
  - `display: flex; justify-content: center; gap: 8px;` (mobile: gap 8px, desktop: 12px)
  - `margin-top: 12px; padding: 8px 0;`

#### 11.4.1 Page Buttons (`.omni-email-page-btn`)
- **Padding:** 8px 14px on mobile (desktop: 6px 16px)
- **Font:** Lora serif, 0.9em on mobile (desktop: 0.85em), bold
- **Color:** `#4a2c2a`
- **Background:** `linear-gradient(135deg, #fff8e1, #f5e6cc)`
- **Border:** 1.5px solid `#8b4513`
- **Border-radius:** 6px
- **Cursor:** pointer
- **Hover:** Background shifts to `linear-gradient(135deg, #fff3e0, #ede0cc)`, box-shadow `0 2px 6px rgba(139, 69, 19, 0.2)`
- **Active:** Background `#ede0cc`, box-shadow `inset 0 1px 3px rgba(0, 0, 0, 0.15)`
- **Labels:** "← Previous 3" / "Next 3 →" (number matches page size)
- **Visibility:** Previous button hidden on first page; Next button hidden on last page

#### 11.4.2 Count Indicator (`.omni-email-count`)
- **Text-align:** center
- **Font-size:** 0.75em
- **Color:** `#6b4e31`, opacity 0.7
- **Margin-top:** 6px
- **Font:** Lora serif
- **Content:** "1–3 of 12 unread" (shows current range and total)

### 11.5 Sort Order
- Sorted by `email_date` descending (most recent first)

### 11.6 Empty State
- If no Omni-enabled bundles exist, or no unread emails match: the entire Email section is hidden (`display: none`)

---

## 12. Pinned Notes Section

### 12.1 Purpose
Shows pinned chits that qualify as notes (have content, not already placed in another section). Supports inline editing of note content.

### 12.2 Data Selection
A chit appears in Pinned Notes if:
- `pinned === true`
- NOT `archived`
- NOT already placed in Chrono, On Deck, Soon, Reminders, or Email
- Does NOT have checklist items (those go to Pinned Checklists)

### 12.3 Card Structure (`.chit-card`)
- **Width:** 100% of container
- **Padding:** 8px 10px
- **Border:** 2px solid `#8b5a2b`, border-radius 6px
- **Background:** Chit's custom color (or `#fdf6e3`), auto-contrast text
- **Margin:** 4px 0 (universal spacing)
- **Additional classes:** `.archived-chit` (opacity 0.45), `.declined-chit` if applicable

#### 12.3.1 Title Row
- **Layout:** `display: flex; align-items: center; gap: 0.3em; font-weight: bold; margin-bottom: 0.2em;`
- **Icons (in order, only if applicable):**
  1. **Pinned** — `<i class="fas fa-bookmark">`, 0.85em, cursor pointer, title "Click to unpin"
     - **Tap action:** Unpins the chit (PUT with `pinned: false`), refreshes view
  2. **Archived** — 📦 emoji, title "Archived"
  3. **Snoozed** — 😴 emoji, title "Snoozed until [datetime]" (only if snoozed_until is future)
  4. **Stealth** — 🥷 emoji, class `cwoc-stealth-indicator`, title "Stealth — hidden from other users" (only visible to owner)
  5. **Alert indicators** — Generated by `_getAllIndicators()`, shows relevant icons (🔔📢⏱️📎🔁👥 etc.)
  6. **Title text** — Chit title or "(Untitled)"
  7. **Owner badge** (`.cwoc-owner-badge`) — "👤 [name]" if owned by someone else
  8. **Assignee badge** (`.cwoc-assignee-badge`) — "📌 [name]" if assigned to someone

#### 12.3.2 Note Content (`.note-content`)
- **CSS:** `overflow-y: auto;`
- **Content:** Markdown rendered via marked.js (with `{ breaks: true }`). Chit links resolved to clickable links.
- **Fallback:** If marked.js unavailable, plain text with `white-space: pre-wrap`

### 12.4 Interactions

#### 12.4.1 Single Tap on Note Text → Inline Edit
- Only if user is not a viewer-role
- Note becomes `contentEditable = 'true'`
- Visual feedback: `outline: 2px solid #8b4513; border-radius: 4px; padding: 6px; white-space: pre-wrap; max-height: none; overflow: visible; user-select: text;`
- Card also gets: `cursor: auto; overflow: visible; user-select: text;`
- Content switches from rendered markdown to raw text (`noteEl.textContent = chit.note`)
- Focus is set on the note element
- **Save:** On blur — if text changed, PUT to `/api/chits/[id]` with new note, then refresh
- **Cancel:** Press Escape → triggers blur (saves if changed, or re-renders markdown if unchanged)

#### 12.4.2 Double-Tap on Card → Open Editor
- Navigates to `/editor?id=[chitId]`
- Calls `storePreviousState()` first

#### 12.4.3 Shift+Click → Quick Edit Modal
- Opens Quick Edit Modal (desktop interaction, not typical on mobile)

#### 12.4.4 Right-Click / Context Menu → Custom Context Menu
- Opens the standard chit context menu (see Tasks View spec Section 6)
- Not available for viewer-role chits

---

## 13. Pinned Checklists Section

### 13.1 Purpose
Shows pinned chits that have checklist items. Supports interactive inline checkbox toggling.

### 13.2 Data Selection
A chit appears in Pinned Checklists if:
- `pinned === true`
- NOT `archived`
- NOT already placed in another section
- HAS checklist items (`checklist` is a non-empty array)

### 13.3 Card Structure (`.chit-card`)
- Same base styling as Pinned Notes cards (Section 12.3)
- Additional class: `.checklist-all-done` if all non-empty checklist items are checked (strikes through title)

#### 13.3.1 Header
- Rendered via `_buildChitHeader()` with `{ checklistCount: true, skipMapIcon: true }`
- Shows: icons, title (as link to editor), checklist progress count (e.g., "3/5"), meta items
- **Pin icon** in header: cursor pointer, title "Click to unpin", tap unpins the chit

#### 13.3.2 Interactive Checklist
- Rendered via `renderInlineChecklist()` from `shared-checklist.js`
- Each checklist item is a row with:
  - Checkbox (toggleable)
  - Item text (with markdown rendering for links)
  - Nested items indented
- **Tap checkbox:** Toggles checked state, immediately PATCHes the chit, refreshes view
- **For viewer-role chits:** Read-only display showing only unchecked items with "☐" prefix, opacity 0.8, font-size 0.9em

### 13.4 Interactions
- **Double-tap card:** Opens editor (`/editor?id=[chitId]`)
- **Shift+click:** Opens Quick Edit Modal
- **Right-click / context menu:** Opens standard chit context menu
- **Tap checkbox:** Toggles item (see 13.3.2)

---

## 14. Color Modes

The Omni View supports three color modes, configurable in Settings → Omni View → Color mode.

### 14.1 Colored (Default)
- Each card uses the chit's user-set `color` field
- If no color set: `#fdf6e3` (pale cream)
- Text auto-contrasts against background

### 14.2 Normalized
- All cards get a fixed color based on their TYPE, regardless of user-set color
- Applied after all sections render, walking all `[data-chit-id]` elements in `.omni-view`
- Color assignment is by SECTION, not by chit properties:

| Section / Type | Color | Hex |
|---------------|-------|-----|
| Events (chrono, ondeck, soon) | Medium green | `#7ab87a` |
| Tasks (has status) | Soft purple | `#c4a0d4` |
| Notes (pinned_notes) | Terracotta | `#d4956b` |
| Checklists (pinned_checklists) | Medium sky blue | `#9cc4d8` |
| Birthdays | Medium orchid | `#d8a8d8` |
| Email | Dark mocha | `#a89070` |
| Habits | Light yellow | `#f0e87a` |
| Reminders | Dusty rose-red | `#c47a76` |

- Text color: auto-contrasted via `contrastColorForBg()` function (or fallback `#1a1208`)

### 14.3 Mono
- ALL cards get a clean ivory/cream background: `#fffaf0`
- Text color: `#1a1208` (dark brown)
- No variation between card types

### 14.4 Setting Storage
- Stored as `omni_normalize_colors` in settings
- Values: `'colored'`, `'normalized'`, `'mono'`
- Legacy values: `'1'` = normalized, `'0'` = colored

---

## 15. Filter Lock System

### 15.1 Purpose
Allows the user to save the current sidebar filter state as "locked defaults" that auto-apply every time they enter the Omni View.

### 15.2 Lock Button
- **Location:** Sidebar filter section header row, alongside Clear/Defaults buttons
- **Visibility:** Only when Omni View is active (hidden when switching to other tabs)
- **Label:** "🔒 Lock"
- **Styling:** See Section 2.3
- **Tap action:** Saves current filter state to backend

### 15.3 What Gets Saved
The locked filter state object contains:
```json
{
  "statuses": ["ToDo", "In Progress"],
  "tags": ["Work", "Personal"],
  "priorities": ["High"],
  "people": ["John Doe"],
  "text": "search term"
}
```
- Saved to backend via `POST /api/settings` as `omni_locked_filters` (JSON string)
- Also cached in `window._cwocSettings.omni_locked_filters`

### 15.4 On Omni View Entry
1. Check if `omni_locked_filters` exists in settings
2. **If locked defaults exist:**
   - Apply them to the sidebar UI (check/uncheck status, priority, tags, people checkboxes; set search text)
   - Show 🔒 indicator near search input
   - Store in `_omniLockedFilters` variable
3. **If no locked defaults:**
   - Clear all sidebar filters to a fresh state (all "Any" checked, no text, no tags/people)
   - Hide 🔒 indicator
4. **Always:** Enable "Show Email (Received)" checkbox so email chits are included

### 15.5 Locked Indicator
- **Element:** `<span id="omni-locked-indicator">` with text "🔒"
- **Position:** Appended to the search input's parent element
- **Styling:** `display: inline-block; margin-left: 8px; font-size: 0.9em; opacity: 0.85; cursor: help;`
- **Title:** "Omni View locked filter defaults active"
- **Visibility:** Shown only when locked defaults are active; hidden when leaving Omni View

### 15.6 Guard Against Infinite Loop
- A flag `_omniFiltersApplied` prevents the filter-apply logic from re-triggering:
  - Set to `true` on Omni View entry (before applying filters)
  - Reset to `false` when leaving Omni View (switching to any other tab)
  - The `displayOmniView()` function checks this flag and skips filter application if already applied

---

## 16. Deduplication Algorithm (Complete)

Each chit appears in exactly ONE section. The algorithm processes in this order:

### Step 0: Reminders
- Filter: `notification === true` AND `status !== 'Complete'` AND `!archived`
- Place if: `point_in_time` is today OR `pinned === true`
- Mark placed IDs

### Step 1: Email
- Filter from GLOBAL chits array (not filtered): `email_message_id` present
- Place ALL email chits (filtering by bundle/read status happens at render time)
- Mark placed IDs

### Step 2: Habits
- Filter from original chits: `habit === true` AND `status !== 'Complete'` AND `status !== 'Rejected'`
- Skip if already placed
- Evaluate rollover (if applicable)
- Skip if `habit_success >= habit_goal` (completed for this period)
- Calculate days left in cycle based on recurrence rule:
  - DAILY: 1 × interval days
  - WEEKLY: 7 × interval days
  - MONTHLY: 30 × interval days
  - YEARLY: 365 × interval days
- If days left ≤ 1 → **On Deck**
- If days left > 1 → **Soon** (with calculated due date)
- Mark placed IDs

### Step 3: Non-Habit Chits (Events & Tasks)
- Skip if: already placed, is a habit, status = Complete, has only point_in_time (no start/due), is an email chit
- Skip virtual recurrence instances not matching today
- Skip non-recurring chits entirely in the past
- Deduplicate by chit ID (or parent_id + virtual_date for recurrence instances)
- **All-day event today** → On Deck
- **Timed event today** (start ≤ end of today AND end ≥ start of today, end not passed or is a task) → Chrono Anchored
- **Due today with specific time** (hour > 0 or minute > 0) → Chrono Anchored
- **Due today without specific time** → On Deck
- **Due this week (not today)** → Soon
- Mark placed IDs

### Step 4: Pinned Chits (Remaining)
- Filter: `pinned === true` AND NOT `archived` AND NOT already placed
- If has non-empty checklist → **Pinned Checklists**
- Otherwise → **Pinned Notes**
- Mark placed IDs

### Post-Processing
- Chrono: sorted by start time ascending
- Soon: sorted by due date ascending

---

## 17. Settings That Control Omni View

All configurable via Settings → Views tab → Omni View section.

### 17.1 HST Bar Clock Mode (`omni_hst_clock_mode`)
- **Options:** "Both (System + HST)", "HST Only", "System Time Only"
- **Values:** `'both'`, `'hst'`, `'system'`
- **Default:** `'both'`
- **Effect:** Controls what the time overlay on the HST bar displays

### 17.2 Layout Configuration (`omni_layout`)
- **Type:** JSON array of section config objects
- **Each object:** `{ id, width, visible, position, column, hideWhenEmpty }`
- **Configurable via:** "🔮 Arrange Omni Layout" button → opens a drag-and-drop modal
- **Layout modal features:**
  - Three zones: Full Width (top), Left Column, Right Column, plus an Unused zone
  - Drag cards between zones to change column/width assignment
  - Drag within a zone to reorder
  - Eye icon toggle on each card: controls `hideWhenEmpty` (hide when empty vs always show)
  - Changes saved on settings save

### 17.3 Email Bundle Toggles
- **Per-bundle checkbox:** Controls which email bundles appear in the Omni email section
- **Stored as:** `omni_view` flag on each bundle (1 = show, 0 = hide)
- **UI:** Checkbox list under "📧 Bundle Omni View Toggles" heading

### 17.4 Emails to Show (`omni_email_count`)
- **Options:** 3, 5, 10, 15, 20
- **Default:** 3
- **Effect:** Controls pagination page size in the Email section

### 17.5 Color Mode (`omni_normalize_colors`)
- **Options:** "Colored", "Normalized", "Mono"
- **Values:** `'colored'`, `'normalized'`, `'mono'`
- **Default:** `'colored'`
- **Effect:** See Section 14

### 17.6 Locked Filter Defaults (`omni_locked_filters`)
- **Type:** JSON string containing filter state object
- **Set via:** 🔒 Lock button in sidebar (see Section 15)
- **Display in settings:** Shows current locked filters as text (e.g., "Status: ToDo, In Progress; Tags: Work")
- **Clear button:** "🗑️ Clear Defaults" — removes locked filters
- **Reset button:** "↩️ Reset Omni View to Defaults" — resets layout, clock mode, and clears locked filters

---

## 18. Alternative Full-Width Sections (Hidden by Default)

These sections are available in the layout configurator but hidden by default.

### 18.1 HST + Weather Combo (`hst_weather`)
- **Layout:** Side-by-side grid: `grid-template-columns: 1fr 1fr; gap: 8px;`
- **On mobile (≤768px):** Stacks vertically: `grid-template-columns: 1fr; gap: 4px;`
- **Left side:** HST bar (same as Section 5)
- **Right side:** Weather bar (same as Section 6)
- **Class:** `.omni-hst-weather-combo`

### 18.2 HST Weather Strip (`hst_temp_strip`)
- **Structure:** Normal HST bar with a temperature color gradient strip at the bottom
- **Bar height:** `calc(2.4em + 16px)` (taller than normal HST bar to accommodate strip)
- **Temperature strip (`.omni-hst-temp-strip`):**
  - Position: absolute, bottom 2px, left 2px, right 2px
  - Height: 16px
  - Border-radius: 0 0 4px 4px
  - Background: `linear-gradient(to right, ...)` — 100 color stops interpolated from hourly temperatures
  - Colors: Temperature-to-color mapping (cold = blue, warm = orange/red)
  - **Hover tooltip:** Shows temperature + time + HST value at cursor position (e.g., "72°F at 2:30 PM (60.4 sd)")
  - **Data source:** Open-Meteo hourly temperature API, cached in localStorage for 1 hour
- **HST fill and icons:** Adjusted to sit above the strip (bottom: 18px instead of 2px)

### 18.3 Pinned All (`pinned_all`)
- Combines Pinned Notes and Pinned Checklists into a single section
- Renders checklists first, then notes (in a sub-container `.omni-pinned-all-notes`)
- Uses the same card renderers as the individual sections

---

## 19. Card Spacing & Overflow Rules

### 19.1 Universal 4px Spacing
All card types within `.omni-section-content` get forced 4px vertical margins:
```css
.omni-section-content > *,
.omni-section-content .chit-card,
.omni-section-content .habit-card,
.omni-section-content .itinerary-event,
.omni-email-cards > * {
    margin-top: 4px !important;
    margin-bottom: 4px !important;
}
```

### 19.2 Overflow Prevention
- `.omni-section-content`: `padding: 2px 0; overflow: hidden; max-width: 100%;`
- `.omni-col-left, .omni-col-right`: `min-width: 0;` (prevents grid blowout)
- Habit cards: `max-width: 100%; box-sizing: border-box; width: 100%; margin-left: 0; margin-right: 0; overflow: hidden;`
- Itinerary events: `max-width: 100%; box-sizing: border-box;`

### 19.3 Contact Date Chips
- Contact-generated birthday/anniversary events get a special clip-path for visual distinction:
```css
.omni-section-content .itinerary-event.omni-contact-date {
    clip-path: polygon(
        0% 0%, 1em 50%, 0% 100%,
        100% 100%, calc(100% - 1em) 50%, 100% 0%
    );
    border: 1px solid #6b4e31 !important;
}
```
- This creates concave triangular indents on both ends of the card (like a ticket stub)

---

## 20. Intervals & Live Updates

### 20.1 HST Bar Fill Update
- **Interval:** Every 1 second
- **Action:** Recalculates `(hours * 3600 + minutes * 60 + seconds) / 86400 * 100%` and sets fill width
- **Also updates:** Time overlay text
- **Cleanup:** Cleared when leaving Omni View or re-entering (prevents stacking)

### 20.2 Time-Until Badge Update
- **Interval:** Every 60 seconds
- **Action:** Walks all `.omni-time-badge` elements in the Chrono section, recalculates time difference from `data-start-time`
- **Auto-removal:** If an event's start time has passed (diff < 0), the entire card is removed from the DOM
- **Cleanup:** Cleared when leaving Omni View

### 20.3 Interval Cleanup
- Both intervals (`_omniHSTInterval`, `_omniTimeUntilInterval`) are cleared at the start of `displayOmniView()` to prevent stacking on re-entry
- They are NOT cleared when switching tabs (the tab switch triggers a full re-render which calls `displayOmniView()` again if Omni is active)

---

## 21. Data Flow

### 21.1 Loading
1. User taps "Omni" in header → `currentTab = 'Omni'`
2. `displayChits()` called → routes to `displayOmniView(filteredChits)`
3. Filters applied (locked defaults or cleared)
4. Layout config loaded from settings (or defaults used)
5. Visible sections sorted by position, split into full-width and half-width
6. DOM built: `.omni-view` → full-width sections → `.omni-grid` with columns
7. `_populateOmniSections()` called → runs deduplication → routes to section renderers
8. Color mode applied (normalized/mono override card colors)
9. Empty sections hidden (if `hideWhenEmpty`)
10. Intervals started (HST fill, time-until badges)

### 21.2 Refresh Triggers
- Any chit modification (status change, pin/unpin, archive, complete) calls `fetchChits()` → full re-render
- Email pagination (Previous/Next) re-renders only the email section content
- HST mode cycling only toggles icon visibility (no re-render)

### 21.3 Exit
- Switching to any other tab via Views panel or tab click
- `_omniViewActive` set to `false`
- `_omniFiltersApplied` reset to `false`
- 🔒 indicator hidden
- Lock button hidden
- Intervals continue running until next `displayOmniView()` call clears them

---

## 22. What Is NOT in the Omni View

- **No tab highlight** — Omni View has no corresponding tab in the C CAPTN tab bar. No tab is highlighted when Omni is active.
- **No drag-to-reorder** — Cards cannot be reordered by dragging within the Omni View (unlike Tasks/Checklists views)
- **No sort dropdown** — The sidebar sort selector has no effect on Omni View. Each section has its own fixed sort order.
- **No view mode toggle** — No Tasks/Habits/Assigned sub-modes
- **No period selector** — No date navigation (week/month/year)
- **No "Create Chit" button** — No empty-state creation prompt (sections just hide when empty)
- **No full note editing** — Pinned Notes support inline text editing, but not full rich-text/markdown editing
- **No calendar grid** — Events are shown as cards, not in a time-slot grid
- **No Kanban board** — Projects are not shown in Omni View at all
- **No search results** — The Search tab is separate from Omni View

---

## 23. CSS File Reference

All Omni View styles live in: `src/frontend/css/dashboard/styles-omni.css`

This file contains:
- `.omni-view` container layout
- `.omni-grid` two-column grid (and mobile single-column override)
- `.omni-col` column containers
- `.omni-section`, `.omni-section-full`, `.omni-section-half` section wrappers
- `.omni-section-header` pill-shaped section headers
- `.omni-section-content` content containers
- `.omni-empty` empty state message
- `.omni-hst-bar` and all HST sub-elements
- `.omni-weather-bar` and all weather sub-elements
- `.omni-time-badge`, `.omni-streak-badge`, `.omni-due-badge` badge styles
- `.omni-email-cards`, `.omni-email-pagination`, `.omni-email-page-btn` email section
- `.omni-locked-indicator`, `.omni-lock-btn` filter lock UI
- `.omni-hst-weather-combo` combined section
- `.omni-hst-temp-strip` temperature strip
- All responsive `@media` overrides for ≤768px and ≤480px

---

## 24. JavaScript File Reference

All Omni View logic lives in: `src/frontend/js/dashboard/main-omni.js`

This file contains:
- `displayOmniView(filteredChits)` — main entry point
- `_omniDeduplicateChits(filteredChits)` — deduplication algorithm
- `_buildOmniSection(sectionConfig, widthClass)` — section DOM builder
- `_populateOmniSections(filteredChits, visibleSections)` — routes to renderers
- `_renderOmniHST(contentEl, chronoItems)` — HST bar renderer
- `_renderOmniWeather(contentEl)` — weather bar renderer
- `_renderOmniHSTWeatherCombo(contentEl, chronoItems)` — combined HST+Weather
- `_renderOmniHSTTempStrip(contentEl, chronoItems)` — HST with temp strip
- `_renderOmniChrono(contentEl, chronoItems, viSettings)` — Chrono section
- `_renderOmniReminders(contentEl, reminderChits, viSettings)` — Reminders section
- `_renderOmniOnDeck(contentEl, ondeckItems, viSettings)` — On Deck section
- `_renderOmniSoon(contentEl, soonItems, viSettings)` — Soon section
- `_renderOmniEmail(contentEl, allEmailChits)` — Email section with pagination
- `_renderOmniPinnedNotes(contentEl, pinnedNotes, viSettings)` — Pinned Notes
- `_renderOmniPinnedChecklists(contentEl, pinnedChecklists, viSettings)` — Pinned Checklists
- `_applyOmniNormalizedColors()` — normalized color mode
- `_applyOmniMonoColors()` — mono color mode
- `_applyOmniEntryFilters()` — filter lock application
- `_lockOmniFilters()` — save current filters as defaults
- `_showOmniLockBtn()` / `_hideOmniLockBtn()` — lock button visibility
- `_buildTimeUntilBadge()`, `_buildReminderTimeUntilBadge()`, `_buildDueDateBadge()` — badge builders
- `_calculateHabitStreak(chit)` — streak calculation
- `_getOmniEnabledBundles()` — email bundle filtering

Settings-related Omni code lives in: `src/frontend/js/pages/settings.js`
- `_openOmniLayoutModal()` / `_closeOmniLayoutModal()` — layout configurator
- `_renderOmniLayoutGrid()` — drag-and-drop layout UI
- `_loadOmniLayout(settings)` / `_collectOmniLayout()` — layout persistence
- `_loadOmniBundleToggles()` / `_saveOmniBundleToggles()` — bundle toggle UI
- `_renderOmniLockedFilters(settings)` — locked filters display
- `_clearOmniLockedFilters()` / `_resetOmniViewDefaults()` — reset actions
