## Release 20260501.2030

Fixed kanban view scroll-jumping to top after drag operations. All kanban drag handlers (card moves, grandchild moves, child reorder) now use _kanbanFetchAndPreserveScroll which saves the scroll position before fetchChits and restores it after the DOM is rebuilt in _displayProjectsKanban.
