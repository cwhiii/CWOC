## Release 20260501.2047

Fixed desktop project master reorder. The wrapper's dragover handler was also using e.dataTransfer.types.includes() which fails on DOMStringList. Replaced with the same _kanbanProjectDragActive boolean flag used by the column handlers.
