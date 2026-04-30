/**
 * Property test for completion-based sort ordering
 *
 * Feature: habits-view, Property 8: Completion-based sort ordering
 * Validates: Requirements 2.7, 2.8, 9.1, 9.2
 *
 * Runs 120 iterations with randomly generated arrays of habit data objects.
 * Verifies:
 *   - All incomplete (not-completed) cards precede all completed cards
 *   - Relative order within each group is preserved (stable sort)
 *
 * Usage: node src/frontend/js/shared/test_habits_sort.js
 *   -or- /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc src/frontend/js/shared/test_habits_sort.js
 */

// ── Runtime compatibility (Node vs JSC) ──────────────────────────────────────
var _log = (typeof console !== 'undefined' && console.log) ? function(msg) { console.log(msg); } : print;
var _exit = (typeof process !== 'undefined' && process.exit) ? function(code) { process.exit(code); } : function(code) { quit(code); };

// ── Sort logic under test (copied from _renderHabitCards in main-views.js) ───
// This is the exact sort logic used in displayHabitsView / _renderHabitCards:
//   var incomplete = visible.filter(function(h) { return !h.isCompleted; });
//   var completed = visible.filter(function(h) { return h.isCompleted; });
//   var sorted = incomplete.concat(completed);
function sortHabits(habitArray) {
  var incomplete = habitArray.filter(function(h) { return !h.isCompleted; });
  var completed = habitArray.filter(function(h) { return h.isCompleted; });
  return incomplete.concat(completed);
}

// ── Random helpers ───────────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Generate a random array of habit data objects ────────────────────────────
// Each object has an `id` (for tracking original position) and `isCompleted`.
function generateRandomHabitArray() {
  var length = randInt(1, 30);
  var habits = [];
  for (var i = 0; i < length; i++) {
    habits.push({
      id: i,
      title: 'Habit ' + i,
      isCompleted: Math.random() < 0.5
    });
  }
  return habits;
}

// ── Test runner ──────────────────────────────────────────────────────────────
var ITERATIONS = 120;
var passed = 0;
var failed = 0;
var failures = [];

for (var iter = 0; iter < ITERATIONS; iter++) {
  var input = generateRandomHabitArray();
  var sorted = sortHabits(input);
  var errMsgs = [];

  // ── Assert 1: output length matches input length ──
  if (sorted.length !== input.length) {
    errMsgs.push('Length mismatch: input=' + input.length + ', sorted=' + sorted.length);
  }

  // ── Assert 2: all incomplete cards precede all completed cards ──
  var seenCompleted = false;
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].isCompleted) {
      seenCompleted = true;
    } else {
      // This is an incomplete card — no completed card should have appeared yet
      if (seenCompleted) {
        errMsgs.push('Incomplete card (id=' + sorted[i].id + ') at index ' + i + ' appears after a completed card');
        break;
      }
    }
  }

  // ── Assert 3: relative order within incomplete group is preserved ──
  var sortedIncomplete = sorted.filter(function(h) { return !h.isCompleted; });
  var inputIncomplete = input.filter(function(h) { return !h.isCompleted; });
  if (sortedIncomplete.length !== inputIncomplete.length) {
    errMsgs.push('Incomplete count mismatch: input=' + inputIncomplete.length + ', sorted=' + sortedIncomplete.length);
  } else {
    for (var j = 0; j < sortedIncomplete.length; j++) {
      if (sortedIncomplete[j].id !== inputIncomplete[j].id) {
        errMsgs.push('Incomplete order not preserved at index ' + j + ': expected id=' + inputIncomplete[j].id + ', got id=' + sortedIncomplete[j].id);
        break;
      }
    }
  }

  // ── Assert 4: relative order within completed group is preserved ──
  var sortedCompleted = sorted.filter(function(h) { return h.isCompleted; });
  var inputCompleted = input.filter(function(h) { return h.isCompleted; });
  if (sortedCompleted.length !== inputCompleted.length) {
    errMsgs.push('Completed count mismatch: input=' + inputCompleted.length + ', sorted=' + sortedCompleted.length);
  } else {
    for (var k = 0; k < sortedCompleted.length; k++) {
      if (sortedCompleted[k].id !== inputCompleted[k].id) {
        errMsgs.push('Completed order not preserved at index ' + k + ': expected id=' + inputCompleted[k].id + ', got id=' + sortedCompleted[k].id);
        break;
      }
    }
  }

  // ── Tally ──
  if (errMsgs.length === 0) {
    passed++;
  } else {
    failed++;
    if (failures.length < 10) {
      var inputSummary = input.map(function(h) { return h.id + ':' + (h.isCompleted ? 'C' : 'I'); }).join(' ');
      var sortedSummary = sorted.map(function(h) { return h.id + ':' + (h.isCompleted ? 'C' : 'I'); }).join(' ');
      failures.push({
        iteration: iter + 1,
        inputLength: input.length,
        input: inputSummary,
        sorted: sortedSummary,
        errors: errMsgs
      });
    }
  }
}

// ── Edge case: empty array ──
var emptyResult = sortHabits([]);
if (emptyResult.length !== 0) {
  failed++;
  failures.push({ iteration: 'edge-empty', errors: ['Empty input should return empty array, got length ' + emptyResult.length] });
} else {
  passed++;
}

// ── Edge case: all incomplete ──
var allIncomplete = [
  { id: 0, title: 'A', isCompleted: false },
  { id: 1, title: 'B', isCompleted: false },
  { id: 2, title: 'C', isCompleted: false }
];
var allIncResult = sortHabits(allIncomplete);
var allIncOk = true;
for (var ai = 0; ai < allIncResult.length; ai++) {
  if (allIncResult[ai].id !== allIncomplete[ai].id) { allIncOk = false; break; }
}
if (!allIncOk || allIncResult.length !== 3) {
  failed++;
  failures.push({ iteration: 'edge-all-incomplete', errors: ['All-incomplete array should preserve original order'] });
} else {
  passed++;
}

// ── Edge case: all completed ──
var allCompleted = [
  { id: 0, title: 'A', isCompleted: true },
  { id: 1, title: 'B', isCompleted: true },
  { id: 2, title: 'C', isCompleted: true }
];
var allCompResult = sortHabits(allCompleted);
var allCompOk = true;
for (var ac = 0; ac < allCompResult.length; ac++) {
  if (allCompResult[ac].id !== allCompleted[ac].id) { allCompOk = false; break; }
}
if (!allCompOk || allCompResult.length !== 3) {
  failed++;
  failures.push({ iteration: 'edge-all-completed', errors: ['All-completed array should preserve original order'] });
} else {
  passed++;
}

// ── Edge case: single incomplete item ──
var singleInc = [{ id: 0, title: 'Solo', isCompleted: false }];
var singleIncResult = sortHabits(singleInc);
if (singleIncResult.length !== 1 || singleIncResult[0].id !== 0 || singleIncResult[0].isCompleted !== false) {
  failed++;
  failures.push({ iteration: 'edge-single-incomplete', errors: ['Single incomplete item should be returned as-is'] });
} else {
  passed++;
}

// ── Edge case: single completed item ──
var singleComp = [{ id: 0, title: 'Solo', isCompleted: true }];
var singleCompResult = sortHabits(singleComp);
if (singleCompResult.length !== 1 || singleCompResult[0].id !== 0 || singleCompResult[0].isCompleted !== true) {
  failed++;
  failures.push({ iteration: 'edge-single-completed', errors: ['Single completed item should be returned as-is'] });
} else {
  passed++;
}

// ── Edge case: alternating pattern (I, C, I, C, I, C) ──
var alternating = [
  { id: 0, title: 'A', isCompleted: false },
  { id: 1, title: 'B', isCompleted: true },
  { id: 2, title: 'C', isCompleted: false },
  { id: 3, title: 'D', isCompleted: true },
  { id: 4, title: 'E', isCompleted: false },
  { id: 5, title: 'F', isCompleted: true }
];
var altResult = sortHabits(alternating);
// Expected: [0:I, 2:I, 4:I, 1:C, 3:C, 5:C]
var altExpectedIds = [0, 2, 4, 1, 3, 5];
var altOk = altResult.length === 6;
for (var alt = 0; alt < altResult.length && altOk; alt++) {
  if (altResult[alt].id !== altExpectedIds[alt]) altOk = false;
}
if (!altOk) {
  var altGot = altResult.map(function(h) { return h.id; }).join(',');
  failed++;
  failures.push({ iteration: 'edge-alternating', errors: ['Alternating pattern: expected ids [0,2,4,1,3,5], got [' + altGot + ']'] });
} else {
  passed++;
}

// ── Edge case: completed first, then incomplete (reverse of desired) ──
var reversed = [
  { id: 0, title: 'A', isCompleted: true },
  { id: 1, title: 'B', isCompleted: true },
  { id: 2, title: 'C', isCompleted: false },
  { id: 3, title: 'D', isCompleted: false }
];
var revResult = sortHabits(reversed);
// Expected: [2:I, 3:I, 0:C, 1:C]
var revExpectedIds = [2, 3, 0, 1];
var revOk = revResult.length === 4;
for (var rv = 0; rv < revResult.length && revOk; rv++) {
  if (revResult[rv].id !== revExpectedIds[rv]) revOk = false;
}
if (!revOk) {
  var revGot = revResult.map(function(h) { return h.id; }).join(',');
  failed++;
  failures.push({ iteration: 'edge-reversed', errors: ['Reversed input: expected ids [2,3,0,1], got [' + revGot + ']'] });
} else {
  passed++;
}

var TOTAL_TESTS = ITERATIONS + 7;

// ── Summary ──────────────────────────────────────────────────────────────────
_log('');
_log('=== Property Test: Completion-based Sort Ordering ===');
_log('Feature: habits-view, Property 8: Completion-based sort ordering');
_log('Validates: Requirements 2.7, 2.8, 9.1, 9.2');
_log('');
_log('Iterations: ' + TOTAL_TESTS + ' (' + ITERATIONS + ' random + 7 edge cases)');
_log('Passed:     ' + passed);
_log('Failed:     ' + failed);
_log('');

if (failures.length > 0) {
  _log('── First ' + failures.length + ' failure(s): ──');
  for (var f = 0; f < failures.length; f++) {
    var fail = failures[f];
    _log('');
    _log('  Iteration ' + fail.iteration + ':');
    if (fail.inputLength) _log('    Input length: ' + fail.inputLength);
    if (fail.input) _log('    Input:  ' + fail.input);
    if (fail.sorted) _log('    Sorted: ' + fail.sorted);
    for (var fe = 0; fe < fail.errors.length; fe++) {
      _log('    ERROR:  ' + fail.errors[fe]);
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
