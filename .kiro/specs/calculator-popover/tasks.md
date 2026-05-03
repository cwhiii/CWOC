# Implementation Plan: Calculator Popover

## Overview

Build a floating, draggable arithmetic calculator popover available on every CWOC page via `Ctrl+Shift+C`. The calculator provides basic arithmetic with correct operator precedence, insert-to-field and persist-mode for the editor page, and integrates into CWOC's layered ESC chain. Implemented entirely in vanilla JS/CSS with no external dependencies.

## Tasks

- [x] 1. Create the calculator CSS in shared-page.css
  - Add a dedicated `/* ── Calculator Popover ──── */` section at the end of `src/frontend/css/shared/shared-page.css`
  - Define all calculator classes: `.cwoc-calc-popover`, `.cwoc-calc-titlebar`, `.cwoc-calc-display`, `.cwoc-calc-buttons`, `.cwoc-calc-btn`, `.cwoc-calc-btn-op`, `.cwoc-calc-btn-eq`, `.cwoc-calc-btn-clear`, `.cwoc-calc-actions`, `.cwoc-calc-persist-indicator`
  - Use CSS variables from shared-page.css (--parchment-light, --aged-brown-dark, --accent-gold, --button-bg, --button-hover, --border-color, --text-color)
  - Use Lora serif font, z-index 200000, fixed positioning, drop shadow and border
  - Style the button grid layout (4-column grid for digits/operators)
  - Style the Insert button and Persist checkbox row, with disabled states
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.3_

- [x] 2. Create shared-calculator.js with core expression engine
  - [x] 2.1 Create `src/frontend/js/shared/shared-calculator.js` with module-level state variables
    - Define `_calcExpression`, `_calcResult`, `_calcSourceField`, `_calcPersistActive`, `_calcPopoverEl`, `_calcIsOpen`, `_calcLastOperatorWasEquals`
    - Implement `_calcTokenize(expr)` — splits expression into NUMBER and OP tokens
    - Implement `_calcParse(tokens)` — recursive-descent parser respecting `*`/`/` before `+`/`-`
    - Implement `_calcEvaluate(expr)` — tokenize, parse, return number or `'Error'`
    - Handle division by zero → `'Error'`, malformed expressions → `'Error'`, Infinity → `'Error'`
    - Cap expression length at 50 characters
    - _Requirements: 3.4, 3.5, 3.7, 9.1_

  - [ ]* 2.2 Write property test for expression evaluation correctness
    - **Property 4: Expression Evaluation Correctness**
    - Create `src/frontend/js/shared/test-calc-properties.js` as a self-contained browser-runnable test file
    - Generate random valid arithmetic expressions (non-negative numbers, `+`, `-`, `*`, `/` with no division by zero), evaluate with `_calcEvaluate`, compare against a reference evaluation
    - Minimum 100 iterations
    - **Validates: Requirements 3.4, 3.7**

- [x] 3. Implement calculator UI construction and display logic
  - [x] 3.1 Implement `_calcCreatePopover()` — builds the full calculator DOM
    - Title bar with "Calculator" text and close button (×)
    - Display area for expression and result
    - Button grid: digits 0–9, decimal point, operators (+, −, ×, ÷), Clear (C), Backspace (⌫), Equals (=)
    - Insert Result button and Persist checkbox row
    - All buttons must have `aria-label` attributes describing their function
    - Append to `document.body` as singleton
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 5.1, 8.1, 10.1_

  - [x] 3.2 Implement `_calcOnButton(value)` — handles button press logic
    - Digit/decimal: append to expression (respect 50-char cap)
    - Operator: append operator
    - Equals: evaluate expression via `_calcEvaluate`, update display
    - Clear: reset expression to empty, result to '0'
    - Backspace: remove last character from expression
    - Handle chaining after equals (start new expression with result)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Implement `_calcUpdateDisplay()` — updates display element
    - Show current expression and computed result
    - If persist is active and source field exists on editor page, write result to source field
    - _Requirements: 3.4, 5.2_

  - [ ]* 3.4 Write property test for clear resets state
    - **Property 3: Clear Resets State**
    - For any arbitrary expression string, pressing Clear should reset expression to empty and result to '0'
    - **Validates: Requirements 3.2**

- [x] 4. Implement toggle, open/close, and singleton behavior
  - [x] 4.1 Implement `cwocToggleCalculator()`, `cwocIsCalculatorOpen()`, `cwocCloseCalculator()`
    - Toggle: capture `document.activeElement` as source field before opening, show/hide popover
    - Open: create popover if not yet created (singleton), set focus to display, retain previous result across open/close
    - Close: hide popover, uncheck persist, stop auto-updating
    - `cwocIsCalculatorOpen()` returns boolean consistent with visibility state
    - _Requirements: 1.1, 1.2, 1.3, 5.4, 8.1, 8.2, 8.3, 10.2_

  - [ ]* 4.2 Write property test for toggle idempotence
    - **Property 1: Toggle Idempotence**
    - For any positive integer N, toggling N times leaves calculator open if N is odd, closed if N is even
    - **Validates: Requirements 1.1, 1.2, 8.2**

  - [ ]* 4.3 Write property test for singleton invariant
    - **Property 6: Singleton Invariant**
    - For any sequence of toggle/open/close operations, number of `.cwoc-calc-popover` elements in DOM never exceeds 1
    - **Validates: Requirements 8.1**

  - [ ]* 4.4 Write property test for state persistence across open/close
    - **Property 7: State Persistence Across Open/Close**
    - For any evaluated expression, closing and reopening shows the same result
    - **Validates: Requirements 8.3**

- [x] 5. Implement drag, keyboard input, and focus trapping
  - [x] 5.1 Implement `_calcInitDrag(titleBar)` and `_calcClampToViewport(el)`
    - Mouse drag: mousedown on title bar starts drag, mousemove repositions, mouseup ends
    - Touch drag: touchstart/touchmove/touchend with same logic
    - Clamp popover to viewport boundaries on every move and on window resize
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.2 Implement keyboard input handling within the calculator
    - Digits 0–9 and operators (+, -, *, /) update expression
    - Enter triggers evaluation (equals)
    - Backspace removes last character
    - Escape closes calculator (handled by ESC chain)
    - Prevent keyboard events from propagating to page handlers while calculator has focus
    - _Requirements: 3.6_

  - [x] 5.3 Implement focus trapping within the calculator
    - Tab key cycles through calculator controls only (buttons, insert, persist checkbox, close)
    - Shift+Tab cycles in reverse
    - Focus does not escape to page elements while calculator is open
    - _Requirements: 10.3_

  - [ ]* 5.4 Write property test for viewport-clamped drag
    - **Property 2: Viewport-Clamped Drag**
    - For any starting position and drag delta, `_calcClampToViewport` produces coordinates keeping popover within viewport
    - **Validates: Requirements 2.2, 2.4**

- [x] 6. Implement Insert Result and Persist mode
  - [x] 6.1 Implement `_calcInsertResult()` and `_calcIsEditorPage()`
    - `_calcIsEditorPage()` returns true if current page is `editor.html`
    - Insert writes current result into source field's `value` (or `textContent` for contenteditable)
    - Fire `input` event on source field so dirty-tracking detects the change
    - Disable Insert button when: no source field, not on editor page, or source field removed from DOM
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Implement Persist mode logic
    - When Persist checkbox is checked and source field is valid on editor page, auto-write result on each `_calcUpdateDisplay()`
    - When unchecked, stop auto-updating
    - Show visual indicator (highlighted border/label) when persist is active
    - Disable Persist checkbox when not on editor page
    - On close, uncheck persist and stop auto-updating
    - Handle stale source field (removed from DOM) — silently disable persist
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.3 Write property test for persist keeps field in sync
    - **Property 5: Persist Keeps Field in Sync**
    - For any sequence of button presses with persist active and valid source field, field value always equals displayed result
    - **Validates: Requirements 5.2**

- [x] 8. Implement hotkey registration and ESC chain integration
  - [x] 8.1 Implement `_calcSetupHotkey()` in shared-calculator.js
    - Register global `Ctrl+Shift+C` keydown listener (called once on script load)
    - Calls `cwocToggleCalculator()` on hotkey press
    - _Requirements: 1.1, 1.2_

  - [x] 8.2 Integrate calculator ESC into editor-init.js ESC chain
    - Add check at the very top of the ESC keydown handler in `src/frontend/js/editor/editor-init.js`
    - If `cwocIsCalculatorOpen()`, call `cwocCloseCalculator()` and return — before all other ESC checks
    - _Requirements: 6.1, 6.2_

  - [x] 8.3 Integrate calculator ESC into main-init.js ESC chain
    - Add check at the top of the ESC handler in `src/frontend/js/dashboard/main-init.js`
    - If `cwocIsCalculatorOpen()`, call `cwocCloseCalculator()` and return — before reference overlay, clock modal, etc.
    - _Requirements: 6.1, 6.2_

  - [x] 8.4 Handle ESC on secondary pages via shared-calculator.js
    - The calculator's own keydown listener handles ESC when open on secondary pages (no complex ESC chains there)
    - Ensure ESC passes through to existing handlers when calculator is not open
    - _Requirements: 6.1, 6.3_

- [x] 9. Add script tags to all HTML pages
  - [x] 9.1 Add `<script src="/frontend/js/shared/shared-calculator.js"></script>` to editor.html
    - Insert after `shared.js` and before `shared-page.js` in the script loading order
    - _Requirements: 1.4, 9.2_

  - [x] 9.2 Add `<script src="/frontend/js/shared/shared-calculator.js"></script>` to index.html
    - Insert after `shared.js` and before `shared-page.js`
    - _Requirements: 1.4, 9.2_

  - [x] 9.3 Add `<script src="/frontend/js/shared/shared-calculator.js"></script>` to all secondary pages
    - Update `_template.html`, `settings.html`, `people.html`, `weather.html`, `help.html`, `trash.html`, `audit-log.html`, `maps.html`, `contact-editor.html`, `user-admin.html`
    - Insert after `shared.js` and before `shared-page.js` in each file
    - _Requirements: 1.4, 9.2_

- [x] 10. Checkpoint — Full integration test
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 11. Write accessibility property test
  - **Property 8: Accessibility Labels on All Buttons**
  - Verify every button element within the calculator popover has a non-empty `aria-label` attribute
  - **Validates: Requirements 10.1**

- [x] 12. Update help page and reference overlay
  - Add calculator documentation to `src/frontend/html/help.html`
  - Document `Ctrl+Shift+C` hotkey in the Keyboard Shortcuts section
  - Document calculator features: arithmetic, insert, persist, drag, ESC to close
  - Update reference overlay in index.html if applicable (add Ctrl+Shift+C entry)
  - _Requirements: 1.1, 3.6, 4.1, 5.1_

- [x] 13. Update INDEX.md, create release notes, and update version
  - Add `shared-calculator.js` to `src/INDEX.md` with all public and internal functions
  - Add the calculator CSS section reference to INDEX.md
  - Create release notes file in `documents/release_notes/`
  - Update `src/VERSION` using `date "+%Y%m%d.%H%M"` (run once at the very end)

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No software installation required — all tests are self-contained vanilla JS files runnable in the browser
- The design uses vanilla JavaScript, so all implementation tasks use vanilla JS
