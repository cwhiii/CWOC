# Visual Brokenness: Android App vs Mobile Web

Exhaustive comparison of viewing behavior differences between the native Android app and the mobile web version (accessed via Chrome on a phone at the same viewport width). This documents where the Android app's visual presentation diverges from what the mobile web delivers.

---

## 1. Global Chrome & Layout

### 1.1 Header / Top Bar

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Header height | Compact fixed row (~50px): logo 32px + hamburger + title + views btn + profile | Material3 TopAppBar (~56dp): hamburger + "Omni Chits" text + sync icon + profile | Android has no logo in the header; web shows the CWOC logo inline |
| Title text | "Omni" (clickable, opens Omni View) | "Omni Chits" (static text, not clickable) | Web title is an interactive Omni View trigger; Android title is decorative |
| Views button | Brown pill button labeled "Views" in header row, opens right-slide panel | No visible button — right-edge swipe only (invisible 25dp touch zone) | Web has a visible affordance; Android relies on hidden gesture discovery |
| Top bar (date range) | Hidden at 480px (moved into sidebar) | Never exists — date nav is always in sidebar | Equivalent behavior ✅ |
| Background | Parchment texture (`parchment.jpg`) covers full viewport via `background-size: cover` | Parchment texture at 30% alpha over solid `#FDF5E6` | Android parchment is much more subtle/washed out; web is rich and textured |
| Header background | `--header-bg: #e0d4b5` solid | `CwocHeaderBg = Color(0xFFE0D4B5)` | Same color ✅ |

### 1.2 Tab Row

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Visibility | Tabs are `display: none` — replaced by Views panel | `ScrollableTabRow` always visible below TopAppBar | **Major difference**: Web hides tabs on mobile and uses a panel; Android always shows a scrollable tab row |
| Tab style | Brown background buttons with ivory text, active = ivory bg + dark text | Material3 tabs with icon + label, brown underline indicator, no background fill | Completely different visual language — web uses filled buttons, Android uses underlined text tabs |
| Tab icons | Small images (1.6em) inside brown buttons | Material icons (18dp) above label text | Different icon style and layout (web: icon left of text; Android: icon above text) |
| Active state | `background-color: ivory; color: #3b1f0a` (filled) | Brown underline + brown tint on icon/text (no fill) | Web active tab is a filled button; Android is just an underline |
| Tab count badges | Shown as "(N)" next to label in the button | Shown as "(N)" next to label | Same behavior ✅ |
| Email unread badge | Red circle with count overlaid on tab | Same pattern | ✅ |
| Swipe between tabs | Not supported (uses Views panel) | Swipe on top bar area switches tabs | Android adds swipe navigation not present on mobile web |

### 1.3 Sidebar / Drawer

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Trigger | Hamburger button (brown, 32px) in header | Hamburger icon in TopAppBar | Similar ✅ |
| Width | 100% viewport width (full overlay) | ~80% width (Material3 ModalNavigationDrawer default) | Web sidebar covers entire screen; Android leaves a sliver visible |
| Background | `parchment.jpg` texture with `--sidebar-bg` | Solid `#FFFAF0` (Surface color) | Web has textured background; Android is flat solid color |
| Close button | Sticky brown button at top: "⇤ Hide Sidebar" | Brown button: "⇤ Hide Sidebar" | Same ✅ |
| Backdrop | `rgba(0, 0, 0, 0.4)` overlay | Material3 scrim (similar darkness) | Similar ✅ |
| Section dividers | Not visible (sections flow together) | `HorizontalDivider` between each section | Android has more visual separation between sidebar sections |
| Navigation links | Styled as brown buttons with icons | Styled as brown buttons with text | Similar pattern ✅ |
| Bottom pinned section | Settings + Help links pinned to bottom | Settings + Help at bottom of scroll | Web pins them; Android they scroll with content |

### 1.4 Views Panel (Right-Slide)

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Trigger | "Views" button in header (always visible) | Right-edge swipe only (no visible button) | **Discoverability issue**: Android has no visible trigger |
| Width | ~260px panel from right | 260dp panel from right | Same ✅ |
| Background | Parchment-styled | `#FFFAF0` solid | Web is textured; Android is flat |
| Items | Tab icons + labels, active highlighted | Material icons + labels, active highlighted with brown tint | Similar ✅ |

---

## 2. Chit Cards

### 2.1 Card Container

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Border | `2px solid #8b5a2b`, `border-radius: 6px` | `BorderStroke(2.dp, #8B5A2B)`, `RoundedCornerShape(12.dp)` | Android has double the border radius (12dp vs 6px) — cards are more rounded |
| Padding | `10px` (mobile override) | `12.dp` internal Column padding | Slightly more padding on Android |
| Width | `100% !important` (full width, stacked) | `fillMaxWidth()` in LazyColumn | Same full-width behavior ✅ |
| Background (no color) | Transparent — page parchment shows through | `#FDF5E6` (CwocBackground) solid | Web cards are transparent over texture; Android cards have a solid parchment fill |
| Background (with color) | Chit color as full card background | Chit color as full card background | Same ✅ |
| Elevation/shadow | None by default; `box-shadow` on hover only | `0.dp` elevation (no shadow) | Same ✅ |
| Hover state | `border-color: #a0522d; box-shadow: 0 2px 8px` | No hover state (touch device) | N/A — appropriate platform difference |
| Font | `'Lora', Georgia, serif` | Lora font family (from res/font/) | Same ✅ |
| Text color | `#2b1e0f` | `Color(0xFF2B1E0F)` | Same ✅ |

### 2.2 Card Header Row

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Layout | `flex-direction: column` (title on top, meta below) | `Row` with title + indicators | **Different**: Web stacks vertically on mobile; Android keeps horizontal row |
| Title wrapping | `white-space: normal; word-break: break-word` (wraps freely) | `maxLines = 2, overflow = Ellipsis` | Web shows full title; Android truncates at 2 lines |
| Meta info | Full meta row below title (date, priority, people, tags) | Varies by view — some show meta, some don't | Inconsistent meta display across Android views |
| Indicator icons | Font Awesome icons (📌🗄️💤👁️🔔🔁📎) inline before title | Emoji strings built by `buildNoteIndicators()` | Web uses FA icons; Android uses emoji — different visual weight |

### 2.3 Card Content

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Note preview | `max-height: 4.5em` with "Show more" toggle | Expand-on-first-tap, full content on second tap | Different interaction model — web has explicit toggle; Android uses tap-to-expand |
| Checklist inline | Shows items with checkboxes, drag handles visible | Shows "☑ X/Y" progress text only | **Major difference**: Web shows actual checklist items inline; Android only shows a count |
| Tag chips | Colored pills below card content | `FlowRow` of `TagChip` composables | Similar visual ✅ |
| People chips | Small avatar + name pills | `ContactAvatar` + name composables | Similar ✅ |
| Overdue indicator | Red left border via CSS class | Red border via `chitColorBorder` modifier | Similar ✅ |
| Completed state | `opacity: 0.5` on entire card | `alpha(0.5f)` on card | Same ✅ |
| Archived state | `opacity: 0.45` (0.7 on hover) | `alpha(0.5f)` | Similar (Android slightly more opaque) |

### 2.4 Card Interactions

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Tap | Opens editor | Opens editor (or expands note card first) | Android notes require double-tap to open editor |
| Long press | Context menu (pin/archive/snooze/delete) | `ChitActionMenu` dropdown | Same concept, different visual (web: positioned menu; Android: Material dropdown) |
| Swipe | Not supported | Swipe-to-delete (red background + trash icon) | **Android-only feature** — web has no swipe gesture on cards |
| Drag to reorder | Touch long-press drag with visual feedback (scale 1.04, shadow, dashed outline, pulse animation) | `ReorderableLazyColumn` with drag handle | Web has richer drag feedback; Android uses simpler Material drag |

---

## 3. View-Specific Differences

### 3.1 Tasks View

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Status groups | Collapsible sections with status headers (ToDo, In Progress, Blocked, Complete) | Same collapsible status groups | Same ✅ |
| Status dropdown | Inline `<select>` on each card | Tap card → editor (or long-press → quick edit) | Web has inline status change; Android requires navigation |
| Card spacing | `gap: 6px` between cards | `Arrangement.spacedBy(6.dp)` | Same ✅ |
| Habits sub-mode | Toggle in sidebar, shows habit cards with success rate | Toggle in sidebar, shows habit cards | Same ✅ |
| Assigned sub-mode | Toggle in sidebar | Toggle in sidebar | Same ✅ |

### 3.2 Notes View (Masonry)

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Layout | **Single column** forced at 480px (`position: relative !important; width: 100% !important`) | **Multi-column** staggered grid (`StaggeredGridCells.Adaptive(160.dp)`) — typically 2 columns | **Major difference**: Web forces single column on mobile; Android shows 2+ columns |
| Card sizing | Full width, natural height | Adaptive width (160dp minimum), natural height | Android cards are narrower with more columns |
| Note content font | `sans-serif` override for `.note-content` | Lora (serif) for all text | Web uses sans-serif for note body; Android uses serif everywhere |
| Note content background | `#fff8dc` (cornsilk) background on `.note-content` | No separate background for note content area | Web has a distinct content zone; Android doesn't |
| Drag handle | `⋮⋮` visible on each card (opacity 0.7 on mobile) | `⋮⋮` text in card | Same ✅ |
| Markdown rendering | `marked.js` with full HTML output | `MarkdownRenderer` composable | Both render markdown ✅ |

### 3.3 Checklists View

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Layout | Single column at 480px (same as notes — masonry forced to 1 col) | Multi-column staggered grid (same as notes) | Same difference as notes — Android shows multiple columns |
| Inline items | Full checklist items with checkboxes, indent/outdent, drag handles | Full checklist items with checkboxes and drag | Similar ✅ |
| Item interaction | Tap checkbox to toggle, drag handle to reorder | Tap checkbox to toggle, long-press to reorder | Similar ✅ |
| Nested items | Visual indent with padding-left | Visual indent with start padding | Same ✅ |

### 3.4 Calendar Views

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Week view columns | Responsive — shows fewer days, paginated with ◄/► | `WeekTimeGrid` with day pagination (◄/► buttons) | Same concept ✅ |
| Event font size | `0.65em` (very small) | `bodySmall` (12sp) | Android events are slightly larger/more readable |
| Event min-height | `30px` | Not explicitly constrained | Similar |
| All-day events | `max-height: 1.4em; font-size: 0.7em` (very compact single line) | Separate all-day section above time grid | **Different layout**: Web squeezes all-day into tiny pills; Android gives them a dedicated expandable section |
| Month cells | `min-height: 50px; max-height: 80px; font-size: 0.7em` | Full composable cells with event dots/text | Android month cells are more spacious |
| Time grid hours | Visible hour labels on left | Visible hour labels on left | Same ✅ |
| Drag to reschedule | Touch drag on events (with recurring modal) | Touch drag on events (with recurring modal) | Same ✅ |
| Empty slot tap | Double-click creates new chit with time prefill | Single tap creates new chit with time prefill | Android is single-tap; web requires double-click |
| Year view | 12-month grid, months stack vertically at 480px | 12-month grid in scrollable column | Similar ✅ |

### 3.5 Projects (Kanban)

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Project card layout | Horizontal status columns inside each project box | Horizontal status columns inside expandable cards | Same concept ✅ |
| Column headers | `font-size: 0.8em; padding: 3px` | Material3 Text with `labelSmall` | Similar sizing |
| Child cards | `font-size: 0.78em; padding: 0.2em` (very compact) | Standard card composables (larger) | **Android cards are larger** — web compresses kanban cards significantly on mobile |
| Expand/collapse | Always expanded (no toggle) | Tap project header to expand/collapse | **Android adds expand/collapse** not present on mobile web |
| "+" create child | Small brown button in project header | `IconButton` with `Icons.Default.Add` | Similar ✅ |
| Drag between columns | Touch drag with status change | Not implemented for cross-column drag | **Web supports drag between status columns; Android doesn't** |
| List view toggle | Available in sidebar | Available in sidebar | Same ✅ |

### 3.6 Alarms/Alerts View

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Independent board | Standalone alarms/timers/stopwatches in a grid | Similar board layout | Same ✅ |
| Timer display | Large countdown numbers, animated | Countdown text in cards | Web has more dramatic timer display |
| Stopwatch | Running time display with lap button | Running time display | Similar ✅ |
| Sub-mode toggles | 4 modes (Independent, List, Notifications, Reminders) | 4 modes in sidebar | Same ✅ |

### 3.7 Omni View

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| HST Bar | Horizontal timeline strip at top | **Not implemented** | Missing on Android |
| Weather section | Current weather with location | **Not implemented** | Missing on Android |
| Section layout | Configurable drag-to-arrange sections | Fixed order, no arrangement | Android can't rearrange sections |
| Chrono Anchored | Time-anchored upcoming items | Implemented | ✅ |
| Reminders | Reminder chits | Implemented | ✅ |
| On Deck / Soon | Next-up items | Implemented | ✅ |
| Pinned Notes/Checklists | Pinned items in masonry | Implemented | ✅ |
| Pinned All | Combined pinned view | **Not implemented** | Missing on Android |

---

## 4. Editor Differences

### 4.1 Editor Chrome

| Aspect | Mobile Web | Android App | Difference |
|--------|-----------|-------------|------------|
| Layout | Full-page with header row (logo + buttons) + zones below | Scaffold with TopAppBar (back + save + overflow menu) + scrollable zones | Different header pattern — web has a wide button bar; Android uses compact app bar |
| Background | `--parchment-medium: #faebd7` solid | Material3 Surface (`#FFFAF0`) | Slightly different background tones |
| Zone container | `border: 1px solid; border-radius: 8px; background: #fff8dc` | Material3 Card or Surface with outline | Similar concept, different implementation |
| Zone headers | Brown background bar (`--zone-header-bg`) with toggle arrow | `EditorZoneHeader` composable with brown background + expand/collapse | Same ✅ |
| Save button | Brown button in header row | Save icon in TopAppBar | Different placement — web: inline with other buttons; Android: app bar icon |
| Delete button | Red button in header row | Overflow menu → Delete | Web has visible delete button; Android hides it in overflow |
| Title input | `font-size: 1.3em; font-weight: 700; font-family: Lora` with focus border animation | `OutlinedTextField` with Material3 styling | Web title has custom parchment styling; Android uses standard Material text field |

### 4.2 Zone Styling

| Aspect | Mobile Web | Android App | Difference |
|--------|-----------|-------------|------------|
| Zone body background | `--zone-body-bg: #fff8dc` (cornsilk) | Material3 Surface (no distinct zone body color) | Web zones have a warm cornsilk interior; Android zones blend with page |
| Input fields | `border: 1px inset #8b4513; background: #fdf5e6` | Material3 `OutlinedTextField` (grey outline, white fill) | **Major visual difference**: Web inputs have warm brown inset borders; Android uses standard Material grey outlines |
| Buttons | `background: #d2b48c; border: 2px outset #8b4513; border-radius: 4px` | Material3 `Button` or `OutlinedButton` | Web buttons have the distinctive 3D outset parchment look; Android uses flat Material buttons |
| Dropdowns/selects | Native `<select>` with brown border styling | Material3 `ExposedDropdownMenuBox` | Different visual — web is styled native; Android is Material dropdown |
| Checkboxes | `accent-color: teal` | Material3 Checkbox (purple/primary tint) | Different accent color — web uses teal; Android uses Material primary (brown) |

---

## 5. Typography & Spacing

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Base font size | 16px (body), cards at 0.9em (~14.4px) | 16sp (bodyLarge), cards use bodyMedium (14sp) | Similar ✅ |
| Card title | `font-weight: bold; font-size: 1em` (~14.4px in card context) | `bodyLarge` (16sp) + `FontWeight.Medium` | Android titles are slightly larger |
| Meta text | `font-size: 0.78em` (~11px) | `labelSmall` (11sp) or `bodySmall` (12sp) | Similar ✅ |
| Line height | `line-height: 1.5` on cards | `lineHeight = 24.sp` for bodyLarge (1.5× 16sp) | Same ✅ |
| Letter spacing | None specified | `0.5.sp` on bodyLarge, `0.25.sp` on bodyMedium | Android has slightly more letter spacing |
| Heading style | `text-transform: uppercase; letter-spacing: 2px` on h2/h3 | No uppercase transform on headings | **Web headings are uppercase; Android headings are normal case** |

---

## 6. Color & Theme Differences

| Aspect | Mobile Web | Android App | Difference |
|--------|-----------|-------------|------------|
| Page background | `parchment.jpg` texture, full opacity, `background-size: cover` | Solid `#FDF5E6` + parchment texture at **30% alpha** | **Android parchment is much more washed out** — web has rich visible texture |
| Card background | Transparent (texture shows through) | Solid `#FDF5E6` fill | Web cards are see-through to texture; Android cards are opaque |
| Sidebar background | `parchment.jpg` texture | Solid `#FFFAF0` | Same issue — Android sidebar lacks texture |
| Active tab | `ivory` background fill | Brown underline (no fill) | Different active indicator style |
| Zone header brown | `#d2b48c` (tan/wheat) | `#6B4E31` (dark brown) | **Android zone headers are much darker** than web |
| Button style | 3D outset borders (`border: 2px outset`) | Flat Material3 buttons | Web has distinctive raised/3D button aesthetic; Android is flat |
| Dividers | `1px solid #8b5a2b` | Material3 `HorizontalDivider` (1dp, grey-ish) | Web dividers are brown; Android dividers are neutral |
| Focus/active states | Teal accent (`#008080`) for focused inputs | Material3 primary (brown) for focused inputs | Different focus color |

---

## 7. Interaction & Behavior Differences

### 7.1 Navigation

| Aspect | Mobile Web | Android App | Difference |
|--------|-----------|-------------|------------|
| Tab switching | Open Views panel → tap view | Tap tab in always-visible row, or swipe on header area | Different interaction model |
| Back navigation | Browser back button / ESC key | Android back button / back gesture | Platform-appropriate ✅ |
| Pull to refresh | Not supported | Pull-to-refresh on main content area | **Android-only feature** |
| Swipe between views | Not supported | Swipe left/right on tab bar area | **Android-only feature** |

### 7.2 Modals & Dialogs

| Aspect | Mobile Web (480px) | Android App | Difference |
|--------|-------------------|-------------|------------|
| Confirm dialogs | Custom parchment-styled modal (`#fffaf0` bg, `#6b4e31` border, Lora font) | Material3 `AlertDialog` (white bg, rounded corners, system font) | **Major visual difference**: Web modals match parchment theme; Android uses stock Material dialogs |
| Toast notifications | Custom top-center toast with parchment styling | Material3 `Snackbar` or custom `UndoToast` | Android toasts are more Material-standard |
| Bottom sheets | Not used (modals are centered overlays) | `ModalBottomSheet` for quick edit, tags picker, etc. | **Different pattern**: Web uses centered modals; Android uses bottom sheets |
| Modal width | `calc(100% - 16px)` (nearly full width) | Material3 default (some padding from edges) | Similar full-width approach |
| Undo toast | Bottom-center with countdown bar, parchment styled | Bottom snackbar with countdown | Similar concept, different styling |

### 7.3 Context Menus

| Aspect | Mobile Web | Android App | Difference |
|--------|-----------|-------------|------------|
| Trigger | Long-press (or right-click on desktop) | Long-press | Same ✅ |
| Appearance | Positioned dropdown with parchment styling | Material3 `DropdownMenu` | Web is themed; Android is stock Material |
| Actions | Pin, Archive, Snooze, Quick Edit, Delete | Pin, Archive, Snooze, Quick Edit, Delete | Same actions ✅ |

---

## 8. Specific Broken/Missing Visual Elements

### 8.1 Things That Look Wrong on Android

1. **Parchment texture too faint** — The 30% alpha makes the app look like a generic beige app rather than the rich parchment aesthetic of the web version
2. **Cards are opaque** — On web, cards are transparent and the parchment texture shows through, giving depth. Android cards are flat solid fills.
3. **Border radius mismatch** — Cards are 12dp rounded on Android vs 6px on web. Android looks more "bubbly"/modern; web looks more like aged paper cards.
4. **Zone headers too dark** — Android uses `#6B4E31` (very dark brown) vs web's `#d2b48c` (warm tan). Android zone headers feel heavy/oppressive.
5. **Material dialogs break theme** — Every AlertDialog, BottomSheet, and DropdownMenu uses stock Material3 styling (white, rounded, system-like) which clashes with the parchment aesthetic.
6. **No 3D button effect** — Web buttons have `border: 2px outset` giving them a raised/embossed look. Android buttons are completely flat, losing the "aged paper" tactile feel.
7. **Input fields look generic** — Web inputs have warm brown inset borders on parchment backgrounds. Android inputs use standard Material outlined text fields (grey borders, white fill).
8. **Headings not uppercase** — Web uses `text-transform: uppercase; letter-spacing: 2px` for section headings. Android headings are normal case, losing the "official document" feel.
9. **Notes masonry shows 2 columns on phone** — Web forces single column at phone widths for readability. Android shows 2 narrow columns making cards cramped and hard to read.
10. **Tab row always visible** — Takes up vertical space that web reclaims by hiding tabs. On a phone, this ~48dp of tab row is significant screen real estate.

### 8.2 Things That Work Differently

1. **Note cards require double-tap** — First tap expands, second tap opens editor. Web just opens editor on tap (with a "show more" text toggle for long content).
2. **No inline checklist on task cards** — Web shows actual checklist items with checkboxes on the card. Android only shows "☑ 3/5" text.
3. **No inline status dropdown** — Web lets you change task status directly on the card via a `<select>`. Android requires opening the editor or using the long-press menu.
4. **Kanban cards are too large** — Web compresses kanban child cards to `0.78em` font and minimal padding on mobile. Android renders them at full size, making projects with many children very long.
5. **All-day events in separate section** — Web squeezes all-day events into tiny pills above the time grid. Android gives them a full expandable section, which is better UX but visually different.
6. **Swipe-to-delete exists only on Android** — Web has no swipe gesture; it uses the context menu for delete. This is an Android-only addition.
7. **Pull-to-refresh exists only on Android** — Web has no pull-to-refresh; sync is triggered by a button or automatic interval.

### 8.3 Missing Visual Features on Android

1. **No parchment texture on sidebar** — Sidebar is flat white instead of textured
2. **No parchment texture on modals** — All modals are stock Material white
3. **No weather modal** — Web has a weather modal (Shift+W); Android has no equivalent quick-weather overlay
4. **No calculator popover** — Web has a floating draggable calculator (F4); Android has a `CalculatorSheet` but it's a bottom sheet, not a floating window
5. **No clock modal analog display** — Web clock modal shows analog clock face; need to verify Android `ClockModal` matches
6. **No drag-pulse animation** — Web has a CSS `@keyframes cwoc-drag-pulse` animation during drag. Android drag feedback is simpler.
7. **No note-preview-toggle text** — Web shows "Show more" / "Show less" text. Android uses tap-to-expand with no text indicator.
8. **No content zone recess** — Web adds `background: rgba(0,0,0,0.04)` to content below the header row in task/checklist/alarm cards. Android has no such visual separation.

---

## 9. Settings & Secondary Pages

| Aspect | Mobile Web | Android App | Difference |
|--------|-----------|-------------|------------|
| Page wrapper | `.settings-panel` with gradient background, 2px brown border, radial gold overlay | Material3 Surface/Card | Web has the distinctive gradient + gold shimmer; Android is flat |
| Section headers | `text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #8b5a2b` | Material3 Text with `titleMedium` | Web headers are uppercase with underline; Android is plain |
| Tab navigation | Horizontal tab buttons (same brown style as dashboard) | Material3 tabs or segmented buttons | Different tab styling |
| Form layout | CSS grid/flex with brown-bordered inputs | Material3 form components | Completely different form aesthetic |
| Save system | `CwocSaveSystem` with floating save/cancel bar | TopAppBar save icon + back handler | Different save UX pattern |

---

## 10. Summary: Priority Fixes for Visual Parity

### P0 — Breaks the Brand Identity
1. **Increase parchment texture opacity** (30% → 60-70%) — the app doesn't look like CWOC without visible texture
2. **Make cards semi-transparent** — let texture show through cards like web does
3. **Fix border radius** — 12dp → 6dp on chit cards to match web's sharper paper-card look
4. **Theme all dialogs/sheets** — replace stock Material white with parchment colors (`#fffaf0` bg, `#6b4e31` border)
5. **Add 3D button borders** — use `border` modifier to simulate the outset effect on action buttons

### P1 — Noticeable Visual Differences
6. **Fix zone header color** — `#6B4E31` → `#d2b48c` to match web's warm tan
7. **Force single-column notes on phone** — match web's 480px behavior
8. **Add uppercase + letter-spacing to section headings** — match web's document aesthetic
9. **Theme input fields** — brown borders, parchment background instead of Material grey outlines
10. **Compress kanban cards on mobile** — smaller font, tighter padding to match web

### P2 — Behavioral Differences
11. **Single-tap to open notes** (remove expand-on-first-tap) — match web's direct navigation
12. **Show inline checklist items on cards** — not just a count
13. **Add inline status dropdown on task cards** — match web's quick-change pattern
14. **Add visible "Views" button** — don't rely solely on hidden edge swipe
15. **Add parchment texture to sidebar and modals**

### P3 — Nice-to-Have Parity
16. Add content zone recess (`rgba(0,0,0,0.04)` background below card headers)
17. Add drag-pulse animation during reorder
18. Add "Show more/less" text toggle on note previews
19. Match web's teal focus color for inputs
20. Add gold radial overlay to page panels (settings, etc.)
