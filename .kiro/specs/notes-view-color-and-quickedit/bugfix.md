# Bugfix Requirements Document

## Introduction

Two related bugs in the Notes view on the CWOC dashboard degrade usability:

1. **Note text font color bleed**: When a chit has a dark background color, `applyChitColors()` sets a light/white font color on the entire `.chit-card` element. The `.note-content` child inherits this light font color, but its background is always light (`#fff8dc`), making the note text unreadable (light text on light background).

2. **Quick-edit drag interference**: When a user Shift+clicks a note card to enter quick-edit mode (contentEditable), the `mousedown` drag handler from `enableNotesDragReorder()` is still active. Clicking inside the editable text area to reposition the cursor triggers a drag operation instead, preventing normal text cursor placement.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a chit has a dark background color (e.g., `#2b1e0f`, `#003366`) AND the Notes view renders that chit THEN the system applies a light font color (e.g., `#fdf5e6`) to the entire `.chit-card` element via `applyChitColors()`, and the `.note-content` child inherits this light font color despite having a light background (`#fff8dc`), making the note text unreadable.

1.2 WHEN a user is in quick-edit mode on a note card (contentEditable is true) AND the user clicks inside the text area to reposition the cursor THEN the system initiates a drag operation via the `mousedown` handler in `enableNotesDragReorder()` instead of allowing normal cursor placement within the editable text.

### Expected Behavior (Correct)

2.1 WHEN a chit has a dark background color AND the Notes view renders that chit THEN the system SHALL apply the contrast font color only to the card header/title row, and the `.note-content` area SHALL always use a dark font color (e.g., `#2b1e0f`) regardless of the chit's background color setting.

2.2 WHEN a user is in quick-edit mode on a note card (contentEditable is true) AND the user clicks inside the text area THEN the system SHALL allow normal text cursor placement and selection without initiating a drag operation. Drag-and-drop SHALL be disabled on that card while quick-edit is active.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a chit has a light background color THEN the system SHALL CONTINUE TO display both the title row and note content with dark font color as before.

3.2 WHEN a chit has a dark background color AND the chit is displayed in a non-Notes view (e.g., Tasks, Checklists, Calendar) THEN the system SHALL CONTINUE TO apply the full contrast font color to the entire card element as before.

3.3 WHEN a user is NOT in quick-edit mode on a note card THEN the system SHALL CONTINUE TO allow drag-and-drop reordering of note cards via mousedown as before.

3.4 WHEN a user double-clicks a note card (not in quick-edit mode) THEN the system SHALL CONTINUE TO open the chit in the editor as before.

3.5 WHEN a user Shift+clicks a note card THEN the system SHALL CONTINUE TO enter quick-edit mode, allowing inline text editing with save-on-blur and Escape-to-cancel behavior as before.

---

### Bug Condition Derivation

**Bug 1 — Note text font color:**

```pascal
FUNCTION isBugCondition_Color(X)
  INPUT: X of type { chit: Chit, view: string }
  OUTPUT: boolean

  RETURN X.view = "Notes"
     AND X.chit.color IS NOT NULL
     AND X.chit.color ≠ "transparent"
     AND isLightColor(X.chit.color) = false
END FUNCTION
```

```pascal
// Property: Fix Checking — Note content always readable
FOR ALL X WHERE isBugCondition_Color(X) DO
  noteContentEl ← renderNoteCard(X.chit).querySelector('.note-content')
  ASSERT noteContentEl.style.color = dark_color (e.g., '#2b1e0f')
END FOR
```

```pascal
// Property: Preservation Checking — Non-Notes views unchanged
FOR ALL X WHERE NOT isBugCondition_Color(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Bug 2 — Quick-edit drag interference:**

```pascal
FUNCTION isBugCondition_Drag(X)
  INPUT: X of type { noteCard: Element, isQuickEditActive: boolean }
  OUTPUT: boolean

  RETURN X.isQuickEditActive = true
END FUNCTION
```

```pascal
// Property: Fix Checking — Drag disabled during quick-edit
FOR ALL X WHERE isBugCondition_Drag(X) DO
  result ← mousedownOnNoteCard(X.noteCard)
  ASSERT result.dragInitiated = false
  ASSERT result.cursorPlacementAllowed = true
END FOR
```

```pascal
// Property: Preservation Checking — Drag works when not editing
FOR ALL X WHERE NOT isBugCondition_Drag(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
