/**
 * editor-color.js — Color zone: swatches, custom colors, background tinting
 *
 * Handles fetching custom colors from settings, rendering color swatches,
 * setting the chit color (including editor background tinting), updating
 * the color preview, and attaching click listeners to swatch elements.
 *
 * Depends on: shared.js (getCachedSettings, setSaveButtonUnsaved),
 *             editor.js (defaultColors)
 * Loaded before: editor-init.js, editor.js
 */

async function _fetchCustomColors() {
  try {
    const settings = await getCachedSettings();
    if (!settings.custom_colors) {
      console.warn("No custom_colors array found in API response");
      return [];
    }
    if (!Array.isArray(settings.custom_colors)) {
      console.warn("custom_colors is not an array:", settings.custom_colors);
      return [];
    }

    // Normalize colors: preserve name if present, fall back to hex
    const normalizedColors = settings.custom_colors.map((c) =>
      typeof c === "string"
        ? { hex: c, name: c }
        : { hex: c.hex, name: c.name || c.hex },
    );

    return normalizedColors;
  } catch (error) {
    console.error("Error fetching custom colors:", error);
    return [];
  }
}

function _setColor(hex, name = "Custom") {
  const colorInput = document.getElementById("color");
  const colorPreview = document.getElementById("selected-color");
  const colorNameLabel = document.getElementById("selected-color-name");
  const mainEditor = document.getElementById("mainEditor");
  // NOTE: header-row intentionally NOT colored — design spec says header stays fixed color

  if (colorInput) colorInput.value = hex;
  if (colorPreview) colorPreview.style.backgroundColor = hex;
  if (mainEditor) mainEditor.style.backgroundColor = hex;
  if (colorNameLabel) colorNameLabel.textContent = name;

  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    const match = swatch.dataset.color?.toLowerCase() === hex.toLowerCase();
    swatch.classList.toggle("selected", match);
  });

  _updateColorPreview(); // Sync preview and selection

  // Enable save button because color changed
  setSaveButtonUnsaved();
}

function _updateColorPreview() {
  const colorInput = document.getElementById("color");
  const preview = document.getElementById("selected-color");
  const color = colorInput.value;
  const allColors = [...defaultColors, ...(window.customColors || [])];
  const colorObj = allColors.find(
    (c) => c.hex.toLowerCase() === color.toLowerCase(),
  );
  const label = colorObj ? colorObj.name : "Custom";

  if (preview) preview.style.backgroundColor = color;
  const mainEditor = document.getElementById("mainEditor");
  if (mainEditor) mainEditor.style.backgroundColor = color;
  const colorNameLabel = document.getElementById("selected-color-name");
  if (colorNameLabel) colorNameLabel.textContent = label;

  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.toggle(
      "selected",
      swatch.dataset.color?.toLowerCase() === color.toLowerCase(),
    );
  });
}

function _renderCustomColors(customColors) {
  const customColorsContainer = document.getElementById("custom-colors");
  if (!customColorsContainer) {
    console.warn("#custom-colors container not found");
    return;
  }

  // Clear existing custom swatches before re-rendering
  customColorsContainer.innerHTML = "";

  if (!customColors || customColors.length === 0) return;

  customColors.forEach(({ hex, name }) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.dataset.color = hex;
    swatch.style.backgroundColor = hex;
    swatch.title = name || hex;

    swatch.addEventListener("click", () => {
      _setColor(hex, name || "Custom");
    });

    customColorsContainer.appendChild(swatch);
  });
}

function _attachColorSwatchListeners() {
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const hex = swatch.dataset.color;
      const allColors = [...defaultColors, ...(window.customColors || [])];
      const colorObj = allColors.find(
        (c) => c.hex.toLowerCase() === hex.toLowerCase(),
      );
      const name = colorObj ? colorObj.name : "Custom";
      _setColor(hex, name);
    });
  });
}
