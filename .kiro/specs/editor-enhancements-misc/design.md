# Design Document

## Overview

This design covers the implementation of 19 missing/partial web functions for Android parity across editor enhancements and miscellaneous features. Tasks span checklist clipboard operations, inline markdown in checklist items, notes list auto-continuation, indicator chart reordering, RSVP status utilities, project context menus with child-chit moves, contact editor save-and-stay, and attachment grid enhancements.

The existing Android infrastructure provides strong foundations: `ChecklistZoneV2` with full item management, undo/redo, and drag-reorder; `ChecklistZoneViewModel` with state management and auto-save; `IndicatorsScreen` with chart rendering; `ContactEditorViewModel` with save logic; `AttachmentsViewModel` with multi-select; `CustomObjectsViewModel` with zone CRUD; and `MarkdownRenderer` with inline formatting support.

Several features require re-verification (Requirements 1 and 2) as the gap files note that the Android code may already implement them. The remaining features require new code: clipboard operations, inline markdown for checklist items, notes list continuation, indicator drag-reorder, RSVP utilities, project context menu, save-and-stay, and chit title on attachment cards.

## Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Layer (Compose)                           │
├─────────────────────────────────────────────────────────────────────┤
│ ChecklistZoneV2                                                      │
│   ├── PasteAsItems menu action (Req 3)                              │
│   ├── CopyIncomplete menu action (Req 3)                            │
│   └── InlineMarkdownText for item display (Req 4)                   │
│                                                                      │
│ NotesZone                                                            │
│   └── ListContinuationHandler (Req 5 - Enter key interception)      │
│                                                                      │
│ IndicatorsScreen                                                     │
│   └── DraggableChartList (Req 6 - long-press drag reorder)          │
│                                                                      │
│ ProjectsScreen / KanbanBoard                                         │
│   ├── ProjectContextMenu (Req 8 - long-press on project card)       │
│   └── MoveToProjectDialog (Req 8 - project picker for child move)   │
│                                                                      │
│ ContactEditorScreen                                                   │
│   └── SaveAndStay action button (Req 9)                             │
│                                                                      │
│ AttachmentsScreen                                                     │
│   └── AttachmentCard with chit title (Req 10)                       │
├─────────────────────────────────────────────────────────────────────┤
│                       ViewModel Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ChecklistZoneViewModel                                               │
│   ├── pasteFromClipboard(clipboardText) — NEW                       │
│   └── copyIncompleteToClipboard() — NEW                             │
│                                                                      │
│ IndicatorsViewModel                                                  │
│   ├── chartOrder: StateFlow<List<String>> — NEW                     │
│   ├── reorderChart(fromIndex, toIndex) — NEW                        │
│   └── loadChartOrder() / saveChartOrder() — NEW                     │
│                                                                      │
│ ProjectsViewModel                                                    │
│   └── moveChildToProject(childId, sourceProjectId, targetProjectId) │
│                                                                      │
│ ContactEditorViewModel                                                │
│   └── saveAndStay() — NEW (saves without setting _isSaved = true)   │
│                                                                      │
│ AttachmentsViewModel                                                  │
│   └── attachments list gains chitTitle field — MODIFIED              │
├─────────────────────────────────────────────────────────────────────┤
│                       Domain Layer                                    │
├─────────────────────────────────────────────────────────────────────┤
│ ChecklistClipboardParser — parse clipboard text into checklist items  │
│ InlineMarkdownParser — render inline md for checklist item text       │
│ NotesListContinuation — detect list prefix and generate continuation  │
│ RsvpStatusUtil — extract user RSVP status from shares JSON            │
├─────────────────────────────────────────────────────────────────────┤
│                       Data Layer                                      │
├─────────────────────────────────────────────────────────────────────┤
│ SharedPreferences — indicator chart order persistence                 │
│ ChitRepository — project child_chits updates for move operation       │
│ ContactRepository — save without navigation trigger                   │
│ AttachmentsRepository — include chit title in attachment listing       │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Components

- **ChecklistClipboardParser** (`domain/checklist/ChecklistClipboardParser.kt`) — Pure utility object with `parseClipboardText(text: String): List<ChecklistItem>` that splits text by newlines, strips list markers, detects indent levels, parses checkbox state, and assigns parent relationships.
- **InlineMarkdownText** (`ui/components/InlineMarkdownText.kt`) — Composable that renders a single line of text with inline markdown (bold, italic, strikethrough, code, links) using `buildAnnotatedString`. Lighter-weight than the full `MarkdownRenderer` — no block-level elements.
- **NotesListContinuation** (`domain/editor/NotesListContinuation.kt`) — Pure utility object with `getListContinuation(textBeforeCursor: String): ListContinuationResult?` that detects list prefixes and returns the continuation string or a "remove prefix" instruction.
- **RsvpStatusUtil** (`domain/sharing/RsvpStatusUtil.kt`) — Pure utility object with `getUserRsvpStatus(shares: String?, currentUserId: String): String?` and `isDeclinedByCurrentUser(shares: String?, ownerId: String?, currentUserId: String): Boolean`.
- **ProjectContextMenu** (`ui/components/ProjectContextMenu.kt`) — DropdownMenu composable shown on long-press of a project card with standard project actions.
- **MoveToProjectDialog** (`ui/components/MoveToProjectDialog.kt`) — AlertDialog composable showing a list of project masters for the user to select as the move target.

### Modified Interfaces

- **ChecklistZoneViewModel** — New methods: `pasteFromClipboard(text: String)` (parses and appends items with undo support), `copyIncompleteToClipboard(): String` (returns formatted text for clipboard write). New menu actions exposed to the composable.
- **ChecklistZoneV2** — Modified: item text display uses `InlineMarkdownText` instead of plain `Text`. Menu gains "Paste as Items" and "Copy Incomplete" actions.
- **NotesZone** (in ChitEditorScreen or a dedicated composable) — Modified: `TextField` `onValueChange` or key event handler intercepts Enter key and applies list continuation logic.
- **IndicatorsViewModel** — New state: `chartOrder: StateFlow<List<String>>`. New methods: `reorderChart(from: Int, to: Int)`, `loadChartOrder()`, `saveChartOrder()`.
- **IndicatorsScreen** — Modified: chart list uses a reorderable lazy column (long-press + drag gesture).
- **ProjectsViewModel** — New method: `moveChildToProject(childChitId: String, sourceProjectId: String, targetProjectId: String)`.
- **ContactEditorViewModel** — New method: `saveAndStay()` that calls the save API but does NOT set `_isSaved = true`, allowing the user to remain on the screen.
- **ContactEditorScreen** — Modified: top bar gains a second save action (save-and-stay alongside save-and-exit).
- **AttachmentsViewModel** / **AttachmentItem** — Modified: `AttachmentItem` data class gains `chitTitle: String?` and `chitId: String?` fields. The fetch logic joins or includes chit title data.

## Data Models

### ChecklistItem (Existing — No Changes)
```kotlin
data class ChecklistItem(
    val id: String,
    val text: String,
    val checked: Boolean = false,
    val level: Int = 0,
    val parent: String? = null
)
```

### ListContinuationResult
```kotlin
data class ListContinuationResult(
    val action: ListAction,        // CONTINUE or REMOVE_PREFIX
    val prefix: String,            // The prefix to insert (for CONTINUE) or remove (for REMOVE_PREFIX)
    val prefixLength: Int          // Length of the prefix on the current line (for REMOVE_PREFIX)
)

enum class ListAction { CONTINUE, REMOVE_PREFIX }
```

### AttachmentItem (Modified)
```kotlin
data class AttachmentItem(
    val id: String,
    val filename: String,
    val mimeType: String,
    val size: Long,
    val createdAt: String,
    val url: String,
    val chitId: String?,           // NEW — parent chit ID
    val chitTitle: String?         // NEW — parent chit title for display
)
```

### Existing Models (No Changes)
- `ChitEntity` — already has `shares`, `child_chits`, `is_project_master`, `owner_id`
- `ContactEntity` — already has all contact fields
- `SettingsEntity` — already has indicator-related settings

## Error Handling

- **Clipboard access denied (Android):** Show toast "Clipboard access denied". Android 10+ restricts background clipboard access, but foreground access from a user action (menu tap) is always allowed.
- **Paste produces zero items:** No action, no toast (clipboard was empty or all-whitespace lines).
- **Move child to project fails:** Show error toast "Move failed", revert local state (re-add to source, remove from target).
- **Save-and-stay fails:** Show error toast "Save failed", keep editor open with all changes intact.
- **Indicator order persistence fails:** Retain visual order in current session; order will reset on next app launch.
- **Chit title unavailable for attachment:** Display "Unknown chit" placeholder, disable tap navigation.
- **RSVP shares JSON malformed:** Return null (treat as no RSVP status), log parse error.

## Testing Strategy

Tests are optional per project rules. No test-writing tasks are included. The implementation can be verified manually by:
1. Verifying custom objects zone management works (create/rename/delete zones, assign/reorder objects)
2. Verifying attachment multi-select and bulk delete works (long-press, tap to toggle, delete selected)
3. Copying multi-line text to clipboard, tapping "Paste as Items" in checklist, verifying items appear with correct indent/checked state
4. Tapping "Copy Incomplete" and pasting elsewhere to verify markdown checklist format
5. Adding bold/italic/links to checklist item text and verifying rendered display
6. Typing a list in notes, pressing Enter, verifying auto-continuation; pressing Enter on empty bullet to end list
7. Long-pressing indicator charts and dragging to reorder; restarting app to verify persistence
8. Sharing a chit, declining it from another user, verifying it's filtered/greyed in views
9. Long-pressing a project card and verifying context menu options work
10. Long-pressing a child chit in Kanban, selecting "Move to Project", picking a target, verifying move
11. Tapping "Save" in contact editor and verifying the editor stays open with saved state
12. Viewing attachments grid and verifying chit titles appear and are tappable
