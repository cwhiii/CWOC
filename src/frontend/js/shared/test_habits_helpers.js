/**
 * Property test for getCurrentPeriodDate
 *
 * Feature: habits-view, Property 3: getCurrentPeriodDate returns a valid current-period date
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 *
 * Runs 100+ iterations with randomly generated recurring chits.
 * Verifies format, date bounds, and frequency-specific rules.
 *
 * Usage: node src/frontend/js/shared/test_habits_helpers.js
 *   -or- /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc src/frontend/js/shared/test_habits_helpers.js
 */

// ── Runtime compatibility (Node vs JSC) ──────────────────────────────────────
var _log = (typeof console !== 'undefined' && console.log) ? function(msg) { console.log(msg); } : print;
var _exit = (typeof process !== 'undefined' && process.exit) ? function(code) { process.exit(code); } : function(code) { quit(code); };

// ── Mock window._cwocSettings ────────────────────────────────────────────────
var window = { _cwocSettings: { week_start_day: '0' } };

// ── Copy of getCurrentPeriodDate from shared.js ──────────────────────────────
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
      if (interval === 1) {
        var check = new Date(today);
        for (var i = 0; i < 7; i++) {
          if (byDayNums.indexOf(check.getDay()) !== -1 && check >= startDate) {
            return _fmt(check);
          }
          check.setDate(check.getDate() - 1);
        }
        return _fmt(today);
      } else {
        var cur = new Date(startDate);
        var best = new Date(startDate);
        var maxIter = 5000;
        for (var i = 0; i < maxIter; i++) {
          if (cur > today) break;
          if (byDayNums.indexOf(cur.getDay()) !== -1) {
            best = new Date(cur);
          }
          var prevDay = cur.getDay();
          cur.setDate(cur.getDate() + 1);
          if (cur.getDay() === byDayNums[0] && prevDay !== byDayNums[0]) {
            if (interval > 1) {
              cur.setDate(cur.getDate() + (interval - 1) * 7);
            }
          }
        }
        return _fmt(best);
      }
    } else {
      var weekStartDay = 0;
      if (window._cwocSettings && window._cwocSettings.week_start_day !== undefined) {
        weekStartDay = parseInt(window._cwocSettings.week_start_day) || 0;
      }
      if (interval === 1) {
        var d = new Date(today);
        var diff = (d.getDay() - weekStartDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        if (d < startDate) return _fmt(startDate);
        return _fmt(d);
      } else {
        var cur = new Date(startDate);
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
    var curYear = startDate.getFullYear();
    while (true) {
      var nextYear = curYear + interval;
      var nextDate = new Date(nextYear, 0, 1);
      if (nextDate > today) return curYear + '-01-01';
      curYear = nextYear;
    }
  }

  return _fmt(today);
}

// ── Helper: pad for date formatting ──────────────────────────────────────────
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

// ── Generate a random recurring chit ─────────────────────────────────────────
var ALL_FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
var ALL_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function generateRandomChit() {
  var freq = randChoice(ALL_FREQS);
  var interval = 1;
  var byDay = [];

  // Vary intervals: mostly 1, sometimes 2-4
  if (Math.random() < 0.4) {
    interval = randInt(2, 4);
  }

  // For WEEKLY, sometimes add byDay
  if (freq === 'WEEKLY' && Math.random() < 0.6) {
    byDay = randSubset(ALL_DAYS, 1, 4);
  }

  // Start date: 1 to 365 days in the past
  var startDate = randomPastDate(365);

  return {
    title: 'Test Habit',
    start_datetime: _fmtDate(startDate) + 'T00:00:00',
    recurrence_rule: {
      freq: freq,
      interval: interval,
      byDay: byDay
    }
  };
}

// ── Parse YYYY-MM-DD to Date ─────────────────────────────────────────────────
function parseYMD(str) {
  var parts = str.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Test runner ──────────────────────────────────────────────────────────────
var ITERATIONS = 150;
var passed = 0;
var failed = 0;
var failures = [];

var today = new Date();
today.setHours(0, 0, 0, 0);
var todayStr = _fmtDate(today);

var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

for (var iter = 0; iter < ITERATIONS; iter++) {
  var chit = generateRandomChit();
  var result = getCurrentPeriodDate(chit);
  var freq = chit.recurrence_rule.freq;
  var interval = chit.recurrence_rule.interval || 1;
  var byDay = chit.recurrence_rule.byDay || [];
  var errMsgs = [];

  // ── Assert 1: YYYY-MM-DD format ──
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    errMsgs.push('Format mismatch: got "' + result + '"');
  }

  // ── Assert 2: result ≤ today ──
  var resultDate = parseYMD(result);
  if (resultDate > today) {
    errMsgs.push('Result ' + result + ' is in the future (today=' + todayStr + ')');
  }

  // ── Assert 3: frequency-specific rules ──
  if (freq === 'DAILY' && interval === 1) {
    if (result !== todayStr) {
      errMsgs.push('DAILY interval=1: expected ' + todayStr + ', got ' + result);
    }
  }

  if (freq === 'DAILY' && interval > 1) {
    // Result should be ≤ today and the next step should be > today
    var startDate = parseYMD(chit.start_datetime.split('T')[0]);
    var cur = new Date(startDate);
    var found = false;
    var maxSteps = 10000;
    for (var s = 0; s < maxSteps; s++) {
      var next = new Date(cur);
      next.setDate(next.getDate() + interval);
      if (next > today) {
        if (_fmtDate(cur) !== result) {
          errMsgs.push('DAILY interval=' + interval + ': expected ' + _fmtDate(cur) + ', got ' + result);
        }
        found = true;
        break;
      }
      cur = next;
    }
    if (!found) {
      errMsgs.push('DAILY interval=' + interval + ': could not find matching period');
    }
  }

  if (freq === 'MONTHLY') {
    // Result day should be 01
    var day = result.split('-')[2];
    if (interval === 1) {
      if (day !== '01') {
        errMsgs.push('MONTHLY interval=1: expected day=01, got day=' + day);
      }
      // Should be 1st of current month
      var expectedMonth = today.getFullYear() + '-' + _pad(today.getMonth() + 1) + '-01';
      if (result !== expectedMonth) {
        errMsgs.push('MONTHLY interval=1: expected ' + expectedMonth + ', got ' + result);
      }
    } else {
      if (day !== '01') {
        errMsgs.push('MONTHLY interval=' + interval + ': expected day=01, got day=' + day);
      }
    }
  }

  if (freq === 'YEARLY') {
    if (interval === 1) {
      var expectedYearly = today.getFullYear() + '-01-01';
      if (result !== expectedYearly) {
        errMsgs.push('YEARLY interval=1: expected ' + expectedYearly + ', got ' + result);
      }
    } else {
      // Result should be YYYY-01-01
      var mmdd = result.substring(5);
      if (mmdd !== '01-01') {
        errMsgs.push('YEARLY interval=' + interval + ': expected MM-DD=01-01, got ' + mmdd);
      }
    }
  }

  if (freq === 'WEEKLY' && byDay.length > 0 && interval === 1) {
    // Result's day-of-week should be in byDay array
    var resultDow = resultDate.getDay();
    var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });
    if (byDayNums.indexOf(resultDow) === -1) {
      errMsgs.push('WEEKLY byDay=' + byDay.join(',') + ': result DOW=' + resultDow + ' not in ' + JSON.stringify(byDayNums));
    }
  }

  if (freq === 'WEEKLY' && byDay.length === 0 && interval === 1) {
    // Result should be start of current week (week_start_day=0 = Sunday)
    var weekStartDay = 0;
    var expected = new Date(today);
    var diff = (expected.getDay() - weekStartDay + 7) % 7;
    expected.setDate(expected.getDate() - diff);
    var startDate = parseYMD(chit.start_datetime.split('T')[0]);
    if (expected < startDate) expected = startDate;
    var expectedStr = _fmtDate(expected);
    if (result !== expectedStr) {
      errMsgs.push('WEEKLY no-byDay interval=1: expected ' + expectedStr + ', got ' + result);
    }
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
        result: result,
        errors: errMsgs
      });
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
_log('');
_log('=== Property Test: getCurrentPeriodDate ===');
_log('Feature: habits-view, Property 3: getCurrentPeriodDate returns a valid current-period date');
_log('Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7');
_log('');
_log('Iterations: ' + ITERATIONS);
_log('Passed:     ' + passed);
_log('Failed:     ' + failed);
_log('');

if (failures.length > 0) {
  _log('── First ' + failures.length + ' failure(s): ──');
  for (var f = 0; f < failures.length; f++) {
    var fail = failures[f];
    _log('');
    _log('  Iteration ' + fail.iteration + ':');
    _log('    Chit:   ' + fail.chit);
    _log('    Result: ' + fail.result);
    for (var e = 0; e < fail.errors.length; e++) {
      _log('    ERROR:  ' + fail.errors[e]);
    }
  }
  _log('');
}

if (failed === 0) {
  _log('RESULT: ALL PASSED');
} else {
  _log('RESULT: FAILED (' + failed + '/' + ITERATIONS + ' iterations failed)');
}

_exit(failed > 0 ? 1 : 0);
