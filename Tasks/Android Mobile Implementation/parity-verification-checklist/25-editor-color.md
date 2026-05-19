# Color

**Category:** Editor Zones
**Item #:** 25
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Color Zone Structure (editor.html)

- [ ] `<div id="colorSection" class="zone-container">` — Color zone container
- [ ] `<div id="colorContent" class="zone-body">` — Color zone body (collapsible)
- [ ] Zone header with `toggleZone(event, 'colorSection', 'colorContent')` — Expand/collapse

### Color Input & Preview (editor.html + editor-color.js)

- [ ] `<input type="hidden" id="color" value="transparent">` — Hidden input storing current color hex value
- [ ] `<div id="selected-color">` — Color preview swatch (shows current color as background)
- [ ] `<span id="selected-color-name">` — Color name label (e.g., "Transparent", "Coral", "Custom")

### Default Color Swatches (editor.html + editor.js)

- [ ] Default color palette rendered as `.color-swatch` divs
- [ ] First option: "Transparent" (hex: `"transparent"`)
- [ ] Remaining colors from `_cwocDefaultColors` (shared-utils.js)
- [ ] Each swatch: `data-color` attribute, background-color style, title with color name
- [ ] Click on swatch → `_setColor(hex, name)`
- [ ] Selected swatch gets `.selected` class (visual highlight)

### Custom Colors (editor-color.js)

- [ ] `<div id="custom-colors">` — Custom colors container
- [ ] `_fetchCustomColors()` — Fetches custom colors from user settings API
- [ ] `_renderCustomColors(customColors)` — Renders custom color swatches
- [ ] Custom colors normalized: `{hex, name}` objects
- [ ] Each custom swatch: click → `_setColor(hex, name)`
- [ ] `window.customColors` — Cached custom colors array

### Color Setting Functions (editor-color.js)

- [ ] `_setColor(hex, name)` — Master color setter:
  - [ ] Sets hidden input value
  - [ ] Updates color preview swatch background
  - [ ] Updates color name label
  - [ ] Applies background color to `#mainEditor`
  - [ ] Updates `.selected` class on all swatches
  - [ ] Calls `_updateColorPreview()`
  - [ ] Updates mobile nav bar color (`_applyMobileNavBarColor`)
  - [ ] Calls `setSaveButtonUnsaved()`
- [ ] `_updateColorPreview()` — Syncs preview, editor background, name label, and swatch selection from hidden input value

### Color Swatch Listeners (editor-color.js)

- [ ] `_attachColorSwatchListeners()` — Attaches click listeners to all `.color-swatch` elements
- [ ] Resolves color name from combined `defaultColors` + `customColors` array
- [ ] Falls back to "Custom" if hex not found in palette

### Color Data (editor.js)

- [ ] `const defaultColors` — Combined palette: `[{hex: "transparent", name: "Transparent"}, ..._cwocDefaultColors]`
- [ ] Color loaded from `chit.color` in `loadChitData()` — resolves name from palette, calls `_setColor`
- [ ] Reset to "transparent" in `resetEditorForNewChit()`

### Background Tinting Behavior

- [ ] Editor background (`#mainEditor`) tinted to match chit color
- [ ] Header row intentionally NOT colored (stays fixed)
- [ ] Transparent = no tint (default editor background)
