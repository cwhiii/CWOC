# Requirements Document

## Introduction

A simple, movable calculator popover that floats on top of all page content. It is triggered by a global hotkey available on every page for quick arithmetic, and includes an "Insert Result" button that drops the current value into the input field that had focus when the hotkey was pressed (insert only works in the chit editor). A "Persist" checkbox keeps the calculator wired to the field and auto-updates it as the result changes. Built from scratch in vanilla JS/CSS with no external dependencies, following CWOC's layered ESC key pattern.

## Glossary

- **Calculator_Popover**: A draggable floating panel containing a calculator UI that renders above all other page content
- **Hotkey**: A keyboard shortcut that opens or closes the Calculator_Popover; available on all CWOC pages
- **Source_Field**: The input, textarea, or contenteditable element that held focus at the moment the Hotkey was pressed
- **Insert_Button**: A button within the Calculator_Popover that writes the current calculator result into the Source_Field
- **Persist_Checkbox**: A checkbox within the Calculator_Popover that, when enabled, automatically updates the Source_Field whenever the calculator result changes
- **Calculator_Display**: The read-only area within the Calculator_Popover showing the current expression and result
- **ESC_Chain**: The layered Escape key handling pattern used throughout CWOC, where ESC closes the topmost overlay before propagating to lower layers
- **Editor_Page**: The chit editor page served from `editor.html`
- **Dashboard_Page**: The main dashboard page served from `index.html`

## Requirements

### Requirement 1: Open and Close via Hotkey

**User Story:** As a user, I want to press a hotkey to open a calculator anywhere in CWOC, so that I can quickly perform arithmetic without leaving the current page.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+Shift+C on any CWOC page, THE Calculator_Popover SHALL open and become visible above all other content
2. WHEN the Calculator_Popover is open and the user presses Ctrl+Shift+C, THE Calculator_Popover SHALL close and be removed from view
3. WHEN the Hotkey is pressed, THE Calculator_Popover SHALL record the currently focused input element as the Source_Field before opening
4. THE Calculator_Popover SHALL be available on the Dashboard_Page, the Editor_Page, and all secondary pages (settings, people, weather, help, trash, audit-log, maps, contact-editor)

### Requirement 2: Draggable Positioning

**User Story:** As a user, I want to drag the calculator to any position on screen, so that it does not obscure the content I am working with.

#### Acceptance Criteria

1. THE Calculator_Popover SHALL include a drag handle area (the title bar) that the user can click and drag to reposition the popover
2. WHILE the user drags the Calculator_Popover, THE Calculator_Popover SHALL follow the pointer position smoothly without lag
3. WHEN the user releases the drag, THE Calculator_Popover SHALL remain at the released position
4. THE Calculator_Popover SHALL remain fully within the visible viewport boundaries during and after dragging
5. THE Calculator_Popover SHALL support drag on both mouse and touch devices

### Requirement 3: Calculator Operations

**User Story:** As a user, I want to perform basic arithmetic (add, subtract, multiply, divide), so that I can compute values without an external calculator.

#### Acceptance Criteria

1. THE Calculator_Popover SHALL provide buttons for digits 0–9, decimal point, addition (+), subtraction (−), multiplication (×), and division (÷)
2. THE Calculator_Popover SHALL provide a Clear (C) button that resets the current expression and result to zero
3. THE Calculator_Popover SHALL provide an Equals (=) button that evaluates the current expression and displays the result
4. WHEN the user presses Equals, THE Calculator_Display SHALL show the computed result of the current arithmetic expression
5. IF the user divides by zero, THEN THE Calculator_Display SHALL show an error indicator rather than a numeric result
6. THE Calculator_Popover SHALL support keyboard input for digits, operators (+, -, *, /), Enter (equals), Escape (close), and Backspace (delete last character) while the popover has focus
7. THE Calculator_Popover SHALL evaluate expressions using standard arithmetic precedence (multiplication and division before addition and subtraction)

### Requirement 4: Insert Result into Source Field

**User Story:** As a user editing a chit, I want to insert the calculator result into the field I was working in, so that I can use computed values without manual transcription.

#### Acceptance Criteria

1. THE Calculator_Popover SHALL display an Insert_Button labeled "Insert Result"
2. WHEN the user clicks the Insert_Button and the Source_Field is an input element on the Editor_Page, THE Calculator_Popover SHALL write the current result value into the Source_Field
3. WHEN the user clicks the Insert_Button and the Source_Field is not on the Editor_Page, THE Insert_Button SHALL be visually disabled and produce no action
4. WHEN the result is inserted into the Source_Field, THE Calculator_Popover SHALL trigger the Source_Field's input event so that CWOC's dirty-tracking detects the change
5. IF no Source_Field was recorded when the Hotkey was pressed, THEN THE Insert_Button SHALL be visually disabled

### Requirement 5: Persist Mode

**User Story:** As a user, I want the calculator to stay wired to a field and auto-update it as I adjust the calculation, so that I can experiment with values without repeatedly clicking Insert.

#### Acceptance Criteria

1. THE Calculator_Popover SHALL display a Persist_Checkbox labeled "Persist"
2. WHEN the Persist_Checkbox is checked and the Source_Field is a valid input on the Editor_Page, THE Calculator_Popover SHALL automatically write the current result into the Source_Field each time the result changes
3. WHEN the Persist_Checkbox is unchecked, THE Calculator_Popover SHALL stop auto-updating the Source_Field
4. WHEN the Calculator_Popover is closed, THE Persist_Checkbox SHALL be unchecked and auto-updating SHALL stop
5. WHILE Persist mode is active, THE Calculator_Popover SHALL display a visual indicator (such as a highlighted border or label) showing which field is being updated
6. IF the Source_Field is not on the Editor_Page, THEN THE Persist_Checkbox SHALL be visually disabled and not checkable

### Requirement 6: ESC Key Integration

**User Story:** As a user, I want ESC to close the calculator before doing anything else, so that the layered escape behavior remains consistent across CWOC.

#### Acceptance Criteria

1. WHEN the Calculator_Popover is open and the user presses Escape, THE Calculator_Popover SHALL close before any other ESC handler in the chain executes
2. THE Calculator_Popover ESC handler SHALL be inserted at the highest priority in the ESC_Chain on both the Editor_Page and the Dashboard_Page
3. WHEN the Calculator_Popover is not open, THE ESC key SHALL pass through to the next handler in the existing ESC_Chain without interference

### Requirement 7: Visual Design

**User Story:** As a user, I want the calculator to match CWOC's 1940s parchment aesthetic, so that it feels like a native part of the application.

#### Acceptance Criteria

1. THE Calculator_Popover SHALL use CSS variables from shared-page.css (--parchment-light, --aged-brown-dark, --accent-gold, --button-bg, --button-hover, --border-color, --text-color)
2. THE Calculator_Popover SHALL use the Lora serif font consistent with the rest of CWOC
3. THE Calculator_Popover SHALL have a z-index higher than all other CWOC overlays (modals, hotkey panels, flatpickr) to ensure it floats on top of everything
4. THE Calculator_Popover SHALL have a visible drop shadow and border to distinguish it from the page content beneath

### Requirement 8: Single Instance Constraint

**User Story:** As a user, I want only one calculator open at a time, so that the interface stays simple and uncluttered.

#### Acceptance Criteria

1. THE system SHALL allow at most one Calculator_Popover instance to exist in the DOM at any time
2. WHEN the Hotkey is pressed while the Calculator_Popover is already open, THE Calculator_Popover SHALL close (toggle behavior) rather than opening a second instance
3. WHEN the Calculator_Popover is opened, THE Calculator_Display SHALL retain the previous result from the last session on the same page load (not reset to zero)

### Requirement 9: No External Dependencies

**User Story:** As a developer, I want the calculator built entirely with vanilla JS and CSS, so that it aligns with CWOC's no-framework, no-build-step architecture.

#### Acceptance Criteria

1. THE Calculator_Popover SHALL be implemented using only vanilla JavaScript, HTML5, and CSS3 with no external libraries or frameworks
2. THE Calculator_Popover JavaScript SHALL be placed in a new shared file (`shared-calculator.js`) loaded via a script tag on all pages
3. THE Calculator_Popover CSS SHALL be placed in `shared-page.css` under a dedicated calculator section

### Requirement 10: Accessibility and Usability

**User Story:** As a user, I want the calculator to be keyboard-navigable and clearly labeled, so that it is usable without a mouse.

#### Acceptance Criteria

1. THE Calculator_Popover buttons SHALL have aria-label attributes describing their function
2. WHEN the Calculator_Popover opens, THE Calculator_Display SHALL receive focus so that keyboard input is immediately captured
3. THE Calculator_Popover SHALL trap keyboard focus within itself while open (Tab cycles through calculator controls only)
