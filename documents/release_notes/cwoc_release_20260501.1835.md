# Release 20260501.1835

Fixed clicking within a checklist item in edit mode to reposition the cursor. The parent element's `draggable="true"` attribute was intercepting mouse events and preventing the textarea from receiving normal click-to-position behavior. Now `draggable` is set to `false` when editing starts and restored to `true` when editing ends.
