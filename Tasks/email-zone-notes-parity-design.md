# Design Document: Email Zone — Apply Notes Zone Philosophy (App + Mobile)

## Goal

The **Notes zone** in the chit editor (both app and mobile web) has a specific button layout, toolbar philosophy, and interaction pattern that works well on small screens. The **Email zone** should follow the same system. This document defines what "same philosophy" means and what needs to change.

**Platform scope: App (Android) + Mobile (mobile web browser)**

---

## Notes Zone — The Reference Pattern

### Web Editor (Desktop + Mobile)

**Zone Header** (`zone-header`):
- Zone title: "📝 Notes"
- Zone action buttons (right side of header):
  - **Full Editor** (expand icon) — opens fullscreen modal (desktop only, hidden on mobile ≤768px)
  - **Data** (⋮ ellipsis) — dropdown menu: Copy to clipboard, Download as file, Send to another chit, Move to checklist
  - *spacer*
  - **Render** (eye icon) — toggles between edit and rendered markdown view

**Zone Body** (`zone-body`):
- **Format toolbar** (always visible in edit mode, hidden in render mode):
  - Bold, Italic, Strikethrough, Link | Heading dropdown (H1/H2/H3), Bullet List, Numbered List, Blockquote, Code
- **Textarea** — auto-growing, full-width, markdown input with `[[` chit link autocomplete
- **Rendered output** (hidden by default, shown when Render toggled)

**Mobile Web Behavior** (≤768px):
- Full Editor button hidden (zone already fills screen in mobile zone mode)
- **Bottom-pinned toolbar** appears when the textarea is focused (keyboard open):
  - Data (⋮) | Preview/Edit toggle | Undo | Redo | *separator* | scrollable: Bold, Italic, Strikethrough, Link, Heading▾, Bullet, Numbered, Block▾
  - Dropdown menus pop up above the toolbar
  - Toolbar tracks the keyboard (uses `visualViewport` resize events)
- The zone-header format toolbar is hidden on mobile; the bottom toolbar replaces it

### Android App

**Zone Structure** (inside `ChitEditorScreen`):
- Content area (scrollable, takes remaining space):
  - Either **Preview mode** (rendered markdown, tap to enter edit) or **Edit mode** (OutlinedTextField, full-width, min 8 lines)
  - Chit link autocomplete dropdown below the text field
- **Bottom toolbar** (always visible, pinned to bottom of zone):
  - **Preview mode toolbar**: Data (⋮) menu + Edit button
  - **Edit mode toolbar**: Data (⋮) menu | Preview (eye) | Undo | Redo | *scrollable*: Bold, Italic, Strikethrough, Link, Heading▾, Bullet, Numbered, Block▾
  - Toolbar uses `imePadding()` + `navigationBarsPadding()` to stay above keyboard
  - All buttons are `IconButton` with `combinedClickable` (tap = action, long-press = tooltip toast)

**Key Design Principles of the Notes Zone (App)**:
1. **Content fills the space** — the text field/preview takes all available height via `Modifier.weight(1f)`
2. **Toolbar is always at the bottom** — never scrolls away, always accessible
3. **Two modes** — Edit (text field + full toolbar) and Preview (rendered markdown + minimal toolbar)
4. **Data menu is a dropdown** — not inline buttons, keeps toolbar compact
5. **Formatting is horizontally scrollable** — fits any screen width without wrapping
6. **No header buttons for actions** — everything is in the bottom toolbar (the zone header is just the collapsible toggle handled by the parent)

---

## Current Email Zone — What Exists Today

### Web Editor

**Zone Header** buttons (all conditionally shown based on email status):
- Full Editor (expand) — opens fullscreen email modal
- PGP (lock) — toggle PGP encryption
- Send (paper plane) — send the email
- Send Later (clock) — schedule send
- Discard (trash, danger) — discard draft
- Reply (reply icon) — create reply
- Forward (share icon) — create forward
- Options (⋮) — dropdown with additional actions
- *spacer*
- Render (eye) — toggle markdown render
- Undo (↺) / Redo (↻)
- Email Activate button — make this chit an email

**Zone Body** (varies by status):
- **Draft**: From dropdown, To (with autocomplete + chips), CC/BCC toggle, Subject, Body textarea with inline format toolbar
- **Received**: From (read-only), To (read-only), CC (read-only), Subject (read-only), Body (HTML/Text toggle with iframe or plain text)
- **Sent**: Same as received but with Forward only

**Mobile Web Behavior**:
- Same zone-header buttons (many hidden via `hideWhenNarrow` spans)
- No dedicated bottom-pinned toolbar for the email body (unlike Notes)
- Format toolbar is inline above the body textarea
- On mobile, the zone-header buttons get cramped — icons only, text labels hidden

### Android App (`EmailComposeZone.kt`)

**Structure** (uses `EditorZoneHeader` for collapse):
- Header shows status badge ("Draft" / "Received" / "Sent")
- **Draft content**:
  - From dropdown (ExposedDropdownMenuBox)
  - To field (RecipientChipField with autocomplete)
  - CC/BCC toggle (TextButton) + collapsible CC/BCC fields
  - Subject (OutlinedTextField)
  - Body (OutlinedTextField, min 8 / max 20 lines)
  - Divider
  - Action buttons in Rows: Send | Later | Send & Archive | Discard
- **Received content**:
  - Read-only fields (From, To, CC, Subject)
  - HTML/Text toggle (FilterChips)
  - Body (MarkdownRenderer or plain Text)
  - Divider
  - Action buttons: Reply | Forward | Archive
- **Sent content**:
  - Read-only fields
  - Body text
  - Action buttons: Forward

**Problems with the current app Email zone**:
1. **No bottom toolbar** — action buttons are inline at the bottom of the scrollable content, not pinned
2. **No formatting toolbar** — the body textarea has no Bold/Italic/Link buttons (Notes has a full toolbar)
3. **No undo/redo** — Notes has undo/redo in the toolbar; Email doesn't
4. **No preview/render toggle** — Notes can switch between edit and rendered markdown; Email body can't
5. **Action buttons are large full-width Buttons** — Notes uses compact IconButtons in a toolbar row
6. **No Data menu** — Notes has Copy/Download/Share/Send-to-chit; Email has nothing equivalent

---

## Design: Email Zone Following Notes Philosophy

### Core Principle

The Email zone body should have the **same bottom-pinned toolbar pattern** as Notes. The email-specific fields (From, To, CC, Subject) sit above the body, and the body itself gets the same treatment as the Notes textarea: full-height, with a pinned toolbar below it.

### Layout Structure (Both Platforms)

```
┌─────────────────────────────────────────┐
│ Zone Header: ✉️ Email    [collapse ▼]   │
├─────────────────────────────────────────┤
│ From: user@example.com                  │  ← Read-only or dropdown
│ To: [chip] [chip] [input________]  CC BCC│  ← Chip field + autocomplete
│ CC: [chip] [input________]         ✕    │  ← Collapsible
│ Subject: [________________________]     │  ← Text input
├─────────────────────────────────────────┤
│                                         │
│  Body (textarea / rendered view)        │  ← Fills remaining space
│  - Markdown supported                   │
│  - Auto-grow (web) / weight(1f) (app)   │
│                                         │
├─────────────────────────────────────────┤
│ Toolbar (pinned to bottom / above kbd)  │
│ [⋮] [👁] [↺] [↻] | [B] [I] [S] [🔗] [H▾] [•] [1.] [❝▾] │
│                    ↑ scrollable →→→→→→→→→│
└─────────────────────────────────────────┘
```

### Toolbar Buttons (Bottom Bar)

The toolbar mirrors Notes exactly, with email-specific additions:

| Position | Button | Notes equivalent | Email-specific? |
|----------|--------|-----------------|-----------------|
| 1 | **Data/Actions** (⋮) | Same as Notes | Menu items differ (see below) |
| 2 | **Preview/Edit** (👁) | Same as Notes | Same behavior |
| 3 | **Undo** (↺) | Same as Notes | Same behavior |
| 4 | **Redo** (↻) | Same as Notes | Same behavior |
| *sep* | | | |
| 5+ | **Format buttons** (scrollable) | Same as Notes | Identical set |

### Data/Actions Menu (⋮) — Context-Dependent

**Draft mode:**
| Item | Icon | Action |
|------|------|--------|
| Send | ✈️ | Send the email |
| Send Later | ⏰ | Schedule send (date/time picker) |
| Send & Archive | 📦 | Send + archive |
| PGP Encrypt | 🔒 | Toggle PGP (if recipients have keys) |
| Copy body | 📋 | Copy body to clipboard |
| Discard draft | 🗑️ | Delete the draft (danger, with confirm) |

**Received mode:**
| Item | Icon | Action |
|------|------|--------|
| Reply | ↩️ | Create reply draft |
| Forward | ➡️ | Create forward draft |
| Archive | 📦 | Archive this email |
| Copy body | 📋 | Copy body to clipboard |
| Download | ⬇️ | Download as .eml or .md |
| Add sender to contacts | 👤+ | Create contact from sender |

**Sent mode:**
| Item | Icon | Action |
|------|------|--------|
| Forward | ➡️ | Create forward draft |
| Copy body | 📋 | Copy body to clipboard |
| Download | ⬇️ | Download as file |

### Preview/Edit Toggle Behavior

- **Draft**: Toggles between raw markdown textarea and rendered preview (same as Notes)
- **Received**: Toggles between HTML rendered view and plain text view (already exists as FilterChips — replace with the single toggle button for consistency)
- **Sent**: Same as received

### What Changes

#### Android App

| Current | New |
|---------|-----|
| Action buttons (Send, Later, Send & Archive, Discard) as large Buttons at bottom of scrollable content | Move all actions into the ⋮ Data menu in the bottom toolbar |
| No formatting toolbar for email body | Add the same scrollable format toolbar as Notes (Bold, Italic, etc.) |
| No undo/redo | Add Undo/Redo buttons in toolbar |
| No preview toggle | Add Preview/Edit toggle button |
| Body is `OutlinedTextField` with `minLines=8, maxLines=20` | Body becomes `weight(1f)` filling available space (same as Notes) |
| Received: FilterChips for HTML/Text toggle | Replace with single Preview button in toolbar (toggles between HTML and plain text) |
| Received: Reply/Forward/Archive as inline Buttons | Move to ⋮ menu |
| No `imePadding()` on toolbar | Add `imePadding()` + `navigationBarsPadding()` so toolbar stays above keyboard |

#### Mobile Web

| Current | New |
|---------|-----|
| Zone-header has Send, Reply, Forward, Discard, etc. as individual buttons | Keep zone-header minimal (just collapse toggle); move actions to bottom toolbar ⋮ menu |
| Inline format toolbar above body textarea | Keep for desktop; on mobile, replace with bottom-pinned toolbar (same as Notes mobile toolbar) |
| No bottom-pinned toolbar for email body | Add `mobile-email-bottom-toolbar` (same pattern as `mobile-notes-bottom-toolbar`) |
| Undo/Redo in zone-header | Move to bottom toolbar |
| Render toggle in zone-header | Move to bottom toolbar |

### What Stays the Same

- **From/To/CC/BCC/Subject fields** — same layout and behavior (chips, autocomplete, CC/BCC toggle)
- **Zone header collapse** — still collapsible with the standard zone-header click
- **Desktop web** — keeps the zone-header buttons as-is (they work fine with a mouse); the bottom toolbar is mobile-only on web (same as Notes)
- **Email thread display** — stays below the body (not affected by this change)
- **Attachment bar** — stays below the body
- **PGP banner** — stays above the body for received encrypted emails

---

## Visual Comparison

### Notes Zone (App) — Current
```
┌──────────────────────────────┐
│ [TextField: markdown input]  │  ← weight(1f), scrollable
│                              │
│                              │
├──────────────────────────────┤
│ [⋮][👁][↺][↻]|[B][I][S][🔗][H▾][•][1.][❝▾] │  ← pinned bottom
└──────────────────────────────┘
```

### Email Zone (App) — Proposed
```
┌──────────────────────────────┐
│ From: user@example.com       │
│ To: [alice] [bob] [___]  CC  │
│ Subject: [Re: Meeting]       │
├──────────────────────────────┤
│ [TextField: email body]      │  ← weight(1f), scrollable
│                              │
│                              │
├──────────────────────────────┤
│ [⋮][👁][↺][↻]|[B][I][S][🔗][H▾][•][1.][❝▾] │  ← pinned bottom
└──────────────────────────────┘
```

The only visual difference: email has the address/subject fields above the body. The body + toolbar are identical to Notes.

---

## Implementation Plan

### Phase 1: App — Add bottom toolbar to EmailComposeZone

1. Restructure `EmailComposeZone.kt` to use `Column` with:
   - Address fields (From, To, CC/BCC, Subject) in a scrollable top section
   - Body `OutlinedTextField` with `Modifier.weight(1f)`
   - Bottom toolbar Row with `imePadding()` + `navigationBarsPadding()`
2. Add format buttons (reuse the same formatting logic from NotesZone or extract to shared)
3. Add Undo/Redo state management (same pattern as NotesZone)
4. Add Preview/Edit toggle (same pattern as NotesZone)
5. Move Send/Reply/Forward/Archive/Discard into the ⋮ dropdown menu
6. For received emails: replace FilterChips with the Preview toggle button

### Phase 2: Mobile Web — Add bottom-pinned toolbar to email zone

1. Create `_createMobileEmailToolbar()` (mirror `_createMobileNotesToolbar()`)
2. Wire it to show when the email body textarea is focused
3. Move format buttons, undo/redo, preview toggle into the mobile toolbar
4. Create the ⋮ Data menu with email-specific actions (Send, Reply, etc.)
5. On mobile, hide the zone-header action buttons (they're now in the toolbar)
6. Track keyboard open/close via `visualViewport` (same as Notes)

### Phase 3: Shared formatting logic

- Extract `_emailFormatBtn()` / `_getEmailFormatAction()` into a shared utility (they're already shared between Notes and Email on web — `_notesFormatBtn` calls `_emailFormatBtn`)
- On the app, extract the formatting functions from `NotesZone` into a shared composable or utility so `EmailComposeZone` can reuse them without duplication

---

## Summary

The Notes zone's philosophy is: **content fills the space, toolbar is always accessible at the bottom, actions live in a compact menu**. The Email zone currently scatters its actions across large buttons, has no formatting toolbar, and doesn't pin anything to the bottom. This design brings Email in line with Notes by adopting the exact same toolbar pattern, making the two zones feel like siblings rather than unrelated UIs.
