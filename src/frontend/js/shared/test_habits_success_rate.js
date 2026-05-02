/**
 * Property test for getHabitSuccessRate
 *
 * Feature: habits-overhaul, Property 12: Success rate calculation
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**
 *
 * Runs 150 iterations with randomly generated recurring chits and exception arrays.
 * Tests both new-style (habit_success/habit_goal) and legacy (completed) entries.
 * Verifies:
 *   - Calculated rate matches manual computation excluding broken-off dates
 *   - New-style entries use habit_success >= habit_goal for "met" determination
 *   - Legacy entries fall back to completed field
 *   - Result is an integer in the range 0–100
 *   - Returns 0 when no occurrences exist
 *
 * Usage: node src/frontend/js/shared/test_habits_success_rate.js
 */

// ── Runtime compatibility (Node vs JSC) ──────────────────────────────────────
var _log = (typeof console !== 'undefined' && console.log) ? function(msg) { console.log(msg); } : print;
var _exit = (typeof process !== 'undefined' && process.exit) ? function(code) { process.exit(code); } : function(code) { quit(code); };

// ── Mock window._cwocSettings ────────────────────────────────────────────────
var window = { _cwocSettings: { week_start_day: '0' } };

// ── Copy of getHabitSuccessRate from shared.js ───────────────────────────────
function getHabitSuccessRate(chit, windowDays) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return 0;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return 0;
  }

  var rangeStart;
  if (windowDays === 'all') {
    rangeStart = new Date(startDate);
  } else {
    var days = parseInt(windowDays, 10) || 30;
    rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - days);
  }
  if (rangeStart < startDate) {
    rangeStart = new Date(startDate);
  }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];
  var until = rule.until ? new Date(rule.until) : null;

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

  var exceptions = chit.recurrence_exceptions || [];
  var exceptionMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exceptionMap[exceptions[i].date] = exceptions[i];
  }

  var total = 0;
  var met = 0;
  var current = new Date(startDate);
  var maxIter = 10000;

  for (var iter = 0; iter < maxIter; iter++) {
    if (current > today) break;
    if (until && current > until) break;

    var dateStr = _fmt(current);

    var dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.indexOf(current.getDay()) !== -1;
    }

    if (dayMatches && current >= rangeStart) {
      var ex = exceptionMap[dateStr];

      if (ex && ex.broken_off) {
        // excluded
      } else {
        total++;
        if (ex) {
          if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
            if (ex.habit_success >= ex.habit_goal) {
              met++;
            }
          } else {
            if (ex.completed) {
              met++;
            }
          }
        }
      }
    }

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
      break;
    }
  }

  if (total === 0) return 0;
  return Math.round((met / total) * 100);
}

// ── Helper: date formatting ──────────────────────────────────────────────────
function _pad(n) { return n < 10 ? '0' + n : '' + n; }
function _fmtDate(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

// ── Random helpers ───────────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randSubset(arr, minLen, maxLen) {
  var count = randInt(minLen, maxLen);
  var shuffled = arr.slice().sort(function() { return Math.random() - 0.5; });
  return shuffled.slice(0, count);
}

function randomPastDate(maxDaysBack) {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - randInt(1, maxDaysBack));
  return d;
}

// ── Parse YYYY-MM-DD to Date ─────────────────────────────────────────────────
function parseYMD(str) {
  var parts = str.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Generate occurrence dates (oracle) ───────────────────────────────────────
var ALL_FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
var ALL_DAYS  = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
var DAY_MAP   = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function collectOccurrences(chit, rangeStart, rangeEnd) {
  var rule = chit.recurrence_rule;
  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];
  var byDayNums = byDay.map(function(d) { return DAY_MAP[d]; }).filter(function(n) { return n !== undefined; });

  var startDate = parseYMD(chit.start_datetime.split('T')[0]);
  var dates = [];
  var cur = new Date(startDate);
  var maxIter = 10000;

  for (var i = 0; i < maxIter; i++) {
    if (cur > rangeEnd) break;

    var dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.indexOf(cur.getDay()) !== -1;
    }

    if (dayMatches && cur >= rangeStart) {
      dates.push(_fmtDate(cur));
    }

    if (freq === 'DAILY') {
      cur.setDate(cur.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byDayNums.length > 0) {
        cur.setDate(cur.getDate() + 1);
        if (cur.getDay() === byDayNums[0] && interval > 1) {
          cur.setDate(cur.getDate() + (interval - 1) * 7);
        }
      } else {
        cur.setDate(cur.getDate() + interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      cur.setMonth(cur.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      cur.setFullYear(cur.getFullYear() + interval);
    } else {
      break;
    }
  }
  return dates;
}

// ── Generate a random recurring chit with exceptions ─────────────────────────
function generateRandomChit() {
  var freq = randChoice(ALL_FREQS);
  var interval = 1;
  var byDay = [];

  if (Math.random() < 0.4) {
    interval = randInt(2, 4);
  }

  if (freq === 'WEEKLY' && Math.random() < 0.5) {
    byDay = randSubset(ALL_DAYS, 1, 3);
  }

  var startDate = randomPastDate(120);

  var chit = {
    title: 'Test Habit',
    habit: true,
    habit_goal: randInt(1, 5),
    start_datetime: _fmtDate(startDate) + 'T00:00:00',
    recurrence_rule: {
      freq: freq,
      interval: interval,
      byDay: byDay
    },
    recurrence_exceptions: []
  };

  return chit;
}

// Attach random exceptions — mix of new-style (habit_success/habit_goal) and legacy (completed)
function attachRandomExceptions(chit, windowDays) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var startDate = parseYMD(chit.start_datetime.split('T')[0]);

  var allDates = collectOccurrences(chit, startDate, today);
  var goal = chit.habit_goal || 1;

  var exceptions = [];
  for (var i = 0; i < allDates.length; i++) {
    var roll = Math.random();
    if (roll < 0.25) {
      // New-style: met goal
      var successVal = randInt(goal, goal + 2);
      exceptions.push({ date: allDates[i], completed: true, habit_success: successVal, habit_goal: goal, broken_off: false });
    } else if (roll < 0.40) {
      // New-style: missed goal
      var missVal = randInt(0, Math.max(0, goal - 1));
      exceptions.push({ date: allDates[i], completed: false, habit_success: missVal, habit_goal: goal, broken_off: false });
    } else if (roll < 0.50) {
      // Legacy: completed=true (no habit_success/habit_goal)
      exceptions.push({ date: allDates[i], completed: true, broken_off: false });
    } else if (roll < 0.60) {
      // Legacy: completed=false (missed)
      exceptions.push({ date: allDates[i], completed: false, broken_off: false });
    } else if (roll < 0.75) {
      // Broken off
      exceptions.push({ date: allDates[i], completed: false, broken_off: true });
    }
    // else: no exception (missed)
  }

  chit.recurrence_exceptions = exceptions;
  return chit;
}

// ── Oracle: manually compute success rate ────────────────────────────────────
function oracleSuccessRate(chit, windowDays) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var startDate = parseYMD(chit.start_datetime.split('T')[0]);

  var rangeStart;
  if (windowDays === 'all') {
    rangeStart = new Date(startDate);
  } else {
    var days = parseInt(windowDays, 10) || 30;
    rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - days);
  }
  if (rangeStart < startDate) {
    rangeStart = new Date(startDate);
  }

  var occurrences = collectOccurrences(chit, rangeStart, today);

  // Build exception lookup by date
  var exceptions = chit.recurrence_exceptions || [];
  var exMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exMap[exceptions[i].date] = exceptions[i];
  }

  var total = 0;
  var met = 0;
  for (var j = 0; j < occurrences.length; j++) {
    var d = occurrences[j];
    var ex = exMap[d];

    // Skip broken-off from both counts
    if (ex && ex.broken_off) continue;

    total++;
    if (ex) {
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        // New-style: use habit_success >= habit_goal
        if (ex.habit_success >= ex.habit_goal) met++;
      } else {
        // Legacy: use completed field
        if (ex.completed) met++;
      }
    }
    // No exception = missed
  }

  if (total === 0) return 0;
  return Math.round((met / total) * 100);
}

// ── Test runner ──────────────────────────────────────────────────────────────
var ITERATIONS = 150;
var passed = 0;
var failed = 0;
var failures = [];

var WINDOW_OPTIONS = [7, 30, 90, 'all'];

for (var iter = 0; iter < ITERATIONS; iter++) {
  var windowDays = randChoice(WINDOW_OPTIONS);
  var chit = generateRandomChit();
  attachRandomExceptions(chit, windowDays);

  var result = getHabitSuccessRate(chit, windowDays);
  var expected = oracleSuccessRate(chit, windowDays);
  var errMsgs = [];

  // ── Assert 1: result is an integer ──
  if (typeof result !== 'number' || result !== Math.floor(result)) {
    errMsgs.push('Result is not an integer: ' + result);
  }

  // ── Assert 2: result is in range 0–100 ──
  if (result < 0 || result > 100) {
    errMsgs.push('Result out of range 0-100: ' + result);
  }

  // ── Assert 3: result matches oracle computation ──
  if (result !== expected) {
    errMsgs.push('Rate mismatch: got ' + result + ', expected ' + expected);
  }

  // ── Tally ──
  if (errMsgs.length === 0) {
    passed++;
  } else {
    failed++;
    if (failures.length < 10) {
      failures.push({
        iteration: iter + 1,
        window: windowDays,
        chit: JSON.stringify(chit.recurrence_rule) + ' start=' + chit.start_datetime,
        exceptionsCount: chit.recurrence_exceptions.length,
        result: result,
        expected: expected,
        errors: errMsgs
      });
    }
  }
}

// ── Edge case: chit with no recurrence rule returns 0 ──
var noRuleChit = { title: 'No Rule', start_datetime: '2025-01-01T00:00:00', recurrence_rule: null, recurrence_exceptions: [] };
var noRuleResult = getHabitSuccessRate(noRuleChit, 30);
if (noRuleResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-no-rule', result: noRuleResult, expected: 0, errors: ['No recurrence rule should return 0'] });
} else {
  passed++;
}

// ── Edge case: chit with no start_datetime returns 0 ──
var noStartChit = { title: 'No Start', recurrence_rule: { freq: 'DAILY', interval: 1 }, recurrence_exceptions: [] };
var noStartResult = getHabitSuccessRate(noStartChit, 30);
if (noStartResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-no-start', result: noStartResult, expected: 0, errors: ['No start_datetime should return 0'] });
} else {
  passed++;
}

// ── Edge case: chit with future start date returns 0 ──
var futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);
var futureChit = {
  title: 'Future',
  start_datetime: _fmtDate(futureDate) + 'T00:00:00',
  recurrence_rule: { freq: 'DAILY', interval: 1 },
  recurrence_exceptions: []
};
var futureResult = getHabitSuccessRate(futureChit, 30);
if (futureResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-future', result: futureResult, expected: 0, errors: ['Future start date should return 0'] });
} else {
  passed++;
}

// ── Edge case: all occurrences broken off returns 0 ──
var allBrokenChit = generateRandomChit();
var tenDaysAgo = new Date();
tenDaysAgo.setHours(0, 0, 0, 0);
tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
allBrokenChit.start_datetime = _fmtDate(tenDaysAgo) + 'T00:00:00';
allBrokenChit.recurrence_rule = { freq: 'DAILY', interval: 1, byDay: [] };
var allBrokenDates = collectOccurrences(allBrokenChit, tenDaysAgo, new Date());
allBrokenChit.recurrence_exceptions = allBrokenDates.map(function(d) {
  return { date: d, completed: false, broken_off: true };
});
var allBrokenResult = getHabitSuccessRate(allBrokenChit, 'all');
if (allBrokenResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-all-broken', result: allBrokenResult, expected: 0, errors: ['All broken-off should return 0'] });
} else {
  passed++;
}

// ── Edge case: new-style entries with habit_success < habit_goal are not met ──
var partialChit = {
  title: 'Partial',
  habit: true,
  habit_goal: 3,
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var threeDaysAgo = new Date();
threeDaysAgo.setHours(0, 0, 0, 0);
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
partialChit.start_datetime = _fmtDate(threeDaysAgo) + 'T00:00:00';
var partialDates = collectOccurrences(partialChit, threeDaysAgo, new Date());
partialChit.recurrence_exceptions = partialDates.map(function(d) {
  return { date: d, completed: false, habit_success: 2, habit_goal: 3, broken_off: false };
});
var partialResult = getHabitSuccessRate(partialChit, 'all');
if (partialResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-partial', result: partialResult, expected: 0, errors: ['habit_success < habit_goal should not count as met'] });
} else {
  passed++;
}

// ── Edge case: legacy entries with completed=true count as met ──
var legacyChit = {
  title: 'Legacy',
  habit: true,
  habit_goal: 1,
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var fourDaysAgo = new Date();
fourDaysAgo.setHours(0, 0, 0, 0);
fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
legacyChit.start_datetime = _fmtDate(fourDaysAgo) + 'T00:00:00';
var legacyDates = collectOccurrences(legacyChit, fourDaysAgo, new Date());
legacyChit.recurrence_exceptions = legacyDates.map(function(d) {
  return { date: d, completed: true, broken_off: false };
});
var legacyResult = getHabitSuccessRate(legacyChit, 'all');
if (legacyResult !== 100) {
  failed++;
  failures.push({ iteration: 'edge-legacy', result: legacyResult, expected: 100, errors: ['Legacy completed=true should count as met, expected 100%'] });
} else {
  passed++;
}

var TOTAL_TESTS = ITERATIONS + 6;

// ── Summary ──────────────────────────────────────────────────────────────────
_log('');
_log('=== Property Test: getHabitSuccessRate ===');
_log('Feature: habits-overhaul, Property 12: Success rate calculation');
_log('Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7');
_log('');
_log('Iterations: ' + TOTAL_TESTS + ' (' + ITERATIONS + ' random + 6 edge cases)');
_log('Passed:     ' + passed);
_log('Failed:     ' + failed);
_log('');

if (failures.length > 0) {
  _log('── First ' + failures.length + ' failure(s): ──');
  for (var f = 0; f < failures.length; f++) {
    var fail = failures[f];
    _log('');
    _log('  Iteration ' + fail.iteration + ':');
    if (fail.chit) _log('    Chit:       ' + fail.chit);
    if (fail.window !== undefined) _log('    Window:     ' + fail.window);
    if (fail.exceptionsCount !== undefined) _log('    Exceptions: ' + fail.exceptionsCount);
    _log('    Result:     ' + fail.result);
    _log('    Expected:   ' + fail.expected);
    for (var e = 0; e < fail.errors.length; e++) {
      _log('    ERROR:      ' + fail.errors[e]);
    }
  }
  _log('');
}

if (failed === 0) {
  _log('RESULT: ALL PASSED');
} else {
  _log('RESULT: FAILED (' + failed + '/' + TOTAL_TESTS + ' iterations failed)');
}

_exit(failed > 0 ? 1 : 0);
