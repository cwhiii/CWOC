# CWOC Style Guide

A comprehensive reference for recreating the visual style of C.W.'s Omni Chits. The aesthetic is **1940s parchment & magic**: warm, aged paper tones with brown ink, serif typography, and subtle golden accents. Think a wizard's personal ledger or a wartime field journal.

---

## Included Assets

| File | Purpose |
|------|---------|
| `parchment.jpg` | Background texture used on every page and most overlays/modals |
| `cwod_logo.png` | App logo (displayed in headers, circular with brown border) |

---

## Color Palette

### Core Parchment Tones (backgrounds)

| Name | Hex | Usage |
|------|-----|-------|
| Parchment Light | `#fdf5e6` | Input backgrounds, lightest surfaces |
| Parchment Medium | `#faebd7` | Editor body background, modal backgrounds |
| Parchment Dark | `#fff8dc` | Zone body backgrounds, card interiors |
| Panel Gradient Start | `#fff8e1` | Top of panel gradients, setting groups |
| Panel Gradient End | `#f5e6cc` | Bottom of panel gradients, input fields |
| Header/Sidebar | `#e0d4b5` | Header bar, sidebar, zone headers |

### Brown Ink Tones (text, borders, accents)

| Name | Hex | Usage |
|------|-----|-------|
| Aged Brown Dark | `#4a2c2a` | Primary heading color, bold text, deep accents |
| Aged Brown Medium | `#8b4513` | Primary border color, dividers, strong accents |
| Aged Brown Light | `#a0522d` | Secondary borders, cancel buttons, lighter accents |
| Sidebar Border | `#6b4e31` | Sidebar border, form element borders, table borders |
| Button Border | `#5a3f2a` | Button borders (outset style), logo border |
| Deep Text | `#1a1208` | Body text color (high contrast on parchment) |
| Card Text | `#2b1e0f` | Card body text, button text on light backgrounds |
| Warm Text | `#3c2f2f` | Modal text, weather widget text |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| Accent Gold | `#d4af37` | Golden glow effects, alert pulse animations |
| Accent Teal | `#008080` | Focus rings, active toggle switches, checkboxes |
| Warning Orange | `#daa520` | Warning states |
| Danger Red | `#b22222` | Delete buttons, danger actions, high temperature |
| Danger Red Hover | `#a01c1c` | Delete button hover state |
| Info Blue | `#4682b4` | Informational elements, indent/outdent buttons, low temperature |

### Button Colors

| Name | Hex | Usage |
|------|-----|-------|
| Button BG | `#d2b48c` | Standard button background (tan) |
| Button Hover | `#c4a484` | Standard button hover |
| Gradient Button Light | `#d4a373` | Gradient button top |
| Gradient Button Dark | `#c8965a` | Gradient button bottom |
| Dark Button BG | `#8b5a2b` | Action buttons, tabs, sidebar buttons |
| Dark Button Hover | `#6b4e31` | Dark button hover |
| Dark Button Hover Text | `#d2b48c` | Text color on dark button hover |

---

## Typography

### Font

- **Primary:** Lora (self-hosted variable font, weights 400–700, normal + italic)
- **Fallback:** Georgia, serif
- **System fallback (editor):** -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif (used only in the editor body reset)
- **Monospace (code/kbd):** ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace

### Sizes

| Element | Size |
|---------|------|
| Base body | 16px |
| H1 (dashboard) | 2.5em |
| H2 (page headings) | 26px |
| H3 (section headings) | 22px |
| H4 (sub-headings) | 17px |
| Card title | 1em |
| Card meta | 0.85em |
| Zone title | 1.1em |
| Zone button | 12px |
| Tag chips | 0.8em |
| Small labels | 0.75em–0.85em |
| Minimum readable | 14px (never go below) |

### Text Styling

- **Headings:** Uppercase, letter-spacing 2px (h2) or 1px (h3), border-bottom separator
- **Body text:** Normal weight, high contrast (`#1a1208` on parchment)
- **Labels:** Bold, block display, 15px
- **Links:** Color `#4a2c2a`, hover `#1a1208`
- **Emphasis:** Never use opacity below 0.7 on text

---

## Borders

### Border Styles

| Context | Style |
|---------|-------|
| Panels/cards | `2px solid #8b5a2b` |
| Modals (standard) | `2px solid #8b4513` |
| Modals (bold/alert) | `3px solid #8b4513` |
| Form inputs | `1px solid #8b5a2b` |
| Form inputs (dashboard) | `1px solid #6b4e31` |
| Buttons (standard) | `2px outset #8b4513` (var: `--aged-brown-medium`) |
| Buttons (zone) | `1px outset #8b5a2b` (var: `--aged-brown-medium`) |
| Tables | `1px solid #6b4e31` (outer), `1px solid #d4c5a9` (row dividers) |
| Table header bottom | `2px solid #6b4e31` |
| Heading underlines | `1px solid #8b5a2b` (standard), `3px double #8b5a2b` (help h2) |
| Section dividers | `2px solid rgba(139, 90, 43, 0.3)` |
| Sidebar border | `1px solid #6b4e31` (var: `--sidebar-border`) |
| Zone containers | `1px solid #8b4513` (var: `--border-color`) |

### Border Radius

| Element | Radius |
|---------|--------|
| Panels (settings-panel) | `10px` |
| Modals | `10px` |
| Cards (chit-card) | `6px` |
| Editor container | `8px` |
| Header row | `8px` |
| Zone containers | `4px` |
| Buttons (standard) | `5px` |
| Buttons (action/tab) | `3px` |
| Form inputs | `5px` (shared pages), `4px` (editor) |
| Tag chips | `3px` |
| Toggle switch | `20px` (fully rounded) |
| Pill toggle | `4px` |
| Logo/avatar | `50%` (circle) |
| Color swatches | `50%` (circle) |
| Alert modal | `12px` |

---

## Backgrounds

### Page Background

```css
body {
    background-image: url("/static/images/parchment.jpg");
    background-size: cover;
    background-attachment: fixed;
}
```

The `parchment.jpg` texture is used as the base for every page. It's also applied to modals, sidebars, and overlay panels with `center/cover`:

```css
background: url("/static/images/parchment.jpg") center/cover;
background-color: #fff8e1; /* fallback */
```

### Panel Background

Main content panels use a subtle gradient over the parchment:

```css
.settings-panel {
    background: linear-gradient(to bottom, #fff8e1, #f5e6cc);
}
```

With a radial gold shimmer overlay (pseudo-element):

```css
.settings-panel::before {
    background: radial-gradient(circle, rgba(255, 215, 0, 0.1), transparent);
    pointer-events: none;
}
```

### Zone/Section Backgrounds

- Zone header: `#d2b48c` (var: `--zone-header-bg` / `--button-bg`)
- Zone body: `#fff8dc` (var: `--zone-body-bg` / `--parchment-dark`)
- Setting groups: `#fff8e1`
- Table background: `#fffaf0`
- Table header: `#e0d4b5` (var: `--header-bg`)
- Table row hover: `rgba(212, 196, 160, 0.15)`

---

## Buttons

### Standard Button (navigation, secondary actions)

```css
.standard-button {
    background: linear-gradient(#d4a373, #c8965a);
    color: #2b1e0f;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    font-size: 16px;
    font-family: 'Lora', Georgia, serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
/* Hover: subtle lift */
.standard-button:hover {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transform: translateY(-1px);
}
```

### Action Button (dark brown, primary actions)

```css
.cwoc-btn {
    padding: 10px 14px;
    height: 40px;
    background-color: #8b5a2b;
    border: 1px solid #5a3f2a;
    border-radius: 3px;
    color: inherit;
    font-family: 'Lora', Georgia, serif;
    font-weight: bold;
    font-size: larger;
}
.cwoc-btn:hover {
    background-color: #6b4e31;
    color: #d2b48c;
}
```

### Delete / Danger Button

```css
.cwoc-btn.danger {
    background: #b22222;
    color: #fdf5e6;
    border-color: #4a2c2a;
}
.cwoc-btn.danger:hover {
    background: #a01c1c;
    color: #fff;
}
```

Also used in editors:

```css
button.delete {
    background: #b22222;        /* var(--danger-red) */
    color: #fdf5e6;             /* var(--parchment-light) */
    border: 2px outset #4a2c2a; /* var(--aged-brown-dark) */
}
button.delete:hover {
    background: #a01c1c;
}
```

Small inline delete (checklist items):

```css
.delete-item {
    background: #b22222;
    color: #fdf5e6;
    border: 1px outset #4a2c2a;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 12px;
}
.delete-item:hover {
    background: #c82333;
}
```

### Cancel Button

```css
button.cancel {
    background: #a0522d;        /* var(--aged-brown-light) */
    color: #fdf5e6;             /* var(--parchment-light) */
    border: 2px outset #8b4513; /* var(--aged-brown-medium) */
}
button.cancel:hover {
    background: #8b4513;
}
```

### Zone Button (small, inside zone headers)

```css
.zone-button {
    padding: 5px 10px;
    font-size: 12px;
    background-color: #a0522d;  /* var(--aged-brown-light) */
    color: #fdf5e6;             /* var(--parchment-light) */
    border: 1px outset #8b4513; /* var(--aged-brown-medium) */
    white-space: nowrap;
}
.zone-button:hover {
    background-color: #924525;
}
```

### Tab Buttons

```css
.tab {
    padding: 10px 10px;
    background-color: #8b5a2b;  /* var(--btn-bg) */
    color: ivory;
    border: 1px solid #5a3f2a;
    border-radius: 3px;
    font-family: 'Lora', Georgia, serif;
    font-weight: bold;
    font-size: 1em;
}
.tab.active {
    background-color: ivory;
    color: #3b1f0a;
}
.tab:hover {
    background-color: #6b4e31;
    color: #d2b48c;
}
```

### General Button (dashboard default)

```css
button {
    padding: 10px 20px;
    background-color: #e0d4b5;  /* var(--header-bg) */
    border: 1px solid #6b4e31;
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-weight: bold;
}
button:hover {
    background-color: #d2b48c;
}
```

---

## Shadows

| Context | Shadow |
|---------|--------|
| Panels | `0 4px 8px rgba(0, 0, 0, 0.3)` |
| Buttons (standard) | `0 2px 4px rgba(0, 0, 0, 0.2)` |
| Modals | `0 4px 8px rgba(0, 0, 0, 0.3)` (standard), `0 8px 32px rgba(0, 0, 0, 0.4)` (weather) |
| Alert modal | `0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(212, 175, 55, 0.3)` |
| Card hover | `0 2px 8px rgba(107, 66, 38, 0.15)` |
| Focus ring | `0 0 0 2px rgba(0, 128, 128, 0.25)` (teal glow) |
| Editor header | `0 2px 4px rgba(0, 0, 0, 0.1)` |
| Toast notifications | `0 4px 16px rgba(0, 0, 0, 0.3)` |

---

## Modals & Overlays

### Overlay Backdrop

```css
.cwoc-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

### Standard Modal Content

```css
.modal-content {
    background: #faebd7;        /* var(--parchment-medium) */
    border: 2px solid #8b4513;  /* var(--aged-brown-medium) */
    border-radius: 10px;
    padding: 20px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    text-align: center;
}
```

### Bold Alert Modal (alarms/timers, with parchment texture)

```css
.cwoc-alert-modal {
    background: url("/static/images/parchment.jpg") center/cover;
    background-color: #fff8e1;
    border: 3px solid #8b4513;
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(212, 175, 55, 0.3);
    font-family: 'Lora', Georgia, serif;
    color: #3c2f2f;
    animation: cwocAlertPulse 2s ease-in-out infinite;
}
```

The pulse animation creates a golden glow effect:

```css
@keyframes cwocAlertPulse {
    0%, 100% { box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 30px rgba(212,175,55,0.2); }
    50%      { box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(212,175,55,0.5); }
}
```

---

## Toast Notifications

Toasts are positioned fixed and use the parchment aesthetic:

```css
/* Standard toast pattern */
position: fixed;
top: 20px;
right: 20px; /* or left:50% + transform for centered */
z-index: 99999;
background: #fff8e1;
border: 2px solid #8b4513;
border-radius: 8px;
padding: 10px 18px;
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
font-family: Lora, Georgia, serif;
font-size: 0.95em;
color: #4a2c2a;
```

### Undo Toast (bottom-positioned with countdown bar)

```css
.cwoc-undo-toast {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 10001;
    background: #fff8e1;
    border: 2px solid #8b5a2b;
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    font-family: 'Lora', Georgia, serif;
}
```

---

## Cards

### Chit Card

```css
.chit-card {
    border: 2px solid #8b5a2b;
    border-radius: 6px;
    padding: 0.5em 0.7em;
    font-family: 'Lora', Georgia, serif;
    color: #2b1e0f;
    line-height: 1.5;
    cursor: pointer;
}
.chit-card:hover {
    border-color: #a0522d;
    box-shadow: 0 2px 8px rgba(107, 66, 38, 0.15);
}
```

### Completed/Archived States

```css
.chit-card.completed-task { opacity: 0.5; }
.editor.archived { opacity: 0.6; }
```

---

## Form Elements

### Text Inputs (shared pages)

```css
input[type="text"], input[type="number"] {
    border: 1px solid #8b5a2b;
    border-radius: 5px;
    padding: 5px 8px;
    font-size: 16px;
    color: #1a1208;
    font-family: 'Lora', Georgia, serif;
    background: #f5e6cc;
}
```

### Text Inputs (editor)

```css
.editor input {
    padding: 8px 12px;
    border: 1px inset #8b4513;
    border-radius: 4px;
    font-size: 14px;
    background-color: #fdf5e6;  /* var(--input-bg) */
    color: #4a2c2a;             /* var(--text-color) */
}
```

### Focus State

```css
.editor input:focus {
    outline: none;
    border-color: #008080;      /* var(--accent-teal) */
    box-shadow: 0 0 0 2px rgba(0, 128, 128, 0.25);
}
```

### Disabled State

```css
input:disabled {
    background-color: #fdf5e6;
    cursor: not-allowed;
    color: #8b4513;
    border: 1px dotted #a0522d;
}
```

### Select Dropdowns

```css
select {
    background: linear-gradient(#d4a373, #c8965a);
    border: 1px solid #5c4033;
    border-radius: 5px;
    padding: 8px 12px;
    font-size: 16px;
    color: #1a1208;
    font-family: 'Lora', Georgia, serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
select:hover {
    background: linear-gradient(#c8965a, #a86b3e);
    transform: translateY(-1px);
}
```

---

## Toggle Controls

### On/Off Switch

```css
.slider {
    background-color: #a0522d;  /* off state */
    border: 1px solid #8b4513;
    border-radius: 20px;
    width: 40px; height: 20px;
}
.slider:before {
    /* white circle knob */
    background-color: #fdf5e6;
    border-radius: 50%;
    width: 16px; height: 16px;
}
input:checked + .slider {
    background-color: #008080;  /* teal when on */
    border-color: #008080;
}
```

### 2-Value Pill Toggle

```css
.cwoc-2val-toggle {
    display: inline-flex;
    border: 1px solid #8b5a2b;
    border-radius: 4px;
    overflow: hidden;
    font-size: 0.8em;
    font-family: 'Lora', Georgia, serif;
}
.cwoc-2val-toggle span {
    padding: 4px 10px;
    background: #f5e6cc;
    color: #999;
}
.cwoc-2val-toggle span.active {
    background: #8b5a2b;
    color: #fff8e1;
    font-weight: bold;
}
```

---

## Zones (Collapsible Sections)

The editor uses "zones", which are collapsible content sections with a header bar:

```css
.zone-container {
    border: 1px solid #8b4513;
    border-radius: 4px;
    margin-bottom: 20px;
    background: #fff8dc;
}
.zone-header {
    padding: 10px;
    background-color: #d2b48c;
    border-bottom: 1px solid #8b4513;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
}
.zone-body {
    padding: 10px;
    background-color: #fff8dc;
}
```

Collapsed state: `height: 48px; opacity: 0.55;` with hover at `0.85`.

---

## Layout Patterns

### Header Bar (fixed, full-width)

```css
.header {
    position: fixed;
    top: 0; left: 0;
    width: 100%;
    z-index: 1002;
    background-color: #e0d4b5;
    height: 100px;
    padding: 10px 20px;
}
```

### Logo

```css
.logo {
    width: 80px;
    height: 80px;
    border: 1px solid #5a3f2a;
    border-radius: 50%;
}
```

### Sidebar

```css
.sidebar {
    position: fixed;
    width: 200px;
    background-color: #e0d4b5;
    border-right: 1px solid #6b4e31;
    padding: 0 20px;
    transition: left 0.3s ease;
}
```

### Two-Column Grid (editor zones)

```css
.main-zones-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}
/* Collapses to single column at 768px */
@media (max-width: 768px) {
    .main-zones-grid { grid-template-columns: 1fr; }
}
```

### Settings Grid

```css
.settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}
```

---

## Animations & Transitions

| Element | Transition |
|---------|-----------|
| Buttons | `background 0.2s`, `transform 0.1s` |
| Sidebar slide | `left 0.3s ease` |
| Zone collapse | `height 0.3s ease`, `opacity 0.2s` |
| Focus ring | `border-color 0.2s, background-color 0.2s, box-shadow 0.2s` |
| Visibility | `opacity 0.3s ease` |
| Alert pulse | `2s ease-in-out infinite` (golden glow) |
| Alert bar | `1.5s ease-in-out infinite` (opacity pulse) |

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| ≤ 768px (tablet) | Single-column grid, compact zones, mobile sidebar |
| ≤ 480px (mobile) | Stacked layout, full-width inputs, 16px font (prevents iOS zoom), mobile actions modal replaces button row |
| ≤ 400px | Fully stacked header, centered buttons |

---

## Key Design Principles

1. **Parchment texture everywhere.** The `parchment.jpg` background is the foundation. Every surface either shows it directly or uses a parchment-colored solid/gradient.

2. **Brown is the primary color.** Not black. Text is dark brown (`#1a1208`), borders are medium brown (`#8b4513`), accents are warm brown (`#a0522d`). Black is almost never used.

3. **Outset borders on buttons.** Buttons use `border: 2px outset` to create a slightly raised, tactile feel (like embossed leather).

4. **Gold for magic.** The accent gold (`#d4af37`) appears in subtle shimmer overlays, alert pulse animations, and progress bars. It's the "magic" element.

5. **Teal for interaction.** Focus states and active toggles use teal (`#008080`) as the single cool-tone accent, providing clear visual feedback without clashing with the warm palette.

6. **Serif everything.** Lora is used for ALL text including buttons, inputs, and labels. The only exception is code/monospace contexts.

7. **High contrast text.** Body text is always dark (`#1a1208` or `#2b1e0f`) on light parchment. Never light-on-light.

8. **Consistent border weight.** Panels and cards use 2px borders. Form elements and internal dividers use 1px. Alert/emphasis modals use 3px.

9. **Subtle depth.** Shadows are soft and warm-toned (`rgba(0,0,0,0.1)` to `rgba(0,0,0,0.3)`). No harsh drop shadows.

10. **Ivory for active tabs.** Active/selected states flip to ivory/white background with dark brown text, creating clear visual distinction from the dark brown inactive state.


---

## About, Support & Contact Content

Standard content used across all C.W. projects for about pages, support/donation links, and contact information. When building an about page, help modal, or footer for any C.W. project, use this as the canonical source.

### Creator Attribution

- **Name:** C.W. Holeman III
- **Website:** [www.cwholemaniii.com](http://cwholemaniii.com)
- **GitHub:** [github.com/cwhiii](https://github.com/cwhiii)

### Buy Me a Coffee / Support

The standard support blurb:

> Enjoying this tool? Getting a lot of value from it? I'd love to hear from you. I also wouldn't complain if you bought me a coffee (or a car). You can do that here:

- **PayPal:** [paypal.me/cwhiii](https://www.paypal.me/cwhiii)

### Contact

Three tiers of contact, depending on context:

1. **About the creator's books/writing:** [cwholemaniii.com/author/contact.shtml](http://www.cwholemaniii.com/author/contact.shtml)
2. **About a specific tool/project:** [cwholemaniii.com/pages/general/contact_me.shtml](http://www.cwholemaniii.com/pages/general/contact_me.shtml)
3. **Direct email for code/tools:** cwopod@cwholemaniii.com

### Credits

- Icons: [icons8.com](https://icons8.com/)

### Pattern

When implementing an about/support page in a C.W. project, include these sections in order:

1. **What the tool is.** Name, one-line description, feature list
2. **Created by.** Name + website link + GitHub link
3. **Buy me a coffee.** The standard blurb + PayPal link
4. **Contact.** The three-tier contact links
5. **License.** MIT (or whatever applies)
6. **Credits.** Icon attributions, etc.

### Tone

Casual, warm, slightly self-deprecating humor ("or a car"). Not corporate. Not begging. Just a friendly nudge that the tool is free and support is appreciated.
