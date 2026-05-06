# Release 20260505.1905

Simplified the editor tag zone: removed the X/clear button and + Add button, replaced with a single text input that filters the tag tree as-you-type. Extracted tag zone CSS (`.tags-search-row`, `.tag-container`, `.tag-container-Active`, `.verticalBox`) from `editor.css` into `shared-editor.css` so both the chit editor and settings page share consistent styling.
