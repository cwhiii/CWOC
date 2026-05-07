/**
 * shared-habits.js — Habits calculation helpers.
 *
 * Pure calculation functions used by both the dashboard habits view and the
 * chit editor. Includes period date calculation, success rate, streak counting,
 * period rollover evaluation, and the shared habit counter widget.
 *
 * Loaded BEFORE shared.js (which references these functions).
 */

// ── Habits Helpers ────────────────────────────────────────────────────────────

/**
 * Return the current period's date for a recurring chit as a YYYY-MM-DD string.
 *
 * The "current period" depends on the chit's recurrence frequency:
 *   DAILY  (interval=1) → today
 *   DAILY  (interval>1) → walk from start by interval days, find period containing today
 *   WEEKLY (no byDay)   → start of current week per week_start_day setting
 *   WEEKLY (with byDay) → most recent scheduled day ≤ today
 *   MONTHLY             → 1st of current month
 *   YEARLY              → Jan 1 of current year
 *   Custom intervals    → walk from start by interval steps, find most recent ≤ today
 *
 * Fallback: if chit has no start_datetime, returns today's date.
 *
 * @param {object} chit - A chit object with recurrence_rule and start_datetime
 * @returns {string} YYYY-MM-DD
 */
function getCurrentPeriodDate(chit) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return _fmt(today);

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];

  // Parse start date — fallback to today if missing
  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return _fmt(today);
  }

  // If start date is in the future, return start date
  if (startDate > today) return _fmt(startDate);

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // ── DAILY ──
  if (freq === 'DAILY') {
    if (interval === 1) {
      return _fmt(today);
    }
    // Walk from start by interval days, find the period containing today
    var cur = new Date(startDate);
    while (true) {
      var next = new Date(cur);
      next.setDate(next.getDate() + interval);
      if (next > today) return _fmt(cur);
      cur = next;
    }
  }

  // ── WEEKLY ──
  if (freq === 'WEEKLY') {
    var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

    if (byDayNums.length > 0) {
      // WEEKLY with byDay: find the most recent scheduled day ≤ today
      if (interval === 1) {
        // Simple case: check each day going backward from today
        var check = new Date(today);
        for (var i = 0; i < 7; i++) {
          if (byDayNums.indexOf(check.getDay()) !== -1 && check >= startDate) {
            return _fmt(check);
          }
          check.setDate(check.getDate() - 1);
        }
        // Fallback — shouldn't happen with valid byDay
        return _fmt(today);
      } else {
        // Multi-week interval with byDay: walk from start using _advanceRecurrence pattern
        var cur = new Date(startDate);
        var best = new Date(startDate);
        var maxIter = 5000;
        for (var i = 0; i < maxIter; i++) {
          if (cur > today) break;
          // Check if this day matches byDay
          if (byDayNums.indexOf(cur.getDay()) !== -1) {
            best = new Date(cur);
          }
          // Advance: step one day at a time, but when we wrap to the first byDay of a new week, skip (interval-1) weeks
          var prevDay = cur.getDay();
          cur.setDate(cur.getDate() + 1);
          if (cur.getDay() === byDayNums[0] && prevDay !== byDayNums[0]) {
            // We've wrapped to the start of a new cycle
            if (interval > 1) {
              cur.setDate(cur.getDate() + (interval - 1) * 7);
            }
          }
        }
        return _fmt(best);
      }
    } else {
      // WEEKLY without byDay: return start of current week
      var weekStartDay = 0; // default Sunday
      if (window._cwocSettings && window._cwocSettings.week_start_day !== undefined) {
        weekStartDay = parseInt(window._cwocSettings.week_start_day) || 0;
      }
      if (interval === 1) {
        var d = new Date(today);
        var diff = (d.getDay() - weekStartDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        // Ensure we don't go before start date
        if (d < startDate) return _fmt(startDate);
        return _fmt(d);
      } else {
        // Multi-week interval: walk from start by interval weeks
        var cur = new Date(startDate);
        // Align start to week start day
        var startDiff = (cur.getDay() - weekStartDay + 7) % 7;
        cur.setDate(cur.getDate() - startDiff);
        while (true) {
          var next = new Date(cur);
          next.setDate(next.getDate() + interval * 7);
          if (next > today) return _fmt(cur);
          cur = next;
        }
      }
    }
  }

  // ── MONTHLY ──
  if (freq === 'MONTHLY') {
    if (interval === 1) {
      return today.getFullYear() + '-' + _pad(today.getMonth() + 1) + '-01';
    }
    // Multi-month interval: walk from start month by interval
    var cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (true) {
      var next = new Date(cur);
      next.setMonth(next.getMonth() + interval);
      if (next > today) return _fmt(cur);
      cur = next;
    }
  }

  // ── YEARLY ──
  if (freq === 'YEARLY') {
    if (interval === 1) {
      return today.getFullYear() + '-01-01';
    }
    // Multi-year interval: walk from start year by interval
    var curYear = startDate.getFullYear();
    while (true) {
      var nextYear = curYear + interval;
      var nextDate = new Date(nextYear, 0, 1);
      if (nextDate > today) return curYear + '-01-01';
      curYear = nextYear;
    }
  }

  // ── Fallback for unknown freq: walk from start using generic interval ──
  return _fmt(today);
}

/**
 * Calculate the success rate for a habit chit over a given window.
 *
 * Uses habit_success/habit_goal from recurrence exceptions to determine
 * whether each period was met (habit_success >= habit_goal). Falls back
 * to the legacy completed field for old entries that lack these fields.
 *
 * Formula: round((periods where met) / (total non-broken-off periods in window) * 100)
 * Broken-off periods are excluded from both numerator and denominator.
 * Returns 0 when no periods exist.
 *
 * Respects the habits_success_window setting via the windowDays parameter.
 *
 * @param {object} chit - A chit object with recurrence_rule, recurrence_exceptions, start_datetime
 * @param {number|string} windowDays - Number of days to look back, or "all" for all time
 * @returns {number} Integer 0–100
 */
function getHabitSuccessRate(chit, windowDays) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return 0;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse start date — return 0 if missing
  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return 0;
  }

  // Determine the date range
  var rangeStart;
  if (windowDays === 'all') {
    rangeStart = new Date(startDate);
  } else {
    var days = parseInt(windowDays, 10) || 30;
    rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - days);
  }
  // Clamp rangeStart to not be before the chit start
  if (rangeStart < startDate) {
    rangeStart = new Date(startDate);
  }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];
  var until = rule.until ? new Date(rule.until) : null;

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

  // Build lookup maps from recurrence_exceptions
  var exceptions = chit.recurrence_exceptions || [];
  var exceptionMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exceptionMap[exceptions[i].date] = exceptions[i];
  }

  // Walk recurrence from start date, collecting occurrences within range
  var total = 0;
  var met = 0;
  var current = new Date(startDate);
  var maxIter = 10000; // safety limit

  for (var iter = 0; iter < maxIter; iter++) {
    // Stop if past today or past until date
    if (current > today) break;
    if (until && current > until) break;

    var dateStr = _fmt(current);

    // For WEEKLY with byDay, only count days that match
    var dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.indexOf(current.getDay()) !== -1;
    }

    if (dayMatches && current >= rangeStart) {
      var ex = exceptionMap[dateStr];

      // Skip broken-off periods from both numerator and denominator
      if (ex && ex.broken_off) {
        // excluded — do nothing
      } else {
        total++;
        if (ex) {
          // New-style entry: use habit_success/habit_goal fields
          if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
            if (ex.habit_success >= ex.habit_goal) {
              met++;
            }
          } else {
            // Legacy entry: fall back to completed field
            if (ex.completed) {
              met++;
            }
          }
        }
        // No exception for this date means it was missed (not met)
      }
    }

    // Advance to next occurrence
    if (freq === 'DAILY') {
      current.setDate(current.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byDayNums.length > 0) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() === byDayNums[0] && interval > 1) {
          current.setDate(current.getDate() + (interval - 1) * 7);
        }
      } else {
        current.setDate(current.getDate() + interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      current.setMonth(current.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      current.setFullYear(current.getFullYear() + interval);
    } else {
      break; // unknown frequency
    }
  }

  if (total === 0) return 0;
  return Math.round((met / total) * 100);
}

/**
 * Calculate the current streak for a habit chit.
 *
 * Returns the count of consecutive periods where habit_success >= habit_goal,
 * walking backward from the most recent past non-broken-off occurrence.
 * Uses habit_success/habit_goal from recurrence exceptions; falls back to
 * the legacy completed field for old entries without those fields.
 *
 * Broken-off (skipped) dates are treated as neutral — they are skipped
 * entirely and neither contribute to nor break the streak. The streak
 * stops at the first genuinely missed occurrence (not met, not broken off).
 *
 * Only counts periods from when habit tracking started (start_datetime).
 *
 * @param {object} chit - A chit object with recurrence_rule, recurrence_exceptions, start_datetime
 * @returns {number} Integer ≥ 0
 */
function getHabitStreak(chit) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return 0;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse start date — return 0 if missing
  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return 0;
  }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];
  var until = rule.until ? new Date(rule.until) : null;

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

  // Build lookup map from recurrence_exceptions (keyed by date)
  var exceptions = chit.recurrence_exceptions || [];
  var exceptionMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exceptionMap[exceptions[i].date] = exceptions[i];
  }

  // Walk recurrence from start date forward, collecting all occurrence dates
  // up to today (we need them in order to walk backward)
  var occurrences = [];
  var current = new Date(startDate);
  var maxIter = 10000; // safety limit

  for (var iter = 0; iter < maxIter; iter++) {
    // Stop if past today or past until date
    if (current > today) break;
    if (until && current > until) break;

    var dateStr = _fmt(current);

    // For WEEKLY with byDay, only count days that match
    var dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.indexOf(current.getDay()) !== -1;
    }

    if (dayMatches) {
      occurrences.push(dateStr);
    }

    // Advance to next occurrence
    if (freq === 'DAILY') {
      current.setDate(current.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byDayNums.length > 0) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() === byDayNums[0] && interval > 1) {
          current.setDate(current.getDate() + (interval - 1) * 7);
        }
      } else {
        current.setDate(current.getDate() + interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      current.setMonth(current.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      current.setFullYear(current.getFullYear() + interval);
    } else {
      break; // unknown frequency
    }
  }

  // Walk backward from the most recent occurrence, counting consecutive
  // periods where the goal was met. Broken-off periods are skipped (neutral).
  var streak = 0;
  for (var j = occurrences.length - 1; j >= 0; j--) {
    var dateKey = occurrences[j];
    var ex = exceptionMap[dateKey];

    // Skip broken-off periods — neutral, neither break nor count
    if (ex && ex.broken_off) {
      continue;
    }

    // Determine if this period was met
    var wasMet = false;
    if (ex) {
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        // New-style entry: use habit_success/habit_goal
        wasMet = ex.habit_success >= ex.habit_goal;
      } else {
        // Legacy entry: fall back to completed field
        wasMet = !!ex.completed;
      }
    }
    // No exception means missed (wasMet stays false)

    if (wasMet) {
      streak++;
    } else {
      // Genuinely missed — stop counting
      break;
    }
  }

  return streak;
}

// ── Period Rollover (Habits Overhaul) ────────────────────────────────────────

/**
 * Evaluate whether a habit chit needs period rollover.
 *
 * Lazy rollover: called on view load or editor load, not via background process.
 * If the current period has advanced past the last recorded period, this function:
 *   1. Snapshots the current habit_success/habit_goal into a recurrence exception
 *   2. Resets habit_success to 0
 *   3. Clears "Complete" status if set
 *
 * The chit object is modified in-place. Returns true if rollover occurred
 * (caller is responsible for persisting via PUT).
 *
 * @param {object} chit - A chit object with habit, recurrence_rule, recurrence_exceptions, etc.
 * @returns {boolean} Whether rollover occurred
 */
function _evaluateHabitRollover(chit) {
  if (!chit.habit) return false;
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return false;

  var currentPeriod = getCurrentPeriodDate(chit);
  if (!currentPeriod) return false;

  if (!Array.isArray(chit.recurrence_exceptions)) {
    chit.recurrence_exceptions = [];
  }

  var exceptions = chit.recurrence_exceptions;
  var previousPeriod = _getPreviousPeriodDate(chit, currentPeriod);

  // Find the most recent habit snapshot date
  var lastSnapshotDate = null;
  for (var i = 0; i < exceptions.length; i++) {
    if (exceptions[i].habit_success !== undefined) {
      if (!lastSnapshotDate || exceptions[i].date > lastSnapshotDate) {
        lastSnapshotDate = exceptions[i].date;
      }
    }
  }

  // RULE 1: If no previous snapshots exist, never roll over.
  // The current habit_success belongs to the current period.
  // Rollover only makes sense when we have history.
  if (!lastSnapshotDate) return false;

  // RULE 2: If the last snapshot is the previous period or later, no rollover needed.
  // The current habit_success belongs to the current period.
  if (lastSnapshotDate >= previousPeriod) return false;

  // RULE 3: The last snapshot is OLDER than the previous period.
  // This means the period has genuinely changed — snapshot current progress.
  var habitSuccess = chit.habit_success || 0;
  var habitGoal = chit.habit_goal || 1;
  var isComplete = chit.status === 'Complete';

  var snapshot = {
    date: previousPeriod,
    completed: habitSuccess >= habitGoal,
    habit_success: habitSuccess,
    habit_goal: habitGoal
  };

  // Check if previous period already has an exception
  var existingIdx = -1;
  for (var j = 0; j < exceptions.length; j++) {
    if (exceptions[j].date === previousPeriod) {
      existingIdx = j;
      break;
    }
  }

  if (existingIdx >= 0) {
    if (exceptions[existingIdx].habit_success !== undefined) return false;
    exceptions[existingIdx].habit_success = habitSuccess;
    exceptions[existingIdx].habit_goal = habitGoal;
    exceptions[existingIdx].completed = habitSuccess >= habitGoal;
  } else {
    exceptions.push(snapshot);
  }

  chit.habit_success = 0;
  if (isComplete) chit.status = '';

  console.log('[Rollover] ' + (chit.title || chit.id) + ': snapshotted ' + habitSuccess + '/' + habitGoal + ' into ' + previousPeriod + ', reset to 0');
  return true;
}

/**
 * Get the previous period date before a given period date for a chit.
 * Used by _evaluateHabitRollover to determine which period just ended.
 *
 * @param {object} chit - A chit with recurrence_rule and start_datetime
 * @param {string} currentPeriod - YYYY-MM-DD of the current period
 * @returns {string|null} YYYY-MM-DD of the previous period, or null
 */
function _getPreviousPeriodDate(chit, currentPeriod) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return null;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var currentDate = new Date(currentPeriod + 'T00:00:00');

  if (freq === 'DAILY') {
    var prev = new Date(currentDate);
    prev.setDate(prev.getDate() - interval);
    return _fmt(prev);
  }

  if (freq === 'WEEKLY') {
    var prev = new Date(currentDate);
    prev.setDate(prev.getDate() - (interval * 7));
    return _fmt(prev);
  }

  if (freq === 'MONTHLY') {
    var prev = new Date(currentDate);
    prev.setMonth(prev.getMonth() - interval);
    return _fmt(prev);
  }

  if (freq === 'YEARLY') {
    var prev = new Date(currentDate);
    prev.setFullYear(prev.getFullYear() - interval);
    return _fmt(prev);
  }

  return null;
}

/**
 * Persist a habit chit after rollover via PUT /api/chits/{id}.
 * Called in the background — does not block rendering.
 *
 * @param {object} chit - The chit object that was modified by _evaluateHabitRollover
 */
async function _persistHabitRollover(chit) {
  if (!chit || !chit.id) return;
  try {
    var resp = await fetch('/api/chits/' + chit.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit)
    });
    if (!resp.ok) {
      console.error('[_persistHabitRollover] Failed to save rollover for chit ' + chit.id + ':', resp.status);
    }
  } catch (err) {
    console.error('[_persistHabitRollover] Error saving rollover for chit ' + chit.id + ':', err);
  }
}

/**
 * Build a habit counter widget: [−] progress [+]
 * Shared between the Habits View and the Chit Editor.
 *
 * @param {object} opts
 *   - success: current habit_success value
 *   - goal: habit_goal value
 *   - freqLabel: optional frequency label (e.g., " each Week")
 *   - disabled: whether buttons should be disabled (reset active)
 *   - onIncrement: function(newSuccess) called when + is clicked
 *   - onDecrement: function(newSuccess) called when − is clicked
 * @returns {HTMLElement} container with − button, progress text, + button
 */
function _buildHabitCounter(opts) {
  var success = opts.success || 0;
  var goal = opts.goal || 1;
  var freqLabel = opts.freqLabel || '';
  var disabled = opts.disabled || false;

  var wrap = document.createElement('span');
  wrap.className = 'habit-counter-widget';

  // − button (left)
  var minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'habit-counter-btn';
  minusBtn.textContent = '−';
  minusBtn.title = 'Decrement';
  minusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var cur = parseInt(wrap.dataset.success) || 0;
    if (cur <= 0) return;
    var newVal = cur - 1;
    wrap.dataset.success = newVal;
    _updateCounterDisplay(wrap, newVal, parseInt(wrap.dataset.goal) || 1, freqLabel);
    if (opts.onDecrement) opts.onDecrement(newVal);
  });
  wrap.appendChild(minusBtn);

  // Progress text
  var progressSpan = document.createElement('span');
  progressSpan.className = 'habit-progress';
  progressSpan.textContent = success + ' / ' + goal + freqLabel;
  progressSpan.title = 'Progress: ' + success + ' of ' + goal + ' this period';
  wrap.appendChild(progressSpan);

  // + button (right)
  var plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'habit-counter-btn';
  plusBtn.textContent = '+';
  plusBtn.title = disabled ? 'Reset period active — wait for cooldown' : 'Increment';
  if (disabled) {
    plusBtn.disabled = true;
    plusBtn.style.opacity = '0.4';
    plusBtn.style.cursor = 'not-allowed';
  }
  plusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var cur = parseInt(wrap.dataset.success) || 0;
    var g = parseInt(wrap.dataset.goal) || 1;
    if (cur >= g) return;
    var newVal = cur + 1;
    wrap.dataset.success = newVal;
    _updateCounterDisplay(wrap, newVal, g, freqLabel);
    if (opts.onIncrement) opts.onIncrement(newVal);
  });
  wrap.appendChild(plusBtn);

  // Store state on the element for updates
  wrap.dataset.success = success;
  wrap.dataset.goal = goal;

  return wrap;
}

/** Update the progress text inside a habit counter widget */
function _updateCounterDisplay(wrap, success, goal, freqLabel) {
  var span = wrap.querySelector('.habit-progress');
  if (span) {
    span.textContent = success + ' / ' + goal + (freqLabel || '');
    span.title = 'Progress: ' + success + ' of ' + goal + ' this period';
  }
}
