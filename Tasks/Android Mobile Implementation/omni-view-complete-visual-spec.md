# Omni View — Complete Visual & Functional Specification

This document describes **exactly** how the Omni View appears and functions on the mobile browser (viewport ≤768px). This is the authoritative reference for reproducing it on another platform (e.g., Android native app).

---

## 1. Overall Layout

On mobile (≤768px), the Omni View is a **single-column vertical scroll**. There is no two-column grid — everything stacks vertically.

- **Container**: Full-width, no horizontal padding on the outer wrapper. Background is transparent (the page's parchment texture shows through).
- **Scrolling**: The entire view scrolls vertically as one continuous list. No individual section scrolling.
- **No visible scrollbars**: All scrollbars are hidden (`scrollbar-width: none`).
- **Section spacing**: Each section has `margin-bottom: 0` (sections are tight). The gap between sections comes from the section header's own padding/margin.

---

## 2. Section Order & Visibility

Sections render in a configurable order (stored in `omni_layout` setting). The default order is:

| Position | Section ID | Default Visible | hideWhenEmpty |
|----------|-----------|----------------|---------------|
| 0 | `hst` | ✅ Yes | Yes |
| 1 | `weather` | ✅ Yes | Yes |
| 2 | `hst_weather` | ❌ No | Yes |
| 3 | `hst_temp_strip` | ❌ No | Yes |
| 4 | `chrono` | ✅ Yes | Yes |
| 5 | `reminders` | ✅ Yes | Yes |
| 6 | `ondeck` | ✅ Yes | Yes |
| 7 | `soon` | ✅ Yes | Yes |
| 8 | `email` | ✅ Yes | Yes |
| 9 | `pinned_notes` | ✅ Yes | Yes |
| 10 | `pinned_checklists` | ✅ Yes | Yes |
| 11 | `pinned_all` | ❌ No | Yes |

**hideWhenEmpty behavior**: If a section has no items AND `hideWhenEmpty` is true, the entire section (header + content) is completely hidden — not shown at all. If `hideWhenEmpty` is false and the section is empty, it shows the header plus an italic message like "No [section name] right now."

---

## 3. Section Headers

Every section **except** HST, Weather, HST+Weather, and HST Weather Strip has a visible section header.

### Visual Appearance
- **Shape**: Rounded pill/capsule (`border-radius: 20px`)
- **Background**: Semi-transparent brown (`rgba(90, 54, 24, 0.5)`)
- **Border**: 2px solid `#8b4513` (saddle brown)
- **Text color**: `#1a1208` (near-black)
- **Font**: 'Lora', serif — bold
- **Font size**: `1.1em` on mobile (reduced from 1.5em on desktop)
- **Padding**: `3px 8px` on mobile, with `padding-top: 6px`
- **Layout**: Flexbox, centered horizontally, with `align-items: center`, `justify-content: center`, `gap: 6px`
- **Margin below**: `6px` (space between header and first card)

### Icons in Headers
Each section header displays an **emoji icon** to the left of the label text. The icon is wrapped in a `<span class="omni-section-icon">` with `font-style: normal` and `line-height: 1`.

| Section | Icon | Label Text |
|---------|------|-----------|
| Chrono Anchored | ⏰ | Chrono Anchored |
| Reminders | 📢 | Reminders |
| On Deck | 🔜 | On Deck |
| Soon | 🗓️ | Soon |
| Email | 📧 | Email |
| Pinned Notes | 📝 | Pinned Notes |
| Pinned Checklists | ☑️ | Pinned Checklists |
| Pinned All | 📌 | Pinned |

**Header HTML structure** (rendered):
```
[rounded pill background]
  [icon span] [label text]
```

Example rendered appearance:
```
    ╭─────────────────────────────╮
    │   ⏰ Chrono Anchored        │
    ╰─────────────────────────────╯
```

---

## 4. HST Bar (Horizontal Strip Timeline)

The HST bar is a **self-contained full-width element** with no section header above it.

### Visual Structure
- **Container**: Full width, `height: 2em` on mobile (2.4em on desktop)
- **Background**: `#f5e6cc` (light parchment)
- **Border**: `2px solid #8b4513`
- **Border radius**: `6px`
- **Box shadow**: `inset 0 2px 4px rgba(0, 0, 0, 0.15)`
- **Overflow**: hidden
- **Padding**: `0 10px` (from the full-width section wrapper)

### Fill Gradient
- A `div` positioned absolutely inside the bar
- Starts at `left: 2px`, `top: 2px`, `bottom: 2px`
- Width = percentage of day elapsed (e.g., at noon = 50%)
- Background: `linear-gradient(90deg, #d4af37 0%, #c8965a 60%, #8b4513 100%)` (gold → brown)
- Border radius: `4px`
- Animates width every 1 second (`transition: width 1s linear`)

### Time Display Overlay
- Positioned absolutely over the bar (full coverage)
- Flexbox, `align-items: center`, `justify-content: flex-start`
- Padding: `0 12px`
- Font: 'Lora', serif, `1.1em`, bold
- Color: `#4a2c2a`
- Text shadow: `0 0 4px #fff8e1, 0 0 8px #fff8e1, 0 0 2px #fff8e1` (glow for readability)
- Letter spacing: `1px`
- Displays one of three modes (configurable via `omni_hst_clock_mode` setting):
  - **"hst"**: Shows HST decimal time, e.g., `54.167 sd` (percentage of day × 100, to 3 decimal places, followed by " sd")
  - **"system"**: Shows system time in user's preferred format (12h or 24h)
  - **"both"** (default): Shows HST decimal time (same as "hst" mode display)

### Chit Icons on the Bar
- Each timed event today gets an icon positioned at its time percentage on the bar
- Position: `left: X%` where X = (hours×3600 + minutes×60) / 86400 × 100
- Icons: `☑️` for tasks (has status), `🗓️` for events
- Font size: `0.85em` on mobile
- Positioned at vertical center (`top: 50%, transform: translate(-50%, -50%)`)
- Text shadow: `0 0 3px #fff8e1, 0 0 6px #fff8e1`
- Cursor: pointer
- Hover: scale 1.3
- Click: opens quick-edit modal for that chit

### Crowding Detection
- If adjacent icons would be <20px apart (based on bar width), ALL chit markers switch to **vertical lines** instead of icons
- Lines: `width: 2px`, `background: #4a2c2a`, `opacity: 0.8`, full height of bar (top: 4px, bottom: 4px)
- Hover: `width: 3px`, `background: #1a1208`, `opacity: 1`

### Weather Icons on the Bar
- Hourly weather codes are fetched and placed at their hour positions
- Font size: `0.65em` on mobile
- Opacity: `0.85`, hover: `1.0` + scale 1.3
- Only shown for hours that haven't passed yet

### HST Mode Cycling
- Clicking the bar background (not an icon) cycles through modes: `chits → both → weather → none`
- **chits**: Only chit icons visible
- **both**: Both chit icons and weather icons visible
- **weather**: Only weather icons visible
- **none**: No icons visible (just the fill bar and time)

---

## 5. Weather Bar

The Weather bar is a **self-contained full-width element** with no section header.

### Visual Structure
- **Container**: Full width, flexbox row, `align-items: center`, `gap: 8px` on mobile
- **Padding**: `8px 12px` on mobile
- **Background**: `linear-gradient(135deg, #fff8e1, #f5e6cc)`
- **Border**: `2px solid #8b4513`
- **Border radius**: `6px`
- **Box shadow**: `inset 0 1px 3px rgba(0, 0, 0, 0.08)`
- **Font**: 'Lora', serif
- **Cursor**: pointer (entire bar is clickable → opens weather modal)
- **Hover**: background shifts to `linear-gradient(135deg, #fff3e0, #ede0cc)` + outer shadow

### Content Layout (left to right)
1. **Weather icon**: Emoji for current conditions (e.g., ☀️, 🌧️, ⛅), `font-size: 1.3em` on mobile, `flex-shrink: 0`
2. **Temperature bar**: A visual temperature range bar (the `weather-modal-temp-bar` component), `flex: 1`, `min-width: 80px`. Shows high/low with a colored gradient bar between them.
3. **Location name**: Right-aligned, `font-size: 0.8em` on mobile, color `#6b4e31`, `opacity: 0.85`, truncated with ellipsis, `max-width: 120px` on mobile

### States
- **Loading**: Shows "⏳ Loading weather…" in italic, `color: #6b4e31`, `opacity: 0.6`
- **No location**: Shows "No location configured" in italic
- **Unavailable**: Shows "Weather unavailable" in italic

---

## 6. Chrono Anchored Section

Shows **timed events happening today** that haven't ended yet. Uses the itinerary-event card format.

### Card Format (Itinerary Event Style)
Each card is a horizontal row:
- **Left indent**: `padding-left: 1.5em`
- **Time column**: Fixed width, shows start time (e.g., "2:30 PM"), `font-size: 0.85em`
- **Title**: Bold, clickable (navigates to editor)
- **Visual indicators**: Colored dots/icons based on chit properties (from viSettings)
- **Background color**: The chit's assigned color (or default parchment)
- **Max width**: 100%, `box-sizing: border-box`
- **Margin**: `4px 0`

### Time-Until Badge
- Appended to the right of each card
- **Style**: `display: inline-block`, `padding: 2px 8px`, `font-size: 0.75em`, bold
- **Color**: `#4a2c2a`
- **Background**: `#f5e6cc`
- **Border**: `1px solid #c4a97d`
- **Border radius**: `10px`
- **Content**: 
  - "now" (within 5 minutes)
  - "in Xm" (under 60 minutes)
  - "in Xh Ym" (over 60 minutes)
- Updates every 60 seconds
- When an event's end time passes, the card is removed

### Interactions
- **Tap/Click**: Navigate to editor for that chit
- **Double-click**: Navigate to editor
- **Shift+click**: Quick-edit modal (desktop)

---

## 7. Reminders Section

Shows chits with `notification=true` that are either due today or pinned.

### Card Format
Each reminder is a horizontal row:
- **Icon** (left): 📌 emoji, `font-size: 1em`, `margin-right: 6px`
- **Time column**: `width: 90px`, shows:
  - Time (e.g., "2:30 PM") if reminder is for today
  - Short date (e.g., "May 18") if pinned but not today
  - "—" if no time set
- **Title**: Bold, `font-size: 1.05em`, truncated with ellipsis
- **Time-until badge**: Same style as Chrono but supports negative values:
  - "now" (within 5 min future)
  - "in Xm" / "in Xh Ym" (future)
  - "-Xm" / "-Xh Ym" (past, with red border: `1px solid #b22222`, `border-radius: 3px`)
- **Complete button** (right): Check-circle icon (`fa-check-circle`), `opacity: 0.5`, `font-size: 1.1em`
  - Click: Fades card out (opacity 0.3, translateX 20px), shows undo toast for 5 seconds
  - On expire: Marks chit as Complete + archived via PATCH
  - On undo: Restores card appearance

### Background Color
- Uses the chit's color (via `applyChitColors`), defaults to `#fdf6e3` if none set

### Sorting
- Today's reminders first (sorted by time ascending)
- Then pinned non-today reminders (sorted by title)

---

## 8. On Deck Section

Shows items due **today**: all-day events, untimed tasks due today, and habits due today.

### Card Types

**Events/Tasks**: Rendered using `_buildItineraryEvent()` — same horizontal row format as Chrono Anchored but without time-until badges.

**Habits**: Rendered using `_buildItineraryHabitCard()` — shows:
- Habit title
- Progress indicator (success/goal)
- **Streak badge** (if streak > 0):
  - Style: `display: inline-block`, `padding: 2px 8px`, `font-size: 0.75em`, bold
  - Color: `#8b4513`
  - Background: `linear-gradient(135deg, #fff3e0, #ffe0b2)`
  - Border: `1px solid #d4a574`
  - Border radius: `10px`
  - Content: "🔥 X" (where X is the streak count)

### Card Spacing
- All cards: `margin: 4px 0`

---

## 9. Soon Section

Shows items due **this week** (but not today). Same card format as On Deck, plus:

### Due-Date Badge
- Appended to each card
- **Style**: `display: inline-block`, `padding: 2px 8px`, `font-size: 0.75em`, bold
- **Color**: `#2e5a3a` (dark green)
- **Background**: `linear-gradient(135deg, #e8f5e9, #c8e6c9)` (light green)
- **Border**: `1px solid #81c784`
- **Border radius**: `10px`
- **Content**:
  - "today" (if somehow due today)
  - "1 day" (due tomorrow)
  - "X days" (due in X days)

---

## 10. Email Section

Shows unread emails from Omni-enabled bundles, paginated.

### Card Format
Each email card shows:
- **Row 1**: Sender name (bold, left) + time (right, smaller, dimmer)
- **Row 2**: Subject line (smaller, dimmer, truncated)
- **Background**: Chit's color
- **Border**: Standard chit card border
- **Padding**: `12px`
- **Full width**

### Pagination
- Page size from settings (`omni_email_count`, default 3)
- Navigation buttons below cards:
  - "← Previous 3" (if not on first page)
  - "Next 3 →" (if more emails exist)
  - Buttons: `padding: 8px 14px` on mobile, `font-size: 0.9em`, 'Lora' serif, bold
  - Color: `#4a2c2a`
  - Background: `linear-gradient(135deg, #fff8e1, #f5e6cc)`
  - Border: `1.5px solid #8b4513`, `border-radius: 6px`
  - Hover: lighter background + shadow
- Count indicator below buttons: "Showing X-Y of Z", `font-size: 0.75em`, `color: #6b4e31`, `opacity: 0.7`

### Visibility
- Only shown when email is configured (has Omni-enabled bundles)
- Hidden entirely if no unread emails from Omni bundles

---

## 11. Pinned Notes Section

Shows pinned chits that have note content but no checklist.

### Card Format
Standard chit card with:
- **Header**: Title (linked to editor), visual indicators, pin icon (📌 bookmark)
- **Note preview**: Rendered markdown content (truncated)
- **Background**: Chit's color
- **Interactions**: 
  - Double-click → editor
  - Shift+click → quick-edit modal
  - Right-click → context menu
  - Click pin icon → unpin (sends PUT to remove pinned flag)

---

## 12. Pinned Checklists Section

Shows pinned chits that have checklist items.

### Card Format
Standard chit card with:
- **Header**: Title (linked to editor), checklist count badge, visual indicators, pin icon
- **Inline checklist**: Interactive checkboxes that can be toggled directly
  - Each item: checkbox + text (with markdown rendering)
  - Checking/unchecking sends update to server
  - When all items checked: title gets strikethrough (`checklist-all-done` class)
- **Background**: Chit's color
- **Interactions**: Same as Pinned Notes

---

## 13. Pinned All Section

Combined view of Pinned Checklists + Pinned Notes in one section. Checklists render first, then notes below them.

---

## 14. Contact Date Chips

Birthday/anniversary items from contacts appear in the Chrono/On Deck sections with a special visual treatment:

- **Clip path**: Concave triangular indents on both ends:
  ```
  clip-path: polygon(0% 0%, 1em 50%, 0% 100%, 100% 100%, calc(100% - 1em) 50%, 100% 0%)
  ```
- **Border**: `1px solid #6b4e31`
- Creates a "ticket stub" or "bow-tie" shape

---

## 15. Color Modes

The Omni View supports three color modes (setting: `omni_normalize_colors`):

### Colored (default)
Each card uses its chit's assigned color. This is the standard behavior.

### Normalized
All cards get a fixed earthy tone based on their **type**:
| Type | Color | Hex |
|------|-------|-----|
| Event (calendar) | Medium green | `#7ab87a` |
| Task (has status) | Soft purple | `#c4a0d4` |
| Note | Terracotta | `#d4956b` |
| Checklist | Medium sky blue | `#9cc4d8` |
| Birthday | Medium orchid | `#d8a8d8` |
| Email | Dark mocha | `#a89070` |
| Habit | Light yellow | `#f0e87a` |
| Reminder | Dusty rose-red | `#c47a76` |

### Mono
All cards get a clean ivory/cream background (`#fffaf0`) with dark text (`#1a1208`).

---

## 16. Empty Section States

When a section has no items:
- If `hideWhenEmpty: true` → section is completely hidden (no header, no content)
- If `hideWhenEmpty: false` → shows header + italic message:
  - Font style: italic
  - Color: `#8b5a2b`
  - Font size: `0.9em`
  - Padding: `8px 12px`
  - Opacity: `0.7`
  - Text: "No [section name in lowercase] right now."

---

## 17. Universal Card Spacing

All cards within any section have exactly `4px` top and bottom margin. This applies to:
- `.chit-card`
- `.habit-card`
- `.itinerary-event`
- Email cards

---

## 18. Layout Configuration

Accessible via a gear/settings icon. Opens a modal/bottom sheet where users can:
- **Reorder sections** (drag or move up/down)
- **Toggle visibility** (show/hide each section)
- **Toggle hideWhenEmpty** per section
- **Set width**: full-width or half-width (on desktop; on mobile everything is full-width)
- **Set column**: left or right (on desktop; irrelevant on mobile)

Changes persist to the `omni_layout` setting on the server.

---

## 19. Locked Filters

The Omni View can "lock" the current sidebar filter state so it's automatically applied every time the user enters the Omni tab.

- **Lock button**: Appears in the sidebar when Omni View is active
- **Indicator**: 🔒 icon shown in the Omni View when filters are locked
- **Behavior**: On entering Omni View, if locked filters exist, they're applied to the sidebar automatically

---

## 20. Key Differences: Mobile Browser vs Desktop

| Aspect | Desktop (>768px) | Mobile (≤768px) |
|--------|-----------------|-----------------|
| Layout | Two-column grid (left/right) | Single column |
| Section headers | `font-size: 1.5em` | `font-size: 1.1em` |
| HST bar height | `2.4em` | `2em` |
| HST chit icons | `1em` | `0.85em` |
| HST weather icons | `1em` | `0.65em` |
| Weather bar padding | `10px 16px` | `8px 12px` |
| Weather bar gap | `12px` | `8px` |
| Weather icon size | `1.6em` | `1.3em` |
| Weather location max-width | `200px` | `120px` |
| Column scrolling | Each column scrolls independently | Whole page scrolls |
| Email pagination buttons | `6px 16px` | `8px 14px` |

---

## 21. Interactions Summary

| Element | Tap | Long-press | Double-tap |
|---------|-----|-----------|------------|
| HST bar background | Cycle mode | — | — |
| HST chit icon | Quick-edit modal | — | — |
| Weather bar | Open weather modal | Open weather modal | — |
| Chrono card | Navigate to editor | — | Navigate to editor |
| Reminder card | Navigate to editor | — | Navigate to editor |
| Reminder complete btn | Mark complete (with undo) | — | — |
| On Deck card | Navigate to editor | — | Navigate to editor |
| Soon card | Navigate to editor | — | Navigate to editor |
| Email card | Navigate to editor | — | — |
| Pinned Note card | Navigate to editor | — | Navigate to editor |
| Pinned Checklist card | Navigate to editor | — | Navigate to editor |
| Checklist checkbox | Toggle check state | — | — |
| Pin icon (📌) | Unpin chit | — | — |
| Email pagination btn | Change page | — | — |
| Layout gear icon | Open layout config | — | — |

---

## 22. Font & Typography

- **All text**: 'Lora', serif (self-hosted variable font)
- **Section headers**: Bold, centered
- **Card titles**: Bold, `font-size: 1.05em` (reminders), standard body size (others)
- **Time labels**: `0.85em`
- **Badges**: `0.75em`, bold
- **Empty states**: `0.9em`, italic

---

## 23. Color Palette Reference

| Element | Color |
|---------|-------|
| Section header background | `rgba(90, 54, 24, 0.5)` |
| Section header border | `#8b4513` |
| Section header text | `#1a1208` |
| HST bar background | `#f5e6cc` |
| HST bar border | `#8b4513` |
| HST fill gradient start | `#d4af37` (gold) |
| HST fill gradient mid | `#c8965a` |
| HST fill gradient end | `#8b4513` |
| HST time text | `#4a2c2a` |
| Weather bar background | `#fff8e1` → `#f5e6cc` |
| Weather bar border | `#8b4513` |
| Weather temps | `#4a2c2a` (bold) |
| Weather location | `#6b4e31` |
| Time-until badge bg | `#f5e6cc` |
| Time-until badge border | `#c4a97d` |
| Time-until badge text | `#4a2c2a` |
| Due-date badge bg | `#e8f5e9` → `#c8e6c9` |
| Due-date badge border | `#81c784` |
| Due-date badge text | `#2e5a3a` |
| Streak badge bg | `#fff3e0` → `#ffe0b2` |
| Streak badge border | `#d4a574` |
| Streak badge text | `#8b4513` |
| Empty state text | `#8b5a2b` |
| Email pagination btn text | `#4a2c2a` |
| Email pagination btn bg | `#fff8e1` → `#f5e6cc` |
| Email pagination btn border | `#8b4513` |

---

## 24. HST + Weather Combo Mode

When `hst_weather` section is enabled (instead of separate HST and Weather):
- Both render side-by-side in a 2-column grid on desktop
- On mobile (≤768px): stacks vertically (single column, `gap: 4px`)
- HST bar on top, Weather bar below

---

## 25. HST Weather Strip Mode

When `hst_temp_strip` section is enabled:
- The HST bar renders with extra height (`calc(2.4em + 16px)`)
- A temperature color strip appears at the bottom of the HST bar (inside it)
- The strip is `16px` tall, positioned at `bottom: 2px`, `left: 2px`, `right: 2px`
- Shows hourly temperature as a color gradient
- The main HST fill and icons are pushed up above the strip

---

## 26. Data Sources & Filtering

### Chrono Anchored
- Chits with `start_datetime` today, NOT all-day, whose end time hasn't passed
- Sorted by start time ascending
- Past non-task events are excluded

### Reminders
- Chits with `notification=true`, not Complete, not archived
- Either `point_in_time` is today OR `pinned=true`

### On Deck
- All-day events spanning today
- Tasks due today (no specific time)
- Habits due today (days left in cycle ≤ 1)

### Soon
- Tasks due within 7 days (but not today)
- Habits with days left > 1 but within the cycle

### Email
- Chits with `email_message_id`, `email_read=false`
- Must belong to an Omni-enabled bundle (or catch-all bundle)
- Sorted by `email_date` descending

### Pinned Notes
- `pinned=true`, has note content, no checklist items
- Not already placed in another section

### Pinned Checklists
- `pinned=true`, has checklist items
- Not already placed in another section

### Deduplication Rule
**Each chit appears in exactly ONE section.** Priority order:
1. Reminders (notification + today/pinned)
2. Email (has email_message_id)
3. Chrono Anchored (timed today)
4. On Deck (all-day today / untimed due today / habit due today)
5. Soon (due this week)
6. Pinned Notes / Pinned Checklists (remaining pinned items)
