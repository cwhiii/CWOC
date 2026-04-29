/**
 * editor-health.js — Health indicators zone
 *
 * Renders health indicator input fields (heart rate, blood pressure, weight,
 * etc.), loads health data from a chit, and gathers health data for saving.
 * Supports imperial/metric unit switching and sex-specific fields.
 *
 * Depends on: shared.js (getCachedSettings, setSaveButtonUnsaved)
 * Loaded before: editor-init.js, editor.js
 */

window._healthData = {};

var _healthFields = [
  // Vitals
  { id: 'heartRateEntry', key: 'heart_rate', label: '💓 Heart Rate', unit: 'bpm', metricUnit: 'bpm' },
  { id: 'bpEntry', key: 'bp', label: '🩸 Blood Pressure', unit: 'mmHg', metricUnit: 'mmHg', isBP: true },
  { id: 'spo2Entry', key: 'spo2', label: '🫁 Oxygen Saturation', unit: '%', metricUnit: '%' },
  { id: 'temperatureEntry', key: 'temperature', label: '🌡️ Temperature', unit: '°F', metricUnit: '°C' },
  // Body
  { id: 'weightEntry', key: 'weight', label: '⚖️ Weight', unit: 'lbs', metricUnit: 'kg' },
  { id: 'heightEntry', key: 'height', label: '📐 Height', unit: 'in', metricUnit: 'cm' },
  { id: 'glucoseEntry', key: 'glucose', label: '🍬 Glucose', unit: 'mg/dL', metricUnit: 'mmol/L' },
  // Activity
  { id: 'distanceEntry', key: 'distance', label: '🏃 Distance', unit: 'mi', metricUnit: 'km' },
  // Cycle (female only)
  { id: 'cycleEntry', key: 'period_active', label: '🔴 Period Active', unit: '', metricUnit: '', isCheckbox: true },
];

function renderHealthIndicator(indicatorId) {
  var element = document.getElementById(indicatorId);
  if (!element) return;

  var field = _healthFields.find(function(f) { return f.id === indicatorId; });
  if (!field) return;

  element.innerHTML = '';
  element.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 0;';

  var label = document.createElement('label');
  label.textContent = field.label;
  label.style.cssText = 'flex:1;font-size:0.9em;font-weight:bold;color:#1a1208;margin:0;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  element.appendChild(label);

  if (field.isCheckbox) {
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!window._healthData[field.key];
    cb.style.cssText = 'width:20px;height:20px;accent-color:#8b5a2b;cursor:pointer;flex-shrink:0;';
    cb.addEventListener('change', function() { window._healthData[field.key] = cb.checked; setSaveButtonUnsaved(); });
    element.appendChild(cb);
    // Spacer to match input+unit width
    var spacer = document.createElement('span');
    spacer.style.cssText = 'width:40px;flex-shrink:0;';
    element.appendChild(spacer);
  } else if (field.isBP) {
    var sysInput = document.createElement('input');
    sysInput.type = 'number';
    sysInput.placeholder = 'sys';
    sysInput.style.cssText = 'width:50px;padding:4px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.9em;text-align:center;box-sizing:border-box;flex-shrink:0;';
    sysInput.value = (window._healthData.bp_systolic != null) ? window._healthData.bp_systolic : '';
    sysInput.addEventListener('input', function() { window._healthData.bp_systolic = sysInput.value ? parseInt(sysInput.value) : null; setSaveButtonUnsaved(); });
    element.appendChild(sysInput);

    var slash = document.createElement('span');
    slash.textContent = '/';
    slash.style.cssText = 'font-size:0.9em;flex-shrink:0;';
    element.appendChild(slash);

    var diaInput = document.createElement('input');
    diaInput.type = 'number';
    diaInput.placeholder = 'dia';
    diaInput.style.cssText = 'width:50px;padding:4px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.9em;text-align:center;box-sizing:border-box;flex-shrink:0;';
    diaInput.value = (window._healthData.bp_diastolic != null) ? window._healthData.bp_diastolic : '';
    diaInput.addEventListener('input', function() { window._healthData.bp_diastolic = diaInput.value ? parseInt(diaInput.value) : null; setSaveButtonUnsaved(); });
    element.appendChild(diaInput);
  } else {
    var input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.placeholder = '—';
    input.style.cssText = 'width:70px;padding:4px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.9em;text-align:center;box-sizing:border-box;flex-shrink:0;';
    input.value = (window._healthData[field.key] != null) ? window._healthData[field.key] : '';
    input.addEventListener('input', function() { window._healthData[field.key] = input.value ? parseFloat(input.value) : null; setSaveButtonUnsaved(); });
    element.appendChild(input);
  }

  if (field.unit) {
    var unitSpan = document.createElement('span');
    var isMetric = window._healthUnitSystem === 'metric';
    unitSpan.textContent = isMetric ? field.metricUnit : field.unit;
    unitSpan.style.cssText = 'font-size:0.8em;color:#6b4e31;flex-shrink:0;';
    element.appendChild(unitSpan);
  }
}

function _loadHealthData(chit) {
  window._healthData = {};
  if (chit.health_data) {
    try {
      var parsed = typeof chit.health_data === 'string' ? JSON.parse(chit.health_data) : chit.health_data;
      window._healthData = parsed || {};
    } catch (e) { window._healthData = {}; }
  }

  // Read unit system and sex from settings
  getCachedSettings().then(function(s) {
    window._healthUnitSystem = s.unit_system || 'imperial';
    var isFemale = (s.sex === 'Woman');
    var repSection = document.getElementById('reproductionSection');
    if (repSection) {
      repSection.style.display = isFemale ? '' : 'none';
    }
    // Render all indicators with correct units
    _healthFields.forEach(function(f) {
      // Skip cycle field if not female
      if (f.id === 'cycleEntry' && !isFemale) return;
      renderHealthIndicator(f.id);
    });
  }).catch(function() {
    window._healthUnitSystem = 'imperial';
    _healthFields.forEach(function(f) { renderHealthIndicator(f.id); });
  });
}

function _gatherHealthData() {
  var result = {};
  for (var key in window._healthData) {
    if (window._healthData[key] != null) result[key] = window._healthData[key];
  }
  return Object.keys(result).length > 0 ? result : null;
}
