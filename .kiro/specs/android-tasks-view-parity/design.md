# Technical Design: Android Tasks View Parity

## Overview

This design transforms the Android Tasks view from its current Material 3 scaffold-based layout into a pixel-perfect replica of the mobile browser (≤480px) Tasks view. The existing `TasksScreen.kt` and `TasksViewModel.kt` will be rewritten to use custom Compose components that match the web's parchment theme, header layout, Views panel, sidebar overlay, task card structure, touch gesture system, and data flow patterns.

The app already has the correct data layer (`ChitRepository`, `ChitDao`, `FilterEngine`, `SortEngine`, `FilterState`, `SortState`), theme colors (`Color.kt`), and shared components (`QuickEditSheet`, `SwipeableChitCard`). This design focuses on the UI layer changes needed to achieve visual and behavioral parity.

## Architecture

The Tasks view follows the existing MVVM pattern with Jetpack Compose. The ViewModel holds all state (tasks list, mode, sort, filter, drag state) and exposes it as StateFlows. The Compose UI layer observes these flows and renders accordingly. A new `SortOrderRepository` handles manual order persistence (SharedPreferences + server API). The existing `FilterEngine`, `SortEngine`, `FilterState`, and `SortState` are reused. The screen replaces `ChitListScaffold` with a custom layout matching the web's mobile viewport structure.

## Components and Interfaces

### Component Hierarchy

```
TasksScreen (root)
├── TasksPageShell (fixed header)
│   ├── HamburgerButton
│   ├── CwocLogo (32×32)
│   ├── TitleText ("Omni Chits")
│   ├── ProfileButton (32×32)
│   └── ViewsButton ("☰ Tasks")
├── TasksContentArea (scrollable list below header)
│   ├── TaskCard (repeated)
│   │   ├── TaskCardHeader (column: left + meta)
│   │   │   ├── HeaderLeftSection (icons + indicators + title)
│   │   │   └── HeaderMetaSection (dates, tags, RSVP, shared)
│   │   ├── TaskCardControls (status + note preview)
│   │   │   ├── StatusWrapper (icon + label + dropdown)
│   │   │   └── NotePreview (expandable markdown)
│   │   └── MapThumbnail (optional, 90×60)
│   └── EmptyState (when no tasks match)
├── ViewsPanel (slide-in from right, overlay)
│   ├── ViewsPanelBackdrop
│   └── ViewsPanelContent (header + options + close)
├── SidebarOverlay (slide-in from left, full-width)
│   ├── SidebarBackdrop
│   └── SidebarContent (close + create + mode + sort + filters + bottom)
└── DragOverlay (floating card during drag)
```

### Key Interfaces

**TasksPageShell** — Fixed header composable replacing ChitListScaffold's TopAppBar:
- Parameters: currentTabLabel, onHamburgerClick, onLogoClick, onProfileClick, onViewsClick, profileImageUrl
- Height ~50dp, background CwocHeaderBg, row layout with 8dp horizontal padding

**ViewsPanel** — Slide-in overlay from right:
- Parameters: isOpen, currentTab, onTabSelected, onClose
- AnimatedVisibility with slideInHorizontally (250ms tween)
- 240dp width, full height, parchment background

**TasksSidebar** — Full-width overlay from left:
- Parameters: isOpen, onClose, tasksMode, onModeChange, sortState, onSortChange, filterState, onFilterChange, onCreateChit, onNavigate
- AnimatedVisibility with slideInHorizontally (300ms tween)
- Full viewport width/height, parchment background

**TaskCard** — Core card composable:
- Parameters: chit, settings, sortState, onStatusChange, onDoubleTap, onLongPress, isViewerRole
- Full width, 10dp padding, 2dp border, 6dp corner radius
- Column: Header → Controls → MapThumbnail

**TouchGestureHandler** — Custom PointerInputScope extension:
- Modifier.taskCardGesture(onDragStart, onDrag, onDragEnd, onLongPress, onDoubleTap)
- 400ms hold → drag, 1200ms → long-press, 10dp slop

**DragReorderController** — State holder for drag-to-reorder:
- DragReorderState: isDragging, draggedChitId, dragOffset, placeholderIndex, cardPositions
- Auto-scroll near edges, save order on drop

**SortOrderRepository** — Manual order persistence:
- getManualOrder(tab), saveManualOrder(tab, ids), loadFromServer(), pushToServer(tab, ids)
- SharedPreferences for local, API for server sync

## Data Models

### TasksUiState (enhanced)

```kotlin
data class TasksUiState(
    val isLoading: Boolean = true,
    val tasks: List<ChitEntity> = emptyList(),
    val error: String? = null,
    val tasksMode: TasksMode = TasksMode.TASKS,
    val prerequisiteFlags: Map<String, Boolean> = emptyMap()
)

enum class TasksMode { TASKS, HABITS, ASSIGNED }
```

### DragReorderState

```kotlin
class DragReorderState {
    var isDragging: Boolean
    var draggedChitId: String?
    var dragOffset: Offset
    var placeholderIndex: Int
    var cardPositions: Map<String, Rect>
}
```

### Data Flow

```
ChitRepository → allTaskChits → FilterEngine(FilterState) → filteredChits
  → SortEngine(SortState) → ManualOrder(SortOrderRepository) → sortedChits
  → TasksUiState → TasksScreen (Compose)
```

Server is source of truth for sort preferences and manual orders. Loaded on init, persisted on change.

## Error Handling

- **Network failures on status change:** Optimistic local update, mark dirty for later sync push. Show error toast only if local write fails.
- **Network failures on sort order save:** Save locally immediately, queue server push. Server sync happens on next connectivity.
- **Invalid chit data:** Skip rendering cards with null IDs. Log warning.
- **Font loading failure:** Fall back to system serif font (Georgia equivalent).
- **Gesture conflicts:** If sidebar/views panel is open, suppress card gestures. Edge swipes only fire when the opposing panel is closed.

## Testing Strategy

- **Unit tests:** SortOrderRepository (local + server persistence), prerequisite flag computation, visual indicator string builder, default status sort ordering.
- **Compose UI tests:** TaskCard renders correct elements for various chit states, StatusDropdown shows correct styling per status, NotePreview expands/collapses, EmptyState displays correct message per mode.
- **Integration tests:** Full TasksScreen renders with mock data, sidebar opens/closes, views panel opens/closes, mode toggle switches content.
- **Manual visual parity test:** Side-by-side comparison with mobile browser on same data set.
