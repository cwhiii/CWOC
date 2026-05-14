# CWOC UI Popups & Notifications Audit

This document catalogs all types of popups, modals, notifications, confirmations, and similar UI feedback elements in CWOC.

## 1. Confirmation Modals

### cwocConfirm (Primary Confirmation System)
- **Location**: `shared-utils.js`
- **Style**: Parchment-themed modal with title, message, Cancel/Confirm buttons
- **Features**: 
  - Promise-based API
  - Danger styling option (red confirm button)
  - HTML content support
  - ESC to cancel
  - Click outside to cancel
- **Usage**: Delete confirmations, destructive actions, important decisions
- **Examples**:
  - Delete chit: "Are you sure you want to delete this chit?"
  - Delete project: "Delete this project?"
  - Delete attachment: "Delete attachment 'filename'?"
  - Delete contact: "Are you sure you want to permanently delete this contact?"
  - Reset sort orders: "This will clear all saved sort preferences..."
  - Data import: "This will permanently replace all data..."

### Legacy Delete Modals (HTML-based)
- **Location**: Various HTML files
- **Elements**: `#deleteChitModal`, `#deleteEmailAccountModal`
- **Style**: Fixed positioned overlays with parchment styling
- **Status**: Being phased out in favor of `cwocConfirm`

## 2. Toast Notifications

### cwocToast (Primary Toast System)
- **Location**: `shared-utils.js`
- **Types**: Success (green), Error (red), Info (brown)
- **Features**:
  - Auto-dismiss with configurable duration
  - Click to dismiss early
  - Top-center positioning
  - Fade in/out animations
  - Persistent option (duration=0) with X button
- **Usage**: Action feedback, status updates, error messages
- **Examples**:
  - "Saved!" (success)
  - "Export failed: error message" (error)
  - "Tag already exists" (info)
  - "5 emails archived" (success)

### Specialized Undo Toasts
- **Location**: `shared.js`
- **Functions**: `_showDeleteUndoToast`, `_showArchiveUndoToast`, `_showSnoozeUndoToast`
- **Features**:
  - 5-second countdown with progress bar
  - Undo button to reverse action
  - Custom messages for different action types
  - Auto-execute action when timer expires
- **Usage**: Reversible actions like delete, archive, snooze
- **Examples**:
  - "🗑️ Deleted: Chit Title [Undo]"
  - "📦 Archived: Chit Title [Undo]"
  - "😴 Snoozed: Chit Title until 3:00 PM [Undo]"

### Email Undo Toast
- **Location**: `main-email.js`
- **Function**: `_emailUndoToast`
- **Features**: Similar to delete undo but email-specific styling
- **Usage**: Email archive/delete actions

### Email Send Undo Toast
- **Location**: `editor-email.css`, `main-email.js`
- **Features**: Special toast for canceling email sends in progress
- **Usage**: "Send cancelled" feedback

## 3. Input Modals

### cwocPromptModal (Styled Input Modal)
- **Location**: `shared-utils.js`
- **Features**:
  - Replaces browser `prompt()`
  - Parchment styling
  - Default value support
  - Enter to confirm, ESC to cancel
- **Usage**: Text input for creating tags, names, etc.

### Tag Creation Modal
- **Location**: `shared-tag-modal.js`
- **Features**: Complex modal for creating/editing tags with color picker
- **Usage**: Tag management

## 4. QR Code Modals

### showQRModal (Universal QR Display)
- **Location**: `shared-qr.js`
- **Features**:
  - Full-screen overlay
  - QR code generation via qrcode.js
  - Title and info text
  - Click outside or ESC to close
- **Usage**: Share chits, contacts, links
- **Examples**:
  - "🔗 Link QR Code" (chit links)
  - "📦 Data QR Code" (chit data)
  - "Share: Contact Name" (vCard sharing)

## 5. Specialized Modals

### Notes Modal (Full-Screen Editor)
- **Location**: `editor.css`, various JS files
- **Element**: `#notesModal`
- **Features**: Full-screen markdown editor with live preview
- **Usage**: Expanded note editing

### Email Expand Modal
- **Location**: `editor-email.css`
- **Features**: Full-screen email composition/viewing
- **Usage**: Detailed email work

### People Expand Modal
- **Location**: `editor.css`
- **Features**: Full-screen contact management
- **Usage**: Contact selection and management

### Thread Picker Modal
- **Location**: `editor-nest.css`
- **Features**: Modal for selecting parent threads when nesting chits
- **Usage**: Chit nesting/threading

### Attachment Preview Modal
- **Location**: `attachments.html`
- **Features**: Preview images and file details
- **Usage**: Attachment viewing

### Custom Filter Modal
- **Location**: `settings.html`
- **Features**: Complex filtering interface
- **Usage**: Advanced search/filtering

### Update Modal
- **Location**: `settings.html`, `settings-version.js`
- **Features**: System update progress with terminal output
- **Usage**: CWOC updates

### Release Notes Modal
- **Location**: `settings.html`
- **Features**: Paginated release notes viewer
- **Usage**: Version history

## 6. Overlay Systems

### Mobile Zone List Overlay
- **Location**: `editor.css`
- **Features**: Slide-from-right zone navigation on mobile
- **Usage**: Mobile zone switching

### Modal Overlay Base Classes
- **Location**: Various CSS files
- **Classes**: `.cwoc-modal-overlay`, `.modal-overlay`, `.att-modal-overlay`
- **Features**: Consistent overlay backdrop styling

## 7. Progress & Status Indicators

### Loading States
- **Location**: Various files
- **Features**: Button disabled states, "Loading..." text
- **Usage**: Form submissions, API calls

### Checklist Progress Counts
- **Location**: `editor_projects.js`
- **Features**: "3/5 ✓" style progress indicators
- **Usage**: Checklist completion status

### Email Sync Status
- **Location**: `main-email.js`
- **Features**: "Checking mail..." status updates
- **Usage**: Email synchronization feedback

## 8. Contextual Popups

### Send Item Popup
- **Location**: `editor.css`
- **Features**: Per-item quick send options
- **Usage**: Individual checklist item actions

### Snooze Presets
- **Location**: `editor.css`
- **Features**: Quick snooze time selection
- **Usage**: Chit snoozing

## 9. Alert & Notification Systems

### Browser Notifications (PWA)
- **Location**: Various files
- **Features**: Native browser notifications for alarms/timers
- **Usage**: Time-based alerts

### Ntfy Push Notifications
- **Location**: `settings.html`, backend
- **Features**: Phone push notifications via Ntfy service
- **Usage**: Remote notifications

### In-App Alert Indicators
- **Location**: `shared-indicators.js`
- **Features**: Visual indicators on chit cards (🔔, 📢, ⏱️, etc.)
- **Usage**: Alert status display

## 10. Error & Validation Feedback

### Form Validation Messages
- **Location**: Various forms
- **Features**: Inline error text, field highlighting
- **Usage**: Form validation feedback

### Network Error Handling
- **Location**: Various API calls
- **Features**: Toast notifications for failed requests
- **Usage**: Connection/server error feedback

## 11. Accessibility & ESC Handling

### ESC Key Priority Chain
1. Close QR modal
2. Close upgrade/update modal  
3. Close tag modal
4. Close delete confirm
5. Close unsaved-changes modal
6. Blur focused input
7. Exit page (with save check)

### Modal Focus Management
- Auto-focus on confirm buttons
- Tab trapping within modals
- Return focus on close

---

## 12. Consolidation Recommendations

The goal: reduce the number of distinct feedback mechanisms to a small, universal set of shared functions. Anything that looks and behaves the same should BE the same code.

### Proposed Core Set (5 Functions)

After consolidation, CWOC should have exactly **5 shared feedback primitives** that cover every use case:

| # | Function | Purpose | Position |
|---|----------|---------|----------|
| 1 | `cwocConfirm()` | Yes/No decisions | Center overlay |
| 2 | `cwocToast()` | Ephemeral status messages | Top center |
| 3 | `cwocUndoToast()` | Reversible actions with countdown | Bottom center |
| 4 | `cwocPromptModal()` | Text input from user | Center overlay |
| 5 | `cwocModal()` | Complex content modals (notes, previews, pickers) | Center overlay |

Everything else either folds into one of these five, or is a legitimate specialized UI component (like the QR modal or full-screen editors) that isn't really a "notification" — it's a page-level feature.

---

### What Gets Consolidated

#### A. Merge all undo toasts into one `cwocUndoToast()`

**Current state**: 4 near-identical implementations
- `_showDeleteUndoToast` (shared.js) — the "real" one
- `_showArchiveUndoToast` (shared.js) — thin wrapper, already delegates
- `_showSnoozeUndoToast` (shared.js) — thin wrapper, already delegates
- `_emailUndoToast` (main-email.js) — **copy-paste duplicate** with different CSS class names
- `_emailShowUndoSendBar` (main-email.js) — another copy with configurable duration

**Problem**: `_emailUndoToast` and `_emailShowUndoSendBar` are structurally identical to `_showDeleteUndoToast` but use different element IDs and CSS classes (`email-undo-toast` vs `cwoc-undo-toast`). The only meaningful difference is that `_emailShowUndoSendBar` reads a configurable delay from settings.

**Recommendation**: Create one `cwocUndoToast(message, opts)` in `shared-utils.js`:
```js
function cwocUndoToast(message, opts) {
  // opts: { duration: 5000, onExpire: fn, onUndo: fn, id: 'unique-id' }
}
```
- `_showArchiveUndoToast` and `_showSnoozeUndoToast` become one-liner wrappers that format the message and call `cwocUndoToast`
- `_emailUndoToast` and `_emailShowUndoSendBar` get deleted entirely — callers use `cwocUndoToast` directly
- One CSS class (`.cwoc-undo-toast`) with one set of responsive rules — delete the duplicate `.email-undo-toast` and `.email-undo-send-toast` CSS
- The `id` option allows multiple undo toasts to coexist (e.g. one for email send, one for a delete) without clobbering each other

#### B. Kill inline feedback functions — use `cwocToast` instead

**Current state**: Multiple one-off inline feedback patterns
- `_tsFeedback()` (settings-integrations.js) — Tailscale status messages in a dedicated `<div>`
- `_ntfyFeedback()` (settings-integrations.js) — Ntfy status messages in a dedicated `<div>`
- `_showAdminMessage()` (user-admin.js) — admin page inline messages
- `#pwa-notif-status` textContent updates (settings-integrations.js)
- `#tailscale-error-msg` inline error display

**Problem**: These are all "show the user a status message" but each one is a bespoke implementation targeting a specific DOM element. They exist because the developer wanted the message *near* the relevant control rather than at the top of the screen.

**Recommendation**: Two options (pick one):

**Option A (simpler)**: Just use `cwocToast()` for all of these. The user doesn't need the message pinned next to the button — they just need to know it worked or didn't. This eliminates 5+ custom functions.

**Option B (if proximity matters)**: Add an optional `anchor` parameter to `cwocToast`:
```js
cwocToast('Tailscale connected.', 'success', { anchor: '#tailscale-section' });
```
This would position the toast near the specified element instead of top-center. Same function, same styling, just different placement. But honestly, Option A is probably fine — these are all settings-page actions where a top-center toast is perfectly adequate.

#### C. Merge the "auto-fade" modals into `cwocToast`

**Current state**: 
- `#duplicate-tag-modal` — shows for 2 seconds then fades out via CSS animation
- `#reserved-tag-modal` — same pattern
- `#cwoc-tag-modal-dup` (shared-tag-modal.js) — same pattern again

**Problem**: These are toasts pretending to be modals. They show a brief message and auto-dismiss. They use a `modal` class with a `fadeOut` CSS animation, but they don't require user interaction — they're purely informational.

**Recommendation**: Replace all of these with `cwocToast('Tag already exists', 'info')` or `cwocToast('Reserved tag prefix', 'error')`. Delete the HTML elements and their CSS. This is the most obvious consolidation — these are literally just toasts with extra steps.

#### D. Standardize the unsaved-changes modal

**Current state**: The `#cwoc-unsaved-modal` is built from scratch in at least 4 places:
- `shared-page.js` (CwocSaveSystem)
- `editor-save.js` (_navigateWithSaveCheck)
- `editor-send-item.js`
- `editor-prerequisites.js`

Each one creates the same DOM structure with Save/Discard/Cancel buttons.

**Problem**: Same modal, built 4 times. If you change the styling or button labels, you have to find all 4.

**Recommendation**: Create `cwocUnsavedModal(opts)` in `shared-utils.js`:
```js
function cwocUnsavedModal(opts) {
  // opts: { onSave: fn, onDiscard: fn, onCancel: fn, message: '...' }
  // Returns a promise resolving to 'save' | 'discard' | 'cancel'
}
```
All 4 call sites become one-liners. One source of truth for the DOM structure and styling.

#### E. Unify modal overlay CSS

**Current state**: 3+ overlay class names doing the same thing:
- `.cwoc-modal-overlay` (editor-nest.css, settings.html)
- `.modal-overlay` (editor.css)
- `.att-modal-overlay` (attachments.html)
- `.cwoc-prompt-modal-overlay` (inline in shared-utils.js)
- `.cwoc-people-expand-overlay` (editor.css)

**Problem**: Same fixed-position, semi-transparent backdrop, defined in multiple places with slightly different names.

**Recommendation**: One class: `.cwoc-overlay`. Defined once in `shared-page.css`. All modals use it. Delete the duplicates.

#### F. Legacy HTML modals → `cwocConfirm`

**Current state**:
- `#deleteChitModal` (editor.html) — full HTML modal with its own CSS
- `#deleteEmailAccountModal` (settings.html) — another full HTML modal
- `#delete-modal` (settings.html) — yet another

**Problem**: These predate `cwocConfirm` and do the exact same thing with more code.

**Recommendation**: Delete the HTML elements and their CSS. Replace the JS that shows them with `cwocConfirm()` calls. This is already partially done (most delete actions use `cwocConfirm` now) — just finish the migration.

---

### What Stays As-Is (Legitimately Distinct)

These are NOT redundant — they serve genuinely different purposes:

| Component | Why it's distinct |
|-----------|-------------------|
| `showQRModal()` | Renders a QR code — unique content type |
| Notes full-screen modal | Full editor workspace, not a notification |
| Email expand modal | Full composition workspace |
| People expand modal | Full management workspace |
| Thread picker modal | Selection UI with search/filter |
| Quick Alert modal | Complex multi-step creation flow |
| Update modal | Live terminal output stream |
| Mobile zone overlay | Navigation UI, not feedback |
| Browser/Ntfy notifications | External system integrations |
| Snooze presets popup | Selection menu, not feedback |
| Send item popup | Action menu, not feedback |

These are all **feature UIs**, not feedback mechanisms. They happen to use overlays, but they're not interchangeable with toasts or confirms.

---

### Migration Priority

1. **Highest impact, lowest effort**: Merge `_emailUndoToast` / `_emailShowUndoSendBar` into the shared undo toast. These are literal copy-pastes.
2. **Quick wins**: Replace `#duplicate-tag-modal` / `#reserved-tag-modal` with `cwocToast` calls. Delete dead HTML.
3. **Medium effort**: Extract `cwocUnsavedModal` from the 4 duplicate implementations.
4. **Cleanup**: Migrate remaining legacy HTML modals (`#deleteChitModal`, `#deleteEmailAccountModal`) to `cwocConfirm`.
5. **CSS cleanup**: Unify overlay classes to `.cwoc-overlay`.
6. **Optional**: Decide whether inline feedback (`_tsFeedback`, `_ntfyFeedback`) should become `cwocToast` or stay as-is (they work fine, they're just not shared).

---

### After Consolidation: The Final API

```
shared-utils.js exports:
├── cwocConfirm(message, opts)        → Promise<boolean>
├── cwocToast(message, type, duration) → void
├── cwocUndoToast(message, opts)      → void  (NEW — replaces 4 functions)
├── cwocPromptModal(title, placeholder, onConfirm, opts) → void
└── cwocUnsavedModal(opts)            → Promise<'save'|'discard'|'cancel'>  (NEW)

shared-qr.js exports:
└── showQRModal(opts)                 → HTMLElement

Everything else is a feature-specific modal (notes, email, people, etc.)
that lives in its own file and isn't a "notification" — it's a workspace.
```

This takes the current ~15 distinct feedback mechanisms down to **5 universal functions** plus the QR modal. Every page, every feature, same API, same styling, one place to maintain.