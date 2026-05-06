---
inclusion: fileMatch
fileMatchPattern: "**/editor*.html,**/editor*.js,**/editor*.css"
---

# Chit Editor Style Guide

This document defines the visual and interaction patterns for the chit editor page. All new work on the editor must follow these conventions.

## Zone Header Layout

Every zone follows the same header structure:

```
[Emoji Title] [Left buttons (1em gap from title)] ... [spacer] ... [Right buttons] [Toggle icon (1em margin)]
```

### Rules:
- Zone title uses an emoji + text (e.g. "📝 Notes", "✅ Checklist", "🗺️ Location")
- Title has `flex-grow: 0; flex-shrink: 0` — it never stretches
- Zone-actions div has `flex: 1; margin-left: 1em` — fills remaining space
- Left-side buttons sit immediately after the 1em gap
- A `<span class="location-actions-spacer">` (flex: 1) pushes right-side buttons to the far right
- Toggle icon (🔼/🔽) has `margin-left: 1em` from the last button
- The zone-header has `justify-content: flex-start` (overriding the shared default of space-between)

### Button Placement:
- **Left side**: Primary actions (Expand, Data/More menu, Search, Map, Directions, Context)
- **Right side**: Toggle/state buttons (Render/Edit, All Day, Habit, Stealth, +Location/Clear, Undo/Redo)

## Zone Buttons (`.zone-button`)

All zone header buttons use the `zone-button` class:

```css
background-color: var(--aged-brown-light);  /* Brown */
color: var(--parchment-light);              /* Cream/white text */
border: 1px outset var(--aged-brown-medium);
padding: 5px 10px;
font-size: 12px;
white-space: nowrap;
```

Hover: `background-color: #924525` (darker brown)

### Button Content:
- Icon (Font Awesome, `fas` or `far` prefix) + text label
- Text wrapped in `<span class="hideWhenNarrow">` for mobile responsiveness
- Icons inherit the button text color (cream/white) — never colored emojis in buttons
- Example: `<i class="fas fa-expand"></i><span class="hideWhenNarrow">Expand</span>`

### Undo/Redo Buttons:
- Use class `zone-button notes-undo-redo`
- Teal background: `var(--accent-teal, #008080)` with white text
- Always pushed to the right side via spacer
- Content: `↺` and `↻` (unicode arrows, no FA icon)

### Toggle Buttons (state-aware):
- Stealth: darkens to `#6b4e31` background + white text when active
- +Location/Clear: switches icon (`fa-plus` ↔ `fa-times`) and label based on field state
- Expand/Collapse: switches icon (`fa-expand-alt` ↔ `fa-compress-alt`) and label
- Render/Edit: switches icon (`fa-eye` ↔ `fa-edit`) and label

## "More" / "Data" Dropdown Menus

Used when a zone has too many actions for the header bar.

### Structure:
```html
<div style="position:relative;display:inline-block;">
    <button class="zone-button" onclick="...">
        <i class="fas fa-ellipsis-v"></i><span class="hideWhenNarrow">Data</span>
    </button>
    <div class="zone-more-menu" style="display:none;">
        <button><i class="fas fa-clipboard"></i> Copy to clipboard</button>
        ...
    </div>
</div>
```

### Menu Styling (`.zone-more-menu`):
- Position: absolute, top: 100%, right: 0
- Background: `var(--parchment-light)`, border: 2px solid brown, rounded 6px, shadow
- Buttons: full-width, left-aligned, icon + text with 8px gap
- Icons have fixed 18px width for alignment
- Close on click-outside or ESC

## Expanded Modals (Notes, People, Email)

All use the same structure:

```html
<div class="modal-overlay">
    <div class="modal-contentFull" style="width:calc(100vw - 2em);height:calc(100vh - 2em);...">
        <div class="modal-header">...</div>
        <div class="modal-body">...</div>
    </div>
</div>
```

### Modal Rules:
- Full viewport minus 2em margin
- Parchment background image on both contentFull and body
- Header: zone-header-bg background, 2px brown border-bottom
- **No Cancel button** — only "Done" which saves content back to inline fields
- "Done" uses standard `zone-button` class (no special color)
- All action buttons in modal headers use `zone-button` class
- ESC closes the modal (after closing any open sub-menus first)

## Format Toolbar (Notes)

```css
.notes-format-toolbar {
    display: flex; flex-wrap: wrap; align-items: center;
    gap: 3px; padding: 5px 8px;
    background: rgba(139, 90, 43, 0.06);
    border: 1px solid rgba(139, 90, 43, 0.15);
    border-radius: 4px;
}
```

- Buttons: small, brown background, 1px border
- Separators: `.notes-toolbar-sep` (1px wide, 20px tall vertical line)
- Spacer: `.notes-toolbar-spacer` (flex: 1) pushes undo/redo to the right
- Hidden when in render mode (toggled by `_setNotesRenderToggleLabel`)
- Dropdown menus (Headings) use `.notes-toolbar-dropdown` with hover-reveal

## Zone Content Caps

- Tags and People zone bodies: `max-height: 100vh; overflow-y: auto`
- Tag tree in settings: `max-height: 70vh`

## Conditional Button Visibility

- Location buttons (Search, Map, Directions, Context): hidden by default, shown when location field has a value
- All Day button: hidden by default, shown when a date mode is active
- Email action buttons (Send, Reply, Forward, Expand): hidden by default, shown when email is active

## ESC Key Priority Chain

From innermost to outermost:
1. Calculator popover
2. Zone more menus (`.zone-more-menu`)
3. Send-content modal
4. Quick-alert overlay
5. QR modal
6. Delete confirmation
7. Alert modals (alarm, timer, stopwatch, notification)
8. Flatpickr date pickers
9. People expand modal
10. Notes expand modal
11. Email expand modal
12. Blur focused input
13. Exit page (with unsaved changes check)

## Icon Conventions

- Zone title icons: Emojis (📝, ✅, 🏷️, 🗺️, 📋, 🛎️, ❤️, ✉️, 👥, 📊, 🎨, 📎)
- Button icons: Font Awesome only, `far` (outline) preferred for toggles, `fas` (solid) for actions
- Never use colored emojis inside buttons — only monochrome FA icons that inherit text color
- Indicator icons on cards/headers may use emojis (🔔, ⏳, etc.)

## Health Indicators Layout

- Grid: `repeat(2, 1fr)` with 20px column gap, collapses to 1 column on mobile
- Labels: fixed 140px width, left-aligned, bold, `0.85em`
- Inputs: fixed 70px width, centered text
- BP: two inputs in a 70px wrapper with `/` separator
- Section headers: uppercase, small, brown, with bottom border
- Period/Reproductive: on its own line, conditionally shown based on sex setting
