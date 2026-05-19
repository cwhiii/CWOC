# Omni View Parity — Task List

Reference spec: `Tasks/Android Mobile Implementation/omni-view-complete-visual-spec.md`

---

## Task 1: Restyle Section Headers to Match Web (Pill Capsules with Icons)

**File:** `OmniViewScreen.kt`

**Current state:** `OmniSectionHeader` is a plain `Text` composable with `MaterialTheme.colorScheme.primary` color and no icon.

**Target state:** Each section header is a rounded pill capsule with:
- Background: `rgba(90, 54, 24, 0.5)` (semi-transparent brown)
- Border: 2px solid `#8b4513`
- Border radius: 20dp (pill shape)
- Padding: 3dp vertical, 8dp horizontal, 6dp top
- Text: 'Lora' serif, bold, 1.1em equivalent, color `#1a1208`, centered
- Emoji icon to the left of the label with 6dp gap

**Icon mapping to implement:**
| Section | Icon | Label |
|---------|------|-------|
| CHRONO_ANCHORED | ⏰ | Chrono Anchored |
| REMINDERS | 📢 | Reminders |
| ON_DECK | 🔜 | On Deck |
| SOON | 🗓️ | Soon |
| EMAIL | 📧 | Email |
| PINNED_NOTES | 📝 | Pinned Notes |
| PINNED_CHECKLISTS | ☑️ | Pinned Checklists |
| PINNED_ALL | 📌 | Pinned |

**Implementation:**
1. Create a `sectionIcon()` companion function in the ViewModel (or inline map) that returns the emoji for each `OmniSectionType`
2. Rewrite `OmniSectionHeader` composable to use a `Row` inside a `Box` with:
   - `background` = `Color(0x805A3618)` (brown at 50% alpha)
   - `border` = `BorderStroke(2.dp, Color(0xFF8B4513))`
   - `shape` = `RoundedCornerShape(20.dp)`
   - Centered content: icon `Text` + 6.dp `Spacer` + label `Text`
3. Pass the section type (or icon string) to the header composable

---

## Task 2: Rebuild HST Bar to Match Web (Gradient Fill Timeline)

**File:** `OmniViewScreen.kt`

**Current state:** A `Card` with a thin 6dp progress line and a `LazyRow` of event cards below it. Looks nothing like the web.

**Target state:** A full-width horizontal bar that acts as a 24-hour timeline:
- Height: ~40dp (2em equivalent on mobile)
- Background: `#f5e6cc`
- Border: 2dp solid `#8b4513`, corner radius 6dp
- Inner shadow: `inset 0 2px 4px rgba(0,0,0,0.15)`
- **Fill gradient**: Positioned absolutely from left, width = % of day elapsed. Gradient: `#d4af37` → `#c8965a` → `#8b4513`. Corner radius 4dp. Inset 2dp from edges.
- **Time overlay**: Centered vertically, left-aligned with 12dp padding. 'Lora' bold, `#4a2c2a`, with white glow shadow. Shows HST decimal time (e.g., "54.167 sd") or system time based on `omni_hst_clock_mode` setting.
- **Chit icons**: Emoji icons (☑️ for tasks, 🗓️ for events) positioned at their time percentage along the bar. If crowded (<20dp apart), collapse to vertical lines.
- **Weather icons**: Small weather emojis at hour positions for remaining hours today.
- **Mode cycling**: Tap bar background to cycle: chits → both → weather → none.
- Updates fill width every second.

**Implementation:**
1. Replace `OmniHstSection` with a new `OmniHstBar` composable using `Canvas` or layered `Box` elements
2. Outer `Box`: fixed height 40.dp, full width, background `#f5e6cc`, border, clip to rounded shape
3. Inner fill `Box`: width = `fillMaxWidth(fraction = dayElapsedFraction)`, gradient brush, inset 2.dp
4. Time text overlay: `Text` positioned with `Alignment.CenterStart`, padding start 12.dp
5. Chit markers: Use `Layout` or absolute positioning (`Box` with `offset`) to place icons at calculated X positions
6. Add a `remember` + `LaunchedEffect` that updates `dayElapsedFraction` every second
7. Add click handler to cycle `hstMode` state
8. Add `hstMode` to ViewModel (persisted or session-only)

---

## Task 3: Rebuild Weather Bar to Match Web

**File:** `OmniViewScreen.kt`

**Current state:** A `Card` with headline text, conditions, H/L labels, location, and a row of hourly forecasts. Too much information, wrong layout.

**Target state:** A single horizontal bar (not a card with sections):
- Full width, flexbox row, vertically centered
- Background: linear gradient `#fff8e1` → `#f5e6cc`
- Border: 2dp solid `#8b4513`, corner radius 6dp
- Padding: 8dp vertical, 12dp horizontal
- Gap between elements: 8dp
- Content (left to right):
  1. Weather emoji icon (e.g., ☀️), ~20sp
  2. Temperature bar (visual gradient showing high/low range), flex weight 1
  3. Location name, right-aligned, 12sp, color `#6b4e31`, truncated, max 120dp
- Entire bar is clickable → navigate to Weather screen
- States: "⏳ Loading weather…", "No location configured", "Weather unavailable"

**Implementation:**
1. Replace `OmniWeatherSection` with `OmniWeatherBar` composable
2. Single `Row` with modifier chain: fillMaxWidth, background gradient brush, border, clip, clickable, padding
3. Weather icon `Text` (emoji), temperature bar composable (custom drawn or simplified), location `Text` with `Modifier.weight(1f)` and `textAlign = End`
4. For the temperature bar: a horizontal `Box` with gradient from blue (low) to red (high) with current temp marker — or simplify to "High° / Low°" text with a thin colored bar between them
5. Handle loading/empty states with italic placeholder text

---

## Task 4: Restyle Chit Cards to Itinerary-Event Format

**File:** `OmniViewScreen.kt`

**Current state:** `OmniChitCard` is a vertical `Card` with title, status badge, date, and pin indicator stacked in a `Column`.

**Target state:** Horizontal row format matching the web's itinerary-event style:
- Horizontal `Row`, vertically centered
- Left padding: ~24dp (1.5em indent)
- Time column: fixed width ~90dp, shows start time or due time, smaller text (0.85em)
- Title: bold, flex weight 1, single line with ellipsis
- Badges (time-until, due-date, streak) appended to the right
- Background: chit's color
- Margin: 4dp vertical between cards
- Tap → navigate to editor

**Implementation:**
1. Rewrite `OmniChitCard` as a `Row`:
   - Time text (fixed width)
   - Title text (weight 1)
   - Optional badge composable(s)
2. Apply chit background color to the row container
3. Keep click handler for navigation

---

## Task 5: Add Time-Until Badges to Chrono Anchored Cards

**File:** `OmniViewScreen.kt` + `OmniViewViewModel.kt`

**Current state:** No time-until badges exist.

**Target state:** Each Chrono Anchored card shows a badge on the right:
- Pill shape: `border-radius: 10dp`, `padding: 2dp 8dp`
- Background: `#f5e6cc`
- Border: 1dp solid `#c4a97d`
- Text: bold, 0.75em, color `#4a2c2a`
- Content: "now" (≤5min), "in Xm" (<60min), "in Xh Ym" (≥60min)
- Updates periodically (every 60 seconds)

**Implementation:**
1. Add a `TimeUntilBadge` composable that takes a start time and computes the label
2. Use `LaunchedEffect` with a 60-second delay loop to trigger recomposition
3. Add badge to the right side of each Chrono card
4. Filter out cards whose end time has passed (same as web: remove past events)

---

## Task 6: Add Due-Date Badges to Soon Section Cards

**File:** `OmniViewScreen.kt`

**Current state:** No due-date badges.

**Target state:** Each Soon card shows a green badge:
- Pill shape: `border-radius: 10dp`, `padding: 2dp 8dp`
- Background: gradient `#e8f5e9` → `#c8e6c9`
- Border: 1dp solid `#81c784`
- Text: bold, 0.75em, color `#2e5a3a`
- Content: "1 day", "2 days", "X days"

**Implementation:**
1. Add a `DueDateBadge` composable
2. Calculate days until due from the chit's `dueDatetime`
3. Append to each Soon section card

---

## Task 7: Add Streak Badges to Habit Cards in On Deck

**File:** `OmniViewScreen.kt` + `OmniViewViewModel.kt`

**Current state:** No streak badges on habit cards.

**Target state:** Habit cards in On Deck show a streak badge (if streak > 0):
- Pill shape: `border-radius: 10dp`, `padding: 2dp 8dp`
- Background: gradient `#fff3e0` → `#ffe0b2`
- Border: 1dp solid `#d4a574`
- Text: bold, 0.75em, color `#8b4513`
- Content: "🔥 X" (X = consecutive successful periods)

**Implementation:**
1. Add streak calculation to ViewModel (count consecutive periods where success ≥ goal, working backwards from most recent)
2. Add a `StreakBadge` composable
3. Show on habit cards when streak > 0

---

## Task 8: Implement Reminders Section with Proper Card Format

**File:** `OmniViewScreen.kt`

**Current state:** Reminders use the generic `OmniChitCard` format.

**Target state:** Each reminder card is a horizontal row:
- 📌 icon (left, 16sp)
- Time column (90dp): time if today, short date if pinned non-today, "—" if none
- Title (bold, flex 1, ellipsis)
- Time-until badge (supports negative: "-Xm", "-Xh Ym" with red border for past)
- Complete button (right): check-circle icon, semi-transparent
  - Tap: fade card + show undo toast (5s), then mark Complete + archived
  - Undo: restore card

**Implementation:**
1. Create `OmniReminderCard` composable with the horizontal layout
2. Add negative time-until badge support (red border `#b22222` for past reminders)
3. Add complete button with undo-toast pattern (use Snackbar with undo action)
4. Sort: today's reminders first (by time), then pinned non-today (by title)

---

## Task 9: Remove HST and Weather Section Headers

**File:** `OmniViewScreen.kt`

**Current state:** HST and Weather sections may render headers.

**Target state:** The HST bar, Weather bar, HST+Weather combo, and HST Weather Strip sections are self-contained — they render NO section header above them. Only the content sections (Chrono, Reminders, On Deck, Soon, Email, Pinned Notes, Pinned Checklists, Pinned All) get headers.

**Implementation:**
1. In the `LazyColumn` rendering loop, skip header rendering for `HST`, `WEATHER`, `HST_WEATHER`, `HST_TEMP_STRIP` section types
2. Verify these sections render their content directly without a pill header

---

## Task 10: Implement hideWhenEmpty Properly

**File:** `OmniViewScreen.kt`

**Current state:** The `hideWhenEmpty` check exists but may not match web behavior exactly.

**Target state:**
- If `hideWhenEmpty = true` AND section is empty → completely hidden (no header, no content, no space)
- If `hideWhenEmpty = false` AND section is empty → show header + italic message "No [section name] right now."
  - Italic, color `#8b5a2b`, 14sp, padding 8dp horizontal, opacity 0.7

**Implementation:**
1. Review existing `isSectionEmpty` logic — ensure it matches web deduplication
2. When `hideWhenEmpty = false` and empty, render header + styled empty message
3. When `hideWhenEmpty = true` and empty, emit nothing (current `return@forEach` behavior)

---

## Task 11: Apply Parchment Theme Colors Throughout

**File:** `OmniViewScreen.kt`

**Current state:** Uses Material3 theme colors (`MaterialTheme.colorScheme.*`) which don't match the parchment aesthetic.

**Target state:** All Omni View elements use the CWOC parchment color palette:
- Replace `MaterialTheme.colorScheme.primary` with `Color(0xFF8B4513)` (saddle brown)
- Replace `MaterialTheme.colorScheme.onSurface` with `Color(0xFF1A1208)` (near-black)
- Replace `MaterialTheme.colorScheme.onSurfaceVariant` with `Color(0xFF6B4E31)` (medium brown)
- Replace `MaterialTheme.colorScheme.surface` with `Color(0xFFF5E6CC)` (parchment)
- Replace `MaterialTheme.colorScheme.surfaceVariant` with transparent or `Color(0xFFFFF8E1)` (light cream)
- Card backgrounds should be transparent (let page parchment show through) unless they have a chit color

**Implementation:**
1. Define Omni-specific color constants (or use existing theme if already defined)
2. Replace all `MaterialTheme.colorScheme.*` references in Omni composables with explicit parchment colors
3. Ensure text contrast meets readability requirements (dark on light)

---

## Task 12: Implement Color Modes (Colored / Normalized / Mono)

**File:** `OmniViewScreen.kt` + `OmniViewViewModel.kt`

**Current state:** Cards use chit colors but no normalized or mono mode.

**Target state:** Support three modes based on `omni_normalize_colors` setting:
- **colored** (default): Use each chit's assigned color
- **normalized**: Override with fixed earthy tones by type:
  - Event: `#7ab87a`, Task: `#c4a0d4`, Note: `#d4956b`, Checklist: `#9cc4d8`
  - Birthday: `#d8a8d8`, Email: `#a89070`, Habit: `#f0e87a`, Reminder: `#c47a76`
- **mono**: All cards `#fffaf0` (ivory) with `#1a1208` text

**Implementation:**
1. Read `omni_normalize_colors` from settings in ViewModel
2. Expose as StateFlow
3. In card composables, resolve background color based on mode:
   - colored → `CwocChitCardStyle.resolveChitBgColor(chit.color)`
   - normalized → lookup by chit type
   - mono → fixed ivory

---

## Task 13: Fix Email Section Card Format

**File:** `OmniViewScreen.kt`

**Current state:** `OmniEmailCard` exists but verify it matches web exactly.

**Target state:**
- Row 1: Sender (bold, left, weight 1, ellipsis) + Time (right, smaller, 70% opacity)
- Row 2: Subject (smaller, 70% opacity, single line, ellipsis)
- Background: chit color
- Full width, 12dp padding
- Pagination: "← Previous 3" / "Next 3 →" buttons styled as:
  - 'Lora' font, bold, 14sp
  - Color `#4a2c2a`, background gradient `#fff8e1` → `#f5e6cc`
  - Border: 1.5dp solid `#8b4513`, corner radius 6dp
  - Centered row below cards

**Implementation:**
1. Verify `OmniEmailCard` layout matches (likely already close)
2. Restyle pagination buttons to match web (replace `TextButton` with styled `Button` or `OutlinedButton` with custom colors)
3. Add count indicator below: "Showing X-Y of Z"

---

## Task 14: Implement Contact Date Chip Styling

**File:** `OmniViewScreen.kt`

**Current state:** Birthday/anniversary items render as regular cards.

**Target state:** Contact-generated date items (birthdays, anniversaries) get a special "ticket stub" shape with concave triangular indents on both ends.

**Implementation:**
1. Detect contact-date chits (have `_isBirthday` flag or generated from contact dates)
2. Apply a custom `Shape` using `GenericShape` that creates the polygon clip path:
   - Left side: point at 0%,0% → indent at 1em,50% → point at 0%,100%
   - Right side: point at 100%,100% → indent at calc(100%-1em),50% → point at 100%,0%
3. Border: 1dp solid `#6b4e31`

---

## Task 15: Add HST Mode Persistence and Clock Mode Setting

**File:** `OmniViewViewModel.kt`

**Current state:** HST mode cycling may not be implemented or persisted.

**Target state:**
- HST display mode (`chits`, `both`, `weather`, `none`) cycles on tap and persists for the session
- Clock mode (`hst`, `system`, `both`) reads from `omni_hst_clock_mode` setting
- HST time display:
  - "hst": Show decimal day fraction × 100, 3 decimal places + " sd" (e.g., "54.167 sd")
  - "system": Show current time in user's preferred format
  - "both": Show HST decimal time (same as "hst")

**Implementation:**
1. Add `hstDisplayMode` StateFlow to ViewModel (session-scoped, not persisted to server)
2. Read `omni_hst_clock_mode` from settings
3. Expose both to the HST bar composable
4. Implement time formatting logic

---

## Task 16: Universal 4dp Card Spacing

**File:** `OmniViewScreen.kt`

**Current state:** Cards may have inconsistent spacing.

**Target state:** ALL cards in ALL sections have exactly 4dp top margin and 4dp bottom margin. This applies uniformly to:
- Chit cards (Chrono, On Deck, Soon)
- Habit cards
- Reminder cards
- Email cards
- Pinned note/checklist cards

**Implementation:**
1. Add `Modifier.padding(vertical = 4.dp)` to every card composable
2. Remove any `Arrangement.spacedBy()` that conflicts with this
3. Verify visual consistency across all sections
