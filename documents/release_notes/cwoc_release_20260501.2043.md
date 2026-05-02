## Release 20260501.2043

Fixed desktop project reorder and mobile scroll jump. Project reorder now uses a simple boolean flag (_kanbanProjectDragActive) instead of checking dataTransfer.types in dragover — the flag is set in dragstart and cleared in dragend, and column dragover handlers skip when it's true. Scroll preservation now temporarily wraps displayChits to restore scroll position after the DOM is rebuilt, instead of relying on a flag checked at render time.
