## Release 20260511.2029

Fixed Cmd+Z in checklist editing — uses `document.execCommand('undo')` to trigger browser text undo synchronously, then falls through to checklist-level undo when there's nothing left to undo.
