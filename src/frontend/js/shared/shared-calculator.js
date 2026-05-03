/**
 * shared-calculator.js — Calculator Popover for CWOC.
 *
 * A floating, draggable arithmetic calculator available on every CWOC page
 * via F4 hotkey. Provides basic arithmetic with correct operator precedence,
 * insert-to-field for the editor page.
 *
 * This file loads after shared.js and before shared-page.js on all pages.
 *
 * Public API:
 *   cwocToggleCalculator()  — Opens or closes the calculator popover
 *   cwocIsCalculatorOpen()  — Returns true if the calculator is visible
 *   cwocCloseCalculator()   — Closes the calculator
 */

// ── Module-Level State ───────────────────────────────────────────────────────
// Persists across open/close within a single page load.

var _calcExpression = '';           // Current expression string, e.g. "12+3*4"
var _calcResult = '0';             // Last computed result as a string
var _calcSourceField = null;       // DOM element that had focus when hotkey was pressed
var _calcPopoverEl = null;         // Reference to the popover DOM element (singleton)
var _calcIsOpen = false;           // Whether the popover is currently visible
var _calcLastOperatorWasEquals = false; // Track if last action was "=" for chaining

// ── Expression Engine ────────────────────────────────────────────────────────

/** Maximum allowed expression length in characters. */
var _calcMaxExprLength = 50;

/**
 * Tokenize an arithmetic expression string into NUMBER and OP tokens.
 *
 * Handles multi-digit numbers, decimals, and negative numbers at the start
 * of the expression or immediately after an operator.
 *
 * @param {string} expr - The expression string, e.g. "12+3.5*-4"
 * @returns {Array<{type: string, value: number|string}>} Array of tokens,
 *   each with type 'NUMBER' or 'OP' and a corresponding value.
 *   Returns null if the expression is malformed.
 */
function _calcTokenize(expr) {
  var tokens = [];
  var i = 0;
  var len = expr.length;

  while (i < len) {
    var ch = expr[i];

    // Skip whitespace
    if (ch === ' ') {
      i++;
      continue;
    }

    // Number: digits and decimal point, possibly preceded by a unary minus
    if (ch >= '0' && ch <= '9' || ch === '.' ||
        (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1].type === 'OP'))) {
      var start = i;
      // Consume optional leading minus (unary)
      if (ch === '-') i++;
      var hasDot = false;
      while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        if (expr[i] === '.') {
          if (hasDot) return null; // two dots in one number → malformed
          hasDot = true;
        }
        i++;
      }
      var numStr = expr.substring(start, i);
      // Bare minus or bare dot with no digits → malformed
      if (numStr === '-' || numStr === '.' || numStr === '-.') return null;
      var num = parseFloat(numStr);
      if (isNaN(num)) return null;
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // Operator
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    // Unknown character → malformed
    return null;
  }

  return tokens.length > 0 ? tokens : null;
}

/**
 * Recursive-descent parser that respects standard arithmetic precedence:
 * multiplication and division bind tighter than addition and subtraction.
 *
 * Grammar:
 *   expr   → term (('+' | '-') term)*
 *   term   → factor (('*' | '/') factor)*
 *   factor → NUMBER
 *
 * @param {Array<{type: string, value: number|string}>} tokens - Token array from _calcTokenize
 * @returns {number|string} Numeric result, or 'Error' if parsing fails or division by zero occurs.
 */
function _calcParse(tokens) {
  if (!tokens || tokens.length === 0) return 'Error';

  var pos = 0;

  /** Consume and return the current token, advancing the position. */
  function consume() {
    return tokens[pos++];
  }

  /** Peek at the current token without consuming it. */
  function peek() {
    return pos < tokens.length ? tokens[pos] : null;
  }

  /** Parse a factor: a single NUMBER token. */
  function parseFactor() {
    var tok = peek();
    if (!tok || tok.type !== 'NUMBER') return 'Error';
    consume();
    return tok.value;
  }

  /** Parse a term: factor (('*' | '/') factor)* */
  function parseTerm() {
    var left = parseFactor();
    if (left === 'Error') return 'Error';

    var next = peek();
    while (next && next.type === 'OP' && (next.value === '*' || next.value === '/')) {
      var op = consume().value;
      var right = parseFactor();
      if (right === 'Error') return 'Error';
      if (op === '*') {
        left = left * right;
      } else {
        if (right === 0) return 'Error'; // division by zero
        left = left / right;
      }
      next = peek();
    }
    return left;
  }

  /** Parse an expression: term (('+' | '-') term)* */
  function parseExpr() {
    var left = parseTerm();
    if (left === 'Error') return 'Error';

    var next = peek();
    while (next && next.type === 'OP' && (next.value === '+' || next.value === '-')) {
      var op = consume().value;
      var right = parseTerm();
      if (right === 'Error') return 'Error';
      if (op === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
      next = peek();
    }
    return left;
  }

  var result = parseExpr();

  // If there are unconsumed tokens, the expression is malformed
  if (pos < tokens.length) return 'Error';

  return result;
}

/**
 * Evaluate an arithmetic expression string.
 *
 * Tokenizes the expression, parses it with correct operator precedence
 * (* / before + -), and returns the numeric result or 'Error'.
 *
 * @param {string} expr - The expression string, e.g. "2+3*4"
 * @returns {number|string} The numeric result, or 'Error' for:
 *   - Empty or whitespace-only expressions
 *   - Malformed expressions (e.g. "++", "3+*2")
 *   - Division by zero
 *   - Results that are Infinity or NaN
 *   - Expressions exceeding the 50-character cap
 */
function _calcEvaluate(expr) {
  if (typeof expr !== 'string') return 'Error';

  // Trim whitespace for evaluation
  var trimmed = expr.replace(/\s/g, '');
  if (trimmed === '') return 'Error';

  // Cap expression length
  if (trimmed.length > _calcMaxExprLength) return 'Error';

  var tokens = _calcTokenize(trimmed);
  if (!tokens) return 'Error';

  var result = _calcParse(tokens);
  if (result === 'Error') return 'Error';

  // Guard against Infinity and NaN
  if (!isFinite(result) || isNaN(result)) return 'Error';

  return result;
}

// ── Calculator UI Construction ───────────────────────────────────────────────

/**
 * Map of internal operator characters to display symbols.
 * The expression string stores *, / but the UI shows ×, ÷.
 */
var _calcDisplaySymbols = { '*': '×', '/': '÷' };

/**
 * Map of display symbols back to internal operator characters.
 */
var _calcInternalOps = { '×': '*', '÷': '/' };

/**
 * Build the full calculator popover DOM and append it to document.body.
 *
 * Creates the singleton popover element with:
 *   - Title bar with "Calculator" text and close button (×)
 *   - Display area for expression and result
 *   - Button grid: digits 0–9, decimal point, operators, Clear, Backspace, Equals, Insert
 *
 * All buttons receive aria-label attributes describing their function.
 * The popover is appended to document.body and initially hidden.
 *
 * @returns {HTMLElement} The popover element.
 */
function _calcCreatePopover() {
  // Singleton guard — return existing if already created
  if (_calcPopoverEl) return _calcPopoverEl;

  var popover = document.createElement('div');
  popover.className = 'cwoc-calc-popover';
  popover.style.display = 'none';
  popover.style.top = '80px';
  popover.style.right = '40px';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Calculator');

  // ── Title Bar ──────────────────────────────────────────────────────────
  var titleBar = document.createElement('div');
  titleBar.className = 'cwoc-calc-titlebar';

  var titleText = document.createElement('span');
  titleText.textContent = 'Calculator';
  titleBar.appendChild(titleText);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'cwoc-calc-close';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close calculator');
  closeBtn.addEventListener('click', function () {
    if (typeof cwocCloseCalculator === 'function') cwocCloseCalculator();
  });
  titleBar.appendChild(closeBtn);

  popover.appendChild(titleBar);

  // ── Display Area ───────────────────────────────────────────────────────
  var display = document.createElement('div');
  display.className = 'cwoc-calc-display';
  display.setAttribute('tabindex', '0');
  display.setAttribute('aria-live', 'polite');
  display.setAttribute('aria-label', 'Calculator display');

  var exprEl = document.createElement('div');
  exprEl.className = 'cwoc-calc-expr';
  exprEl.setAttribute('aria-label', 'Current expression');
  display.appendChild(exprEl);

  var resultEl = document.createElement('div');
  resultEl.className = 'cwoc-calc-result';
  resultEl.textContent = '0';
  resultEl.setAttribute('aria-label', 'Current result');
  display.appendChild(resultEl);

  popover.appendChild(display);

  // ── Button Grid ────────────────────────────────────────────────────────
  var btnGrid = document.createElement('div');
  btnGrid.className = 'cwoc-calc-buttons';

  // Button definitions: [display text, internal value, css class suffix, aria-label, grid span]
  var buttons = [
    ['C',  'C',  'clear', 'Clear',              1],
    ['⌫',  '⌫',  'clear', 'Backspace',           1],
    ['÷',  '/',  'op',    'Divide',              1],
    ['×',  '*',  'op',    'Multiply',            1],
    ['1',  '1',  '',      'One',                 1],
    ['2',  '2',  '',      'Two',                 1],
    ['3',  '3',  '',      'Three',               1],
    ['−',  '-',  'op',    'Subtract',            1],
    ['4',  '4',  '',      'Four',                1],
    ['5',  '5',  '',      'Five',                1],
    ['6',  '6',  '',      'Six',                 1],
    ['+',  '+',  'op',    'Add',                 1],
    ['7',  '7',  '',      'Seven',               1],
    ['8',  '8',  '',      'Eight',               1],
    ['9',  '9',  '',      'Nine',                1],
    ['Ins', 'INSERT', 'eq', 'Insert result into source field', 1],
    ['0',  '0',  '',      'Zero',                2],
    ['.',  '.',  '',      'Decimal point',       1],
    ['=',  '=',  'eq',    'Equals',              1]
  ];

  buttons.forEach(function (def) {
    var label = def[0];
    var value = def[1];
    var cls   = def[2];
    var aria  = def[3];
    var span  = def[4];

    var btn = document.createElement('button');
    btn.className = 'cwoc-calc-btn' + (cls ? ' cwoc-calc-btn-' + cls : '');
    btn.textContent = label;
    btn.setAttribute('aria-label', aria);
    btn.setAttribute('type', 'button');
    if (value === 'INSERT') {
      btn.title = 'Insert result into the field you were editing (Shift+Enter)';
    }
    if (span > 1) {
      btn.style.gridColumn = 'span ' + span;
    }
    btn.addEventListener('click', function () {
      _calcOnButton(value);
    });
    btnGrid.appendChild(btn);
  });

  popover.appendChild(btnGrid);

  // ── Initialize Drag, Keyboard, and Focus Trap ────────────────────────
  _calcInitDrag(titleBar);
  _calcInitKeyboard(popover);
  _calcInitFocusTrap(popover);

  // ── Append to body ─────────────────────────────────────────────────────
  document.body.appendChild(popover);
  _calcPopoverEl = popover;

  return popover;
}

// ── Button Press Logic ───────────────────────────────────────────────────────

/**
 * Handle a calculator button press.
 *
 * Processes digit, decimal, operator, equals, clear, and backspace actions.
 * Manages expression chaining after equals (starting a new expression with
 * the previous result when a digit is pressed after =).
 *
 * @param {string} value - The internal value of the pressed button:
 *   '0'–'9', '.', '+', '-', '*', '/', '=', 'C', '⌫'
 */
function _calcOnButton(value) {
  var isDigit = (value >= '0' && value <= '9') || value === '.';
  var isOperator = value === '+' || value === '-' || value === '*' || value === '/';

  // ── Clear ──────────────────────────────────────────────────────────────
  if (value === 'C') {
    _calcExpression = '';
    _calcResult = '0';
    _calcLastOperatorWasEquals = false;
    _calcUpdateDisplay();
    return;
  }

  // ── Backspace ──────────────────────────────────────────────────────────
  if (value === '⌫') {
    if (_calcExpression.length > 0) {
      _calcExpression = _calcExpression.slice(0, -1);
      _calcLastOperatorWasEquals = false;
      _calcUpdateDisplay();
    }
    return;
  }

  // ── Insert Result ──────────────────────────────────────────────────────
  if (value === 'INSERT') {
    if (typeof _calcInsertResult === 'function') _calcInsertResult();
    return;
  }

  // ── Equals ─────────────────────────────────────────────────────────────
  if (value === '=') {
    if (_calcExpression === '') return; // no-op on empty expression
    var evalResult = _calcEvaluate(_calcExpression);
    if (evalResult === 'Error') {
      _calcResult = 'Error';
    } else {
      // Format: remove trailing zeros for clean display, cap precision
      _calcResult = _calcFormatResult(evalResult);
    }
    _calcLastOperatorWasEquals = true;
    _calcUpdateDisplay();
    return;
  }

  // ── Digit or Decimal ───────────────────────────────────────────────────
  if (isDigit) {
    // After equals, start a new expression (user is typing a fresh number)
    if (_calcLastOperatorWasEquals) {
      _calcExpression = '';
      _calcLastOperatorWasEquals = false;
    }
    // Respect 50-char cap
    if (_calcExpression.length >= _calcMaxExprLength) return;
    _calcExpression += value;
    _calcUpdateDisplay();
    return;
  }

  // ── Operator ───────────────────────────────────────────────────────────
  if (isOperator) {
    // After equals, chain: start new expression with the result
    if (_calcLastOperatorWasEquals && _calcResult !== 'Error') {
      _calcExpression = _calcResult;
      _calcLastOperatorWasEquals = false;
    }
    // Don't allow operator at the very start (except minus for negative)
    if (_calcExpression === '' && value !== '-') return;
    // Don't allow two operators in a row (replace the last one)
    var lastChar = _calcExpression[_calcExpression.length - 1];
    if (lastChar === '+' || lastChar === '-' || lastChar === '*' || lastChar === '/') {
      _calcExpression = _calcExpression.slice(0, -1);
    }
    // Respect 50-char cap
    if (_calcExpression.length >= _calcMaxExprLength) return;
    _calcExpression += value;
    _calcUpdateDisplay();
    return;
  }
}

/**
 * Format a numeric result for display.
 *
 * Rounds to a reasonable number of decimal places and removes trailing zeros.
 *
 * @param {number} num - The numeric result to format.
 * @returns {string} The formatted result string.
 */
function _calcFormatResult(num) {
  if (typeof num !== 'number' || !isFinite(num)) return 'Error';
  // Use toPrecision for very large/small numbers, toFixed otherwise
  var str;
  if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-6 && num !== 0)) {
    str = num.toPrecision(10);
  } else {
    str = parseFloat(num.toFixed(10)).toString();
  }
  return str;
}

// ── Display Update ───────────────────────────────────────────────────────────

/**
 * Update the calculator display with the current expression and result.
 *
 * Converts internal operators (*, /) to display symbols (×, ÷) for the
 * expression line. Shows a live-evaluated result as the user types.
 */
function _calcUpdateDisplay() {
  if (!_calcPopoverEl) return;

  var exprEl = _calcPopoverEl.querySelector('.cwoc-calc-expr');
  var resultEl = _calcPopoverEl.querySelector('.cwoc-calc-result');
  if (!exprEl || !resultEl) return;

  // Convert internal operators to display symbols for the expression line
  var displayExpr = _calcExpression;
  displayExpr = displayExpr.replace(/\*/g, '×').replace(/\//g, '÷');
  exprEl.textContent = displayExpr;

  // Live-evaluate the expression as the user types (if valid)
  if (_calcExpression !== '' && !_calcLastOperatorWasEquals) {
    var liveResult = _calcEvaluate(_calcExpression);
    if (liveResult !== 'Error') {
      resultEl.textContent = _calcFormatResult(liveResult);
    } else {
      // Keep showing the last valid result while typing
      resultEl.textContent = _calcResult;
    }
  } else {
    resultEl.textContent = _calcResult;
  }
}

// ── Toggle, Open/Close, and Singleton Behavior ──────────────────────────────

/**
 * Toggle the calculator popover open or closed.
 *
 * When opening:
 *   1. Captures document.activeElement as the source field before showing
 *   2. Creates the popover singleton if it doesn't exist yet
 *   3. Shows the popover and sets focus to the display area
 *   4. Updates Insert button disabled state based on editor page context
 *   5. Retains previous expression and result (no reset on open)
 *
 * When closing:
 *   Delegates to cwocCloseCalculator().
 *
 * Requirements: 1.1, 1.2, 1.3, 5.4, 8.1, 8.2, 8.3, 10.2
 */
function cwocToggleCalculator() {
  if (_calcIsOpen) {
    cwocCloseCalculator();
    return;
  }

  // Capture the currently focused element as the source field before opening
  _calcSourceField = document.activeElement || null;

  // Create the popover singleton if it hasn't been created yet
  _calcCreatePopover();

  // Show the popover
  if (_calcPopoverEl) {
    _calcPopoverEl.style.display = '';
  }
  _calcIsOpen = true;

  // Update the display to reflect current state
  _calcUpdateDisplay();

  // Set focus to the display area so keyboard input is immediately captured
  if (_calcPopoverEl) {
    var display = _calcPopoverEl.querySelector('.cwoc-calc-display');
    if (display) {
      display.focus();
    }
  }
}

/**
 * Close the calculator popover.
 *
 * Hides the popover. Expression and result state are preserved for the next open.
 */
function cwocCloseCalculator() {
  if (_calcPopoverEl) {
    _calcPopoverEl.style.display = 'none';
  }
  _calcIsOpen = false;
}

/**
 * Check whether the calculator popover is currently open.
 *
 * @returns {boolean} true if the calculator is visible, false otherwise.
 *
 * Requirements: 1.2, 8.2
 */
function cwocIsCalculatorOpen() {
  return _calcIsOpen;
}


// ── Drag Handling ────────────────────────────────────────────────────────────

/**
 * Drag state — tracks whether a drag is in progress and the offset from
 * the pointer to the popover's top-left corner.
 */
var _calcDragState = {
  active: false,
  offsetX: 0,
  offsetY: 0
};

/**
 * Clamp the popover element so it stays fully within the visible viewport.
 *
 * Reads the element's current left/top and adjusts if any edge extends
 * beyond the viewport. On first call (when the popover still uses right
 * for positioning), converts to left/top and removes right.
 *
 * @param {HTMLElement} el - The popover element to clamp.
 *
 * Requirements: 2.4
 */
function _calcClampToViewport(el) {
  if (!el) return;

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var rect = el.getBoundingClientRect();
  var w = rect.width;
  var h = rect.height;

  // If the element still uses 'right' positioning, convert to left/top
  if (el.style.right) {
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.right = '';
  }

  var left = parseFloat(el.style.left) || 0;
  var top = parseFloat(el.style.top) || 0;

  // Clamp horizontal
  if (left < 0) left = 0;
  if (left + w > vw) left = Math.max(0, vw - w);

  // Clamp vertical
  if (top < 0) top = 0;
  if (top + h > vh) top = Math.max(0, vh - h);

  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

/**
 * Initialize drag behavior on the calculator title bar.
 *
 * Attaches mouse and touch event listeners so the user can click/touch
 * the title bar and drag the popover to a new position. The popover is
 * clamped to the viewport on every move.
 *
 * On the first drag, the popover's positioning is converted from
 * top/right to left/top (position: fixed) so that left-based math works.
 *
 * @param {HTMLElement} titleBar - The title bar element to use as the drag handle.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */
function _calcInitDrag(titleBar) {
  if (!titleBar) return;

  // ── Mouse Drag ─────────────────────────────────────────────────────────

  titleBar.addEventListener('mousedown', function (e) {
    // Only respond to primary button
    if (e.button !== 0) return;
    e.preventDefault();
    _calcDragStart(e.clientX, e.clientY);
  });

  document.addEventListener('mousemove', function (e) {
    if (!_calcDragState.active) return;
    e.preventDefault();
    _calcDragMove(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', function () {
    if (!_calcDragState.active) return;
    _calcDragEnd();
  });

  // ── Touch Drag ─────────────────────────────────────────────────────────

  titleBar.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    var touch = e.touches[0];
    _calcDragStart(touch.clientX, touch.clientY);
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (!_calcDragState.active) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    var touch = e.touches[0];
    _calcDragMove(touch.clientX, touch.clientY);
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!_calcDragState.active) return;
    _calcDragEnd();
  });

  // ── Cursor style ───────────────────────────────────────────────────────
  titleBar.style.cursor = 'grab';
}

/**
 * Begin a drag operation. Converts right-based positioning to left/top
 * on the first drag, then records the offset between the pointer and
 * the popover's top-left corner.
 *
 * @param {number} clientX - Pointer X position.
 * @param {number} clientY - Pointer Y position.
 */
function _calcDragStart(clientX, clientY) {
  if (!_calcPopoverEl) return;

  // Convert from right-based to left-based positioning on first drag
  if (_calcPopoverEl.style.right) {
    var rect = _calcPopoverEl.getBoundingClientRect();
    _calcPopoverEl.style.left = rect.left + 'px';
    _calcPopoverEl.style.top = rect.top + 'px';
    _calcPopoverEl.style.right = '';
  }

  var left = parseFloat(_calcPopoverEl.style.left) || 0;
  var top = parseFloat(_calcPopoverEl.style.top) || 0;

  _calcDragState.active = true;
  _calcDragState.offsetX = clientX - left;
  _calcDragState.offsetY = clientY - top;
}

/**
 * Handle pointer movement during a drag. Repositions the popover and
 * clamps it to the viewport.
 *
 * @param {number} clientX - Pointer X position.
 * @param {number} clientY - Pointer Y position.
 */
function _calcDragMove(clientX, clientY) {
  if (!_calcPopoverEl || !_calcDragState.active) return;

  var newLeft = clientX - _calcDragState.offsetX;
  var newTop = clientY - _calcDragState.offsetY;

  _calcPopoverEl.style.left = newLeft + 'px';
  _calcPopoverEl.style.top = newTop + 'px';

  _calcClampToViewport(_calcPopoverEl);
}

/**
 * End the current drag operation.
 */
function _calcDragEnd() {
  _calcDragState.active = false;
}

// Re-clamp popover to viewport on window resize
window.addEventListener('resize', function () {
  if (_calcIsOpen && _calcPopoverEl) {
    _calcClampToViewport(_calcPopoverEl);
  }
});

// ── Keyboard Input Handling ──────────────────────────────────────────────────

/**
 * Attach a keydown listener to the calculator popover for keyboard input.
 *
 * Maps keyboard keys to calculator button actions:
 *   - Digits 0–9 → digit input
 *   - +, -, *, / → operator input
 *   - Enter → equals (evaluate)
 *   - Backspace → remove last character
 *   - Escape → close calculator (delegates to cwocCloseCalculator)
 *
 * All handled key events are stopped from propagating to page-level
 * handlers via e.stopPropagation().
 *
 * @param {HTMLElement} popover - The popover element to attach the listener to.
 *
 * Requirements: 3.6
 */
function _calcInitKeyboard(popover) {
  if (!popover) return;

  popover.addEventListener('keydown', function (e) {
    // Only handle keys when the calculator is open
    if (!_calcIsOpen) return;

    var key = e.key;
    var handled = false;

    // Digits 0–9
    if (key >= '0' && key <= '9') {
      _calcOnButton(key);
      handled = true;
    }

    // Decimal point
    else if (key === '.') {
      _calcOnButton('.');
      handled = true;
    }

    // Operators
    else if (key === '+') {
      _calcOnButton('+');
      handled = true;
    }
    else if (key === '-') {
      _calcOnButton('-');
      handled = true;
    }
    else if (key === '*') {
      _calcOnButton('*');
      handled = true;
    }
    else if (key === '/') {
      _calcOnButton('/');
      handled = true;
    }

    // Shift+Enter → insert result and close calculator
    else if (key === 'Enter' && e.shiftKey) {
      if (typeof _calcInsertResult === 'function') _calcInsertResult();
      cwocCloseCalculator();
      handled = true;
    }

    // Enter → Equals
    else if (key === 'Enter' && !e.shiftKey) {
      _calcOnButton('=');
      handled = true;
    }

    // Backspace → remove last character
    else if (key === 'Backspace') {
      _calcOnButton('⌫');
      handled = true;
    }

    // Escape → close calculator
    else if (key === 'Escape') {
      cwocCloseCalculator();
      handled = true;
    }

    // Prevent handled keys from propagating to page handlers
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

// ── Focus Trapping ───────────────────────────────────────────────────────────

/**
 * Attach a focus-trap keydown listener to the calculator popover.
 *
 * When the calculator is open, Tab and Shift+Tab cycle through focusable
 * elements within the popover only (buttons, the insert button, the persist
 * checkbox, the close button, and the display area). Focus does not escape
 * to page elements.
 *
 * @param {HTMLElement} popover - The popover element to trap focus within.
 *
 * Requirements: 10.3
 */
function _calcInitFocusTrap(popover) {
  if (!popover) return;

  popover.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !_calcIsOpen) return;

    // Stop Tab from propagating to page handlers
    e.stopPropagation();

    // Gather all focusable elements within the popover
    var focusable = popover.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
    );
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var active = document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: if on first element (or outside popover), wrap to last
      if (active === first || !popover.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element (or outside popover), wrap to first
      if (active === last || !popover.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

// ── Insert Result & Persist Mode ─────────────────────────────────────────────

/**
 * Check whether the current page is the chit editor.
 *
 * Returns true if `window.location.pathname` ends with `editor.html`
 * or contains `/editor`.
 *
 * @returns {boolean} true if on the editor page, false otherwise.
 *
 * Requirements: 4.3, 5.6
 */
function _calcIsEditorPage() {
  var path = window.location.pathname;
  if (path.indexOf('/editor') !== -1) return true;
  if (path.length >= 11 && path.substring(path.length - 11) === 'editor.html') return true;
  return false;
}

/**
 * Insert the current calculator result into the captured source field.
 *
 * Writes the result into the source field's `.value` (for input/textarea)
 * or `.textContent` (for contenteditable elements), then dispatches an
 * `input` event so CWOC's dirty-tracking detects the change.
 *
 * Does nothing if:
 *   - No source field was captured
 *   - Not on the editor page
 *   - Source field is no longer in the DOM
 */
function _calcInsertResult() {
  if (!_calcSourceField) return;
  if (!_calcIsEditorPage()) return;
  if (!document.body.contains(_calcSourceField)) return;

  // ── Determine the current result to insert ─────────────────────────────
  var resultToInsert = _calcResult;

  // If the display is showing a live-evaluated result, use that instead
  if (_calcPopoverEl) {
    var resultEl = _calcPopoverEl.querySelector('.cwoc-calc-result');
    if (resultEl && resultEl.textContent) {
      resultToInsert = resultEl.textContent;
    }
  }

  // ── Write the result into the source field ─────────────────────────────
  var tag = _calcSourceField.tagName ? _calcSourceField.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea') {
    _calcSourceField.value = resultToInsert;
  } else if (_calcSourceField.isContentEditable) {
    _calcSourceField.textContent = resultToInsert;
  } else {
    // Fallback: try value first, then textContent
    if ('value' in _calcSourceField) {
      _calcSourceField.value = resultToInsert;
    } else {
      _calcSourceField.textContent = resultToInsert;
    }
  }

  // ── Fire input event so dirty-tracking detects the change ──────────────
  var inputEvent = new Event('input', { bubbles: true });
  _calcSourceField.dispatchEvent(inputEvent);
}


// ── Global Hotkey Registration ───────────────────────────────────────────────

/**
 * Register the global F4 keydown listener to toggle the calculator.
 *
 * Called once at script load time. Attaches a document-level keydown handler
 * that listens for F4 (no modifiers) and calls cwocToggleCalculator().
 * Works from any context including text inputs since F4 never produces text.
 *
 * Requirements: 1.1, 1.2
 */
function _calcSetupHotkey() {
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F4' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      cwocToggleCalculator();
    }
  });
}

// Self-invoke hotkey setup on script load
_calcSetupHotkey();
