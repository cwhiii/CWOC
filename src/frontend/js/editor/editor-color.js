/**
 * editor-color.js — Color zone: unified color picker, background tinting
 *
 * Uses the shared cwocRenderColorPicker() from shared-utils.js to render
 * the unified color palette (defaults + custom colors from settings).
 * Handles setting the chit color, editor background tinting, and preview updates.
 *
 * Depends on: shared-utils.js (cwocRenderColorPicker, cwocColorName, _cwocDefaultColors,
 *             getCachedSettings, setSaveButtonUnsaved)
 * Loaded before: editor-init.js
 */

/**
 * Initialize the editor color picker using the shared cwocRenderColorPicker.
 * Renders all default + custom color swatches into #editor-color-swatches.
 */
function _initEditorColorPicker() {
  var container = document.getElementById('editor-color-swatches');
  if (!container) return;

  var currentColor = document.getElementById('color')?.value || '';
  if (currentColor === 'transparent') currentColor = '';

  cwocRenderColorPicker(container, currentColor, function(hex) {
    var name = hex ? cwocColorName(hex) : 'None';
    _setColor(hex || 'transparent', name);
  }, { showNone: true });
}

function _setColor(hex, name) {
  if (name === undefined) name = cwocColorName(hex);
  var colorInput = document.getElementById("color");
  var colorPreview = document.getElementById("selected-color");
  var colorNameLabel = document.getElementById("selected-color-name");
  var mainEditor = document.getElementById("mainEditor");
  // NOTE: header-row intentionally NOT colored — design spec says header stays fixed color

  if (colorInput) colorInput.value = hex;
  if (colorPreview) colorPreview.style.backgroundColor = hex;
  if (mainEditor) mainEditor.style.backgroundColor = hex;
  if (colorNameLabel) colorNameLabel.textContent = name || 'None';

  // Update swatch selection in the picker
  var container = document.getElementById('editor-color-swatches');
  if (container) {
    var normalizedHex = (hex || '').toLowerCase();
    container.querySelectorAll('.color-swatch').forEach(function(swatch) {
      swatch.classList.remove('selected');
      if (!normalizedHex || normalizedHex === 'transparent') {
        if (swatch.classList.contains('cwoc-color-none')) swatch.classList.add('selected');
      } else if (swatch.dataset.hex === normalizedHex) {
        swatch.classList.add('selected');
      }
    });
  }

  // Update mobile nav bar color to match chit color
  if (typeof _applyMobileNavBarColor === 'function') _applyMobileNavBarColor();
  // Update overview panel contrast colors
  if (typeof _applyMobileOverviewContrast === 'function') _applyMobileOverviewContrast();

  // Enable save button because color changed (but not during initial load)
  if (!window._editorLoadingChit) setSaveButtonUnsaved();
}

/**
 * Legacy compatibility: _fetchCustomColors still works but now just returns
 * the custom colors from settings for use in editor-init.js color resolution.
 */
async function _fetchCustomColors() {
  try {
    var settings = await getCachedSettings();
    if (!settings.custom_colors || !Array.isArray(settings.custom_colors)) return [];
    return settings.custom_colors.map(function(c) {
      return typeof c === 'string'
        ? { hex: c, name: cwocColorName(c) }
        : { hex: c.hex, name: c.name || cwocColorName(c.hex) };
    });
  } catch (error) {
    console.error("Error fetching custom colors:", error);
    return [];
  }
}
