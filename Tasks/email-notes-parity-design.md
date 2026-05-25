# Design Document: Email Client — Notes-Style Philosophy for App & Mobile

## Goal

Apply the same UI philosophy, button patterns, and interaction model used by the **Notes tab** on the Android app to the **Email client** on both **app** (Android) and **mobile** (mobile web browser). The Notes tab is the gold standard for how a list-of-cards view should feel on a small screen.

---

## Notes Tab — The Reference Pattern (Android App)

### Layout
- **Single-column staggered grid** on phones (≤600dp)
- Cards fill full width, variable height based on content
- 8dp horizontal padding, 8dp vertical spacing between cards
- No toolbar/top bar of its own — relies on the main activity header (view name via Views button)

### FAB (Floating Action Button)
- Handled by the outer `MainActivity` Scaffold (not per-screen)
- **Tap** → create new item (`onNavigateToEditor("new")`)
- **Long-press** → quick alert shortcut
- Positioned bottom-right, always visible

### Card Interactions
| Gesture | Action |
|---------|--------|
| **Tap** | Opens full editor |
| **Long-press** | Opens **QuickEditSheet** (bottom sheet: title + content editing, Save, Dismiss, "Open Full Editor") |
| **Swipe** | Not used on Notes |

### Card Content (top to bottom)
1. **Title row**: Indicator emojis (📖🔔😴🥷📦🎯🔁📎) + title text + drag handle (⋮⋮)
2. **Owner badge** (👤) — only when owner ≠ current user
3. **Assignee badge** (📌)
4. **Content preview** — first 300 chars of markdown, rendered, max 4 lines with "Show more"/"Show less" toggle
5. Full background color from chit color; declined chits at 0.5 opacity

### Filtering & Sorting
- `FilterSortViewModel` provides filter/sort state (shared across all tabs)
- Pinned items always float to top
- "No chits match filters" empty state with "Clear Filters" button

### Delete Flow
- Soft delete → **UndoToast** (countdown bar at bottom with "Undo" button, ~5s)
- Undo restores immediately; expiry finalizes + syncs

### What Notes Does NOT Have
- No swipe-to-action
- No multi-select mode
- No bulk actions bar
- No folder/sub-filter navigation
- No account filter pills
- No date group headers
- No pagination

---

## Current Email Client — What Exists Today

### Android App (EmailScreen.kt)
- Full `Scaffold` with `BundleToolbar` as `topBar`
- `LazyColumn` with `EmailCardEnhanced` items
- Swipe-to-action (right = archive, left = delete)
- Long-press → enters multi-select mode (checkbox replaces avatar)
- Context menu (EmailContextMenu): Archive, Delete, Toggle Read, Pin, Open in Editor, Add to Bundle
- Multi-select bulk actions: Select All/Cycle, Archive, Tag, Toggle Read, Delete
- Date group headers (Today, Yesterday, Last Week, Older)
- Pagination ("Load More" button)
- Undo toast for archive/delete
- Folder navigation via sidebar (inbox, sent, drafts, scheduled, trash, archived)
- Account filter pills in sidebar
- Bundle tabs in toolbar

### Mobile Web (main-email.js + responsive CSS)
- Same email card layout as desktop, but at ≤480px:
  - Body preview hidden
  - Inline attachments/tags hidden
  - Subject wraps to full width below sender
  - Hover actions hidden (replaced by swipe + long-press on touch)
- Swipe-to-action on touch devices (right = archive, left = delete)
- Bulk actions bar with select-all checkbox
- Account filter pills in sidebar
- Bundle toolbar
- Date group headers
- Pagination

---

## Design: Applying Notes Philosophy to Email

The core insight: Notes is **simple, fast, and focused**. One gesture per action, no mode switching, no complex toolbars cluttering the card list. Email needs more features than Notes (folders, multi-select, bulk actions), but the *card-level* experience should feel the same.

### Principle 1: Cards Are for Reading, Not for Operating

**Notes pattern**: Cards show content. Tap opens editor. Long-press opens quick-edit sheet. That's it.

**Email adaptation**:
- **Tap** → Opens email in reader/editor (same as today)
- **Long-press** → Opens a **QuickActionSheet** (bottom sheet, NOT a context menu dropdown)
  - This replaces the current `EmailContextMenu` (dropdown menu on long-press)
  - Bottom sheets are more thumb-friendly on mobile and match the Notes QuickEditSheet pattern

### Principle 2: Bottom Sheet as the Action Hub

The Notes `QuickEditSheet` is a bottom sheet with: title editing, content editing, Save, Dismiss, "Open Full Editor". For email, the equivalent is:

**EmailQuickActionSheet** (bottom sheet on long-press):
| Action | Icon | Description |
|--------|------|-------------|
| Reply | ↩️ | Create reply draft, navigate to compose |
| Forward | ➡️ | Create forward draft, navigate to compose |
| Archive | 📦 | Archive with undo toast |
| Delete | 🗑️ | Move to trash with undo toast |
| Mark Read/Unread | ✉️/📬 | Toggle read state |
| Pin/Unpin | 📌/📖 | Toggle pin |
| Add to Bundle | 📁 | Opens bundle picker |
| Open in Editor | ✏️ | Full chit editor |

Layout: 2-column grid of icon+label buttons (like iOS share sheet), with the email subject as the sheet title. Dismiss by swiping down or tapping outside.

### Principle 3: Swipe Stays (Email-Specific)

Notes doesn't have swipe because there's no obvious "dismiss" action for a note. Email has archive and delete as primary dismiss actions, so **swipe-to-action stays** for email:
- **Right swipe** → Archive (with undo)
- **Left swipe** → Delete (with undo)

This is additive to the Notes pattern, not contradictory — it's a shortcut for the two most common email actions.

### Principle 4: Multi-Select Enters via Checkbox, Not Long-Press

**Current problem**: Long-press on email enters multi-select mode. This conflicts with the Notes pattern where long-press = quick action sheet.

**New pattern**:
- **Long-press** → QuickActionSheet (matches Notes)
- **Multi-select** → Entered by tapping the avatar/checkbox area explicitly, OR via a "Select" button in the QuickActionSheet
- Once in multi-select mode, tapping cards toggles selection (checkboxes visible)
- Exit multi-select via "Done" button or back gesture

This separates the two concerns: long-press is always "show me actions for this one item" (like Notes), and multi-select is an explicit mode you opt into.

### Principle 5: Toolbar Stays Minimal

**Notes has no toolbar** — just the main activity header. Email needs folder tabs and bundle tabs, but they should be **as minimal as possible**:

**App (Android)**:
- **BundleToolbar** stays as the `topBar` (it's already compact)
- **Bulk actions bar** only appears when multi-select is active (already the case)
- **Folder navigation** stays in the sidebar (already the case)
- No changes needed here — the current structure is already clean

**Mobile Web**:
- **Bundle toolbar** stays above the email list (already compact)
- **Bulk actions bar** only visible when items are selected
- **Folder radio buttons** stay in sidebar
- **Account filter pills** stay in sidebar
- No changes needed to toolbar structure

### Principle 6: Card Visual Density Matches Notes

Notes cards are **content-forward**: big title, content preview, minimal chrome. Email cards should follow the same density philosophy:

**Current email card** (both platforms):
```
[Avatar] [Sender] [Reply] [Thread#] [Subject] [Preview] [Tags] [Attachments] [SmartLinks] [Date] [Pin]
```

This is already good on the app (EmailCardEnhanced). On mobile web at ≤480px, the preview is hidden and subject wraps — also fine.

**No changes to card layout** — the current email card design is already well-structured. The issue isn't the cards themselves, it's the *interaction model* around them.

### Principle 7: Undo Toast Pattern (Already Aligned)

Both Notes and Email already use the same `UndoToast` component. No changes needed.

### Principle 8: Empty States Match

Notes shows "No Notes / Notes will appear here after syncing". Email shows folder-contextual empty states. Both are already good.

---

## Implementation Summary

### Changes Required

#### Android App

| Change | File(s) | Description |
|--------|---------|-------------|
| Replace context menu with bottom sheet | `EmailScreen.kt`, new `EmailQuickActionSheet.kt` | Long-press shows bottom sheet instead of `EmailContextMenu` dropdown |
| Decouple multi-select from long-press | `EmailScreen.kt`, `EmailViewModel.kt` | Long-press → sheet; explicit checkbox tap or "Select" button → multi-select |
| Add "Select" action to bottom sheet | `EmailQuickActionSheet.kt` | Button in the sheet that enters multi-select with this item pre-selected |

#### Mobile Web

| Change | File(s) | Description |
|--------|---------|-------------|
| Replace long-press context menu with bottom sheet | `main-email.js`, new CSS in `styles-cards.css` | Long-press shows a bottom sheet (`.email-quick-action-sheet`) instead of browser context menu or custom dropdown |
| Decouple multi-select from long-press | `main-email.js` | Long-press → sheet; explicit checkbox click → multi-select |
| Add "Select" action to bottom sheet | `main-email.js` | Button in the sheet that enters multi-select |
| Bottom sheet CSS | `styles-cards.css` | Slide-up sheet with 2-column action grid, parchment theme |

### What Stays the Same (No Changes)

- Card layout and visual design (both platforms)
- Swipe-to-action (both platforms)
- Bundle toolbar (both platforms)
- Folder navigation in sidebar (both platforms)
- Account filter pills (both platforms)
- Date group headers (both platforms)
- Pagination (both platforms)
- Undo toast (both platforms)
- Bulk actions bar when in multi-select (both platforms)
- FAB for compose (app)
- Tap-to-open behavior (both platforms)
- Pin button on card (app — stays as inline icon button)

---

## Visual Mockup: EmailQuickActionSheet

```
┌─────────────────────────────────────────┐
│  ━━━━━  (drag handle)                   │
│                                         │
│  Re: Meeting tomorrow                   │  ← Subject as title
│  From: john@example.com                 │  ← Sender context
│                                         │
│  ┌─────────┐  ┌─────────┐              │
│  │  ↩️     │  │  ➡️     │              │
│  │  Reply  │  │ Forward │              │
│  └─────────┘  └─────────┘              │
│  ┌─────────┐  ┌─────────┐              │
│  │  📦     │  │  🗑️     │              │
│  │ Archive │  │ Delete  │              │
│  └─────────┘  └─────────┘              │
│  ┌─────────┐  ┌─────────┐              │
│  │  ✉️     │  │  📌     │              │
│  │Mk Unread│  │  Pin    │              │
│  └─────────┘  └─────────┘              │
│  ┌─────────┐  ┌─────────┐              │
│  │  📁     │  │  ☑️     │              │
│  │ Bundle  │  │ Select  │              │
│  └─────────┘  └─────────┘              │
│  ┌─────────────────────────┐            │
│  │  ✏️  Open in Editor     │            │  ← Full-width at bottom
│  └─────────────────────────┘            │
└─────────────────────────────────────────┘
```

---

## Migration Path

This is a **behavioral change**, not a visual redesign. The cards look the same, the features are the same — only the *gesture mapping* changes:

1. **Phase 1**: Build `EmailQuickActionSheet` (app) and `.email-quick-action-sheet` (mobile web)
2. **Phase 2**: Wire long-press to show the sheet instead of context menu / entering multi-select
3. **Phase 3**: Add explicit multi-select entry point (checkbox tap + "Select" in sheet)
4. **Phase 4**: Remove old context menu code (app: `EmailContextMenu` usage in `EmailScreen`, mobile web: long-press → multi-select logic)

Each phase is independently deployable. The user can test after each phase.

---

## Platform Scope

- **App** (Android): Yes — primary target
- **Mobile** (mobile web browser): Yes — primary target
- **Web** (desktop browser): No changes — desktop has hover actions which work well with a mouse. The bottom sheet pattern is touch-specific.
