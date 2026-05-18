# A — Visual Identity & Theme (5 items: A1–A5)

## Status: COMPLETE

---

## A1 — No parchment theme (Material 3 defaults instead of brown/gold aesthetic)

**Status: ✅ COMPLETE — all 8 sub-items addressed**

1. ✅ Color scheme — `Color.kt` now maps every Material 3 color slot to exact web CSS variable values (`--parchment-light`, `--aged-brown-medium`, `--btn-bg`, `--sidebar-border`, etc.)
2. ✅ Parchment background texture — `ParchmentBackground.kt` applied to all screens via MainActivity wrapper
3. ✅ Card backgrounds — `CwocSurface = #fffaf0` (floral white), `CwocSurfaceVariant = #f5e6d3` — matches web exactly
4. ✅ Zone headers — `CwocPrimaryContainer = #6b4e31`, `CwocOutline = #6b4e31`, `CwocZoneHeaderBrown` named color added. TopAppBar uses `CwocHeaderBg (#e0d4b5)`
5. ✅ Buttons — Created `CwocZoneButton` (outlined, parchment bg, brown border) and `CwocPrimaryButton` (filled brown) in `CwocButton.kt`
6. ✅ Dividers — `CwocOutlineVariant = #c9b896` (gold), `CwocGoldDivider` named color added
7. ✅ Input fields — Created `cwocTextFieldColors()` in `CwocTextField.kt` — parchment background, brown focused border, dark text
8. ✅ Tab bar — `CCaptnTabRow.kt` rewritten with icons per tab, brown active color, underline indicator, CWOC styling

**Files modified:**
- `android/app/src/main/java/com/cwoc/app/ui/theme/Color.kt` — all colors corrected to match web CSS
- `android/app/src/main/java/com/cwoc/app/MainActivity.kt` — ParchmentBackground wrapper, TopAppBar color
- `android/app/src/main/java/com/cwoc/app/ui/navigation/CCaptnTabRow.kt` — icons + CWOC styling
- `android/app/src/main/java/com/cwoc/app/ui/components/CwocButton.kt` (NEW)
- `android/app/src/main/java/com/cwoc/app/ui/components/CwocTextField.kt` (NEW)

---

## A2 — No Lora font (system default instead)

**Status: ✅ COMPLETE (pre-existing)**

1. ✅ `Type.kt` defines `LoraFontFamily` with Regular, Bold, Italic, Bold-Italic variants
2. ✅ Font files in `res/font/`: `lora_regular.ttf`, `lora_bold.ttf`, `lora_italic.ttf`, `lora_bold_italic.ttf`
3. ✅ `CwocTypography` uses Lora for all 15 Material 3 typography slots (displayLarge through labelSmall)

---

## A3 — No parchment background texture

**Status: ✅ COMPLETE**

1. ✅ `parchment.jpg` copied to `res/drawable/parchment_bg.jpg`
2. ✅ `ParchmentBackground.kt` composable renders texture at 30% alpha over theme background color
3. ✅ Applied to: main Scaffold (all C CAPTN screens), full-screen pages (Editor, Settings, etc.), LoginScreen

**Files created:**
- `android/app/src/main/res/drawable/parchment_bg.jpg`
- `android/app/src/main/java/com/cwoc/app/ui/theme/ParchmentBackground.kt`

---

## A4 — Login welcome message not rendered as markdown

**Status: ✅ COMPLETE**

1. ✅ `LoginScreen.kt` now uses `MarkdownRenderer` composable (pre-existing in `ui/components/MarkdownRenderer.kt`)
2. ✅ `MarkdownRenderer` supports: headings, bold, italic, links, lists, code blocks, blockquotes, images (alt text), horizontal rules — equivalent to `marked.js`

**Files modified:**
- `android/app/src/main/java/com/cwoc/app/ui/screens/login/LoginScreen.kt`

---

## A5 — No profile menu (avatar, switch user, logout)

**Status: ✅ COMPLETE**

1. ✅ Profile avatar button added to TopAppBar (rightmost action) — shows user initial in circular badge or person icon
2. ✅ Dropdown menu with: display name/username header, Switch User, Logout
3. ✅ Profile image — shows initial-letter avatar (actual server image would require image loading library; initial is the mobile equivalent of the web's default-avatar.svg)
4. ✅ Logout action in dropdown — clears token, navigates to login
5. ✅ Switch User — clears token, navigates to login (same as web behavior)

**Files created:**
- `android/app/src/main/java/com/cwoc/app/ui/components/ProfileMenu.kt`

**Files modified:**
- `android/app/src/main/java/com/cwoc/app/MainActivity.kt` — added ProfileMenu to TopAppBar actions, injected SettingsRepository for username

---

## Reusable components created in Section A:
- **`ParchmentBackground`** — parchment texture wrapper for any screen
- **`MarkdownRenderer`** — full markdown rendering (pre-existing, now used)
- **`ProfileMenu`** — avatar + dropdown for top bar
- **`CwocZoneButton`** — outlined button matching web's `.zone-button`
- **`CwocPrimaryButton`** — filled brown button for primary actions
- **`cwocTextFieldColors()`** — CWOC-themed OutlinedTextField colors
- **`CwocHeaderBg`**, **`CwocZoneHeaderBrown`**, **`CwocGoldDivider`**, etc. — named color constants
