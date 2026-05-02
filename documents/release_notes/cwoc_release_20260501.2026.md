## Release 20260501.2026

Fixed mobile kanban cross-project drag always landing in ToDo column. The dragged card's pointer-events were blocking elementFromPoint from finding the actual target column behind it, so .closest('[data-status]') was walking up to the card's original parent column instead. Added pointer-events:none on the card during drag so the finger hits the correct target column.
