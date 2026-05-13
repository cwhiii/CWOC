/**
 * Feature: indicators_zone, Property 8: Range Highlight Classification
 *
 * For any numeric value and any acceptable range (min, max — either or both may be null),
 * the range classification function SHALL return "high" if value > max, "low" if value < min,
 * and "none" if value is within range (inclusive) or if both min and max are null.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * Run: node src/frontend/js/tests/pbt_range_highlight_classification.js
 */

'use strict';

// ── Function Under Test (inlined from editor-health.js) ──────────────────────
function _getRangeHighlightClass(value, rangeMin, rangeMax) {
  if (rangeMin == null && rangeMax == null) return '';
  if (value == null || value === '') return '';
  var numVal = parseFloat(value);
  if (isNaN(numVal)) return '';
  if (rangeMax != null && numVal > rangeMax) return 'indicator-range-high';
  if (rangeMin != null && numVal < rangeMin) return 'indicator-range-low';
  return '';
}

// ── Simple PRNG (Mulberry32) for reproducible randomness ─────────────────────
function mulberry32(seed) {
  return function () {
    var t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Random generators ────────────────────────────────────────────────────────
function randomFloat(rng, min, max) {
  return min + rng() * (max - min);
}

function generateRange(rng) {
  var r = rng();
  if (r < 0.15) {
    // Both null — no range defined
    return { min: null, max: null };
  } else if (r < 0.30) {
    // Only min defined
    return { min: randomFloat(rng, -500, 500), max: null };
  } else if (r < 0.45) {
    // Only max defined
    return { min: null, max: randomFloat(rng, -500, 500) };
  } else {
    // Both defined — ensure min <= max
    var a = randomFloat(rng, -500, 500);
    var b = randomFloat(rng, -500, 500);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
}

function generateValue(rng, range) {
  var r = rng();
  if (r < 0.08) {
    return null;
  } else if (r < 0.16) {
    return '';
  } else if (r < 0.22) {
    return 'abc';
  } else if (r < 0.28) {
    // String representation of a number (should still parse)
    return String(randomFloat(rng, -1000, 1000));
  } else {
    // Numeric value — bias toward interesting positions relative to range
    var subR = rng();
    if (range.min != null && range.max != null && subR < 0.25) {
      // Value exactly at min boundary (inclusive — should be "none")
      return range.min;
    } else if (range.min != null && range.max != null && subR < 0.45) {
      // Value exactly at max boundary (inclusive — should be "none")
      return range.max;
    } else if (range.min != null && range.max != null && subR < 0.60) {
      // Value within range
      return randomFloat(rng, range.min, range.max);
    } else if (range.max != null && subR < 0.75) {
      // Value above max
      return range.max + randomFloat(rng, 0.001, 200);
    } else if (range.min != null && subR < 0.88) {
      // Value below min
      return range.min - randomFloat(rng, 0.001, 200);
    } else {
      // Random numeric value
      return randomFloat(rng, -1000, 1000);
    }
  }
}

// ── Expected result (oracle) ─────────────────────────────────────────────────
function computeExpected(value, rangeMin, rangeMax) {
  if (rangeMin == null && rangeMax == null) return '';
  if (value == null || value === '') return '';
  var numVal = parseFloat(value);
  if (isNaN(numVal)) return '';
  if (rangeMax != null && numVal > rangeMax) return 'indicator-range-high';
  if (rangeMin != null && numVal < rangeMin) return 'indicator-range-low';
  return '';
}

// ── Test runner ──────────────────────────────────────────────────────────────
var ITERATIONS = 20;
var seed = Date.now();
var rng = mulberry32(seed);
var passed = 0;
var failed = 0;
var failures = [];

console.log('Feature: indicators_zone, Property 8: Range Highlight Classification');
console.log('Validates: Requirements 3.1, 3.2, 3.3, 3.4');
console.log('Iterations: ' + ITERATIONS + ', Seed: ' + seed);
console.log('─'.repeat(70));

for (var i = 0; i < ITERATIONS; i++) {
  var range = generateRange(rng);
  var value = generateValue(rng, range);

  var result = _getRangeHighlightClass(value, range.min, range.max);
  var expected = computeExpected(value, range.min, range.max);

  if (result === expected) {
    passed++;
  } else {
    failed++;
    failures.push({
      iteration: i,
      value: JSON.stringify(value),
      rangeMin: range.min,
      rangeMax: range.max,
      expected: expected || '(empty)',
      got: result || '(empty)',
    });
  }
}

console.log('─'.repeat(70));

if (failed === 0) {
  console.log('PASSED: All ' + passed + '/' + ITERATIONS + ' iterations passed.');
} else {
  console.log('FAILED: ' + failed + '/' + ITERATIONS + ' iterations failed.');
  console.log('');
  console.log('Failing examples:');
  for (var j = 0; j < failures.length; j++) {
    var f = failures[j];
    console.log('  Iteration ' + f.iteration + ':');
    console.log('    Value:    ' + f.value);
    console.log('    RangeMin: ' + f.rangeMin);
    console.log('    RangeMax: ' + f.rangeMax);
    console.log('    Expected: ' + f.expected);
    console.log('    Got:      ' + f.got);
  }
  process.exit(1);
}
