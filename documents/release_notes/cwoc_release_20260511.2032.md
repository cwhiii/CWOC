## Release 20260511.2032

Fixed undo requiring two clicks after deleting a checklist item — deleteItem no longer calls _notifyChange (which was pushing a duplicate post-delete state onto the undo stack).
