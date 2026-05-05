/**
 * editor-notes.js — Notes zone: Obsidian-style live preview, format toolbar,
 * hotkeys, auto-grow, chit linking, markdown render, modal
 *
 * Three render modes (cycling via the zone header button):
 *   1. Source — plain textarea showing raw markdown
 *   2. Live Preview — TOKEN-LEVEL Obsidian-style: every inline markdown token
 *      is rendered (bold shows bold, italic shows italic, etc.) EXCEPT the
 *      specific token the cursor is currently inside, which reveals its raw
 *      markdown syntax characters. As the cursor moves, tokens re-render.
 *   3. Reading — fully rendered markdown, non-editable
 *
 * Depends on: shared.js (setSaveButtonUnsaved),
 *             marked.js (CDN, for markdown rendering + tokenization)
 * Loaded before: editor-init.js, editor.js
 */

// ── State ────────────────────────────────────────────────────────────────
var _notesRenderMode = 'source';
var _nlpActiveTokenEl = null; // the <span> currently showing raw syntax

// ── Touch Support State ──────────────────────────────────────────────────
var _nlpTouchSupported = ('ontouchstart' in window);
var _nlpViewportResizeHandler = null; // visualViewport resize handler ref

// ── Helpers ──────────────────────────────────────────────────────────────

/** Escape HTML special characters for safe text insertion */
function _escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Escape a string for safe use inside an HTML attribute value */
function _escAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Value Access ─────────────────────────────────────────────────────────

function _getNotesValue() {
  if (_notesRenderMode === 'live') return _nlpExtract();
  var ta = document.getElementById('note');
  return ta ? ta.value : '';
}

function _setNotesValue(val) {
  var ta = document.getElementById('note');
  if (ta) ta.value = val;
  // If currently in live mode, rebuild the live preview DOM to reflect the new value
  if (_notesRenderMode === 'live') _nlpBuild();
}

// ── Mode Cycling ─────────────────────────────────────────────────────────

function _cycleNotesRenderMode(event) {
  if (event) event.stopPropagation();
  if (_notesRenderMode === 'source') _setNotesMode('live');
  else if (_notesRenderMode === 'live') _setNotesMode('reading');
  else _setNotesMode('source');
}

function _setNotesMode(mode) {
  var prev = _notesRenderMode;
  if (prev === 'live') {
    // Leaving live mode: extract markdown, remove selectionchange listener
    var md = _nlpExtract();
    var ta = document.getElementById('note');
    if (ta && md !== null) ta.value = md;
    document.removeEventListener('selectionchange', _nlpOnSelectionChange);
    // Remove keydown, paste, input, focusout from live div
    var prevLiveDiv = document.getElementById('notesLivePreview');
    if (prevLiveDiv) {
      prevLiveDiv.removeEventListener('keydown', _nlpOnKeydown);
      prevLiveDiv.removeEventListener('paste', _nlpOnPaste);
      prevLiveDiv.removeEventListener('input', _nlpOnInput);
      prevLiveDiv.removeEventListener('focusout', _nlpOnFocusOut);
      // Remove touch fallback listener
      if (_nlpTouchSupported) {
        prevLiveDiv.removeEventListener('touchend', _nlpOnTouchEnd);
      }
    }
    // Remove visualViewport resize handler
    if (_nlpViewportResizeHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _nlpViewportResizeHandler);
      _nlpViewportResizeHandler = null;
    }
  }

  _notesRenderMode = mode;
  var textarea = document.getElementById('note');
  var liveDiv = document.getElementById('notesLivePreview');
  var rendered = document.getElementById('notes-rendered-output');
  var toolbar = document.getElementById('notesFormatToolbar');
  var btn = document.getElementById('notes-render-toggle-btn');

  if (textarea) textarea.style.display = 'none';
  if (liveDiv) liveDiv.style.display = 'none';
  if (rendered) rendered.style.display = 'none';

  if (mode === 'source') {
    if (textarea) { textarea.style.display = ''; autoGrowNote(textarea); }
    if (toolbar) toolbar.style.display = '';
    _updateRenderToggleBtn(btn, 'source');
  } else if (mode === 'live') {
    _nlpBuild();
    if (liveDiv) liveDiv.style.display = '';
    if (toolbar) toolbar.style.display = '';
    // Entering live mode: register selectionchange listener
    document.addEventListener('selectionchange', _nlpOnSelectionChange);
    // Register keydown, paste, input, focusout on live div
    if (liveDiv) {
      liveDiv.addEventListener('keydown', _nlpOnKeydown);
      liveDiv.addEventListener('paste', _nlpOnPaste);
      liveDiv.addEventListener('input', _nlpOnInput);
      liveDiv.addEventListener('focusout', _nlpOnFocusOut);
      // Touch fallback: register touchend if device supports touch
      if (_nlpTouchSupported) {
        liveDiv.addEventListener('touchend', _nlpOnTouchEnd);
      }
    }
    // Virtual keyboard handler: preserve active token on viewport resize
    if (_nlpTouchSupported && window.visualViewport) {
      _nlpViewportResizeHandler = _nlpOnViewportResize;
      window.visualViewport.addEventListener('resize', _nlpViewportResizeHandler);
    }
    _updateRenderToggleBtn(btn, 'live');
  } else if (mode === 'reading') {
    var text = textarea ? textarea.value : '';
    if (rendered) {
      var readingHtml = (typeof marked !== 'undefined' && marked.parse)
        ? marked.parse(text || '', { breaks: true })
        : '<pre>' + _escHtml(text || '') + '</pre>';
      // Sanitize via DOMPurify to prevent XSS (Requirement 11.2)
      if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
        readingHtml = DOMPurify.sanitize(readingHtml, { ADD_ATTR: ['rel'] });
      }
      rendered.innerHTML = readingHtml;
      rendered.style.display = 'block';
    }
    if (toolbar) toolbar.style.display = 'none';
    _updateRenderToggleBtn(btn, 'reading');
  }
}

function _updateRenderToggleBtn(btn, mode) {
  if (!btn) return;
  btn.classList.remove('mode-edit', 'mode-live', 'mode-rendered');
  if (mode === 'source') {
    btn.innerHTML = '<i class="fas fa-code"></i> Source';
    btn.classList.add('mode-edit');
    btn.title = 'Source → Live Preview → Reading';
  } else if (mode === 'live') {
    btn.innerHTML = '<i class="fas fa-magic"></i> Live';
    btn.classList.add('mode-live');
    btn.title = 'Live Preview → Reading → Source';
  } else {
    btn.innerHTML = '<i class="fas fa-eye"></i> Reading';
    btn.classList.add('mode-rendered');
    btn.title = 'Reading → Source → Live Preview';
  }
}

function toggleNotesViewMode(event) { _cycleNotesRenderMode(event); }

// ══════════════════════════════════════════════════════════════════════════
// LIVE PREVIEW ENGINE — token-level Obsidian-style
//
// Architecture:
// - The contenteditable div (#notesLivePreview) contains one <div.nlp-line>
//   per line of markdown.
// - Each line is parsed into inline tokens. Each token becomes a <span>:
//     <span class="nlp-tok" data-raw="**bold**">bold</span>
//   Plain text tokens have no wrapper (just text nodes between spans).
// - The token whose character range contains the cursor shows its RAW text
//   (the data-raw value). All other tokens show rendered HTML.
// - On every cursor movement (selectionchange), we detect which token the
//   cursor is in and swap it to raw / swap the old one back to rendered.
//
// This gives word/token-level granularity: `**XYZ** _abc_` with cursor in
// XYZ shows `**XYZ** ` rendered-italic-abc. Only the touched token reveals
// its markdown syntax.
// ══════════════════════════════════════════════════════════════════════════

// ── Inline Tokenizer ─────────────────────────────────────────────────────
// Regex-based tokenizer that splits a line into tokens.
// Each token: { raw: '**text**', rendered: '<strong>text</strong>', type: 'bold' }
// Plain text segments: { raw: 'hello', rendered: 'hello', type: 'text' }

// Token patterns in priority order:
// 1. Code (backticks) — first to prevent inner parsing
// 2. Images — before links since ![...] starts with ! before [
// 3. Links — [text](url)
// 4. Chit links — [[title]]
// 5. Bold+Italic — **_text_** (must come before bold and italic individually)
// 6. Bold — ** only (never __)
// 7. Italic — _ only (never *)
// 8. Strikethrough — ~~text~~
var _nlpTokenPatterns = [
  { type: 'code',       re: /`([^`]+)`/ },
  { type: 'image',      re: /!\[([^\]]*)\]\(([^)]*)\)/ },
  { type: 'link',       re: /\[([^\]]*)\]\(([^)]*)\)/ },
  { type: 'chitlink',   re: /\[\[([^\]]+)\]\]/ },
  { type: 'bolditalic', re: /\*\*_(.+?)_\*\*/ },
  { type: 'bold',       re: /\*\*(.+?)\*\*/ },
  { type: 'italic',     re: /(?<!\w)_(.+?)_(?!\w)/ },
  { type: 'strike',     re: /~~(.+?)~~/ },
];

/**
 * Tokenize a single line into an array of token objects.
 * Each token: { raw, html, start, end, type }
 *   raw  = the original markdown characters (e.g. "**bold**")
 *   html = the rendered HTML (e.g. "<strong>bold</strong>")
 *   start = character offset within the line (0-based, inclusive)
 *   end   = character offset end (exclusive)
 *   type  = token type string, or undefined for plain text
 *
 * Invariants:
 *   - Tokens are ordered by start offset
 *   - Token boundaries are non-overlapping and contiguous
 *   - Concatenating all token raw values reproduces the original line
 *   - Bold uses ** exclusively (never __). Italic uses _ exclusively (never *).
 */
function _nlpTokenize(line) {
  // Handle empty/whitespace-only input
  if (!line && line !== '') return [{ raw: '', html: '', start: 0, end: 0 }];
  if (line === '') return [{ raw: '', html: '', start: 0, end: 0 }];

  var tokens = [];
  var remaining = line;
  var offset = 0;

  while (remaining.length > 0) {
    var earliest = null;
    var earliestIdx = remaining.length;
    var earliestPattern = null;

    // Find the earliest matching pattern in priority order
    for (var p = 0; p < _nlpTokenPatterns.length; p++) {
      var match = _nlpTokenPatterns[p].re.exec(remaining);
      if (match && match.index < earliestIdx) {
        earliest = match;
        earliestIdx = match.index;
        earliestPattern = _nlpTokenPatterns[p];
      }
    }

    if (!earliest) {
      // No more patterns — rest is plain text
      tokens.push({ raw: remaining, html: _escHtml(remaining), start: offset, end: offset + remaining.length });
      break;
    }

    // Plain text before the match
    if (earliestIdx > 0) {
      var plain = remaining.substring(0, earliestIdx);
      tokens.push({ raw: plain, html: _escHtml(plain), start: offset, end: offset + plain.length });
      offset += plain.length;
    }

    // The matched token
    var rawTok = earliest[0];
    var htmlTok = _nlpRenderToken(earliestPattern.type, earliest);
    tokens.push({ raw: rawTok, html: htmlTok, start: offset, end: offset + rawTok.length, type: earliestPattern.type });
    offset += rawTok.length;
    remaining = remaining.substring(earliestIdx + rawTok.length);
  }

  // If no tokens were produced (shouldn't happen, but safety), return plain text token
  if (tokens.length === 0) {
    return [{ raw: line, html: _escHtml(line), start: 0, end: line.length }];
  }

  return tokens;
}

/**
 * Render a single token match to sanitized HTML.
 * Adds rel="noopener noreferrer" to link anchors for security.
 * Uses DOMPurify where available for sanitization.
 */
function _nlpRenderToken(type, match) {
  var html = '';
  switch (type) {
    case 'code':
      html = '<code>' + _escHtml(match[1]) + '</code>';
      break;
    case 'bolditalic':
      html = '<strong><em>' + _escHtml(match[1]) + '</em></strong>';
      break;
    case 'bold':
      html = '<strong>' + _escHtml(match[1]) + '</strong>';
      break;
    case 'italic':
      html = '<em>' + _escHtml(match[1]) + '</em>';
      break;
    case 'strike':
      html = '<s>' + _escHtml(match[1]) + '</s>';
      break;
    case 'link':
      html = '<a href="' + _escAttr(match[2]) + '" rel="noopener noreferrer">' + _escHtml(match[1]) + '</a>';
      break;
    case 'image':
      html = '<img alt="' + _escAttr(match[1]) + '" src="' + _escAttr(match[2]) + '" style="max-width:100%;max-height:60px;">';
      break;
    case 'chitlink':
      html = '<a class="nlp-chitlink">' + _escHtml(match[1]) + '</a>';
      break;
    default:
      html = _escHtml(match[0]);
      break;
  }
  // Sanitize via DOMPurify if available
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(html, { ADD_ATTR: ['rel'] });
  }
  return html;
}

/**
 * Parse a single line for block-level classification and inline tokenization.
 *
 * Returns a ParsedLine object — one of:
 *   { isHr: true, raw: string }
 *   { heading: number, tokens: Token[], raw: string }
 *   { bullet: true, indent: number, tokens: Token[], raw: string }
 *   { ordered: string, indent: number, tokens: Token[], raw: string }
 *   { check: boolean, indent: number, tokens: Token[], raw: string }
 *   { quote: true, tokens: Token[], raw: string }
 *   { tokens: Token[], raw: string }  // plain paragraph
 *
 * Indentation is measured by counting leading spaces (each 2 spaces = 1 indent level).
 */
function _nlpParseLine(line) {
  // Horizontal rule: line is ONLY --- (exactly three or more dashes) with optional
  // leading/trailing whitespace. Nothing else on the line.
  if (/^\s*-{3,}\s*$/.test(line)) {
    return { isHr: true, raw: line };
  }

  // Heading: # through ###### followed by a space and content
  var hMatch = line.match(/^(#{1,6})\s+(.*)/);
  if (hMatch) {
    return { heading: hMatch[1].length, tokens: _nlpTokenize(hMatch[2]), raw: line };
  }

  // Checkbox: optional indent + bullet (- * +) + space + [ ] or [x]/[X] + space + content
  var checkMatch = line.match(/^(\s*)([-*+])\s\[([ xX])\]\s(.*)/);
  if (checkMatch) {
    var checkIndentSpaces = checkMatch[1].length;
    var checkIndentLevel = Math.floor(checkIndentSpaces / 2);
    return { check: checkMatch[3].toLowerCase() === 'x', indent: checkIndentLevel, tokens: _nlpTokenize(checkMatch[4]), raw: line };
  }

  // Unordered list: optional indent + bullet (- * +) + space + content
  var ulMatch = line.match(/^(\s*)([-*+])\s(.*)/);
  if (ulMatch) {
    var ulIndentSpaces = ulMatch[1].length;
    var ulIndentLevel = Math.floor(ulIndentSpaces / 2);
    return { bullet: true, indent: ulIndentLevel, tokens: _nlpTokenize(ulMatch[3]), raw: line };
  }

  // Ordered list: optional indent + digits + . or ) + space + content
  var olMatch = line.match(/^(\s*)(\d+[.)]) (.*)/);
  if (olMatch) {
    var olIndentSpaces = olMatch[1].length;
    var olIndentLevel = Math.floor(olIndentSpaces / 2);
    return { ordered: olMatch[2], indent: olIndentLevel, tokens: _nlpTokenize(olMatch[3]), raw: line };
  }

  // Blockquote: > with optional space, then content
  var quoteMatch = line.match(/^\s*>\s?(.*)/);
  if (quoteMatch) {
    return { quote: true, tokens: _nlpTokenize(quoteMatch[1]), raw: line };
  }

  // Plain paragraph — no block prefix
  return { tokens: _nlpTokenize(line), raw: line };
}

// ── DOM Building ─────────────────────────────────────────────────────────

/**
 * Build the live preview DOM from textarea content.
 * Reads the textarea value, splits into lines, builds one div.nlp-line per
 * line with data-line-idx and data-raw attributes. Clears the live preview
 * div and appends all line divs. Ensures at least one empty line div exists.
 */
function _nlpBuild() {
  var liveDiv = document.getElementById('notesLivePreview');
  var ta = document.getElementById('note');
  if (!liveDiv || !ta) return;

  var md = ta.value || '';
  var lines = md.split('\n');

  // Clear existing content and reset active token state
  liveDiv.innerHTML = '';
  _nlpActiveTokenEl = null;

  for (var i = 0; i < lines.length; i++) {
    var lineDiv = _nlpBuildLine(lines[i], i);
    liveDiv.appendChild(lineDiv);
  }

  // Ensure at least one empty line div exists for new/empty notes
  if (liveDiv.children.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'nlp-line';
    empty.dataset.lineIdx = '0';
    empty.dataset.raw = '';
    empty.innerHTML = '<br>';
    liveDiv.appendChild(empty);
  }
}

/**
 * Build a single line's DOM element from raw markdown.
 * Creates a div.nlp-line with CSS classes for block type, creates span.nlp-tok
 * per token with data-raw attribute and rendered innerHTML. Applies block-level
 * CSS classes and builds non-editable prefix spans for lists/quotes/checkboxes.
 * Handles empty lines with <br> for editability. Sanitizes all rendered HTML
 * via DOMPurify to prevent XSS.
 *
 * @param {string} rawLine - The raw markdown line
 * @param {number} idx - Line index for data-line-idx attribute
 * @returns {HTMLDivElement} - The constructed line element
 */
function _nlpBuildLine(rawLine, idx) {
  var div = document.createElement('div');
  div.className = 'nlp-line';
  div.dataset.lineIdx = String(idx);
  div.dataset.raw = rawLine;

  var parsed = _nlpParseLine(rawLine);

  // ── Horizontal rule: special case — render <hr> element inside the line div
  if (parsed.isHr) {
    div.classList.add('nlp-line-hr');
    div.innerHTML = '<hr class="nlp-hr">';
    return div;
  }

  // ── Apply block-level CSS classes
  if (parsed.heading) {
    div.classList.add('nlp-line-h' + parsed.heading);
  }
  if (parsed.quote) {
    div.classList.add('nlp-line-quote');
  }
  if (parsed.bullet || parsed.ordered) {
    div.classList.add('nlp-line-list');
    if (parsed.indent) div.style.paddingLeft = (parsed.indent * 24 + 16) + 'px';
  }
  if (parsed.check !== undefined) {
    div.classList.add('nlp-line-check');
    if (parsed.indent) div.style.paddingLeft = (parsed.indent * 24 + 16) + 'px';
  }

  // ── Build non-editable prefix spans for lists/checkboxes/quotes
  // Note: headings do NOT get a prefix span — the heading CSS class handles
  // visual styling, and _nlpParseLine strips the prefix from the content tokens.
  var prefixHtml = '';
  if (parsed.bullet) {
    prefixHtml = '<span class="nlp-prefix" contenteditable="false">• </span>';
  } else if (parsed.ordered) {
    prefixHtml = '<span class="nlp-prefix" contenteditable="false">' + _escHtml(parsed.ordered) + ' </span>';
  } else if (parsed.check !== undefined) {
    var checkIcon = parsed.check ? '☑ ' : '☐ ';
    prefixHtml = '<span class="nlp-prefix" contenteditable="false">' + checkIcon + '</span>';
  } else if (parsed.quote) {
    prefixHtml = '<span class="nlp-prefix nlp-quote-mark" contenteditable="false">┃ </span>';
  }

  // ── Build token spans (skip empty tokens for empty lines)
  var tokensHtml = '';
  var tokens = parsed.tokens || [];
  for (var t = 0; t < tokens.length; t++) {
    var tok = tokens[t];
    // Skip empty tokens (produced by tokenizing empty string)
    if (!tok.raw && !tok.html) continue;

    var sanitizedHtml = tok.html;

    // Sanitize rendered HTML via DOMPurify to prevent XSS
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      sanitizedHtml = DOMPurify.sanitize(sanitizedHtml, { ADD_ATTR: ['rel'] });
    }

    if (tok.type) {
      // Formatted token — wrap in span with type-specific class and data-raw
      tokensHtml += '<span class="nlp-tok nlp-tok-' + tok.type + '" data-raw="' + _escAttr(tok.raw) + '">' + sanitizedHtml + '</span>';
    } else {
      // Plain text token — wrap in span for cursor detection
      tokensHtml += '<span class="nlp-tok nlp-tok-text" data-raw="' + _escAttr(tok.raw) + '">' + _escHtml(tok.raw) + '</span>';
    }
  }

  // Assemble the line: prefix + token spans
  div.innerHTML = prefixHtml + tokensHtml;

  // Handle empty lines: insert <br> to maintain editability in contenteditable
  if (!div.textContent.trim() && !div.querySelector('.nlp-tok')) {
    div.innerHTML = '<br>';
  }

  return div;
}

/**
 * Extract full markdown from the live preview DOM.
 *
 * Iterates all .nlp-line elements and reconstructs each line's raw markdown.
 * For lines containing the active token, rebuilds from token data to capture
 * in-progress edits. Joins lines with \n and syncs result back to the hidden
 * textarea.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
function _nlpExtract() {
  var liveDiv = document.getElementById('notesLivePreview');
  if (!liveDiv) {
    var ta = document.getElementById('note');
    return ta ? ta.value : '';
  }
  var lineEls = liveDiv.querySelectorAll('.nlp-line');
  if (lineEls.length === 0) {
    var ta2 = document.getElementById('note');
    return ta2 ? ta2.value : '';
  }

  var parts = [];
  for (var i = 0; i < lineEls.length; i++) {
    var el = lineEls[i];
    var raw;

    // If the active token is in this line, rebuild from tokens to capture edits
    if (_nlpActiveTokenEl && el.contains(_nlpActiveTokenEl)) {
      raw = _nlpExtractLineRaw(el);
    } else {
      // Use stored data-raw (already up-to-date from deactivation)
      raw = el.dataset.raw;

      // DOM desync recovery (Requirement 12.2): if data-raw is missing/empty but
      // the line has visible text content with no .nlp-tok children, read textContent
      var lineToks = el.querySelectorAll('.nlp-tok');
      if (lineToks.length === 0 && !el.classList.contains('nlp-line-hr')) {
        var textFallback = el.textContent || '';
        if (textFallback.trim() && (!raw || !raw.trim())) {
          raw = textFallback;
        }
      }
    }
    parts.push(raw != null ? raw : '');
  }

  var result = parts.join('\n');

  // Sync result back to hidden textarea
  var textarea = document.getElementById('note');
  if (textarea) textarea.value = result;

  return result;
}

/**
 * Rebuild a single line's raw markdown from its prefix + token data-raw values.
 *
 * Logic:
 * - HR lines (class nlp-line-hr): return the line's data-raw directly (no editable tokens)
 * - Empty lines (no .nlp-tok children, just <br>): return empty string
 * - All other lines: extract the block prefix from the original data-raw, then
 *   concatenate all .nlp-tok children's data-raw values (or textContent for the
 *   active token to capture in-progress edits)
 *
 * The prefix is determined by parsing the original data-raw to find what
 * _nlpParseLine would strip before tokenizing inline content.
 *
 * Requirements: 9.1, 9.2
 */
function _nlpExtractLineRaw(lineEl) {
  if (!lineEl) return '';

  // HR lines have no editable tokens — return stored data-raw
  if (lineEl.classList.contains('nlp-line-hr')) {
    return lineEl.dataset.raw || '';
  }

  var toks = lineEl.querySelectorAll('.nlp-tok');

  // DOM desync recovery (Requirement 12.2): if no .nlp-tok children found in a
  // line that has visible text content, fall back to reading textContent directly.
  // Empty lines (just <br>, no tokens) still return empty string.
  if (toks.length === 0) {
    var fallbackText = lineEl.textContent || '';
    // If the line has actual text content but no token spans, DOM is desynchronized
    if (fallbackText.trim()) {
      return fallbackText;
    }
    return '';
  }

  // Determine the block prefix from the original data-raw.
  // The prefix is everything _nlpParseLine strips before tokenizing inline content.
  var originalRaw = lineEl.dataset.raw || '';
  var prefix = _nlpExtractPrefix(originalRaw);

  // Concatenate all token raw values; for the active token, read textContent
  var content = '';
  for (var i = 0; i < toks.length; i++) {
    var tok = toks[i];
    if (tok === _nlpActiveTokenEl) {
      // Active token: read textContent to capture in-progress edits
      content += tok.textContent || '';
    } else {
      // Inactive token: read data-raw
      content += tok.dataset.raw || '';
    }
  }

  return prefix + content;
}

/**
 * Extract the block-level prefix from a raw markdown line.
 * Returns the prefix string that _nlpParseLine would strip before tokenizing.
 * This preserves the exact original prefix characters (including indentation).
 *
 * Examples:
 *   "## Hello"       → "## "
 *   "- list item"    → "- "
 *   "  - nested"     → "  - "
 *   "1. ordered"     → "1. "
 *   "- [ ] checkbox" → "- [ ] "
 *   "- [x] checked"  → "- [x] "
 *   "> quote"        → "> "
 *   ">quote"         → ">"
 *   "plain text"     → ""
 */
function _nlpExtractPrefix(line) {
  if (!line) return '';

  // Horizontal rule — entire line is the prefix (no inline content)
  if (/^\s*-{3,}\s*$/.test(line)) {
    return line;
  }

  // Heading: # through ###### followed by space
  var hMatch = line.match(/^(#{1,6}\s+)/);
  if (hMatch) return hMatch[1];

  // Checkbox: optional indent + bullet + space + [x]/[ ] + space
  var checkMatch = line.match(/^(\s*[-*+]\s\[[ xX]\]\s)/);
  if (checkMatch) return checkMatch[1];

  // Unordered list: optional indent + bullet + space
  var ulMatch = line.match(/^(\s*[-*+]\s)/);
  if (ulMatch) return ulMatch[1];

  // Ordered list: optional indent + digits + . or ) + space
  var olMatch = line.match(/^(\s*\d+[.)]\s)/);
  if (olMatch) return olMatch[1];

  // Blockquote: > with optional space
  var quoteMatch = line.match(/^(\s*>\s?)/);
  if (quoteMatch) return quoteMatch[1];

  // Plain paragraph — no prefix
  return '';
}

// ── Cursor Tracking & Token Activation ───────────────────────────────────

/**
 * Called on every `document` selectionchange event. Detects which token the
 * cursor is in and activates it (shows raw), deactivating the previous one
 * (re-renders). Registered when entering live mode, removed when leaving.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
function _nlpOnSelectionChange() {
  if (_notesRenderMode !== 'live') return;

  var liveDiv = document.getElementById('notesLivePreview');
  if (!liveDiv) return;

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  var anchorNode = sel.anchorNode;
  if (!anchorNode) return;

  // Verify cursor is within #notesLivePreview div
  if (!liveDiv.contains(anchorNode)) return;

  console.log('[NLP selChange] anchorNode:', anchorNode.nodeType === 3 ? 'TEXT("' + anchorNode.textContent.substring(0,30) + '")' : anchorNode.tagName + '.' + anchorNode.className);

  // Walk up DOM from sel.anchorNode to find .nlp-tok ancestor
  var tokEl = (anchorNode.nodeType === 3) ? anchorNode.parentElement : anchorNode;

  // Special case: if the text node is a direct child of .nlp-line (browser inserted
  // text outside of any token span), we need to absorb it into a token
  if (anchorNode.nodeType === 3 && tokEl && tokEl.classList && tokEl.classList.contains('nlp-line')) {
    var lineDiv = tokEl;
    // Only do this if the line has NO .nlp-tok spans (truly bare text in the div)
    if (lineDiv.querySelectorAll('.nlp-tok').length === 0) {
      var fullText = lineDiv.textContent || '';
      var curPos = sel.getRangeAt(0).startOffset;
      console.log('[NLP selChange] TEXT IN LINE DIV — wrapping. fullText="' + fullText + '", curPos=' + curPos);
      // Deactivate any current token first
      if (_nlpActiveTokenEl) {
        _nlpActiveTokenEl.dataset.raw = _nlpActiveTokenEl.textContent || '';
        _nlpActiveTokenEl.classList.remove('nlp-active');
        _nlpActiveTokenEl = null;
      }
      // Use fullText directly as the line's raw (it's exactly what the user typed)
      lineDiv.dataset.raw = fullText;
      var lineIdx = parseInt(lineDiv.dataset.lineIdx) || 0;
      var rebuilt = _nlpBuildLine(fullText, lineIdx);
      lineDiv.parentNode.replaceChild(rebuilt, lineDiv);
      // Place cursor in the rebuilt line
      var firstTok = rebuilt.querySelector('.nlp-tok');
      if (firstTok) {
        _nlpActivateToken(firstTok);
        _nlpPlaceCursor(firstTok, curPos);
      }
      return;
    }
  }

  while (tokEl && tokEl !== liveDiv) {
    if (tokEl.classList && tokEl.classList.contains('nlp-tok')) break;
    if (tokEl.classList && (tokEl.classList.contains('nlp-line') || tokEl.classList.contains('nlp-prefix'))) {
      tokEl = null;
      break;
    }
    tokEl = tokEl.parentElement;
  }
  // If we walked all the way up to liveDiv without finding .nlp-tok, no token
  if (tokEl === liveDiv) tokEl = null;

  console.log('[NLP selChange] tokEl:', tokEl ? ('SPAN.nlp-tok raw="' + (tokEl.dataset.raw||'').substring(0,20) + '"') : 'null', '| activeTokenEl:', _nlpActiveTokenEl ? ('raw="' + (_nlpActiveTokenEl.dataset.raw||'').substring(0,20) + '"') : 'null');

  // Compare found token with _nlpActiveTokenEl — no-op if same token
  if (tokEl === _nlpActiveTokenEl) return;

  // Deactivate old token before activating new token
  if (_nlpActiveTokenEl) {
    console.log('[NLP selChange] DEACTIVATING old token, raw="' + (_nlpActiveTokenEl.dataset.raw||'').substring(0,30) + '", textContent="' + (_nlpActiveTokenEl.textContent||'').substring(0,30) + '"');
    _nlpDeactivateToken(_nlpActiveTokenEl);
  }

  // If cursor is in whitespace/prefix/empty area (no .nlp-tok ancestor),
  // deactivate current token without activating new one.
  // Special case: if cursor is in an empty line (just <br>), create a token span.
  if (tokEl) {
    console.log('[NLP selChange] ACTIVATING token, raw="' + (tokEl.dataset.raw||'').substring(0,30) + '"');
    _nlpActivateToken(tokEl);
  } else {
    // Check if cursor is in a line with no token spans — create one for typing
    var cursorLine = anchorNode;
    if (cursorLine && cursorLine.nodeType === 3) cursorLine = cursorLine.parentElement;
    while (cursorLine && !cursorLine.classList.contains('nlp-line')) cursorLine = cursorLine.parentElement;
    if (cursorLine && cursorLine.querySelectorAll('.nlp-tok').length === 0 && !cursorLine.classList.contains('nlp-line-hr')) {
      // Grab any text the browser already inserted before we restructure
      var existingText = cursorLine.textContent || '';
      // Figure out where the cursor is within that text
      var curPos = 0;
      if (sel.rangeCount && anchorNode.nodeType === 3) {
        curPos = sel.getRangeAt(0).startOffset;
      } else {
        curPos = existingText.length;
      }
      console.log('[NLP selChange] EMPTY LINE — creating token. existingText="' + existingText + '", curPos=' + curPos + ', lineIdx=' + cursorLine.dataset.lineIdx);
      // Create a token span with the existing text
      var newTok = document.createElement('span');
      newTok.className = 'nlp-tok nlp-tok-text nlp-active';
      newTok.dataset.raw = existingText;
      newTok.textContent = existingText;
      cursorLine.innerHTML = '';
      cursorLine.appendChild(newTok);
      cursorLine.dataset.raw = existingText;
      _nlpActiveTokenEl = newTok;
      // Restore cursor position
      _nlpPlaceCursor(newTok, curPos);
    } else {
      console.log('[NLP selChange] no token found, no empty line case. cursorLine:', cursorLine ? cursorLine.dataset.lineIdx : 'null');
    }
  }
}

/**
 * Activate a token: show its raw markdown text instead of rendered HTML.
 * Sets _nlpActiveTokenEl, adds .nlp-active CSS class, replaces innerHTML
 * with textContent set to data-raw value.
 *
 * Requirements: 4.2
 */
function _nlpActivateToken(tokEl) {
  if (!tokEl) return;
  _nlpActiveTokenEl = tokEl;
  tokEl.classList.add('nlp-active');
  // Replace span's innerHTML with textContent set to data-raw value
  // (shows raw markdown syntax)
  var raw = tokEl.dataset.raw || '';
  console.log('[NLP activate] raw="' + raw.substring(0,30) + '", current textContent="' + (tokEl.textContent||'').substring(0,30) + '", lineIdx=' + (tokEl.closest('.nlp-line') ? tokEl.closest('.nlp-line').dataset.lineIdx : '?'));
  tokEl.textContent = raw;
}

/**
 * Deactivate a token: save edits, re-tokenize, and re-render as formatted HTML.
 * Handles single-token, multi-token, and plain-text results from re-tokenization.
 * Updates parent line's data-raw attribute and marks document unsaved.
 *
 * Requirements: 4.3, 5.1, 5.2, 5.3, 5.4
 */
function _nlpDeactivateToken(tokEl) {
  if (!tokEl) return;

  // Save current textContent back to data-raw attribute
  var currentRaw = tokEl.textContent || '';
  tokEl.dataset.raw = currentRaw;
  var parentLine = tokEl.closest('.nlp-line');
  console.log('[NLP deactivate] currentRaw="' + currentRaw.substring(0,30) + '", line data-raw="' + (parentLine ? parentLine.dataset.raw : '?').substring(0,30) + '", lineIdx=' + (parentLine ? parentLine.dataset.lineIdx : '?'));

  // Remove .nlp-active CSS class
  tokEl.classList.remove('nlp-active');

  // Re-tokenize the saved raw text via _nlpTokenize()
  // Wrapped in try/catch for graceful degradation (Requirement 12.3):
  // if re-tokenization produces unexpected results or throws, render as plain text.
  var tokens;
  try {
    tokens = _nlpTokenize(currentRaw);
  } catch (e) {
    // Re-tokenization failed — fall back to plain text display without throwing
    tokEl.innerHTML = _escHtml(currentRaw);
    tokEl.className = 'nlp-tok nlp-tok-text';
    _nlpActiveTokenEl = null;
    var parentLineErr = tokEl.closest('.nlp-line');
    if (parentLineErr) {
      parentLineErr.dataset.raw = _nlpExtractLineRaw(parentLineErr);
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }

  if (tokens.length === 1 && tokens[0].type) {
    // Single formatted token result: update span's innerHTML with rendered HTML, update className
    var html = tokens[0].html;
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      html = DOMPurify.sanitize(html, { ADD_ATTR: ['rel'] });
    }
    tokEl.innerHTML = html;
    tokEl.className = 'nlp-tok nlp-tok-' + tokens[0].type;
  } else if (tokens.length > 1) {
    // Multiple tokens result: trigger _nlpRebuildLine() for the containing line
    var lineEl = tokEl.closest('.nlp-line');
    _nlpActiveTokenEl = null;
    if (lineEl) {
      try {
        lineEl.dataset.raw = _nlpExtractLineRaw(lineEl);
        _nlpRebuildLine(lineEl);
      } catch (e2) {
        // Line rebuild failed — render token as plain text (Requirement 12.3)
        tokEl.innerHTML = _escHtml(currentRaw);
        tokEl.className = 'nlp-tok nlp-tok-text';
      }
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  } else {
    // No valid formatting (single plain text token or empty): render as plain text token
    tokEl.innerHTML = _escHtml(currentRaw);
    tokEl.className = 'nlp-tok nlp-tok-text';
  }

  // Set _nlpActiveTokenEl = null
  _nlpActiveTokenEl = null;

  // Rebuild the line to re-parse block structure
  var parentLine2 = tokEl.closest('.nlp-line');
  if (parentLine2) {
    // Get the full raw: if line has a prefix span, tokens are content-only (prepend prefix)
    // If no prefix span, tokens contain everything the user typed
    var toks = parentLine2.querySelectorAll('.nlp-tok');
    var rawFromToks = '';
    for (var i = 0; i < toks.length; i++) {
      rawFromToks += toks[i].dataset.raw || '';
    }
    var prefixSpan = parentLine2.querySelector('.nlp-prefix');
    if (prefixSpan) {
      // Line was previously parsed — get the ORIGINAL prefix from data-raw
      // data-raw was set correctly when the line was first built
      var origRaw = parentLine2.dataset.raw || '';
      var origPrefix = _nlpExtractPrefix(origRaw);
      parentLine2.dataset.raw = origPrefix + rawFromToks;
    } else {
      parentLine2.dataset.raw = rawFromToks;
    }
    console.log('[NLP deactivate] rebuilding. data-raw="' + parentLine2.dataset.raw.substring(0,40) + '"');
    _nlpRebuildLine(parentLine2);
  }

  // Call setSaveButtonUnsaved()
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Rebuild a single line div from its data-raw attribute by calling _nlpParseLine
 * and reconstructing the token spans. Used when a deactivated token's text
 * produces multiple tokens on re-tokenization.
 *
 * @param {HTMLElement} lineEl - The .nlp-line div to rebuild
 */
function _nlpRebuildLine(lineEl) {
  if (!lineEl) return;

  // Use the line's data-raw as the source of truth
  var rawLine = lineEl.dataset.raw || '';

  // Rebuild the line DOM using _nlpBuildLine
  var idx = parseInt(lineEl.dataset.lineIdx) || 0;
  var newLine = _nlpBuildLine(rawLine, idx);

  // Replace in DOM
  if (lineEl.parentNode) {
    lineEl.parentNode.replaceChild(newLine, lineEl);
  }
}

/**
 * Handle touchend — fallback for browsers where selectionchange doesn't fire
 * reliably on touch. Triggers _nlpOnSelectionChange() after a short delay
 * to allow the browser to update the selection before we read it.
 *
 * Requirements: 13.1
 */
function _nlpOnTouchEnd() {
  setTimeout(_nlpOnSelectionChange, 50);
}

/**
 * Handle visualViewport resize — preserves active token state when the
 * virtual keyboard appears or disappears on mobile. Scrolls the active
 * token into view if needed.
 *
 * Requirements: 13.3
 */
function _nlpOnViewportResize() {
  if (_notesRenderMode !== 'live') return;
  // If there's an active token, ensure it stays visible
  if (_nlpActiveTokenEl && _nlpActiveTokenEl.scrollIntoViewIfNeeded) {
    _nlpActiveTokenEl.scrollIntoViewIfNeeded(false);
  } else if (_nlpActiveTokenEl && _nlpActiveTokenEl.scrollIntoView) {
    _nlpActiveTokenEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Handle focusout — deactivate the current token when focus leaves.
 */
function _nlpOnFocusOut() {
  var liveDiv = document.getElementById('notesLivePreview');
  if (!liveDiv) return;
  setTimeout(function() {
    if (!liveDiv.contains(document.activeElement) && document.activeElement !== liveDiv) {
      if (_nlpActiveTokenEl) {
        _nlpDeactivateToken(_nlpActiveTokenEl);
      }
    }
  }, 10);
}

/**
 * Handle input — mark unsaved. If the active token exists, update its data-raw
 * from textContent so the line stays in sync.
 */
function _nlpOnInput() {
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  // Just keep the active token's data-raw in sync — nothing else
  if (_nlpActiveTokenEl) {
    _nlpActiveTokenEl.dataset.raw = _nlpActiveTokenEl.textContent || '';
  }
}

/**
 * Handle keydown events in live preview: Enter (line split), Backspace at
 * line start (line merge), and format hotkeys (delegated to toolbar handler).
 *
 * Enter: Deactivate active token, get cursor offset in line, split line raw
 * text at cursor position, rebuild current line with text before cursor,
 * create new line div with text after cursor, re-index all lines, place
 * cursor at start of new line.
 *
 * Backspace at line start: Detect cursor at offset 0, merge current line with
 * previous line (concatenate raw texts), rebuild merged line, remove current
 * line, re-index, place cursor at merge point.
 *
 * Format hotkeys: Delegate to _getNotesFormatAction() → _notesFormatBtn().
 *
 * Requirements: 8.1, 8.2, 8.4
 */
function _nlpOnKeydown(e) {
  // ── Cmd/Ctrl+Arrow: jump to start/end of line ──
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    var lineEl = node;
    while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
    if (!lineEl) return;

    // Deactivate current token
    if (_nlpActiveTokenEl) {
      _nlpActiveTokenEl.dataset.raw = _nlpActiveTokenEl.textContent || '';
      _nlpActiveTokenEl.classList.remove('nlp-active');
      _nlpActiveTokenEl = null;
    }

    var toks = lineEl.querySelectorAll('.nlp-tok');
    if (toks.length === 0) return;

    if (e.key === 'ArrowRight') {
      // Jump to end of last token
      var lastTok = toks[toks.length - 1];
      _nlpActivateToken(lastTok);
      _nlpPlaceCursor(lastTok, (lastTok.textContent || '').length);
    } else {
      // Jump to start of first token
      var firstTok = toks[0];
      _nlpActivateToken(firstTok);
      _nlpPlaceCursor(firstTok, 0);
    }
    return;
  }

  // ── Format hotkeys — delegate to toolbar handler (implemented in task 10)
  if (typeof _getNotesFormatAction === 'function') {
    var action = _getNotesFormatAction(e);
    if (action) {
      e.preventDefault();
      if (typeof _notesFormatBtn === 'function') _notesFormatBtn(action);
      return;
    }
  }

  // ── Enter: split current line at cursor position ──
  if (e.key === 'Enter') {
    e.preventDefault();

    // Get current selection BEFORE deactivating (deactivation destroys cursor pos)
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    // Find the containing .nlp-line element
    var lineEl = sel.anchorNode;
    if (lineEl && lineEl.nodeType === 3) lineEl = lineEl.parentElement;
    while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
    if (!lineEl) return;

    // Get cursor offset within token content BEFORE deactivation
    var cursorInLine = _nlpGetCursorOffsetInLine(lineEl);

    // Build the full raw line from current state (including active token's live text)
    var fullRaw = _nlpExtractLineRaw(lineEl);

    // Determine prefix so we know where content starts
    var prefix = _nlpExtractPrefix(fullRaw);
    var splitPos = prefix.length + cursorInLine;
    if (splitPos > fullRaw.length) splitPos = fullRaw.length;

    // Now deactivate (we don't need the DOM state anymore)
    if (_nlpActiveTokenEl) {
      _nlpActiveTokenEl.dataset.raw = _nlpActiveTokenEl.textContent || '';
      _nlpActiveTokenEl.classList.remove('nlp-active');
      _nlpActiveTokenEl = null;
    }

    // Split line raw text at cursor position
    var before = fullRaw.substring(0, splitPos);
    var after = fullRaw.substring(splitPos);

    // Rebuild current line with text before cursor
    var idx = parseInt(lineEl.dataset.lineIdx) || 0;
    var newCurrent = _nlpBuildLine(before, idx);
    lineEl.parentNode.replaceChild(newCurrent, lineEl);

    // Create new line div with text after cursor
    var newLine = _nlpBuildLine(after, idx + 1);
    newCurrent.after(newLine);

    // Re-index all lines
    _nlpReindex();

    // Place cursor at start of new line
    var firstTok = newLine.querySelector('.nlp-tok');
    if (firstTok) {
      _nlpActivateToken(firstTok);
      _nlpPlaceCursor(firstTok, 0);
    } else {
      // Empty line — place cursor in the line div itself
      var range = document.createRange();
      range.selectNodeContents(newLine);
      range.collapse(true);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }

    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }

  // ── Backspace at line start: merge with previous line ──
  if (e.key === 'Backspace') {
    var sel2 = window.getSelection();
    if (!sel2 || !sel2.rangeCount) return;

    // Find the containing .nlp-line element
    var lineEl2 = sel2.anchorNode;
    if (lineEl2 && lineEl2.nodeType === 3) lineEl2 = lineEl2.parentElement;
    while (lineEl2 && !lineEl2.classList.contains('nlp-line')) lineEl2 = lineEl2.parentElement;
    if (!lineEl2) return;

    // Detect cursor at offset 0
    var offsetInLine = _nlpGetCursorOffsetInLine(lineEl2);
    if (offsetInLine !== 0) return; // Not at line start — let browser handle normally
    if (!lineEl2.previousElementSibling) return; // First line — nothing to merge with

    e.preventDefault();

    // Deactivate active token before merge
    if (_nlpActiveTokenEl) {
      _nlpDeactivateToken(_nlpActiveTokenEl);
    }

    // Get previous line and both lines' raw text
    var prevLine = lineEl2.previousElementSibling;
    var prevRaw = prevLine.dataset.raw || '';
    var curRaw = lineEl2.dataset.raw || '';

    // Concatenate raw texts to form merged line
    var mergedRaw = prevRaw + curRaw;

    // Cursor position = end of previous line's content (merge point)
    var cursorPos = prevRaw.length;

    // Remove current line from DOM
    lineEl2.remove();

    // Rebuild merged line
    var idx2 = parseInt(prevLine.dataset.lineIdx) || 0;
    var rebuilt = _nlpBuildLine(mergedRaw, idx2);
    prevLine.parentNode.replaceChild(rebuilt, prevLine);

    // Re-index all lines
    _nlpReindex();

    // Place cursor at merge point
    _nlpPlaceCursorAtOffset(rebuilt, cursorPos);

    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }
}

/**
 * Handle paste events in live preview: intercept paste, extract plain text
 * only, strip all HTML tags and scripts, insert at cursor position. If
 * multi-line paste, split into multiple line divs. Rebuild affected lines
 * and re-index. Mark document as unsaved.
 *
 * Requirements: 8.3, 11.4
 */
function _nlpOnPaste(e) {
  e.preventDefault();

  // Extract plain text only from clipboard
  var text = '';
  if (e.clipboardData && e.clipboardData.getData) {
    text = e.clipboardData.getData('text/plain') || '';
  }

  // Strip all HTML tags and scripts as a safety measure
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<[^>]+>/g, '');

  if (!text) return;

  // Deactivate active token (save in-progress edits)
  if (_nlpActiveTokenEl) {
    _nlpDeactivateToken(_nlpActiveTokenEl);
  }

  var liveDiv = document.getElementById('notesLivePreview');
  if (!liveDiv) return;

  // Get current selection and find the containing line
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  var lineEl = sel.anchorNode;
  if (lineEl && lineEl.nodeType === 3) lineEl = lineEl.parentElement;
  while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
  if (!lineEl) return;

  // Get cursor offset within the line's raw text
  var cursorInLine = _nlpGetCursorOffsetInLine(lineEl);
  var lineRaw = lineEl.dataset.raw || '';

  // Split line at cursor position
  var beforeCursor = lineRaw.substring(0, cursorInLine);
  var afterCursor = lineRaw.substring(cursorInLine);

  // Split pasted text into lines
  var pastedLines = text.split('\n');

  if (pastedLines.length === 1) {
    // Single-line paste: insert text at cursor position within current line
    var newRaw = beforeCursor + pastedLines[0] + afterCursor;
    var idx = parseInt(lineEl.dataset.lineIdx) || 0;
    var rebuilt = _nlpBuildLine(newRaw, idx);
    lineEl.parentNode.replaceChild(rebuilt, lineEl);

    // Re-index and place cursor after inserted text
    _nlpReindex();
    _nlpPlaceCursorAtOffset(rebuilt, beforeCursor.length + pastedLines[0].length);
  } else {
    // Multi-line paste: split into multiple line divs
    var parent = lineEl.parentNode;
    var nextSibling = lineEl.nextSibling;
    var baseIdx = parseInt(lineEl.dataset.lineIdx) || 0;

    // Remove the original line
    lineEl.remove();

    // Build new lines:
    // First line = text before cursor + first pasted line
    // Middle lines = pasted lines as-is
    // Last line = last pasted line + text after cursor
    var newLines = [];
    for (var i = 0; i < pastedLines.length; i++) {
      var raw;
      if (i === 0) {
        raw = beforeCursor + pastedLines[i];
      } else if (i === pastedLines.length - 1) {
        raw = pastedLines[i] + afterCursor;
      } else {
        raw = pastedLines[i];
      }
      var newLineDiv = _nlpBuildLine(raw, baseIdx + i);
      newLines.push(newLineDiv);
    }

    // Insert all new lines into the DOM
    for (var j = 0; j < newLines.length; j++) {
      if (nextSibling) {
        parent.insertBefore(newLines[j], nextSibling);
      } else {
        parent.appendChild(newLines[j]);
      }
    }

    // Re-index all lines
    _nlpReindex();

    // Place cursor at end of last pasted line's content (before afterCursor)
    var lastLine = newLines[newLines.length - 1];
    var lastPastedText = pastedLines[pastedLines.length - 1];
    _nlpPlaceCursorAtOffset(lastLine, lastPastedText.length);
  }

  // Mark document as unsaved
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Get cursor character offset within a line (counting raw characters).
 */
function _nlpGetCursorOffsetInLine(lineEl) {
  var sel = window.getSelection();
  if (!sel.rangeCount) return 0;

  // Walk through tokens and count characters up to cursor
  var toks = lineEl.querySelectorAll('.nlp-tok');
  var range = sel.getRangeAt(0);
  var offset = 0;

  for (var i = 0; i < toks.length; i++) {
    var tok = toks[i];
    if (tok.contains(range.startContainer) || tok === range.startContainer) {
      // Cursor is in this token
      var innerOffset = 0;
      if (range.startContainer.nodeType === 3) {
        innerOffset = range.startOffset;
      }
      // If token is active, innerOffset is direct character position
      if (tok.classList.contains('nlp-active')) {
        return offset + innerOffset;
      }
      // If token is rendered, we approximate (use proportion of raw length)
      return offset + Math.min(innerOffset, (tok.dataset.raw || '').length);
    }
    // Count this token's raw length
    offset += (tok.dataset.raw || '').length;
  }
  return offset;
}

/**
 * Place cursor at a character offset within a line.
 */
function _nlpPlaceCursorAtOffset(lineEl, charOffset) {
  var toks = lineEl.querySelectorAll('.nlp-tok');
  var offset = 0;
  for (var i = 0; i < toks.length; i++) {
    var tok = toks[i];
    var rawLen = (tok.dataset.raw || '').length;
    if (offset + rawLen >= charOffset) {
      // Cursor goes in this token
      _nlpActivateToken(tok);
      var posInTok = charOffset - offset;
      _nlpPlaceCursor(tok, posInTok);
      return;
    }
    offset += rawLen;
  }
  // Past end — place at end of last token
  if (toks.length > 0) {
    var last = toks[toks.length - 1];
    _nlpActivateToken(last);
    _nlpPlaceCursor(last, (last.dataset.raw || '').length);
  }
}

/**
 * Place cursor at a position within an element.
 */
function _nlpPlaceCursor(el, offset) {
  var textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== 3) {
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(offset === 0);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  var pos = Math.min(offset, textNode.length);
  var range2 = document.createRange();
  range2.setStart(textNode, pos);
  range2.collapse(true);
  var sel2 = window.getSelection();
  sel2.removeAllRanges();
  sel2.addRange(range2);
}

/**
 * Re-index line elements.
 */
function _nlpReindex() {
  var liveDiv = document.getElementById('notesLivePreview');
  if (!liveDiv) return;
  var lines = liveDiv.querySelectorAll('.nlp-line');
  lines.forEach(function(el, i) { el.dataset.lineIdx = String(i); });
}

// ══════════════════════════════════════════════════════════════════════════
// FORMAT TOOLBAR & KEYBOARD SHORTCUTS
//
// _notesFormatBtn(action)     — main entry point, delegates by mode
// _notesFormatBtnLive(action) — live preview mode formatting
// _getNotesFormatAction(e)    — keyboard shortcut mapper
//
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
// ══════════════════════════════════════════════════════════════════════════

/**
 * Map a keyboard event to a format action string, or return null if no match.
 * Supports both Ctrl and Cmd (metaKey) for macOS compatibility.
 *
 * Mappings:
 *   Ctrl+B → 'b' (bold)
 *   Ctrl+I → 'i' (italic)
 *   Ctrl+K → 'k' (link)
 *   Ctrl+E → 'code' (inline code)
 *   Ctrl+Shift+X → 's' (strikethrough)
 *   Ctrl+Shift+1 → 'h1'
 *   Ctrl+Shift+2 → 'h2'
 *   Ctrl+Shift+3 → 'h3'
 *   Ctrl+Shift+7 → 'ol' (ordered list)
 *   Ctrl+Shift+8 → 'ul' (unordered list)
 *   Ctrl+Shift+. → 'q' (blockquote)
 *   Ctrl+Shift+- → 'hr' (horizontal rule)
 *
 * Requirements: 7.4
 */
function _getNotesFormatAction(e) {
  if (!e) return null;
  var mod = e.ctrlKey || e.metaKey;
  if (!mod) return null;

  var key = e.key;

  // Non-shift shortcuts
  if (!e.shiftKey) {
    if (key === 'b' || key === 'B') return 'b';
    if (key === 'i' || key === 'I') return 'i';
    if (key === 'k' || key === 'K') return 'k';
    if (key === 'e' || key === 'E') return 'code';
    return null;
  }

  // Shift shortcuts (Ctrl+Shift+...)
  if (key === 'X' || key === 'x') return 's';
  if (key === '!' || key === '1') return 'h1';
  if (key === '@' || key === '2') return 'h2';
  if (key === '#' || key === '3') return 'h3';
  if (key === '&' || key === '7') return 'ol';
  if (key === '*' || key === '8') return 'ul';
  if (key === '>' || key === '.') return 'q';
  if (key === '_' || key === '-') return 'hr';

  return null;
}

/**
 * Main format button handler. Detects the current mode and delegates:
 * - Source mode: manipulates textarea selection directly
 * - Live Preview mode: delegates to _notesFormatBtnLive(action)
 * - Reading mode: no-op (toolbar is hidden anyway)
 *
 * Actions: 'b' (bold), 'i' (italic), 's' (strikethrough), 'code' (inline code),
 *          'k' (link), 'h1', 'h2', 'h3', 'ul', 'ol', 'q' (blockquote), 'hr'
 *
 * Source mode behavior:
 * - Inline formats (b, i, s, code, k): wrap selected text with syntax chars.
 *   If no selection, insert syntax with placeholder and select the placeholder.
 * - Line-level formats (h1-h3, ul, ol, q): prepend prefix to the current line.
 * - hr: insert `---` on a new line.
 *
 * Requirements: 7.1, 7.2
 */
function _notesFormatBtn(action) {
  // Delegate to live mode handler if in live preview
  if (_notesRenderMode === 'live') {
    _notesFormatBtnLive(action);
    return;
  }

  // Reading mode — no-op
  if (_notesRenderMode === 'reading') return;

  // ── Source mode: manipulate textarea selection ──
  var ta = document.getElementById('note');
  if (!ta) return;

  var start = ta.selectionStart;
  var end = ta.selectionEnd;
  var text = ta.value;
  var selected = text.substring(start, end);

  // Helper: wrap selection with before/after strings
  function wrapSelection(before, after, placeholder) {
    if (selected) {
      var newText = text.substring(0, start) + before + selected + after + text.substring(end);
      ta.value = newText;
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    } else {
      var ph = placeholder || 'text';
      var newText2 = text.substring(0, start) + before + ph + after + text.substring(end);
      ta.value = newText2;
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + ph.length;
    }
    ta.focus();
    if (typeof autoGrowNote === 'function') autoGrowNote(ta);
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  }

  // Helper: prepend prefix to the current line
  function prependToLine(prefix) {
    // Find the start of the current line
    var lineStart = text.lastIndexOf('\n', start - 1) + 1;
    var newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    ta.value = newText;
    ta.selectionStart = start + prefix.length;
    ta.selectionEnd = end + prefix.length;
    ta.focus();
    if (typeof autoGrowNote === 'function') autoGrowNote(ta);
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  }

  switch (action) {
    case 'b':
      wrapSelection('**', '**', 'bold text');
      break;
    case 'i':
      wrapSelection('_', '_', 'italic text');
      break;
    case 's':
      wrapSelection('~~', '~~', 'strikethrough');
      break;
    case 'code':
      wrapSelection('`', '`', 'code');
      break;
    case 'k':
      if (selected) {
        var newText = text.substring(0, start) + '[' + selected + '](url)' + text.substring(end);
        ta.value = newText;
        // Select "url" placeholder
        ta.selectionStart = start + selected.length + 3;
        ta.selectionEnd = start + selected.length + 6;
      } else {
        var newText2 = text.substring(0, start) + '[link text](url)' + text.substring(end);
        ta.value = newText2;
        // Select "link text" placeholder
        ta.selectionStart = start + 1;
        ta.selectionEnd = start + 10;
      }
      ta.focus();
      if (typeof autoGrowNote === 'function') autoGrowNote(ta);
      if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
      break;
    case 'h1':
      prependToLine('# ');
      break;
    case 'h2':
      prependToLine('## ');
      break;
    case 'h3':
      prependToLine('### ');
      break;
    case 'ul':
      prependToLine('- ');
      break;
    case 'ol':
      prependToLine('1. ');
      break;
    case 'q':
      prependToLine('> ');
      break;
    case 'hr':
      // Insert --- on a new line
      var before = text.substring(0, start);
      var after = text.substring(end);
      var needNewlineBefore = before.length > 0 && before[before.length - 1] !== '\n';
      var insert = (needNewlineBefore ? '\n' : '') + '---\n';
      ta.value = before + insert + after;
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.focus();
      if (typeof autoGrowNote === 'function') autoGrowNote(ta);
      if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
      break;
  }
}

/**
 * Live Preview mode format handler. Applies formatting to the active token's
 * raw text or inserts formatting at the cursor position if no active token.
 *
 * Behavior:
 * - If there's an active token with a selection within it, wrap the selected
 *   portion with the appropriate markdown syntax.
 * - If there's an active token with no selection (cursor only), insert syntax
 *   with placeholder at cursor position.
 * - If no active token, insert formatting at cursor position by creating a
 *   new token in the current line.
 * - After formatting, rebuild the affected line and restore cursor position.
 *
 * Requirements: 7.1, 7.3
 */
function _notesFormatBtnLive(action) {
  var liveDiv = document.getElementById('notesLivePreview');
  if (!liveDiv) return;

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  // Determine syntax wrappers for the action
  var before = '', after = '', placeholder = '', isLineLevel = false, linePrefix = '';

  switch (action) {
    case 'b':   before = '**'; after = '**'; placeholder = 'bold text'; break;
    case 'i':   before = '_';  after = '_';  placeholder = 'italic text'; break;
    case 's':   before = '~~'; after = '~~'; placeholder = 'strikethrough'; break;
    case 'code': before = '`'; after = '`';  placeholder = 'code'; break;
    case 'k':   before = '[';  after = '](url)'; placeholder = 'link text'; break;
    case 'h1':  isLineLevel = true; linePrefix = '# '; break;
    case 'h2':  isLineLevel = true; linePrefix = '## '; break;
    case 'h3':  isLineLevel = true; linePrefix = '### '; break;
    case 'ul':  isLineLevel = true; linePrefix = '- '; break;
    case 'ol':  isLineLevel = true; linePrefix = '1. '; break;
    case 'q':   isLineLevel = true; linePrefix = '> '; break;
    case 'hr':  isLineLevel = true; linePrefix = '---'; break;
    default: return;
  }

  // Find the containing line element
  var anchorNode = sel.anchorNode;
  var lineEl = (anchorNode && anchorNode.nodeType === 3) ? anchorNode.parentElement : anchorNode;
  while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
  if (!lineEl) return;

  // ── Line-level formatting ──
  if (isLineLevel) {
    var lineIdx = parseInt(lineEl.dataset.lineIdx) || 0;

    // Deactivate active token first (may rebuild the line)
    if (_nlpActiveTokenEl) {
      _nlpDeactivateToken(_nlpActiveTokenEl);
    }

    // Re-find line element (deactivation may have replaced it)
    lineEl = liveDiv.querySelector('.nlp-line[data-line-idx="' + lineIdx + '"]');
    if (!lineEl) return;

    var lineRaw = lineEl.dataset.raw || '';

    if (action === 'hr') {
      // Insert --- as a new line after the current line
      var hrLine = _nlpBuildLine('---', lineIdx + 1);
      lineEl.after(hrLine);
      _nlpReindex();
    } else {
      // Prepend prefix to the line's raw content (strip existing prefix first)
      var existingPrefix = _nlpExtractPrefix(lineRaw);
      var content = lineRaw.substring(existingPrefix.length);
      var newRaw = linePrefix + content;
      var rebuilt = _nlpBuildLine(newRaw, lineIdx);
      lineEl.parentNode.replaceChild(rebuilt, lineEl);
      _nlpReindex();

      // Place cursor in the first token of the rebuilt line
      var firstTok = rebuilt.querySelector('.nlp-tok');
      if (firstTok) {
        _nlpActivateToken(firstTok);
        _nlpPlaceCursor(firstTok, 0);
      }
    }

    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }

  // ── Inline formatting ──
  if (_nlpActiveTokenEl && lineEl.contains(_nlpActiveTokenEl)) {
    // Active token exists — get selection range within its raw text
    var tokEl = _nlpActiveTokenEl;
    var rawText = tokEl.textContent || '';

    // Determine selection offsets within the token's text node
    var range = sel.getRangeAt(0);
    var tokStart = 0, tokEnd = 0;

    if (tokEl.firstChild && tokEl.firstChild.nodeType === 3) {
      var textNode = tokEl.firstChild;
      if (range.startContainer === textNode) {
        tokStart = range.startOffset;
      }
      if (range.endContainer === textNode) {
        tokEnd = range.endOffset;
      } else {
        tokEnd = tokStart;
      }
    } else {
      tokStart = tokEnd = rawText.length;
    }

    // Ensure start <= end
    if (tokStart > tokEnd) { var tmp = tokStart; tokStart = tokEnd; tokEnd = tmp; }

    var selectedText = rawText.substring(tokStart, tokEnd);
    var newRaw, cursorPos;

    if (selectedText.length > 0) {
      // Wrap selected text with syntax
      if (action === 'k') {
        newRaw = rawText.substring(0, tokStart) + '[' + selectedText + '](url)' + rawText.substring(tokEnd);
        cursorPos = tokStart + selectedText.length + 3; // position at start of "url"
      } else {
        newRaw = rawText.substring(0, tokStart) + before + selectedText + after + rawText.substring(tokEnd);
        cursorPos = tokStart + before.length + selectedText.length + after.length;
      }
    } else {
      // No selection — insert empty syntax, cursor between delimiters
      if (action === 'k') {
        newRaw = rawText.substring(0, tokStart) + '[](url)' + rawText.substring(tokEnd);
        cursorPos = tokStart + 1; // cursor inside []
      } else {
        newRaw = rawText.substring(0, tokStart) + before + after + rawText.substring(tokEnd);
        cursorPos = tokStart + before.length; // cursor between delimiters
      }
    }

    // Update the token's text content and data-raw
    tokEl.textContent = newRaw;
    tokEl.dataset.raw = newRaw;

    // Update the line's data-raw
    lineEl.dataset.raw = _nlpExtractLineRaw(lineEl);

    // Deactivate and rebuild the line to re-tokenize
    _nlpActiveTokenEl = null;
    tokEl.classList.remove('nlp-active');
    _nlpRebuildLine(lineEl);

    // Find the rebuilt line and place cursor
    var rebuiltLine = liveDiv.querySelector('.nlp-line[data-line-idx="' + (parseInt(lineEl.dataset.lineIdx) || 0) + '"]');
    if (!rebuiltLine) rebuiltLine = lineEl;
    _nlpPlaceCursorAtOffset(rebuiltLine, cursorPos);

  } else {
    // No active token — insert formatting at cursor position in the line
    var cursorOffset = _nlpGetCursorOffsetInLine(lineEl);
    var lineRaw2 = lineEl.dataset.raw || '';
    var prefix2 = _nlpExtractPrefix(lineRaw2);
    var content2 = lineRaw2.substring(prefix2.length);

    // Adjust cursor offset relative to content (after prefix)
    var contentOffset = Math.max(0, cursorOffset - prefix2.length);
    var newContent, newCursorPos;

    if (action === 'k') {
      newContent = content2.substring(0, contentOffset) + '[](url)' + content2.substring(contentOffset);
      newCursorPos = prefix2.length + contentOffset + 1; // cursor inside []
    } else {
      newContent = content2.substring(0, contentOffset) + before + after + content2.substring(contentOffset);
      newCursorPos = prefix2.length + contentOffset + before.length; // cursor between delimiters
    }

    var newLineRaw = prefix2 + newContent;
    var idx3 = parseInt(lineEl.dataset.lineIdx) || 0;
    var rebuilt2 = _nlpBuildLine(newLineRaw, idx3);
    lineEl.parentNode.replaceChild(rebuilt2, lineEl);
    _nlpReindex();

    // Place cursor at the placeholder
    _nlpPlaceCursorAtOffset(rebuilt2, newCursorPos);
  }

  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

// ══════════════════════════════════════════════════════════════════════════
// EMAIL BODY LIVE PREVIEW — Reuses the shared tokenizer/parser/builder
//
// The Notes live preview engine (tokenizer, line parser, DOM builder, cursor
// tracker, activator) is stateless and reusable. The Email body live preview
// maintains its own state variables and DOM element references but calls the
// same _nlpTokenize, _nlpParseLine, _nlpBuildLine, _nlpExtract* helpers.
//
// Requirements: 10.1, 10.2, 10.3, 10.4
// ══════════════════════════════════════════════════════════════════════════

// ── Email State ──────────────────────────────────────────────────────────
var _emailRenderMode = 'source';
var _emailActiveTokenEl = null; // the <span> currently showing raw syntax in email
var _emailViewportResizeHandler = null; // visualViewport resize handler ref for email

// ── Email Value Access ───────────────────────────────────────────────────

function _getEmailBodyValue() {
  if (_emailRenderMode === 'live') return _emailNlpExtract();
  var ta = document.getElementById('emailBody');
  return ta ? ta.value : '';
}

// ── Email Mode Cycling ───────────────────────────────────────────────────

function _emailCycleMode(event) {
  if (event) event.stopPropagation();
  if (_emailRenderMode === 'source') _emailSetMode('live');
  else if (_emailRenderMode === 'live') _emailSetMode('reading');
  else _emailSetMode('source');
}

function _emailSetMode(mode) {
  var prev = _emailRenderMode;

  if (prev === 'live') {
    // Leaving live mode: extract markdown, remove selectionchange listener
    var md = _emailNlpExtract();
    var ta = document.getElementById('emailBody');
    if (ta && md !== null) ta.value = md;
    document.removeEventListener('selectionchange', _emailNlpOnSelectionChange);
    var prevLiveDiv = document.getElementById('emailLivePreview');
    if (prevLiveDiv) {
      prevLiveDiv.removeEventListener('keydown', _emailNlpOnKeydown);
      prevLiveDiv.removeEventListener('paste', _emailNlpOnPaste);
      prevLiveDiv.removeEventListener('input', _emailNlpOnInput);
      prevLiveDiv.removeEventListener('focusout', _emailNlpOnFocusOut);
      // Remove touch fallback listener
      if (_nlpTouchSupported) {
        prevLiveDiv.removeEventListener('touchend', _emailNlpOnTouchEnd);
      }
    }
    // Remove visualViewport resize handler for email
    if (_emailViewportResizeHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _emailViewportResizeHandler);
      _emailViewportResizeHandler = null;
    }
  }

  _emailRenderMode = mode;
  var textarea = document.getElementById('emailBody');
  var liveDiv = document.getElementById('emailLivePreview');
  var rendered = document.getElementById('emailRenderedOutput');
  var toolbar = document.getElementById('emailFormatToolbar');
  var btn = document.getElementById('email-render-toggle-btn');
  var headerBtn = document.getElementById('emailModeToggleBtn');

  if (textarea) textarea.style.display = 'none';
  if (liveDiv) liveDiv.style.display = 'none';
  if (rendered) rendered.style.display = 'none';

  // Hide the old static preview when in any mode
  var oldPreview = document.getElementById('emailBodyPreview');
  if (oldPreview) oldPreview.style.display = 'none';

  if (mode === 'source') {
    if (textarea) textarea.style.display = '';
    if (toolbar) toolbar.style.display = '';
    _emailUpdateToggleBtn(btn, 'source');
    _emailUpdateToggleBtn(headerBtn, 'source');
  } else if (mode === 'live') {
    _emailNlpBuild();
    if (liveDiv) liveDiv.style.display = '';
    if (toolbar) toolbar.style.display = '';
    // Register selectionchange listener scoped to email
    document.addEventListener('selectionchange', _emailNlpOnSelectionChange);
    if (liveDiv) {
      liveDiv.addEventListener('keydown', _emailNlpOnKeydown);
      liveDiv.addEventListener('paste', _emailNlpOnPaste);
      liveDiv.addEventListener('input', _emailNlpOnInput);
      liveDiv.addEventListener('focusout', _emailNlpOnFocusOut);
      // Touch fallback: register touchend if device supports touch
      if (_nlpTouchSupported) {
        liveDiv.addEventListener('touchend', _emailNlpOnTouchEnd);
      }
    }
    // Virtual keyboard handler for email
    if (_nlpTouchSupported && window.visualViewport) {
      _emailViewportResizeHandler = _emailOnViewportResize;
      window.visualViewport.addEventListener('resize', _emailViewportResizeHandler);
    }
    _emailUpdateToggleBtn(btn, 'live');
    _emailUpdateToggleBtn(headerBtn, 'live');
  } else if (mode === 'reading') {
    var text = textarea ? textarea.value : '';
    if (rendered) {
      var readingHtml = (typeof marked !== 'undefined' && marked.parse)
        ? marked.parse(text || '', { breaks: true })
        : '<pre>' + _escHtml(text || '') + '</pre>';
      if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
        readingHtml = DOMPurify.sanitize(readingHtml, { ADD_ATTR: ['rel'] });
      }
      rendered.innerHTML = readingHtml;
      rendered.style.display = 'block';
    }
    if (toolbar) toolbar.style.display = 'none';
    _emailUpdateToggleBtn(btn, 'reading');
    _emailUpdateToggleBtn(headerBtn, 'reading');
  }
}

function _emailUpdateToggleBtn(btn, mode) {
  if (!btn) return;
  btn.classList.remove('mode-edit', 'mode-live', 'mode-rendered');
  if (mode === 'source') {
    btn.innerHTML = '<i class="fas fa-code"></i> Source';
    btn.classList.add('mode-edit');
    btn.title = 'Source → Live Preview → Reading';
  } else if (mode === 'live') {
    btn.innerHTML = '<i class="fas fa-magic"></i> Live';
    btn.classList.add('mode-live');
    btn.title = 'Live Preview → Reading → Source';
  } else {
    btn.innerHTML = '<i class="fas fa-eye"></i> Reading';
    btn.classList.add('mode-rendered');
    btn.title = 'Reading → Source → Live Preview';
  }
}

// ── Email DOM Building (reuses _nlpBuildLine) ────────────────────────────

function _emailNlpBuild() {
  var liveDiv = document.getElementById('emailLivePreview');
  var ta = document.getElementById('emailBody');
  if (!liveDiv || !ta) return;

  var md = ta.value || '';
  var lines = md.split('\n');

  liveDiv.innerHTML = '';
  _emailActiveTokenEl = null;

  for (var i = 0; i < lines.length; i++) {
    var lineDiv = _nlpBuildLine(lines[i], i);
    liveDiv.appendChild(lineDiv);
  }

  if (liveDiv.children.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'nlp-line';
    empty.dataset.lineIdx = '0';
    empty.dataset.raw = '';
    empty.innerHTML = '<br>';
    liveDiv.appendChild(empty);
  }
}

// ── Email Markdown Extraction ────────────────────────────────────────────

function _emailNlpExtract() {
  var liveDiv = document.getElementById('emailLivePreview');
  if (!liveDiv) {
    var ta = document.getElementById('emailBody');
    return ta ? ta.value : '';
  }
  var lineEls = liveDiv.querySelectorAll('.nlp-line');
  if (lineEls.length === 0) {
    var ta2 = document.getElementById('emailBody');
    return ta2 ? ta2.value : '';
  }

  var parts = [];
  for (var i = 0; i < lineEls.length; i++) {
    var el = lineEls[i];
    var raw;
    if (_emailActiveTokenEl && el.contains(_emailActiveTokenEl)) {
      raw = _emailExtractLineRaw(el);
    } else {
      raw = el.dataset.raw;
      var lineToks = el.querySelectorAll('.nlp-tok');
      if (lineToks.length === 0 && !el.classList.contains('nlp-line-hr')) {
        var textFallback = el.textContent || '';
        if (textFallback.trim() && (!raw || !raw.trim())) {
          raw = textFallback;
        }
      }
    }
    parts.push(raw != null ? raw : '');
  }

  var result = parts.join('\n');
  var textarea = document.getElementById('emailBody');
  if (textarea) textarea.value = result;
  return result;
}

function _emailExtractLineRaw(lineEl) {
  if (!lineEl) return '';
  if (lineEl.classList.contains('nlp-line-hr')) return lineEl.dataset.raw || '';

  var toks = lineEl.querySelectorAll('.nlp-tok');
  if (toks.length === 0) {
    var fallbackText = lineEl.textContent || '';
    if (fallbackText.trim()) return fallbackText;
    return '';
  }

  var originalRaw = lineEl.dataset.raw || '';
  var prefix = _nlpExtractPrefix(originalRaw);
  var content = '';
  for (var i = 0; i < toks.length; i++) {
    var tok = toks[i];
    if (tok === _emailActiveTokenEl) {
      content += tok.textContent || '';
    } else {
      content += tok.dataset.raw || '';
    }
  }
  return prefix + content;
}

// ── Email Cursor Tracking ────────────────────────────────────────────────

function _emailNlpOnSelectionChange() {
  if (_emailRenderMode !== 'live') return;

  var liveDiv = document.getElementById('emailLivePreview');
  if (!liveDiv) return;

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  var anchorNode = sel.anchorNode;
  if (!anchorNode) return;

  // Verify cursor is within #emailLivePreview div (NOT #notesLivePreview)
  if (!liveDiv.contains(anchorNode)) return;

  var tokEl = (anchorNode.nodeType === 3) ? anchorNode.parentElement : anchorNode;
  while (tokEl && tokEl !== liveDiv) {
    if (tokEl.classList && tokEl.classList.contains('nlp-tok')) break;
    if (tokEl.classList && (tokEl.classList.contains('nlp-line') || tokEl.classList.contains('nlp-prefix'))) {
      tokEl = null;
      break;
    }
    tokEl = tokEl.parentElement;
  }
  if (tokEl === liveDiv) tokEl = null;

  // No-op if same token
  if (tokEl === _emailActiveTokenEl) return;

  // Deactivate old token
  if (_emailActiveTokenEl) {
    _emailDeactivateToken(_emailActiveTokenEl);
  }

  // Activate new token
  if (tokEl) {
    _emailActivateToken(tokEl);
  }
}

function _emailActivateToken(tokEl) {
  if (!tokEl) return;
  _emailActiveTokenEl = tokEl;
  tokEl.classList.add('nlp-active');
  var raw = tokEl.dataset.raw || '';
  tokEl.textContent = raw;
}

function _emailDeactivateToken(tokEl) {
  if (!tokEl) return;

  var currentRaw = tokEl.textContent || '';
  tokEl.dataset.raw = currentRaw;
  tokEl.classList.remove('nlp-active');

  var tokens;
  try {
    tokens = _nlpTokenize(currentRaw);
  } catch (e) {
    tokEl.innerHTML = _escHtml(currentRaw);
    tokEl.className = 'nlp-tok nlp-tok-text';
    _emailActiveTokenEl = null;
    var parentLineErr = tokEl.closest('.nlp-line');
    if (parentLineErr) parentLineErr.dataset.raw = _emailExtractLineRaw(parentLineErr);
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }

  if (tokens.length === 1 && tokens[0].type) {
    var html = tokens[0].html;
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      html = DOMPurify.sanitize(html, { ADD_ATTR: ['rel'] });
    }
    tokEl.innerHTML = html;
    tokEl.className = 'nlp-tok nlp-tok-' + tokens[0].type;
  } else if (tokens.length > 1) {
    var lineEl = tokEl.closest('.nlp-line');
    _emailActiveTokenEl = null;
    if (lineEl) {
      try { _emailRebuildLine(lineEl); } catch (e2) {
        tokEl.innerHTML = _escHtml(currentRaw);
        tokEl.className = 'nlp-tok nlp-tok-text';
      }
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  } else {
    tokEl.innerHTML = _escHtml(currentRaw);
    tokEl.className = 'nlp-tok nlp-tok-text';
  }

  _emailActiveTokenEl = null;
  var parentLine = tokEl.closest('.nlp-line');
  if (parentLine) parentLine.dataset.raw = _emailExtractLineRaw(parentLine);
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

function _emailRebuildLine(lineEl) {
  if (!lineEl) return;
  var rawLine = _emailExtractLineRaw(lineEl);
  lineEl.dataset.raw = rawLine;
  var idx = parseInt(lineEl.dataset.lineIdx) || 0;
  var newLine = _nlpBuildLine(rawLine, idx);
  if (lineEl.parentNode) lineEl.parentNode.replaceChild(newLine, lineEl);
}

// ── Email Input Handling ─────────────────────────────────────────────────

function _emailNlpOnInput() {
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Handle touchend for email live preview — fallback for browsers where
 * selectionchange doesn't fire reliably on touch.
 *
 * Requirements: 13.1
 */
function _emailNlpOnTouchEnd() {
  setTimeout(_emailNlpOnSelectionChange, 50);
}

/**
 * Handle visualViewport resize for email — preserves active token state
 * when the virtual keyboard appears or disappears on mobile.
 *
 * Requirements: 13.3
 */
function _emailOnViewportResize() {
  if (_emailRenderMode !== 'live') return;
  if (_emailActiveTokenEl && _emailActiveTokenEl.scrollIntoViewIfNeeded) {
    _emailActiveTokenEl.scrollIntoViewIfNeeded(false);
  } else if (_emailActiveTokenEl && _emailActiveTokenEl.scrollIntoView) {
    _emailActiveTokenEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function _emailNlpOnFocusOut() {
  var liveDiv = document.getElementById('emailLivePreview');
  if (!liveDiv) return;
  setTimeout(function() {
    if (!liveDiv.contains(document.activeElement) && document.activeElement !== liveDiv) {
      if (_emailActiveTokenEl) {
        _emailDeactivateToken(_emailActiveTokenEl);
      }
    }
  }, 10);
}

function _emailNlpOnKeydown(e) {
  // Format hotkeys
  if (typeof _getNotesFormatAction === 'function') {
    var action = _getNotesFormatAction(e);
    if (action) {
      e.preventDefault();
      _emailFormatBtnLive(action);
      return;
    }
  }

  // Enter: split line
  if (e.key === 'Enter') {
    e.preventDefault();

    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    var lineEl = sel.anchorNode;
    if (lineEl && lineEl.nodeType === 3) lineEl = lineEl.parentElement;
    while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
    if (!lineEl) return;

    // Get cursor offset BEFORE deactivation
    var cursorInLine = _emailGetCursorOffsetInLine(lineEl);

    if (_emailActiveTokenEl) _emailDeactivateToken(_emailActiveTokenEl);

    var fullRaw = lineEl.dataset.raw || '';
    var prefix = _nlpExtractPrefix(fullRaw);
    var splitPos = prefix.length + cursorInLine;
    var before = fullRaw.substring(0, splitPos);
    var after = fullRaw.substring(splitPos);

    var idx = parseInt(lineEl.dataset.lineIdx) || 0;
    var newCurrent = _nlpBuildLine(before, idx);
    lineEl.parentNode.replaceChild(newCurrent, lineEl);

    var newLine = _nlpBuildLine(after, idx + 1);
    newCurrent.after(newLine);
    _emailReindex();

    var firstTok = newLine.querySelector('.nlp-tok');
    if (firstTok) {
      _emailActivateToken(firstTok);
      _nlpPlaceCursor(firstTok, 0);
    } else {
      var range = document.createRange();
      range.selectNodeContents(newLine);
      range.collapse(true);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }

  // Backspace at line start: merge
  if (e.key === 'Backspace') {
    var sel2 = window.getSelection();
    if (!sel2 || !sel2.rangeCount) return;

    var lineEl2 = sel2.anchorNode;
    if (lineEl2 && lineEl2.nodeType === 3) lineEl2 = lineEl2.parentElement;
    while (lineEl2 && !lineEl2.classList.contains('nlp-line')) lineEl2 = lineEl2.parentElement;
    if (!lineEl2) return;

    var offsetInLine = _emailGetCursorOffsetInLine(lineEl2);
    if (offsetInLine !== 0) return;
    if (!lineEl2.previousElementSibling) return;

    e.preventDefault();
    if (_emailActiveTokenEl) _emailDeactivateToken(_emailActiveTokenEl);

    var prevLine = lineEl2.previousElementSibling;
    var prevRaw = prevLine.dataset.raw || '';
    var curRaw = lineEl2.dataset.raw || '';
    var mergedRaw = prevRaw + curRaw;
    var cursorPos = prevRaw.length;

    lineEl2.remove();
    var idx2 = parseInt(prevLine.dataset.lineIdx) || 0;
    var rebuilt = _nlpBuildLine(mergedRaw, idx2);
    prevLine.parentNode.replaceChild(rebuilt, prevLine);
    _emailReindex();
    _emailPlaceCursorAtOffset(rebuilt, cursorPos);
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }
}

function _emailNlpOnPaste(e) {
  e.preventDefault();
  var text = '';
  if (e.clipboardData && e.clipboardData.getData) {
    text = e.clipboardData.getData('text/plain') || '';
  }
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<[^>]+>/g, '');
  if (!text) return;

  if (_emailActiveTokenEl) _emailDeactivateToken(_emailActiveTokenEl);

  var liveDiv = document.getElementById('emailLivePreview');
  if (!liveDiv) return;

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  var lineEl = sel.anchorNode;
  if (lineEl && lineEl.nodeType === 3) lineEl = lineEl.parentElement;
  while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
  if (!lineEl) return;

  var cursorInLine = _emailGetCursorOffsetInLine(lineEl);
  var lineRaw = lineEl.dataset.raw || '';
  var beforeCursor = lineRaw.substring(0, cursorInLine);
  var afterCursor = lineRaw.substring(cursorInLine);
  var pastedLines = text.split('\n');

  if (pastedLines.length === 1) {
    var newRaw = beforeCursor + pastedLines[0] + afterCursor;
    var idx = parseInt(lineEl.dataset.lineIdx) || 0;
    var rebuilt = _nlpBuildLine(newRaw, idx);
    lineEl.parentNode.replaceChild(rebuilt, lineEl);
    _emailReindex();
    _emailPlaceCursorAtOffset(rebuilt, beforeCursor.length + pastedLines[0].length);
  } else {
    var parent = lineEl.parentNode;
    var nextSibling = lineEl.nextSibling;
    var baseIdx = parseInt(lineEl.dataset.lineIdx) || 0;
    lineEl.remove();

    var newLines = [];
    for (var i = 0; i < pastedLines.length; i++) {
      var raw;
      if (i === 0) raw = beforeCursor + pastedLines[i];
      else if (i === pastedLines.length - 1) raw = pastedLines[i] + afterCursor;
      else raw = pastedLines[i];
      newLines.push(_nlpBuildLine(raw, baseIdx + i));
    }
    for (var j = 0; j < newLines.length; j++) {
      if (nextSibling) parent.insertBefore(newLines[j], nextSibling);
      else parent.appendChild(newLines[j]);
    }
    _emailReindex();
    var lastLine = newLines[newLines.length - 1];
    _emailPlaceCursorAtOffset(lastLine, pastedLines[pastedLines.length - 1].length);
  }
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

// ── Email Cursor Helpers ─────────────────────────────────────────────────

function _emailGetCursorOffsetInLine(lineEl) {
  var sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  var toks = lineEl.querySelectorAll('.nlp-tok');
  var range = sel.getRangeAt(0);
  var offset = 0;
  for (var i = 0; i < toks.length; i++) {
    var tok = toks[i];
    if (tok.contains(range.startContainer) || tok === range.startContainer) {
      var innerOffset = 0;
      if (range.startContainer.nodeType === 3) innerOffset = range.startOffset;
      if (tok.classList.contains('nlp-active')) return offset + innerOffset;
      return offset + Math.min(innerOffset, (tok.dataset.raw || '').length);
    }
    offset += (tok.dataset.raw || '').length;
  }
  return offset;
}

function _emailPlaceCursorAtOffset(lineEl, charOffset) {
  var toks = lineEl.querySelectorAll('.nlp-tok');
  var offset = 0;
  for (var i = 0; i < toks.length; i++) {
    var tok = toks[i];
    var rawLen = (tok.dataset.raw || '').length;
    if (offset + rawLen >= charOffset) {
      _emailActivateToken(tok);
      _nlpPlaceCursor(tok, charOffset - offset);
      return;
    }
    offset += rawLen;
  }
  if (toks.length > 0) {
    var last = toks[toks.length - 1];
    _emailActivateToken(last);
    _nlpPlaceCursor(last, (last.dataset.raw || '').length);
  }
}

function _emailReindex() {
  var liveDiv = document.getElementById('emailLivePreview');
  if (!liveDiv) return;
  var lines = liveDiv.querySelectorAll('.nlp-line');
  lines.forEach(function(el, i) { el.dataset.lineIdx = String(i); });
}

// ── Email Format Button (Live Preview mode) ──────────────────────────────

function _emailFormatBtnLive(action) {
  var liveDiv = document.getElementById('emailLivePreview');
  if (!liveDiv) return;

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  var before = '', after = '', placeholder = '', isLineLevel = false, linePrefix = '';
  switch (action) {
    case 'b':   before = '**'; after = '**'; placeholder = 'bold text'; break;
    case 'i':   before = '_';  after = '_';  placeholder = 'italic text'; break;
    case 's':   before = '~~'; after = '~~'; placeholder = 'strikethrough'; break;
    case 'code': before = '`'; after = '`';  placeholder = 'code'; break;
    case 'k':   before = '[';  after = '](url)'; placeholder = 'link text'; break;
    case 'h1':  isLineLevel = true; linePrefix = '# '; break;
    case 'h2':  isLineLevel = true; linePrefix = '## '; break;
    case 'h3':  isLineLevel = true; linePrefix = '### '; break;
    case 'ul':  isLineLevel = true; linePrefix = '- '; break;
    case 'ol':  isLineLevel = true; linePrefix = '1. '; break;
    case 'q':   isLineLevel = true; linePrefix = '> '; break;
    case 'hr':  isLineLevel = true; linePrefix = '---'; break;
    default: return;
  }

  var anchorNode = sel.anchorNode;
  var lineEl = (anchorNode && anchorNode.nodeType === 3) ? anchorNode.parentElement : anchorNode;
  while (lineEl && !lineEl.classList.contains('nlp-line')) lineEl = lineEl.parentElement;
  if (!lineEl) return;

  if (isLineLevel) {
    if (_emailActiveTokenEl) _emailDeactivateToken(_emailActiveTokenEl);
    var lineRaw = lineEl.dataset.raw || '';
    if (action === 'hr') {
      var idx = parseInt(lineEl.dataset.lineIdx) || 0;
      var hrLine = _nlpBuildLine('---', idx + 1);
      lineEl.after(hrLine);
      _emailReindex();
    } else {
      var existingPrefix = _nlpExtractPrefix(lineRaw);
      var content = lineRaw.substring(existingPrefix.length);
      var newRaw = linePrefix + content;
      var idx2 = parseInt(lineEl.dataset.lineIdx) || 0;
      var rebuilt = _nlpBuildLine(newRaw, idx2);
      lineEl.parentNode.replaceChild(rebuilt, lineEl);
      _emailReindex();
      var firstTok = rebuilt.querySelector('.nlp-tok');
      if (firstTok) {
        _emailActivateToken(firstTok);
        _nlpPlaceCursor(firstTok, 0);
      }
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    return;
  }

  // Inline formatting
  if (_emailActiveTokenEl && lineEl.contains(_emailActiveTokenEl)) {
    var tokEl = _emailActiveTokenEl;
    var rawText = tokEl.textContent || '';
    var range = sel.getRangeAt(0);
    var tokStart = 0, tokEnd = 0;

    if (tokEl.firstChild && tokEl.firstChild.nodeType === 3) {
      var textNode = tokEl.firstChild;
      if (range.startContainer === textNode) tokStart = range.startOffset;
      if (range.endContainer === textNode) tokEnd = range.endOffset;
      else tokEnd = tokStart;
    } else {
      tokStart = tokEnd = rawText.length;
    }
    if (tokStart > tokEnd) { var tmp = tokStart; tokStart = tokEnd; tokEnd = tmp; }

    var selectedText = rawText.substring(tokStart, tokEnd);
    var newRaw, cursorPos;

    if (selectedText.length > 0) {
      if (action === 'k') {
        newRaw = rawText.substring(0, tokStart) + '[' + selectedText + '](url)' + rawText.substring(tokEnd);
        cursorPos = tokStart + selectedText.length + 3;
      } else {
        newRaw = rawText.substring(0, tokStart) + before + selectedText + after + rawText.substring(tokEnd);
        cursorPos = tokStart + before.length + selectedText.length + after.length;
      }
    } else {
      if (action === 'k') {
        newRaw = rawText.substring(0, tokStart) + '[](url)' + rawText.substring(tokEnd);
        cursorPos = tokStart + 1;
      } else {
        newRaw = rawText.substring(0, tokStart) + before + after + rawText.substring(tokEnd);
        cursorPos = tokStart + before.length;
      }
    }

    tokEl.textContent = newRaw;
    tokEl.dataset.raw = newRaw;
    lineEl.dataset.raw = _emailExtractLineRaw(lineEl);
    _emailActiveTokenEl = null;
    tokEl.classList.remove('nlp-active');
    _emailRebuildLine(lineEl);

    var rebuiltLine = liveDiv.querySelector('.nlp-line[data-line-idx="' + (parseInt(lineEl.dataset.lineIdx) || 0) + '"]');
    if (!rebuiltLine) rebuiltLine = lineEl;
    _emailPlaceCursorAtOffset(rebuiltLine, cursorPos);
  } else {
    var cursorOffset = _emailGetCursorOffsetInLine(lineEl);
    var lineRaw2 = lineEl.dataset.raw || '';
    var prefix2 = _nlpExtractPrefix(lineRaw2);
    var content2 = lineRaw2.substring(prefix2.length);
    var contentOffset = Math.max(0, cursorOffset - prefix2.length);
    var newContent, newCursorPos;

    if (action === 'k') {
      newContent = content2.substring(0, contentOffset) + '[](url)' + content2.substring(contentOffset);
      newCursorPos = prefix2.length + contentOffset + 1;
    } else {
      newContent = content2.substring(0, contentOffset) + before + after + content2.substring(contentOffset);
      newCursorPos = prefix2.length + contentOffset + before.length;
    }

    var newLineRaw = prefix2 + newContent;
    var idx3 = parseInt(lineEl.dataset.lineIdx) || 0;
    var rebuilt2 = _nlpBuildLine(newLineRaw, idx3);
    lineEl.parentNode.replaceChild(rebuilt2, lineEl);
    _emailReindex();
    _emailPlaceCursorAtOffset(rebuilt2, newCursorPos);
  }
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Email format button dispatcher — delegates to live mode or source mode.
 * Called from the email format toolbar buttons in the inline editor.
 */
function _emailInlineFormatBtn(action) {
  if (_emailRenderMode === 'live') {
    _emailFormatBtnLive(action);
  } else if (_emailRenderMode === 'source') {
    // Use the existing _emailFormatBtn with the main emailBody textarea
    if (typeof _emailFormatBtn === 'function') {
      _emailFormatBtn(action, 'emailBody');
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════
// ORIGINAL UTILITY FUNCTIONS — auto-grow, chit link autocomplete, modal,
// copy/download notes
// ══════════════════════════════════════════════════════════════════════════

function autoGrowNote(el) {
  el.style.height = "auto";
  var maxH = Math.floor(window.innerHeight * 0.6);
  el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  _checkChitLinkAutocomplete(el);
}

// ── [[ ]] Chit Link Autocomplete ──
var _chitLinkDropdown = null;
var _chitLinkStart = -1;

function _checkChitLinkAutocomplete(textarea) {
  var pos = textarea.selectionStart;
  var text = textarea.value.substring(0, pos);
  var openIdx = text.lastIndexOf('[[');
  var closeIdx = text.lastIndexOf(']]');

  // If [[ is open and not yet closed
  if (openIdx >= 0 && openIdx > closeIdx) {
    var query = text.substring(openIdx + 2).toLowerCase();
    _chitLinkStart = openIdx;
    if (query.length < 1) { _removeChitLinkDropdown(); return; }

    // Fetch chits if not cached
    if (!window._allChitTitles) {
      fetch('/api/chits').then(function(resp) {
        if (resp.ok) return resp.json();
        return [];
      }).then(function(data) {
        window._allChitTitles = data;
        _doChitLinkFilter(textarea, query);
      }).catch(function() {});
      return;
    }
    _doChitLinkFilter(textarea, query);
  } else {
    _removeChitLinkDropdown();
  }
}

function _doChitLinkFilter(textarea, query) {
  var matches = (window._allChitTitles || [])
    .filter(function(c) { return c.title && c.title.toLowerCase().indexOf(query) !== -1 && c.id !== chitId; })
    .slice(0, 8);

  if (matches.length === 0) { _removeChitLinkDropdown(); return; }
  _showChitLinkDropdown(textarea, matches);
}

function _showChitLinkDropdown(textarea, matches) {
  _removeChitLinkDropdown();
  var dd = document.createElement('div');
  dd.id = 'chit-link-dropdown';
  dd.style.cssText = 'position:fixed;z-index:9999;background:#fff8e1;border:2px solid #8b4513;border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:0.9em;min-width:200px;';
  matches.forEach(function(chit, i) {
    var opt = document.createElement('div');
    opt.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #e0d4b5;';
    opt.textContent = chit.title;
    opt.title = chit.id;
    if (i === 0) opt.style.background = '#f0e6d0';
    opt.addEventListener('mouseenter', function() {
      dd.querySelectorAll('div').forEach(function(d) { d.style.background = ''; });
      opt.style.background = '#f0e6d0';
    });
    opt.addEventListener('mousedown', function(e) {
      e.preventDefault();
      _insertChitLink(textarea, chit.title);
    });
    dd.appendChild(opt);
  });

  // Position below cursor
  var rect = textarea.getBoundingClientRect();
  dd.style.left = (rect.left + 20) + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  document.body.appendChild(dd);
  _chitLinkDropdown = dd;
}

function _removeChitLinkDropdown() {
  if (_chitLinkDropdown) { _chitLinkDropdown.remove(); _chitLinkDropdown = null; }
}

function _insertChitLink(textarea, title) {
  var pos = textarea.selectionStart;
  var before = textarea.value.substring(0, _chitLinkStart + 2);
  var after = textarea.value.substring(pos);
  textarea.value = before + title + ']]' + after;
  var newPos = _chitLinkStart + 2 + title.length + 2;
  textarea.selectionStart = textarea.selectionEnd = newPos;
  textarea.focus();
  _removeChitLinkDropdown();
  if (typeof markEditorUnsaved === 'function') markEditorUnsaved();
}

// Close dropdown on blur or Escape
document.addEventListener('keydown', function(e) {
  if (!_chitLinkDropdown) return;
  if (e.key === 'Escape') { _removeChitLinkDropdown(); return; }
  if (e.key === 'Enter') {
    var highlighted = _chitLinkDropdown.querySelector('div[style*="f0e6d0"]');
    if (highlighted) {
      e.preventDefault();
      var textarea = document.getElementById('note');
      _insertChitLink(textarea, highlighted.textContent);
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    var items = Array.from(_chitLinkDropdown.querySelectorAll('div'));
    var curIdx = items.findIndex(function(d) { return d.style.background.indexOf('f0e6d0') !== -1; });
    items.forEach(function(d) { d.style.background = ''; });
    var next = e.key === 'ArrowDown' ? Math.min(curIdx + 1, items.length - 1) : Math.max(curIdx - 1, 0);
    items[next].style.background = '#f0e6d0';
    items[next].scrollIntoView({ block: 'nearest' });
  }
});

function shrinkNoteToFourLines(event) {
  if (event) event.stopPropagation();
  var textarea = document.getElementById("note");
  var rendered = document.getElementById("notes-rendered-output");
  var lineH = textarea ? (parseInt(getComputedStyle(textarea).lineHeight) || 22) : 22;
  var targetH = lineH * 4 + 16;
  if (textarea) textarea.style.height = targetH + "px";
  if (rendered) rendered.style.minHeight = targetH + "px";
}

function copyNotesToClipboard(event, source) {
  if (event) event.stopPropagation();
  var text = "";
  if (source === "modal") {
    var modalInput = document.getElementById("notes-markdown-input-modal");
    text = modalInput ? modalInput.innerText : "";
  } else {
    text = _getNotesValue();
  }
  var btn = event && event.target ? event.target.closest("button") : null;
  var origHTML = btn ? btn.innerHTML : null;
  navigator.clipboard.writeText(text).then(function() {
    if (btn && origHTML) { btn.innerHTML = "✅"; setTimeout(function() { btn.innerHTML = origHTML; }, 1200); }
  }).catch(function() {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (btn && origHTML) { btn.innerHTML = "✅"; setTimeout(function() { btn.innerHTML = origHTML; }, 1200); }
  });
}

function downloadNotes(event, source) {
  if (event) event.stopPropagation();
  var text = "";
  if (source === "modal") {
    var modalInput = document.getElementById("notes-markdown-input-modal");
    text = modalInput ? modalInput.innerText : "";
  } else {
    text = _getNotesValue();
  }
  var titleEl = document.getElementById("title");
  var title = titleEl ? titleEl.value.trim() : "note";
  var filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".md";
  var blob = new Blob([text], { type: "text/markdown" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function openNotesModal(event) {
  if (event) event.stopPropagation();
  var modal = document.getElementById("notesModal");
  if (!modal) return;
  var textarea = document.getElementById("note");
  var modalInput = document.getElementById("notes-markdown-input-modal");
  var modalOutput = document.getElementById("notes-rendered-output-modal");
  // Sync current value (handles live mode)
  var currentValue = _getNotesValue();
  if (modalInput) modalInput.innerText = currentValue || "";
  if (modalOutput) modalOutput.style.display = "none";
  if (modalInput) modalInput.style.display = "";
  _setNotesRenderToggleLabel(false, "modal");
  modal.style.display = "flex";
  if (modalInput) setTimeout(function() { modalInput.focus(); }, 50);
}

function closeNotesModal(save) {
  var modal = document.getElementById("notesModal");
  if (modal) modal.style.display = "none";
  if (save) {
    var modalInput = document.getElementById("notes-markdown-input-modal");
    var mainNote = document.getElementById("note");
    if (modalInput && mainNote) {
      mainNote.value = modalInput.innerText;
      if (_notesRenderMode === 'live') _nlpBuild();
      autoGrowNote(mainNote);
      if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    }
  }
}

function toggleModalNotesRender() {
  var modalInput = document.getElementById("notes-markdown-input-modal");
  var modalOutput = document.getElementById("notes-rendered-output-modal");
  if (!modalInput || !modalOutput) return;
  var isRendered = modalOutput.style.display !== "none";
  if (isRendered) {
    modalOutput.style.display = "none";
    modalInput.style.display = "";
    modalInput.focus();
    _setNotesRenderToggleLabel(false, "modal");
  } else {
    var readingHtml = '';
    if (typeof marked !== "undefined" && marked.parse) {
      readingHtml = marked.parse(modalInput.innerText || "");
    } else {
      readingHtml = '<pre style="white-space:pre-wrap;">' + _escHtml(modalInput.innerText || '') + '</pre>';
    }
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      readingHtml = DOMPurify.sanitize(readingHtml, { ADD_ATTR: ['rel'] });
    }
    modalOutput.innerHTML = readingHtml;
    modalOutput.style.display = "block";
    modalInput.style.display = "none";
    _setNotesRenderToggleLabel(true, "modal");
  }
}

function _setNotesRenderToggleLabel(isRendered, source) {
  var btnId = source === "modal" ? "modal-render-toggle-btn" : "notes-render-toggle-btn";
  var btn = document.getElementById(btnId);
  if (!btn) return;
  if (isRendered) {
    btn.innerHTML = '<i class="fas fa-edit"></i> Edit';
  } else {
    btn.innerHTML = '<i class="fas fa-eye"></i> Render';
  }
}
