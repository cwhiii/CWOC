## 20260501.2119

Fixed project master reorder on mobile (kanban and list views) jumping to the top of the page after each move. The scroll position is now saved before `displayChits()` rebuilds the DOM and restored afterward.
