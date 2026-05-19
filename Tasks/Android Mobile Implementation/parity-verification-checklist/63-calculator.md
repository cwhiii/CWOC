# Calculator

**Category:** Modals & Overlays
**Item #:** 63
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Public API (shared-calculator.js)
- [ ] cwocToggleCalculator() — Opens or closes the calculator popover; captures active element as source field
- [ ] cwocIsCalculatorOpen() — Returns true if the calculator is currently visible
- [ ] cwocCloseCalculator() — Hides the calculator popover (state preserved for next open)

### Expression Engine
- [ ] _calcTokenize(expr) — Tokenizes arithmetic expression into NUMBER and OP tokens; handles multi-digit, decimals, unary minus
- [ ] _calcParse(tokens) — Recursive-descent parser with correct operator precedence (* / before + -)
- [ ] _calcEvaluate(expr) — Full evaluation pipeline: trim → cap length → tokenize → parse → validate result
- [ ] _calcFormatResult(num) — Formats numeric result (removes trailing zeros, uses toPrecision for very large/small numbers)

### UI Construction
- [ ] _calcCreatePopover() — Builds the singleton calculator DOM: title bar, display area, button grid; appends to document.body

### Calculator Buttons (4×5 grid + spanning)
- [ ] C (Clear) — Resets expression and result to initial state
- [ ] ⌫ (Backspace) — Removes last character from expression
- [ ] ÷ (Divide) — Appends / operator
- [ ] × (Multiply) — Appends * operator
- [ ] 1-9 (Digits) — Appends digit to expression
- [ ] 0 (Zero) — Appends 0 (spans 2 columns)
- [ ] . (Decimal) — Appends decimal point
- [ ] − (Subtract) — Appends - operator
- [ ] + (Add) — Appends + operator
- [ ] = (Equals) — Evaluates expression and shows result
- [ ] Ins (Insert) — Inserts result into the source field (editor page only)

### Button Press Logic
- [ ] _calcOnButton(value) — Routes button presses to appropriate action (digit, operator, equals, clear, backspace, insert)
- [ ] Expression chaining — After equals, typing a digit starts fresh; typing an operator chains from result
- [ ] Operator replacement — Typing a new operator replaces the last one (no double operators)
- [ ] Unary minus — Allowed at start of expression or after an operator
- [ ] 50-character cap — Expression length limited to _calcMaxExprLength (50)

### Display
- [ ] _calcUpdateDisplay() — Updates expression line (with × ÷ display symbols) and result line (live evaluation as user types)
- [ ] Expression line (.cwoc-calc-expr) — Shows current expression with display symbols
- [ ] Result line (.cwoc-calc-result) — Shows live-evaluated result or last computed result
- [ ] aria-live="polite" — Screen reader announces display changes

### Drag Handling
- [ ] _calcInitDrag(titleBar) — Attaches mouse and touch drag listeners to title bar
- [ ] _calcDragStart(clientX, clientY) — Begins drag, converts right-based to left-based positioning
- [ ] _calcDragMove(clientX, clientY) — Repositions popover during drag
- [ ] _calcDragEnd() — Ends drag operation
- [ ] _calcClampToViewport(el) — Clamps popover to stay fully within visible viewport
- [ ] Window resize listener — Re-clamps popover on viewport resize

### Keyboard Input
- [ ] _calcInitKeyboard(popover) — Attaches keydown listener for keyboard calculator input
- [ ] Digits 0-9 → digit input
- [ ] . → decimal point
- [ ] +, -, *, / → operators
- [ ] Enter → equals (evaluate)
- [ ] Shift+Enter → insert result and close calculator
- [ ] Backspace → remove last character
- [ ] Escape → close calculator
- [ ] All handled keys: preventDefault + stopPropagation (prevents page-level handlers)

### Focus Trapping
- [ ] _calcInitFocusTrap(popover) — Tab/Shift+Tab cycles through focusable elements within popover only
- [ ] Focus doesn't escape to page elements while calculator is open

### Insert Result
- [ ] _calcInsertResult() — Inserts current result at cursor position in the last focused text/number field
- [ ] _calcIsEditorPage() — Returns true if on the editor page (enables Insert functionality)
- [ ] _calcSourceField — DOM element that had focus when calculator was opened
- [ ] _calcLastFocusedField — Tracked reference to most recently focused input/textarea
- [ ] Inserts at cursor position (selectionStart/selectionEnd), not replacing entire value

### Title Bar
- [ ] "Calculator" text label
- [ ] × Close button — Closes the calculator (aria-label: "Close calculator")
- [ ] Grab cursor — Title bar acts as drag handle

### State Variables
- [ ] _calcExpression — Current expression string
- [ ] _calcResult — Last computed result string (default '0')
- [ ] _calcSourceField — DOM element for Insert target
- [ ] _calcPopoverEl — Singleton popover DOM reference
- [ ] _calcIsOpen — Boolean visibility state
- [ ] _calcLastOperatorWasEquals — Tracks if last action was "=" for chaining behavior
- [ ] _calcDragState — {active, offsetX, offsetY} for drag operations

### Hotkey
- [ ] F4 — Global hotkey to toggle calculator (registered in shared-hotkeys.js)

### Accessibility
- [ ] role="dialog" on popover
- [ ] aria-label="Calculator" on popover
- [ ] aria-label on each button describing its function
- [ ] aria-live="polite" on display area
- [ ] aria-label on expression and result elements
- [ ] Focus trap prevents Tab from escaping
