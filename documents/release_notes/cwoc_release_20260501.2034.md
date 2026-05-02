## Release 20260501.2034

Fixed two kanban issues: (1) Desktop project reorder was broken because status column dragover handlers were unconditionally calling preventDefault, intercepting the project-reorder drag before it reached the wrapper's drop handler. Added a check to skip project-reorder drags. (2) Improved scroll preservation after kanban drag operations — now sets scrollTop synchronously on the wrapper element plus rAF and setTimeout fallbacks.
