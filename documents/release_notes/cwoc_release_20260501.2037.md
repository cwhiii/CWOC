## Release 20260501.2037

Fixed three kanban drag issues: (1) Desktop project reorder — used cross-browser DOMStringList check for dragover type filtering instead of Array.includes. (2) Mobile card column targeting — elementFromPoint now runs BEFORE restoring pointer-events so it finds the target column, not the dragged card's original parent. (3) Mobile project reorder — added pointer-events:none on the dragged project box during drag so elementFromPoint finds the target box behind it, not the dragged box itself.
