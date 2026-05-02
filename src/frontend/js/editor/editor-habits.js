/**
 * editor-habits.js — Habit Log zone logic
 *
 * Provides the Habit Log collapsible zone in the chit editor, visible only
 * when habit=true.  Contains:
 *   - Period history list (reverse chronological, editable counts)
 *   - Charts: completion bar chart, success rate trend, streak timeline
 *
 * Depends on: shared.js (getCurrentPeriodDate, getHabitSuccessRate, getHabitStreak),
 *             editor-dates.js (onHabitToggle), editor-save.js (setSaveButtonUnsaved)
 * Loaded before: editor-init.js
 */

// ── Habit Log Zone — Period History ──────────────────────────────────────────

/**
 * Load the Habit Log zone for a habit chit.
 * Builds the period history list from recurrence_exceptions and renders charts.
 *
 * @param {Object} chit — the full chit object from the API
 */
function _loadHabitLog(chit) {
  var container = document.getElementById('habitLogPeriodList');
  var chartsContainer = document.getElementById('habitLogChartsContainer');
  if (!container) return;

  container.innerHTML = '';

  var exceptions = chit.recurrence_exceptions || [];
  if (!Array.isArray(exceptions)) {
    try { exceptions = JSON.parse(exceptions); } catch (e) { exceptions = []; }
  }

  // Filter to only entries that have a date (period snapshots)
  var periods = [];
  for (var i = 0; i < exceptions.length; i++) {
    var ex = exceptions[i];
    if (!ex.date) continue;
    periods.push(ex);
  }

  // Sort reverse chronological (most recent first)
  periods.sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  if (periods.length === 0) {
    container.innerHTML = '<div class="habit-log-empty">No past periods recorded yet.</div>';
    if (chartsContainer) chartsContainer.style.display = 'none';
    return;
  }

  // Build the period list
  for (var j = 0; j < periods.length; j++) {
    var p = periods[j];
    var row = _buildPeriodRow(p, j, chit);
    container.appendChild(row);
  }

  // Render charts
  if (chartsContainer) {
    chartsContainer.style.display = '';
    _renderHabitCharts(chit, periods);
  }
}

/**
 * Build a single period row for the history list.
 *
 * @param {Object} period — a recurrence exception entry
 * @param {number} index — index in the sorted periods array
 * @param {Object} chit — the full chit object
 * @returns {HTMLElement}
 */
function _buildPeriodRow(period, index, chit) {
  var row = document.createElement('div');
  row.className = 'habit-log-period-row';
  if (period.broken_off) row.classList.add('habit-log-broken-off');

  // Status indicator (first column)
  var statusSpan = document.createElement('span');
  statusSpan.className = 'habit-log-status';
  var success = _getPeriodSuccess(period);
  var goal = _getPeriodGoal(period, chit);
  if (period.broken_off) {
    statusSpan.textContent = '⏭️';
    statusSpan.title = 'Broken off / skipped';
  } else if (success >= goal) {
    statusSpan.textContent = '✅';
    statusSpan.title = 'Goal met';
  } else {
    statusSpan.textContent = '❌';
    statusSpan.title = 'Goal not met';
  }
  row.appendChild(statusSpan);

  // Date label (second column)
  var dateLabel = document.createElement('span');
  dateLabel.className = 'habit-log-date';
  var freq = (chit.recurrence_rule && chit.recurrence_rule.freq) ? chit.recurrence_rule.freq : 'DAILY';
  dateLabel.textContent = _formatPeriodDate(period.date, freq);
  row.appendChild(dateLabel);

  // Counter widget (third column) — uses shared _buildHabitCounter
  var counterCell = document.createElement('span');
  counterCell.className = 'habit-log-counter-cell';

  if (period.broken_off) {
    counterCell.textContent = '—';
    counterCell.style.color = 'var(--dark-grey)';
    counterCell.style.fontStyle = 'italic';
  } else if (typeof _buildHabitCounter === 'function') {
    var periodDate = period.date;
    var exceptions = window._loadedRecurrenceExceptions || [];
    var counter = _buildHabitCounter({
      success: success,
      goal: goal,
      freqLabel: '',
      disabled: false,
      onIncrement: function(newVal) {
        _updatePeriodException(periodDate, newVal, goal, chit, row);
      },
      onDecrement: function(newVal) {
        _updatePeriodException(periodDate, newVal, goal, chit, row);
      }
    });
    counterCell.appendChild(counter);
  } else {
    counterCell.textContent = success + ' / ' + goal;
  }
  row.appendChild(counterCell);

  return row;
}

/**
 * Update a period's exception entry after counter change, refresh status icon and charts.
 */
function _updatePeriodException(periodDate, newSuccess, goal, chit, row) {
  var exceptions = window._loadedRecurrenceExceptions || [];
  if (!Array.isArray(exceptions)) {
    try { exceptions = JSON.parse(exceptions); } catch (e) { exceptions = []; }
  }

  // Find and update the exception
  for (var i = 0; i < exceptions.length; i++) {
    if (exceptions[i].date === periodDate) {
      exceptions[i].habit_success = newSuccess;
      exceptions[i].completed = (newSuccess >= goal);
      break;
    }
  }
  window._loadedRecurrenceExceptions = exceptions;

  // Update status icon in the row
  var statusSpan = row.querySelector('.habit-log-status');
  if (statusSpan) {
    if (newSuccess >= goal) {
      statusSpan.textContent = '✅';
      statusSpan.title = 'Goal met';
    } else {
      statusSpan.textContent = '❌';
      statusSpan.title = 'Goal not met';
    }
  }

  // Re-render charts
  var chartsContainer = document.getElementById('habitLogChartsContainer');
  if (chartsContainer) {
    var virtualChit = Object.assign({}, chit);
    virtualChit.recurrence_exceptions = exceptions;
    var periods = [];
    for (var k = 0; k < exceptions.length; k++) {
      if (exceptions[k].date) periods.push(exceptions[k]);
    }
    periods.sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    _renderHabitCharts(virtualChit, periods);
  }

  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Get the habit_success value from a period entry, handling legacy entries.
 * Legacy entries (without habit_success): completed=true → goal, else 0.
 */
function _getPeriodSuccess(period) {
  if (period.habit_success !== undefined && period.habit_success !== null) {
    return parseInt(period.habit_success) || 0;
  }
  // Legacy fallback
  return period.completed ? 1 : 0;
}

/**
 * Get the habit_goal value from a period entry, handling legacy entries.
 */
function _getPeriodGoal(period, chit) {
  if (period.habit_goal !== undefined && period.habit_goal !== null) {
    return parseInt(period.habit_goal) || 1;
  }
  // Legacy fallback — use the chit's current goal or 1
  return (chit && chit.habit_goal) ? parseInt(chit.habit_goal) || 1 : 1;
}

/**
 * Format a period date string based on the habit's frequency.
 * - DAILY: "Apr 25, 2026"
 * - WEEKLY: "Week of Apr 21"
 * - MONTHLY: "Month of April 2026"
 * - YEARLY: "Year of 2026"
 *
 * @param {string} dateStr — YYYY-MM-DD
 * @param {string} freq — recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY)
 */
function _formatPeriodDate(dateStr, freq) {
  if (!dateStr) return '—';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthIdx = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);
  var year = parts[0];

  if (freq === 'WEEKLY') {
    return 'Week of ' + months[monthIdx] + ' ' + day;
  }
  if (freq === 'MONTHLY') {
    return fullMonths[monthIdx] + ' ' + year;
  }
  if (freq === 'YEARLY') {
    return 'Year of ' + year;
  }
  // DAILY or fallback
  return months[monthIdx] + ' ' + day + ', ' + year;
}

/**
 * Format the current period label for a habit chit (used in the Habits View).
 * - DAILY: "Apr 25, 2026"
 * - WEEKLY: "Week of Apr 21"
 * - MONTHLY: "May 2026"
 * - YEARLY: "2026"
 *
 * @param {object} chit — the chit object
 * @returns {string}
 */
function _formatCurrentPeriodLabel(chit) {
  var rule = chit.recurrence_rule;
  var freq = (rule && rule.freq) ? rule.freq : 'DAILY';
  var periodDate = (typeof getCurrentPeriodDate === 'function') ? getCurrentPeriodDate(chit) : null;
  if (!periodDate) return '';

  var parts = periodDate.split('-');
  if (parts.length !== 3) return periodDate;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthIdx = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);
  var year = parts[0];

  if (freq === 'WEEKLY') {
    return 'Week of ' + months[monthIdx] + ' ' + day;
  }
  if (freq === 'MONTHLY') {
    return months[monthIdx] + ' ' + year;
  }
  if (freq === 'YEARLY') {
    return year;
  }
  // DAILY
  return months[monthIdx] + ' ' + day + ', ' + year;
}

// ── Inline Editing of Past Period Counts ─────────────────────────────────────

/**
 * Start inline editing of a period's habit_success count.
 * Replaces the count span with a numeric input.
 *
 * @param {HTMLElement} countSpan — the span element showing "X / Y"
 * @param {Object} chit — the full chit object
 */
function _startInlineEdit(countSpan, chit) {
  // Prevent double-editing
  if (countSpan.querySelector('input')) return;

  var periodDate = countSpan.dataset.periodDate;
  var exceptions = window._loadedRecurrenceExceptions || [];
  if (!Array.isArray(exceptions)) {
    try { exceptions = JSON.parse(exceptions); } catch (e) { exceptions = []; }
  }

  // Find the matching exception
  var exEntry = null;
  for (var i = 0; i < exceptions.length; i++) {
    if (exceptions[i].date === periodDate) {
      exEntry = exceptions[i];
      break;
    }
  }
  if (!exEntry) return;

  var currentSuccess = _getPeriodSuccess(exEntry);
  var currentGoal = _getPeriodGoal(exEntry, chit);

  // Replace span content with input
  var originalText = countSpan.textContent;
  countSpan.textContent = '';

  var input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = String(currentGoal);
  input.value = String(currentSuccess);
  input.className = 'habit-log-inline-input';
  input.style.width = '50px';

  var goalLabel = document.createElement('span');
  goalLabel.textContent = ' / ' + currentGoal;
  goalLabel.style.fontSize = '0.9em';

  countSpan.appendChild(input);
  countSpan.appendChild(goalLabel);
  input.focus();
  input.select();

  function _finishEdit() {
    var newVal = parseInt(input.value);
    if (isNaN(newVal) || newVal < 0) newVal = 0;
    if (newVal > currentGoal) newVal = currentGoal;

    // Update the exception entry
    exEntry.habit_success = newVal;
    exEntry.completed = (newVal >= currentGoal);

    // Update the global loaded exceptions
    window._loadedRecurrenceExceptions = exceptions;

    // Rebuild the count display
    countSpan.textContent = newVal + ' / ' + currentGoal;
    countSpan.className = 'habit-log-count';
    countSpan.style.cursor = 'pointer';
    if (newVal >= currentGoal) {
      countSpan.classList.add('habit-log-met');
    } else {
      countSpan.classList.add('habit-log-missed');
    }

    // Update the status icon in the same row
    var row = countSpan.closest('.habit-log-period-row');
    if (row) {
      var statusSpan = row.querySelector('.habit-log-status');
      if (statusSpan) {
        if (newVal >= currentGoal) {
          statusSpan.textContent = '✅';
          statusSpan.title = 'Goal met';
        } else {
          statusSpan.textContent = '❌';
          statusSpan.title = 'Goal not met';
        }
      }
    }

    // Re-render charts with updated data
    var chartsContainer = document.getElementById('habitLogChartsContainer');
    if (chartsContainer) {
      // Build a virtual chit with updated exceptions for chart rendering
      var virtualChit = Object.assign({}, chit);
      virtualChit.recurrence_exceptions = exceptions;
      var periods = [];
      for (var k = 0; k < exceptions.length; k++) {
        if (exceptions[k].date) periods.push(exceptions[k]);
      }
      periods.sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
      _renderHabitCharts(virtualChit, periods);
    }

    // Mark editor as having unsaved changes
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  }

  input.addEventListener('blur', _finishEdit);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      // Restore original text
      countSpan.textContent = originalText;
      countSpan.style.cursor = 'pointer';
    }
  });
}

// ── Habit Charts ─────────────────────────────────────────────────────────────

/**
 * Render all habit charts into the charts container.
 *
 * @param {Object} chit — the chit object
 * @param {Array} periods — sorted period entries (reverse chronological)
 */
function _renderHabitCharts(chit, periods) {
  var container = document.getElementById('habitLogChartsContainer');
  if (!container) return;

  // Work with chronological order for charts
  var chronological = periods.slice().reverse();

  // Filter out broken-off periods for chart data
  var activePeriods = [];
  for (var i = 0; i < chronological.length; i++) {
    if (!chronological[i].broken_off) {
      activePeriods.push(chronological[i]);
    }
  }

  if (activePeriods.length === 0) {
    container.innerHTML = '<div class="habit-log-empty">No data yet for charts.</div>';
    return;
  }

  // Ensure canvas elements exist
  var completionCanvas = document.getElementById('habitChartCompletion');
  var successRateCanvas = document.getElementById('habitChartSuccessRate');
  var streakCanvas = document.getElementById('habitChartStreak');

  if (completionCanvas) _drawCompletionChart(completionCanvas, activePeriods, chit);
  if (successRateCanvas) _drawSuccessRateChart(successRateCanvas, activePeriods, chit);
  if (streakCanvas) _drawStreakChart(streakCanvas, activePeriods, chit);
}

/**
 * Draw the completion bar chart — habit_success per period with habit_goal line.
 */
function _drawCompletionChart(canvas, periods, chit) {
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.parentElement.clientWidth || 300;
  var h = canvas.height = 180;
  ctx.clearRect(0, 0, w, h);

  var padding = { top: 25, right: 15, bottom: 35, left: 35 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;

  // Limit to last 30 periods for readability
  var data = periods.slice(-30);
  var maxVal = 1;
  for (var i = 0; i < data.length; i++) {
    var s = _getPeriodSuccess(data[i]);
    var g = _getPeriodGoal(data[i], chit);
    if (s > maxVal) maxVal = s;
    if (g > maxVal) maxVal = g;
  }
  maxVal = Math.ceil(maxVal * 1.1) || 1;

  var barWidth = Math.max(4, (chartW / data.length) * 0.6);
  var gap = (chartW - barWidth * data.length) / (data.length + 1);

  // Title
  ctx.fillStyle = '#4a2c2a';
  ctx.font = 'bold 12px Lora, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Completion Over Time', w / 2, 14);

  // Y-axis
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, h - padding.bottom);
  ctx.lineTo(w - padding.right, h - padding.bottom);
  ctx.stroke();

  // Y-axis labels
  ctx.fillStyle = '#4a2c2a';
  ctx.font = '10px Lora, Georgia, serif';
  ctx.textAlign = 'right';
  for (var y = 0; y <= 4; y++) {
    var val = Math.round((maxVal / 4) * y);
    var yPos = h - padding.bottom - (chartH * y / 4);
    ctx.fillText(String(val), padding.left - 4, yPos + 3);
    // Grid line
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.15)';
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(w - padding.right, yPos);
    ctx.stroke();
  }

  // Bars
  for (var i = 0; i < data.length; i++) {
    var success = _getPeriodSuccess(data[i]);
    var goal = _getPeriodGoal(data[i], chit);
    var barH = (success / maxVal) * chartH;
    var x = padding.left + gap + i * (barWidth + gap);
    var barY = h - padding.bottom - barH;

    // Bar color: green if met goal, amber if not
    ctx.fillStyle = success >= goal ? 'rgba(0, 128, 128, 0.7)' : 'rgba(218, 165, 32, 0.7)';
    ctx.fillRect(x, barY, barWidth, barH);

    // X-axis label (show every Nth label to avoid overlap)
    if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
      ctx.fillStyle = '#4a2c2a';
      ctx.font = '9px Lora, Georgia, serif';
      ctx.textAlign = 'center';
      var label = data[i].date ? data[i].date.substring(5) : '';
      ctx.save();
      ctx.translate(x + barWidth / 2, h - padding.bottom + 10);
      ctx.rotate(-0.4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  // Goal line
  var currentGoal = (chit.habit_goal) ? parseInt(chit.habit_goal) || 1 : 1;
  var goalY = h - padding.bottom - (currentGoal / maxVal) * chartH;
  ctx.strokeStyle = '#b22222';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(padding.left, goalY);
  ctx.lineTo(w - padding.right, goalY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Goal label
  ctx.fillStyle = '#b22222';
  ctx.font = '9px Lora, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('Goal: ' + currentGoal, w - padding.right - 50, goalY - 3);
}

/**
 * Draw the success rate trend line chart — rolling percentage over time.
 */
function _drawSuccessRateChart(canvas, periods, chit) {
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.parentElement.clientWidth || 300;
  var h = canvas.height = 180;
  ctx.clearRect(0, 0, w, h);

  var padding = { top: 25, right: 15, bottom: 35, left: 35 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;

  var data = periods.slice(-30);

  // Title
  ctx.fillStyle = '#4a2c2a';
  ctx.font = 'bold 12px Lora, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Success Rate Trend', w / 2, 14);

  // Axes
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, h - padding.bottom);
  ctx.lineTo(w - padding.right, h - padding.bottom);
  ctx.stroke();

  // Y-axis labels (0% to 100%)
  ctx.fillStyle = '#4a2c2a';
  ctx.font = '10px Lora, Georgia, serif';
  ctx.textAlign = 'right';
  for (var y = 0; y <= 4; y++) {
    var pct = y * 25;
    var yPos = h - padding.bottom - (chartH * y / 4);
    ctx.fillText(pct + '%', padding.left - 4, yPos + 3);
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.15)';
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(w - padding.right, yPos);
    ctx.stroke();
  }

  // Calculate rolling success rate at each point
  var rates = [];
  var metCount = 0;
  for (var i = 0; i < data.length; i++) {
    var s = _getPeriodSuccess(data[i]);
    var g = _getPeriodGoal(data[i], chit);
    if (s >= g) metCount++;
    rates.push(Math.round((metCount / (i + 1)) * 100));
  }

  if (rates.length < 2) {
    ctx.fillStyle = '#4a2c2a';
    ctx.font = '11px Lora, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Need at least 2 periods', w / 2, h / 2);
    return;
  }

  // Draw the line
  var stepX = chartW / (rates.length - 1);
  ctx.strokeStyle = '#008080';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var i = 0; i < rates.length; i++) {
    var x = padding.left + i * stepX;
    var y = h - padding.bottom - (rates[i] / 100) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw dots
  for (var i = 0; i < rates.length; i++) {
    var x = padding.left + i * stepX;
    var y = h - padding.bottom - (rates[i] / 100) * chartH;
    ctx.fillStyle = '#008080';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // X-axis labels
  for (var i = 0; i < data.length; i++) {
    if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
      var x = padding.left + i * stepX;
      ctx.fillStyle = '#4a2c2a';
      ctx.font = '9px Lora, Georgia, serif';
      ctx.textAlign = 'center';
      var label = data[i].date ? data[i].date.substring(5) : '';
      ctx.save();
      ctx.translate(x, h - padding.bottom + 10);
      ctx.rotate(-0.4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }
}

/**
 * Draw the streak timeline — visual blocks showing streaks and breaks.
 */
function _drawStreakChart(canvas, periods, chit) {
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.parentElement.clientWidth || 300;
  var h = canvas.height = 180;
  ctx.clearRect(0, 0, w, h);

  var padding = { top: 25, right: 15, bottom: 35, left: 15 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;

  var data = periods.slice(-30);

  // Title
  ctx.fillStyle = '#4a2c2a';
  ctx.font = 'bold 12px Lora, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Streak Timeline', w / 2, 14);

  if (data.length === 0) {
    ctx.fillStyle = '#4a2c2a';
    ctx.font = '11px Lora, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', w / 2, h / 2);
    return;
  }

  var blockW = Math.max(8, chartW / data.length);
  var blockH = chartH * 0.5;
  var blockY = padding.top + chartH * 0.15;

  // Draw blocks
  for (var i = 0; i < data.length; i++) {
    var s = _getPeriodSuccess(data[i]);
    var g = _getPeriodGoal(data[i], chit);
    var x = padding.left + i * (chartW / data.length);

    if (s >= g) {
      ctx.fillStyle = 'rgba(0, 128, 128, 0.75)';
    } else {
      ctx.fillStyle = 'rgba(178, 34, 34, 0.4)';
    }
    ctx.fillRect(x + 1, blockY, blockW - 2, blockH);

    // Fire emoji for streaks — check if this is part of a streak
    if (s >= g) {
      // Count consecutive met going backward from this point
      var streakLen = 0;
      for (var k = i; k >= 0; k--) {
        var ks = _getPeriodSuccess(data[k]);
        var kg = _getPeriodGoal(data[k], chit);
        if (ks >= kg) streakLen++;
        else break;
      }
      if (streakLen >= 3) {
        ctx.fillStyle = '#4a2c2a';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔥', x + blockW / 2, blockY - 3);
      }
    }

    // X-axis label
    if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
      ctx.fillStyle = '#4a2c2a';
      ctx.font = '9px Lora, Georgia, serif';
      ctx.textAlign = 'center';
      var label = data[i].date ? data[i].date.substring(5) : '';
      ctx.save();
      ctx.translate(x + blockW / 2, h - padding.bottom + 10);
      ctx.rotate(-0.4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  // Legend
  var legendY = blockY + blockH + 20;
  ctx.fillStyle = 'rgba(0, 128, 128, 0.75)';
  ctx.fillRect(padding.left, legendY, 12, 12);
  ctx.fillStyle = '#4a2c2a';
  ctx.font = '10px Lora, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('Met goal', padding.left + 16, legendY + 10);

  ctx.fillStyle = 'rgba(178, 34, 34, 0.4)';
  ctx.fillRect(padding.left + 80, legendY, 12, 12);
  ctx.fillStyle = '#4a2c2a';
  ctx.fillText('Missed', padding.left + 96, legendY + 10);
}

// ── Zone Visibility ──────────────────────────────────────────────────────────

/**
 * Show or hide the Habit Log zone based on the habit flag.
 *
 * @param {boolean} isHabit — whether the chit is a habit
 */
function _toggleHabitLogZone(isHabit) {
  var section = document.getElementById('habitLogSection');
  if (!section) return;

  if (isHabit) {
    section.style.display = '';
    // Auto-expand the zone content and sub-sections
    var content = document.getElementById('habitLogContent');
    if (content) content.style.display = '';
    var settings = document.getElementById('habitSettingsBody');
    if (settings) settings.style.display = '';
    var charts = document.getElementById('habitLogChartsContainer');
    if (charts) charts.style.display = '';
    var periods = document.getElementById('habitLogPeriodList');
    if (periods) periods.style.display = '';
    // Update toggle icon to expanded
    var icon = section.querySelector('.zone-toggle-icon');
    if (icon) icon.textContent = '🔼';
    // Update sub-header toggles to expanded
    section.querySelectorAll('.habit-log-toggle').forEach(function(t) { t.textContent = '▼'; });
  } else {
    section.style.display = 'none';
  }
}
