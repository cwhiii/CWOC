# Parchment Theme / Lora Font (Applied Consistently Everywhere)

**Category:** Cross-Cutting Behaviors
**Item #:** 75
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files
- `src/frontend/css/shared/shared-page.css` (secondary pages canonical source)
- `src/frontend/css/dashboard/styles-variables.css` (dashboard canonical source)
- `static/fonts/lora/Lora-VariableFont_wght.ttf`
- `static/fonts/lora/Lora-Italic-VariableFont_wght.ttf`
- `static/parchment.jpg`

## Functions, Buttons, Controls & Inputs

### Font Definitions

- [ ] `@font-face` Lora normal — Self-hosted variable font, weight 400–700, `font-display: swap`, truetype format
- [ ] `@font-face` Lora italic — Self-hosted variable font italic, weight 400–700, `font-display: swap`, truetype format
- [ ] Font path: `/static/fonts/lora/Lora-VariableFont_wght.ttf`
- [ ] Font path: `/static/fonts/lora/Lora-Italic-VariableFont_wght.ttf`
- [ ] Font stack: `'Lora', Georgia, serif` — used on body, buttons, inputs, selects, modals

### CSS Variables (Shared — `:root`)

- [ ] `--parchment-light: #fdf5e6` — Lightest parchment background
- [ ] `--parchment-medium: #faebd7` — Medium parchment
- [ ] `--parchment-dark: #fff8dc` — Dark parchment
- [ ] `--aged-brown-dark: #4a2c2a` — Darkest brown (headings, emphasis)
- [ ] `--aged-brown-medium: #8b4513` — Medium brown (borders, accents)
- [ ] `--aged-brown-light: #a0522d` — Light brown (secondary accents)
- [ ] `--accent-gold: #d4af37` — Gold accent color
- [ ] `--button-bg: #d2b48c` — Standard button background
- [ ] `--button-hover: #c4a484` — Button hover state
- [ ] `--danger-red: #b22222` — Danger/destructive action color
- [ ] `--info-blue: #4682b4` — Informational accent
- [ ] `--border-color: var(--aged-brown-medium)` — Default border color
- [ ] `--text-color: var(--aged-brown-dark)` — Default text color
- [ ] `--header-bg: #e0d4b5` — Header/table header background

### CSS Variables (Dashboard-Specific)

- [ ] `--sidebar-bg: #e0d4b5` — Sidebar background
- [ ] `--sidebar-border: #6b4e31` — Sidebar border
- [ ] `--btn-bg: #8b5a2b` — Dashboard button background
- [ ] `--btn-border: #5a3f2a` — Dashboard button border
- [ ] `--btn-hover: #6b4e31` — Dashboard button hover
- [ ] `--btn-hover-text: #d2b48c` — Dashboard button hover text

### Body Styling

- [ ] Background image: `url("/static/parchment.jpg")` — cover, fixed attachment
- [ ] Font family: `'Lora', Georgia, serif`
- [ ] Text color: `#1a1208` (very dark brown, high contrast)
- [ ] Base font size: `16px`
- [ ] Min-height: `100vh`
- [ ] Flex column layout, centered

### Page Panel (`.settings-panel`)

- [ ] Background: `linear-gradient(to bottom, #fff8e1, #f5e6cc)`
- [ ] Border: `2px solid #8b5a2b`
- [ ] Border-radius: `10px`
- [ ] Box-shadow: `0 4px 8px rgba(0, 0, 0, 0.3)`
- [ ] `::before` pseudo-element — radial gradient gold shimmer overlay (pointer-events: none)

### Headings (h2, h3)

- [ ] Color: `#1a1208`
- [ ] Text-transform: `uppercase`
- [ ] Letter-spacing: `2px`
- [ ] Border-bottom: `1px solid #8b5a2b`
- [ ] h2 font-size: `26px`
- [ ] h3 font-size: `22px`
- [ ] h2 logo image: 80×80px, circular, bordered

### Standard Button (`.standard-button`)

- [ ] Background: `linear-gradient(#d4a373, #c8965a)`
- [ ] Color: `#2b1e0f`
- [ ] Border-radius: `5px`
- [ ] Font-family: `'Lora', Georgia, serif`
- [ ] Box-shadow: `0 2px 4px rgba(0, 0, 0, 0.2)`
- [ ] Hover: shadow reduction + translateY(-1px)

### Action Button (`.cwoc-btn`)

- [ ] Background: `#8b5a2b`
- [ ] Border: `1px solid #5a3f2a`
- [ ] Color: inherit
- [ ] Font-family: `'Lora', Georgia, serif`
- [ ] Font-weight: bold
- [ ] Height: `40px`
- [ ] Hover: `background #6b4e31`, `color #d2b48c`
- [ ] `.cwoc-btn.danger` — red background
- [ ] `.cwoc-btn.restore` — light brown background

### Form Elements

- [ ] Select: gradient background `#d4a373 → #c8965a`, border `#5c4033`, Lora font
- [ ] Text/number inputs: border `#8b5a2b`, background `#f5e6cc`, Lora font, color `#1a1208`
- [ ] Color inputs: border `#8b5a2b`

### Tables (`.cwoc-table`)

- [ ] Background: `#fffaf0`
- [ ] Border: `1px solid #6b4e31`
- [ ] Header background: `var(--header-bg)` (#e0d4b5)
- [ ] Header border-bottom: `2px solid #6b4e31`
- [ ] Cell color: `#1a1208`
- [ ] Row hover: subtle highlight

### Modal Styling

- [ ] Overlay: `rgba(0, 0, 0, 0.5)` fixed full-screen
- [ ] Content: background `#fff8e1`, border `2px solid #8b5a2b`, border-radius `10px`
- [ ] Box-shadow: `0 4px 8px rgba(0, 0, 0, 0.3)`

### Alert Modal (`.cwoc-alert-modal`)

- [ ] Background: `url("/static/parchment.jpg")` + `#fff8e1` fallback
- [ ] Border: `3px solid #8b4513`
- [ ] Border-radius: `12px`
- [ ] Gold glow animation (`cwocAlertPulse`)
- [ ] Snooze circles: circular buttons with parchment background, brown border

### Toast Notifications

- [ ] Success: `bg #2d5a1e`, border `#1e3f14`
- [ ] Error: `bg #8b1a1a`, border `#5c1010`
- [ ] Info: `bg #4a2c2a`, border `#2b1e0f`
- [ ] All: Lora font, `#fdf5e6` text, border-radius 8px

### Navigate Panel (`#cwoc-nav-panel`)

- [ ] Background: `url("/static/parchment.jpg")` + `#fdf6e3` fallback
- [ ] Border: `3px solid #6b4226`
- [ ] Border-radius: `12px`
- [ ] Key badges: `#8b5a2b` background, `#fff8e1` text

### Color Swatches (`.color-swatch`)

- [ ] 30×30px circular
- [ ] Transparent border (2px), hover shows `#666` border
- [ ] `.selected` shows `#000` border
- [ ] `.cwoc-color-none` — parchment background with `#ccc` border

### Responsive Breakpoints

- [ ] Tablet (≤768px): single-column grid, reduced padding
- [ ] Mobile (≤480px): stacked header, full-width buttons, sticky toolbar, full-screen modals, min-height 48px touch targets

### Typography & Contrast Rules

- [ ] Text color: `#1a1208` or darker on parchment backgrounds
- [ ] No opacity below 0.7 on text elements
- [ ] Base font size: 16px minimum for user-facing text
- [ ] Never light brown on light brown

### Touch & Drag Feedback

- [ ] `.cwoc-touch-dragging` — opacity 0.7, scale 1.04, brown box-shadow, dashed outline, pulse animation
- [ ] `.cwoc-dragging` — opacity 0.4, dashed outline
- [ ] `@keyframes cwoc-drag-pulse` — outline color oscillation

### Settings Grid (`.settings-grid`)

- [ ] Grid: `repeat(auto-fill, minmax(300px, 1fr))`
- [ ] Setting group: `#fff8e1` background, `#8b5a2b` border, rounded

### Help Content Styling

- [ ] Line-height: 1.7
- [ ] h2: double border-bottom, uppercase, `#4a2c2a`
- [ ] h3: single border-bottom, uppercase
- [ ] Links: `#4a2c2a`, hover `#1a1208`
- [ ] Code/kbd: `#e0d4b5` background, monospace font
- [ ] Index: parchment card with grid columns

### Author Footer (`.author-info`)

- [ ] Font-size: 0.8em
- [ ] Color: `#8b7355`
- [ ] Border-top: subtle brown
- [ ] Link color: `#6b4e31`
