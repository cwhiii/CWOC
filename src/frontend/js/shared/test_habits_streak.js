/**
 * Property test for getHabitStreak
 *
 * Feature: habits-overhaul, Property 13: Streak calculation
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 *
 * Runs 120 iterations with randomly generated recurring chits and exception patterns.
 * Tests both new-style (habit_success/habit_goal) and legacy (completed) entries.
 * Verifies:
 *   - Streak count matches manual backward walk from most recent past occurrence
 *   - New-style entries use habit_success >= habit_goal for "met" determination
 *   - Legacy entries fall back to completed field
 *   - Broken-off dates are skipped (neutral — neither contribute to nor break the streak)
 *   - Stops at first genuinely missed occurrence (not met, not broken off)
 *   - Returns 0 when no met occurrences exist
 *
 * Usage: node src/frontend/js/shared/test_habits_streak.js
 */

// ── Runtime compatibility (Node vs JSC) ──────────────────────────────────────
var _log = (typeof console !== 'undefined' && console.log) ? function(msg) { console.log(msg); } : print;
var _exit = (typeof process !== 'undefined' && process.exit) ? function(code) { process.exit(code); } : function(code) { quit(code); };

// ── Mock window._cwocSettings ────────────────────────────────────────────────
var window = { _cwocSettings: { week_start_day: '0' } };

// ── Copy of getHabitStreak from shared.js ────────────────────────────────────
function getHabitStreak(chit) {
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

  var occurrences = [];
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

    if (dayMatches) {
      occurrences.push(dateStr);
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

  var streak = 0;
  for (var j = occurrences.length - 1; j >= 0; j--) {
    var dateKey = occurrences[j];
    var ex = exceptionMap[dateKey];

    if (ex && ex.broken_off) {
      continue;
    }

    var wasMet = false;
    if (ex) {
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        wasMet = ex.habit_success >= ex.habit_goal;
      } else {
        wasMet = !!ex.completed;
      }
    }

    if (wasMet) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
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

// ── Constants ────────────────────────────────────────────────────────────────
var ALL_FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
var ALL_DAYS  = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
var DAY_MAP   = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ── Oracle: collect all occurrence dates ─────────────────────────────────────
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

// ── Generate a random recurring chit ─────────────────────────────────────────
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

  return {
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
}

// ── Attach random exceptions — mix of new-style and legacy ───────────────────
function attachRandomExceptions(chit) {
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

// ── Oracle: manually compute streak ──────────────────────────────────────────
function oracleStreak(chit) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return 0;
  if (!chit.start_datetime) return 0;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var startDate = parseYMD(chit.start_datetime.split('T')[0]);

  var allDates = collectOccurrences(chit, startDate, today);

  // Build exception lookup by date
  var exceptions = chit.recurrence_exceptions || [];
  var exMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exMap[exceptions[i].date] = exceptions[i];
  }

  // Walk backward from the most recent occurrence
  var streak = 0;
  for (var k = allDates.length - 1; k >= 0; k--) {
    var d = allDates[k];
    var ex = exMap[d];

    // Skip broken-off (neutral)
    if (ex && ex.broken_off) continue;

    // Determine if met
    var wasMet = false;
    if (ex) {
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        wasMet = ex.habit_success >= ex.habit_goal;
      } else {
        wasMet = !!ex.completed;
      }
    }

    if (wasMet) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ── Test runner ──────────────────────────────────────────────────────────────
var ITERATIONS = 120;
var passed = 0;
var failed = 0;
var failures = [];

for (var iter = 0; iter < ITERATIONS; iter++) {
  var chit = generateRandomChit();
  attachRandomExceptions(chit);

  var result = getHabitStreak(chit);
  var expected = oracleStreak(chit);
  var errMsgs = [];

  // ── Assert 1: result is a non-negative integer ──
  if (typeof result !== 'number' || result !== Math.floor(result) || result < 0) {
    errMsgs.push('Result is not a non-negative integer: ' + result);
  }

  // ── Assert 2: result matches oracle computation ──
  if (result !== expected) {
    errMsgs.push('Streak mismatch: got ' + result + ', expected ' + expected);
  }

  // ── Assert 3: streak ≤ total non-broken-off occurrences ──
  var exceptions = chit.recurrence_exceptions || [];
  var brokenOffSet = {};
  for (var e = 0; e < exceptions.length; e++) {
    if (exceptions[e].broken_off) brokenOffSet[exceptions[e].date] = true;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var startDate = parseYMD(chit.start_datetime.split('T')[0]);
  var allDates = collectOccurrences(chit, startDate, today);
  var nonBrokenCount = 0;
  for (var d = 0; d < allDates.length; d++) {
    if (!brokenOffSet[allDates[d]]) nonBrokenCount++;
  }
  if (result > nonBrokenCount) {
    errMsgs.push('Streak (' + result + ') exceeds total non-broken-off occurrences (' + nonBrokenCount + ')');
  }

  // ── Tally ──
  if (errMsgs.length === 0) {
    passed++;
  } else {
    failed++;
    if (failures.length < 10) {
      failures.push({
        iteration: iter + 1,
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
var noRuleResult = getHabitStreak(noRuleChit);
if (noRuleResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-no-rule', result: noRuleResult, expected: 0, errors: ['No recurrence rule should return 0'] });
} else {
  passed++;
}

// ── Edge case: chit with no start_datetime returns 0 ──
var noStartChit = { title: 'No Start', recurrence_rule: { freq: 'DAILY', interval: 1 }, recurrence_exceptions: [] };
var noStartResult = getHabitStreak(noStartChit);
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
var futureResult = getHabitStreak(futureChit);
if (futureResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-future', result: futureResult, expected: 0, errors: ['Future start date should return 0'] });
} else {
  passed++;
}

// ── Edge case: all occurrences broken off returns 0 ──
var allBrokenChit = {
  title: 'All Broken',
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var tenDaysAgo = new Date();
tenDaysAgo.setHours(0, 0, 0, 0);
tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
allBrokenChit.start_datetime = _fmtDate(tenDaysAgo) + 'T00:00:00';
var allBrokenDates = collectOccurrences(allBrokenChit, tenDaysAgo, new Date());
allBrokenChit.recurrence_exceptions = allBrokenDates.map(function(d) {
  return { date: d, completed: false, broken_off: true };
});
var allBrokenResult = getHabitStreak(allBrokenChit);
if (allBrokenResult !== 0) {
  failed++;
  failures.push({ iteration: 'edge-all-broken', result: allBrokenResult, expected: 0, errors: ['All broken-off should return 0'] });
} else {
  passed++;
}

// ── Edge case: all occurrences met (new-style) gives streak = total non-broken ──
var allMetChit = {
  title: 'All Met',
  habit: true,
  habit_goal: 3,
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var fiveDaysAgo = new Date();
fiveDaysAgo.setHours(0, 0, 0, 0);
fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
allMetChit.start_datetime = _fmtDate(fiveDaysAgo) + 'T00:00:00';
var allMetDates = collectOccurrences(allMetChit, fiveDaysAgo, new Date());
allMetChit.recurrence_exceptions = allMetDates.map(function(d) {
  return { date: d, completed: true, habit_success: 3, habit_goal: 3, broken_off: false };
});
var allMetResult = getHabitStreak(allMetChit);
var allMetExpected = allMetDates.length;
if (allMetResult !== allMetExpected) {
  failed++;
  failures.push({ iteration: 'edge-all-met', result: allMetResult, expected: allMetExpected, errors: ['All met should give streak = ' + allMetExpected] });
} else {
  passed++;
}

// ── Edge case: broken-off in the middle does not break streak ──
var brokenMiddleChit = {
  title: 'Broken Middle',
  habit: true,
  habit_goal: 2,
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var sevenDaysAgo = new Date();
sevenDaysAgo.setHours(0, 0, 0, 0);
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
brokenMiddleChit.start_datetime = _fmtDate(sevenDaysAgo) + 'T00:00:00';
var brokenMiddleDates = collectOccurrences(brokenMiddleChit, sevenDaysAgo, new Date());
var bmExceptions = [];
for (var bm = 0; bm < brokenMiddleDates.length; bm++) {
  if (bm === 2) {
    bmExceptions.push({ date: brokenMiddleDates[bm], completed: false, broken_off: true });
  } else {
    bmExceptions.push({ date: brokenMiddleDates[bm], completed: true, habit_success: 2, habit_goal: 2, broken_off: false });
  }
}
brokenMiddleChit.recurrence_exceptions = bmExceptions;
var brokenMiddleExpected = brokenMiddleDates.length - 1;
var brokenMiddleResult = getHabitStreak(brokenMiddleChit);
if (brokenMiddleResult !== brokenMiddleExpected) {
  failed++;
  failures.push({ iteration: 'edge-broken-middle', result: brokenMiddleResult, expected: brokenMiddleExpected, errors: ['Broken-off in middle should not break streak, expected ' + brokenMiddleExpected] });
} else {
  passed++;
}

// ── Edge case: missed occurrence stops the streak ──
var missedStopChit = {
  title: 'Missed Stop',
  habit: true,
  habit_goal: 1,
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var sixDaysAgo = new Date();
sixDaysAgo.setHours(0, 0, 0, 0);
sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
missedStopChit.start_datetime = _fmtDate(sixDaysAgo) + 'T00:00:00';
var missedStopDates = collectOccurrences(missedStopChit, sixDaysAgo, new Date());
var msExceptions = [];
for (var ms = 0; ms < missedStopDates.length; ms++) {
  if (ms === 2) {
    // genuinely missed — no exception entry at all
  } else {
    msExceptions.push({ date: missedStopDates[ms], completed: true, habit_success: 1, habit_goal: 1, broken_off: false });
  }
}
missedStopChit.recurrence_exceptions = msExceptions;
var missedStopExpected = missedStopDates.length - 3;
var missedStopResult = getHabitStreak(missedStopChit);
if (missedStopResult !== missedStopExpected) {
  failed++;
  failures.push({ iteration: 'edge-missed-stop', result: missedStopResult, expected: missedStopExpected, errors: ['Missed occurrence should stop streak, expected ' + missedStopExpected] });
} else {
  passed++;
}

// ── Edge case: legacy entries (completed=true, no habit_success) count as met ──
var legacyStreakChit = {
  title: 'Legacy Streak',
  habit: true,
  habit_goal: 1,
  start_datetime: '',
  recurrence_rule: { freq: 'DAILY', interval: 1, byDay: [] },
  recurrence_exceptions: []
};
var fourDaysAgo = new Date();
fourDaysAgo.setHours(0, 0, 0, 0);
fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
legacyStreakChit.start_datetime = _fmtDate(fourDaysAgo) + 'T00:00:00';
var legacyDates = collectOccurrences(legacyStreakChit, fourDaysAgo, new Date());
legacyStreakChit.recurrence_exceptions = legacyDates.map(function(d) {
  return { date: d, completed: true, broken_off: false };
});
var legacyStreakResult = getHabitStreak(legacyStreakChit);
var legacyStreakExpected = legacyDates.length;
if (legacyStreakResult !== legacyStreakExpected) {
  failed++;
  failures.push({ iteration: 'edge-legacy-streak', result: legacyStreakResult, expected: legacyStreakExpected, errors: ['Legacy completed=true should count as met, expected streak ' + legacyStreakExpected] });
} else {
  passed++;
}

var TOTAL_TESTS = ITERATIONS + 9;

// ── Summary ──────────────────────────────────────────────────────────────────
_log('');
_log('=== Property Test: getHabitStreak ===');
_log('Feature: habits-overhaul, Property 13: Streak calculation');
_log('Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5');
_log('');
_log('Iterations: ' + TOTAL_TESTS + ' (' + ITERATIONS + ' random + 9 edge cases)');
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
    if (fail.exceptionsCount !== undefined) _log('    Exceptions: ' + fail.exceptionsCount);
    _log('    Result:     ' + fail.result);
    _log('    Expected:   ' + fail.expected);
    for (var fe = 0; fe < fail.errors.length; fe++) {
      _log('    ERROR:      ' + fail.errors[fe]);
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
